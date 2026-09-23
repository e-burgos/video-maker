import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import {
  FAKE_VOICE_PREVIEW_DIRECTORY,
  createFakeVoicePreviewCache,
} from '../../__fixtures__/fake-voice-preview-cache';
import type { FakeVoicePreviewCache } from '../../__fixtures__/fake-voice-preview-cache';
import type { CallLog } from '../../__fixtures__/call-log';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { VOICE_PREVIEW_PHRASE, VOICE_PREVIEW_REVISION } from '../../voice/voice-preview';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleGetVoicePreview } from './voice-preview-handler';

const VOICE_ID = 'es_AR-daniela-high';
const WAV_PATH = `${FAKE_VOICE_PREVIEW_DIRECTORY}/${VOICE_ID}.${VOICE_PREVIEW_REVISION}.wav`;
const TEXT_PATH = `${FAKE_VOICE_PREVIEW_DIRECTORY}/${VOICE_ID}.${VOICE_PREVIEW_REVISION}.txt`;

class FakeBinaryNotFoundError extends Error {
  readonly code = 'BINARY_NOT_FOUND';
}

interface Harness {
  readonly deps: RenderApiDependencies;
  readonly cache: FakeVoicePreviewCache;
  readonly callLog: CallLog;
  readonly synthesized: string[];
}

function harness(
  overrides: Partial<RenderApiDependencies> = {},
  options: { readonly synthesisWritesBytes?: number; readonly modelModifiedAtMs?: number } = {},
): Harness {
  const callLog = createCallLog();
  const cache = createFakeVoicePreviewCache(callLog);
  const synthesized: string[] = [];

  const deps = createFakeRenderApiDependencies(callLog, {
    voicePreviewCache: cache,
    statFile: {
      statFile: async () => ({ sizeBytes: 1, modifiedAtMs: options.modelModifiedAtMs ?? 10 }),
    },
    synthesizeVoice: async ({ outPath }) => {
      synthesized.push(outPath);
      const bytes = options.synthesisWritesBytes ?? 96_000;
      if (bytes > 0) {
        cache.writeBinary(outPath, bytes, 100);
      }
    },
    ...overrides,
  });

  return { deps, cache, callLog, synthesized };
}

async function collect(stream: AsyncIterable<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  for await (const chunk of stream) {
    text += decoder.decode(chunk);
  }
  return text;
}

describe('handleGetVoicePreview (US-016-002)', () => {
  it('synthesizes the fixed phrase on the first request and serves it as a cacheable wav', async () => {
    const { deps, cache, synthesized } = harness();

    const response = await handleGetVoicePreview(
      deps,
      { voiceId: VOICE_ID },
      createRenderApiRuntime(deps),
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('audio/wav');
    expect(response.headers['content-length']).toBe('96000');
    expect(response.headers['cache-control']).toBe('public, max-age=86400');
    expect(synthesized).toEqual([WAV_PATH]);
    expect(cache.textFiles.get(TEXT_PATH)).toBe(`${VOICE_PREVIEW_PHRASE}\n`);
    expect(cache.createdDirectories).toEqual([FAKE_VOICE_PREVIEW_DIRECTORY]);
    expect(await collect(response.stream?.() ?? [])).toBe(`wav:${WAV_PATH}`);
  });

  it('serves the second request from the cache without synthesizing again', async () => {
    const { deps, synthesized } = harness();
    const runtime = createRenderApiRuntime(deps);

    await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, runtime);
    const second = await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, runtime);

    expect(synthesized).toEqual([WAV_PATH]);
    expect(second.status).toBe(200);
    expect(second.headers['content-length']).toBe('96000');
  });

  it('re-synthesizes when the voice model is newer than the cached preview', async () => {
    const { deps, cache, synthesized } = harness({}, { modelModifiedAtMs: 500 });
    cache.writeBinary(WAV_PATH, 4_000, 100);

    await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, createRenderApiRuntime(deps));

    expect(synthesized).toEqual([WAV_PATH]);
  });

  it('keeps every byte it writes inside the preview cache, never inside media/', async () => {
    const { deps, cache, callLog } = harness();

    await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, createRenderApiRuntime(deps));

    const written = [...cache.textFiles.keys(), ...cache.createdDirectories];
    expect(written.every((path) => path.startsWith(FAKE_VOICE_PREVIEW_DIRECTORY))).toBe(true);
    expect(callLog.ports().some((port) => port.startsWith('storage.'))).toBe(false);
  });

  it('answers VOICE_NOT_FOUND for an id that the catalog does not list', async () => {
    const { deps } = harness();

    await expect(
      handleGetVoicePreview(deps, { voiceId: 'es_XX-nobody-high' }, createRenderApiRuntime(deps)),
    ).rejects.toMatchObject({ code: 'VOICE_NOT_FOUND', resource: 'es_XX-nobody-high' });
  });

  it('answers VOICE_MODEL_UNAVAILABLE when the voice engine is not configured on this machine', async () => {
    const { deps } = harness({
      listVoiceModels: async () => {
        throw new FakeBinaryNotFoundError('tts-voices not found at /home/dev/.cache/tts-voices');
      },
    });

    const error = await handleGetVoicePreview(
      deps,
      { voiceId: VOICE_ID },
      createRenderApiRuntime(deps),
    ).catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: 'VOICE_MODEL_UNAVAILABLE' });
    expect(JSON.stringify(error)).not.toContain('/home/dev/.cache');
  });

  it('answers VOICE_SYNTHESIS_FAILED when the voice engine returns without writing a preview', async () => {
    const { deps } = harness({}, { synthesisWritesBytes: 0 });

    await expect(
      handleGetVoicePreview(deps, { voiceId: VOICE_ID }, createRenderApiRuntime(deps)),
    ).rejects.toMatchObject({ code: 'VOICE_SYNTHESIS_FAILED', stage: 'synthesize' });
  });

  it('two simultaneous requests for the same voice synthesize it once', async () => {
    const { deps, synthesized } = harness();
    const runtime = createRenderApiRuntime(deps);

    const [first, second] = await Promise.all([
      handleGetVoicePreview(deps, { voiceId: VOICE_ID }, runtime),
      handleGetVoicePreview(deps, { voiceId: VOICE_ID }, runtime),
    ]);

    expect(synthesized).toEqual([WAV_PATH]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('does not enqueue anything: the preview never touches the job queue', async () => {
    const { deps } = harness();
    const runtime = createRenderApiRuntime(deps);

    await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, runtime);

    expect(runtime.jobs.size()).toEqual({ running: 0, queued: 0 });
  });

  it('the cached file name carries the phrase revision, so changing the phrase does not serve a stale demo', async () => {
    const { deps, synthesized } = harness();

    await handleGetVoicePreview(deps, { voiceId: VOICE_ID }, createRenderApiRuntime(deps));

    expect(synthesized).toEqual([
      `${FAKE_VOICE_PREVIEW_DIRECTORY}/${VOICE_ID}.${VOICE_PREVIEW_REVISION}.wav`,
    ]);
  });
});
