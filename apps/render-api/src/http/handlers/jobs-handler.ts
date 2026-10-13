import type { MediaProject } from '@video-maker/auto-montage';
import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MusicMode, Timeline } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { parseStoredJob, parseStoredParams } from '../../jobs/job-persistence';
import { sampleFileClassifierFor } from '../../jobs/sample-files';
import type { StoredJobParams } from '../../jobs/job-persistence';
import {
  assertBrandCaptionStyleHasBrand,
  parseMontageCaptionStyle,
  parseMontageMusic,
  parseMontageFormat,
  parseMontageLogo,
  parseMontageOverwrite,
  parseMontagePreset,
  parseMontageScript,
  parseMontageSeed,
  parseMontageVoice,
} from '../../jobs/montage-job-params';
import { parseJobModel } from '../../jobs/job-model-params';
import { parseMotionJobInput } from '../../jobs/motion-job-params';
import { parsePhotoArollJobInput } from '../../jobs/photo-aroll-job-params';
import { parseStoryboardInput, parseStoryboardOverwrite } from '../../jobs/storyboard-job-params';
import { parseVoiceJobInput } from '../../jobs/voice-job-params';
import { parsePublishJobInput } from '../../jobs/publish-job-params';
import { parseReferenceJobInput } from '../../jobs/reference-job-params';
import { parseReviewJobInput } from '../../jobs/review-job-params';
import { parseSampleInput } from '../../jobs/sample-job-params';
import {
  assertPublishableThumbnail,
  assertPublishableVideo,
  assertRenderReviewAllowsPublish,
  assertYoutubeReady,
} from '../../youtube/publish-preconditions';
import { resolvePublishLanguage } from '../../youtube/resolve-publish-language';
import { assertVoiceTracksNotPersisted, selectVoiceScenes } from '../../voice/select-voice-scenes';
import {
  assertVoiceScriptTrackNotPersisted,
  assertVoiceScriptTrackPersisted,
} from '../../voice/voice-script-preconditions';
import { readVoiceManifestIfUsable } from '../../voice/voice-store';
import { readStoredStoryboard } from '../../storyboard/storyboard-store';
import { storyboardPath } from '../../storyboard/storyboard-paths';
import { storyboardExists } from '../../storyboard/storyboard-store';
import type {
  CreateJobInput,
  CreatePublishJobInput,
  CreateReferenceJobInput,
  CreateReviewJobInput,
  Job,
  JobKind,
  MotionPhase,
  RenderJobSummary,
  SampleSpec,
} from '../../jobs/render-job';
import { toJobSummary } from '../../jobs/render-job';
import {
  assertMotionProject,
  assertTimelineNotPersisted,
  assertValidProjectSlug,
  readStoredTimeline,
  resolveExistingProject,
} from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function jobAcceptedResponse(job: Job): HttpResponse {
  return {
    status: 202,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/jobs/${job.id}` },
    body: job,
  };
}

function registerJob(runtime: RenderApiRuntime, input: CreateJobInput, retryOf: string | null): Job {
  return retryOf === null ? runtime.jobs.create(input) : runtime.jobs.createRetry(retryOf, input);
}

export interface RenderJobListBody {
  readonly slug: string;
  readonly jobs: readonly RenderJobSummary[];
}

function resolveJobKind(value: unknown): JobKind | 'invalid' {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'render';
  }
  const raw = (value as Record<string, unknown>).kind;
  if (raw === undefined) {
    return 'render';
  }
  if (
    raw === 'render' ||
    raw === 'montage' ||
    raw === 'storyboard' ||
    raw === 'voice' ||
    raw === 'photo-aroll' ||
    raw === 'motion' ||
    raw === 'publish' ||
    raw === 'review' ||
    raw === 'reference'
  ) {
    return raw;
  }
  return 'invalid';
}

async function createRenderJobResponse(
  runtime: RenderApiRuntime,
  slug: string,
  projectRoot: string,
  timeline: Timeline,
  sample: SampleSpec | undefined,
  retryOf: string | null,
): Promise<HttpResponse> {
  const job = registerJob(
    runtime,
    { kind: 'render', slug, projectRoot, timeline, ...(sample === undefined ? {} : { sample }) },
    retryOf,
  );
  return jobAcceptedResponse(job);
}

interface MontageParams {
  readonly preset: ReturnType<typeof parseMontagePreset>;
  readonly seed: number;
  readonly scriptPath: string | null;
  readonly scriptText: string | null;
  readonly logo: ReturnType<typeof parseMontageLogo>;
  readonly format: ReturnType<typeof parseMontageFormat>;
  readonly voice: ReturnType<typeof parseMontageVoice>;
  readonly captionStyle: ReturnType<typeof parseMontageCaptionStyle>;
  readonly musicMode?: MusicMode;
  readonly musicFloorDb?: number;
}

async function createMontageJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: MontageParams,
  overwrite: boolean,
  retryOf: string | null,
): Promise<HttpResponse> {
  await assertTimelineNotPersisted(deps, project, overwrite);

  if (params.voice === 'script') {
    await assertVoiceScriptTrackPersisted(deps, project);
  }

  const job = registerJob(runtime, { kind: 'montage', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

interface StoryboardParams {
  readonly brief: string | null;
  readonly scriptText: string | null;
  readonly model: string | null;
}

async function createStoryboardJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: StoryboardParams,
  overwrite: boolean,
  retryOf: string | null,
): Promise<HttpResponse> {
  if (!overwrite && (await storyboardExists(deps, project))) {
    throw new PipelineStageError({
      code: 'STORYBOARD_ALREADY_EXISTS',
      stage: null,
      resource: storyboardPath(),
    });
  }

  const job = registerJob(runtime, { kind: 'storyboard', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

interface VoiceParams {
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
}

async function createVoiceJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: VoiceParams,
  overwrite: boolean,
  retryOf: string | null,
): Promise<HttpResponse> {
  if (params.scriptText === null && params.scriptPath === null) {
    const document = await readStoredStoryboard(deps, project);
    const scenes = selectVoiceScenes(document, params.sceneIds);
    const manifest = await readVoiceManifestIfUsable(deps, project);

    assertVoiceTracksNotPersisted(manifest, scenes, overwrite);
  } else {
    await assertVoiceScriptTrackNotPersisted(deps, project, overwrite);
  }

  const job = registerJob(runtime, { kind: 'voice', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

interface PhotoArollParams {
  readonly photos: readonly string[];
  readonly output: string;
  readonly fps: number;
}

async function createPhotoArollJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: PhotoArollParams,
  retryOf: string | null,
): Promise<HttpResponse> {
  await assertVoiceScriptTrackPersisted(deps, project);

  const targetPath = `raw/aroll/${params.output}`;
  if ((await deps.storage.stat(toAbsolutePath(project, targetPath))) !== null) {
    throw new PipelineStageError({ code: 'ASSET_EXISTS', stage: null, resource: targetPath });
  }

  const job = registerJob(runtime, { kind: 'photo-aroll', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

interface MotionParams {
  readonly phase: MotionPhase;
  readonly output: string;
  readonly takes: number;
  readonly sample?: SampleSpec;
}

async function assertMotionJobPreconditions(
  deps: RenderApiDependencies,
  project: MediaProject,
  slug: string,
  params: MotionParams,
  overwrite: boolean,
): Promise<void> {
  assertMotionProject(deps, slug);

  if (params.sample !== undefined && params.phase === 'storyboard') {
    throw new PipelineStageError({
      code: 'MOTION_JOB_INPUT_INVALID',
      stage: null,
      resource: 'sample',
      expected: "a sample needs phase 'video' or 'all': the storyboard phase renders no video",
    });
  }

  const exists = async (relativePath: string): Promise<boolean> =>
    (await deps.storage.stat(toAbsolutePath(project, relativePath))) !== null;

  if (params.phase !== 'video' && !(await exists('motion/brief.json'))) {
    throw new PipelineStageError({ code: 'BRIEF_MISSING', stage: null, resource: 'motion/brief.json' });
  }
  if (params.phase === 'video' && !(await exists('motion/storyboard.json'))) {
    throw new PipelineStageError({ code: 'STORYBOARD_MISSING', stage: null, resource: 'motion/storyboard.json' });
  }
  if (overwrite) {
    return;
  }
  if (params.phase !== 'video' && (await exists('motion/storyboard.json'))) {
    throw new PipelineStageError({ code: 'STORYBOARD_ALREADY_EXISTS', stage: null, resource: 'motion/storyboard.json' });
  }
  if (params.phase !== 'storyboard' && params.sample === undefined && (await exists(`out/${params.output}`))) {
    throw new PipelineStageError({ code: 'ASSET_EXISTS', stage: null, resource: `out/${params.output}` });
  }
}

async function createMotionJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: MotionParams,
  overwrite: boolean,
  retryOf: string | null,
): Promise<HttpResponse> {
  await assertMotionJobPreconditions(deps, project, slug, params, overwrite);

  const job = registerJob(runtime, { kind: 'motion', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

type PublishParams = Omit<CreatePublishJobInput, 'kind' | 'slug' | 'projectRoot'>;

type ReviewParams = Omit<CreateReviewJobInput, 'kind' | 'slug' | 'projectRoot'>;

async function createReviewJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: ReviewParams,
  retryOf: string | null,
): Promise<HttpResponse> {
  const stat = await deps.storage.stat(toAbsolutePath(project, params.file));
  if (stat === null || stat.kind !== 'file') {
    throw new PipelineStageError({
      code: 'REVIEW_FILE_INVALID',
      stage: null,
      resource: params.file,
      expected: 'an existing .mp4 under out/',
    });
  }
  const job = registerJob(runtime, { kind: 'review', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

type ReferenceParams = Omit<CreateReferenceJobInput, 'kind' | 'slug' | 'projectRoot'>;

async function createReferenceJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: ReferenceParams,
  retryOf: string | null,
): Promise<HttpResponse> {
  const stat = await deps.storage.stat(toAbsolutePath(project, params.file));
  if (stat === null || stat.kind !== 'file') {
    throw new PipelineStageError({
      code: 'REFERENCE_FILE_NOT_FOUND',
      stage: null,
      resource: params.file,
      expected: 'an existing video under raw/reference/',
    });
  }
  const job = registerJob(runtime, { kind: 'reference', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

async function createPublishJobResponse(
  deps: RenderApiDependencies,
  project: MediaProject,
  runtime: RenderApiRuntime,
  slug: string,
  params: PublishParams,
  retryOf: string | null,
): Promise<HttpResponse> {
  await assertPublishableVideo(deps.storage, project, params.file, sampleFileClassifierFor(runtime.jobs, slug));
  await assertRenderReviewAllowsPublish(deps.storage, project, params.file, params.ignoreReview);
  if (params.thumbnail !== null) {
    await assertPublishableThumbnail(deps.storage, project, params.thumbnail);
  }
  await assertYoutubeReady(runtime.youtube.oauth);

  const job = registerJob(runtime, { kind: 'publish', slug, projectRoot: project.root, ...params }, retryOf);
  return jobAcceptedResponse(job);
}

export async function handleCreateRenderJob(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const value = bodyResult.kind === 'parsed' ? bodyResult.value : {};
  const jobKind = resolveJobKind(value);

  if (jobKind === 'invalid') {
    throw new PipelineStageError({
      code: 'JOB_KIND_INVALID',
      stage: null,
      expected: "'render', 'montage', 'storyboard', 'voice', 'photo-aroll', 'motion', 'publish', 'review' or 'reference'",
    });
  }

  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const bodyObject = value as Record<string, unknown>;

  if (jobKind === 'render') {
    const sample = parseSampleInput(bodyObject.sample);
    const timeline = await readStoredTimeline(deps, project);
    return createRenderJobResponse(runtime, slug, project.root, timeline, sample, null);
  }

  if (jobKind === 'storyboard') {
    const input = parseStoryboardInput(bodyObject);
    const overwrite = parseStoryboardOverwrite(bodyObject.overwrite);
    const model = parseJobModel(bodyObject.model, runtime.producer.models);

    return createStoryboardJobResponse(
      deps,
      project,
      runtime,
      slug,
      { brief: input.brief, scriptText: input.scriptText, model },
      overwrite,
      null,
    );
  }

  if (jobKind === 'voice') {
    parseJobModel(bodyObject.model, runtime.producer.models);
    const input = parseVoiceJobInput(bodyObject);

    return createVoiceJobResponse(
      deps,
      project,
      runtime,
      slug,
      {
        voiceId: input.voiceId,
        sceneIds: input.sceneIds,
        scriptText: input.scriptText,
        scriptPath: input.scriptPath,
        gapMs: input.gapMs,
      },
      input.overwrite,
      null,
    );
  }

  if (jobKind === 'motion') {
    const input = parseMotionJobInput(bodyObject);
    const sample = parseSampleInput(bodyObject.sample);
    return createMotionJobResponse(
      deps,
      project,
      runtime,
      slug,
      { phase: input.phase, output: input.output, takes: input.takes, ...(sample === undefined ? {} : { sample }) },
      input.overwrite,
      null,
    );
  }

  if (jobKind === 'publish') {
    const input = parsePublishJobInput(bodyObject, Date.parse(deps.clock.nowIso()));
    const { defaultLanguage, ...rest } = input;
    return createPublishJobResponse(
      deps,
      project,
      runtime,
      slug,
      { ...rest, defaultLanguage: await resolvePublishLanguage(deps, store, slug, defaultLanguage) },
      null,
    );
  }

  if (jobKind === 'review') {
    return createReviewJobResponse(deps, project, runtime, slug, parseReviewJobInput(bodyObject), null);
  }

  if (jobKind === 'reference') {
    return createReferenceJobResponse(deps, project, runtime, slug, parseReferenceJobInput(bodyObject), null);
  }

  if (jobKind === 'photo-aroll') {
    const input = parsePhotoArollJobInput(bodyObject);
    return createPhotoArollJobResponse(
      deps,
      project,
      runtime,
      slug,
      { photos: input.photos, output: input.output, fps: input.fps },
      null,
    );
  }

  const preset = parseMontagePreset(bodyObject.preset);
  const seed = parseMontageSeed(bodyObject.seed);
  const overwrite = parseMontageOverwrite(bodyObject.overwrite);
  const script = parseMontageScript(bodyObject.scriptPath, bodyObject.scriptText);
  const logo = parseMontageLogo(bodyObject.logo);
  const format = parseMontageFormat(bodyObject.format);
  const voice = parseMontageVoice(bodyObject.voice);
  const captionStyle = parseMontageCaptionStyle(bodyObject.captionStyle);
  assertBrandCaptionStyleHasBrand(captionStyle, (deps.localStore.projects.get(slug)?.brand ?? null) !== null);
  const music = parseMontageMusic(bodyObject.musicMode, bodyObject.musicFloorDb);

  return createMontageJobResponse(
    deps,
    project,
    runtime,
    slug,
    {
      preset,
      seed,
      scriptPath: script.scriptPath,
      scriptText: script.scriptText,
      logo,
      format,
      voice,
      captionStyle,
      ...music,
    },
    overwrite,
    null,
  );
}

export async function handleListRenderJobs(
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const jobs = runtime.jobs.listBySlug(slug).map(toJobSummary);
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

const RETRYABLE_STATES = new Set(['failed', 'canceled']);

function requireRetryableParams(jobId: string, kind: JobKind, rawParams: unknown): StoredJobParams {
  const parsed = parseStoredParams(kind, rawParams);
  if (parsed === null) {
    throw new PipelineStageError({ code: 'JOB_RECORD_INVALID', stage: null, resource: jobId });
  }
  return parsed;
}

export async function handleRetryRenderJob(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const jobId = params.jobId ?? '';
  const storedRow = deps.localStore.jobs.get(jobId);
  if (storedRow === null) {
    throw new PipelineStageError({ code: 'RENDER_JOB_NOT_FOUND', stage: null, resource: jobId });
  }

  const job = parseStoredJob(storedRow);
  if (job.error?.code === 'JOB_RECORD_INVALID') {
    throw new PipelineStageError({ code: 'JOB_RECORD_INVALID', stage: null, resource: jobId });
  }
  if (!RETRYABLE_STATES.has(job.state)) {
    throw new PipelineStageError({
      code: 'JOB_NOT_RETRYABLE',
      stage: null,
      resource: jobId,
      expected: 'a job in the failed or canceled state',
    });
  }

  const retryParams = requireRetryableParams(jobId, job.kind, storedRow.params);
  const project = await resolveExistingProject(deps, store, job.slug);

  switch (retryParams.kind) {
    case 'render':
      return createRenderJobResponse(runtime, job.slug, project.root, retryParams.timeline, retryParams.sample, jobId);
    case 'montage':
      return createMontageJobResponse(deps, project, runtime, job.slug, retryParams, false, jobId);
    case 'storyboard':
      return createStoryboardJobResponse(deps, project, runtime, job.slug, retryParams, false, jobId);
    case 'voice':
      return createVoiceJobResponse(deps, project, runtime, job.slug, retryParams, false, jobId);
    case 'photo-aroll':
      return createPhotoArollJobResponse(deps, project, runtime, job.slug, retryParams, jobId);
    case 'motion':
      return createMotionJobResponse(deps, project, runtime, job.slug, retryParams, true, jobId);
    case 'publish':
      return createPublishJobResponse(deps, project, runtime, job.slug, retryParams, jobId);
    case 'review':
      return createReviewJobResponse(deps, project, runtime, job.slug, retryParams, jobId);
    case 'reference':
      return createReferenceJobResponse(deps, project, runtime, job.slug, retryParams, jobId);
  }
}
