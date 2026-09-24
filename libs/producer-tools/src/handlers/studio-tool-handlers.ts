import { z } from 'zod';

import { STUDIO_TOOLS } from '../contract/tool-schemas';
import type { StudioToolName } from '../contract/tool-names';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import type { RenderApiClient } from '../client/render-api-client';

export const DEFAULT_WAIT_FOR_JOB_POLL_INTERVAL_MS = 2000;
export const RECENT_JOBS_LIMIT = 5;

const TERMINAL_JOB_STATES: ReadonlySet<string> = new Set(['succeeded', 'failed', 'canceled']);
const JOB_KINDS_THAT_TAKE_MODEL: ReadonlySet<string> = new Set(['voice', 'storyboard']);

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

  const handlers: Record<StudioToolName, StudioToolHandler> = {
    get_project_overview: async (rawInput) => {
      parseInput(STUDIO_TOOLS.get_project_overview.input, rawInput);

      const [detail, assets, recentJobs, script] = await Promise.all([
        client.getProjectDetail(),
        client.listProjectAssets(),
        client.listRecentJobs(RECENT_JOBS_LIMIT),
        client.readProducerScriptState(),
      ]);

      return withOutput('get_project_overview', {
        slug: detail.slug,
        title: detail.slug,
        assets: assets.map((asset) => ({
          path: asset.path,
          role: asset.role,
          durationMs: asset.media?.durationMs ?? null,
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
      const { job: jobInput } = parseInput<{ job: Record<string, unknown> & { kind: string } }>(
        STUDIO_TOOLS.start_job.input,
        rawInput,
      );
      const body: Record<string, unknown> = JOB_KINDS_THAT_TAKE_MODEL.has(jobInput.kind)
        ? { ...jobInput, model }
        : jobInput;
      const job = await client.createJob(body);
      return withOutput('start_job', { jobId: job.id, kind: job.kind, status: job.state });
    },

    wait_for_job: async (rawInput) => {
      const input = parseInput<{ jobId: string; timeoutSeconds: number }>(STUDIO_TOOLS.wait_for_job.input, rawInput);
      const deadline = clock() + input.timeoutSeconds * 1000;

      let job = await client.getJob(input.jobId);
      while (!TERMINAL_JOB_STATES.has(job.state) && clock() < deadline) {
        await sleep(pollIntervalMs);
        job = await client.getJob(input.jobId);
      }

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
      const input = parseInput<{ timeline: unknown }>(STUDIO_TOOLS.put_timeline.input, rawInput);
      await client.putTimeline(input.timeline);
      return withOutput('put_timeline', { saved: true });
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
  };

  return handlers;
}
