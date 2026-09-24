import type {
  AssetListEntry,
  AssetListing,
  JobKind,
  RenderJobListing,
  RenderJobState,
  RenderJobSummary,
} from '../render-api-types';

export function renderJobSummary(overrides: Partial<RenderJobSummary> = {}): RenderJobSummary {
  return {
    id: 'job-0001',
    kind: 'render',
    state: 'succeeded',
    stage: null,
    errorCode: null,
    createdAt: '2026-09-10T10:00:00.000Z',
    startedAt: '2026-09-10T10:00:01.000Z',
    finishedAt: '2026-09-10T10:02:00.000Z',
    ...overrides,
  };
}

export function jobListing(jobs: readonly RenderJobSummary[], slug = 'demo-01'): RenderJobListing {
  return { slug, jobs: [...jobs] };
}

export function succeededJob(kind: JobKind, id: string, finishedAt: string): RenderJobSummary {
  return renderJobSummary({ id, kind, state: 'succeeded', finishedAt, createdAt: finishedAt });
}

export function pendingJob(kind: JobKind, id: string, state: RenderJobState = 'running'): RenderJobSummary {
  return renderJobSummary({ id, kind, state, finishedAt: null });
}

export function assetEntry(overrides: Partial<AssetListEntry> = {}): AssetListEntry {
  return {
    path: 'raw/aroll/clip01.mp4',
    role: 'aroll',
    fingerprint: { sizeBytes: 1024, modifiedAtMs: 1 },
    media: null,
    ...overrides,
  };
}

export function assetListing(assets: readonly AssetListEntry[], slug = 'demo-01'): AssetListing {
  return { slug, source: 'catalog', assets: [...assets], probeFailures: [] };
}
