import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import {
  ELEVENLABS_SUBSCRIPTION_URL,
  elevenLabsFetch,
  elevenLabsKeyRejected,
  readElevenLabsFailure,
} from '../../voice/elevenlabs-api';
import {
  ELEVENLABS_SECRET_NAME,
  ELEVENLABS_VOICES_SETTING_KEY,
  isElevenLabsKeyConfigured,
  normalizeElevenLabsVoiceId,
  readConfiguredElevenLabsVoices,
} from '../../voice/elevenlabs-voice';
import type { ElevenLabsVoiceOption } from '../../voice/elevenlabs-voice';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';

const ELEVENLABS_VERIFY_TIMEOUT_MS = 10_000;
const MAX_CONFIGURED_VOICES = 50;

export interface ElevenLabsSettingsBody {
  readonly keyConfigured: boolean;
  readonly voices: readonly ElevenLabsVoiceOption[];
}

export interface ElevenLabsKeyBody {
  readonly keyConfigured: true;
  readonly tier: string | null;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

async function buildSettingsBody(deps: RenderApiDependencies): Promise<ElevenLabsSettingsBody> {
  return {
    keyConfigured: await isElevenLabsKeyConfigured(deps),
    voices: readConfiguredElevenLabsVoices(deps).map(({ id, label, description }) => ({ id, label, description })),
  };
}

export async function handleGetElevenLabsSettings(deps: RenderApiDependencies): Promise<HttpResponse> {
  return jsonResponse(200, await buildSettingsBody(deps));
}

function assertKey(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidInput('key', 'a non-empty ElevenLabs API key');
  }
  return value.trim();
}

async function verifyKeyAndReadTier(deps: RenderApiDependencies, key: string): Promise<string | null> {
  let response;
  try {
    response = await elevenLabsFetch(deps.fetchRemote, ELEVENLABS_SUBSCRIPTION_URL, {
      headers: { 'xi-api-key': key },
      timeoutMs: ELEVENLABS_VERIFY_TIMEOUT_MS,
    });
  } catch (cause) {
    throw new PipelineStageError({
      code: 'VOICE_ENGINE_NOT_CONFIGURED',
      stage: null,
      resource: 'key',
      expected: 'ElevenLabs to be reachable to verify the key',
      hint: 'no se pudo contactar a ElevenLabs para validar la key; revisá la conexión y reintentá',
      cause,
    });
  }

  if (response.status === 401) {
    throw elevenLabsKeyRejected('key');
  }
  if (response.status < 200 || response.status >= 300) {
    const failure = await readElevenLabsFailure(response);
    throw new PipelineStageError({
      code: 'VOICE_ENGINE_NOT_CONFIGURED',
      stage: null,
      resource: 'key',
      expected: 'a key ElevenLabs accepts',
      hint: failure.message ?? `ElevenLabs respondió ${response.status} al validar la key`,
    });
  }

  try {
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body()) {
      chunks.push(chunk);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const tier = (parsed as { tier?: unknown } | null)?.tier;
    return typeof tier === 'string' ? tier : null;
  } catch {
    return null;
  }
}

export async function handlePutElevenLabsKey(
  deps: RenderApiDependencies,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const key = assertKey((await readJsonObjectBody(request)).key);
  const tier = await verifyKeyAndReadTier(deps, key);
  await deps.secretStore.set(ELEVENLABS_SECRET_NAME, key);

  const body: ElevenLabsKeyBody = { keyConfigured: true, tier };
  return jsonResponse(200, body);
}

export async function handleDeleteElevenLabsKey(deps: RenderApiDependencies): Promise<HttpResponse> {
  await deps.secretStore.delete(ELEVENLABS_SECRET_NAME);
  return jsonResponse(200, { keyConfigured: false });
}

function parseVoiceEntry(value: unknown, position: number): ElevenLabsVoiceOption {
  const resource = `voices[${position}]`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidInput(resource, 'an object with id, label and optional description');
  }
  const { id, label, description } = value as Record<string, unknown>;
  if (typeof id !== 'string' || id.trim() === '' || id.trim() === 'elevenlabs:') {
    throw invalidInput(`${resource}.id`, 'a non-empty ElevenLabs voice id');
  }
  if (typeof label !== 'string' || label.trim() === '') {
    throw invalidInput(`${resource}.label`, 'a non-empty label');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw invalidInput(`${resource}.description`, 'a string');
  }
  return {
    id: normalizeElevenLabsVoiceId(id),
    label: label.trim(),
    description: typeof description === 'string' ? description.trim() : '',
  };
}

export async function handlePutElevenLabsVoices(
  deps: RenderApiDependencies,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const { voices } = await readJsonObjectBody(request);
  if (!Array.isArray(voices) || voices.length > MAX_CONFIGURED_VOICES) {
    throw invalidInput('voices', `an array of up to ${MAX_CONFIGURED_VOICES} voices`);
  }

  const parsed = voices.map(parseVoiceEntry);
  const uniqueIds = new Set(parsed.map((voice) => voice.id));
  if (uniqueIds.size !== parsed.length) {
    throw invalidInput('voices', 'voices with distinct ids');
  }

  deps.localStore.settings.set(ELEVENLABS_VOICES_SETTING_KEY, parsed);
  return jsonResponse(200, await buildSettingsBody(deps));
}
