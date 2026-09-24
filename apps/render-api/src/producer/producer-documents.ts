import { PipelineStageError } from '../errors/pipeline-stage-error';

export const PRODUCER_MESSAGE_ROLES = ['user', 'assistant'] as const;

export type ProducerMessageRole = (typeof PRODUCER_MESSAGE_ROLES)[number];

export interface ProducerMessageUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}

export interface ProducerMessage {
  readonly id: string;
  readonly role: ProducerMessageRole;
  readonly text: string;
  readonly createdAt: string;
  readonly suggestions?: readonly string[];
  readonly turnId?: string;
  readonly model?: string;
  readonly usage?: ProducerMessageUsage;
}

export interface ProducerConversation {
  readonly messages: readonly ProducerMessage[];
}

export interface ProducerSession {
  readonly sessionId: string;
  readonly model: string;
  readonly createdAt: string;
  readonly lastTurnAt: string;
}

export const EMPTY_PRODUCER_CONVERSATION: ProducerConversation = { messages: [] };

function invalid(relativePath: string, expected: string): PipelineStageError {
  return new PipelineStageError({
    code: 'PRODUCER_STATE_INVALID',
    stage: null,
    resource: relativePath,
    expected,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isProducerMessageUsage(value: unknown): value is ProducerMessageUsage {
  return (
    isRecord(value) &&
    isNumberOrNull(value.inputTokens) &&
    isNumberOrNull(value.outputTokens) &&
    isNumberOrNull(value.costUsd)
  );
}

function isProducerMessageRole(value: unknown): value is ProducerMessageRole {
  return typeof value === 'string' && (PRODUCER_MESSAGE_ROLES as readonly string[]).includes(value);
}

function parseProducerMessage(value: unknown, relativePath: string): ProducerMessage {
  if (!isRecord(value)) {
    throw invalid(relativePath, 'every message to be an object');
  }
  if (!isNonEmptyString(value.id) || !isProducerMessageRole(value.role)) {
    throw invalid(relativePath, 'every message to carry a non-empty id and a user or assistant role');
  }
  if (typeof value.text !== 'string' || !isNonEmptyString(value.createdAt)) {
    throw invalid(relativePath, 'every message to carry a text and a createdAt timestamp');
  }
  if (value.suggestions !== undefined && !isStringArray(value.suggestions)) {
    throw invalid(relativePath, 'suggestions to be an array of strings when present');
  }
  if (value.turnId !== undefined && !isNonEmptyString(value.turnId)) {
    throw invalid(relativePath, 'turnId to be a non-empty string when present');
  }
  if (value.model !== undefined && !isNonEmptyString(value.model)) {
    throw invalid(relativePath, 'model to be a non-empty string when present');
  }
  if (value.usage !== undefined && !isProducerMessageUsage(value.usage)) {
    throw invalid(relativePath, 'usage to be { inputTokens, outputTokens, costUsd } (numbers or null) when present');
  }

  return {
    id: value.id,
    role: value.role,
    text: value.text,
    createdAt: value.createdAt,
    ...(value.suggestions === undefined ? {} : { suggestions: [...value.suggestions] }),
    ...(value.turnId === undefined ? {} : { turnId: value.turnId }),
    ...(value.model === undefined ? {} : { model: value.model }),
    ...(value.usage === undefined ? {} : { usage: value.usage }),
  };
}

export function parseProducerConversation(value: unknown, relativePath: string): ProducerConversation {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw invalid(relativePath, 'an object with a messages array');
  }
  return { messages: value.messages.map((entry) => parseProducerMessage(entry, relativePath)) };
}

export function parseProducerSession(value: unknown, relativePath: string): ProducerSession {
  if (!isRecord(value)) {
    throw invalid(relativePath, 'an object with sessionId, model, createdAt and lastTurnAt');
  }
  if (
    !isNonEmptyString(value.sessionId) ||
    !isNonEmptyString(value.model) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.lastTurnAt)
  ) {
    throw invalid(relativePath, 'sessionId, model, createdAt and lastTurnAt to be non-empty strings');
  }

  return {
    sessionId: value.sessionId,
    model: value.model,
    createdAt: value.createdAt,
    lastTurnAt: value.lastTurnAt,
  };
}
