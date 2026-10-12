import { z } from 'zod';

import { TimelineSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';

import { PATCH_TIMELINE_SECTIONS, STUDIO_TOOLS } from '../contract/tool-schemas';
import type { PatchTimelineInput, PatchTimelineSection } from '../contract/tool-schemas';
import type { StudioToolName } from '../contract/tool-names';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import type { RenderApiClient } from '../client/render-api-client';

export const DEFAULT_WAIT_FOR_JOB_POLL_INTERVAL_MS = 2000;
export const RECENT_JOBS_LIMIT = 5;

const TERMINAL_JOB_STATES: ReadonlySet<string> = new Set(['succeeded', 'failed', 'canceled']);
const PENDING_REVIEW_WAIT_MS = 180_000;
const RECENT_JOBS_FOR_PENDING_REVIEW = 10;
const JOB_KINDS_THAT_TAKE_MODEL: ReadonlySet<string> = new Set(['voice', 'storyboard']);

interface StartJobRequest extends Record<string, unknown> {
  readonly kind: string;
  readonly sample?: unknown;
  readonly phase?: unknown;
  readonly skipProposal?: unknown;
}

function isFullRender(job: StartJobRequest): boolean {
  if (job.sample !== undefined) {
    return false;
  }
  return job.kind === 'render' || (job.kind === 'motion' && job.phase !== 'storyboard');
}

function withoutSkipProposal(job: StartJobRequest): Record<string, unknown> {
  return Object.fromEntries(Object.entries(job).filter(([key]) => key !== 'skipProposal'));
}

async function assertProposalApproved(client: RenderApiClient): Promise<void> {
  const proposal = await client.getProposalState();
  if (proposal?.status === 'approved') {
    return;
  }
  throw new StudioToolRuntimeError(
    'PROPOSAL_NOT_APPROVED',
    proposal === null
      ? 'this project has no production proposal yet: present 2 or 3 approaches with propose_production, then ask the user to approve one in the studio (the Proposal card) before any full render. A sample (job.sample = {seconds: 8 to 20}) is not blocked.'
      : 'the production proposal is still pending: ask the user to approve one of its concepts in the studio (the Proposal card) before any full render. A sample (job.sample = {seconds: 8 to 20}) is not blocked.',
  );
}

async function readReferenceBriefOrExplain(client: RenderApiClient, name: string): Promise<unknown> {
  try {
    return await client.getReference(name);
  } catch (cause) {
    if (cause instanceof StudioToolRuntimeError && cause.code === 'FILE_NOT_FOUND') {
      throw new StudioToolRuntimeError(
        'FILE_NOT_FOUND',
        `the reference "${name}" was never analysed; start_job {"kind":"reference","file":"raw/reference/${name}.mp4"} (use the real file name with its extension) and wait_for_job until it succeeds`,
      );
    }
    throw cause;
  }
}

export interface StudioToolHandlerResult {
  readonly data: unknown;
  readonly images?: readonly { readonly mimeType: string; readonly base64: string }[];
}

export type StudioToolHandler = (input: unknown) => Promise<StudioToolHandlerResult>;

export interface StudioToolHandlersOptions {
  readonly client: RenderApiClient;
  readonly model: string;
  readonly clock?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly pollIntervalMs?: number;
}

function parseInput<T>(schema: z.ZodTypeAny, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new StudioToolRuntimeError('INVALID_INPUT', z.prettifyError(result.error));
  }
  return result.data as T;
}

function parseOutput<T>(schema: z.ZodTypeAny, output: unknown): T {
  const result = schema.safeParse(output);
  if (!result.success) {
    throw new StudioToolRuntimeError(
      'STUDIO_UNAVAILABLE',
      'the render API answered a shape this tool does not know how to report',
    );
  }
  return result.data as T;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function captionWordTexts(timeline: Timeline): readonly string[] {
  return timeline.tracks.captions.flatMap((clip) => clip.words.map((word) => word.text));
}

function captionWordsChanged(previous: Timeline, next: Timeline): boolean {
  const previousWords = captionWordTexts(previous);
  const nextWords = captionWordTexts(next);
  return (
    previousWords.length !== nextWords.length || previousWords.some((text, index) => text !== nextWords[index])
  );
}

function parsePutTimelineTimeline(rawTimeline: unknown): Timeline {
  let candidate = rawTimeline;
  if (typeof rawTimeline === 'string') {
    try {
      candidate = JSON.parse(rawTimeline);
    } catch {
      throw new StudioToolRuntimeError('INVALID_INPUT', 'timeline was a string that is not valid JSON');
    }
  }
  const result = TimelineSchema.safeParse(candidate);
  if (!result.success) {
    throw new StudioToolRuntimeError('INVALID_INPUT', z.prettifyError(result.error));
  }
  return result.data;
}

async function getExistingTimelineOrNull(client: RenderApiClient): Promise<Timeline | null> {
  let existing: unknown;
  try {
    existing = await client.getTimeline();
  } catch (cause) {
    if (cause instanceof StudioToolRuntimeError && cause.code === 'FILE_NOT_FOUND') {
      return null;
    }
    throw cause;
  }
  const result = TimelineSchema.safeParse(existing);
  return result.success ? result.data : null;
}

function patchTimelineSummary(sections: readonly PatchTimelineSection[]): string {
  return `Updated ${sections.join(', ')}.`;
}

export function createStudioToolHandlers(
  options: StudioToolHandlersOptions,
): Readonly<Record<StudioToolName, StudioToolHandler>> {
  const { client, model } = options;
  const clock = options.clock ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_WAIT_FOR_JOB_POLL_INTERVAL_MS;

  function withOutput(name: StudioToolName, data: unknown): StudioToolHandlerResult {
    return { data: parseOutput(STUDIO_TOOLS[name].output, data) };
  }

  async function pollJobUntilSettled(jobId: string, deadline: number) {
    let job = await client.getJob(jobId);
    while (!TERMINAL_JOB_STATES.has(job.state) && clock() < deadline) {
      await sleep(pollIntervalMs);
      job = await client.getJob(jobId);
    }
    return job;
  }

  async function waitForPendingReview(): Promise<boolean> {
    const jobs = await client.listRecentJobs(RECENT_JOBS_FOR_PENDING_REVIEW);
    const pending = jobs.find((job) => job.kind === 'review' && !TERMINAL_JOB_STATES.has(job.state));
    if (pending === undefined) return false;
    await pollJobUntilSettled(pending.id, clock() + PENDING_REVIEW_WAIT_MS);
    return true;
  }

  const handlers: Record<StudioToolName, StudioToolHandler> = {
    get_project_overview: async (rawInput) => {
      parseInput(STUDIO_TOOLS.get_project_overview.input, rawInput);

      const [detail, assets, pendingAssets, recentJobs, script] = await Promise.all([
        client.getProjectDetail(),
        client.listProjectAssets(),
        client.listPendingAssets(),
        client.listRecentJobs(RECENT_JOBS_LIMIT),
        client.readProducerScriptState(),
      ]);

      return withOutput('get_project_overview', {
        slug: detail.slug,
        title: detail.slug,
        mode: detail.mode ?? 'footage',
        assets: assets.map((asset) => ({
          path: asset.path,
          role: asset.role,
          durationMs: asset.media?.durationMs ?? null,
        })),
        pendingAssets: pendingAssets.map((asset) => ({
          assetId: asset.id,
          fileName: asset.fileName,
          proposedRole: asset.proposedRole,
          proposalReason: asset.proposalReason,
        })),
        hasTimeline: detail.layout.timeline,
        script,
        recentJobs: recentJobs.map((job) => ({ jobId: job.id, kind: job.kind, status: job.state })),
      });
    },

    probe_media: async (rawInput) => {
      const input = parseInput<{ path: string }>(STUDIO_TOOLS.probe_media.input, rawInput);
      const result = await client.probeMedia(input.path);
      return withOutput('probe_media', result);
    },

    extract_frames: async (rawInput) => {
      const input = parseInput<{ path: string; atSeconds: readonly number[] }>(
        STUDIO_TOOLS.extract_frames.input,
        rawInput,
      );
      const frames = await client.extractFrames(input.path, input.atSeconds);
      const images = await Promise.all(
        frames.map(async (frame) => {
          const file = await client.readFileBytes(frame.path);
          return { mimeType: file.mimeType, base64: Buffer.from(file.bytes).toString('base64') };
        }),
      );
      return { data: parseOutput(STUDIO_TOOLS.extract_frames.output, { frames }), images };
    },

    list_voices: async (rawInput) => {
      parseInput(STUDIO_TOOLS.list_voices.input, rawInput);
      const { voices, defaultVoiceId } = await client.listVoices();
      return withOutput('list_voices', {
        voices: voices.map((voice) => ({
          id: voice.id,
          label: voice.label,
          language: voice.language.code,
          quality: voice.quality ?? 'unknown',
          description: voice.description,
        })),
        defaultVoiceId,
      });
    },

    read_project_text: async (rawInput) => {
      const input = parseInput<{ path: string }>(STUDIO_TOOLS.read_project_text.input, rawInput);
      const result = await client.readProjectText(input.path);
      return withOutput('read_project_text', result);
    },

    write_project_text: async (rawInput) => {
      const input = parseInput<{ path: string; content: string }>(STUDIO_TOOLS.write_project_text.input, rawInput);
      const result = await client.writeProjectText(input.path, input.content);
      return withOutput('write_project_text', result);
    },

    copy_asset: async (rawInput) => {
      const input = parseInput<{ from: string; role: string; filename: string }>(
        STUDIO_TOOLS.copy_asset.input,
        rawInput,
      );
      const result = await client.copyAsset(input.from, input.role, input.filename);
      return withOutput('copy_asset', result);
    },

    start_job: async (rawInput) => {
      const { job: jobInput } = parseInput<{ job: StartJobRequest }>(STUDIO_TOOLS.start_job.input, rawInput);
      if (isFullRender(jobInput) && jobInput.skipProposal !== true) {
        await assertProposalApproved(client);
      }
      const requestBody = withoutSkipProposal(jobInput);
      const body: Record<string, unknown> = JOB_KINDS_THAT_TAKE_MODEL.has(jobInput.kind)
        ? { ...requestBody, model }
        : requestBody;
      const job = await client.createJob(body);
      return withOutput('start_job', { jobId: job.id, kind: job.kind, status: job.state });
    },

    wait_for_job: async (rawInput) => {
      const input = parseInput<{ jobId: string; timeoutSeconds: number }>(STUDIO_TOOLS.wait_for_job.input, rawInput);
      const job = await pollJobUntilSettled(input.jobId, clock() + input.timeoutSeconds * 1000);

      return withOutput('wait_for_job', {
        jobId: job.id,
        kind: job.kind,
        status: job.state,
        progress: (job.progress ?? {}) as Record<string, unknown>,
        result: (job.report ?? null) as Record<string, unknown> | null,
        error: job.error ?? null,
      });
    },

    cancel_job: async (rawInput) => {
      const input = parseInput<{ jobId: string }>(STUDIO_TOOLS.cancel_job.input, rawInput);
      const job = await client.cancelJob(input.jobId);
      return withOutput('cancel_job', { jobId: job.id, status: job.state });
    },

    get_timeline: async (rawInput) => {
      parseInput(STUDIO_TOOLS.get_timeline.input, rawInput);
      const timeline = await client.getTimeline();
      return withOutput('get_timeline', { timeline });
    },

    put_timeline: async (rawInput) => {
      const input = parseInput<{ timeline: unknown; editCaptions?: boolean }>(
        STUDIO_TOOLS.put_timeline.input,
        rawInput,
      );
      const nextTimeline = parsePutTimelineTimeline(input.timeline);

      if (input.editCaptions !== true) {
        const previousTimeline = await getExistingTimelineOrNull(client);
        if (previousTimeline !== null && captionWordsChanged(previousTimeline, nextTimeline)) {
          throw new StudioToolRuntimeError(
            'INVALID_INPUT',
            'put_timeline would change caption words already saved for this project (for example, lost ' +
              'accents). Use patch_timeline for the logo, intro/outro plates, music level or caption style ' +
              'instead, or pass editCaptions: true only if the user explicitly asked to change the caption text.',
          );
        }
      }

      await client.putTimeline(nextTimeline);
      return withOutput('put_timeline', { saved: true });
    },

    patch_timeline: async (rawInput) => {
      const input = parseInput<PatchTimelineInput>(STUDIO_TOOLS.patch_timeline.input, rawInput);

      const currentRaw = await client.getTimeline();
      const current = parseOutput<Timeline>(TimelineSchema, currentRaw);

      const patched: Timeline = {
        ...current,
        ...(input.logo !== undefined ? { logo: input.logo ?? undefined } : {}),
        ...(input.bumpers !== undefined ? { bumpers: input.bumpers ?? undefined } : {}),
        ...(input.audioMix !== undefined ? { audioMix: input.audioMix } : {}),
        ...(input.captionStyle !== undefined ? { captionStyle: input.captionStyle ?? undefined } : {}),
        ...(input.safeZone !== undefined ? { safeZone: input.safeZone ?? undefined } : {}),
        ...(input.music !== undefined ? { tracks: { ...current.tracks, music: input.music } } : {}),
      };

      const validated = TimelineSchema.safeParse(patched);
      if (!validated.success) {
        throw new StudioToolRuntimeError('INVALID_INPUT', z.prettifyError(validated.error));
      }

      await client.putTimeline(validated.data);

      const changed = PATCH_TIMELINE_SECTIONS.filter((section) => input[section] !== undefined);
      return withOutput('patch_timeline', { changed, summary: patchTimelineSummary(changed) });
    },

    search_free_music: async (rawInput) => {
      const input = parseInput<{ mood: string; maxResults: number }>(STUDIO_TOOLS.search_free_music.input, rawInput);
      const results = await client.searchFreeMusic(input.mood, input.maxResults);
      return withOutput('search_free_music', { results });
    },

    import_music: async (rawInput) => {
      const input = parseInput<{ resultId: string }>(STUDIO_TOOLS.import_music.input, rawInput);
      const result = await client.importMusic(input.resultId);
      return withOutput('import_music', result);
    },

    search_free_media: async (rawInput) => {
      const input = parseInput<{ query: string; kind: 'video' | 'image'; maxResults: number }>(
        STUDIO_TOOLS.search_free_media.input,
        rawInput,
      );
      const results = await client.searchFreeMedia(input.query, input.kind, input.maxResults);
      return withOutput('search_free_media', { results });
    },

    import_media: async (rawInput) => {
      const input = parseInput<{ resultId: string }>(STUDIO_TOOLS.import_media.input, rawInput);
      const result = await client.importMedia(input.resultId);
      return withOutput('import_media', result);
    },

    view_images: async (rawInput) => {
      const input = parseInput<{ paths: readonly string[] }>(STUDIO_TOOLS.view_images.input, rawInput);
      const previews = await client.previewImages(input.paths);
      const images = await Promise.all(
        previews.map(async (preview) => {
          const file = await client.readFileBytes(preview.previewPath);
          return { mimeType: file.mimeType, base64: Buffer.from(file.bytes).toString('base64') };
        }),
      );
      return { data: parseOutput(STUDIO_TOOLS.view_images.output, { previews }), images };
    },

    get_render_review: async (rawInput) => {
      const input = parseInput<{ file?: string }>(STUDIO_TOOLS.get_render_review.input, rawInput);
      let review = await client.getRenderReview(input.file);
      if (review === null && (await waitForPendingReview())) {
        review = await client.getRenderReview(input.file);
      }
      if (review === null) {
        throw new StudioToolRuntimeError(
          'FILE_NOT_FOUND',
          'that render has not been reviewed: every full render or motion video is reviewed by a job of kind review that starts right after it; list the recent jobs and wait for it',
        );
      }
      return withOutput('get_render_review', review);
    },

    get_reference_brief: async (rawInput) => {
      const input = parseInput<{ name?: string }>(STUDIO_TOOLS.get_reference_brief.input, rawInput);
      const references = await client.listReferences();
      if (input.name === undefined) {
        return withOutput('get_reference_brief', { references, brief: null });
      }
      return withOutput('get_reference_brief', { references, brief: await readReferenceBriefOrExplain(client, input.name) });
    },

    propose_production: async (rawInput) => {
      const draft = parseInput<Record<string, unknown>>(STUDIO_TOOLS.propose_production.input, rawInput);
      const saved = await client.putProposal(draft);
      return withOutput('propose_production', { saved: true, status: 'pending', concepts: saved.concepts });
    },

    get_motion_brands: async (rawInput) => {
      parseInput(STUDIO_TOOLS.get_motion_brands.input, rawInput);
      const brands = await client.listMotionBrands();
      return withOutput('get_motion_brands', { brands });
    },

    read_motion_brief: async (rawInput) => {
      parseInput(STUDIO_TOOLS.read_motion_brief.input, rawInput);
      const brief = await client.getMotionBrief();
      return withOutput('read_motion_brief', { brief });
    },

    write_motion_brief: async (rawInput) => {
      const input = parseInput<{ brief: Record<string, unknown> }>(STUDIO_TOOLS.write_motion_brief.input, rawInput);
      await client.putMotionBrief(input.brief);
      return withOutput('write_motion_brief', { saved: true });
    },

    read_motion_storyboard: async (rawInput) => {
      parseInput(STUDIO_TOOLS.read_motion_storyboard.input, rawInput);
      const storyboard = await client.getMotionStoryboard();
      return withOutput('read_motion_storyboard', { storyboard });
    },

    write_motion_storyboard: async (rawInput) => {
      const input = parseInput<{ storyboard: Record<string, unknown> }>(STUDIO_TOOLS.write_motion_storyboard.input, rawInput);
      await client.putMotionStoryboard(input.storyboard);
      return withOutput('write_motion_storyboard', { saved: true });
    },
  };

  return handlers;
}
