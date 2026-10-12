import type { StoryboardDocument, Timeline, VoiceScriptDirections } from '@video-maker/timeline-core';
import { RENDER_API_BASE_PATH } from './artifact-url';
import { parseGeneratedListing } from './parse-generated';
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
  parseOpenRouterKeyResult,
  parseOpenRouterModelsResult,
  parseProducerSettings,
} from './parse-producer-settings';
import {
  parseVoiceDocument,
  parseVoiceListing,
  parseVoiceSceneWriteResult,
} from './parse-voice';
import { parseProposalDocument } from './parse-proposal';
import { parseReferenceBrief, parseReferenceJob, parseReferenceListing } from './parse-reference';
import { parseReviewJob, parseReviewReport } from './parse-review';
import {
  parsePublications,
  parsePublishJob,
  parseYouTubeConnectStart,
  parseYouTubeDraft,
  parseYouTubeIntegration,
  parseYouTubePublishOptions,
} from './parse-youtube';
import {
  RenderApiError,
  fromErrorResponse,
  responseShapeUnexpected,
  serviceUnreachable,
} from './render-api-error';
import type {
  AssetDeletion,
  AssetListEntry,
  AssetListing,
  GeneratedListing,
  AssetRole,
  GetOpenRouterModelsQuery,
  InboxAsset,
  InboxDeletion,
  InboxListing,
  Job,
  MontageJob,
  MontagePresetName,
  OpenRouterKeyResult,
  OpenRouterModelsResult,
  ProducerConversation,
  ProducerSettings,
  ProducerSettingsUpdate,
  ProducerTurn,
  ProducerTurnAccepted,
  ProjectDetail,
  ProjectSummary,
  VideoCategory,
  RenderJob,
  RenderJobListing,
  ServiceHealth,
  StoryboardJob,
  VideoDeletion,
  VideoFolder,
  VideoOrganization,
  VideoPlacement,
  VideoPlacementResult,
  StoryboardWriteResult,
  TimelineWriteResult,
  VoiceDocument,
  VoiceJob,
  VoiceListing,
  VoiceSceneWriteResult,
  CreateProjectInput,
} from './render-api-types';
import type {
  BrandDetail,
  BrandManifest,
  BrandPreview,
  BrandPreviewInput,
  BrandSummary,
  CreateBrandInput,
  UploadBrandFileInput,
} from './brand-types';
import type {
  CreateMotionJobInput,
  MotionBrand,
  MotionBrief,
  MotionJob,
  MotionOverview,
  MotionStoryboard,
  MusicMode,
} from './motion-types';

import type {
  Publication,
  PublishJob,
  YouTubeClientCredentials,
  YouTubeConnectStart,
  YouTubeDraft,
  YouTubeIntegration,
  YouTubePublishInput,
  YouTubePublishOptions,
} from './youtube-types';
import type { ReferenceBrief, ReferenceJob, ReferenceSummary } from './reference-types';
import type { ReviewJob, ReviewReport } from './review-types';
import type { ProposalDocument, SampleSpec } from './proposal-types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RenderJobCancelOutcome = { status: 200 | 202; job: Job };

export type CreateMontageJobInput = {
  preset: MontagePresetName;
  seed: number;
  overwrite: boolean;
  musicMode?: MusicMode;
  musicFloorDb?: number;
};

export type VoiceDirectionLine = { index: number; text: string };

export type VoiceDirectionDocument = {
  slug: string;
  path: string;
  directions: VoiceScriptDirections;
  lines: VoiceDirectionLine[];
};

export type CreateStoryboardJobInput =
  | { brief: string; overwrite: boolean }
  | { scriptText: string; overwrite: boolean };

export type CreateVoiceJobInput = {
  voiceId: string | null;
  sceneIds: readonly string[] | null;
  overwrite: boolean;
  scriptPath?: string;
};

export type RenderApiClient = {
  getHealth: () => Promise<ServiceHealth>;
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (input: CreateProjectInput) => Promise<ProjectDetail>;
  getProject: (slug: string) => Promise<ProjectDetail>;
  putProjectBrand: (slug: string, brand: string | null) => Promise<ProjectDetail>;
  getOrganization: () => Promise<VideoOrganization>;
  createFolder: (name: string) => Promise<VideoFolder>;
  renameFolder: (folderId: string, name: string) => Promise<VideoFolder>;
  deleteFolder: (folderId: string) => Promise<VideoOrganization>;
  createCategory: (folderId: string, name: string) => Promise<VideoCategory>;
  deleteCategory: (folderId: string, categoryId: string) => Promise<VideoOrganization>;
  putVideoPlacement: (slug: string, placement: VideoPlacement) => Promise<VideoPlacementResult>;
  deleteVideo: (slug: string) => Promise<VideoDeletion>;
  listAssets: (slug: string) => Promise<AssetListing>;
  listGenerated: (slug: string) => Promise<GeneratedListing>;
  getProjectFile: (slug: string, path: string) => Promise<string>;
  getTimeline: (slug: string) => Promise<Timeline>;
  uploadAsset: (input: UploadAssetInput) => Promise<AssetListEntry>;
  deleteAsset: (input: DeleteAssetInput) => Promise<AssetDeletion>;
  uploadToInbox: (input: UploadInboxInput) => Promise<InboxAsset>;
  listInbox: (slug: string) => Promise<InboxListing>;
  confirmInboxAsset: (slug: string, assetId: string, role: AssetRole) => Promise<InboxAsset>;
  discardInboxAsset: (slug: string, assetId: string) => Promise<InboxDeletion>;
  putTimeline: (slug: string, timeline: Timeline) => Promise<TimelineWriteResult>;
  createRenderJob: (slug: string, input?: { sample?: SampleSpec }) => Promise<RenderJob>;
  getProposal: (slug: string) => Promise<ProposalDocument>;
  approveProposal: (slug: string, conceptId: string) => Promise<ProposalDocument>;
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
  getProducerSettings: () => Promise<ProducerSettings>;
  updateProducerSettings: (update: ProducerSettingsUpdate) => Promise<ProducerSettings>;
  getOpenRouterModels: (query?: GetOpenRouterModelsQuery) => Promise<OpenRouterModelsResult>;
  putOpenRouterKey: (apiKey: string) => Promise<OpenRouterKeyResult>;
  deleteOpenRouterKey: () => Promise<OpenRouterKeyResult>;
  listRenderJobs: (slug: string) => Promise<RenderJobListing>;
  getMotionBrands: () => Promise<MotionBrand[]>;
  getMotionBrief: (slug: string) => Promise<MotionBrief>;
  putMotionBrief: (slug: string, brief: MotionBrief) => Promise<MotionBrief>;
  getMotionStoryboard: (slug: string) => Promise<MotionStoryboard>;
  putMotionStoryboard: (slug: string, storyboard: MotionStoryboard) => Promise<MotionStoryboard>;
  getVoiceDirection: (slug: string) => Promise<VoiceDirectionDocument>;
  putVoiceDirection: (slug: string, directions: VoiceScriptDirections) => Promise<VoiceDirectionDocument>;
  getMotionOverview: (slug: string) => Promise<MotionOverview>;
  createMotionJob: (slug: string, input: CreateMotionJobInput) => Promise<MotionJob>;
  listBrands: () => Promise<BrandSummary[]>;
  getBrand: (id: string) => Promise<BrandDetail>;
  createBrand: (input: CreateBrandInput) => Promise<BrandDetail>;
  putBrand: (id: string, manifest: BrandManifest) => Promise<BrandDetail>;
  deleteBrand: (id: string) => Promise<void>;
  uploadBrandFile: (input: UploadBrandFileInput) => Promise<{ path: string }>;
  composeBrandPreview: (id: string, input?: BrandPreviewInput) => Promise<BrandPreview>;
  addBrandGoogleFont: (id: string, family: string) => Promise<BrandDetail>;
  getRenderJob: (jobId: string) => Promise<Job>;
  cancelRenderJob: (jobId: string) => Promise<RenderJobCancelOutcome>;
  retryJob: (jobId: string) => Promise<Job>;
  getYouTubeIntegration: () => Promise<YouTubeIntegration>;
  putYouTubeClient: (credentials: YouTubeClientCredentials) => Promise<YouTubeIntegration>;
  connectYouTube: () => Promise<YouTubeConnectStart>;
  disconnectYouTube: () => Promise<void>;
  getYouTubePublishOptions: (slug: string) => Promise<YouTubePublishOptions>;
  draftYouTubeMetadata: (slug: string, file: string) => Promise<YouTubeDraft>;
  createPublishJob: (slug: string, input: YouTubePublishInput) => Promise<PublishJob>;
  getRenderReview: (slug: string, file: string) => Promise<ReviewReport | null>;
  createReviewJob: (slug: string, file: string) => Promise<ReviewJob>;
  listReferences: (slug: string) => Promise<ReferenceSummary[]>;
  getReference: (slug: string, name: string) => Promise<ReferenceBrief>;
  createReferenceJob: (slug: string, file: string) => Promise<ReferenceJob>;
  listPublications: (slug: string) => Promise<Publication[]>;
};

export type UploadAssetInput = {
  slug: string;
  role: AssetRole;
  filename: string;
  contentType: string;
  body: Blob;
};

export type DeleteAssetInput = {
  slug: string;
  role: AssetRole;
  filename: string;
  force: boolean;
};

export type UploadInboxInput = {
  slug: string;
  filename: string;
  contentType: string;
  body: Blob;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVoiceDirectionDocument(value: unknown): boolean {
  return isRecord(value) && isRecord(value['directions']) && Array.isArray(value['lines']);
}

function isBrandDetail(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isRecord(value['manifest']) &&
    isRecord(value['tokens']) &&
    isRecord(value['files'])
  );
}

function artifactPath(slug: string, path: string): string {
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/projects/${encodeURIComponent(slug)}/files/${segments}`;
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

    async createProject(input: CreateProjectInput): Promise<ProjectDetail> {
      const body = await requestJson(
        '/projects',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        'a project detail',
        (value) => isRecord(value) && typeof value['slug'] === 'string',
      );
      return body as ProjectDetail;
    },

    async putProjectBrand(slug: string, brand: string | null): Promise<ProjectDetail> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/brand`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ brand }),
        },
        'a project detail',
        (value) => isRecord(value) && typeof value['slug'] === 'string',
      );
      return body as ProjectDetail;
    },

    async getOrganization(): Promise<VideoOrganization> {
      const body = await requestJson('/folders', undefined, 'an organization document', (value) =>
        isRecord(value) && Array.isArray(value['folders']) && isRecord(value['videos']),
      );
      return body as VideoOrganization;
    },

    async createFolder(name: string): Promise<VideoFolder> {
      const body = await requestJson(
        '/folders',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        },
        'a folder',
        (value) => isRecord(value) && typeof value['id'] === 'string',
      );
      return body as VideoFolder;
    },

    async renameFolder(folderId: string, name: string): Promise<VideoFolder> {
      const body = await requestJson(
        `/folders/${encodeURIComponent(folderId)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        },
        'a folder',
        (value) => isRecord(value) && typeof value['id'] === 'string',
      );
      return body as VideoFolder;
    },

    async deleteFolder(folderId: string): Promise<VideoOrganization> {
      const body = await requestJson(
        `/folders/${encodeURIComponent(folderId)}`,
        { method: 'DELETE' },
        'an organization document',
        (value) => isRecord(value) && Array.isArray(value['folders']),
      );
      return body as VideoOrganization;
    },

    async createCategory(folderId: string, name: string): Promise<VideoCategory> {
      const body = await requestJson(
        `/folders/${encodeURIComponent(folderId)}/categories`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        },
        'a category',
        (value) => isRecord(value) && typeof value['id'] === 'string',
      );
      return body as VideoCategory;
    },

    async deleteCategory(folderId: string, categoryId: string): Promise<VideoOrganization> {
      const body = await requestJson(
        `/folders/${encodeURIComponent(folderId)}/categories/${encodeURIComponent(categoryId)}`,
        { method: 'DELETE' },
        'an organization document',
        (value) => isRecord(value) && Array.isArray(value['folders']),
      );
      return body as VideoOrganization;
    },

    async putVideoPlacement(slug: string, placement: VideoPlacement): Promise<VideoPlacementResult> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/placement`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(placement),
        },
        'a placement result',
        (value) => isRecord(value) && isRecord(value['placement']),
      );
      return body as VideoPlacementResult;
    },

    async deleteVideo(slug: string): Promise<VideoDeletion> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}`,
        { method: 'DELETE' },
        'a deletion result',
        (value) => isRecord(value) && value['deleted'] === true,
      );
      return body as VideoDeletion;
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

    async listGenerated(slug: string): Promise<GeneratedListing> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/generated`,
        undefined,
        'a generated listing',
        (value) => isRecord(value),
      );
      return parseGeneratedListing(body);
    },

    async getProjectFile(slug: string, path: string): Promise<string> {
      return requestText(artifactPath(slug, path));
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

    async deleteAsset(input: DeleteAssetInput): Promise<AssetDeletion> {
      const path = `/projects/${encodeURIComponent(input.slug)}/assets/${encodeURIComponent(
        input.role,
      )}/${encodeURIComponent(input.filename)}${input.force ? '?force=true' : ''}`;

      const body = await requestJson(
        path,
        { method: 'DELETE' },
        'an asset deletion result',
        (value) => isRecord(value) && isRecord(value['deleted']) && Array.isArray(value['timelineReferences']),
      );
      return body as AssetDeletion;
    },

    async uploadToInbox(input: UploadInboxInput): Promise<InboxAsset> {
      const path = `/projects/${encodeURIComponent(input.slug)}/inbox/${encodeURIComponent(input.filename)}`;

      const body = await requestJson(
        path,
        {
          method: 'PUT',
          headers: { 'content-type': input.contentType },
          body: input.body,
        },
        'an inbox asset',
        (value) => isRecord(value) && isRecord(value['asset']),
      );
      return (body as { asset: InboxAsset }).asset;
    },

    async listInbox(slug: string): Promise<InboxListing> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/inbox`,
        undefined,
        'an inbox listing',
        (value) => isRecord(value) && Array.isArray(value['assets']),
      );
      return body as InboxListing;
    },

    async confirmInboxAsset(slug: string, assetId: string, role: AssetRole): Promise<InboxAsset> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/inbox/${encodeURIComponent(assetId)}/confirm`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role }),
        },
        'an inbox asset',
        (value) => isRecord(value) && isRecord(value['asset']),
      );
      return (body as { asset: InboxAsset }).asset;
    },

    async discardInboxAsset(slug: string, assetId: string): Promise<InboxDeletion> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/inbox/${encodeURIComponent(assetId)}`,
        { method: 'DELETE' },
        'an inbox deletion result',
        (value) => isRecord(value) && isRecord(value['deleted']),
      );
      return body as InboxDeletion;
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

    async getProposal(slug: string): Promise<ProposalDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/proposal`,
        undefined,
        'a production proposal document',
        (value) => isRecord(value),
      );
      return parseProposalDocument(body);
    },

    async approveProposal(slug: string, conceptId: string): Promise<ProposalDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/proposal/approve`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conceptId }),
        },
        'a production proposal document',
        (value) => isRecord(value),
      );
      return parseProposalDocument(body);
    },

    async createRenderJob(slug: string, input?: { sample?: SampleSpec }): Promise<RenderJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        input?.sample === undefined
          ? { method: 'POST' }
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind: 'render', sample: input.sample }),
            },
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
            ...(input.musicMode === 'segments'
              ? {
                  musicMode: 'segments',
                  ...(input.musicFloorDb === undefined ? {} : { musicFloorDb: input.musicFloorDb }),
                }
              : {}),
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
            ...(input.scriptPath === undefined ? {} : { scriptPath: input.scriptPath }),
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

    async getProducerSettings(): Promise<ProducerSettings> {
      const body = await requestJson(
        '/settings/producer',
        undefined,
        'producer settings',
        (value) => isRecord(value),
      );
      return parseProducerSettings(body);
    },

    async updateProducerSettings(update: ProducerSettingsUpdate): Promise<ProducerSettings> {
      const body = await requestJson(
        '/settings/producer',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(update),
        },
        'producer settings',
        (value) => isRecord(value),
      );
      return parseProducerSettings(body);
    },

    async getOpenRouterModels(query: GetOpenRouterModelsQuery = {}): Promise<OpenRouterModelsResult> {
      const params = new URLSearchParams();
      if (query.scope !== undefined) {
        params.set('scope', query.scope);
      }
      if (query.q !== undefined && query.q !== '') {
        params.set('q', query.q);
      }
      if (query.sort !== undefined) {
        params.set('sort', query.sort);
      }
      const search = params.toString();

      const body = await requestJson(
        `/settings/producer/openrouter-models${search === '' ? '' : `?${search}`}`,
        undefined,
        'an openrouter models result',
        (value) => isRecord(value),
      );
      return parseOpenRouterModelsResult(body);
    },

    async putOpenRouterKey(apiKey: string): Promise<OpenRouterKeyResult> {
      const body = await requestJson(
        '/settings/producer/openrouter-key',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        },
        'an openrouter key result',
        (value) => isRecord(value),
      );
      return parseOpenRouterKeyResult(body);
    },

    async deleteOpenRouterKey(): Promise<OpenRouterKeyResult> {
      const body = await requestJson(
        '/settings/producer/openrouter-key',
        { method: 'DELETE' },
        'an openrouter key result',
        (value) => isRecord(value),
      );
      return parseOpenRouterKeyResult(body);
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

    async getMotionBrands(): Promise<MotionBrand[]> {
      const body = await requestJson('/motion/brands', undefined, 'a brand array', (value) =>
        Array.isArray(value),
      );
      return body as MotionBrand[];
    },

    async getMotionBrief(slug: string): Promise<MotionBrief> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/motion/brief`,
        undefined,
        'a motion brief',
        (value) => isRecord(value) && typeof value['script'] === 'string',
      );
      return body as MotionBrief;
    },

    async putMotionBrief(slug: string, brief: MotionBrief): Promise<MotionBrief> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/motion/brief`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(brief),
        },
        'a motion brief',
        (value) => isRecord(value),
      );
      return body as MotionBrief;
    },

    async getMotionStoryboard(slug: string): Promise<MotionStoryboard> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/motion/storyboard`,
        undefined,
        'a motion storyboard',
        (value) => isRecord(value) && Array.isArray(value['scenes']),
      );
      return body as MotionStoryboard;
    },

    async putMotionStoryboard(slug: string, storyboard: MotionStoryboard): Promise<MotionStoryboard> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/motion/storyboard`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(storyboard),
        },
        'a motion storyboard',
        (value) => isRecord(value) && Array.isArray(value['scenes']),
      );
      return body as MotionStoryboard;
    },

    async getVoiceDirection(slug: string): Promise<VoiceDirectionDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/voice/direction`,
        undefined,
        'a voice direction document',
        isVoiceDirectionDocument,
      );
      return body as VoiceDirectionDocument;
    },

    async putVoiceDirection(
      slug: string,
      directions: VoiceScriptDirections,
    ): Promise<VoiceDirectionDocument> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/voice/direction`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ directions }),
        },
        'a voice direction document',
        isVoiceDirectionDocument,
      );
      return body as VoiceDirectionDocument;
    },

    async getMotionOverview(slug: string): Promise<MotionOverview> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/motion/overview`,
        undefined,
        'a motion overview',
        (value) => isRecord(value),
      );
      return body as MotionOverview;
    },

    async createMotionJob(slug: string, input: CreateMotionJobInput): Promise<MotionJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'motion', ...input }),
        },
        'a motion job document',
        (value) => isRecord(value),
      );
      const job = parseJob(body);
      if (job.kind !== 'motion') {
        throw responseShapeUnexpected(200, 'a motion job document');
      }
      return job;
    },

    async listBrands(): Promise<BrandSummary[]> {
      const body = await requestJson('/brands', undefined, 'a brand array', (value) =>
        Array.isArray(value),
      );
      return body as BrandSummary[];
    },

    async getBrand(id: string): Promise<BrandDetail> {
      const body = await requestJson(
        `/brands/${encodeURIComponent(id)}`,
        undefined,
        'a brand detail',
        isBrandDetail,
      );
      return body as BrandDetail;
    },

    async createBrand(input: CreateBrandInput): Promise<BrandDetail> {
      const body = await requestJson(
        '/brands',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        'a brand detail',
        isBrandDetail,
      );
      return body as BrandDetail;
    },

    async putBrand(id: string, manifest: BrandManifest): Promise<BrandDetail> {
      const body = await requestJson(
        `/brands/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(manifest),
        },
        'a brand detail',
        isBrandDetail,
      );
      return body as BrandDetail;
    },

    async deleteBrand(id: string): Promise<void> {
      const response = await send(`/brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        throw fromErrorResponse(response.status, await readJson(response));
      }
    },

    async uploadBrandFile(input: UploadBrandFileInput): Promise<{ path: string }> {
      const body = await requestJson(
        `/brands/${encodeURIComponent(input.id)}/files/${input.kind}/${encodeURIComponent(input.filename)}`,
        {
          method: 'PUT',
          headers: { 'content-type': input.contentType },
          body: input.body,
        },
        'a brand file path',
        (value) => isRecord(value) && typeof value['path'] === 'string',
      );
      return { path: (body as { path: string }).path };
    },

    async composeBrandPreview(id: string, input?: BrandPreviewInput): Promise<BrandPreview> {
      const body = await requestJson(
        `/brands/${encodeURIComponent(id)}/preview`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input ?? {}),
        },
        'a brand preview',
        (value) => isRecord(value) && typeof value['url'] === 'string',
      );
      return body as BrandPreview;
    },

    async addBrandGoogleFont(id: string, family: string): Promise<BrandDetail> {
      const body = await requestJson(
        `/brands/${encodeURIComponent(id)}/fonts`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ family }),
        },
        'a brand detail',
        isBrandDetail,
      );
      return body as BrandDetail;
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

    async retryJob(jobId: string): Promise<Job> {
      const body = await requestJson(
        `/jobs/${encodeURIComponent(jobId)}/retry`,
        { method: 'POST' },
        'a job document',
        (value) => isRecord(value),
      );
      return parseJob(body);
    },

    async getYouTubeIntegration(): Promise<YouTubeIntegration> {
      const body = await requestJson(
        '/integrations/youtube',
        undefined,
        'a youtube integration document',
        (value) => isRecord(value),
      );
      return parseYouTubeIntegration(body);
    },

    async putYouTubeClient(credentials: YouTubeClientCredentials): Promise<YouTubeIntegration> {
      const body = await requestJson(
        '/integrations/youtube/client',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(credentials),
        },
        'a youtube integration document',
        (value) => isRecord(value),
      );
      return parseYouTubeIntegration(body);
    },

    async connectYouTube(): Promise<YouTubeConnectStart> {
      const body = await requestJson(
        '/integrations/youtube/connect',
        { method: 'POST' },
        'a youtube connect document',
        (value) => isRecord(value),
      );
      return parseYouTubeConnectStart(body);
    },

    async disconnectYouTube(): Promise<void> {
      const response = await send('/integrations/youtube', { method: 'DELETE' });
      if (!response.ok) {
        throw fromErrorResponse(response.status, await readJson(response));
      }
    },

    async getYouTubePublishOptions(slug: string): Promise<YouTubePublishOptions> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/publish/youtube/options`,
        undefined,
        'a youtube publish options document',
        (value) => isRecord(value),
      );
      return parseYouTubePublishOptions(body);
    },

    async draftYouTubeMetadata(slug: string, file: string): Promise<YouTubeDraft> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/publish/youtube/draft`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ file }),
        },
        'a youtube metadata draft',
        (value) => isRecord(value),
      );
      return parseYouTubeDraft(body);
    },

    async createPublishJob(slug: string, input: YouTubePublishInput): Promise<PublishJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'publish', platform: 'youtube', ...input }),
        },
        'a publish job document',
        (value) => isRecord(value),
      );
      return parsePublishJob(body);
    },

    async getRenderReview(slug: string, file: string): Promise<ReviewReport | null> {
      try {
        const body = await requestJson(
          `/projects/${encodeURIComponent(slug)}/reviews?file=${encodeURIComponent(file)}`,
          undefined,
          'a render review document',
          (value) => isRecord(value),
        );
        return parseReviewReport(body);
      } catch (cause) {
        if (cause instanceof RenderApiError && cause.code === 'REVIEW_NOT_FOUND') {
          return null;
        }
        throw cause;
      }
    },

    async createReviewJob(slug: string, file: string): Promise<ReviewJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'review', file }),
        },
        'a review job document',
        (value) => isRecord(value),
      );
      return parseReviewJob(body);
    },

    async listReferences(slug: string): Promise<ReferenceSummary[]> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/references`,
        undefined,
        'a reference listing',
        (value) => isRecord(value),
      );
      return parseReferenceListing(body);
    },

    async getReference(slug: string, name: string): Promise<ReferenceBrief> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/references/${encodeURIComponent(name)}`,
        undefined,
        'a reference brief document',
        (value) => isRecord(value),
      );
      return parseReferenceBrief(body);
    },

    async createReferenceJob(slug: string, file: string): Promise<ReferenceJob> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'reference', file }),
        },
        'a reference job document',
        (value) => isRecord(value),
      );
      return parseReferenceJob(body);
    },

    async listPublications(slug: string): Promise<Publication[]> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/publications`,
        undefined,
        'a publication listing',
        (value) => Array.isArray(value),
      );
      return parsePublications(body);
    },
  };
}

export { RenderApiError };
