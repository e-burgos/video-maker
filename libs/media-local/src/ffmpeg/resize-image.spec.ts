import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { extractFrameScaleFilter } from './extract-frame';
import { DEFAULT_RESIZE_IMAGE_MAX_LONG_SIDE_PX, DEFAULT_RESIZE_IMAGE_QUALITY, resizeImage } from './resize-image';

describe('resizeImage', () => {
  it('llama a ffmpeg con los argumentos exactos usando los defaults, sin -ss', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await resizeImage('photo.jpg', 'preview.jpg', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      'photo.jpg',
      '-frames:v',
      '1',
      '-vf',
      extractFrameScaleFilter(DEFAULT_RESIZE_IMAGE_MAX_LONG_SIDE_PX),
      '-q:v',
      String(DEFAULT_RESIZE_IMAGE_QUALITY),
      'preview.jpg',
    ]);
    expect(result).toBe('preview.jpg');
  });

  it('respeta maxLongSidePx y quality no default', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await resizeImage('photo.jpg', 'preview.jpg', runner, { maxLongSidePx: 640, quality: 5 });

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      'photo.jpg',
      '-frames:v',
      '1',
      '-vf',
      extractFrameScaleFilter(640),
      '-q:v',
      '5',
      'preview.jpg',
    ]);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([{ bin: '/opt/homebrew/bin/ffmpeg', response: { exitCode: 0 } }]);

    await resizeImage('photo.jpg', 'preview.jpg', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });

  it('propaga CommandFailedError con stderr truncado cuando ffmpeg falla', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found when processing input', exitCode: 1 } },
    ]);

    const failure = resizeImage('photo.jpg', 'preview.jpg', runner);

    await expect(failure).rejects.toBeInstanceOf(CommandFailedError);
    await expect(failure).rejects.toMatchObject({
      command: 'ffmpeg',
      exitCode: 1,
      stderr: 'Invalid data found when processing input',
      stderrTruncated: false,
    });
  });

  it('no ejecuta ningun binario real: el unico I/O es el FixtureCommandRunner', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await resizeImage('photo.jpg', 'preview.jpg', runner);

    expect(runner.calls).toHaveLength(1);
  });
});
