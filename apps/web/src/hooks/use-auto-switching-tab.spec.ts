import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jobListing, pendingJob, succeededJob } from '../api/__fixtures__/workspace';
import { useAutoSwitchingTab } from './use-auto-switching-tab';
import type { RenderJobListing } from '../api/render-api-types';

describe('useAutoSwitchingTab', () => {
  it('starts on the preview tab', () => {
    const { result } = renderHook(() => useAutoSwitchingTab(null));

    expect(result.current[0]).toBe('preview');
  });

  it('does not switch on the first snapshot, even if it already has succeeded jobs', () => {
    const jobs = jobListing([succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z')]);
    const { result } = renderHook(() => useAutoSwitchingTab(jobs));

    expect(result.current[0]).toBe('preview');
  });

  it('switches to deliveries once a render job succeeds after the baseline', () => {
    let jobs: RenderJobListing | null = jobListing([pendingJob('render', 'job-1')]);
    const { result, rerender } = renderHook(() => useAutoSwitchingTab(jobs));

    expect(result.current[0]).toBe('preview');

    jobs = jobListing([succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z')]);
    act(() => rerender());

    expect(result.current[0]).toBe('deliveries');
  });

  it('lets the caller change the tab manually', () => {
    const { result } = renderHook(() => useAutoSwitchingTab(null));

    act(() => result.current[1]('material'));

    expect(result.current[0]).toBe('material');
  });
});
