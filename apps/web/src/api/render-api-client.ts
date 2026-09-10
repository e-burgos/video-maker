import type { StoryboardDocument, Timeline } from '@video-maker/timeline-core';
import { RENDER_API_BASE_PATH } from './artifact-url';
import {
  parseJob,
  parseMontageJob,
  parseRenderJob,
  parseRenderJobListing,
  parseStoryboardJob,
  parseVoiceJob,
} from './parse-render-job';
import {
  parseProducerConversation,
  parseProducerTurn,
  parseProducerTurnAccepted,
} from './parse-producer';
import {
  parseVoiceDocument,
  parseVoiceListing,
  parseVoiceSceneWriteResult,
} from './parse-voice';
import {
  RenderApiError,
  fromErrorResponse,
  responseShapeUnexpected,
  serviceUnreachable,
} from './render-api-error';
import type {
  AssetListEntry,
  AssetListing,
  AssetRole,
  Job,
  MontageJob,
  MontagePresetName,
  ProducerConversation,
  ProducerTurn,
  ProducerTurnAccepted,
  ProjectDetail,
  ProjectSummary,
  RenderJob,
  RenderJobListing,
  ServiceHealth,
  StoryboardJob,
  StoryboardWriteResult,
  TimelineWriteResult,
  VoiceDocument,
  VoiceJob,
  VoiceListing,
  VoiceSceneWriteResult,
} from './render-api-types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RenderJobCancelOutcome = { status: 200 | 202; job: Job };

export type CreateMontageJobInput = {
  preset: MontagePresetName;
  seed: number;
  overwrite: boolean;
};

export type CreateStoryboardJobInput =
  | { brief: string; overwrite: boolean }
  | { scriptText: string; overwrite: boolean };

export type CreateVoiceJobInput = {
  voiceId: string | null;
  sceneIds: readonly string[] | null;
  overwrite: boolean;
};

export type RenderApiClient = {
  getHealth: () => Promise<ServiceHealth>;
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (slug: string) => Promise<ProjectDetail>;
  getProject: (slug: string) => Promise<ProjectDetail>;
  listAssets: (slug: string) => Promise<AssetListing>;
  getTimeline: (slug: string) => Promise<Timeline>;
  uploadAsset: (input: UploadAssetInput) => Promise<AssetListEntry>;
  putTimeline: (slug: string, timeline: Timeline) => Promise<TimelineWriteResult>;
  createRenderJob: (slug: string) => Promise<RenderJob>;
  createMontageJob: (slug: string, input: CreateMontageJobInput) => Promise<MontageJob>;
  createStoryboardJob: (slug: string, input: CreateStoryboardJobInput) => Promise<StoryboardJob>;
  getStoryboard: (slug: string) => Promise<StoryboardDocument>;
  putStoryboard: (slug: string, storyboard: StoryboardDocument) => Promise<StoryboardWriteResult>;
  getStoryboardPrompts: (slug: string) => Promise<string>;
  listVoices: () => Promise<VoiceListing>;
  getVoice: (slug: string) => Promise<VoiceDocument>;
  createVoiceJob: (slug: string, input: CreateVoiceJobInput) => Promise<VoiceJob>;
  attachVoiceTake: (
    slug: string,
    sceneId: string,
    fileName: string,
  ) => Promise<VoiceSceneWriteResult>;
  getProducer: (slug: string) => Promise<ProducerConversation>;
  sendProducerMessage: (slug: string, text: string, model?: string) => Promise<ProducerTurnAccepted>;
  getProducerTurn: (slug: string, turnId: string) => Promise<ProducerTurn>;
  cancelProducerTurn: (slug: string, turnId: string) => Promise<ProducerTurn>;
  listRenderJobs: (slug: string) => Promise<RenderJobListing>;
  getRenderJob: (jobId: string) => Promise<Job>;
  cancelRenderJob: (jobId: string) => Promise<RenderJobCancelOutcome>;
};

export type UploadAssetInput = {
  slug: string;
  role: AssetRole;
  filename: string;
  contentType: string;
  body: Blob;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createRenderApiClient(fetchImpl: FetchLike): RenderApiClient {
  async function send(path: string, init: RequestInit | undefined): Promise<Response> {
    try {
      return await fetchImpl(`${RENDER_API_BASE_PATH}${path}`, init);
    } catch (cause) {
      throw serviceUnreachable(cause);
    }
  }

  async function readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  async function requestJson(
    path: string,
    init: RequestInit | undefined,
    expected: string,
    accept: (body: unknown) => boolean,
  ): Promise<unknown> {
    const response = await send(path, init);
    const body = await readJson(response);

    if (!response.ok) {
      throw fromErrorResponse(response.status, body);
    }

    if (!accept(body)) {
      throw responseShapeUnexpected(response.status, expected);
    }

    return body;
  }

  async function requestText(path: string): Promise<string> {
    const response = await send(path, undefined);

    if (!response.ok) {
      throw fromErrorResponse(response.status, await readJson(response));
    }

    return response.text();
  }

  async function requestJsonWithStatus(
    path: string,
    init: RequestInit | undefined,
    expected: string,
    accept: (body: unknown) => boolean,
  ): Promise<{ status: number; body: unknown }> {
    const response = await send(path, init);
    const body = await readJson(response);

    if (!response.ok) {
      throw fromErrorResponse(response.status, body);
    }

    if (!accept(body)) {
      throw responseShapeUnexpected(response.status, expected);
    }

    return { status: response.status, body };
  }

  return {
    async getHealth(): Promise<ServiceHealth> {
      const body = await requestJson('/health', undefined, 'a health document', (value) =>
        isRecord(value) && typeof value['status'] === 'string',
      );
      return body as ServiceHealth;
    },

    async listProjects(): Promise<ProjectSummary[]> {
      const body = await requestJson('/projects', undefined, 'a project array', (value) =>
        Array.isArray(value),
      );
      return body as ProjectSummary[];
    },

    async createProject(slug: string): Promise<ProjectDetail> {
      const body = await requestJson(
        '/projects',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug }),
        },
        'a project detail',
        (value) => isRecord(value) && typeof value['slug'] === 'string',
      );
      return body as ProjectDetail;
    },

    async getProject(slug: string): Promise<ProjectDetail> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}`,
        undefined,
        'a project detail',
        (value) => isRecord(value) && typeof value['slug'] === 'string',
      );
      return body as ProjectDetail;
    },

    async listAssets(slug: string): Promise<AssetListing> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/assets`,
        undefined,
        'an asset listing',
        (value) => isRecord(value) && Array.isArray(value['assets']),
      );
      return body as AssetListing;
    },

    async getTimeline(slug: string): Promise<Timeline> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/timeline`,
        undefined,
        'a timeline document',
        (value) => isRecord(value) && value['schemaVersion'] === 1 && isRecord(value['tracks']),
      );
      return body as Timeline;
    },

    async uploadAsset(input: UploadAssetInput): Promise<AssetListEntry> {
      const path = `/projects/${encodeURIComponent(input.slug)}/assets/${encodeURIComponent(
        input.role,
      )}/${encodeURIComponent(input.filename)}`;

      const body = await requestJson(
        path,
        {
          method: 'PUT',
          headers: { 'content-type': input.contentType },
          body: input.body,
        },
        'a catalog entry',
        (value) => isRecord(value) && typeof value['path'] === 'string',
      );
      return body as AssetListEntry;
    },

    async putTimeline(slug: string, timeline: Timeline): Promise<TimelineWriteResult> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/timeline`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(timeline),
        },
        'a timeline write result',
        (value) => isRecord(value) && typeof value['slug'] === 'string' && typeof value['path'] === 'string',
      );
      return body as TimelineWriteResult;
    },

    async createRenderJob(slug: string): Promise<RenderJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        { method: 'POST' },
        'a render job document',
        (value) => isRecord(value),
      );
      return parseRenderJob(body);
    },

    async createMontageJob(slug: string, input: CreateMontageJobInput): Promise<MontageJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'montage',
            preset: input.preset,
            seed: input.seed,
            overwrite: input.overwrite,
          }),
        },
        'a montage job document',
        (value) => isRecord(value),
      );
      return parseMontageJob(body);
    },

    async createStoryboardJob(
      slug: string,
      input: CreateStoryboardJobInput,
    ): Promise<StoryboardJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'storyboard', ...input }),
        },
        'a storyboard job document',
        (value) => isRecord(value),
      );
      return parseStoryboardJob(body);
    },

    async getStoryboard(slug: string): Promise<StoryboardDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/storyboard`,
        undefined,
        'a storyboard document',
        (value) => isRecord(value) && value['schemaVersion'] === 1 && Array.isArray(value['scenes']),
      );
      return body as StoryboardDocument;
    },

    async putStoryboard(
      slug: string,
      storyboard: StoryboardDocument,
    ): Promise<StoryboardWriteResult> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/storyboard`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(storyboard),
        },
        'a storyboard write result',
        (value) => isRecord(value) && typeof value['slug'] === 'string' && typeof value['path'] === 'string',
      );
      return body as StoryboardWriteResult;
    },

    async getStoryboardPrompts(slug: string): Promise<string> {
      return requestText(`/projects/${encodeURIComponent(slug)}/storyboard/prompts`);
    },

    async listVoices(): Promise<VoiceListing> {
      const body = await requestJson('/voices', undefined, 'a voice listing', (value) =>
        isRecord(value),
      );
      return parseVoiceListing(body);
    },

    async getVoice(slug: string): Promise<VoiceDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/voice`,
        undefined,
        'a voice document',
        (value) => isRecord(value),
      );
      return parseVoiceDocument(body);
    },

    async createVoiceJob(slug: string, input: CreateVoiceJobInput): Promise<VoiceJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'voice',
            overwrite: input.overwrite,
            ...(input.voiceId === null ? {} : { voice: input.voiceId }),
            ...(input.sceneIds === null ? {} : { sceneIds: input.sceneIds }),
          }),
        },
        'a voice job document',
        (value) => isRecord(value),
      );
      return parseVoiceJob(body);
    },

    async attachVoiceTake(
      slug: string,
      sceneId: string,
      fileName: string,
    ): Promise<VoiceSceneWriteResult> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/voice/scenes/${encodeURIComponent(sceneId)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName }),
        },
        'a voice scene write result',
        (value) => isRecord(value),
      );
      return parseVoiceSceneWriteResult(body);
    },

    async getProducer(slug: string): Promise<ProducerConversation> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/producer`,
        undefined,
        'a producer conversation',
        (value) => isRecord(value),
      );
      return parseProducerConversation(body);
    },

    async sendProducerMessage(
      slug: string,
      text: string,
      model?: string,
    ): Promise<ProducerTurnAccepted> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/producer/messages`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(model === undefined ? { text } : { text, model }),
        },
        'an accepted producer turn',
        (value) => isRecord(value),
      );
      return parseProducerTurnAccepted(body);
    },

    async getProducerTurn(slug: string, turnId: string): Promise<ProducerTurn> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/producer/turns/${encodeURIComponent(turnId)}`,
        undefined,
        'a producer turn',
        (value) => isRecord(value),
      );
      return parseProducerTurn(body);
    },

    async cancelProducerTurn(slug: string, turnId: string): Promise<ProducerTurn> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/producer/turns/${encodeURIComponent(turnId)}`,
        { method: 'DELETE' },
        'a producer turn',
        (value) => isRecord(value),
      );
      return parseProducerTurn(body);
    },

    async listRenderJobs(slug: string): Promise<RenderJobListing> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        undefined,
        'a render job listing',
        (value) => isRecord(value) && Array.isArray(value['jobs']),
      );
      return parseRenderJobListing(body);
    },

    async getRenderJob(jobId: string): Promise<Job> {
      const body = await requestJson(
        `/jobs/${encodeURIComponent(jobId)}`,
        undefined,
        'a job document',
        (value) => isRecord(value),
      );
      return parseJob(body);
    },

    async cancelRenderJob(jobId: string): Promise<RenderJobCancelOutcome> {
      const { status, body } = await requestJsonWithStatus(
        `/jobs/${encodeURIComponent(jobId)}`,
        { method: 'DELETE' },
        'a job document',
        (value) => isRecord(value),
      );
      return { status: status as 200 | 202, job: parseJob(body) };
    },
  };
}

export { RenderApiError };
