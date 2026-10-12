import { orderedAssetRoles } from './asset-roles';
import type {
  AssetListEntry,
  GeneratedListing,
  AssetListing,
  AssetRole,
  JobKind,
  RenderJobListing,
  RenderJobSummary,
} from './render-api-types';

export type AssetRoleGroup = {
  role: AssetRole;
  assets: readonly AssetListEntry[];
};

export function groupAssetsByRole(listing: AssetListing | null): AssetRoleGroup[] {
  if (listing === null) {
    return [];
  }

  const byRole = new Map<AssetRole, AssetListEntry[]>();
  for (const asset of listing.assets) {
    const group = byRole.get(asset.role) ?? [];
    group.push(asset);
    byRole.set(asset.role, group);
  }

  return orderedAssetRoles()
    .map((copy) => copy.role)
    .filter((role) => byRole.has(role))
    .map((role) => ({ role, assets: byRole.get(role) as AssetListEntry[] }));
}

function jobTimestamp(job: RenderJobSummary): number {
  const finished = job.finishedAt === null ? null : Date.parse(job.finishedAt);
  if (finished !== null && !Number.isNaN(finished)) {
    return finished;
  }
  const created = Date.parse(job.createdAt);
  return Number.isNaN(created) ? 0 : created;
}

export function succeededJobsOfKindNewestFirst(
  listing: RenderJobListing | null,
  kind: JobKind,
): RenderJobSummary[] {
  const jobs = listing?.jobs ?? [];
  return jobs
    .filter((job) => job.kind === kind && job.state === 'succeeded')
    .sort((a, b) => jobTimestamp(b) - jobTimestamp(a));
}

export function fullRenderJobsNewestFirst(
  listing: RenderJobListing | null,
  generated: GeneratedListing | null,
): RenderJobSummary[] {
  const jobs = succeededJobsOfKindNewestFirst(listing, 'render');
  if (generated === null) {
    return jobs;
  }
  const outputs = new Set(generated.files.map((file) => file.path));
  return jobs.filter((job) => outputs.has(`out/${job.id}.mp4`));
}

export function latestSucceededJobOfKind(
  listing: RenderJobListing | null,
  kind: JobKind,
): RenderJobSummary | null {
  return succeededJobsOfKindNewestFirst(listing, kind)[0] ?? null;
}

export type WorkspaceTabId = 'preview' | 'material' | 'deliveries';

const TAB_BY_JOB_KIND: Readonly<Partial<Record<JobKind, WorkspaceTabId>>> = {
  montage: 'preview',
  render: 'deliveries',
};

export function tabForNewlySucceededJob(
  previous: RenderJobListing | null,
  current: RenderJobListing | null,
): WorkspaceTabId | null {
  const previousStates = new Map((previous?.jobs ?? []).map((job) => [job.id, job.state]));

  for (const job of current?.jobs ?? []) {
    const tab = TAB_BY_JOB_KIND[job.kind];
    if (tab === undefined || job.state !== 'succeeded') {
      continue;
    }
    if (previousStates.get(job.id) !== 'succeeded') {
      return tab;
    }
  }

  return null;
}
