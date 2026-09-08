import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  },
  resolveBinary: vi.fn(),
  mixTimelineAudio: vi.fn(),
  muxAudioIntoVideo: vi.fn(),
  verifyMixLoudness: vi.fn(),
}));

const ENV: NodeJS.ProcessEnv = {};
const CWD = '/var/data/media/acme-launch';

async function loadMocks() {
  const render = await import('@video-maker/composition-remotion/render');
  const mediaLocal = await import('@video-maker/media-local');

  return {
    renderTimelineMock: vi.mocked(render.renderTimeline),
    resolveBinaryMock: vi.mocked(mediaLocal.resolveBinary),
    mixTimelineAudioMock: vi.mocked(mediaLocal.mixTimelineAudio),
    muxAudioIntoVideoMock: vi.mocked(mediaLocal.muxAudioIntoVideo),
    verifyMixLoudnessMock: vi.mocked(mediaLocal.verifyMixLoudness),
    ExecaCommandRunner: mediaLocal.ExecaCommandRunner,
  };
}

let mocks: Awaited<ReturnType<typeof loadMocks>>;

beforeEach(async () => {
  mocks = await loadMocks();
  mocks.renderTimelineMock.mockReset();
  mocks.resolveBinaryMock.mockReset();
  mocks.mixTimelineAudioMock.mockReset();
  mocks.muxAudioIntoVideoMock.mockReset();
  mocks.verifyMixLoudnessMock.mockReset();

  mocks.resolveBinaryMock.mockImplementation(async (name: string) => `/opt/homebrew/bin/${name}`);
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

    const deps = createNodeRenderApiDependencies(ENV);
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

  it('feeds mixTimelineAudio with the timeline, the out path and the resolved ffmpeg binary', async () => {
    mocks.mixTimelineAudioMock.mockResolvedValue({
      outputPath: '/work/renders/r1/master.wav',
      filterComplex: '[0:a]anull[out]',
    });

    const deps = createNodeRenderApiDependencies(ENV);
    const timeline = buildMinimalTimeline();

    const result = await deps.mixTimelineAudio({ timeline, outPath: '/work/renders/r1/master.wav' });

    expect(mocks.mixTimelineAudioMock).toHaveBeenCalledWith(
      timeline,
      '/work/renders/r1/master.wav',
      expect.any(mocks.ExecaCommandRunner),
      { ffmpegPath: '/opt/homebrew/bin/ffmpeg' },
    );
    expect(result).toEqual({ outputPath: '/work/renders/r1/master.wav', filterComplex: '[0:a]anull[out]' });
  });

  it('feeds muxAudioIntoVideo with the flattened video, audio and out paths plus the resolved binaries', async () => {
    mocks.muxAudioIntoVideoMock.mockResolvedValue({ outputPath: '/out/r1.mp4' });

    const deps = createNodeRenderApiDependencies(ENV);
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

    const deps = createNodeRenderApiDependencies(ENV);
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

    const deps = createNodeRenderApiDependencies(ENV);
    const timeline = buildMinimalTimeline();

    await deps.mixTimelineAudio({ timeline, outPath: '/work/renders/r1/master.wav' });
    await deps.muxAudioIntoVideo({
      videoPath: '/work/renders/r1/video-muted.mp4',
      audioPath: '/work/renders/r1/master.wav',
      outPath: '/out/r1.mp4',
    });

    expect(mocks.resolveBinaryMock).toHaveBeenCalledTimes(2);
    expect(mocks.resolveBinaryMock).toHaveBeenCalledWith('ffmpeg', ENV);
    expect(mocks.resolveBinaryMock).toHaveBeenCalledWith('ffprobe', ENV);
  });

  it('reports each binary by logical name and env var, live-checking without reusing the memoized resolution', async () => {
    mocks.resolveBinaryMock.mockImplementation(async (name: string) => {
      if (name === 'ffprobe') {
        throw new Error('not found');
      }
      return `/opt/homebrew/bin/${name}`;
    });

    const deps = createNodeRenderApiDependencies(ENV);
    const statuses = await deps.probeMediaBinaries();

    expect(statuses).toEqual([
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: false },
    ]);
  });

  it('reports both engine modules as loaded once the dynamic imports resolve', async () => {
    const deps = createNodeRenderApiDependencies(ENV);
    const statuses = await deps.preloadEngineModules();

    expect(statuses).toEqual([
      { name: 'media-local', loaded: true },
      { name: 'composition-remotion/render', loaded: true },
    ]);
  });

  it('creates the directory recursively via ensureDirectory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'render-api-'));
    const nested = join(base, 'a', 'b', 'c');

    try {
      const deps = createNodeRenderApiDependencies(ENV);
      await deps.ensureDirectory(nested);

      const info = await stat(nested);
      expect(info.isDirectory()).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('produces an ISO timestamp from the system clock', () => {
    const deps = createNodeRenderApiDependencies(ENV);
    const before = Date.now();
    const iso = deps.clock.nowIso();
    const after = Date.now();

    const parsed = new Date(iso).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('keeps the logger as a no-op in this cycle', () => {
    const deps = createNodeRenderApiDependencies(ENV);

    expect(deps.logger.info({ event: 'anything' })).toBeUndefined();
    expect(deps.logger.error({ event: 'anything' })).toBeUndefined();
  });
});
