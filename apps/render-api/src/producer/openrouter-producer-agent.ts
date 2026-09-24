import type { MediaProject } from '@video-maker/auto-montage';
import { createHttpRenderApiClient, OpenRouterProducerRuntimeError, runOpenRouterProducerTurn } from '@video-maker/producer-tools';
import type { ProducerRuntimeMessage } from '@video-maker/producer-tools';

import type { ProducerAgentPort, ProducerTurnResult, ProducerTurnRun } from './producer-agent';

export type RunOpenRouterProducerTurn = typeof runOpenRouterProducerTurn;

export interface CreateOpenRouterProducerAgentOptions {
  readonly project: MediaProject;
  readonly apiUrl: string;
  readonly accessToken: string | null;
  readonly apiKey: string;
  readonly chatModel: string;
  readonly turnModel: string;
  readonly supportsImages: boolean;
  readonly history: readonly ProducerRuntimeMessage[];
  readonly maxSteps?: number;
  readonly run?: RunOpenRouterProducerTurn;
}

function openRouterErrorCodeOf(cause: unknown): string {
  return cause instanceof OpenRouterProducerRuntimeError ? cause.code : 'OPENROUTER_FAILED';
}

function hintOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'the OpenRouter turn failed for an unexpected reason';
}

export function createOpenRouterProducerAgent(options: CreateOpenRouterProducerAgentOptions): ProducerAgentPort {
  const run = options.run ?? runOpenRouterProducerTurn;

  return (start, onLine): ProducerTurnRun => {
    const controller = new AbortController();
    let settled = false;
    let canceled = false;
    let toolCallCounter = 0;

    let resolveCompleted: (result: ProducerTurnResult) => void = () => undefined;
    const completed = new Promise<ProducerTurnResult>((resolve) => {
      resolveCompleted = resolve;
    });

    function emit(value: Record<string, unknown>): void {
      onLine(JSON.stringify(value));
    }

    function settle(result: ProducerTurnResult): void {
      if (settled) {
        return;
      }
      settled = true;
      resolveCompleted(result);
    }

    emit({ type: 'system', subtype: 'init', session_id: start.sessionId });

    const client = createHttpRenderApiClient({
      apiUrl: options.apiUrl,
      slug: options.project.slug,
      ...(options.accessToken === null ? {} : { accessToken: options.accessToken }),
    });

    void (async () => {
      try {
        const result = await run({
          apiKey: options.apiKey,
          model: options.chatModel,
          systemPrompt: start.systemPrompt,
          history: options.history,
          userText: start.text,
          client,
          turnModel: options.turnModel,
          supportsImages: options.supportsImages,
          abortSignal: controller.signal,
          ...(options.maxSteps === undefined ? {} : { maxSteps: options.maxSteps }),
          onEvent: (event) => {
            if (event.type === 'text') {
              if (event.text !== '') {
                emit({ type: 'assistant', message: { content: [{ type: 'text', text: event.text }] } });
              }
              return;
            }
            if (event.type === 'tool') {
              toolCallCounter += 1;
              emit({
                type: 'assistant',
                message: {
                  content: [{ type: 'tool_use', id: `call-${toolCallCounter}`, name: event.name, input: event.input }],
                },
              });
              return;
            }
            if (event.type === 'tool-result' && event.isError) {
              emit({ type: 'user', message: { content: [{ type: 'tool_result', is_error: true }] } });
            }
          },
        });

        emit({
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: result.finalText,
          usage: result.usage,
        });
        settle({ exitCode: 0, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
      } catch (cause) {
        if (canceled) {
          settle({ exitCode: null, canceled: true, timedOut: false, spawnFailed: false, stderr: '' });
          return;
        }
        emit({
          type: 'result',
          subtype: `openrouter:${openRouterErrorCodeOf(cause)}`,
          is_error: true,
          result: hintOf(cause),
        });
        settle({ exitCode: 1, canceled: false, timedOut: false, spawnFailed: false, stderr: '' });
      }
    })();

    return {
      cancel: () => {
        if (settled || canceled) {
          return;
        }
        canceled = true;
        controller.abort();
      },
      completed,
    };
  };
}
