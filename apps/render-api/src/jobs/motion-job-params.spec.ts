import { describe, expect, it } from 'vitest';

import { toErrorPayload } from '../errors/to-error-payload';
import { parseMotionJobInput } from './motion-job-params';

function rejection(body: Record<string, unknown>): ReturnType<typeof toErrorPayload> {
  try {
    parseMotionJobInput(body);
  } catch (error) {
    return toErrorPayload(error);
  }
  throw new Error('expected the parser to reject');
}

describe('parseMotionJobInput', () => {
  it('applies the defaults', () => {
    expect(parseMotionJobInput({})).toEqual({ phase: 'all', output: 'video.mp4', takes: 5, overwrite: false });
  });

  it('accepts every explicit field', () => {
    expect(parseMotionJobInput({ phase: 'video', output: 'cut.mp4', takes: 8, overwrite: true })).toEqual({
      phase: 'video',
      output: 'cut.mp4',
      takes: 8,
      overwrite: true,
    });
  });

  it.each([
    ['phase', { phase: 'render' }],
    ['output', { output: '../x.mp4' }],
    ['output', { output: 3 }],
    ['takes', { takes: 0 }],
    ['takes', { takes: 9 }],
    ['takes', { takes: 2.5 }],
    ['overwrite', { overwrite: 'yes' }],
  ])('rejects an invalid %s with MOTION_JOB_INPUT_INVALID', (field, body) => {
    expect(rejection(body)).toMatchObject({ code: 'MOTION_JOB_INPUT_INVALID', resource: field });
  });
});
