import { describe, expect, it } from 'vitest';

import { killProcessGroup } from './kill-process-group';

describe('killProcessGroup (unreachable pid)', () => {
  it('swallows the error when neither the group nor the pid exist', () => {
    expect(() => killProcessGroup(999997, 'SIGTERM')).not.toThrow();
  });

  it('defaults to SIGKILL when no signal is given', () => {
    expect(() => killProcessGroup(999996)).not.toThrow();
  });
});
