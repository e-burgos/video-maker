import { resolveMediaProject, timelinePath, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { TimelineSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isValidProjectSlug } from './project-slug';

export function assertValidProjectSlug(slug: string): void {
  if (!isValidProjectSlug(slug)) {
    throw new PipelineStageError({
      code: 'PROJECT_SLUG_INVALID',
      stage: null,
      resource: slug,
      expected: 'a single kebab-case path segment',
    });
  }
}

export async function resolveExistingProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
): Promise<MediaProject> {
  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }
  if (!deps.localStore.projects.exists(slug)) {
    deps.localStore.projects.insert(slug, deps.clock.nowIso());
  }
  return project;
}

export async function readStoredTimeline(deps: RenderApiDependencies, project: MediaProject): Promise<Timeline> {
  const relativePath = timelinePath();
  const absolutePath = toAbsolutePath(project, relativePath);

  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null) {
    throw new PipelineStageError({ code: 'TIMELINE_NOT_FOUND', stage: null, resource: relativePath });
  }

  const raw = await deps.storage.readTextFile(absolutePath);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new PipelineStageError({
      code: 'TIMELINE_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a document accepted by TimelineSchema',
    });
  }

  const result = TimelineSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'TIMELINE_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a document accepted by TimelineSchema',
    });
  }

  return result.data;
}

export async function readStoredTimelineIfPersisted(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<Timeline | null> {
  const fileStat = await deps.storage.stat(toAbsolutePath(project, timelinePath()));
  return fileStat === null ? null : readStoredTimeline(deps, project);
}

export async function assertTimelineNotPersisted(
  deps: RenderApiDependencies,
  project: MediaProject,
  overwrite: boolean,
): Promise<void> {
  if (overwrite) {
    return;
  }

  const relativePath = timelinePath();
  const absolutePath = toAbsolutePath(project, relativePath);

  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat !== null) {
    throw new PipelineStageError({ code: 'TIMELINE_ALREADY_EXISTS', stage: null, resource: relativePath });
  }
}

export function assertMotionProject(deps: RenderApiDependencies, slug: string): void {
  if (deps.localStore.projects.get(slug)?.mode !== 'motion') {
    throw new PipelineStageError({ code: 'MOTION_PROJECT_REQUIRED', stage: null, resource: slug });
  }
}
