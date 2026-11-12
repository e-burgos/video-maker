import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StudioNotFoundError, resolveStudioEndpoint } from './studio-endpoint';

const HEALTHY = { service: 'render-api', status: 'ok' };

function fetchAnswering(answers: Readonly<Record<string, { readonly token?: string }>>, calls: string[] = []): typeof fetch {
  return (async (url: string, init?: { headers?: Record<string, string> }) => {
    const base = url.replace(/\/health$/u, '');
    calls.push(`${base}|${init?.headers?.['x-studio-token'] ?? ''}`);
    const answer = answers[base];
    const authorised = answer !== undefined && (answer.token === undefined || init?.headers?.['x-studio-token'] === answer.token);
    return authorised ? new Response(JSON.stringify(HEALTHY), { status: 200 }) : new Response('{}', { status: 401 });
  }) as unknown as typeof fetch;
}

describe('resolveStudioEndpoint', () => {
  let root: string;
  let home: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vm-endpoint-'));
    home = join(root, 'home');
    await mkdir(home, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeDiscovery(source: string, record: Record<string, unknown>): Promise<void> {
    await writeFile(join(home, `studio.${source}.json`), JSON.stringify(record));
  }

  it('uses --api-url without probing and keeps the producer token', async () => {
    const calls: string[] = [];
    const endpoint = await resolveStudioEndpoint({
      apiUrlArgument: 'http://127.0.0.1:4599/',
      env: { STUDIO_API_TOKEN: 'internal', VIDEO_MAKER_HOME: home },
      fetchImpl: fetchAnswering({}, calls),
    });

    expect(endpoint).toEqual({ apiUrl: 'http://127.0.0.1:4599', accessToken: 'internal', source: 'argument' });
    expect(calls).toEqual([]);
  });

  it('prefers VIDEO_MAKER_API_URL over the discovery files and validates it', async () => {
    await writeDiscovery('desktop', { apiUrl: 'http://127.0.0.1:1111', token: 'd', pid: process.pid });

    const endpoint = await resolveStudioEndpoint({
      apiUrlArgument: null,
      env: { VIDEO_MAKER_API_URL: 'http://127.0.0.1:2222', VIDEO_MAKER_API_TOKEN: 'forced', VIDEO_MAKER_HOME: home },
      fetchImpl: fetchAnswering({ 'http://127.0.0.1:2222': { token: 'forced' } }),
    });

    expect(endpoint).toEqual({ apiUrl: 'http://127.0.0.1:2222', accessToken: 'forced', source: 'environment' });
  });

  it('fails clearly when the forced url does not answer', async () => {
    await expect(
      resolveStudioEndpoint({ apiUrlArgument: null, env: { VIDEO_MAKER_API_URL: 'http://127.0.0.1:2222', VIDEO_MAKER_HOME: home }, fetchImpl: fetchAnswering({}) }),
    ).rejects.toThrow(/VIDEO_MAKER_API_URL points at http:\/\/127\.0\.0\.1:2222/u);
  });

  it('prefers the desktop file over the dev file when both are alive', async () => {
    await writeDiscovery('desktop', { apiUrl: 'http://127.0.0.1:1111', token: 'd', pid: process.pid });
    await writeDiscovery('dev', { apiUrl: 'http://127.0.0.1:2222', token: null, pid: process.pid });

    const endpoint = await resolveStudioEndpoint({
      apiUrlArgument: null,
      env: { VIDEO_MAKER_HOME: home },
      fetchImpl: fetchAnswering({ 'http://127.0.0.1:1111': { token: 'd' }, 'http://127.0.0.1:2222': {} }),
    });

    expect(endpoint).toEqual({ apiUrl: 'http://127.0.0.1:1111', accessToken: 'd', source: 'desktop' });
  });

  it('falls back to the dev file when the desktop one is stale', async () => {
    await writeDiscovery('desktop', { apiUrl: 'http://127.0.0.1:1111', token: 'd', pid: 999_999 });
    await writeDiscovery('dev', { apiUrl: 'http://127.0.0.1:2222', token: null, pid: 4242 });

    const endpoint = await resolveStudioEndpoint({
      apiUrlArgument: null,
      env: { VIDEO_MAKER_HOME: home },
      fetchImpl: fetchAnswering({ 'http://127.0.0.1:1111': {}, 'http://127.0.0.1:2222': {} }),
      isProcessAlive: (pid) => pid === 4242,
    });

    expect(endpoint).toEqual({ apiUrl: 'http://127.0.0.1:2222', source: 'dev' });
  });

  it('skips a file whose studio no longer answers health', async () => {
    await writeDiscovery('desktop', { apiUrl: 'http://127.0.0.1:1111', token: 'd', pid: process.pid });

    await expect(
      resolveStudioEndpoint({ apiUrlArgument: null, env: { VIDEO_MAKER_HOME: home }, fetchImpl: fetchAnswering({}) }),
    ).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  it('tells the user to open the app or run pnpm studio when nothing is found', async () => {
    await expect(
      resolveStudioEndpoint({ apiUrlArgument: null, env: { VIDEO_MAKER_HOME: home }, fetchImpl: fetchAnswering({}) }),
    ).rejects.toThrow(/Open the Video Maker app.*pnpm studio/u);
  });

  it('ignores malformed discovery files', async () => {
    await writeFile(join(home, 'studio.desktop.json'), 'not json');
    await writeDiscovery('dev', { nope: true });

    await expect(
      resolveStudioEndpoint({ apiUrlArgument: null, env: { VIDEO_MAKER_HOME: home }, fetchImpl: fetchAnswering({}) }),
    ).rejects.toBeInstanceOf(StudioNotFoundError);
  });
});
