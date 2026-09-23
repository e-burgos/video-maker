import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoreConfig } from '../config/store-config';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { createNodeRenderApiDependencies } from './node-render-api-dependencies';

vi.mock('@video-maker/composition-remotion/render', () => ({
  renderTimeline: vi.fn(),
}));

vi.mock('@video-maker/media-local', () => ({
  ExecaCommandRunner: class ExecaCommandRunner {},
  BINARY_ENV_VARS: {
    ffmpeg: 'FFMPEG_PATH',
    ffprobe: 'FFPROBE_PATH',
    whisperCli: 'WHISPER_CPP_PATH',
    whisperModel: 'WHISPER_MODEL_PATH',
    piperCli: 'PIPER_PATH',
    piperModel: 'PIPER_MODEL_PATH',
  },
  resolveBinary: vi.fn(),
  resolveBinaries: vi.fn(),
  resolveVoiceBinaries: vi.fn(),
  synthesizeSpeech: vi.fn(),
  extractAudioForTranscription: vi.fn(),
  transcribeWithWhisperCpp: vi.fn(),
  buildVoiceCatalog: vi.fn(),
  voiceModelConfigFileName: (fileName: string) => `${fileName}.json`,
  mixTimelineAudio: vi.fn(),
  muxAudioIntoVideo: vi.fn(),
  verifyMixLoudness: vi.fn(),
}));

const ENV: NodeJS.ProcessEnv = {};
const CWD = '/var/data/media/acme-launch';
const STORE: StoreConfig = { mediaRoot: '/var/data/media', dbPath: '/var/data/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

async function loadMocks() {
  const render = await import('@video-maker/composition-remotion/render');
  const mediaLocal = await import('@video-maker/media-local');

  return {
    renderTimelineMock: vi.mocked(render.renderTimeline),
    resolveBinaryMock: vi.mocked(mediaLocal.resolveBinary),
    resolveBinariesMock: vi.mocked(mediaLocal.resolveBinaries),
    mixTimelineAudioMock: vi.mocked(mediaLocal.mixTimelineAudio),
    muxAudioIntoVideoMock: vi.mocked(mediaLocal.muxAudioIntoVideo),
    verifyMixLoudnessMock: vi.mocked(mediaLocal.verifyMixLoudness),
    resolveVoiceBinariesMock: vi.mocked(mediaLocal.resolveVoiceBinaries),
    synthesizeSpeechMock: vi.mocked(mediaLocal.synthesizeSpeech),
    extractAudioForTranscriptionMock: vi.mocked(mediaLocal.extractAudioForTranscription),
    transcribeWithWhisperCppMock: vi.mocked(mediaLocal.transcribeWithWhisperCpp),
    buildVoiceCatalogMock: vi.mocked(mediaLocal.buildVoiceCatalog),
    ExecaCommandRunner: mediaLocal.ExecaCommandRunner,
  };
}

let mocks: Awaited<ReturnType<typeof loadMocks>>;

beforeEach(async () => {
  mocks = await loadMocks();
  mocks.renderTimelineMock.mockReset();
  mocks.resolveBinaryMock.mockReset();
  mocks.resolveBinariesMock.mockReset();
  mocks.mixTimelineAudioMock.mockReset();
  mocks.muxAudioIntoVideoMock.mockReset();
  mocks.verifyMixLoudnessMock.mockReset();
  mocks.resolveVoiceBinariesMock.mockReset();
  mocks.synthesizeSpeechMock.mockReset();
  mocks.extractAudioForTranscriptionMock.mockReset();
  mocks.transcribeWithWhisperCppMock.mockReset();
  mocks.buildVoiceCatalogMock.mockReset();

  mocks.resolveBinaryMock.mockImplementation(async (name: string) => `/opt/homebrew/bin/${name}`);
  mocks.resolveVoiceBinariesMock.mockResolvedValue({
    ffmpeg: '/opt/homebrew/bin/ffmpeg',
    ffprobe: '/opt/homebrew/bin/ffprobe',
    whisperCli: '/opt/homebrew/bin/whisper-cli',
    whisperModel: '/models/ggml.bin',
    piperCli: '/opt/python/bin/piper',
    piperModel: '/voices/es_AR-daniela-high.onnx',
  });
});

describe('createNodeRenderApiDependencies', () => {
  it('asks renderTimeline to mute the audio track when renderMutedVideo runs', async () => {
    mocks.renderTimelineMock.mockResolvedValue({
      outPath: '/work/renders/r1/video-muted.mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
      compositionId: 'timeline-composition',
    });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const timeline = buildMinimalTimeline();

    const result = await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: CWD,
    });

    expect(mocks.renderTimelineMock).toHaveBeenCalledWith(timeline, {
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: CWD,
      audio: 'muted',
    });
    expect(result).toEqual({
      outPath: '/work/renders/r1/video-muted.mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
    });
  });

  it('forwards onProgress to renderTimeline without altering renderedFrames or totalFrames', async () => {
    mocks.renderTimelineMock.mockImplementation(async (timeline, options) => {
      options.onProgress?.(120, 538);
      return {
        outPath: '/work/renders/r1/video-muted.mp4',
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 538,
        compositionId: 'timeline-composition',
      };
    });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const timeline = buildMinimalTimeline();
    const received: Array<readonly [number, number]> = [];

    await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: CWD,
      onProgress: (renderedFrames, totalFrames) => {
        received.push([renderedFrames, totalFrames]);
      },
    });

    expect(received).toEqual([[120, 538]]);
  });

  it('feeds mixTimelineAudio with the timeline, the out path and the resolved ffmpeg binary', async () => {
    mocks.mixTimelineAudioMock.mockResolvedValue({
      outputPath: '/work/renders/r1/master.wav',
      filterComplex: '[0:a]anull[out]',
    });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const timeline = buildMinimalTimeline();

    const result = await deps.mixTimelineAudio({
      timeline,
      outPath: '/work/renders/r1/master.wav',
      projectRoot: CWD,
    });

    expect(mocks.mixTimelineAudioMock).toHaveBeenCalledWith(
      timeline,
      '/work/renders/r1/master.wav',
      expect.any(mocks.ExecaCommandRunner),
      { ffmpegPath: '/opt/homebrew/bin/ffmpeg', runOptions: { cwd: CWD } },
    );
    expect(result).toEqual({ outputPath: '/work/renders/r1/master.wav', filterComplex: '[0:a]anull[out]' });
  });

  it('feeds muxAudioIntoVideo with the flattened video, audio and out paths plus the resolved binaries', async () => {
    mocks.muxAudioIntoVideoMock.mockResolvedValue({ outputPath: '/out/r1.mp4' });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const result = await deps.muxAudioIntoVideo({
      videoPath: '/work/renders/r1/video-muted.mp4',
      audioPath: '/work/renders/r1/master.wav',
      outPath: '/out/r1.mp4',
    });

    expect(mocks.muxAudioIntoVideoMock).toHaveBeenCalledWith(
      '/work/renders/r1/video-muted.mp4',
      '/work/renders/r1/master.wav',
      '/out/r1.mp4',
      expect.any(mocks.ExecaCommandRunner),
      { ffmpegPath: '/opt/homebrew/bin/ffmpeg', ffprobePath: '/opt/homebrew/bin/ffprobe' },
    );
    expect(result).toEqual({ outputPath: '/out/r1.mp4' });
  });

  it('passes the measured loudness verification through unchanged', async () => {
    const verification = {
      measured: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 6, thresholdLufs: -24, targetOffsetDb: 0 },
      withinTolerance: true,
      integratedDeltaLu: 0,
      truePeakDeltaDb: 0,
    };
    mocks.verifyMixLoudnessMock.mockResolvedValue(verification);

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const timeline = buildMinimalTimeline();

    const result = await deps.verifyMixLoudness({ path: '/out/r1.mp4', target: timeline.audioMix.voice });

    expect(mocks.verifyMixLoudnessMock).toHaveBeenCalledWith(
      '/out/r1.mp4',
      timeline.audioMix.voice,
      expect.any(mocks.ExecaCommandRunner),
      { ffmpegPath: '/opt/homebrew/bin/ffmpeg' },
    );
    expect(result).toBe(verification);
  });

  it('resolves ffmpeg and ffprobe once and memoizes them across mixTimelineAudio and muxAudioIntoVideo', async () => {
    mocks.mixTimelineAudioMock.mockResolvedValue({
      outputPath: '/work/renders/r1/master.wav',
      filterComplex: '[0:a]anull[out]',
    });
    mocks.muxAudioIntoVideoMock.mockResolvedValue({ outputPath: '/out/r1.mp4' });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const timeline = buildMinimalTimeline();

    await deps.mixTimelineAudio({ timeline, outPath: '/work/renders/r1/master.wav', projectRoot: CWD });
    await deps.muxAudioIntoVideo({
      videoPath: '/work/renders/r1/video-muted.mp4',
      audioPath: '/work/renders/r1/master.wav',
      outPath: '/out/r1.mp4',
    });

    expect(mocks.resolveBinaryMock).toHaveBeenCalledTimes(2);
    expect(mocks.resolveBinaryMock).toHaveBeenCalledWith('ffmpeg', ENV);
    expect(mocks.resolveBinaryMock).toHaveBeenCalledWith('ffprobe', ENV);
  });

  it('reports each of the six binaries by logical name and env var, live-checking without reusing the memoized resolution', async () => {
    mocks.resolveBinaryMock.mockImplementation(async (name: string) => {
      if (name === 'ffprobe') {
        throw new Error('not found');
      }
      return `/opt/homebrew/bin/${name}`;
    });

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const statuses = await deps.probeMediaBinaries();

    expect(statuses).toEqual([
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: false },
      { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
      { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
      { name: 'piperCli', envVar: 'PIPER_PATH', resolved: true },
      { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: true },
    ]);
    for (const status of statuses) {
      expect(status).not.toHaveProperty('path');
      expect(status).not.toHaveProperty('resolvedPath');
    }
  });

  it('synthesizeVoice invoca a piper con el binario resuelto y el cwd del proyecto (US-09-004)', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await deps.synthesizeVoice({
      textPath: 'work/voice/sources/scene-01.txt',
      outPath: 'work/voice/sources/scene-01.wav',
      modelPath: '/voices/es_AR-daniela-high.onnx',
      projectRoot: CWD,
    });

    expect(mocks.synthesizeSpeechMock).toHaveBeenCalledWith(
      'work/voice/sources/scene-01.wav',
      {
        modelPath: '/voices/es_AR-daniela-high.onnx',
        textPath: 'work/voice/sources/scene-01.txt',
        piperPath: '/opt/python/bin/piper',
        runOptions: { cwd: CWD },
      },
      expect.any(mocks.ExecaCommandRunner),
    );
  });

  it('extractVoiceAudio pasa el sample rate, los canales y la raíz del proyecto a ffmpeg (US-09-004)', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await deps.extractVoiceAudio({
      inputPath: 'work/voice/sources/scene-01.wav',
      outPath: 'work/voice/scene-01.wav',
      sampleRate: 48000,
      channels: 1,
      projectRoot: CWD,
    });

    expect(mocks.extractAudioForTranscriptionMock).toHaveBeenCalledWith(
      'work/voice/sources/scene-01.wav',
      'work/voice/scene-01.wav',
      expect.any(mocks.ExecaCommandRunner),
      {
        sampleRate: 48000,
        channels: 1,
        ffmpegPath: '/opt/homebrew/bin/ffmpeg',
        runOptions: { cwd: CWD },
      },
    );
  });

  it('transcribeVoice usa el modelo de whisper resuelto y devuelve la transcripción (US-09-007)', async () => {
    mocks.transcribeWithWhisperCppMock.mockResolvedValue({
      assetId: 'work/voice/scene-01.wav',
      engine: 'whisper.cpp',
      language: 'es',
      words: [],
      segments: [],
    });
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    const transcription = await deps.transcribeVoice({
      wavPath: 'work/voice/whisper/scene-01.wav',
      outBase: 'work/voice/whisper/scene-01',
      assetId: 'work/voice/scene-01.wav',
      language: 'es',
      projectRoot: CWD,
    });

    expect(transcription.engine).toBe('whisper.cpp');
    expect(mocks.transcribeWithWhisperCppMock).toHaveBeenCalledWith(
      'work/voice/whisper/scene-01.wav',
      {
        modelPath: '/models/ggml.bin',
        outBase: 'work/voice/whisper/scene-01',
        assetId: 'work/voice/scene-01.wav',
        language: 'es',
        whisperPath: '/opt/homebrew/bin/whisper-cli',
        runOptions: { cwd: CWD },
      },
      expect.any(mocks.ExecaCommandRunner),
    );
  });

  it('resolveVoiceBinaries delega en media-local con el entorno del proceso (US-09-002)', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await deps.resolveVoiceBinaries();

    expect(mocks.resolveVoiceBinariesMock).toHaveBeenCalledWith(ENV);
  });

  it('listVoiceModels lee el directorio del modelo configurado y descarta lo que no es archivo (US-09-003)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'piper-voices-'));
    await writeFile(join(voicesDir, 'es_AR-daniela-high.onnx'), 'model');
    await writeFile(join(voicesDir, 'es_AR-daniela-high.onnx.json'), '{}');
    await mkdir(join(voicesDir, 'nested.onnx'));
    const modelPath = join(voicesDir, 'es_AR-daniela-high.onnx');
    mocks.resolveBinaryMock.mockImplementation(async (name: string) =>
      name === 'piperModel' ? modelPath : `/opt/homebrew/bin/${name}`,
    );
    const catalog = [
      {
        id: 'es_AR-daniela-high',
        fileName: 'es_AR-daniela-high.onnx',
        isDefault: true,
        language: { code: 'es-AR', region: 'AR' },
        quality: 'high' as const,
        label: 'Daniela',
        description: 'a voice',
      },
    ];
    mocks.buildVoiceCatalogMock.mockReturnValue(catalog);

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const voices = await deps.listVoiceModels();

    expect(voices).toEqual(catalog);
    const [files, configured] = mocks.buildVoiceCatalogMock.mock.calls[0] ?? [];
    expect([...(files ?? [])].map((file) => file.fileName).sort()).toEqual([
      'es_AR-daniela-high.onnx',
      'es_AR-daniela-high.onnx.json',
    ]);
    expect(configured).toBe(modelPath);

    await rm(voicesDir, { recursive: true, force: true });
  });

  it('listVoiceModels lee el sidecar .onnx.json de cada modelo y tolera uno corrupto (US-016-001)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'piper-voices-'));
    await writeFile(join(voicesDir, 'es_AR-daniela-high.onnx'), 'model');
    await writeFile(join(voicesDir, 'es_AR-daniela-high.onnx.json'), '{"dataset":"daniela"}');
    await writeFile(join(voicesDir, 'es_MX-claude-high.onnx'), 'model');
    await writeFile(join(voicesDir, 'es_MX-claude-high.onnx.json'), 'not json at all');
    await writeFile(join(voicesDir, 'es_ES-davefx-medium.onnx'), 'model');
    const modelPath = join(voicesDir, 'es_AR-daniela-high.onnx');
    mocks.resolveBinaryMock.mockImplementation(async (name: string) =>
      name === 'piperModel' ? modelPath : `/opt/homebrew/bin/${name}`,
    );
    mocks.buildVoiceCatalogMock.mockReturnValue([]);

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    await deps.listVoiceModels();

    const [files] = mocks.buildVoiceCatalogMock.mock.calls[0] ?? [];
    const byName = new Map([...(files ?? [])].map((file) => [file.fileName, file.config]));

    expect(byName.get('es_AR-daniela-high.onnx')).toEqual({ dataset: 'daniela' });
    expect(byName.get('es_MX-claude-high.onnx')).toBeNull();
    expect(byName.get('es_ES-davefx-medium.onnx')).toBeNull();

    await rm(voicesDir, { recursive: true, force: true });
  });

  it('reports both engine modules as loaded once the dynamic imports resolve', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const statuses = await deps.preloadEngineModules();

    expect(statuses).toEqual([
      { name: 'media-local', loaded: true },
      { name: 'composition-remotion/render', loaded: true },
    ]);
  });

  it('resolves the four montage binaries via resolveBinaries(env)', async () => {
    const resolved = {
      ffmpeg: '/opt/homebrew/bin/ffmpeg',
      ffprobe: '/opt/homebrew/bin/ffprobe',
      whisperCli: '/opt/homebrew/bin/whisper-cli',
      whisperModel: '/opt/homebrew/share/whisper/ggml-model.bin',
    };
    mocks.resolveBinariesMock.mockResolvedValue(resolved);

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const binaries = await deps.resolveMontageBinaries();

    expect(mocks.resolveBinariesMock).toHaveBeenCalledWith(ENV);
    expect(binaries).toBe(resolved);
  });

  it('creates a fresh command runner instance on every createCommandRunner call', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    const first = await deps.createCommandRunner();
    const second = await deps.createCommandRunner();

    expect(first).toBeInstanceOf(mocks.ExecaCommandRunner);
    expect(second).toBeInstanceOf(mocks.ExecaCommandRunner);
    expect(first).not.toBe(second);
  });

  it('reads directory entries from a real temporary directory via readDirectory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-readdir-'));

    try {
      await mkdir(join(base, 'aroll'), { recursive: true });
      await writeFile(join(base, 'notes.txt'), 'x', 'utf8');

      const deps = createNodeRenderApiDependencies(ENV, STORE);
      const entries = await deps.readDirectory.readDirectory(base);

      const byName = new Map(entries.map((entry) => [entry.name, entry]));
      expect(byName.get('aroll')).toEqual({ name: 'aroll', isDirectory: true, isFile: false });
      expect(byName.get('notes.txt')).toEqual({ name: 'notes.txt', isDirectory: false, isFile: true });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('reads file stats from a real temporary file via statFile', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-statfile-'));

    try {
      const filePath = join(base, 'clip.mp4');
      await writeFile(filePath, 'hello world', 'utf8');

      const deps = createNodeRenderApiDependencies(ENV, STORE);
      const stats = await deps.statFile.statFile(filePath);

      expect(stats.sizeBytes).toBe(11);
      expect(typeof stats.modifiedAtMs).toBe('number');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('creates the directory recursively via ensureDirectory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-'));
    const nested = join(base, 'a', 'b', 'c');

    try {
      const deps = createNodeRenderApiDependencies(ENV, STORE);
      await deps.ensureDirectory(nested);

      const info = await stat(nested);
      expect(info.isDirectory()).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('produces an ISO timestamp from the system clock', () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const before = Date.now();
    const iso = deps.clock.nowIso();
    const after = Date.now();

    const parsed = new Date(iso).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('keeps the logger as a no-op in this cycle', () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    expect(deps.logger.info({ event: 'anything' })).toBeUndefined();
    expect(deps.logger.error({ event: 'anything' })).toBeUndefined();
  });

  it('confines every storage operation to the configured media root', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);
    const outsidePath = '/etc/passwd';

    const emptySource: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ value: undefined, done: true as const }),
      }),
    };

    await expect(deps.storage.stat(outsidePath)).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    await expect(deps.storage.listDirectory(outsidePath)).rejects.toMatchObject({
      code: 'ASSET_PATH_INVALID',
    });
    await expect(deps.storage.ensureDirectory(outsidePath)).rejects.toMatchObject({
      code: 'ASSET_PATH_INVALID',
    });
    await expect(deps.storage.readTextFile(outsidePath)).rejects.toMatchObject({
      code: 'ASSET_PATH_INVALID',
    });
    await expect(deps.storage.writeTextFile(outsidePath, 'x')).rejects.toMatchObject({
      code: 'ASSET_PATH_INVALID',
    });
    expect(() => deps.storage.openReadStream(outsidePath)).toThrow();
    await expect(
      deps.storage.writeTemporary({
        directory: outsidePath,
        source: emptySource,
        expectedBytes: 0,
        limitBytes: 10,
      }),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    await expect(
      deps.storage.promoteTemporary(outsidePath, `${STORE.mediaRoot}/x`),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    await expect(deps.storage.removeTemporary(outsidePath)).rejects.toMatchObject({
      code: 'ASSET_PATH_INVALID',
    });
  });

  it('writes into work/.uploads and renames onto the final path against a real temporary directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-store-'));

    try {
      const store: StoreConfig = {
        mediaRoot: base,
        dbPath: join(base, '.studio', 'studio.db'),
        maxUploadBytes: 1024,
        objectStore: 'fs',
      };
      const deps = createNodeRenderApiDependencies(ENV, store);
      const uploadsDir = join(base, 'work', '.uploads');
      const finalDir = join(base, 'raw', 'aroll');
      const finalPath = join(finalDir, 'clip01.mp4');

      await deps.storage.ensureDirectory(uploadsDir);
      await deps.storage.ensureDirectory(finalDir);

      async function* body(): AsyncGenerator<Uint8Array> {
        yield new TextEncoder().encode('hello ');
        yield new TextEncoder().encode('world');
      }

      const outcome = await deps.storage.writeTemporary({
        directory: uploadsDir,
        source: body(),
        expectedBytes: 11,
        limitBytes: 1024,
      });

      if (outcome.kind !== 'written') {
        throw new Error(`expected a written outcome, got ${outcome.kind}`);
      }
      expect(outcome.bytesWritten).toBe(11);
      expect(outcome.temporaryPath.startsWith(uploadsDir)).toBe(true);

      const temporaryExistsBeforePromotion = await stat(outcome.temporaryPath).then(
        () => true,
        () => false,
      );
      expect(temporaryExistsBeforePromotion).toBe(true);

      await deps.storage.promoteTemporary(outcome.temporaryPath, finalPath);

      expect(await readFile(finalPath, 'utf8')).toBe('hello world');

      const temporaryExistsAfterPromotion = await stat(outcome.temporaryPath).then(
        () => true,
        () => false,
      );
      expect(temporaryExistsAfterPromotion).toBe(false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
