import type { RenderApiErrorPayload } from './render-api-types';

export const TRANSPORT_ERROR_CODES = [
  'SERVICE_UNREACHABLE',
  'RESPONSE_NOT_JSON',
  'RESPONSE_SHAPE_UNEXPECTED',
] as const;

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number];

export class RenderApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly payload: RenderApiErrorPayload | null;

  constructor(code: string, message: string, status: number | null, payload: RenderApiErrorPayload | null) {
    super(message);
    this.name = 'RenderApiError';
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

export function serviceUnreachable(cause: unknown): RenderApiError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new RenderApiError(
    'SERVICE_UNREACHABLE',
    `The render service did not answer: ${detail}`,
    null,
    null,
  );
}

export function responseNotJson(status: number): RenderApiError {
  return new RenderApiError(
    'RESPONSE_NOT_JSON',
    `The render service answered ${status} with a body that is not JSON.`,
    status,
    null,
  );
}

export function responseShapeUnexpected(status: number, expected: string): RenderApiError {
  return new RenderApiError(
    'RESPONSE_SHAPE_UNEXPECTED',
    `The render service answered ${status} with a body that is not ${expected}.`,
    status,
    null,
  );
}

export function toErrorPayload(body: unknown): RenderApiErrorPayload | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }

  const error = (body as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  if (typeof candidate['code'] !== 'string' || typeof candidate['message'] !== 'string') {
    return null;
  }

  return candidate as unknown as RenderApiErrorPayload;
}

export function fromErrorResponse(status: number, body: unknown): RenderApiError {
  const payload = toErrorPayload(body);
  if (payload === null) {
    return responseNotJson(status);
  }

  return new RenderApiError(payload.code, payload.message, status, payload);
}

export function errorDetailLines(error: RenderApiError): string[] {
  const payload = error.payload;
  if (payload === null) {
    return [];
  }

  const lines: string[] = [];
  if (payload.resource !== undefined) {
    lines.push(`resource: ${payload.resource}`);
  }
  if (payload.expected !== undefined) {
    lines.push(`expected: ${payload.expected}`);
  }
  if (payload.hint !== undefined) {
    lines.push(`hint: ${payload.hint}`);
  }
  if (payload.stage !== null) {
    lines.push(`stage: ${payload.stage}`);
  }
  return lines;
}
