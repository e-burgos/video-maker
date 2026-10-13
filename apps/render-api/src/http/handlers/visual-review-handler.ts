import { VisualReviewDraftSchema, visualReviewProblems, withVisualReview } from '@video-maker/timeline-core';
import type { ReviewReport } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { parseReviewFile } from '../../jobs/review-job-params';
import type { ViewedImages } from '../../material/material-store';
import { readViewedImages } from '../../material/material-store';
import { readReview, writeReview } from '../../review/review-store';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { queryValue } from '../query-value';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RouteParams } from '../router';

function invalidVisualReview(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'VISUAL_REVIEW_INVALID', stage: null, resource, expected });
}

interface UnviewedSceneFrames {
  readonly sceneId: string;
  readonly frames: readonly string[];
}

function framesNotViewedSince(report: ReviewReport, viewed: ViewedImages): UnviewedSceneFrames[] {
  const viewedAtByPath = new Map(viewed.images.map((entry) => [entry.path, entry.viewedAt]));
  return (report.sceneFrames ?? [])
    .map((scene) => ({
      sceneId: scene.sceneId,
      frames: scene.frames.map((shot) => shot.frame).filter((frame) => (viewedAtByPath.get(frame) ?? '') < report.createdAt),
    }))
    .filter((scene) => scene.frames.length > 0);
}

function unviewedHint(unviewed: readonly UnviewedSceneFrames[]): string {
  const detail = unviewed.map((scene) => `escena "${scene.sceneId}": ${scene.frames.join(', ')}`).join('; ');
  return `Faltan cuadros por mirar con view_images antes de registrar la revisión visual: ${detail}`;
}

export async function handlePutVisualReview(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const file = parseReviewFile(queryValue(request.path, 'file'));

  const body = await readJsonObjectBody(request);
  const parsed = VisualReviewDraftSchema.safeParse({ scenes: body.scenes });
  if (!parsed.success) {
    throw invalidVisualReview(
      file,
      parsed.error.issues.map((issue) => `${issue.path.map(String).join('.')} ${issue.message}`).join('; '),
    );
  }

  const project = await resolveExistingProject(deps, store, slug);
  const stored = await readReview(deps.storage, project, file);
  if (stored === null) {
    throw new PipelineStageError({ code: 'REVIEW_NOT_FOUND', stage: null, resource: file });
  }
  const frames = stored.report.sceneFrames ?? [];
  if (frames.length === 0) {
    throw invalidVisualReview(file, 'a review with scene frames: this render has none to review visually');
  }
  const problems = visualReviewProblems(parsed.data, frames);
  if (problems.length > 0) {
    throw invalidVisualReview(file, problems.join('; '));
  }

  const notViewed = framesNotViewedSince(stored.report, await readViewedImages(deps, project));
  if (notViewed.length > 0) {
    throw new PipelineStageError({
      code: 'VISUAL_REVIEW_NOT_VIEWED',
      stage: null,
      resource: notViewed.flatMap((scene) => scene.frames).join(', '),
      expected: 'every frame of every scene previewed with view_images after the review was created',
      hint: unviewedHint(notViewed),
    });
  }

  const report = withVisualReview(stored.report, deps.clock.nowIso(), parsed.data);
  await writeReview(deps.storage, project, report);

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body: report };
}
