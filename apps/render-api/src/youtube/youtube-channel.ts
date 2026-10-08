import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { GoogleNetworkError, googleRequest, parseJsonObject } from './google-request';
import { youtubeApiError, youtubeNetworkError } from './youtube-api-error';
import { GOOGLE_API_TIMEOUT_MS, YOUTUBE_API_URL } from './youtube-constants';

export interface YoutubeChannel {
  readonly id: string;
  readonly title: string;
  readonly thumbnailUrl: string | null;
}

function bearer(accessToken: string): Readonly<Record<string, string>> {
  return { authorization: `Bearer ${accessToken}` };
}

function toChannel(item: unknown): YoutubeChannel | null {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const record = item as { id?: unknown; snippet?: { title?: unknown; thumbnails?: { default?: { url?: unknown } } } };
  if (typeof record.id !== 'string') {
    return null;
  }
  const thumbnail = record.snippet?.thumbnails?.default?.url;
  return {
    id: record.id,
    title: typeof record.snippet?.title === 'string' ? record.snippet.title : record.id,
    thumbnailUrl: typeof thumbnail === 'string' ? thumbnail : null,
  };
}

export async function fetchOwnChannel(deps: RenderApiDependencies, accessToken: string): Promise<YoutubeChannel> {
  try {
    const response = await googleRequest(deps, {
      url: `${YOUTUBE_API_URL}/channels?part=snippet&mine=true`,
      headers: bearer(accessToken),
      timeoutMs: GOOGLE_API_TIMEOUT_MS,
    });
    const text = await response.text();
    if (response.status !== 200) {
      throw youtubeApiError(response.status, text);
    }
    const items = parseJsonObject(text)?.items;
    const channel = Array.isArray(items) ? toChannel(items[0]) : null;
    if (channel === null) {
      throw new PipelineStageError({
        code: 'YOUTUBE_UPLOAD_FAILED',
        stage: null,
        resource: 'youtube',
        hint: 'the Google account has no YouTube channel, create one at youtube.com and connect again',
      });
    }
    return channel;
  } catch (cause) {
    throw cause instanceof GoogleNetworkError ? youtubeNetworkError(cause) : cause;
  }
}
