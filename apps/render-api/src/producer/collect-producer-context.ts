import { timelinePath, toAbsolutePath } from '@video-maker/auto-montage';
import type { AssetRole, MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { resolveProjectAssets } from '../store/project-assets';

export interface ProducerContextAsset {
  readonly path: string;
  readonly role: AssetRole;
  readonly durationMs: number | null;
}

export interface ProducerProjectContext {
  readonly slug: string;
  readonly projectRoot: string;
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly assetSource: 'catalog' | 'raw-scan';
  readonly assets: readonly ProducerContextAsset[];
  readonly hasTimeline: boolean;
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
    hasTimeline: timelineStat !== null && timelineStat.kind === 'file',
  };
}
