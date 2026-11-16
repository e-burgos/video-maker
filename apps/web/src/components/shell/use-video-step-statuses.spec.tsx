import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../../api/render-api-context';
import type { RenderApiClient } from '../../api/render-api-client';
import { RenderApiError } from '../../api/render-api-error';
import type { ProjectDetail } from '../../api/render-api-types';
import { deriveVideoStepStatuses, useVideoStepStatuses } from './use-video-step-statuses';

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    slug: 'demo',
    layout: { raw: false, catalog: false, timeline: false, edl: false, out: false },
    assetSource: 'raw-scan',
    assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0, reference: 0 },
    ...overrides,
  };
}

function withAssets(counts: Partial<ProjectDetail['assetCounts']>, extra: Partial<ProjectDetail> = {}) {
  const base = project();
  return project({ assetCounts: { ...base.assetCounts, ...counts }, ...extra });
}

describe('deriveVideoStepStatuses', () => {
  it('marks material pending when the project has no assets at all', () => {
    const statuses = deriveVideoStepStatuses({ project: project(), hasStoryboard: false, hasVoice: false });
    expect(statuses).toEqual({ '/library': 'pending', '/storyboard': 'pending', '/voice': 'pending', '/preview': 'pending' });
  });

  it('marks material ok with a-roll in a footage video and warn when only supporting roles exist', () => {
    expect(deriveVideoStepStatuses({ project: withAssets({ aroll: 2 }), hasStoryboard: false, hasVoice: false })['/library']).toBe('ok');
    expect(deriveVideoStepStatuses({ project: withAssets({ broll: 3 }), hasStoryboard: false, hasVoice: false })['/library']).toBe('warn');
  });

  it('uses images as the main material of a motion video', () => {
    expect(deriveVideoStepStatuses({ project: withAssets({ image: 4 }, { mode: 'motion' }), hasStoryboard: false, hasVoice: false })['/library']).toBe('ok');
    expect(deriveVideoStepStatuses({ project: withAssets({ aroll: 1 }, { mode: 'motion' }), hasStoryboard: false, hasVoice: false })['/library']).toBe('warn');
  });

  it('marks preview ok with a render, warn with a timeline only, pending otherwise', () => {
    const layout = (patch: Partial<ProjectDetail['layout']>) => ({ ...project().layout, ...patch });
    expect(deriveVideoStepStatuses({ project: project({ layout: layout({ timeline: true, out: true }) }), hasStoryboard: false, hasVoice: false })['/preview']).toBe('ok');
    expect(deriveVideoStepStatuses({ project: project({ layout: layout({ timeline: true }) }), hasStoryboard: false, hasVoice: false })['/preview']).toBe('warn');
  });

  it('marks storyboard and voice ok when they exist and leaves producer and motion without status', () => {
    const statuses = deriveVideoStepStatuses({ project: project(), hasStoryboard: true, hasVoice: true });
    expect(statuses['/storyboard']).toBe('ok');
    expect(statuses['/voice']).toBe('ok');
    expect(statuses['']).toBeUndefined();
    expect(statuses['/motion']).toBeUndefined();
  });
});

function clientWith(overrides: Partial<RenderApiClient>): RenderApiClient {
  return {
    getProject: vi.fn().mockResolvedValue(withAssets({ aroll: 1 })),
    getStoryboard: vi.fn().mockResolvedValue({}),
    getVoice: vi.fn().mockRejectedValue(new RenderApiError('VOICE_NOT_FOUND', 'none', 404, null)),
    ...overrides,
  } as unknown as RenderApiClient;
}

function wrapperFor(client: RenderApiClient) {
  return ({ children }: { children: ReactNode }) => <RenderApiProvider client={client}>{children}</RenderApiProvider>;
}

describe('useVideoStepStatuses', () => {
  it('makes no request without an open video', () => {
    const client = clientWith({});
    const { result } = renderHook(() => useVideoStepStatuses(null), { wrapper: wrapperFor(client) });

    expect(result.current).toEqual({});
    expect(client.getProject).not.toHaveBeenCalled();
    expect(client.getStoryboard).not.toHaveBeenCalled();
  });

  it('derives the statuses and treats a missing voice as pending without surfacing the 404', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useVideoStepStatuses('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current['/library']).toBe('ok'));
    expect(result.current['/storyboard']).toBe('ok');
    expect(result.current['/voice']).toBe('pending');
  });

  it('falls back to no statuses when the project cannot be read', async () => {
    const client = clientWith({ getProject: vi.fn().mockRejectedValue(new RenderApiError('PROJECT_NOT_FOUND', 'gone', 404, null)) });
    const { result } = renderHook(() => useVideoStepStatuses('demo'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(client.getProject).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  it('reloads when the route of the video changes', async () => {
    const client = clientWith({});
    const { result, rerender } = renderHook(({ route }) => useVideoStepStatuses('demo', route), {
      wrapper: wrapperFor(client),
      initialProps: { route: '/projects/demo' },
    });
    await waitFor(() => expect(result.current['/library']).toBe('ok'));
    expect(client.getProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ route: '/projects/demo/voice' });
    });
    await waitFor(() => expect(client.getProject).toHaveBeenCalledTimes(2));
  });
});
