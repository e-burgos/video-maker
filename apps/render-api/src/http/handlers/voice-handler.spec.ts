import { serializeMontageDocument } from '@video-maker/auto-montage';
import { emptyVoiceManifest, hashNarration, VoiceManifestSchema } from '@video-maker/timeline-core';
import type { MediaAsset, VoiceManifest, VoiceTrack } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { buildStoryboardDocument } from '../../__fixtures__/storyboard-fixtures';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { voiceManifestPath, voiceTrackPath, voiceWordsPath } from '../../voice/voice-paths';
import { handleGetVoice, handlePutVoiceScene } from './voice-handler';
import type { VoiceBody, VoiceSceneBody } from './voice-handler';

const STORE: StoreConfig = { mediaRoot: '/var/data/media', dbPath: '/var/data/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const SLUG = 'acme-launch';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const DOCUMENT = buildStoryboardDocument();

function absolute(relativePath: string): string {
  return `${PROJECT_ROOT}/${relativePath}`;
}

async function* textBody(value: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(value);
}

function jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  return textBody(JSON.stringify(value));
}

function generatedTrack(sceneId: string, index: number, narration: string): VoiceTrack {
  return {
    sceneId,
    index,
    source: 'generated',
    path: voiceTrackPath(sceneId),
    wordsPath: voiceWordsPath(sceneId),
    durationMs: 4200,
    sampleRate: 48000,
    voiceId: 'es_AR-daniela-high',
    narrationHash: hashNarration(narration),
    updatedAt: '2026-09-09T12:00:00.000Z',
  };
}

function manifestWith(tracks: readonly VoiceTrack[]): VoiceManifest {
  return { ...emptyVoiceManifest(DOCUMENT.id, DOCUMENT.language), tracks };
}

function audioAsset(assetId: string): MediaAsset {
  return {
    id: assetId,
    kind: 'audio',
    path: assetId,
    durationMs: 5400,
    hasAudio: true,
    audio: { sampleRate: 48000, channels: 1, codec: 'pcm_s16le' },
    probedAt: '2026-09-08T00:00:00.000Z',
  };
}

function createDeps(options?: {
  readonly manifest?: VoiceManifest;
  readonly storyboard?: unknown;
  readonly rawFiles?: readonly string[];
  readonly overrides?: Partial<RenderApiDependencies>;
}): { deps: RenderApiDependencies; storage: ReturnType<typeof createFakeObjectStorage> } {
  const callLog = createCallLog();
  const files = [
    ...(options?.storyboard === null
      ? []
      : [
          {
            path: absolute('work/storyboard.json'),
            contents: serializeMontageDocument(options?.storyboard ?? DOCUMENT),
          },
        ]),
    ...(options?.manifest === undefined
      ? []
      : [{ path: absolute(voiceManifestPath()), contents: serializeMontageDocument(options.manifest) }]),
    ...(options?.rawFiles ?? []).map((path) => ({ path: absolute(path), contents: 'RIFF' })),
  ];
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    probeAsset: async ({ assetId }) => audioAsset(assetId),
    ...options?.overrides,
  });
  return { deps, storage };
}

describe('handleGetVoice (US-09-007)', () => {
  it('answers 200 with the manifest and one status per stored track', async () => {
    const { deps } = createDeps({
      manifest: manifestWith([generatedTrack('scene-01', 1, DOCUMENT.scenes[0].narration)]),
    });

    const response = await handleGetVoice(deps, STORE, { slug: SLUG });
    const body = response.body as VoiceBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['manifest', 'scenes', 'slug']);
    expect(body.slug).toBe(SLUG);
    expect(body.manifest.tracks).toHaveLength(1);
    expect(body.scenes).toEqual([{ sceneId: 'scene-01', index: 1, source: 'generated', stale: false }]);
  });

  it('marks a scene as stale when its narration changed after the track was synthesized', async () => {
    const { deps } = createDeps({
      manifest: manifestWith([generatedTrack('scene-01', 1, 'una narración vieja que ya no está')]),
    });

    const body = (await handleGetVoice(deps, STORE, { slug: SLUG })).body as VoiceBody;

    expect(body.scenes[0]?.stale).toBe(true);
  });

  it('reports stale as null when the scene is no longer in the storyboard', async () => {
    const { deps } = createDeps({
      manifest: manifestWith([generatedTrack('scene-09', 9, 'texto de una escena borrada')]),
    });

    const body = (await handleGetVoice(deps, STORE, { slug: SLUG })).body as VoiceBody;

    expect(body.scenes[0]?.stale).toBeNull();
  });

  it('answers 404 VOICE_NOT_FOUND when the project has no manifest yet', async () => {
    const { deps } = createDeps();

    await expect(handleGetVoice(deps, STORE, { slug: SLUG })).rejects.toMatchObject({
      code: 'VOICE_NOT_FOUND',
      resource: 'work/voice/manifest.json',
    });
  });

  it('answers 422 VOICE_INVALID when the stored manifest does not pass its schema', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: absolute(voiceManifestPath()), contents: '{"schemaVersion":99}' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleGetVoice(deps, STORE, { slug: SLUG })).rejects.toMatchObject({ code: 'VOICE_INVALID' });
  });

  it('answers 404 PROJECT_NOT_FOUND for an unknown project and 422 for an invalid slug', async () => {
    const { deps } = createDeps();

    await expect(handleGetVoice(deps, STORE, { slug: 'missing' })).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    await expect(handleGetVoice(deps, STORE, { slug: 'Not Valid' })).rejects.toMatchObject({
      code: 'PROJECT_SLUG_INVALID',
    });
  });
});

describe('handlePutVoiceScene (US-09-006)', () => {
  const request = (value: unknown) =>
    requestLine({
      method: 'PUT',
      path: `/projects/${SLUG}/voice/scenes/scene-02`,
      body: jsonBody(value),
    });

  it('normalizes, transcribes and stores the uploaded locution with source uploaded', async () => {
    const { deps, storage } = createDeps({ rawFiles: ['raw/voice/toma-02.wav'] });

    const response = await handlePutVoiceScene(
      deps,
      STORE,
      { slug: SLUG, sceneId: 'scene-02' },
      request({ fileName: 'toma-02.wav' }),
    );
    const body = response.body as VoiceSceneBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['path', 'slug', 'track']);
    expect(body.track.source).toBe('uploaded');
    expect(body.track.voiceId).toBeNull();
    expect(body.track.durationMs).toBe(5400);
    expect(body.track.path).toBe('work/voice/scene-02.wav');
    expect(body.track.wordsPath).toBe('work/voice/scene-02.words.json');
    expect(body.track.narrationHash).toBe(hashNarration(DOCUMENT.scenes[1].narration));

    const manifest = VoiceManifestSchema.parse(
      JSON.parse(await storage.readTextFile(absolute(voiceManifestPath()))),
    );
    expect(manifest.tracks).toEqual([body.track]);
    await expect(storage.stat(absolute(voiceWordsPath('scene-02')))).resolves.not.toBeNull();
  });

  it('replaces the generated track of that scene and keeps the other scenes untouched', async () => {
    const kept = generatedTrack('scene-01', 1, DOCUMENT.scenes[0].narration);
    const { deps, storage } = createDeps({
      manifest: manifestWith([kept, generatedTrack('scene-02', 2, DOCUMENT.scenes[1].narration)]),
      rawFiles: ['raw/voice/toma-02.wav'],
    });

    await handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-02' }, request({ fileName: 'toma-02.wav' }));

    const manifest = VoiceManifestSchema.parse(
      JSON.parse(await storage.readTextFile(absolute(voiceManifestPath()))),
    );
    expect(manifest.tracks).toHaveLength(2);
    expect(manifest.tracks[0]).toEqual(kept);
    expect(manifest.tracks[1]?.source).toBe('uploaded');
  });

  it('answers 404 VOICE_ASSET_NOT_FOUND when the file is not under raw/voice', async () => {
    const { deps } = createDeps({ rawFiles: ['raw/audio/toma-02.wav'] });

    await expect(
      handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-02' }, request({ fileName: 'toma-02.wav' })),
    ).rejects.toMatchObject({ code: 'VOICE_ASSET_NOT_FOUND', resource: 'raw/voice/toma-02.wav' });
  });

  it('answers 422 ASSET_PATH_INVALID for a file name that escapes the raw directory', async () => {
    const { deps } = createDeps();

    for (const fileName of ['../../etc/passwd', 'nested/toma.wav', '', 42]) {
      await expect(
        handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-02' }, request({ fileName })),
      ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    }
  });

  it('answers 404 VOICE_SCENE_NOT_FOUND for a scene that is not in the storyboard', async () => {
    const { deps } = createDeps({ rawFiles: ['raw/voice/toma-02.wav'] });

    await expect(
      handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-09' }, request({ fileName: 'toma-02.wav' })),
    ).rejects.toMatchObject({ code: 'VOICE_SCENE_NOT_FOUND', resource: 'scene-09' });
  });

  it('answers 404 STORYBOARD_NOT_FOUND when there is no storyboard to attach the locution to', async () => {
    const { deps } = createDeps({ storyboard: null, rawFiles: ['raw/voice/toma-02.wav'] });

    await expect(
      handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-02' }, request({ fileName: 'toma-02.wav' })),
    ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND' });
  });

  it('answers 400 REQUEST_BODY_INVALID_JSON for an empty, malformed or non-object body', async () => {
    const { deps } = createDeps();

    for (const body of ['', 'not json', '[]']) {
      await expect(
        handlePutVoiceScene(
          deps,
          STORE,
          { slug: SLUG, sceneId: 'scene-02' },
          requestLine({ method: 'PUT', path: `/projects/${SLUG}/voice/scenes/scene-02`, body: textBody(body) }),
        ),
      ).rejects.toMatchObject({ code: 'REQUEST_BODY_INVALID_JSON' });
    }
  });

  it('reports a transcription failure as VOICE_TRANSCRIPTION_FAILED without writing the manifest', async () => {
    const { deps, storage } = createDeps({
      rawFiles: ['raw/voice/toma-02.wav'],
      overrides: {
        transcribeVoice: async () => {
          throw new Error('whisper wrote no json');
        },
      },
    });

    await expect(
      handlePutVoiceScene(deps, STORE, { slug: SLUG, sceneId: 'scene-02' }, request({ fileName: 'toma-02.wav' })),
    ).rejects.toMatchObject({ code: 'VOICE_TRANSCRIPTION_FAILED', resource: 'scene-02' });

    await expect(storage.stat(absolute(voiceManifestPath()))).resolves.toBeNull();
  });
});
