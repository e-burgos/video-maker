import { responseShapeUnexpected } from './render-api-error';
import {
  PRODUCER_MESSAGE_ROLES,
  PRODUCER_TURN_STATUSES,
  TERMINAL_PRODUCER_TURN_STATUSES,
} from './render-api-types';
import type {
  ProducerConversation,
  ProducerEvent,
  ProducerMessage,
  ProducerMessageRole,
  ProducerMessageUsage,
  ProducerModelCatalog,
  ProducerModelOption,
  ProducerSession,
  ProducerTurn,
  ProducerTurnAccepted,
  ProducerTurnStatus,
  RenderApiErrorPayload,
} from './render-api-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isProducerMessageRole(value: unknown): value is ProducerMessageRole {
  return typeof value === 'string' && (PRODUCER_MESSAGE_ROLES as readonly string[]).includes(value);
}

export function isProducerTurnStatus(value: unknown): value is ProducerTurnStatus {
  return typeof value === 'string' && (PRODUCER_TURN_STATUSES as readonly string[]).includes(value);
}

export function isTerminalProducerTurnStatus(value: ProducerTurnStatus): boolean {
  return (TERMINAL_PRODUCER_TURN_STATUSES as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isProducerEvent(value: unknown): value is ProducerEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (value['type'] === 'text') {
    return typeof value['text'] === 'string';
  }
  if (value['type'] === 'tool') {
    return typeof value['name'] === 'string' && typeof value['summary'] === 'string';
  }
  if (value['type'] === 'status') {
    return typeof value['status'] === 'string';
  }
  return false;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isProducerMessageUsage(value: unknown): value is ProducerMessageUsage {
  return (
    isRecord(value) &&
    isNumberOrNull(value['inputTokens']) &&
    isNumberOrNull(value['outputTokens']) &&
    isNumberOrNull(value['costUsd'])
  );
}

function isProducerMessage(value: unknown): value is ProducerMessage {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value['id'] !== 'string' ||
    !isProducerMessageRole(value['role']) ||
    typeof value['text'] !== 'string' ||
    typeof value['createdAt'] !== 'string'
  ) {
    return false;
  }
  if (value['suggestions'] !== undefined && !isStringArray(value['suggestions'])) {
    return false;
  }
  if (value['turnId'] !== undefined && typeof value['turnId'] !== 'string') {
    return false;
  }
  if (value['model'] !== undefined && typeof value['model'] !== 'string') {
    return false;
  }
  return value['usage'] === undefined || isProducerMessageUsage(value['usage']);
}

export function isProducerModelOption(value: unknown): value is ProducerModelOption {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    typeof value['description'] === 'string'
  );
}

function isProducerModelCatalog(value: unknown): value is ProducerModelCatalog {
  return (
    isRecord(value) &&
    typeof value['default'] === 'string' &&
    Array.isArray(value['allowed']) &&
    value['allowed'].every(isProducerModelOption)
  );
}

function isProducerSession(value: unknown): value is ProducerSession {
  return (
    isRecord(value) &&
    typeof value['sessionId'] === 'string' &&
    typeof value['model'] === 'string' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['lastTurnAt'] === 'string'
  );
}

function isErrorPayloadOrNull(value: unknown): value is RenderApiErrorPayload | null {
  return value === null || (isRecord(value) && typeof value['code'] === 'string');
}

function isProducerTurn(value: unknown): value is ProducerTurn {
  return (
    isRecord(value) &&
    typeof value['turnId'] === 'string' &&
    typeof value['slug'] === 'string' &&
    isProducerTurnStatus(value['status']) &&
    typeof value['model'] === 'string' &&
    typeof value['startedAt'] === 'string' &&
    (value['finishedAt'] === null || typeof value['finishedAt'] === 'string') &&
    Array.isArray(value['events']) &&
    value['events'].every(isProducerEvent) &&
    (value['assistantMessage'] === null || typeof value['assistantMessage'] === 'string') &&
    isStringArray(value['suggestions']) &&
    isErrorPayloadOrNull(value['error'])
  );
}

export function parseProducerTurn(value: unknown): ProducerTurn {
  if (!isProducerTurn(value)) {
    throw responseShapeUnexpected(200, 'a producer turn');
  }
  return value;
}

export function parseProducerConversation(value: unknown): ProducerConversation {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    !Array.isArray(value['messages']) ||
    !value['messages'].every(isProducerMessage) ||
    !(value['session'] === null || isProducerSession(value['session'])) ||
    !(value['activeTurn'] === null || isProducerTurn(value['activeTurn'])) ||
    !isProducerModelCatalog(value['models'])
  ) {
    throw responseShapeUnexpected(200, 'a producer conversation');
  }
  return value as ProducerConversation;
}

export function parseProducerTurnAccepted(value: unknown): ProducerTurnAccepted {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    typeof value['turnId'] !== 'string' ||
    typeof value['startedAt'] !== 'string' ||
    value['status'] !== 'running'
  ) {
    throw responseShapeUnexpected(202, 'an accepted producer turn');
  }
  return value as ProducerTurnAccepted;
}
