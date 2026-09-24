import { APICallError, RetryError } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { LanguageModel, ModelMessage, StepResult, ToolSet } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import type { RenderApiClient } from '../client/render-api-client';
import { buildStudioAiSdkTools } from './studio-ai-sdk-tools';

export const DEFAULT_MAX_STEPS = 60;

export type OpenRouterProducerRuntimeErrorCode =
  | 'OPENROUTER_KEY_INVALID'
  | 'OPENROUTER_RATE_LIMITED'
  | 'OPENROUTER_FREE_QUOTA_EXHAUSTED'
  | 'OPENROUTER_MODEL_UNAVAILABLE'
  | 'OPENROUTER_FAILED';

const FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN = /free-models-per-day/iu;
const NON_RETRYABLE_STATUS_FOR_EXHAUSTED_QUOTA = 400;

export class OpenRouterProducerRuntimeError extends Error {
  readonly code: OpenRouterProducerRuntimeErrorCode;

  constructor(code: OpenRouterProducerRuntimeErrorCode, hint: string) {
    super(hint);
    this.name = 'OpenRouterProducerRuntimeError';
    this.code = code;
  }
}

export interface ProducerRuntimeMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export type ProducerRuntimeEvent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool'; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool-result'; readonly name: string; readonly isError: boolean };

export interface RunOpenRouterProducerTurnUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}

export interface RunOpenRouterProducerTurnResult {
  readonly finalText: string;
  readonly usage: RunOpenRouterProducerTurnUsage;
  readonly steps: number;
}

interface RunProducerTurnCommonOptions {
  readonly systemPrompt: string;
  readonly history: readonly ProducerRuntimeMessage[];
  readonly userText: string;
  readonly client: RenderApiClient;
  readonly turnModel: string;
  readonly abortSignal?: AbortSignal;
  readonly onEvent?: (event: ProducerRuntimeEvent) => void;
  readonly maxSteps?: number;
  readonly supportsImages?: boolean;
}

export interface RunOpenRouterProducerTurnOptions extends RunProducerTurnCommonOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: typeof fetch;
}

export interface RunProducerTurnWithModelOptions extends RunProducerTurnCommonOptions {
  readonly model: LanguageModel;
}

function toModelMessages(history: readonly ProducerRuntimeMessage[], userText: string): ModelMessage[] {
  return [...history.map((message) => ({ role: message.role, content: message.content })), { role: 'user' as const, content: userText }];
}

function emitStepEvents(step: StepResult<ToolSet>, onEvent: ((event: ProducerRuntimeEvent) => void) | undefined): void {
  if (onEvent === undefined) {
    return;
  }
  if (step.text !== '') {
    onEvent({ type: 'text', text: step.text });
  }
  for (const call of step.toolCalls) {
    onEvent({ type: 'tool', name: call.toolName, input: call.input });
  }
  for (const toolResult of step.toolResults) {
    const output = toolResult.output as { error?: unknown } | undefined;
    onEvent({ type: 'tool-result', name: toolResult.toolName, isError: output?.error !== undefined });
  }
}

function sumOpenRouterCost(steps: readonly StepResult<ToolSet>[]): number | null {
  let total = 0;
  let sawAny = false;
  for (const step of steps) {
    const openrouterMetadata = step.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined;
    const cost = openrouterMetadata?.usage?.cost;
    if (typeof cost === 'number') {
      sawAny = true;
      total += cost;
    }
  }
  return sawAny ? total : null;
}

function unwrapRetryError(cause: unknown): unknown {
  return RetryError.isInstance(cause) ? unwrapRetryError(cause.lastError) : cause;
}

function isFreeQuotaExhausted(cause: APICallError): boolean {
  return FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN.test(cause.message) ||
    (cause.responseBody !== undefined && FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN.test(cause.responseBody));
}

function mapOpenRouterError(rawCause: unknown, abortSignal: AbortSignal | undefined): never {
  if (abortSignal?.aborted === true) {
    throw rawCause;
  }
  const cause = unwrapRetryError(rawCause);
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    if (status === 401) {
      throw new OpenRouterProducerRuntimeError('OPENROUTER_KEY_INVALID', 'OpenRouter rejected this API key.');
    }
    if (isFreeQuotaExhausted(cause)) {
      throw new OpenRouterProducerRuntimeError(
        'OPENROUTER_FREE_QUOTA_EXHAUSTED',
        'Se agotó la cuota diaria de modelos gratis de OpenRouter; se reinicia a las 00:00 UTC. Elegí un modelo pago barato o esperá.',
      );
    }
    if (status === 429) {
      throw new OpenRouterProducerRuntimeError(
        'OPENROUTER_RATE_LIMITED',
        'OpenRouter rate-limited this request. Wait a moment and try again.',
      );
    }
    if (status === 404 || (status === 400 && /model/iu.test(cause.message))) {
      throw new OpenRouterProducerRuntimeError(
        'OPENROUTER_MODEL_UNAVAILABLE',
        'OpenRouter could not serve the requested model.',
      );
    }
    throw new OpenRouterProducerRuntimeError('OPENROUTER_FAILED', 'The call to OpenRouter failed.');
  }
  throw new OpenRouterProducerRuntimeError('OPENROUTER_FAILED', 'The call to OpenRouter failed.');
}

function withoutRetryableFreeQuotaExhausted(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (response.status !== 429) {
      return response;
    }
    let bodyText: string;
    try {
      bodyText = await response.clone().text();
    } catch {
      return response;
    }
    if (!FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN.test(bodyText)) {
      return response;
    }
    return new Response(bodyText, {
      status: NON_RETRYABLE_STATUS_FOR_EXHAUSTED_QUOTA,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export async function runProducerTurnWithModel(
  options: RunProducerTurnWithModelOptions,
): Promise<RunOpenRouterProducerTurnResult> {
  const {
    model,
    systemPrompt,
    history,
    userText,
    client,
    turnModel,
    abortSignal,
    onEvent,
    maxSteps = DEFAULT_MAX_STEPS,
    supportsImages = false,
  } = options;

  const handlers = createStudioToolHandlers({ client, model: turnModel });
  const tools = buildStudioAiSdkTools({ handlers, supportsImages });

  let stepCount = 0;

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: toModelMessages(history, userText),
      tools,
      stopWhen: stepCountIs(maxSteps),
      ...(abortSignal === undefined ? {} : { abortSignal }),
      onStepFinish: (step) => {
        stepCount += 1;
        emitStepEvents(step, onEvent);
      },
    });

    return {
      finalText: result.text,
      usage: {
        inputTokens: result.usage.inputTokens ?? null,
        outputTokens: result.usage.outputTokens ?? null,
        costUsd: sumOpenRouterCost(result.steps),
      },
      steps: stepCount,
    };
  } catch (cause) {
    return mapOpenRouterError(cause, abortSignal);
  }
}

export async function runOpenRouterProducerTurn(
  options: RunOpenRouterProducerTurnOptions,
): Promise<RunOpenRouterProducerTurnResult> {
  const { apiKey, model, fetch: fetchOverride, ...rest } = options;
  const openrouter = createOpenRouter({ apiKey, fetch: withoutRetryableFreeQuotaExhausted(fetchOverride ?? fetch) });
  const languageModel = openrouter.chat(model, { usage: { include: true } });
  return runProducerTurnWithModel({ ...rest, model: languageModel });
}
