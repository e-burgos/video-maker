import { MaterialReviewDraftSchema, materialReviewFrom, materialWarnings } from '@video-maker/timeline-core';
import type { MaterialReview, MaterialWarnings } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { materialReviewPath } from '../../material/material-paths';
import { filesNotViewed, readMaterialReview, readViewedImages, writeMaterialReview } from '../../material/material-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RouteParams } from '../router';

export interface MaterialReviewBody {
  readonly slug: string;
  readonly path: string;
  readonly review: MaterialReview | null;
  readonly warnings: MaterialWarnings | null;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function bodyFor(slug: string, review: MaterialReview | null): MaterialReviewBody {
  return { slug, path: materialReviewPath(), review, warnings: review === null ? null : materialWarnings(review) };
}

export async function handleGetMaterialReview(deps: RenderApiDependencies, store: StoreConfig, params: RouteParams): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  return jsonResponse(200, bodyFor(slug, await readMaterialReview(deps, project)));
}

export async function handlePutMaterialReview(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const body = await readJsonObjectBody(request);
  const parsed = MaterialReviewDraftSchema.safeParse({ items: body.items, gaps: body.gaps });
  if (!parsed.success) {
    throw new PipelineStageError({
      code: 'MATERIAL_REVIEW_INVALID',
      stage: null,
      resource: materialReviewPath(),
      expected: parsed.error.issues.map((issue) => `${issue.path.map(String).join('.')} ${issue.message}`).join('; '),
    });
  }

  const project = await resolveExistingProject(deps, store, slug);
  const notViewed = filesNotViewed(
    parsed.data.items.map((item) => item.file),
    await readViewedImages(deps, project),
  );
  if (notViewed.length > 0) {
    throw new PipelineStageError({
      code: 'MATERIAL_NOT_VIEWED',
      stage: null,
      resource: notViewed.join(', '),
      expected: 'every reviewed image previewed with view_images first',
      hint: `look at these with view_images before reviewing them: ${notViewed.join(', ')}`,
    });
  }

  const review = materialReviewFrom(parsed.data, deps.clock.nowIso());
  await writeMaterialReview(deps, project, review);

  return jsonResponse(200, bodyFor(slug, review));
}
