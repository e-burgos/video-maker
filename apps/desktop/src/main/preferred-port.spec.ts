import { createServer } from 'node:net';
import { describe, expect, it, vi } from 'vitest';

import {
  PREFERRED_PORT_RANGE_MAX,
  PREFERRED_PORT_RANGE_MIN,
  defaultIsPortFree,
  randomPortInRange,
  resolvePreferredPort,
} from './preferred-port';

describe('randomPortInRange', () => {
  it('stays within the documented high range by default', () => {
    for (let i = 0; i < 50; i += 1) {
      const port = randomPortInRange();
      expect(port).toBeGreaterThanOrEqual(PREFERRED_PORT_RANGE_MIN);
      expect(port).toBeLessThanOrEqual(PREFERRED_PORT_RANGE_MAX);
    }
  });
});

describe('defaultIsPortFree', () => {
  it('is true for a port nothing is listening on', async () => {
    expect(await defaultIsPortFree('127.0.0.1', 0)).toBe(true);
  });

  it('is false for a port something is already bound to', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;

    expect(await defaultIsPortFree('127.0.0.1', port)).toBe(false);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe('resolvePreferredPort', () => {
  it('reuses the stored port when it is still free', async () => {
    const isPortFree = vi.fn().mockResolvedValue(true);
    const getFreePortFn = vi.fn();

    const port = await resolvePreferredPort('127.0.0.1', 42123, { isPortFree, getFreePortFn });

    expect(port).toBe(42123);
    expect(isPortFree).toHaveBeenCalledWith('127.0.0.1', 42123);
    expect(getFreePortFn).not.toHaveBeenCalled();
  });

  it('picks a random port in the high range on the very first run (nothing stored)', async () => {
    const isPortFree = vi.fn().mockResolvedValue(true);
    const randomPort = vi.fn().mockReturnValue(42777);
    const getFreePortFn = vi.fn();

    const port = await resolvePreferredPort('127.0.0.1', null, { isPortFree, randomPort, getFreePortFn });

    expect(port).toBe(42777);
    expect(getFreePortFn).not.toHaveBeenCalled();
  });

  it('falls back to a freshly chosen port when the stored one is busy', async () => {
    const isPortFree = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const randomPort = vi.fn().mockReturnValue(42555);
    const getFreePortFn = vi.fn();

    const port = await resolvePreferredPort('127.0.0.1', 42123, { isPortFree, randomPort, getFreePortFn });

    expect(port).toBe(42555);
    expect(getFreePortFn).not.toHaveBeenCalled();
  });

  it('falls back to an ephemeral free port when the whole high range keeps colliding', async () => {
    const isPortFree = vi.fn().mockResolvedValue(false);
    const randomPort = vi.fn().mockReturnValue(42555);
    const getFreePortFn = vi.fn().mockResolvedValue(51234);

    const port = await resolvePreferredPort('127.0.0.1', null, { isPortFree, randomPort, getFreePortFn });

    expect(port).toBe(51234);
    expect(getFreePortFn).toHaveBeenCalledWith('127.0.0.1');
  });
});
