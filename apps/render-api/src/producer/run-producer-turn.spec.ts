import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it, vi } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { OPENROUTER_MODELS_SAMPLE_PAYLOAD } from '../__fixtures__/openrouter-models-sample';
import { readProducerConfig } from '../config/producer-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { httpStatusFor } from '../errors/http-status-for';
import { isRenderApiError } from '../errors/render-api-error';
import { OPENROUTER_SECRET_NAME, PRODUCER_ENGINE_SETTING_KEY } from '../http/handlers/producer-settings-handler';
import { defaultRecommendedOpenRouterModel } from '../config/recommended-openrouter-models';
import { createOpenRouterModelCatalog } from './openrouter-model-catalog';
import type { CreateOpenRouterProducerAgentOptions } from './openrouter-producer-agent';
import { readProducerConversation, readProducerSession } from './producer-store';
import type { ProducerTurnResult, ProducerTurnRun, ProducerTurnStart } from './producer-agent';
import { createProducerTurnRegistry } from './producer-turn-registry';
import { assertProducerMessageText, startProducerTurn } from './run-producer-turn';

const PROJECT = resolveMediaProject('/media/demo-01');
const CONFIG = readProducerConfig({}, '/repo', 'http://127.0.0.1:4399', '/tmp');
const MARKDOWN_PATH = '/media/demo-01/work/producer/conversation.md';

const OK_RESULT: ProducerTurnResult = {
  exitCode: 0,
  canceled: false,
  timedOut: false,
  spawnFailed: false,
  stderr: '',
};

const ANSWER = 'Tenés un A-roll de 26 s.\n\n```suggestions\n["Dale", "Cambiá el guion"]\n```';

interface ScriptedAgent {
  readonly lines: readonly string[];
  readonly result?: ProducerTurnResult;
}

function scenario(script: ScriptedAgent, overrides?: Partial<RenderApiDependencies>) {
  const callLog = createCallLog();
  const storage =
    (overrides?.storage as ReturnType<typeof createFakeObjectStorage> | undefined) ??
    createFakeObjectStorage(callLog, {
      directories: [
        '/media/demo-01',
        '/media/demo-01/raw',
        '/media/demo-01/raw/aroll',
        '/media/demo-01/work',
      ],
      files: [{ path: '/media/demo-01/raw/aroll/clip01.mp4', contents: 'video' }],
    });
  const starts: ProducerTurnStart[] = [];
  const cancels: string[] = [];
  let counter = 0;

  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    fetchRemote: createFakeFetchRemote({ status: 200, bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD) })
      .fetchRemote,
    randomId: () => {
      counter += 1;
      return `id-${String(counter).padStart(2, '0')}`;
    },
    producerAgent: (start, onLine) => {
      starts.push(start);
      for (const line of script.lines) {
        onLine(line);
      }
      return {
        cancel: () => cancels.push('cancel'),
        completed: Promise.resolve(script.result ?? OK_RESULT),
      };
    },
    ...overrides,
  });

  if (!deps.localStore.projects.exists('demo-01')) {
    deps.localStore.projects.insert('demo-01');
  }

  return { callLog, storage, deps, starts, cancels, registry: createProducerTurnRegistry() };
}

function streamOf(answer: string, sessionId = 'session-abc'): readonly string[] {
  return [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }),
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Miro el material.' },
          {
            type: 'tool_use',
            name: 'mcp__studio__probe_media',
            input: { path: 'raw/aroll/clip01.mp4' },
          },
        ],
      },
    }),
    'no es json y no debe romper el turno',
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: answer }),
  ];
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('assertProducerMessageText', () => {
  it('exige texto y devuelve el mensaje sin espacios de borde', () => {
    expect(assertProducerMessageText('  hola  ')).toBe('hola');
    expect(() => assertProducerMessageText('   ')).toThrow();
    expect(() => assertProducerMessageText(7)).toThrow();
  });
});

describe('startProducerTurn', () => {
  it('persiste el mensaje del usuario ANTES de responder, para que el chat lo muestre ya', async () => {
    const { deps, registry } = scenario({ lines: streamOf(ANSWER) });

    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });

    const persisted = readProducerConversation(deps, PROJECT);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ role: 'user', text: 'hola', turnId: started.turnId });
    expect(registry.get(started.turnId).status).toBe('running');

    await started.completed;
  });

  it('abre sesión nueva en el primer turno y la retoma en el segundo', async () => {
    let sharedCounter = 0;
    const sharedRandomId = (): string => {
      sharedCounter += 1;
      return `id-${String(sharedCounter).padStart(2, '0')}`;
    };

    const first = scenario({ lines: streamOf(ANSWER) }, { randomId: sharedRandomId });
    const started = await startProducerTurn(first.deps, first.registry, {
      project: PROJECT,
      text: 'hola',
      config: CONFIG,
    });
    await started.completed;

    expect(first.starts[0]?.resume).toBe(false);
    const session = readProducerSession(first.deps, PROJECT);
    expect(session).toMatchObject({ sessionId: 'session-abc', model: 'sonnet' });
    expect(first.starts[0]?.sessionId).not.toBe('session-abc');

    const second = scenario(
      { lines: streamOf(ANSWER) },
      { storage: first.storage, localStore: first.deps.localStore, randomId: sharedRandomId },
    );
    const startedAgain = await startProducerTurn(second.deps, second.registry, {
      project: PROJECT,
      text: 'seguí',
      config: CONFIG,
    });
    await startedAgain.completed;

    expect(second.starts[0]?.resume).toBe(true);
    expect(second.starts[0]?.sessionId).toBe(session?.sessionId);
  });

  it('persiste el sessionId que reporta el CLI, no el uuid que le pasamos, y cae al nuestro sin init', async () => {
    const { deps, registry } = scenario({
      lines: [
        JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'listo' }),
      ],
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const session = readProducerSession(deps, PROJECT);
    expect(session?.sessionId).toBe('id-03');
  });

  it('acumula los eventos legibles del stream y descarta la línea que no es JSON', async () => {
    const { deps, registry } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId).events).toEqual([
      { type: 'status', status: 'started' },
      { type: 'text', text: 'Miro el material.' },
      { type: 'tool', name: 'mcp__studio__probe_media', summary: 'Measuring raw/aroll/clip01.mp4' },
    ]);
  });

  it('cierra con la respuesta sin el bloque de sugerencias y con las sugerencias aparte', async () => {
    const { deps, registry, storage } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const record = registry.get(started.turnId);
    expect(record.status).toBe('succeeded');
    expect(record.assistantMessage).toBe('Tenés un A-roll de 26 s.');
    expect(record.suggestions).toEqual(['Dale', 'Cambiá el guion']);

    const persisted = readProducerConversation(deps, PROJECT);
    expect(persisted).toHaveLength(2);
    expect(persisted[1]).toMatchObject({
      role: 'assistant',
      text: 'Tenés un A-roll de 26 s.',
      suggestions: ['Dale', 'Cambiá el guion'],
    });
    expect(await storage.readTextFile(MARKDOWN_PATH)).toContain('- Productor: Tenés un A-roll de 26 s.');
  });

  it('guarda el jsonl crudo del turno, línea por línea, incluida la que no parsea', async () => {
    const lines = streamOf(ANSWER);
    const { deps, registry, storage } = scenario({ lines });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const raw = await storage.readTextFile(`/media/demo-01/work/producer/turns/${started.turnId}.jsonl`);
    expect(raw).toBe(`${lines.join('\n')}\n`);
  });

  it('un turno cancelado queda canceled, sin error y sin mensaje del asistente', async () => {
    const { deps, registry } = scenario({
      lines: [JSON.stringify({ type: 'system', subtype: 'init', session_id: 's' })],
      result: { ...OK_RESULT, canceled: true, exitCode: null },
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId)).toMatchObject({
      status: 'canceled',
      error: null,
      assistantMessage: null,
    });
    expect(readProducerConversation(deps, PROJECT)).toHaveLength(1);
    expect(readProducerSession(deps, PROJECT)).toBeNull();
  });

  it('el 429 de la suscripción cierra el turno como failed con PRODUCER_RATE_LIMITED', async () => {
    const { deps, registry } = scenario({
      lines: [
        JSON.stringify({
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          result: 'Claude usage limit reached',
        }),
      ],
      result: { ...OK_RESULT, exitCode: 1 },
    });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(registry.get(started.turnId).error?.code).toBe('PRODUCER_RATE_LIMITED');
  });

  it('un fallo escribiendo el markdown de la conversación cierra el turno como failed en vez de quedar colgado', async () => {
    const { deps, registry, storage } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    storage.control.queueReadTextFileError(
      MARKDOWN_PATH,
      Object.assign(new Error('EIO'), { code: 'EIO' }),
    );
    await started.completed;

    expect(registry.get(started.turnId).status).toBe('failed');
  });

  it('rechaza el turno con PRODUCER_UNAVAILABLE si falta el binario, sin reservar el proyecto', async () => {
    const withoutBinary = scenario({ lines: [] }, { probeProducerBinary: async () => false });
    expect(
      await codeOf(
        startProducerTurn(withoutBinary.deps, withoutBinary.registry, {
          project: PROJECT,
          text: 'hola',
          config: CONFIG,
        }),
      ),
    ).toBe('PRODUCER_UNAVAILABLE');
    expect(withoutBinary.registry.activeFor('demo-01')).toBeNull();
  });

  it('el segundo turno del mismo proyecto rebota con PRODUCER_TURN_ACTIVE', async () => {
    const { deps, registry } = scenario({ lines: [] });

    registry.reserve('demo-01', 'turn-en-curso', '2026-09-10T10:00:00.000Z');
    expect(
      await codeOf(startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG })),
    ).toBe('PRODUCER_TURN_ACTIVE');
  });

  it('pasa al agente el prompt del productor construido por la lib', async () => {
    const { deps, registry, starts } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(starts[0]?.systemPrompt).toContain('# Your tools');
    expect(starts[0]?.systemPrompt).toContain('# This project');
    expect(starts[0]?.systemPrompt).toContain('get_project_overview');
  });

  it('arma el config MCP del turno con el slug del proyecto, la URL de la API y el modelo', async () => {
    const { deps, registry, starts } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const mcpConfig = JSON.parse(starts[0]?.mcpConfig ?? '{}');
    expect(mcpConfig.mcpServers.studio.args).toContain('--project');
    expect(mcpConfig.mcpServers.studio.args).toContain('demo-01');
    expect(mcpConfig.mcpServers.studio.args).toContain('http://127.0.0.1:4399');
    expect(mcpConfig.mcpServers.studio.args).toContain('sonnet');
  });

  it('arranca el turno en un cwd neutro por proyecto, afuera del repo y de la carpeta de medios', async () => {
    const { deps, registry, starts, callLog } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    expect(starts[0]?.cwd).toBe('/tmp/video-maker-producer/demo-01');
    expect(callLog.entries().filter((entry) => entry.port === 'ensureDirectory')).toContainEqual({
      port: 'ensureDirectory',
      input: '/tmp/video-maker-producer/demo-01',
    });
  });
});

const OPENROUTER_MODEL = 'anthropic/claude-haiku-4.5';
const OPENROUTER_NON_RECOMMENDED_MODEL = 'fireworks/ember-1';
const OPENROUTER_SECRET = 'sk-or-v1-never-leak-this-exact-string';

interface OpenRouterScript {
  readonly finalText?: string;
  readonly usage?: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
  readonly fail?: { code: string; hint: string };
  readonly onStart?: (run: ProducerTurnRun) => void;
}

function scriptedOpenRouterAgentFactory(
  script: OpenRouterScript,
  captured: { options: CreateOpenRouterProducerAgentOptions[]; starts: ProducerTurnStart[] },
) {
  return (options: CreateOpenRouterProducerAgentOptions) => {
    captured.options.push(options);
    return (start: ProducerTurnStart, onLine: (line: string) => void): ProducerTurnRun => {
      captured.starts.push(start);
      onLine(JSON.stringify({ type: 'system', subtype: 'init', session_id: start.sessionId }));

      let resolveCompleted: (result: ProducerTurnResult) => void = () => undefined;
      const completed = new Promise<ProducerTurnResult>((resolve) => {
        resolveCompleted = resolve;
      });

      const run: ProducerTurnRun = {
        cancel: () => resolveCompleted({ exitCode: null, canceled: true, timedOut: false, spawnFailed: false, stderr: '' }),
        completed,
      };

      if (script.onStart !== undefined) {
        script.onStart(run);
      } else if (script.fail !== undefined) {
        onLine(
          JSON.stringify({
            type: 'result',
            subtype: `openrouter:${script.fail.code}`,
            is_error: true,
            result: script.fail.hint,
          }),
        );
        resolveCompleted({ exitCode: 1, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
      } else {
        onLine(
          JSON.stringify({
            type: 'result',
            subtype: 'success',
            is_error: false,
            result: script.finalText ?? 'Job en marcha.',
            usage: script.usage ?? { inputTokens: 120, outputTokens: 40, costUsd: 0.0013 },
          }),
        );
        resolveCompleted({ exitCode: 0, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
      }

      return run;
    };
  };
}

async function withOpenRouterEngine(base: ReturnType<typeof scenario>, apiKey: string | null = OPENROUTER_SECRET): Promise<void> {
  base.deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, 'openrouter');
  if (apiKey !== null) {
    await base.deps.secretStore.set(OPENROUTER_SECRET_NAME, apiKey);
  }
}

describe('startProducerTurn — engine routing (OpenRouter)', () => {
  it('routes to the OpenRouter agent, persists the same message shape as Claude plus usage, and never writes a resumable session', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'Armá el montaje', config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
    );
    await started.completed;

    expect(captured.options[0]?.chatModel).toBe(defaultRecommendedOpenRouterModel().id);
    expect(captured.options[0]?.apiKey).toBe(OPENROUTER_SECRET);

    const record = base.registry.get(started.turnId);
    expect(record.status).toBe('succeeded');
    expect(record.assistantMessage).toBe('Job en marcha.');
    expect(record.usage).toEqual({ inputTokens: 120, outputTokens: 40, costUsd: 0.0013 });

    const persisted = readProducerConversation(base.deps, PROJECT);
    expect(persisted).toHaveLength(2);
    expect(Object.keys(persisted[1] as object).sort()).toEqual(
      ['createdAt', 'id', 'model', 'role', 'text', 'turnId', 'usage'].sort(),
    );
    expect(persisted[1]?.usage).toEqual({ inputTokens: 120, outputTokens: 40, costUsd: 0.0013 });

    // The OpenRouter engine never resumes a CLI session; history is rebuilt from the store instead.
    expect(readProducerSession(base.deps, PROJECT)).toBeNull();
  });

  it('leaves usage undefined on a Claude-engine assistant message', async () => {
    const { deps, registry } = scenario({ lines: streamOf(ANSWER) });
    const started = await startProducerTurn(deps, registry, { project: PROJECT, text: 'hola', config: CONFIG });
    await started.completed;

    const persisted = readProducerConversation(deps, PROJECT);
    expect(persisted[1]?.usage).toBeUndefined();
  });

  it('rejects with OPENROUTER_KEY_MISSING, mapped to HTTP 409, and never reserves a turn when the key is absent', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base, null);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const code = await codeOf(
      startProducerTurn(
        base.deps,
        base.registry,
        { project: PROJECT, text: 'hola', config: CONFIG },
        scriptedOpenRouterAgentFactory({}, captured),
      ),
    );

    expect(code).toBe('OPENROUTER_KEY_MISSING');
    expect(httpStatusFor('OPENROUTER_KEY_MISSING')).toBe(409);
    expect(base.registry.activeFor('demo-01')).toBeNull();
    expect(captured.starts).toEqual([]);
  });

  it('rejects a Claude model alias sent while the OpenRouter engine is active, with PRODUCER_MODEL_INVALID', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const code = await codeOf(
      startProducerTurn(
        base.deps,
        base.registry,
        { project: PROJECT, text: 'hola', model: 'sonnet', config: CONFIG },
        scriptedOpenRouterAgentFactory({}, captured),
      ),
    );

    expect(code).toBe('PRODUCER_MODEL_INVALID');
    expect(captured.starts).toEqual([]);
  });

  it('accepts a tool-capable OpenRouter model id from the live catalog even when it is not recommended', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', model: OPENROUTER_NON_RECOMMENDED_MODEL, config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
    );
    await started.completed;

    expect(captured.options[0]?.chatModel).toBe(OPENROUTER_NON_RECOMMENDED_MODEL);
    expect(base.registry.get(started.turnId).status).toBe('succeeded');
  });

  it('falls back to accepting only recommended ids when the live catalog is unreachable', async () => {
    const failing = createFakeFetchRemote({ status: 503 });
    const base = scenario({ lines: [] }, { fetchRemote: failing.fetchRemote });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const rejected = await codeOf(
      startProducerTurn(
        base.deps,
        base.registry,
        { project: PROJECT, text: 'hola', model: OPENROUTER_NON_RECOMMENDED_MODEL, config: CONFIG },
        scriptedOpenRouterAgentFactory({}, captured),
      ),
    );
    expect(rejected).toBe('PRODUCER_MODEL_INVALID');

    const accepted = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', model: OPENROUTER_MODEL, config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
    );
    await accepted.completed;
    expect(base.registry.get(accepted.turnId).status).toBe('succeeded');
  });

  it('picks the isDefault recommended model regardless of catalog order, not just the first recommended id it happens to see', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });
    const base = scenario({ lines: [] }, { fetchRemote });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
    );
    await started.completed;

    expect(captured.options[0]?.chatModel).toBe(defaultRecommendedOpenRouterModel().id);
    expect(captured.options[0]?.chatModel).not.toBe(OPENROUTER_MODEL);
  });

  it('reuses one shared catalog across turns so only the first turn hits the network', async () => {
    const { fetchRemote, calls } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });
    const base = scenario({ lines: [] }, { fetchRemote });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };
    const sharedCatalog = createOpenRouterModelCatalog();

    const first = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
      sharedCatalog,
    );
    await first.completed;

    const second = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'seguí', config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
      sharedCatalog,
    );
    await second.completed;

    expect(calls.length).toBe(1);
  });

  it('maps a typed OpenRouter runtime failure to the matching error code, keeping the user message persisted', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', config: CONFIG },
      scriptedOpenRouterAgentFactory(
        { fail: { code: 'OPENROUTER_RATE_LIMITED', hint: 'rate limited, retry later' } },
        captured,
      ),
    );
    await started.completed;

    const record = base.registry.get(started.turnId);
    expect(record.status).toBe('failed');
    expect(record.error?.code).toBe('OPENROUTER_RATE_LIMITED');
    expect(readProducerConversation(base.deps, PROJECT)).toHaveLength(1);
  });

  it('maps the free-tier daily quota exhaustion to its own error code with the Spanish hint intact', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };
    const hint = 'Se agotó la cuota diaria de modelos gratis de OpenRouter; se reinicia a las 00:00 UTC. Elegí un modelo pago barato o esperá.';

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', config: CONFIG },
      scriptedOpenRouterAgentFactory({ fail: { code: 'OPENROUTER_FREE_QUOTA_EXHAUSTED', hint } }, captured),
    );
    await started.completed;

    const record = base.registry.get(started.turnId);
    expect(record.status).toBe('failed');
    expect(record.error?.code).toBe('OPENROUTER_FREE_QUOTA_EXHAUSTED');
    expect(record.error?.hint).toBe(hint);
  });

  it('cancels the OpenRouter turn through the registry the same way as the Claude path', async () => {
    const base = scenario({ lines: [] });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola', config: CONFIG },
      scriptedOpenRouterAgentFactory({ onStart: () => undefined }, captured),
    );

    base.registry.requestCancel(started.turnId);
    await started.completed;

    expect(base.registry.get(started.turnId)).toMatchObject({ status: 'canceled', error: null, assistantMessage: null });
  });

  it('never puts the OpenRouter API key in the turn log, the persisted conversation, the conversation markdown, or any logger call', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const base = scenario({ lines: [] }, { logger });
    await withOpenRouterEngine(base);
    const captured = { options: [] as CreateOpenRouterProducerAgentOptions[], starts: [] as ProducerTurnStart[] };

    const started = await startProducerTurn(
      base.deps,
      base.registry,
      { project: PROJECT, text: 'hola, generá un guion', config: CONFIG },
      scriptedOpenRouterAgentFactory({}, captured),
    );
    await started.completed;

    const turnLog = await base.storage.readTextFile(`/media/demo-01/work/producer/turns/${started.turnId}.jsonl`);
    expect(turnLog).not.toContain(OPENROUTER_SECRET);

    const markdown = await base.storage.readTextFile(MARKDOWN_PATH);
    expect(markdown).not.toContain(OPENROUTER_SECRET);

    const conversationDump = JSON.stringify(readProducerConversation(base.deps, PROJECT));
    expect(conversationDump).not.toContain(OPENROUTER_SECRET);

    for (const call of [...logger.info.mock.calls, ...logger.error.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain(OPENROUTER_SECRET);
    }
  });
});
