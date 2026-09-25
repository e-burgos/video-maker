import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { useInboxUploads } from './use-inbox-uploads';
import type { RenderApiClient } from '../api/render-api-client';
import type { InboxAsset } from '../api/render-api-types';

function inboxAsset(overrides: Partial<InboxAsset> = {}): InboxAsset {
  return {
    id: 'inbox-0001',
    fileName: 'clip01.mp4',
    path: 'raw/inbox/clip01.mp4',
    proposedRole: 'aroll',
    proposalReason: 'has-audio',
    probe: { kind: 'video', durationMs: 4000, hasAudio: true },
    status: 'pending',
    ...overrides,
  };
}

function clientWith(overrides: Partial<RenderApiClient>): RenderApiClient {
  return {
    listInbox: vi.fn().mockResolvedValue({ assets: [] }),
    uploadToInbox: vi.fn().mockResolvedValue(inboxAsset()),
    confirmInboxAsset: vi.fn().mockResolvedValue(inboxAsset({ status: 'confirmed', confirmedRole: 'aroll' })),
    discardInboxAsset: vi.fn().mockResolvedValue({ slug: 'demo-01', deleted: { id: 'inbox-0001', path: 'raw/inbox/clip01.mp4' } }),
    ...overrides,
  } as unknown as RenderApiClient;
}

function wrapperWith(client: RenderApiClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RenderApiProvider client={client}>{children}</RenderApiProvider>;
  };
}

function file(name: string, type = 'video/mp4'): File {
  return new File(['x'], name, { type });
}

describe('useInboxUploads', () => {
  it('loads the pending inbox listing for the project', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.pending.status).toBe('ready'));
    expect(client.listInbox).toHaveBeenCalledWith('demo-01');
  });

  it('tracks an upload from uploading to done and reloads the pending listing', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.uploadFiles([file('clip01.mp4')]);
    });

    expect(result.current.uploads).toHaveLength(1);
    expect(result.current.uploads[0]?.status).toBe('done');
    expect(client.listInbox).toHaveBeenCalledTimes(2);
  });

  it('uploads several files concurrently, each with its own entry', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.uploadFiles([file('a.mp4'), file('b.jpg', 'image/jpeg')]);
    });

    expect(result.current.uploads.map((entry) => entry.fileName).sort()).toEqual(['a.mp4', 'b.jpg']);
    expect(result.current.uploads.every((entry) => entry.status === 'done')).toBe(true);
  });

  it('rejects an unsupported file locally, without calling the service', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.uploadFiles([file('notes.txt', 'text/plain')]);
    });

    expect(result.current.uploads[0]?.status).toBe('error');
    expect(result.current.uploads[0]?.errorCode).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(client.uploadToInbox).not.toHaveBeenCalled();
  });

  it('surfaces a service rejection as an error entry', async () => {
    const client = clientWith({
      uploadToInbox: vi.fn().mockRejectedValue(new RenderApiError('ASSET_TOO_LARGE', 'too big', 413, null)),
    });
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.uploadFiles([file('big.mp4')]);
    });

    expect(result.current.uploads[0]?.status).toBe('error');
    expect(result.current.uploads[0]?.errorCode).toBe('ASSET_TOO_LARGE');
  });

  it('dismisses an upload entry from the local list', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.uploadFiles([file('clip01.mp4')]);
    });
    const id = result.current.uploads[0]?.id as string;

    act(() => result.current.dismissUpload(id));

    expect(result.current.uploads).toHaveLength(0);
  });

  it('confirms a pending asset and reloads the pending listing', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.confirm('inbox-0001', 'aroll');
    });

    expect(client.confirmInboxAsset).toHaveBeenCalledWith('demo-01', 'inbox-0001', 'aroll');
    expect(client.listInbox).toHaveBeenCalledTimes(2);
  });

  it('discards a pending asset and reloads the pending listing', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useInboxUploads('demo-01'), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.pending.status).toBe('ready'));

    await act(async () => {
      await result.current.discard('inbox-0001');
    });

    expect(client.discardInboxAsset).toHaveBeenCalledWith('demo-01', 'inbox-0001');
    expect(client.listInbox).toHaveBeenCalledTimes(2);
  });
});
