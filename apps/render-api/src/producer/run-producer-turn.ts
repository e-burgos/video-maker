import { join } from 'node:path/posix';

import type { MediaProject } from '@video-maker/auto-montage';

import { CURATED_OPENROUTER_MODELS, curatedOpenRouterModelById, isCuratedOpenRouterModel } from '../config/curated-openrouter-models';
import type { ProducerConfig } from '../config/producer-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import { RENDER_API_ERROR_CODES } from '../errors/render-api-error';
import type { RenderApiErrorCode } from '../errors/render-api-error';
import {
  classifyProducerTurn,
  producerUnavailable,
} from '../errors/translate-producer-error';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  OPENROUTER_SECRET_NAME,
  PRODUCER_MODEL_OPENROUTER_SETTING_KEY,
  readEngineSetting,
  readModelSetting,
  resolveEffectiveProducerEngine,
} from '../http/handlers/producer-settings-handler';
import { buildProducerSystemPrompt } from './build-producer-system-prompt';
import { collectProducerContext } from './collect-producer-context';
import { buildProducerHistory } from './producer-history';
import { buildProducerMcpConfigJson } from './producer-mcp-config';
import { createOpenRouterProducerAgent } from './openrouter-producer-agent';
import { parseProducerAnswer } from './parse-producer-suggestions';
import { interpretProducerStreamLine } from './producer-stream-events';
import type { ProducerMessage, ProducerSession } from './producer-documents';
import {
  appendProducerConversationMarkdown,
  appendProducerMessage,
  readProducerSession,
  writeProducerSession,
  writeProducerTurnLog,
} from './producer-store';
import type { ProducerTurnRegistry, ProducerTurnUsage } from './producer-turn-registry';
import type { ProducerTurnRun } from './producer-agent';

const PRODUCER_CWD_DIR_NAME = 'video-maker-producer';
const OPENROUTER_ERROR_SUBTYPE_PREFIX = 'openrouter:';

function producerWorkingDirectory(cliCwdBase: string, slug: string): string {
  return join(cliCwdBase, PRODUCER_CWD_DIR_NAME, slug);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRenderApiErrorCode(value: string): value is RenderApiErrorCode {
  return (RENDER_API_ERROR_CODES as readonly string[]).includes(value);
}

function isProducerTurnUsage(value: unknown): value is ProducerTurnUsage {
  return (
    isRecord(value) &&
    (typeof value.inputTokens === 'number' || value.inputTokens === null) &&
    (typeof value.outputTokens === 'number' || value.outputTokens === null) &&
    (typeof value.costUsd === 'number' || value.costUsd === null)
  );
}

export interface StartProducerTurnInput {
  readonly project: MediaProject;
  readonly text: string;
  readonly model: unknown;
  readonly config: ProducerConfig;
}

export interface StartedProducerTurn {
  readonly turnId: string;
  readonly startedAt: string;
  readonly completed: Promise<void>;
}

export function assertProducerMessageText(text: unknown): string {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new PipelineStageError({
      code: 'PRODUCER_MESSAGE_INVALID',
      stage: null,
      resource: 'text',
      expected: 'a non-empty text field',
    });
  }
  return text.trim();
}

export function assertProducerModel(model: unknown, config: ProducerConfig): string | null {
  if (model === undefined || model === null) {
    return null;
  }
  if (typeof model !== 'string' || !config.models.includes(model)) {
    throw new PipelineStageError({
      code: 'PRODUCER_MODEL_INVALID',
      stage: null,
      resource: typeof model === 'string' ? model : 'model',
      expected: `one of ${config.models.join(', ')}`,
    });
  }
  return model;
}

function resumableModel(session: ProducerSession | null, config: ProducerConfig): string {
  return session !== null && config.models.includes(session.model) ? session.model : config.model;
}

function defaultOpenRouterModel(deps: RenderApiDependencies): string {
  const configured = readModelSetting(deps, PRODUCER_MODEL_OPENROUTER_SETTING_KEY);
  if (configured !== null && isCuratedOpenRouterModel(configured)) {
    return configured;
  }
  return CURATED_OPENROUTER_MODELS[0]?.id ?? '';
}

function assertOpenRouterModel(model: unknown, deps: RenderApiDependencies): string {
  if (model === undefined || model === null) {
    return defaultOpenRouterModel(deps);
  }
  if (typeof model !== 'string' || !isCuratedOpenRouterModel(model)) {
    throw new PipelineStageError({
      code: 'PRODUCER_MODEL_INVALID',
      stage: null,
      resource: typeof model === 'string' ? model : 'model',
      expected: `one of ${CURATED_OPENROUTER_MODELS.map((entry) => entry.id).join(', ')}`,
    });
  }
  return model;
}

function openRouterKeyMissing(): PipelineStageError {
  return new PipelineStageError({
    code: 'OPENROUTER_KEY_MISSING',
    stage: null,
    resource: 'producer-agent',
    hint: 'paste an OpenRouter API key in settings, or switch the producer engine to Claude',
  });
}

export async function startProducerTurn(
  deps: RenderApiDependencies,
  registry: ProducerTurnRegistry,
  input: StartProducerTurnInput,
  openRouterAgentFactory: typeof createOpenRouterProducerAgent = createOpenRouterProducerAgent,
): Promise<StartedProducerTurn> {
  const claudeAvailable = await deps.probeProducerBinary();
  const storedOpenRouterKey = await deps.secretStore.get(OPENROUTER_SECRET_NAME);
  const engine = resolveEffectiveProducerEngine(readEngineSetting(deps), claudeAvailable, storedOpenRouterKey !== null);

  if (engine === null || (engine === 'claude-cli' && !claudeAvailable)) {
    throw producerUnavailable();
  }
  if (engine === 'openrouter' && storedOpenRouterKey === null) {
    throw openRouterKeyMissing();
  }

  const session = readProducerSession(deps, input.project);
  const model =
    engine === 'claude-cli'
      ? (assertProducerModel(input.model, input.config) ?? resumableModel(session, input.config))
      : assertOpenRouterModel(input.model, deps);

  const turnId = deps.randomId();
  const startedAt = deps.clock.nowIso();
  registry.reserve(input.project.slug, turnId, startedAt, model);

  const userMessage: ProducerMessage = {
    id: deps.randomId(),
    role: 'user',
    text: input.text,
    createdAt: startedAt,
    turnId,
  };

  appendProducerMessage(deps, input.project, userMessage);
  await appendProducerConversationMarkdown(deps, input.project, userMessage);

  const context = await collectProducerContext(deps, input.project, {
    repoRoot: input.config.workingDirectory,
    apiUrl: input.config.apiUrl,
  });
  const systemPrompt = buildProducerSystemPrompt(context);

  const sessionId = session?.sessionId ?? deps.randomId();
  const rawLines: string[] = [];
  let reportedSessionId: string | null = null;
  let answerText: string | null = null;
  let rateLimited = false;
  let openRouterErrorCode: string | null = null;
  let turnUsage: ProducerTurnUsage | null = null;

  function onLine(line: string): void {
    rawLines.push(line);
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    const signal = interpretProducerStreamLine(parsed);
    if (signal.kind === 'session') {
      reportedSessionId = signal.sessionId;
    }
    if (signal.kind === 'session' || signal.kind === 'events') {
      registry.appendEvents(turnId, signal.events);
    }
    if (signal.kind === 'result') {
      answerText = signal.text;
      rateLimited = signal.rateLimited;
    }

    if (isRecord(parsed) && parsed.type === 'result') {
      if (typeof parsed.subtype === 'string' && parsed.subtype.startsWith(OPENROUTER_ERROR_SUBTYPE_PREFIX)) {
        const code = parsed.subtype.slice(OPENROUTER_ERROR_SUBTYPE_PREFIX.length);
        openRouterErrorCode = isRenderApiErrorCode(code) ? code : 'OPENROUTER_FAILED';
      }
      if (isProducerTurnUsage(parsed.usage)) {
        turnUsage = parsed.usage;
      }
    }
  }

  let run: ProducerTurnRun;
  if (engine === 'claude-cli') {
    const mcpConfig = buildProducerMcpConfigJson({
      repoRoot: context.repoRoot,
      apiUrl: context.apiUrl,
      project: context.slug,
      model,
      ...(input.config.accessToken === null ? {} : { accessToken: input.config.accessToken }),
      ...(input.config.studioMcpEntryPath === null ? {} : { compiledEntryPath: input.config.studioMcpEntryPath }),
    });
    const cwd = producerWorkingDirectory(input.config.cliCwdBase, input.project.slug);
    await deps.ensureDirectory(cwd);

    run = deps.producerAgent(
      { text: input.text, model, systemPrompt, sessionId, resume: session !== null, mcpConfig, cwd },
      onLine,
    );
  } else {
    const history = buildProducerHistory(deps, input.project, registry);
    const modelMeta = curatedOpenRouterModelById(model);
    const agent = openRouterAgentFactory({
      project: input.project,
      apiUrl: input.config.apiUrl,
      accessToken: input.config.accessToken,
      apiKey: storedOpenRouterKey as string,
      chatModel: model,
      turnModel: input.config.model,
      supportsImages: modelMeta?.supportsImages ?? false,
      history,
    });

    run = agent(
      { text: input.text, model, systemPrompt, sessionId, resume: false, mcpConfig: '', cwd: input.config.workingDirectory },
      onLine,
    );
  }

  registry.attachCanceler(turnId, run.cancel);

  const completed = (async (): Promise<void> => {
    try {
      await settleProducerTurn();
    } catch (cause) {
      registry.settle(turnId, {
        status: 'failed',
        finishedAt: deps.clock.nowIso(),
        error: toErrorPayload(cause),
      });
    }
  })();

  async function settleSucceeded(finishedAt: string): Promise<void> {
    const answer = parseProducerAnswer(answerText ?? '');
    const assistantMessage: ProducerMessage = {
      id: deps.randomId(),
      role: 'assistant',
      text: answer.text,
      createdAt: finishedAt,
      turnId,
      model,
      ...(answer.suggestions.length === 0 ? {} : { suggestions: answer.suggestions }),
    };

    appendProducerMessage(deps, input.project, assistantMessage);
    await appendProducerConversationMarkdown(deps, input.project, assistantMessage);

    if (engine === 'claude-cli') {
      writeProducerSession(deps, input.project, {
        sessionId: reportedSessionId ?? sessionId,
        model,
        createdAt: session?.createdAt ?? startedAt,
        lastTurnAt: finishedAt,
      });
    }

    registry.settle(turnId, {
      status: 'succeeded',
      finishedAt,
      assistantMessage: answer.text,
      suggestions: answer.suggestions,
      ...(turnUsage === null ? {} : { usage: turnUsage }),
    });
  }

  async function settleProducerTurn(): Promise<void> {
    const result = await run.completed;
    const finishedAt = deps.clock.nowIso();

    await writeProducerTurnLog(deps, input.project, turnId, rawLines);

    if (engine === 'openrouter') {
      if (result.canceled) {
        registry.settle(turnId, { status: 'canceled', finishedAt });
        return;
      }
      if (openRouterErrorCode !== null) {
        registry.settle(turnId, {
          status: 'failed',
          finishedAt,
          error: toErrorPayload(
            new PipelineStageError({ code: openRouterErrorCode as RenderApiErrorCode, stage: null, resource: 'producer-agent' }),
          ),
        });
        return;
      }
      if (answerText === null || answerText === '') {
        registry.settle(turnId, {
          status: 'failed',
          finishedAt,
          error: toErrorPayload(
            new PipelineStageError({ code: 'PRODUCER_TURN_FAILED', stage: null, resource: 'producer-agent' }),
          ),
        });
        return;
      }
      await settleSucceeded(finishedAt);
      return;
    }

    const outcome = classifyProducerTurn({
      result,
      rateLimited,
      hasAnswer: answerText !== null && answerText !== '',
    });

    if (outcome.kind !== 'succeeded') {
      registry.settle(turnId, {
        status: outcome.kind === 'canceled' ? 'canceled' : 'failed',
        finishedAt,
        ...(outcome.kind === 'failed' ? { error: toErrorPayload(outcome.error) } : {}),
      });
      return;
    }

    await settleSucceeded(finishedAt);
  }

  return { turnId, startedAt, completed };
}
