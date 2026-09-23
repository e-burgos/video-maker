import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import {
  buildKenBurnsClip,
  DEFAULT_KEN_BURNS_FPS,
  DEFAULT_KEN_BURNS_MAX_ZOOM,
  DEFAULT_KEN_BURNS_OUTPUT_HEIGHT,
  DEFAULT_KEN_BURNS_OUTPUT_WIDTH,
  DEFAULT_KEN_BURNS_SCALE_HEIGHT,
  DEFAULT_KEN_BURNS_SCALE_WIDTH,
  DEFAULT_KEN_BURNS_ZOOM_STEP,
  kenBurnsFilter,
} from './ken-burns-clip';

describe('kenBurnsFilter', () => {
  it('scales before cropping, escapes the zoompan comma and never adds -t', () => {
    const filter = kenBurnsFilter({
      scaleWidth: 2160,
      scaleHeight: 3840,
      zoomStep: 0.0015,
      maxZoom: 1.25,
      frames: 90,
      outputWidth: 1080,
      outputHeight: 1920,
      fps: 30,
    });

    expect(filter).toBe(
      'scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z=min(zoom+0.0015\\,1.25):d=90:s=1080x1920:fps=30,format=yuv420p',
    );
  });
});

describe('buildKenBurnsClip', () => {
  it('calls ffmpeg with -loop 1, -frames:v equal to d= and no -t, using the defaults', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await buildKenBurnsClip('photo.jpg', 90, 'clip.mp4', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-loop',
      '1',
      '-i',
      'photo.jpg',
      '-vf',
      kenBurnsFilter({
        scaleWidth: DEFAULT_KEN_BURNS_SCALE_WIDTH,
        scaleHeight: DEFAULT_KEN_BURNS_SCALE_HEIGHT,
        zoomStep: DEFAULT_KEN_BURNS_ZOOM_STEP,
        maxZoom: DEFAULT_KEN_BURNS_MAX_ZOOM,
        frames: 90,
        outputWidth: DEFAULT_KEN_BURNS_OUTPUT_WIDTH,
        outputHeight: DEFAULT_KEN_BURNS_OUTPUT_HEIGHT,
        fps: DEFAULT_KEN_BURNS_FPS,
      }),
      '-frames:v',
      '90',
      '-c:v',
      'libx264',
      '-r',
      '30',
      'clip.mp4',
    ]);
    expect(runner.calls[0]?.args).not.toContain('-t');
    expect(result).toBe('clip.mp4');
  });

  it('keeps -frames:v exactly equal to the frames argument for an arbitrary duration', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await buildKenBurnsClip('photo.jpg', 74, 'clip.mp4', runner);

    const framesIndex = runner.calls[0]?.args.indexOf('-frames:v') ?? -1;
    expect(runner.calls[0]?.args[framesIndex + 1]).toBe('74');
    const filterArg = runner.calls[0]?.args[runner.calls[0].args.indexOf('-vf') + 1] ?? '';
    expect(filterArg).toContain('d=74');
  });

  it('respects ffmpegPath and runOptions', async () => {
    const runner = new FixtureCommandRunner([{ bin: '/opt/homebrew/bin/ffmpeg', response: { exitCode: 0 } }]);

    await buildKenBurnsClip('photo.jpg', 30, 'clip.mp4', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });

  it('propagates CommandFailedError with truncated stderr when ffmpeg fails', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found when processing input', exitCode: 1 } },
    ]);

    const failure = buildKenBurnsClip('photo.jpg', 30, 'clip.mp4', runner);

    await expect(failure).rejects.toBeInstanceOf(CommandFailedError);
    await expect(failure).rejects.toMatchObject({ command: 'ffmpeg', exitCode: 1 });
  });

  it('runs no real binary: the only I/O is the FixtureCommandRunner', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await buildKenBurnsClip('photo.jpg', 30, 'clip.mp4', runner);

    expect(runner.calls).toHaveLength(1);
  });
});
