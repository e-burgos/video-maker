import { serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { MaterialReviewSchema, canonicalMaterialPath } from '@video-maker/timeline-core';
import type { MaterialReview } from '@video-maker/timeline-core';
import { dirname } from 'node:path/posix';
import { z } from 'zod';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { materialReviewPath, viewedImagesPath } from './material-paths';

const VIEWED_IMAGES_VERSION = 1;

const ViewedImagesSchema = z.strictObject({
  version: z.literal(VIEWED_IMAGES_VERSION),
  images: z.array(z.strictObject({ path: z.string().min(1), viewedAt: z.iso.datetime() })),
});

export type ViewedImages = z.infer<typeof ViewedImagesSchema>;

function describeIssues(error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] }): string {
  return error.issues.map((issue) => `${issue.path.map(String).join('.')} ${issue.message}`).join('; ');
}

async function readJsonIfPresent(deps: RenderApiDependencies, project: MediaProject, relativePath: string): Promise<unknown> {
  const absolutePath = toAbsolutePath(project, relativePath);
  if ((await deps.storage.stat(absolutePath)) === null) {
    return undefined;
  }
  try {
    return JSON.parse(await deps.storage.readTextFile(absolutePath));
  } catch {
    throw new PipelineStageError({ code: 'MATERIAL_REVIEW_INVALID', stage: null, resource: relativePath, expected: 'valid JSON' });
  }
}

async function writeJson(deps: RenderApiDependencies, project: MediaProject, relativePath: string, document: unknown): Promise<void> {
  const absolutePath = toAbsolutePath(project, relativePath);
  await deps.storage.ensureDirectory(dirname(absolutePath));
  await deps.storage.writeTextFile(absolutePath, serializeMontageDocument(document));
}

export async function readMaterialReview(deps: RenderApiDependencies, project: MediaProject): Promise<MaterialReview | null> {
  const raw = await readJsonIfPresent(deps, project, materialReviewPath());
  if (raw === undefined) {
    return null;
  }
  const parsed = MaterialReviewSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PipelineStageError({ code: 'MATERIAL_REVIEW_INVALID', stage: null, resource: materialReviewPath(), expected: describeIssues(parsed.error) });
  }
  return parsed.data;
}

export async function writeMaterialReview(deps: RenderApiDependencies, project: MediaProject, review: MaterialReview): Promise<void> {
  await writeJson(deps, project, materialReviewPath(), MaterialReviewSchema.parse(review));
}

export async function readViewedImages(deps: RenderApiDependencies, project: MediaProject): Promise<ViewedImages> {
  const raw = await readJsonIfPresent(deps, project, viewedImagesPath());
  const parsed = ViewedImagesSchema.safeParse(raw);
  return parsed.success ? parsed.data : { version: VIEWED_IMAGES_VERSION, images: [] };
}

export async function recordViewedImages(
  deps: RenderApiDependencies,
  project: MediaProject,
  paths: readonly string[],
  viewedAt: string,
): Promise<void> {
  const current = await readViewedImages(deps, project);
  const recorded = new Set(paths.map(canonicalMaterialPath));
  const kept = current.images.filter((entry) => !recorded.has(entry.path));
  const images = [...kept, ...[...recorded].map((path) => ({ path, viewedAt }))];
  await writeJson(deps, project, viewedImagesPath(), { version: VIEWED_IMAGES_VERSION, images });
}

export function filesNotViewed(files: readonly string[], viewed: ViewedImages): readonly string[] {
  const seen = new Set(viewed.images.map((entry) => entry.path));
  return files.filter((file) => !seen.has(canonicalMaterialPath(file)));
}
