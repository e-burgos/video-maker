import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { RenderApiProvider } from '../api/render-api-context';
import { useVideoCardThumbnail } from './use-video-card-thumbnail';
import type { RenderApiClient } from '../api/render-api-client';

function clientWith(overrides: Partial<RenderApiClient>): RenderApiClient {
  return {
    listGenerated: vi.fn().mockResolvedValue({ slug: 'demo', roots: [], files: [] }),
    listAssets: vi.fn().mockResolvedValue({ slug: 'demo', source: 'catalog', assets: [], probeFailures: [] }),
    ...overrides,
  } as unknown as RenderApiClient;
}

function wrapperFor(client: RenderApiClient) {
  return ({ children }: { children: ReactNode }) => (
    <RenderApiProvider client={client}>{children}</RenderApiProvider>
  );
}

describe('useVideoCardThumbnail', () => {
  it('prefers the newest rendered deliverable over any raw asset', async () => {
    const client = clientWith({
      listGenerated: vi.fn().mockResolvedValue({
        slug: 'demo',
        roots: ['out'],
        files: [
          { path: 'out/take-1.mp4', sizeBytes: 10, modifiedAtMs: 1000 },
          { path: 'out/take-2.mp4', sizeBytes: 10, modifiedAtMs: 2000 },
        ],
      }),
    });

    const { result } = renderHook(() => useVideoCardThumbnail('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.source).toEqual({ path: 'out/take-2.mp4', modifiedAtMs: 2000 });
    expect(client.listAssets).not.toHaveBeenCalled();
  });

  it('falls back to the first A-roll asset when nothing rendered yet', async () => {
    const client = clientWith({
      listAssets: vi.fn().mockResolvedValue({
        slug: 'demo',
        source: 'catalog',
        assets: [
          { path: 'raw/broll/clip.mp4', role: 'broll', fingerprint: { sizeBytes: 1, modifiedAtMs: 500 }, media: null },
          { path: 'raw/aroll/clip.mp4', role: 'aroll', fingerprint: { sizeBytes: 1, modifiedAtMs: 700 }, media: null },
        ],
        probeFailures: [],
      }),
    });

    const { result } = renderHook(() => useVideoCardThumbnail('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.source).toEqual({ path: 'raw/aroll/clip.mp4', modifiedAtMs: 700 });
  });

  it('resolves to no source when there is nothing to show a frame of', async () => {
    const client = clientWith({});

    const { result } = renderHook(() => useVideoCardThumbnail('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.source).toBeNull();
  });

  it('degrades to no source, without throwing, when the client cannot answer', async () => {
    const client = {} as RenderApiClient;

    const { result } = renderHook(() => useVideoCardThumbnail('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.source).toBeNull();
  });
});
