import type { Timeline } from '@video-maker/timeline-core';
import { RENDER_API_BASE_PATH } from './artifact-url';
import { parseRenderJob, parseRenderJobListing } from './parse-render-job';
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
  ProjectDetail,
  ProjectSummary,
  RenderJob,
  RenderJobListing,
  ServiceHealth,
  TimelineWriteResult,
} from './render-api-types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RenderJobCancelOutcome = { status: 200 | 202; job: RenderJob };

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
  listRenderJobs: (slug: string) => Promise<RenderJobListing>;
  getRenderJob: (jobId: string) => Promise<RenderJob>;
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

    async listRenderJobs(slug: string): Promise<RenderJobListing> {
      const body = await requestJson(
        `/projects/${encodeURIComponent(slug)}/jobs`,
        undefined,
        'a render job listing',
        (value) => isRecord(value) && Array.isArray(value['jobs']),
      );
      return parseRenderJobListing(body);
    },

    async getRenderJob(jobId: string): Promise<RenderJob> {
      const body = await requestJson(
        `/jobs/${encodeURIComponent(jobId)}`,
        undefined,
        'a render job document',
        (value) => isRecord(value),
      );
      return parseRenderJob(body);
    },

    async cancelRenderJob(jobId: string): Promise<RenderJobCancelOutcome> {
      const { status, body } = await requestJsonWithStatus(
        `/jobs/${encodeURIComponent(jobId)}`,
        { method: 'DELETE' },
        'a render job document',
        (value) => isRecord(value),
      );
      return { status: status as 200 | 202, job: parseRenderJob(body) };
    },
  };
}

export { RenderApiError };
