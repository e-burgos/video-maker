import type { ResolvedBinaries } from '@video-maker/media-local';
import { describe, expect, it, vi } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createStageObservingCommandRunner } from './montage-command-runner-decorator';
import type { MontageStageObserver } from './montage-command-runner-decorator';

const BINARIES: ResolvedBinaries = {
  ffmpeg: '/opt/media-tools/bin/ffmpeg',
  ffprobe: '/opt/ffmpeg-tools/bin/ffprobe',
  whisperCli: '/opt/media-tools/bin/whisper-cli',
  whisperModel: '/opt/media-tools/share/ggml-model.bin',
};

function createSpyObserver(): MontageStageObserver & {
  stageStarted: ReturnType<typeof vi.fn>;
  assetProcessed: ReturnType<typeof vi.fn>;
} {
  return {
    stageStarted: vi.fn(),
    assetProcessed: vi.fn(),
  };
}

describe('createStageObservingCommandRunner', () => {
  it('delegates bin, args, opts and result exactly unchanged', async () => {
    const callLog = createCallLog();
    const base = createFakeCommandRunner(
      [{ bin: BINARIES.ffprobe, response: { stdout: 'probed', stderr: '', exitCode: 0 } }],
      callLog,
    );
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    const args = ['-show_streams', '-of', 'json', 'clip01.mp4'];
    const opts = { cwd: '/var/data/media/acme-launch', timeoutMs: 5000 };
    const result = await decorated.run(BINARIES.ffprobe, args, opts);

    expect(result).toEqual({ stdout: 'probed', stderr: '', exitCode: 0 });
    expect(base.calls).toEqual([{ bin: BINARIES.ffprobe, args, opts }]);
  });

  it('propagates a rejection from the underlying runner unchanged, without wrapping it', async () => {
    const failure = new Error('ffprobe exited with status 1');
    const base = createFakeCommandRunner([{ bin: BINARIES.ffprobe, response: { reject: failure } }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await expect(decorated.run(BINARIES.ffprobe, [], undefined)).rejects.toBe(failure);
  });

  it('classifies an ffprobe invocation as the probe stage and counts it as a processed asset', async () => {
    const base = createFakeCommandRunner([{ bin: BINARIES.ffprobe, response: {} }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.ffprobe, ['clip01.mp4'], undefined);

    expect(observer.stageStarted).toHaveBeenCalledWith('probe');
    expect(observer.stageStarted).not.toHaveBeenCalledWith('transcribe');
    expect(observer.assetProcessed).toHaveBeenCalledWith('probe');
    expect(observer.assetProcessed).not.toHaveBeenCalledWith('transcribe');
  });

  it('classifies an ffmpeg invocation as the transcribe stage but does not count it as a processed asset', async () => {
    const base = createFakeCommandRunner([{ bin: BINARIES.ffmpeg, response: {} }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.ffmpeg, ['-i', 'clip01.mp4', 'audio.wav'], undefined);

    expect(observer.stageStarted).toHaveBeenCalledWith('transcribe');
    expect(observer.assetProcessed).not.toHaveBeenCalled();
  });

  it('classifies a whisper-cli invocation as the transcribe stage and counts it as a processed asset', async () => {
    const base = createFakeCommandRunner([{ bin: BINARIES.whisperCli, response: {} }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.whisperCli, ['audio.wav'], undefined);

    expect(observer.stageStarted).toHaveBeenCalledWith('transcribe');
    expect(observer.assetProcessed).toHaveBeenCalledWith('transcribe');
    expect(observer.assetProcessed).toHaveBeenCalledTimes(1);
  });

  it('delegates an unrecognized binary without touching the stage or the asset counter', async () => {
    const otherBin = '/usr/bin/git';
    const base = createFakeCommandRunner([{ bin: otherBin, response: { stdout: 'v2.40.0' } }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    const result = await decorated.run(otherBin, ['--version'], undefined);

    expect(result).toEqual({ stdout: 'v2.40.0', stderr: '', exitCode: 0 });
    expect(observer.stageStarted).not.toHaveBeenCalled();
    expect(observer.assetProcessed).not.toHaveBeenCalled();
  });

  it('classifies binaries.ffprobe as probe even though its resolved path contains the literal substring "ffmpeg"', async () => {
    expect(BINARIES.ffprobe.includes('ffmpeg')).toBe(true);

    const base = createFakeCommandRunner([{ bin: BINARIES.ffprobe, response: {} }]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.ffprobe, [], undefined);

    expect(observer.stageStarted).toHaveBeenCalledWith('probe');
    expect(observer.stageStarted).not.toHaveBeenCalledWith('transcribe');
  });

  it('never emits the probe stage when no invocation classifies as ffprobe', async () => {
    const base = createFakeCommandRunner([
      { bin: BINARIES.ffmpeg, response: {} },
      { bin: BINARIES.whisperCli, response: {} },
    ]);
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.ffmpeg, [], undefined);
    await decorated.run(BINARIES.whisperCli, [], undefined);

    expect(observer.stageStarted).not.toHaveBeenCalledWith('probe');
    expect(observer.stageStarted.mock.calls.every(([stage]: [string]) => stage === 'transcribe')).toBe(true);
  });

  it('preserves the invocation order of the underlying runner for a probe-then-transcribe sequence', async () => {
    const callLog = createCallLog();
    const base = createFakeCommandRunner(
      [
        { bin: BINARIES.ffprobe, response: {} },
        { bin: BINARIES.ffmpeg, response: {} },
        { bin: BINARIES.whisperCli, response: {} },
      ],
      callLog,
    );
    const observer = createSpyObserver();
    const decorated = createStageObservingCommandRunner(base, BINARIES, observer);

    await decorated.run(BINARIES.ffprobe, ['a.mp4'], undefined);
    await decorated.run(BINARIES.ffmpeg, ['a.mp4', 'a.wav'], undefined);
    await decorated.run(BINARIES.whisperCli, ['a.wav'], undefined);

    expect(base.calls.map((call) => call.bin)).toEqual([BINARIES.ffprobe, BINARIES.ffmpeg, BINARIES.whisperCli]);
    expect(callLog.ports()).toEqual(['commandRunner.run', 'commandRunner.run', 'commandRunner.run']);
  });

  it('holds no state of its own across two independently created decorators', async () => {
    const firstObserver = createSpyObserver();
    const secondObserver = createSpyObserver();
    const firstRunner = createStageObservingCommandRunner(
      createFakeCommandRunner([{ bin: BINARIES.ffprobe, response: {} }]),
      BINARIES,
      firstObserver,
    );
    const secondRunner = createStageObservingCommandRunner(
      createFakeCommandRunner([{ bin: BINARIES.whisperCli, response: {} }]),
      BINARIES,
      secondObserver,
    );

    await firstRunner.run(BINARIES.ffprobe, [], undefined);
    await secondRunner.run(BINARIES.whisperCli, [], undefined);

    expect(firstObserver.stageStarted).toHaveBeenCalledWith('probe');
    expect(firstObserver.stageStarted).not.toHaveBeenCalledWith('transcribe');
    expect(secondObserver.stageStarted).toHaveBeenCalledWith('transcribe');
    expect(secondObserver.stageStarted).not.toHaveBeenCalledWith('probe');
  });
});
