import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, jsonSchema } from 'ai';
import type { JSONSchema7, LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import type { AiAgentPort, AiAgentRequest, AiAgentResponse, AiAgentUsage } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';

const FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN = /free-models-per-day/iu;

const KEY_MISSING_HINT = 'paste an OpenRouter API key in settings, or switch the storyboard engine to Claude';
const FREE_QUOTA_EXHAUSTED_HINT =
  "OpenRouter's free-models-per-day quota is exhausted; it resets at 00:00 UTC, pick a paid model or wait";
const RATE_LIMITED_HINT = 'OpenRouter rate-limited this request, wait a moment and retry';
const INVALID_OUTPUT_EXPECTED = 'a structured object matching the requested JSON Schema';
const FAILED_HINT = 'the call to OpenRouter failed';

const AI_AGENT_RESOURCE = 'ai-agent';

export interface OpenRouterAiAgentConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: typeof fetch;
}

export type OpenRouterLanguageModelFactory = (config: OpenRouterAiAgentConfig) => LanguageModel;

export function createOpenRouterLanguageModel(config: OpenRouterAiAgentConfig): LanguageModel {
  const openrouter = createOpenRouter({ apiKey: config.apiKey, fetch: config.fetch ?? fetch });
  return openrouter.chat(config.model, { usage: { include: true } });
}

function unwrapRetryError(cause: unknown): unknown {
  return RetryError.isInstance(cause) ? unwrapRetryError(cause.lastError) : cause;
}

function mentionsFreeQuotaExhausted(cause: APICallError): boolean {
  return (
    FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN.test(cause.message) ||
    (cause.responseBody !== undefined && FREE_QUOTA_EXHAUSTED_MESSAGE_PATTERN.test(cause.responseBody))
  );
}

function keyMissing(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'OPENROUTER_KEY_MISSING',
    stage: null,
    resource: AI_AGENT_RESOURCE,
    hint: KEY_MISSING_HINT,
    cause,
  });
}

function freeQuotaExhausted(): PipelineStageError {
  return new PipelineStageError({
    code: 'OPENROUTER_FREE_QUOTA_EXHAUSTED',
    stage: null,
    resource: AI_AGENT_RESOURCE,
    hint: FREE_QUOTA_EXHAUSTED_HINT,
  });
}

function rateLimited(): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_RATE_LIMITED',
    stage: null,
    resource: AI_AGENT_RESOURCE,
    hint: RATE_LIMITED_HINT,
  });
}

function invalidOutput(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_INVALID_OUTPUT',
    stage: null,
    resource: AI_AGENT_RESOURCE,
    expected: INVALID_OUTPUT_EXPECTED,
    cause,
  });
}

function failed(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_FAILED',
    stage: null,
    resource: AI_AGENT_RESOURCE,
    hint: FAILED_HINT,
    cause,
  });
}

function mapOpenRouterError(rawCause: unknown): PipelineStageError {
  const cause = unwrapRetryError(rawCause);

  if (NoObjectGeneratedError.isInstance(cause)) {
    return invalidOutput(cause);
  }

  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 401) {
      return keyMissing(cause);
    }
    if (cause.statusCode === 429) {
      return mentionsFreeQuotaExhausted(cause) ? freeQuotaExhausted() : rateLimited();
    }
    return failed(cause);
  }

  return failed(cause);
}

function openRouterCostOf(providerMetadata: Awaited<ReturnType<typeof generateText>>['providerMetadata']): number | null {
  const metadata = providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined;
  return typeof metadata?.usage?.cost === 'number' ? metadata.usage.cost : null;
}

export function createOpenRouterAiAgentFromModel(model: LanguageModel): AiAgentPort {
  return async (request: AiAgentRequest): Promise<AiAgentResponse> => {
    const startedAt = Date.now();

    try {
      const result = await generateText({
        model,
        system: request.systemPrompt,
        prompt: request.userPrompt,
        output: Output.object({ schema: jsonSchema(request.jsonSchema as JSONSchema7) }),
        maxRetries: 0,
      });

      const usage: AiAgentUsage = {
        tokensIn: result.usage.inputTokens ?? 0,
        tokensOut: result.usage.outputTokens ?? 0,
        costUsd: openRouterCostOf(result.providerMetadata),
        durationMs: Date.now() - startedAt,
        model: result.response.modelId,
      };

      return { json: result.output, usage };
    } catch (cause) {
      throw mapOpenRouterError(cause);
    }
  };
}

export function createOpenRouterAiAgent(
  config: OpenRouterAiAgentConfig,
  createModel: OpenRouterLanguageModelFactory = createOpenRouterLanguageModel,
): AiAgentPort {
  return createOpenRouterAiAgentFromModel(createModel(config));
}
