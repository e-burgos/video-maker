import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import { StoryboardDocumentSchema } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeAiAgent } from '../__fixtures__/fake-ai-agent';
import { FAKE_AI_AGENT_USAGE } from '../__fixtures__/fake-ai-agent';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildStoryboardProposal } from '../__fixtures__/storyboard-fixtures';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import type { StoryboardStage } from './render-job';
import { runStoryboardPipeline } from './run-storyboard-pipeline';
import type { StoryboardPipelineObserver } from './storyboard-pipeline-observer';
import { isStoryboardPipelineCanceled } from './storyboard-pipeline-observer';

const PROJECT_ROOT = '/media/acme-launch';
const PROJECT = resolveMediaProject(PROJECT_ROOT);
const STORYBOARD_ABSOLUTE = `${PROJECT_ROOT}/work/storyboard.json`;

interface Harness {
  readonly deps: ReturnType<typeof createFakeRenderApiDependencies>;
  readonly storage: ReturnType<typeof createFakeObjectStorage>;
  readonly stages: StoryboardStage[];
  readonly observer: StoryboardPipelineObserver;
  readonly requests: ReturnType<typeof createFakeAiAgent>['requests'];
}

function harness(answer: unknown, cancelAt?: StoryboardStage): Harness {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT, `${PROJECT_ROOT}/work`] });
  const fakeAgent = createFakeAiAgent(answer, callLog);
  const deps = createFakeRenderApiDependencies(callLog, { storage, aiAgent: fakeAgent.agent });
  const stages: StoryboardStage[] = [];

  const observer: StoryboardPipelineObserver = {
    stageStarted: (stage) => stages.push(stage),
    cancellationRequested: () => cancelAt !== undefined && stages.at(-1) === previousStageOf(cancelAt),
  };

  return { deps, storage, stages, observer, requests: fakeAgent.requests };
}

function previousStageOf(stage: StoryboardStage): StoryboardStage | undefined {
  const order: readonly StoryboardStage[] = ['collect', 'propose', 'persist'];
  const index = order.indexOf(stage);
  return index <= 0 ? undefined : order[index - 1];
}

const REQUEST = {
  project: PROJECT,
  storyboardId: 'storyboard-0001',
  brief: 'Un video corto sobre las trampas de un monorepo.',
  scriptText: null,
};

describe('runStoryboardPipeline', () => {
  it('recorre las tres etapas en orden y persiste el documento', async () => {
    const { deps, storage, stages, observer } = harness(buildStoryboardProposal());

    const report = await runStoryboardPipeline(REQUEST, deps, observer);

    expect(stages).toEqual(['collect', 'propose', 'persist']);
    expect(report.storyboardPath).toBe('work/storyboard.json');
    expect(report.storyboardId).toBe('storyboard-0001');
    expect(report.source).toBe('brief');
    expect(report.language).toBe('es-AR');
    expect(report.sceneCount).toBe(3);
    expect(report.usage).toEqual({
      tokensIn: FAKE_AI_AGENT_USAGE.tokensIn,
      tokensOut: FAKE_AI_AGENT_USAGE.tokensOut,
      costUsd: FAKE_AI_AGENT_USAGE.costUsd,
      model: FAKE_AI_AGENT_USAGE.model,
    });

    const persisted = JSON.parse(await storage.readTextFile(STORYBOARD_ABSOLUTE));
    expect(StoryboardDocumentSchema.safeParse(persisted).success).toBe(true);
  });

  it('marca source script cuando la entrada es un guion', async () => {
    const { deps, observer } = harness(buildStoryboardProposal());

    const report = await runStoryboardPipeline(
      { ...REQUEST, brief: null, scriptText: 'Hola. Hoy vemos Nx.' },
      deps,
      observer,
    );

    expect(report.source).toBe('script');
  });

  it('le pasa al agente el system prompt, el user prompt y el JSON Schema derivado', async () => {
    const { deps, observer, requests } = harness(buildStoryboardProposal());

    await runStoryboardPipeline(REQUEST, deps, observer);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.systemPrompt).toContain('storyboard writer');
    expect(requests[0]?.userPrompt).toContain('Un video corto sobre las trampas de un monorepo.');
    expect((requests[0]?.jsonSchema as { properties?: unknown }).properties).toHaveProperty('scenes');
  });

  it('incluye el storyboard previo en el prompt cuando el proyecto ya tenía uno', async () => {
    const callLog = createCallLog();
    const previous = serializeMontageDocument({
      schemaVersion: 1,
      id: 'storyboard-0000',
      source: 'brief',
      createdAt: '2026-09-08T00:00:00.000Z',
      title: 'Versión anterior',
      language: 'es-AR',
      format: '9:16',
      captionsStyle: 'kinetic-bold',
      musicTags: ['tense'],
      characters: [{ id: 'character-01', name: 'Ana', visualDescription: 'Red framed glasses.' }],
      scenes: [
        {
          id: 'scene-01',
          index: 1,
          narration: 'Hola.',
          visualPrompt: 'Ana at her desk.',
          visualSource: 'upload',
          estimatedDurationMs: 2000,
          musicTags: [],
          sfxTags: [],
        },
      ],
    });
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT, `${PROJECT_ROOT}/work`],
      files: [{ path: STORYBOARD_ABSOLUTE, contents: previous }],
    });
    const fakeAgent = createFakeAiAgent(buildStoryboardProposal(), callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage, aiAgent: fakeAgent.agent });

    await runStoryboardPipeline(REQUEST, deps, {
      stageStarted: () => undefined,
      cancellationRequested: () => false,
    });

    expect(fakeAgent.requests[0]?.userPrompt).toContain('# Previous storyboard');
    expect(fakeAgent.requests[0]?.userPrompt).toContain('Red framed glasses.');
  });

  it('primer intento válido: llama al agente una sola vez, sin reparación', async () => {
    const { deps, observer, requests } = harness(buildStoryboardProposal());

    const report = await runStoryboardPipeline(REQUEST, deps, observer);

    expect(requests).toHaveLength(1);
    expect(report.sceneCount).toBe(3);
    expect(report.usage).toEqual({
      tokensIn: FAKE_AI_AGENT_USAGE.tokensIn,
      tokensOut: FAKE_AI_AGENT_USAGE.tokensOut,
      costUsd: FAKE_AI_AGENT_USAGE.costUsd,
      model: FAKE_AI_AGENT_USAGE.model,
    });
  });

  it('repara un primer intento inválido con una segunda llamada, y suma el usage de ambas', async () => {
    const answers = [{ title: 'sin escenas' }, buildStoryboardProposal()];
    const { deps, observer, requests } = harness((_request: unknown, index: number) => answers[index]);

    const report = await runStoryboardPipeline(REQUEST, deps, observer);

    expect(requests).toHaveLength(2);
    expect(report.sceneCount).toBe(3);
    expect(report.usage.tokensIn).toBe(FAKE_AI_AGENT_USAGE.tokensIn * 2);
    expect(report.usage.tokensOut).toBe(FAKE_AI_AGENT_USAGE.tokensOut * 2);
    expect(report.usage.costUsd).toBeCloseTo(FAKE_AI_AGENT_USAGE.costUsd * 2, 10);
    expect(requests[1]?.userPrompt).toContain('# Your previous answer was rejected');
    expect(requests[1]?.userPrompt).toContain('scenes');
    expect(requests[1]?.systemPrompt).toBe(requests[0]?.systemPrompt);
  });

  it('reporta AI_AGENT_INVALID_OUTPUT con la etapa propose cuando la propuesta no valida ni tras la reparación', async () => {
    const { deps, observer, requests } = harness({ title: 'sin escenas' });

    try {
      await runStoryboardPipeline(REQUEST, deps, observer);
      expect.unreachable('una propuesta inválida en ambos intentos debe fallar');
    } catch (error) {
      expect(isRenderApiError(error) && error.code).toBe('AI_AGENT_INVALID_OUTPUT');
      expect(isRenderApiError(error) && error.stage).toBe('propose');
    }
    expect(requests).toHaveLength(2);
  });

  it('traduce a INTERNAL_ERROR con la etapa propose un fallo no tipado del agente', async () => {
    const { deps, observer } = harness(new Error('boom'));

    try {
      await runStoryboardPipeline(REQUEST, deps, observer);
      expect.unreachable('un fallo del agente debe propagarse');
    } catch (error) {
      expect(isRenderApiError(error) && error.code).toBe('INTERNAL_ERROR');
      expect(isRenderApiError(error) && error.stage).toBe('propose');
    }
  });

  it('estampa la etapa propose en el error tipado que llega sin etapa del agente', async () => {
    const { deps, observer } = harness(
      new PipelineStageError({ code: 'AI_AGENT_RATE_LIMITED', stage: null, resource: 'ai-agent' }),
    );

    try {
      await runStoryboardPipeline(REQUEST, deps, observer);
      expect.unreachable('un fallo del agente debe propagarse');
    } catch (error) {
      expect(isRenderApiError(error) && error.code).toBe('AI_AGENT_RATE_LIMITED');
      expect(isRenderApiError(error) && error.stage).toBe('propose');
      expect(isRenderApiError(error) && error.resource).toBe('ai-agent');
    }
  });

  it('no reestampa la etapa de un error que ya la trae', async () => {
    const { deps, observer } = harness(
      new PipelineStageError({ code: 'AI_AGENT_FAILED', stage: 'collect', resource: 'ai-agent' }),
    );

    await expect(runStoryboardPipeline(REQUEST, deps, observer)).rejects.toMatchObject({ stage: 'collect' });
  });

  it('no escribe el documento cuando se cancela antes de persist', async () => {
    const { deps, storage, observer } = harness(buildStoryboardProposal(), 'persist');

    try {
      await runStoryboardPipeline(REQUEST, deps, observer);
      expect.unreachable('la cancelación debe cortar el pipeline');
    } catch (error) {
      expect(isStoryboardPipelineCanceled(error)).toBe(true);
    }

    expect(await storage.stat(STORYBOARD_ABSOLUTE)).toBeNull();
  });

  it('no invoca al agente cuando se cancela antes de propose', async () => {
    const { deps, observer, requests } = harness(buildStoryboardProposal(), 'propose');

    await expect(runStoryboardPipeline(REQUEST, deps, observer)).rejects.toThrow();

    expect(requests).toEqual([]);
  });
});
