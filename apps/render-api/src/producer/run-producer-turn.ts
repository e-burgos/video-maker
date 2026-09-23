import { join } from 'node:path/posix';

import type { MediaProject } from '@video-maker/auto-montage';

import type { ProducerConfig } from '../config/producer-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import {
  classifyProducerTurn,
  producerUnavailable,
} from '../errors/translate-producer-error';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { buildProducerSystemPrompt } from './build-producer-system-prompt';
import { collectProducerContext } from './collect-producer-context';
import { buildProducerMcpConfigJson } from './producer-mcp-config';
import { parseProducerAnswer } from './parse-producer-suggestions';
import { interpretProducerStreamLine } from './producer-stream-events';
import type { ProducerMessage, ProducerSession } from './producer-documents';
import { appendProducerMessage } from './producer-documents';
import {
  appendProducerConversationMarkdown,
  readProducerConversation,
  readProducerSession,
  writeProducerConversation,
  writeProducerSession,
  writeProducerTurnLog,
} from './producer-store';
import type { ProducerTurnRegistry } from './producer-turn-registry';

const PRODUCER_CWD_DIR_NAME = 'video-maker-producer';

function producerWorkingDirectory(cliCwdBase: string, slug: string): string {
  return join(cliCwdBase, PRODUCER_CWD_DIR_NAME, slug);
}

export interface StartProducerTurnInput {
  readonly project: MediaProject;
  readonly text: string;
  readonly model: string | null;
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

export async function startProducerTurn(
  deps: RenderApiDependencies,
  registry: ProducerTurnRegistry,
  input: StartProducerTurnInput,
): Promise<StartedProducerTurn> {
  if (!(await deps.probeProducerBinary())) {
    throw producerUnavailable();
  }

  const session = await readProducerSession(deps, input.project);
  const model = input.model ?? resumableModel(session, input.config);

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

  const conversation = appendProducerMessage(
    await readProducerConversation(deps, input.project),
    userMessage,
  );
  await writeProducerConversation(deps, input.project, conversation);
  await appendProducerConversationMarkdown(deps, input.project, userMessage);

  const context = await collectProducerContext(deps, input.project, {
    repoRoot: input.config.workingDirectory,
    apiUrl: input.config.apiUrl,
  });
  const systemPrompt = buildProducerSystemPrompt(context);
  const mcpConfig = buildProducerMcpConfigJson({
    repoRoot: context.repoRoot,
    apiUrl: context.apiUrl,
    project: context.slug,
    model,
  });
  const cwd = producerWorkingDirectory(input.config.cliCwdBase, input.project.slug);
  await deps.ensureDirectory(cwd);

  const sessionId = session?.sessionId ?? deps.randomId();
  const rawLines: string[] = [];
  let reportedSessionId: string | null = null;
  let answerText: string | null = null;
  let rateLimited = false;

  const run = deps.producerAgent(
    {
      text: input.text,
      model,
      systemPrompt,
      sessionId,
      resume: session !== null,
      mcpConfig,
      cwd,
    },
    (line) => {
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
    },
  );

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

  async function settleProducerTurn(): Promise<void> {
    const result = await run.completed;
    const finishedAt = deps.clock.nowIso();

    await writeProducerTurnLog(deps, input.project, turnId, rawLines);

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

    await writeProducerConversation(
      deps,
      input.project,
      appendProducerMessage(
        await readProducerConversation(deps, input.project),
        assistantMessage,
      ),
    );
    await appendProducerConversationMarkdown(deps, input.project, assistantMessage);
    await writeProducerSession(deps, input.project, {
      sessionId: reportedSessionId ?? sessionId,
      model,
      createdAt: session?.createdAt ?? startedAt,
      lastTurnAt: finishedAt,
    });

    registry.settle(turnId, {
      status: 'succeeded',
      finishedAt,
      assistantMessage: answer.text,
      suggestions: answer.suggestions,
    });
  }

  return { turnId, startedAt, completed };
}
