import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';

import { getFreePort } from './free-port';

describe('getFreePort', () => {
  it('returns a port that can immediately be bound again', async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);

    await new Promise<void>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve());
      });
    });
  });

  it('returns different ports across calls', async () => {
    const first = await getFreePort();
    const second = await getFreePort();
    expect(first).not.toBe(second);
  });

  it('rejects when the requested host cannot be bound', async () => {
    await expect(getFreePort('256.256.256.256')).rejects.toThrow();
  });
});
