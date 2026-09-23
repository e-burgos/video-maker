import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import {
  DEFAULT_EXTRACT_FRAME_MAX_LONG_SIDE_PX,
  DEFAULT_EXTRACT_FRAME_QUALITY,
  extractFrame,
  extractFrameScaleFilter,
} from './extract-frame';

describe('extractFrame', () => {
  it('llama a ffmpeg con los argumentos exactos usando los defaults', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const result = await extractFrame('input.mp4', 4.5, 'frame.jpg', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-ss',
      '4.5',
      '-i',
      'input.mp4',
      '-frames:v',
      '1',
      '-vf',
      extractFrameScaleFilter(DEFAULT_EXTRACT_FRAME_MAX_LONG_SIDE_PX),
      '-q:v',
      String(DEFAULT_EXTRACT_FRAME_QUALITY),
      'frame.jpg',
    ]);
    expect(result).toBe('frame.jpg');
  });

  it('respeta maxLongSidePx y quality no default', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    await extractFrame('input.mp4', 0, 'frame.jpg', runner, { maxLongSidePx: 1024, quality: 5 });

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-ss',
      '0',
      '-i',
      'input.mp4',
      '-frames:v',
      '1',
      '-vf',
      extractFrameScaleFilter(1024),
      '-q:v',
      '5',
      'frame.jpg',
    ]);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffmpeg', response: { exitCode: 0 } },
    ]);

    await extractFrame('input.mp4', 1, 'frame.jpg', runner, {
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

    const failure = extractFrame('input.mp4', 1, 'frame.jpg', runner);

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

    await extractFrame('input.mp4', 1, 'frame.jpg', runner);

    expect(runner.calls).toHaveLength(1);
  });
});

describe('extractFrameScaleFilter', () => {
  it('escapa las comas del filtro if() para el parser de ffmpeg', () => {
    expect(extractFrameScaleFilter(768)).toBe(
      'scale=if(gt(iw\\,ih)\\,768\\,-2):if(gt(iw\\,ih)\\,-2\\,768)',
    );
  });
});
