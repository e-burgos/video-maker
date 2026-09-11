import { describe, expect, it } from 'vitest';

import { queryFlag } from './query-flag';

describe('queryFlag', () => {
  it('is false on a path with no query string', () => {
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4', 'force')).toBe(false);
  });

  it('is true only for the literal value true', () => {
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?force=true', 'force')).toBe(true);
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?force=1', 'force')).toBe(false);
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?force', 'force')).toBe(false);
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?force=TRUE', 'force')).toBe(false);
  });

  it('reads the flag among other parameters', () => {
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?dry=false&force=true', 'force')).toBe(
      true,
    );
  });

  it('ignores a different parameter name', () => {
    expect(queryFlag('/projects/smoke/assets/aroll/clip01.mp4?enforce=true', 'force')).toBe(false);
  });
});
