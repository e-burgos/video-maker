import { timelinePath, toAbsolutePath } from '@video-maker/auto-montage';
import type { AssetRole, MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { resolveProjectAssets } from '../store/project-assets';

export interface ProducerContextAsset {
  readonly path: string;
  readonly role: AssetRole;
  readonly durationMs: number | null;
}

export interface ProducerContextPendingAsset {
  readonly fileName: string;
  readonly proposedRole: string;
  readonly proposalReason: string;
}

export interface ProducerProjectContext {
  readonly slug: string;
  readonly projectRoot: string;
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly assetSource: 'catalog' | 'raw-scan';
  readonly assets: readonly ProducerContextAsset[];
  readonly pendingAssets: readonly ProducerContextPendingAsset[];
  readonly hasTimeline: boolean;
  readonly producerScript: 'none' | 'plain' | 'timed';
}

export interface ProducerContextInput {
  readonly repoRoot: string;
  readonly apiUrl: string;
}

export async function collectProducerContext(
  deps: RenderApiDependencies,
  project: MediaProject,
  input: ProducerContextInput,
): Promise<ProducerProjectContext> {
  const projectAssets = await resolveProjectAssets(deps.storage, project);
  const timelineStat = await deps.storage.stat(toAbsolutePath(project, timelinePath()));
  const producerScript = await readProducerScriptKind(deps, project);
  const pendingAssets = deps.localStore.assets.listPending(project.slug);

  return {
    slug: project.slug,
    projectRoot: project.root,
    repoRoot: input.repoRoot,
    apiUrl: input.apiUrl,
    assetSource: projectAssets.source,
    assets: projectAssets.assets.map((entry) => ({
      path: entry.path,
      role: entry.role,
      durationMs: entry.media?.durationMs ?? null,
    })),
    pendingAssets: pendingAssets.map((asset) => ({
      fileName: asset.fileName,
      proposedRole: asset.proposedRole,
      proposalReason: asset.proposalReason,
    })),
    hasTimeline: timelineStat !== null && timelineStat.kind === 'file',
    producerScript,
  };
}

const TIME_MARK_PATTERN = /^\s*\[\d{1,2}:\d{2}/mu;

async function readProducerScriptKind(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<'none' | 'plain' | 'timed'> {
  const scriptPath = toAbsolutePath(project, 'work/producer/script.txt');
  const stat = await deps.storage.stat(scriptPath);
  if (stat === null || stat.kind !== 'file') {
    return 'none';
  }
  const text = await deps.storage.readTextFile(scriptPath);
  return TIME_MARK_PATTERN.test(text) ? 'timed' : 'plain';
}
