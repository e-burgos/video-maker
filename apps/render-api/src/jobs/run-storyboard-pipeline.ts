import type { MediaProject } from '@video-maker/auto-montage';
import {
  StoryboardProposalSchema,
  normalizeStoryboardProposalInput,
  storyboardProposalJsonSchema,
  toStoryboardDocument,
} from '@video-maker/timeline-core';
import type { StoryboardProposal, StoryboardSource } from '@video-maker/timeline-core';

import type { AiAgentRequest, AiAgentUsage, RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import {
  buildStoryboardRepairUserPrompt,
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
} from '../storyboard/build-storyboard-prompt';
import type { StoryboardProposalIssue } from '../storyboard/build-storyboard-prompt';
import { collectStoryboardInventory } from '../storyboard/collect-storyboard-inventory';
import type { StoryboardInventory } from '../storyboard/collect-storyboard-inventory';
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

type ProposalParseResult =
  | { readonly success: true; readonly data: StoryboardProposal }
  | { readonly success: false; readonly issues: readonly StoryboardProposalIssue[] };

function parseProposal(json: unknown): ProposalParseResult {
  const result = StoryboardProposalSchema.safeParse(normalizeStoryboardProposalInput(json));
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  };
}

function invalidOutputError(): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_INVALID_OUTPUT',
    stage: null,
    resource: 'ai-agent',
    expected: 'a proposal accepted by StoryboardProposalSchema',
  });
}

function sumAiAgentUsage(first: AiAgentUsage, second: AiAgentUsage): AiAgentUsage {
  return {
    tokensIn: first.tokensIn + second.tokensIn,
    tokensOut: first.tokensOut + second.tokensOut,
    costUsd: first.costUsd === null && second.costUsd === null ? null : (first.costUsd ?? 0) + (second.costUsd ?? 0),
    durationMs:
      first.durationMs === null && second.durationMs === null
        ? null
        : (first.durationMs ?? 0) + (second.durationMs ?? 0),
    model: second.model ?? first.model,
  };
}

interface ProposeStoryboardResult {
  readonly proposal: StoryboardProposal;
  readonly usage: AiAgentUsage;
  readonly repaired: boolean;
}

async function proposeStoryboard(
  deps: RenderApiDependencies,
  request: StoryboardPipelineRequest,
  inventory: StoryboardInventory,
): Promise<ProposeStoryboardResult> {
  const baseRequest: AiAgentRequest = {
    systemPrompt: buildStoryboardSystemPrompt(),
    userPrompt: buildStoryboardUserPrompt({ brief: request.brief, scriptText: request.scriptText, inventory }),
    jsonSchema: storyboardProposalJsonSchema(),
    model: request.model,
  };

  const firstResponse = await deps.aiAgent(baseRequest);
  const firstAttempt = parseProposal(firstResponse.json);
  if (firstAttempt.success) {
    return { proposal: firstAttempt.data, usage: firstResponse.usage, repaired: false };
  }

  const repairRequest: AiAgentRequest = {
    ...baseRequest,
    userPrompt: buildStoryboardRepairUserPrompt(baseRequest.userPrompt, firstAttempt.issues),
  };
  const secondResponse = await deps.aiAgent(repairRequest);
  const secondAttempt = parseProposal(secondResponse.json);
  if (!secondAttempt.success) {
    throw invalidOutputError();
  }

  return {
    proposal: secondAttempt.data,
    usage: sumAiAgentUsage(firstResponse.usage, secondResponse.usage),
    repaired: true,
  };
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

  const { proposal, usage, repaired } = await runStoryboardStage('propose', () =>
    proposeStoryboard(deps, request, inventory),
  );

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
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      costUsd: usage.costUsd,
      model: usage.model,
    },
    repaired,
  };
}
