import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { concatVideoClips } from './concat-video-clips';

describe('concatVideoClips', () => {
  it('calls ffmpeg with the concat demuxer, -safe 0 and -c copy', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await concatVideoClips('list.txt', 'silent.mp4', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'list.txt',
      '-c',
      'copy',
      'silent.mp4',
    ]);
    expect(result).toBe('silent.mp4');
  });

  it('respects ffmpegPath and runOptions', async () => {
    const runner = new FixtureCommandRunner([{ bin: '/opt/homebrew/bin/ffmpeg', response: { exitCode: 0 } }]);

    await concatVideoClips('list.txt', 'silent.mp4', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });

  it('propagates CommandFailedError when ffmpeg fails', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found when processing input', exitCode: 1 } },
    ]);

    const failure = concatVideoClips('list.txt', 'silent.mp4', runner);

    await expect(failure).rejects.toBeInstanceOf(CommandFailedError);
    await expect(failure).rejects.toMatchObject({ command: 'ffmpeg', exitCode: 1 });
  });

  it('runs no real binary: the only I/O is the FixtureCommandRunner', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await concatVideoClips('list.txt', 'silent.mp4', runner);

    expect(runner.calls).toHaveLength(1);
  });
});
