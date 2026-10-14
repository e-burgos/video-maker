import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { FetchRemoteInit, FetchRemotePort, FetchRemoteResponse } from '../deps/render-api-dependencies';
import { collectBytes } from '../media-search/commons-shared';

export const ELEVENLABS_API_HOST = 'api.elevenlabs.io';
export const ELEVENLABS_API_BASE_URL = `https://${ELEVENLABS_API_HOST}`;
export const ELEVENLABS_SUBSCRIPTION_URL = `${ELEVENLABS_API_BASE_URL}/v1/user/subscription`;
export const ELEVENLABS_RESPONSE_LIMIT_BYTES = 64 * 1024 * 1024;

export const ELEVENLABS_KEY_REQUIRED_HINT = 'cargá la key de ElevenLabs en Configuración › Voces';
export const ELEVENLABS_KEY_REJECTED_HINT = 'la key de ElevenLabs no es válida; cargá una nueva en Configuración › Voces';

export function assertElevenLabsUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' || parsed.hostname !== ELEVENLABS_API_HOST) {
    throw new Error(`Outbound request to ${parsed.hostname} is not allowed for the ElevenLabs voice engine.`);
  }
}

export async function elevenLabsFetch(
  fetchRemote: FetchRemotePort,
  url: string,
  init: FetchRemoteInit,
): Promise<FetchRemoteResponse> {
  assertElevenLabsUrl(url);
  return fetchRemote(url, init);
}

export async function readElevenLabsBytes(response: FetchRemoteResponse): Promise<Uint8Array> {
  return collectBytes(response.body(), ELEVENLABS_RESPONSE_LIMIT_BYTES, 'ElevenLabs');
}

export interface ElevenLabsFailure {
  readonly status: string | null;
  readonly message: string | null;
}

export async function readElevenLabsFailure(response: FetchRemoteResponse): Promise<ElevenLabsFailure> {
  try {
    const text = new TextDecoder().decode(await readElevenLabsBytes(response));
    const parsed: unknown = JSON.parse(text);
    const detail = (parsed as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') {
      return { status: null, message: detail };
    }
    if (typeof detail === 'object' && detail !== null) {
      const { status, message } = detail as { status?: unknown; message?: unknown };
      return {
        status: typeof status === 'string' ? status : null,
        message: typeof message === 'string' ? message : null,
      };
    }
  } catch {
    return { status: null, message: null };
  }
  return { status: null, message: null };
}

export function elevenLabsKeyRejected(resource: string | null): PipelineStageError {
  return new PipelineStageError({
    code: 'VOICE_ENGINE_NOT_CONFIGURED',
    stage: null,
    resource,
    expected: 'a valid ElevenLabs API key',
    hint: ELEVENLABS_KEY_REJECTED_HINT,
  });
}
