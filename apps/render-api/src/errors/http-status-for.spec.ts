import { describe, expect, it } from 'vitest';

import { httpStatusFor } from './http-status-for';
import { RENDER_API_ERROR_CODES } from './render-api-error';
import type { RenderApiErrorCode } from './render-api-error';

const EXPECTED_STATUS_BY_CODE: Readonly<Record<RenderApiErrorCode, number>> = {
  INVALID_TIMELINE: 422,
  RENDER_BUNDLE_FAILED: 500,
  COMPOSITION_NOT_FOUND: 500,
  RENDER_FAILED: 500,
  UNRESOLVED_AUDIO_ASSET: 422,
  MISSING_AUDIO_STREAM: 422,
  MISSING_VIDEO_STREAM: 500,
  MEDIA_COMMAND_FAILED: 500,
  MEDIA_OUTPUT_UNPARSEABLE: 500,
  MEDIA_BINARY_NOT_FOUND: 503,
  WORKDIR_UNWRITABLE: 500,
  ROUTE_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  SERVER_CONFIG_INVALID: 500,
  INTERNAL_ERROR: 500,
};

describe('httpStatusFor', () => {
  it.each(RENDER_API_ERROR_CODES.map((code) => ({ code, status: EXPECTED_STATUS_BY_CODE[code] })))(
    'maps $code to HTTP $status',
    ({ code, status }) => {
      expect(httpStatusFor(code)).toBe(status);
    },
  );
});
