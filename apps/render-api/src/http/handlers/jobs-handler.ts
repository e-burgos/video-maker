import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import type { RenderJobSummary } from '../../jobs/render-job';
import { toRenderJobSummary } from '../../jobs/render-job';
import { assertValidProjectSlug, readStoredTimeline, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

export interface RenderJobListBody {
  readonly slug: string;
  readonly jobs: readonly RenderJobSummary[];
}

export async function handleCreateRenderJob(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);
  const timeline = await readStoredTimeline(deps, project);

  const job = runtime.jobs.create({ slug, projectRoot: project.root, timeline });

  return {
    status: 202,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/jobs/${job.id}` },
    body: job,
  };
}

export async function handleListRenderJobs(
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const jobs = runtime.jobs.listBySlug(slug).map(toRenderJobSummary);
  const body: RenderJobListBody = { slug, jobs };

  return jsonResponse(200, body);
}

export async function handleGetRenderJob(params: RouteParams, runtime: RenderApiRuntime): Promise<HttpResponse> {
  const jobId = params.jobId ?? '';
  const job = runtime.jobs.get(jobId);
  if (job === null) {
    throw new PipelineStageError({ code: 'RENDER_JOB_NOT_FOUND', stage: null, resource: jobId });
  }

  return jsonResponse(200, job);
}

export async function handleCancelRenderJob(
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const jobId = params.jobId ?? '';
  const result = runtime.jobs.cancel(jobId);

  switch (result.kind) {
    case 'canceled':
      return jsonResponse(200, result.job);
    case 'canceling':
      return jsonResponse(202, result.job);
    case 'not-cancelable':
      throw new PipelineStageError({
        code: 'RENDER_JOB_NOT_CANCELABLE',
        stage: null,
        resource: jobId,
        expected: 'a job in the queued, running or canceling state',
      });
    case 'not-found':
      throw new PipelineStageError({ code: 'RENDER_JOB_NOT_FOUND', stage: null, resource: jobId });
  }
}
