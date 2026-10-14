import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteRoute } from '../__fixtures__/fake-fetch-remote';
import { toErrorPayload } from '../errors/to-error-payload';
import {
  elevenLabsCacheKey,
  elevenLabsSpeedFromLengthScale,
  elevenLabsStabilityFromNoiseScale,
  synthesizeWithElevenLabs,
} from './elevenlabs-tts';
import type { ElevenLabsFilePorts, ElevenLabsTtsPorts } from './elevenlabs-tts';

const API_KEY = 'test-key-not-real';
const MP3 = new Uint8Array([1, 2, 3]);

function createFiles(initial: readonly string[] = []) {
  const existing = new Set(initial);
  const log: string[] = [];
  const files: ElevenLabsFilePorts = {
    exists: async (path) => existing.has(path),
    ensureDirectory: async () => undefined,
    writeBytes: async (path) => {
      existing.add(path);
      log.push(`write ${path}`);
    },
    rename: async (from, to) => {
      existing.delete(from);
      existing.add(to);
      log.push(`rename ${to}`);
    },
    copy: async (from, to) => {
      log.push(`copy ${from} -> ${to}`);
    },
    remove: async (path) => {
      existing.delete(path);
    },
  };
  return { files, existing, log };
}

function createPorts(routes: readonly FakeFetchRemoteRoute[], options: { key?: string | null; initial?: readonly string[] } = {}) {
  const fake = createFakeFetchRemote((_call, index) => routes[Math.min(index, routes.length - 1)] as FakeFetchRemoteRoute);
  const fileState = createFiles(options.initial);
  const silences: Array<{ from: string; to: string; ms: number }> = [];
  const transcodes: string[] = [];
  const ports: ElevenLabsTtsPorts = {
    fetchRemote: fake.fetchRemote,
    readApiKey: async () => (options.key === undefined ? API_KEY : options.key),
    cacheDirectory: '/cache',
    files: fileState.files,
    transcodeToWav: async (_input, out) => {
      transcodes.push(out);
      fileState.existing.add(out);
    },
    appendSilence: async (from, to, ms) => {
      silences.push({ from, to, ms });
    },
    sleep: async () => undefined,
  };
  return { ports, fake, fileState, silences, transcodes };
}

const OK: FakeFetchRemoteRoute = { status: 200, bodyChunks: [MP3] };

async function errorPayloadOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('synthesizeWithElevenLabs', () => {
  it('posts the exact request to the ElevenLabs text-to-speech endpoint', async () => {
    const { ports, fake } = createPorts([OK]);

    await synthesizeWithElevenLabs(
      { voiceId: 'elevenlabs:abc123', text: 'Hola mundo', outPath: '/out.wav', languageCode: 'es', lengthScale: 1.25, noiseScale: 0.8 },
      ports,
    );

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0];
    expect(call?.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=mp3_44100_128');
    expect(call?.init.method).toBe('POST');
    expect(Object.keys(call?.init.headers ?? {}).sort()).toEqual(['accept', 'content-type', 'xi-api-key']);
    expect(call?.init.headers?.['xi-api-key']).toBe(API_KEY);
    expect(call?.init.timeoutMs).toBe(60_000);
    expect(JSON.parse(call?.init.body as string)).toEqual({
      text: 'Hola mundo',
      model_id: 'eleven_v4',
      language_code: 'es',
      voice_settings: { stability: 0.35, similarity_boost: 0.75, speed: 0.8 },
    });
  });

  it('defaults the language to es and copies the cached wav to the output when there is no trailing pause', async () => {
    const { ports, fake, fileState } = createPorts([OK]);

    await synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports);

    expect(JSON.parse(fake.calls[0]?.init.body as string).language_code).toBe('es');
    expect(fileState.log.at(-1)).toMatch(/^copy \/cache\/[0-9a-f]{64}\.v1\.wav -> \/out\.wav$/u);
  });

  it('appends the trailing silence with the same helper contract when pauseAfterMs is set', async () => {
    const { ports, silences, fileState } = createPorts([OK]);

    await synthesizeWithElevenLabs(
      { voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav', trailingPauseMs: 700 },
      ports,
    );

    expect(silences).toEqual([{ from: expect.stringMatching(/\.v1\.wav$/u), to: '/out.wav', ms: 700 }]);
    expect(fileState.log.some((entry) => entry.startsWith('copy'))).toBe(false);
  });

  it('does not call the API when the synthesis is already cached', async () => {
    const key = elevenLabsCacheKey('abc123', 'es', 'Hola', { stability: 0.5, speed: 1 });
    const { ports, fake } = createPorts([OK], { initial: [`/cache/${key}.v1.wav`], key: null });

    await synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports);

    expect(fake.calls).toHaveLength(0);
  });

  it('calls the API once for repeated identical requests, then serves the cache', async () => {
    const { ports, fake } = createPorts([OK]);
    const input = { voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' };

    await synthesizeWithElevenLabs(input, ports);
    await synthesizeWithElevenLabs(input, ports);

    expect(fake.calls).toHaveLength(1);
  });

  it('keys the cache by voice, language, text, stability and speed', () => {
    const base = elevenLabsCacheKey('a', 'es', 'x', { stability: 0.5, speed: 1 });

    expect(elevenLabsCacheKey('b', 'es', 'x', { stability: 0.5, speed: 1 })).not.toBe(base);
    expect(elevenLabsCacheKey('a', 'en', 'x', { stability: 0.5, speed: 1 })).not.toBe(base);
    expect(elevenLabsCacheKey('a', 'es', 'y', { stability: 0.5, speed: 1 })).not.toBe(base);
    expect(elevenLabsCacheKey('a', 'es', 'x', { stability: 0.7, speed: 1 })).not.toBe(base);
    expect(elevenLabsCacheKey('a', 'es', 'x', { stability: 0.5, speed: 1.1 })).not.toBe(base);
  });

  it('retries once on a 5xx and succeeds', async () => {
    const { ports, fake } = createPorts([{ status: 503 }, OK]);

    await synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports);

    expect(fake.calls).toHaveLength(2);
  });

  it('answers VOICE_ENGINE_NOT_CONFIGURED without a key, with the settings hint', async () => {
    const { ports, fake } = createPorts([OK], { key: null });

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ENGINE_NOT_CONFIGURED');
    expect(JSON.stringify(payload)).toContain('Configuración › Voces');
    expect(fake.calls).toHaveLength(0);
  });

  it('answers VOICE_ENGINE_NOT_CONFIGURED on 401 saying the key is not valid, without leaking it', async () => {
    const { ports } = createPorts([{ status: 401, bodyChunks: jsonBodyChunks({ detail: { status: 'invalid_api_key', message: 'bad' } }) }]);

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ENGINE_NOT_CONFIGURED');
    expect(JSON.stringify(payload)).toContain('no es válida');
    expect(JSON.stringify(payload)).not.toContain(API_KEY);
  });

  it('answers VOICE_ENGINE_QUOTA_EXCEEDED on 402 with the ElevenLabs message as hint', async () => {
    const { ports } = createPorts([
      { status: 402, bodyChunks: jsonBodyChunks({ detail: { status: 'payment_required', message: 'Out of credits' } }) },
    ]);

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ENGINE_QUOTA_EXCEEDED');
    expect(JSON.stringify(payload)).toContain('Out of credits');
  });

  it('answers VOICE_ENGINE_QUOTA_EXCEEDED on quota_exceeded even when carried by another status', async () => {
    const { ports } = createPorts([
      { status: 401, bodyChunks: jsonBodyChunks({ detail: { status: 'quota_exceeded', message: 'No credits left' } }) },
    ]);

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ENGINE_QUOTA_EXCEEDED');
  });

  it('answers VOICE_ENGINE_QUOTA_EXCEEDED when 429 persists after the retry', async () => {
    const { ports, fake } = createPorts([{ status: 429 }]);

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:abc123', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ENGINE_QUOTA_EXCEEDED');
    expect(fake.calls).toHaveLength(2);
  });

  it('answers VOICE_ID_INVALID when the voice does not exist', async () => {
    const { ports } = createPorts([
      { status: 404, bodyChunks: jsonBodyChunks({ detail: { status: 'voice_not_found', message: 'nope' } }) },
    ]);

    const payload = await errorPayloadOf(
      synthesizeWithElevenLabs({ voiceId: 'elevenlabs:ghost', text: 'Hola', outPath: '/out.wav' }, ports),
    );

    expect(payload.code).toBe('VOICE_ID_INVALID');
  });
});

describe('ElevenLabs direction mapping', () => {
  it('maps the effective length scale to a speed clamped to 0.7..1.2', () => {
    expect(elevenLabsSpeedFromLengthScale(undefined)).toBe(1);
    expect(elevenLabsSpeedFromLengthScale(1.25)).toBe(0.8);
    expect(elevenLabsSpeedFromLengthScale(0.92)).toBe(1.087);
    expect(elevenLabsSpeedFromLengthScale(0.5)).toBe(1.2);
    expect(elevenLabsSpeedFromLengthScale(2)).toBe(0.7);
  });

  it('maps the energy noise to stability: calm 0.7, lively 0.35, neutral 0.5', () => {
    expect(elevenLabsStabilityFromNoiseScale(0.5)).toBe(0.7);
    expect(elevenLabsStabilityFromNoiseScale(0.8)).toBe(0.35);
    expect(elevenLabsStabilityFromNoiseScale(undefined)).toBe(0.5);
  });
});
