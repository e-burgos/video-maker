import { describe, expect, it } from 'vitest';

import {
  RenderApiError,
  errorDetailLines,
  fromErrorResponse,
  responseNotJson,
  responseShapeUnexpected,
  serviceUnreachable,
  toErrorPayload,
} from './render-api-error';

describe('render api error surface', () => {
  it('keeps the code the service reported', () => {
    const error = fromErrorResponse(409, {
      error: { code: 'ASSET_ALREADY_EXISTS', stage: null, message: 'The asset already exists.' },
    });

    expect(error).toBeInstanceOf(RenderApiError);
    expect(error.code).toBe('ASSET_ALREADY_EXISTS');
    expect(error.status).toBe(409);
    expect(error.message).toBe('The asset already exists.');
  });

  it('falls back to RESPONSE_NOT_JSON when the error body has no typed payload', () => {
    expect(fromErrorResponse(502, undefined).code).toBe('RESPONSE_NOT_JSON');
    expect(fromErrorResponse(500, { message: 'boom' }).code).toBe('RESPONSE_NOT_JSON');
    expect(fromErrorResponse(500, { error: 'boom' }).code).toBe('RESPONSE_NOT_JSON');
    expect(fromErrorResponse(500, { error: { code: 1, message: 'boom' } }).code).toBe(
      'RESPONSE_NOT_JSON',
    );
  });

  it('names the transport failure without leaking the raw exception type', () => {
    const error = serviceUnreachable(new TypeError('Failed to fetch'));

    expect(error.code).toBe('SERVICE_UNREACHABLE');
    expect(error.status).toBeNull();
    expect(error.message).toContain('Failed to fetch');
  });

  it('accepts a non-Error cause', () => {
    expect(serviceUnreachable('offline').message).toContain('offline');
  });

  it('builds the two remaining transport codes', () => {
    expect(responseNotJson(500).code).toBe('RESPONSE_NOT_JSON');
    expect(responseShapeUnexpected(200, 'a project array').message).toContain('a project array');
  });

  it('returns null for a body that is not an object', () => {
    expect(toErrorPayload('nope')).toBeNull();
    expect(toErrorPayload(null)).toBeNull();
  });

  it('renders only the detail fields the payload carries', () => {
    const withDetails = fromErrorResponse(422, {
      error: {
        code: 'ASSET_PATH_INVALID',
        stage: 'render',
        message: 'Bad path.',
        resource: 'raw/aroll/x.mp4',
        expected: 'a portable path',
        hint: 'rename the file',
      },
    });

    expect(errorDetailLines(withDetails)).toEqual([
      'resource: raw/aroll/x.mp4',
      'expected: a portable path',
      'hint: rename the file',
      'stage: render',
    ]);
    expect(errorDetailLines(serviceUnreachable('offline'))).toEqual([]);
    expect(
      errorDetailLines(
        fromErrorResponse(404, { error: { code: 'PROJECT_NOT_FOUND', stage: null, message: 'x' } }),
      ),
    ).toEqual([]);
  });
});
