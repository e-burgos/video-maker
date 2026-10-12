import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFfmpegReviewMeasurements } from './review-measurements';
import { extractSceneFrames, sceneFrameFile, sceneFramesDirectory } from './scene-frames';

const project = resolveMediaProject('/media/demo');

describe('scene frame paths', () => {
  it('puts the frames in a folder named after the render', () => {
    expect(sceneFramesDirectory('out/video.mp4')).toBe('out/video.review');
    expect(sceneFrameFile('out/video.mp4', 3)).toBe('out/video.review/scene-03.jpg');
  });
});

describe('extractSceneFrames', () => {
  it('runs ffmpeg once per scene at its midpoint, 960 px on the long side, into the review folder', async () => {
    const runner = createFakeCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);
    const created: string[] = [];

    const frames = await extractSceneFrames(
      { project, file: 'out/video.mp4', durationSec: 10, scenes: [{ id: 'a', startSec: 0, endSec: 4, voice: 'Hola' }, { id: 'b', startSec: 4, endSec: 10, voice: null }] },
      { stat: () => Promise.resolve(null), readTextFile: () => Promise.resolve(''), ensureDirectory: (path) => { created.push(path); return Promise.resolve(); } },
      createFfmpegReviewMeasurements(runner, { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }),
    );

    expect(created).toEqual(['/media/demo/out/video.review']);
    const calls = runner.callsFor('ffmpeg');
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args).toEqual(expect.arrayContaining(['-ss', '2', '-i', '/media/demo/out/video.mp4']));
    expect(calls[0]?.args.at(-1)).toBe('/media/demo/out/video.review/scene-01.jpg');
    expect(calls[0]?.args.join(' ')).toContain('960');
    expect(calls[1]?.args).toEqual(expect.arrayContaining(['-ss', '7']));
    expect(frames.map((frame) => [frame.sceneId, frame.atSec, frame.frame, frame.voice])).toEqual([
      ['a', 2, 'out/video.review/scene-01.jpg', 'Hola'],
      ['b', 7, 'out/video.review/scene-02.jpg', undefined],
    ]);
  });

  it('keeps the frame inside the render when the scene runs past its end', async () => {
    const runner = createFakeCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 0 } }]);

    const frames = await extractSceneFrames(
      { project, file: 'out/video.mp4', durationSec: 10, scenes: [{ id: 'a', startSec: 9, endSec: 30, voice: null }] },
      { stat: () => Promise.resolve(null), readTextFile: () => Promise.resolve(''), ensureDirectory: () => Promise.resolve() },
      createFfmpegReviewMeasurements(runner, { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }),
    );

    expect(frames[0]?.atSec).toBeCloseTo(9.95, 5);
  });

  it('creates nothing without scenes', async () => {
    const runner = createFakeCommandRunner([]);
    const created: string[] = [];

    const frames = await extractSceneFrames(
      { project, file: 'out/video.mp4', durationSec: 10, scenes: [] },
      { stat: () => Promise.resolve(null), readTextFile: () => Promise.resolve(''), ensureDirectory: (path) => { created.push(path); return Promise.resolve(); } },
      createFfmpegReviewMeasurements(runner, { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }),
    );

    expect(frames).toEqual([]);
    expect(created).toEqual([]);
    expect(runner.calls).toEqual([]);
  });

  it('fails when ffmpeg cannot extract the frame', async () => {
    const runner = createFakeCommandRunner([{ bin: 'ffmpeg', response: { exitCode: 1, stderr: 'boom' } }]);

    await expect(
      extractSceneFrames(
        { project, file: 'out/video.mp4', durationSec: 10, scenes: [{ id: 'a', startSec: 0, endSec: 4, voice: null }] },
        { stat: () => Promise.resolve(null), readTextFile: () => Promise.resolve(''), ensureDirectory: () => Promise.resolve() },
        createFfmpegReviewMeasurements(runner, { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' }),
      ),
    ).rejects.toThrow();
  });
});
