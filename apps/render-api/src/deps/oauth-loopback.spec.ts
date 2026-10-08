import { describe, expect, it } from 'vitest';

import { startOAuthLoopbackServer } from './oauth-loopback';

async function get(port: number, path: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`);
  return { status: response.status, text: await response.text() };
}

describe('startOAuthLoopbackServer', () => {
  it('hands the query to the handler, answers its html and shuts down after the first callback', async () => {
    const received: Record<string, string>[] = [];
    const handle = await startOAuthLoopbackServer({
      timeoutMs: 5_000,
      handler: async (query) => {
        received.push({ ...query });
        return '<p>listo</p>';
      },
    });

    const answer = await get(handle.port, '/?code=abc&state=xyz');

    expect(answer).toEqual({ status: 200, text: '<p>listo</p>' });
    expect(received).toEqual([{ code: 'abc', state: 'xyz' }]);
    await expect(get(handle.port, '/?code=again')).rejects.toThrow();
  });

  it('ignores requests that carry no oauth parameters, such as a favicon probe', async () => {
    const handle = await startOAuthLoopbackServer({ timeoutMs: 5_000, handler: async () => '<p>no</p>' });

    const answer = await get(handle.port, '/favicon.ico');

    expect(answer.status).toBe(404);
    handle.close();
  });

  it('listens on an ephemeral loopback port and stops when closed', async () => {
    const handle = await startOAuthLoopbackServer({ timeoutMs: 5_000, handler: async () => '' });

    expect(handle.port).toBeGreaterThan(0);
    handle.close();

    await expect(get(handle.port, '/?code=x')).rejects.toThrow();
  });
});
