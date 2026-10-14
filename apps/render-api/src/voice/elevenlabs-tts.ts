import { createHash } from 'node:crypto';
import { join } from 'node:path/posix';

import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  ELEVENLABS_API_BASE_URL,
  ELEVENLABS_KEY_REQUIRED_HINT,
  elevenLabsFetch,
  elevenLabsKeyRejected,
  readElevenLabsBytes,
  readElevenLabsFailure,
} from './elevenlabs-api';
import type { ElevenLabsFailure } from './elevenlabs-api';
import { elevenLabsRawVoiceId } from './elevenlabs-voice';

export const ELEVENLABS_MODEL_ID = 'eleven_v4';
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
export const ELEVENLABS_DEFAULT_LANGUAGE_CODE = 'es';
export const ELEVENLABS_SIMILARITY_BOOST = 0.75;
export const ELEVENLABS_REQUEST_TIMEOUT_MS = 60_000;
export const ELEVENLABS_RETRY_DELAY_MS = 1_000;
export const ELEVENLABS_CACHE_REVISION = 'v1';
export const ELEVENLABS_WAV_SAMPLE_RATE = 22_050;
export const ELEVENLABS_WAV_CHANNELS = 1;

const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;
const STABILITY_NEUTRAL = 0.5;
const STABILITY_CALM = 0.7;
const STABILITY_LIVELY = 0.35;
const CALM_NOISE_SCALE_CEILING = 0.65;
const SERVER_ERROR_FLOOR = 500;
const TOO_MANY_REQUESTS = 429;
const UNAUTHORIZED = 401;
const PAYMENT_REQUIRED = 402;
const NOT_FOUND = 404;
const MAX_ATTEMPTS = 2;

export interface ElevenLabsSynthesisInput {
  readonly voiceId: string;
  readonly text: string;
  readonly outPath: string;
  readonly languageCode?: string;
  readonly lengthScale?: number;
  readonly noiseScale?: number;
  readonly trailingPauseMs?: number;
}

export interface ElevenLabsFilePorts {
  readonly exists: (path: string) => Promise<boolean>;
  readonly ensureDirectory: (path: string) => Promise<void>;
  readonly writeBytes: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly copy: (from: string, to: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
}

export interface ElevenLabsTtsPorts {
  readonly fetchRemote: FetchRemotePort;
  readonly readApiKey: () => Promise<string | null>;
  readonly cacheDirectory: string;
  readonly files: ElevenLabsFilePorts;
  readonly transcodeToWav: (inputPath: string, outPath: string) => Promise<void>;
  readonly appendSilence: (inputPath: string, outPath: string, silenceMs: number) => Promise<void>;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface ElevenLabsVoiceSettings {
  readonly stability: number;
  readonly speed: number;
}

export function elevenLabsSpeedFromLengthScale(lengthScale: number | undefined): number {
  const speed = 1 / (lengthScale ?? 1);
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)) * 1000) / 1000;
}

export function elevenLabsStabilityFromNoiseScale(noiseScale: number | undefined): number {
  if (noiseScale === undefined) {
    return STABILITY_NEUTRAL;
  }
  return noiseScale < CALM_NOISE_SCALE_CEILING ? STABILITY_CALM : STABILITY_LIVELY;
}

export function elevenLabsVoiceSettingsFor(input: ElevenLabsSynthesisInput): ElevenLabsVoiceSettings {
  return {
    stability: elevenLabsStabilityFromNoiseScale(input.noiseScale),
    speed: elevenLabsSpeedFromLengthScale(input.lengthScale),
  };
}

export function elevenLabsCacheKey(
  rawVoiceId: string,
  languageCode: string,
  text: string,
  settings: ElevenLabsVoiceSettings,
): string {
  return createHash('sha256')
    .update([rawVoiceId, ELEVENLABS_MODEL_ID, languageCode, text, settings.stability, settings.speed].join('|'))
    .digest('hex');
}

function failureHint(failure: ElevenLabsFailure, fallback: string): string {
  return failure.message ?? fallback;
}

function isQuotaFailure(httpStatus: number, failure: ElevenLabsFailure): boolean {
  return httpStatus === PAYMENT_REQUIRED || httpStatus === TOO_MANY_REQUESTS || failure.status === 'quota_exceeded';
}

function isUnknownVoice(httpStatus: number, failure: ElevenLabsFailure): boolean {
  return httpStatus === NOT_FOUND || failure.status === 'voice_not_found';
}

function translateFailure(httpStatus: number, failure: ElevenLabsFailure, voiceId: string): PipelineStageError {
  if (isQuotaFailure(httpStatus, failure)) {
    return new PipelineStageError({
      code: 'VOICE_ENGINE_QUOTA_EXCEEDED',
      stage: null,
      resource: voiceId,
      expected: 'ElevenLabs credits available',
      hint: failureHint(failure, 'ElevenLabs rechazó el pedido por cuota o límite de uso'),
    });
  }
  if (isUnknownVoice(httpStatus, failure)) {
    return new PipelineStageError({
      code: 'VOICE_ID_INVALID',
      stage: null,
      resource: voiceId,
      expected: 'a voice id that exists in the ElevenLabs account',
      hint: failureHint(failure, 'ElevenLabs no conoce esa voz'),
    });
  }
  if (httpStatus === UNAUTHORIZED) {
    return elevenLabsKeyRejected(voiceId);
  }
  return new PipelineStageError({
    code: 'VOICE_SYNTHESIS_FAILED',
    stage: 'synthesize',
    resource: voiceId,
    expected: 'ElevenLabs to return the synthesized audio',
    hint: failureHint(failure, `ElevenLabs respondió ${httpStatus}`),
  });
}

function isRetryable(httpStatus: number): boolean {
  return httpStatus === TOO_MANY_REQUESTS || httpStatus >= SERVER_ERROR_FLOOR;
}

async function requestSpeechAudio(
  ports: ElevenLabsTtsPorts,
  apiKey: string,
  voiceId: string,
  body: string,
): Promise<Uint8Array> {
  const url = `${ELEVENLABS_API_BASE_URL}/v1/text-to-speech/${encodeURIComponent(elevenLabsRawVoiceId(voiceId))}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;

  for (let attempt = 1; ; attempt += 1) {
    let response;
    try {
      response = await elevenLabsFetch(ports.fetchRemote, url, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body,
        timeoutMs: ELEVENLABS_REQUEST_TIMEOUT_MS,
      });
    } catch (cause) {
      throw new PipelineStageError({
        code: 'VOICE_SYNTHESIS_FAILED',
        stage: 'synthesize',
        resource: voiceId,
        expected: 'ElevenLabs to be reachable',
        hint: 'no se pudo contactar a ElevenLabs; revisá la conexión',
        cause,
      });
    }

    if (response.status >= 200 && response.status < 300) {
      return readElevenLabsBytes(response);
    }

    if (attempt < MAX_ATTEMPTS && isRetryable(response.status)) {
      await ports.sleep(ELEVENLABS_RETRY_DELAY_MS);
      continue;
    }

    throw translateFailure(response.status, await readElevenLabsFailure(response), voiceId);
  }
}

async function ensureCachedWav(
  ports: ElevenLabsTtsPorts,
  input: ElevenLabsSynthesisInput,
  languageCode: string,
  settings: ElevenLabsVoiceSettings,
): Promise<string> {
  const rawVoiceId = elevenLabsRawVoiceId(input.voiceId);
  const key = elevenLabsCacheKey(rawVoiceId, languageCode, input.text, settings);
  const cachedWavPath = join(ports.cacheDirectory, `${key}.${ELEVENLABS_CACHE_REVISION}.wav`);

  if (await ports.files.exists(cachedWavPath)) {
    return cachedWavPath;
  }

  const apiKey = await ports.readApiKey();
  if (apiKey === null) {
    throw new PipelineStageError({
      code: 'VOICE_ENGINE_NOT_CONFIGURED',
      stage: null,
      resource: input.voiceId,
      expected: 'an ElevenLabs API key stored in the keychain',
      hint: ELEVENLABS_KEY_REQUIRED_HINT,
    });
  }

  const body = JSON.stringify({
    text: input.text,
    model_id: ELEVENLABS_MODEL_ID,
    language_code: languageCode,
    voice_settings: {
      stability: settings.stability,
      similarity_boost: ELEVENLABS_SIMILARITY_BOOST,
      speed: settings.speed,
    },
  });
  const mp3 = await requestSpeechAudio(ports, apiKey, input.voiceId, body);

  await ports.files.ensureDirectory(ports.cacheDirectory);
  const mp3Path = join(ports.cacheDirectory, `${key}.part.mp3`);
  const partialWavPath = join(ports.cacheDirectory, `${key}.part.wav`);
  try {
    await ports.files.writeBytes(mp3Path, mp3);
    await ports.transcodeToWav(mp3Path, partialWavPath);
    await ports.files.rename(partialWavPath, cachedWavPath);
  } finally {
    await ports.files.remove(mp3Path);
    await ports.files.remove(partialWavPath);
  }
  return cachedWavPath;
}

export async function synthesizeWithElevenLabs(
  input: ElevenLabsSynthesisInput,
  ports: ElevenLabsTtsPorts,
): Promise<void> {
  const languageCode = input.languageCode ?? ELEVENLABS_DEFAULT_LANGUAGE_CODE;
  const cachedWavPath = await ensureCachedWav(ports, input, languageCode, elevenLabsVoiceSettingsFor(input));

  if ((input.trailingPauseMs ?? 0) > 0) {
    await ports.appendSilence(cachedWavPath, input.outPath, input.trailingPauseMs as number);
    return;
  }
  await ports.files.copy(cachedWavPath, input.outPath);
}
