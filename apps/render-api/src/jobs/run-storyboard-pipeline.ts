import type { MediaProject } from '@video-maker/auto-montage';
import { StoryboardProposalSchema, storyboardProposalJsonSchema, toStoryboardDocument } from '@video-maker/timeline-core';
import type { StoryboardProposal, StoryboardSource } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { AiAgentResponse } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import { buildStoryboardSystemPrompt, buildStoryboardUserPrompt } from '../storyboard/build-storyboard-prompt';
import { collectStoryboardInventory } from '../storyboard/collect-storyboard-inventory';
import { writeStoryboard } from '../storyboard/storyboard-store';
import type { StoryboardJobReport, StoryboardStage } from './render-job';
import { storyboardCheckpoint } from './storyboard-pipeline-observer';
import type { StoryboardPipelineObserver } from './storyboard-pipeline-observer';

export interface StoryboardPipelineRequest {
  readonly project: MediaProject;
  readonly storyboardId: string;
  readonly brief: string | null;
  readonly scriptText: string | null;
  readonly model: string | null;
}

function withStage(error: PipelineStageError, stage: StoryboardStage): PipelineStageError {
  return new PipelineStageError({
    code: error.code,
    stage,
    resource: error.resource,
    expected: error.expected,
    hint: error.hint,
    details: error.details,
    cause: error.cause,
  });
}

async function runStoryboardStage<T>(stage: StoryboardStage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof PipelineStageError) {
      throw cause.stage === null ? withStage(cause, stage) : cause;
    }
    if (isRenderApiError(cause)) {
      throw cause;
    }
    throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage, cause });
  }
}

function parseProposal(response: AiAgentResponse): StoryboardProposal {
  const result = StoryboardProposalSchema.safeParse(response.json);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'AI_AGENT_INVALID_OUTPUT',
      stage: null,
      resource: 'ai-agent',
      expected: 'a proposal accepted by StoryboardProposalSchema',
    });
  }
  return result.data;
}

export async function runStoryboardPipeline(
  request: StoryboardPipelineRequest,
  deps: RenderApiDependencies,
  observer: StoryboardPipelineObserver,
): Promise<StoryboardJobReport> {
  storyboardCheckpoint(observer, 'collect');
  observer.stageStarted('collect');

  const inventory = await runStoryboardStage('collect', () =>
    collectStoryboardInventory(deps, request.project),
  );

  storyboardCheckpoint(observer, 'propose');
  observer.stageStarted('propose');

  const response = await runStoryboardStage('propose', () =>
    deps.aiAgent({
      systemPrompt: buildStoryboardSystemPrompt(),
      userPrompt: buildStoryboardUserPrompt({
        brief: request.brief,
        scriptText: request.scriptText,
        inventory,
      }),
      jsonSchema: storyboardProposalJsonSchema(),
      model: request.model,
    }),
  );

  const proposal = await runStoryboardStage('propose', async () => parseProposal(response));

  storyboardCheckpoint(observer, 'persist');
  observer.stageStarted('persist');

  const source: StoryboardSource = request.scriptText === null ? 'brief' : 'script';
  const document = toStoryboardDocument(proposal, {
    id: request.storyboardId,
    source,
    createdAt: deps.clock.nowIso(),
  });

  const storyboardPath = await runStoryboardStage('persist', () =>
    writeStoryboard(deps, request.project, document),
  );

  return {
    storyboardPath,
    storyboardId: document.id,
    source,
    language: document.language,
    sceneCount: document.scenes.length,
    usage: {
      tokensIn: response.usage.tokensIn,
      tokensOut: response.usage.tokensOut,
      costUsd: response.usage.costUsd,
      model: response.usage.model,
    },
  };
}
