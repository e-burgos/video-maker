import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { parseReviewFile } from '../../jobs/review-job-params';
import { countFindings, listReviews, readReview } from '../../review/review-store';
import type { StoredReview } from '../../review/review-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { queryValue } from '../query-value';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function toListItem(review: StoredReview): Record<string, unknown> {
  return {
    file: review.file,
    reviewFile: review.reviewFile,
    status: review.report.status,
    counts: countFindings(review.report),
    createdAt: review.report.createdAt,
  };
}

export async function handleGetRenderReviews(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const requestedFile = queryValue(request.path, 'file');
  if (requestedFile === null) {
    const reviews = await listReviews(deps.storage, project);
    return jsonResponse(200, { reviews: reviews.map(toListItem) });
  }

  const file = parseReviewFile(requestedFile);
  const review = await readReview(deps.storage, project, file);
  if (review === null) {
    throw new PipelineStageError({ code: 'REVIEW_NOT_FOUND', stage: null, resource: file });
  }
  return jsonResponse(200, review.report);
}
