import { STUDIO_TOOL_ERROR_CODES } from '../contract/tool-errors';
import type { StudioToolErrorCode } from '../contract/tool-errors';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import type {
  RenderApiAssetEntry,
  RenderApiClient,
  RenderApiExtractedFrame,
  RenderApiFileBytes,
  RenderApiJob,
  RenderApiJobSummary,
  RenderApiMusicResult,
  RenderApiProbeResult,
  RenderApiProjectDetail,
  RenderApiVoice,
} from './render-api-client';

export const DEFAULT_HTTP_RENDER_API_CLIENT_TIMEOUT_MS = 30_000;
export const STUDIO_TOKEN_HEADER = 'x-studio-token';
const PRODUCER_SCRIPT_PATH = 'work/producer/script.txt';
const TIME_MARK_PATTERN = /^\s*\[\d{1,2}:\d{2}/mu;
const ABSOLUTE_PATH_PATTERN = /\/(?:Users|home|var|tmp|private)\/[^\s'"]+/gu;

export interface HttpRenderApiClientOptions {
  readonly apiUrl: string;
  readonly slug: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly accessToken?: string;
}

function isKnownStudioErrorCode(code: string): code is StudioToolErrorCode {
  return (STUDIO_TOOL_ERROR_CODES as readonly string[]).includes(code);
}

type ErrorContext = 'start-job' | 'default';

function mapRenderApiErrorCode(code: string, context: ErrorContext): StudioToolErrorCode {
  if (isKnownStudioErrorCode(code)) {
    return code;
  }
  if (code === 'TIMELINE_NOT_FOUND') {
    return 'FILE_NOT_FOUND';
  }
  if (code === 'RENDER_JOB_NOT_FOUND') {
    return 'JOB_NOT_FOUND';
  }
  if (code === 'RENDER_JOB_NOT_CANCELABLE') {
    return 'JOB_REJECTED';
  }
  return context === 'start-job' ? 'JOB_REJECTED' : 'STUDIO_UNAVAILABLE';
}

function redactAbsolutePaths(text: string): string {
  return text.replace(ABSOLUTE_PATH_PATTERN, '<path>');
}

interface RenderApiErrorPayloadShape {
  readonly code?: unknown;
  readonly hint?: unknown;
  readonly message?: unknown;
}

function extractErrorPayload(body: unknown): RenderApiErrorPayloadShape | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const error = (body as Record<string, unknown>).error;
  return typeof error === 'object' && error !== null ? (error as RenderApiErrorPayloadShape) : null;
}

function joinProjectPath(basePath: string): string {
  return basePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function createHttpRenderApiClient(options: HttpRenderApiClientOptions): RenderApiClient {
  const apiUrl = options.apiUrl.replace(/\/$/u, '');
  const slug = options.slug;
  const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_RENDER_API_CLIENT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken;

  function requestHeaders(hasBody: boolean): Readonly<Record<string, string>> | undefined {
    const headers: Record<string, string> = {};
    if (hasBody) {
      headers['content-type'] = 'application/json';
    }
    if (accessToken !== undefined) {
      headers[STUDIO_TOKEN_HEADER] = accessToken;
    }
    return Object.keys(headers).length === 0 ? undefined : headers;
  }

  async function raw(
    method: string,
    path: string,
    body: unknown,
    context: ErrorContext,
  ): Promise<{ readonly response: Response; readonly json: unknown }> {
    let response: Response;
    try {
      const headers = requestHeaders(body !== undefined);
      response = await fetchImpl(`${apiUrl}${path}`, {
        method,
        ...(headers === undefined ? {} : { headers }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new StudioToolRuntimeError('STUDIO_UNAVAILABLE', 'could not reach the render API');
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const payload = extractErrorPayload(json);
      const code = mapRenderApiErrorCode(typeof payload?.code === 'string' ? payload.code : 'UNKNOWN', context);
      const rawHint =
        (typeof payload?.hint === 'string' ? payload.hint : undefined) ??
        (typeof payload?.message === 'string' ? payload.message : undefined) ??
        `render API answered ${response.status}`;
      throw new StudioToolRuntimeError(code, redactAbsolutePaths(rawHint));
    }

    return { response, json };
  }

  async function request(method: string, path: string, body?: unknown, context: ErrorContext = 'default'): Promise<unknown> {
    const { json } = await raw(method, path, body, context);
    return json;
  }

  return {
    getProjectDetail: async () => (await request('GET', `/projects/${slug}`)) as RenderApiProjectDetail,

    listProjectAssets: async () => {
      const json = (await request('GET', `/projects/${slug}/assets`)) as { assets: readonly RenderApiAssetEntry[] };
      return json.assets;
    },

    listRecentJobs: async (limit) => {
      const json = (await request('GET', `/projects/${slug}/jobs`)) as { jobs: readonly RenderApiJobSummary[] };
      return [...json.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },

    readProducerScriptState: async () => {
      try {
        const { json } = await raw(
          'GET',
          `/projects/${slug}/text?path=${encodeURIComponent(PRODUCER_SCRIPT_PATH)}`,
          undefined,
          'default',
        );
        const content = (json as { content: string }).content;
        return TIME_MARK_PATTERN.test(content) ? 'timed' : 'plain';
      } catch (cause) {
        if (cause instanceof StudioToolRuntimeError && cause.code === 'FILE_NOT_FOUND') {
          return 'none';
        }
        throw cause;
      }
    },

    probeMedia: async (path) => (await request('POST', `/projects/${slug}/probe`, { path })) as RenderApiProbeResult,

    extractFrames: async (path, atSeconds) => {
      const json = (await request('POST', `/projects/${slug}/frames`, { path, atSeconds })) as {
        frames: readonly RenderApiExtractedFrame[];
      };
      return json.frames;
    },

    readFileBytes: async (path): Promise<RenderApiFileBytes> => {
      let response: Response;
      try {
        const headers = requestHeaders(false);
        response = await fetchImpl(`${apiUrl}/projects/${slug}/files/${joinProjectPath(path)}`, {
          method: 'GET',
          ...(headers === undefined ? {} : { headers }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new StudioToolRuntimeError('STUDIO_UNAVAILABLE', 'could not reach the render API');
      }

      if (!response.ok) {
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        const errorPayload = extractErrorPayload(payload);
        const code = mapRenderApiErrorCode(typeof errorPayload?.code === 'string' ? errorPayload.code : 'UNKNOWN', 'default');
        const rawHint =
          (typeof errorPayload?.hint === 'string' ? errorPayload.hint : undefined) ??
          (typeof errorPayload?.message === 'string' ? errorPayload.message : undefined) ??
          `render API answered ${response.status}`;
        throw new StudioToolRuntimeError(code, redactAbsolutePaths(rawHint));
      }

      const arrayBuffer = await response.arrayBuffer();
      return { bytes: new Uint8Array(arrayBuffer), mimeType: response.headers.get('content-type') ?? 'application/octet-stream' };
    },

    readProjectText: async (path) =>
      (await request('GET', `/projects/${slug}/text?path=${encodeURIComponent(path)}`)) as {
        path: string;
        content: string;
      },

    writeProjectText: async (path, content) =>
      (await request('PUT', `/projects/${slug}/text`, { path, content })) as { path: string; bytes: number },

    copyAsset: async (from, role, filename) =>
      (await request('POST', `/projects/${slug}/assets/copy`, { from, role, filename })) as { path: string },

    listVoices: async () => {
      const json = (await request('GET', '/voices')) as { voices: readonly RenderApiVoice[] };
      const defaultVoice = json.voices.find((voice) => voice.isDefault) ?? json.voices[0];
      return { voices: json.voices, defaultVoiceId: defaultVoice?.id ?? '' };
    },

    createJob: async (body) => (await request('POST', `/projects/${slug}/jobs`, body, 'start-job')) as RenderApiJob,

    getJob: async (jobId) => (await request('GET', `/jobs/${encodeURIComponent(jobId)}`)) as RenderApiJob,

    cancelJob: async (jobId) => (await request('DELETE', `/jobs/${encodeURIComponent(jobId)}`)) as RenderApiJob,

    getTimeline: async () => request('GET', `/projects/${slug}/timeline`),

    putTimeline: async (timeline) => {
      await request('PUT', `/projects/${slug}/timeline`, timeline);
    },

    searchFreeMusic: async (mood, maxResults) => {
      const json = (await request(
        'GET',
        `/projects/${slug}/music/search?mood=${encodeURIComponent(mood)}&maxResults=${maxResults}`,
      )) as { results: readonly RenderApiMusicResult[] };
      return json.results;
    },

    importMusic: async (resultId) =>
      (await request('POST', `/projects/${slug}/music/import`, { resultId })) as {
        path: string;
        credit: Record<string, unknown>;
      },
  };
}
