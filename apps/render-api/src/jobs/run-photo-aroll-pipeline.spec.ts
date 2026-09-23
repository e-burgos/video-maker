import { resolveMediaProject } from '@video-maker/auto-montage';
import type { VoiceScriptManifest } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { isPhotoArollPipelineCanceled } from './photo-aroll-pipeline-observer';
import type { PhotoArollPipelineObserver } from './photo-aroll-pipeline-observer';
import { runPhotoArollPipeline } from './run-photo-aroll-pipeline';

const PROJECT_ROOT = '/media/pitch-deck';

function project() {
  return resolveMediaProject(PROJECT_ROOT);
}

function passiveObserver(cancellationRequested = false): PhotoArollPipelineObserver {
  return {
    stageStarted: () => undefined,
    clipProcessed: () => undefined,
    cancellationRequested: () => cancellationRequested,
  };
}

function manifestLine(index: number, startMs: number): VoiceScriptManifest['lines'][number] {
  return {
    index,
    text: `Line ${index}`,
    path: `work/voice/sources/line-${String(index).padStart(2, '0')}.wav`,
    startMs,
    durationMs: 2000,
  };
}

function buildManifest(overrides?: Partial<VoiceScriptManifest>): VoiceScriptManifest {
  return {
    schemaVersion: 1,
    source: 'script',
    language: 'es',
    voiceId: 'es_AR-daniela-high',
    gapMs: 500,
    path: 'work/voice/voice.wav',
    wordsPath: 'work/voice/voice.words.json',
    durationMs: 10000,
    sampleRate: 48000,
    updatedAt: '2026-09-23T00:00:00.000Z',
    lines: [manifestLine(1, 0), manifestLine(2, 3000), manifestLine(3, 6500)],
    ...overrides,
  };
}

function seedProject(manifest: VoiceScriptManifest, photoNames: readonly string[]) {
  const callLog = createCallLog();
  const files = [
    { path: `${PROJECT_ROOT}/work/voice/script-manifest.json`, contents: JSON.stringify(manifest) },
    { path: `${PROJECT_ROOT}/work/voice/voice.wav`, contents: 'wav-bytes' },
    ...photoNames.map((name) => ({ path: `${PROJECT_ROOT}/raw/images/${name}`, contents: 'jpeg-bytes' })),
  ];
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  return { callLog, storage, deps };
}

describe('runPhotoArollPipeline', () => {
  it('computes one clip per manifest line, ending on the next startMs, and the last on the track duration', async () => {
    const manifest = buildManifest();
    const { deps, callLog } = seedProject(manifest, ['1.jpg', '2.jpg', '3.jpg']);

    const report = await runPhotoArollPipeline(
      { project: project(), photos: ['raw/images/1.jpg', 'raw/images/2.jpg', 'raw/images/3.jpg'], output: 'ad.mp4', fps: 30 },
      deps,
      passiveObserver(),
    );

    const clipCalls = callLog.entries().filter((entry) => entry.port === 'buildKenBurnsClip');
    expect(clipCalls).toHaveLength(3);
    expect((clipCalls[0]?.input as { frames: number }).frames).toBe(Math.round((3000 / 1000) * 30));
    expect((clipCalls[1]?.input as { frames: number }).frames).toBe(Math.round((3500 / 1000) * 30));
    expect((clipCalls[2]?.input as { frames: number }).frames).toBe(Math.round((3500 / 1000) * 30));

    expect(report.clips).toBe(3);
    expect(report.durationMs).toBe(manifest.durationMs);
    expect(report.frames).toBe(
      (clipCalls[0]?.input as { frames: number }).frames +
        (clipCalls[1]?.input as { frames: number }).frames +
        (clipCalls[2]?.input as { frames: number }).frames,
    );
    expect(report.path).toBe('raw/aroll/ad.mp4');
  });

  it('cycles the photos when there are fewer photos than lines', async () => {
    const manifest = buildManifest();
    const { deps, callLog } = seedProject(manifest, ['1.jpg']);

    await runPhotoArollPipeline(
      { project: project(), photos: ['raw/images/1.jpg'], output: 'ad.mp4', fps: 30 },
      deps,
      passiveObserver(),
    );

    const clipCalls = callLog.entries().filter((entry) => entry.port === 'buildKenBurnsClip');
    expect(clipCalls).toHaveLength(3);
    for (const call of clipCalls) {
      expect((call.input as { photoPath: string }).photoPath).toBe(`${PROJECT_ROOT}/raw/images/1.jpg`);
    }
  });

  it('uses only the first N photos in the given order when there are more photos than lines', async () => {
    const manifest = buildManifest();
    const { deps, callLog } = seedProject(manifest, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']);

    await runPhotoArollPipeline(
      {
        project: project(),
        photos: ['raw/images/a.jpg', 'raw/images/b.jpg', 'raw/images/c.jpg', 'raw/images/d.jpg', 'raw/images/e.jpg'],
        output: 'ad.mp4',
        fps: 30,
      },
      deps,
      passiveObserver(),
    );

    const clipCalls = callLog.entries().filter((entry) => entry.port === 'buildKenBurnsClip');
    expect(clipCalls.map((call) => (call.input as { photoPath: string }).photoPath)).toEqual([
      `${PROJECT_ROOT}/raw/images/a.jpg`,
      `${PROJECT_ROOT}/raw/images/b.jpg`,
      `${PROJECT_ROOT}/raw/images/c.jpg`,
    ]);
  });

  it('writes a concat list with one quoted absolute path per clip and runs the concat and mux steps', async () => {
    const manifest = buildManifest();
    const { deps, storage } = seedProject(manifest, ['1.jpg', '2.jpg', '3.jpg']);

    await runPhotoArollPipeline(
      { project: project(), photos: ['raw/images/1.jpg', 'raw/images/2.jpg', 'raw/images/3.jpg'], output: 'ad.mp4', fps: 30 },
      deps,
      passiveObserver(),
    );

    const listContents = await storage.readTextFile(`${PROJECT_ROOT}/work/producer/ad/list.txt`);
    const lines = listContents.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(`file '${PROJECT_ROOT}/work/producer/ad/01.mp4'`);
    expect(lines[2]).toBe(`file '${PROJECT_ROOT}/work/producer/ad/03.mp4'`);
  });

  it('mixes the voice track into the silent concat, never -shortest-truncating the wrong stream', async () => {
    const manifest = buildManifest();
    const { deps, callLog } = seedProject(manifest, ['1.jpg', '2.jpg', '3.jpg']);

    await runPhotoArollPipeline(
      { project: project(), photos: ['raw/images/1.jpg', 'raw/images/2.jpg', 'raw/images/3.jpg'], output: 'ad.mp4', fps: 30 },
      deps,
      passiveObserver(),
    );

    const muxCall = callLog.entries().find((entry) => entry.port === 'muxAudioIntoVideo');
    expect(muxCall?.input).toEqual({
      videoPath: `${PROJECT_ROOT}/work/producer/ad/silent.mp4`,
      audioPath: `${PROJECT_ROOT}/work/voice/voice.wav`,
      outPath: `${PROJECT_ROOT}/raw/aroll/ad.mp4`,
    });
  });

  it('rejects when work/voice/script-manifest.json does not exist', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      runPhotoArollPipeline(
        { project: project(), photos: ['raw/images/1.jpg'], output: 'ad.mp4', fps: 30 },
        deps,
        passiveObserver(),
      ),
    ).rejects.toMatchObject({ code: 'MONTAGE_VOICE_TRACK_NOT_FOUND' });
  });

  it('rejects a photo outside raw/images/', async () => {
    const manifest = buildManifest();
    const { deps } = seedProject(manifest, []);

    await expect(
      runPhotoArollPipeline(
        { project: project(), photos: ['raw/aroll/not-a-photo.mp4'], output: 'ad.mp4', fps: 30 },
        deps,
        passiveObserver(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a photo that does not exist', async () => {
    const manifest = buildManifest();
    const { deps } = seedProject(manifest, []);

    await expect(
      runPhotoArollPipeline(
        { project: project(), photos: ['raw/images/missing.jpg'], output: 'ad.mp4', fps: 30 },
        deps,
        passiveObserver(),
      ),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('stops cooperatively when cancellation is requested before the clips stage', async () => {
    const manifest = buildManifest();
    const { deps } = seedProject(manifest, ['1.jpg', '2.jpg', '3.jpg']);

    const failure = runPhotoArollPipeline(
      { project: project(), photos: ['raw/images/1.jpg', 'raw/images/2.jpg', 'raw/images/3.jpg'], output: 'ad.mp4', fps: 30 },
      deps,
      passiveObserver(true),
    );

    await expect(failure).rejects.toSatisfy((error: unknown) => isPhotoArollPipelineCanceled(error));
  });
});
