import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
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
    ttsCli: 'TTS_CLI_PATH',
    ttsVoicesDir: 'TTS_VOICES_DIR',
  },
  resolveBinary: vi.fn(),
  resolveBinaries: vi.fn(),
  resolveVoiceBinaries: vi.fn(),
  synthesizeSpeech: vi.fn(),
  extractAudioForTranscription: vi.fn(),
  transcribeWithWhisperCpp: vi.fn(),
  buildVoiceCatalog: vi.fn(),
  voiceModelConfigFileName: (fileName: string) => `${fileName}.json`,
  voiceIdFromDirectoryName: (directoryName: string) =>
    directoryName.startsWith('vits-piper-') ? directoryName.slice('vits-piper-'.length) : null,
  VOICE_ESPEAK_DATA_DIR_NAME: 'espeak-ng-data',
  VOICE_TOKENS_FILE_NAME: 'tokens.txt',
  mixTimelineAudio: vi.fn(),
  muxAudioIntoVideo: vi.fn(),
  verifyMixLoudness: vi.fn(),
}));

const ENV: NodeJS.ProcessEnv = {};
const CWD = '/var/data/media/acme-launch';
const STORE: StoreConfig = { mediaRoot: '/var/data/media', dbPath: '/var/data/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };

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
    ttsCli: '/opt/tts/bin/sherpa-onnx-offline-tts',
    ttsVoicesDir: '/voices',
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

  it('without REMOTION_SERVE_URL, renders through bundleProject as always (US-017-201)', async () => {
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

    await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: CWD,
    });

    const [, options] = mocks.renderTimelineMock.mock.calls[0] ?? [];
    expect(options).not.toHaveProperty('serveUrl');
    expect(options).not.toHaveProperty('browserExecutable');
  });

  it('with REMOTION_SERVE_URL and REMOTION_BROWSER_EXECUTABLE, copies the bundle into a writable cache dir next to the db and symlinks its public dir to the project root (US-017-201)', async () => {
    mocks.renderTimelineMock.mockResolvedValue({
      outPath: '/work/renders/r1/video-muted.mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
      compositionId: 'timeline-composition',
    });

    const sourceServeUrl = await mkdtemp(join(tmpdir(), 'remotion-bundle-source-'));
    await writeFile(join(sourceServeUrl, 'bundle.js'), 'console.log(1)');
    const publicDir = await mkdtemp(join(tmpdir(), 'project-root-'));
    const dataDir = await mkdtemp(join(tmpdir(), 'app-data-'));
    const store: StoreConfig = { ...STORE, dbPath: join(dataDir, '.studio', 'studio.db') };
    const env = {
      REMOTION_SERVE_URL: sourceServeUrl,
      REMOTION_BROWSER_EXECUTABLE: '/app/resources/chrome-headless-shell',
    };

    const deps = createNodeRenderApiDependencies(env, store);
    const timeline = buildMinimalTimeline();

    await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir,
    });

    const [, options] = mocks.renderTimelineMock.mock.calls[0] ?? [];
    const cachedServeUrl = (options as { serveUrl: string }).serveUrl;

    expect(cachedServeUrl).not.toBe(sourceServeUrl);
    expect(cachedServeUrl.startsWith(join(dataDir, '.studio', 'remotion-bundle'))).toBe(true);
    expect(await readFile(join(cachedServeUrl, 'bundle.js'), 'utf8')).toBe('console.log(1)');
    expect(mocks.renderTimelineMock).toHaveBeenCalledWith(
      timeline,
      expect.objectContaining({ browserExecutable: '/app/resources/chrome-headless-shell' }),
    );

    const linkTarget = await realpath(join(cachedServeUrl, 'public'));
    expect(linkTarget).toBe(await realpath(publicDir));

    await rm(sourceServeUrl, { recursive: true, force: true });
    await rm(publicDir, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('rendering twice with REMOTION_SERVE_URL reuses the cached copy and re-links the public dir to a different project root (US-017-201)', async () => {
    mocks.renderTimelineMock.mockResolvedValue({
      outPath: '/work/renders/r1/video-muted.mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
      compositionId: 'timeline-composition',
    });

    const sourceServeUrl = await mkdtemp(join(tmpdir(), 'remotion-bundle-source-'));
    await writeFile(join(sourceServeUrl, 'bundle.js'), 'console.log(1)');
    const firstProjectRoot = await mkdtemp(join(tmpdir(), 'project-a-'));
    const secondProjectRoot = await mkdtemp(join(tmpdir(), 'project-b-'));
    const dataDir = await mkdtemp(join(tmpdir(), 'app-data-'));
    const store: StoreConfig = { ...STORE, dbPath: join(dataDir, '.studio', 'studio.db') };
    const env = { REMOTION_SERVE_URL: sourceServeUrl };

    const deps = createNodeRenderApiDependencies(env, store);
    const timeline = buildMinimalTimeline();

    await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: firstProjectRoot,
    });
    await deps.renderMutedVideo({
      timeline,
      outPath: '/work/renders/r1/video-muted.mp4',
      publicDir: secondProjectRoot,
    });

    const [firstCall] = mocks.renderTimelineMock.mock.calls;
    const [secondCall] = mocks.renderTimelineMock.mock.calls.slice(1);
    const firstServeUrl = (firstCall?.[1] as { serveUrl: string }).serveUrl;
    const secondServeUrl = (secondCall?.[1] as { serveUrl: string }).serveUrl;
    expect(secondServeUrl).toBe(firstServeUrl);

    const linkTarget = await realpath(join(secondServeUrl, 'public'));
    expect(linkTarget).toBe(await realpath(secondProjectRoot));

    await rm(sourceServeUrl, { recursive: true, force: true });
    await rm(firstProjectRoot, { recursive: true, force: true });
    await rm(secondProjectRoot, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
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
      { name: 'ttsCli', envVar: 'TTS_CLI_PATH', resolved: true },
      { name: 'ttsVoicesDir', envVar: 'TTS_VOICES_DIR', resolved: true },
    ]);
    for (const status of statuses) {
      expect(status).not.toHaveProperty('path');
      expect(status).not.toHaveProperty('resolvedPath');
    }
  });

  it('synthesizeVoice invoca al motor de voz con el modelo, los tokens y el directorio de datos propio de la voz (US-09-004, US-017-201)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'tts-voices-'));
    const voiceDir = join(voicesDir, 'vits-piper-es_AR-daniela-high');
    await mkdir(voiceDir, { recursive: true });
    await mkdir(join(voiceDir, 'espeak-ng-data'), { recursive: true });
    await writeFile(join(voiceDir, 'es_AR-daniela-high.onnx'), 'model');
    await writeFile(join(voiceDir, 'tokens.txt'), 'tokens');

    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await deps.synthesizeVoice({
      textPath: 'work/voice/sources/scene-01.txt',
      outPath: 'work/voice/sources/scene-01.wav',
      modelPath: voiceDir,
      projectRoot: CWD,
    });

    expect(mocks.synthesizeSpeechMock).toHaveBeenCalledWith(
      'work/voice/sources/scene-01.wav',
      {
        modelPath: join(voiceDir, 'es_AR-daniela-high.onnx'),
        tokensPath: join(voiceDir, 'tokens.txt'),
        dataDirPath: join(voiceDir, 'espeak-ng-data'),
        textPath: 'work/voice/sources/scene-01.txt',
        ttsPath: '/opt/tts/bin/sherpa-onnx-offline-tts',
        runOptions: { cwd: CWD },
      },
      expect.any(mocks.ExecaCommandRunner),
    );

    await rm(voicesDir, { recursive: true, force: true });
  });

  it('synthesizeVoice cae al espeak-ng-data compartido en la raíz cuando la voz no trae el suyo (US-017-201)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'tts-voices-'));
    const voiceDir = join(voicesDir, 'vits-piper-es_ES-davefx-medium');
    await mkdir(voiceDir, { recursive: true });
    await mkdir(join(voicesDir, 'espeak-ng-data'), { recursive: true });
    await writeFile(join(voiceDir, 'es_ES-davefx-medium.onnx'), 'model');
    await writeFile(join(voiceDir, 'tokens.txt'), 'tokens');

    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await deps.synthesizeVoice({
      textPath: 'work/voice/sources/scene-01.txt',
      outPath: 'work/voice/sources/scene-01.wav',
      modelPath: voiceDir,
      projectRoot: CWD,
    });

    expect(mocks.synthesizeSpeechMock).toHaveBeenCalledWith(
      'work/voice/sources/scene-01.wav',
      expect.objectContaining({ dataDirPath: join(voicesDir, 'espeak-ng-data') }),
      expect.any(mocks.ExecaCommandRunner),
    );

    await rm(voicesDir, { recursive: true, force: true });
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

  it('listVoiceModels lee las subcarpetas vits-piper-<id> y descarta lo que no matchea ese prefijo (US-09-003, US-017-201)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'tts-voices-'));
    await mkdir(join(voicesDir, 'vits-piper-es_AR-daniela-high'), { recursive: true });
    await writeFile(join(voicesDir, 'vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx'), 'model');
    await writeFile(join(voicesDir, 'vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx.json'), '{}');
    await writeFile(join(voicesDir, 'README.md'), 'not a voice');
    mocks.resolveBinaryMock.mockImplementation(async (name: string) =>
      name === 'ttsVoicesDir' ? voicesDir : `/opt/homebrew/bin/${name}`,
    );
    const catalog = [
      {
        id: 'es_AR-daniela-high',
        directory: 'vits-piper-es_AR-daniela-high',
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
    const [files] = mocks.buildVoiceCatalogMock.mock.calls[0] ?? [];
    expect([...(files ?? [])]).toEqual([
      { directory: 'vits-piper-es_AR-daniela-high', fileName: 'es_AR-daniela-high.onnx', config: {} },
    ]);

    await rm(voicesDir, { recursive: true, force: true });
  });

  it('listVoiceModels lee el sidecar .onnx.json de cada voz y tolera uno corrupto (US-016-001, US-017-201)', async () => {
    const voicesDir = await mkdtemp(join(tmpdir(), 'tts-voices-'));
    await mkdir(join(voicesDir, 'vits-piper-es_AR-daniela-high'), { recursive: true });
    await writeFile(join(voicesDir, 'vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx'), 'model');
    await writeFile(
      join(voicesDir, 'vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx.json'),
      '{"dataset":"daniela"}',
    );
    await mkdir(join(voicesDir, 'vits-piper-es_MX-claude-high'), { recursive: true });
    await writeFile(join(voicesDir, 'vits-piper-es_MX-claude-high', 'es_MX-claude-high.onnx'), 'model');
    await writeFile(
      join(voicesDir, 'vits-piper-es_MX-claude-high', 'es_MX-claude-high.onnx.json'),
      'not json at all',
    );
    await mkdir(join(voicesDir, 'vits-piper-es_ES-davefx-medium'), { recursive: true });
    await writeFile(join(voicesDir, 'vits-piper-es_ES-davefx-medium', 'es_ES-davefx-medium.onnx'), 'model');
    mocks.resolveBinaryMock.mockImplementation(async (name: string) =>
      name === 'ttsVoicesDir' ? voicesDir : `/opt/homebrew/bin/${name}`,
    );
    mocks.buildVoiceCatalogMock.mockReturnValue([]);

    const deps = createNodeRenderApiDependencies(ENV, STORE);
    await deps.listVoiceModels();

    const [files] = mocks.buildVoiceCatalogMock.mock.calls[0] ?? [];
    const byFileName = new Map([...(files ?? [])].map((file) => [file.fileName, file.config]));

    expect(byFileName.get('es_AR-daniela-high.onnx')).toEqual({ dataset: 'daniela' });
    expect(byFileName.get('es_MX-claude-high.onnx')).toBeNull();
    expect(byFileName.get('es_ES-davefx-medium.onnx')).toBeNull();

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

  it('also lets the storage reach the user brands root and the built-in brands folder, nothing else beside them', async () => {
    const deps = createNodeRenderApiDependencies(ENV, STORE);

    await expect(deps.storage.stat(`${STORE.brandsRoot}/missing`)).resolves.toBeNull();
    await expect(deps.storage.stat(`${STORE.motionAssetsRoot}/brands/missing`)).resolves.toBeNull();
    await expect(deps.storage.stat(`${STORE.motionAssetsRoot}/runtime`)).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    await expect(deps.storage.stat(`${STORE.brandsRoot}/../escape`)).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
  });

  it('writes into work/.uploads and renames onto the final path against a real temporary directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-store-'));

    try {
      const store: StoreConfig = {
        mediaRoot: base,
        dbPath: join(base, '.studio', 'studio.db'),
        maxUploadBytes: 1024,
        objectStore: 'fs',
        motionAssetsRoot: join(base, 'assets'),
        brandsRoot: join(base, 'brands'),
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
