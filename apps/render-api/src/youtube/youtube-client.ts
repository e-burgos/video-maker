import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { GoogleNetworkError, googleRequest, parseJsonObject } from './google-request';
import type { GoogleRequest, GoogleResponse } from './google-request';
import { youtubeApiError, youtubeNetworkError } from './youtube-api-error';
import {
  GOOGLE_API_TIMEOUT_MS,
  GOOGLE_UPLOAD_CHUNK_TIMEOUT_MS,
  YOUTUBE_API_URL,
  YOUTUBE_UPLOAD_API_URL,
} from './youtube-constants';
import type { YoutubeOAuth } from './youtube-oauth';

const PLAYLIST_PAGE_SIZE = 50;
const PLAYLIST_MAX_PAGES = 5;
const VIDEO_CONTENT_TYPE = 'video/mp4';
const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';
const TRANSIENT_STATUSES: readonly number[] = [500, 502, 503, 504];
const SESSION_GONE_STATUSES: readonly number[] = [404, 410];
const RANGE_HEADER_PATTERN = /^bytes=0-(\d+)$/u;

export interface YoutubePlaylist {
  readonly id: string;
  readonly title: string;
}

export interface YoutubeVideoMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly categoryId: string;
  readonly defaultLanguage: string;
  readonly privacyStatus: 'public' | 'unlisted' | 'private';
  readonly publishAt: string | null;
  readonly madeForKids: boolean;
}

export type UploadProgress =
  | { readonly kind: 'complete'; readonly videoId: string }
  | { readonly kind: 'incomplete'; readonly nextOffset: number }
  | { readonly kind: 'transient' }
  | { readonly kind: 'session-gone' };

export interface YoutubeClient {
  readonly listPlaylists: () => Promise<readonly YoutubePlaylist[]>;
  readonly initiateUpload: (metadata: YoutubeVideoMetadata, sizeBytes: number) => Promise<string>;
  readonly uploadChunk: (sessionUri: string, bytes: Uint8Array, offset: number, totalBytes: number) => Promise<UploadProgress>;
  readonly queryUploadStatus: (sessionUri: string, totalBytes: number) => Promise<UploadProgress>;
  readonly setThumbnail: (videoId: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  readonly addToPlaylist: (playlistId: string, videoId: string) => Promise<void>;
}

function videoResource(metadata: YoutubeVideoMetadata): unknown {
  return {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: metadata.categoryId,
      defaultLanguage: metadata.defaultLanguage,
      defaultAudioLanguage: metadata.defaultLanguage,
    },
    status: {
      privacyStatus: metadata.privacyStatus,
      selfDeclaredMadeForKids: metadata.madeForKids,
      ...(metadata.publishAt === null ? {} : { publishAt: metadata.publishAt }),
    },
  };
}

function videoIdOf(text: string): string | null {
  const id = parseJsonObject(text)?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}

function progressFrom(response: GoogleResponse, text: string): UploadProgress {
  if (response.status === 200 || response.status === 201) {
    const videoId = videoIdOf(text);
    if (videoId === null) {
      throw new PipelineStageError({
        code: 'YOUTUBE_UPLOAD_FAILED',
        stage: null,
        resource: 'youtube',
        hint: 'YouTube finished the upload but did not return a video id',
      });
    }
    return { kind: 'complete', videoId };
  }
  if (response.status === 308) {
    const match = RANGE_HEADER_PATTERN.exec(response.headers.range ?? '');
    return { kind: 'incomplete', nextOffset: match?.[1] === undefined ? 0 : Number(match[1]) + 1 };
  }
  if (TRANSIENT_STATUSES.includes(response.status)) {
    return { kind: 'transient' };
  }
  if (SESSION_GONE_STATUSES.includes(response.status)) {
    return { kind: 'session-gone' };
  }
  throw youtubeApiError(response.status, text);
}

export function createYoutubeClient(deps: RenderApiDependencies, oauth: YoutubeOAuth): YoutubeClient {
  async function authorized(build: (accessToken: string) => GoogleRequest): Promise<{ response: GoogleResponse; text: string }> {
    for (let attempt = 0; ; attempt += 1) {
      const token = await oauth.accessToken();
      try {
        const response = await googleRequest(deps, build(token));
        const text = await response.text();
        if (response.status === 401 && attempt === 0) {
          oauth.invalidateAccessToken();
          continue;
        }
        return { response, text };
      } catch (cause) {
        throw cause instanceof GoogleNetworkError ? youtubeNetworkError(cause) : cause;
      }
    }
  }

  async function expectOk(result: { response: GoogleResponse; text: string }): Promise<string> {
    if (result.response.status < 200 || result.response.status > 299) {
      throw youtubeApiError(result.response.status, result.text);
    }
    return result.text;
  }

  async function listPlaylists(): Promise<readonly YoutubePlaylist[]> {
    const playlists: YoutubePlaylist[] = [];
    let pageToken: string | null = null;
    for (let page = 0; page < PLAYLIST_MAX_PAGES; page += 1) {
      const suffix: string = pageToken === null ? '' : `&pageToken=${encodeURIComponent(pageToken)}`;
      const text = await expectOk(
        await authorized((token) => ({
          url: `${YOUTUBE_API_URL}/playlists?part=snippet&mine=true&maxResults=${String(PLAYLIST_PAGE_SIZE)}${suffix}`,
          headers: { authorization: `Bearer ${token}` },
          timeoutMs: GOOGLE_API_TIMEOUT_MS,
        })),
      );
      const body = parseJsonObject(text);
      for (const item of Array.isArray(body?.items) ? (body.items as unknown[]) : []) {
        const record = item as { id?: unknown; snippet?: { title?: unknown } };
        if (typeof record.id === 'string' && typeof record.snippet?.title === 'string') {
          playlists.push({ id: record.id, title: record.snippet.title });
        }
      }
      pageToken = typeof body?.nextPageToken === 'string' ? body.nextPageToken : null;
      if (pageToken === null) {
        break;
      }
    }
    return playlists;
  }

  async function initiateUpload(metadata: YoutubeVideoMetadata, sizeBytes: number): Promise<string> {
    const result = await authorized((token) => ({
      url: `${YOUTUBE_UPLOAD_API_URL}/videos?uploadType=resumable&part=snippet,status`,
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': JSON_CONTENT_TYPE,
        'x-upload-content-length': String(sizeBytes),
        'x-upload-content-type': VIDEO_CONTENT_TYPE,
      },
      body: JSON.stringify(videoResource(metadata)),
      timeoutMs: GOOGLE_API_TIMEOUT_MS,
    }));
    await expectOk(result);
    const location = result.response.headers.location;
    if (location === undefined || location === '') {
      throw new PipelineStageError({
        code: 'YOUTUBE_UPLOAD_FAILED',
        stage: null,
        resource: 'youtube',
        hint: 'YouTube did not return an upload session',
      });
    }
    return location;
  }

  async function sendToSession(sessionUri: string, headers: Readonly<Record<string, string>>, body: Uint8Array): Promise<UploadProgress> {
    try {
      const response = await googleRequest(deps, {
        url: sessionUri,
        method: 'PUT',
        headers,
        body,
        timeoutMs: GOOGLE_UPLOAD_CHUNK_TIMEOUT_MS,
      });
      return progressFrom(response, await response.text());
    } catch (cause) {
      if (cause instanceof GoogleNetworkError) {
        return { kind: 'transient' };
      }
      throw cause;
    }
  }

  async function uploadChunk(sessionUri: string, bytes: Uint8Array, offset: number, totalBytes: number): Promise<UploadProgress> {
    const last = offset + bytes.length - 1;
    return sendToSession(
      sessionUri,
      { 'content-type': VIDEO_CONTENT_TYPE, 'content-range': `bytes ${String(offset)}-${String(last)}/${String(totalBytes)}` },
      bytes,
    );
  }

  async function queryUploadStatus(sessionUri: string, totalBytes: number): Promise<UploadProgress> {
    return sendToSession(
      sessionUri,
      { 'content-range': `bytes */${String(totalBytes)}` },
      new Uint8Array(0),
    );
  }

  async function setThumbnail(videoId: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await expectOk(
      await authorized((token) => ({
        url: `${YOUTUBE_UPLOAD_API_URL}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
        body: bytes,
        timeoutMs: GOOGLE_UPLOAD_CHUNK_TIMEOUT_MS,
      })),
    );
  }

  async function addToPlaylist(playlistId: string, videoId: string): Promise<void> {
    await expectOk(
      await authorized((token) => ({
        url: `${YOUTUBE_API_URL}/playlistItems?part=snippet`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': JSON_CONTENT_TYPE },
        body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
        timeoutMs: GOOGLE_API_TIMEOUT_MS,
      })),
    );
  }

  return { listPlaylists, initiateUpload, uploadChunk, queryUploadStatus, setThumbnail, addToPlaylist };
}
