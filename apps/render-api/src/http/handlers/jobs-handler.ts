import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import {
  parseMontageCaptionStyle,
  parseMontageFormat,
  parseMontageLogo,
  parseMontageOverwrite,
  parseMontagePreset,
  parseMontageScript,
  parseMontageSeed,
  parseMontageVoice,
} from '../../jobs/montage-job-params';
import { parseJobModel } from '../../jobs/job-model-params';
import { parseStoryboardInput, parseStoryboardOverwrite } from '../../jobs/storyboard-job-params';
import { parseVoiceJobInput } from '../../jobs/voice-job-params';
import { assertVoiceTracksNotPersisted, selectVoiceScenes } from '../../voice/select-voice-scenes';
import {
  assertVoiceScriptTrackNotPersisted,
  assertVoiceScriptTrackPersisted,
} from '../../voice/voice-script-preconditions';
import { readVoiceManifestIfUsable } from '../../voice/voice-store';
import { readStoredStoryboard } from '../../storyboard/storyboard-store';
import { storyboardPath } from '../../storyboard/storyboard-paths';
import { storyboardExists } from '../../storyboard/storyboard-store';
import type { JobKind, RenderJobSummary } from '../../jobs/render-job';
import { toJobSummary } from '../../jobs/render-job';
import { assertTimelineNotPersisted, assertValidProjectSlug, readStoredTimeline, resolveExistingProject } from '../../store/project-scope';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
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
  if (raw === 'render' || raw === 'montage' || raw === 'storyboard' || raw === 'voice') {
    return raw;
  }
  return 'invalid';
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
      expected: "'render', 'montage', 'storyboard' or 'voice'",
    });
  }

  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  if (jobKind === 'render') {
    const timeline = await readStoredTimeline(deps, project);
    const job = runtime.jobs.create({ kind: 'render', slug, projectRoot: project.root, timeline });

    return {
      status: 202,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/jobs/${job.id}` },
      body: job,
    };
  }

  const bodyObject = value as Record<string, unknown>;

  if (jobKind === 'storyboard') {
    const input = parseStoryboardInput(bodyObject);
    const overwrite = parseStoryboardOverwrite(bodyObject.overwrite);
    const model = parseJobModel(bodyObject.model, runtime.producer.models);

    if (!overwrite && (await storyboardExists(deps, project))) {
      throw new PipelineStageError({
        code: 'STORYBOARD_ALREADY_EXISTS',
        stage: null,
        resource: storyboardPath(),
      });
    }

    const storyboardJob = runtime.jobs.create({
      kind: 'storyboard',
      slug,
      projectRoot: project.root,
      brief: input.brief,
      scriptText: input.scriptText,
      model,
    });

    return {
      status: 202,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/jobs/${storyboardJob.id}` },
      body: storyboardJob,
    };
  }

  if (jobKind === 'voice') {
    parseJobModel(bodyObject.model, runtime.producer.models);
    const input = parseVoiceJobInput(bodyObject);

    if (input.scriptText === null && input.scriptPath === null) {
      const document = await readStoredStoryboard(deps, project);
      const scenes = selectVoiceScenes(document, input.sceneIds);
      const manifest = await readVoiceManifestIfUsable(deps, project);

      assertVoiceTracksNotPersisted(manifest, scenes, input.overwrite);
    } else {
      await assertVoiceScriptTrackNotPersisted(deps, project, input.overwrite);
    }

    const voiceJob = runtime.jobs.create({
      kind: 'voice',
      slug,
      projectRoot: project.root,
      voiceId: input.voiceId,
      sceneIds: input.sceneIds,
      scriptText: input.scriptText,
      scriptPath: input.scriptPath,
      gapMs: input.gapMs,
    });

    return {
      status: 202,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/jobs/${voiceJob.id}` },
      body: voiceJob,
    };
  }

  const preset = parseMontagePreset(bodyObject.preset);
  const seed = parseMontageSeed(bodyObject.seed);
  const overwrite = parseMontageOverwrite(bodyObject.overwrite);
  const script = parseMontageScript(bodyObject.scriptPath, bodyObject.scriptText);
  const logo = parseMontageLogo(bodyObject.logo);
  const format = parseMontageFormat(bodyObject.format);
  const voice = parseMontageVoice(bodyObject.voice);
  const captionStyle = parseMontageCaptionStyle(bodyObject.captionStyle);

  await assertTimelineNotPersisted(deps, project, overwrite);

  if (voice === 'script') {
    await assertVoiceScriptTrackPersisted(deps, project);
  }

  const job = runtime.jobs.create({
    kind: 'montage',
    slug,
    projectRoot: project.root,
    preset,
    seed,
    scriptPath: script.scriptPath,
    scriptText: script.scriptText,
    logo,
    format,
    voice,
    captionStyle,
  });

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
