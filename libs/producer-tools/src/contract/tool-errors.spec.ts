import { describe, expect, it } from 'vitest';

import { STUDIO_TOOL_ERROR_CODES, isStudioToolError } from './tool-errors';

describe('STUDIO_TOOL_ERROR_CODES', () => {
  it('is the closed list of error codes frozen in the plan', () => {
    expect([...STUDIO_TOOL_ERROR_CODES].sort()).toEqual(
      [
        'INVALID_INPUT',
        'PATH_OUTSIDE_PROJECT',
        'PATH_NOT_WRITABLE',
        'FILE_NOT_FOUND',
        'FILE_TOO_LARGE',
        'ASSET_EXISTS',
        'JOB_REJECTED',
        'JOB_NOT_FOUND',
        'STUDIO_UNAVAILABLE',
        'MUSIC_SOURCE_UNAVAILABLE',
        'MUSIC_RESULT_UNKNOWN',
        'MEDIA_SOURCE_UNAVAILABLE',
        'MEDIA_RESULT_UNKNOWN',
      ].sort(),
    );
  });
});

describe('isStudioToolError', () => {
  it('accepts a value with a known code and a string hint', () => {
    expect(isStudioToolError({ code: 'FILE_NOT_FOUND', hint: 'raw/aroll/clip01.mp4 does not exist' })).toBe(true);
  });

  it.each(STUDIO_TOOL_ERROR_CODES)('accepts every closed-list code (%s)', (code) => {
    expect(isStudioToolError({ code, hint: 'hint' })).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(isStudioToolError({ code: 'SOMETHING_ELSE', hint: 'hint' })).toBe(false);
  });

  it('rejects a missing hint', () => {
    expect(isStudioToolError({ code: 'FILE_NOT_FOUND' })).toBe(false);
  });

  it('rejects a non-string hint', () => {
    expect(isStudioToolError({ code: 'FILE_NOT_FOUND', hint: 42 })).toBe(false);
  });

  it('rejects null', () => {
    expect(isStudioToolError(null)).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(isStudioToolError('FILE_NOT_FOUND')).toBe(false);
  });

  it('rejects an array', () => {
    expect(isStudioToolError(['FILE_NOT_FOUND'])).toBe(false);
  });
});
