import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';
import type { YoutubePrivacyStatus } from '../../youtube/youtube-client';

const CLIENT_FIELD_MAX_LENGTH = 512;
const PLAYLIST_TITLE_MAX_LENGTH = 150;
const PLAYLIST_DESCRIPTION_MAX_LENGTH = 5000;
const PLAYLIST_PRIVACY_STATUSES: readonly YoutubePrivacyStatus[] = ['public', 'unlisted', 'private'];

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function clientField(value: unknown, resource: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || text.length > CLIENT_FIELD_MAX_LENGTH) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource,
      expected: `a non-empty string of at most ${String(CLIENT_FIELD_MAX_LENGTH)} characters`,
    });
  }
  return text;
}

export async function handleGetYoutubeIntegration(runtime: RenderApiRuntime): Promise<HttpResponse> {
  return jsonResponse(200, await runtime.youtube.oauth.status());
}

export async function handlePutYoutubeClient(
  runtime: RenderApiRuntime,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const status = await runtime.youtube.oauth.saveClient(
    clientField(body.clientId, 'clientId'),
    clientField(body.clientSecret, 'clientSecret'),
  );
  return jsonResponse(200, status);
}

export async function handleConnectYoutube(runtime: RenderApiRuntime): Promise<HttpResponse> {
  return jsonResponse(200, await runtime.youtube.oauth.startConnect());
}

export async function handleDisconnectYoutube(runtime: RenderApiRuntime): Promise<HttpResponse> {
  await runtime.youtube.oauth.disconnect();
  return { status: 204, headers: {}, body: undefined };
}

function playlistTitle(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || text.length > PLAYLIST_TITLE_MAX_LENGTH) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'title',
      expected: `a non-empty string of at most ${String(PLAYLIST_TITLE_MAX_LENGTH)} characters`,
    });
  }
  return text;
}

function playlistDescription(value: unknown): string {
  const text = value === undefined ? '' : value;
  if (typeof text !== 'string' || text.length > PLAYLIST_DESCRIPTION_MAX_LENGTH) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'description',
      expected: `a string of at most ${String(PLAYLIST_DESCRIPTION_MAX_LENGTH)} characters`,
    });
  }
  return text;
}

function playlistPrivacy(value: unknown): YoutubePrivacyStatus {
  const privacy = value === undefined ? 'private' : value;
  if (!PLAYLIST_PRIVACY_STATUSES.includes(privacy as YoutubePrivacyStatus)) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'privacy',
      expected: PLAYLIST_PRIVACY_STATUSES.join(' | '),
    });
  }
  return privacy as YoutubePrivacyStatus;
}

function youtubeVideoId(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{6,20}$/u.test(text)) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'videoId',
      expected: 'a YouTube video id',
    });
  }
  return text;
}

export async function handleListYoutubePlaylists(runtime: RenderApiRuntime): Promise<HttpResponse> {
  return jsonResponse(200, { playlists: await runtime.youtube.client.listPlaylists() });
}

export async function handleCreateYoutubePlaylist(
  runtime: RenderApiRuntime,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const playlist = await runtime.youtube.client.createPlaylist({
    title: playlistTitle(body.title),
    description: playlistDescription(body.description),
    privacyStatus: playlistPrivacy(body.privacy),
  });
  return jsonResponse(201, playlist);
}

export async function handleAddVideoToYoutubePlaylist(
  runtime: RenderApiRuntime,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const playlistId = params.playlistId ?? '';
  const videoId = youtubeVideoId(body.videoId);
  await runtime.youtube.client.addToPlaylist(playlistId, videoId);
  return jsonResponse(201, { playlistId, videoId });
}
