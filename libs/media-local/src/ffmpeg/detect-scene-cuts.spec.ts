import { describe, expect, it } from 'vitest';

import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { detectSceneCuts, mergeCloseCuts, parseShowinfoCutTimes, sceneCutArgs } from './detect-scene-cuts';
import { buildScenesFromCuts, extractSceneKeyframes, sceneMidpointSec } from './extract-scene-keyframes';

const SHOWINFO_STDERR = `Input #0, mov,mp4, from 'v.mp4':
[Parsed_showinfo_1 @ 0x6000] n:   0 pts:  76800 pts_time:3.2     duration:   512 duration_time:0.0213333 fmt:yuv420p
[Parsed_showinfo_1 @ 0x6000] n:   1 pts: 153600 pts_time:6.4     duration:   512 duration_time:0.0213333 fmt:yuv420p
[Parsed_showinfo_1 @ 0x6000] n:   2 pts: 156000 pts_time:6.5     duration:   512 duration_time:0.0213333 fmt:yuv420p
frame=  150 fps=0.0
`;

describe('parseShowinfoCutTimes', () => {
  it('reads pts_time of each selected frame', () => {
    expect(parseShowinfoCutTimes(SHOWINFO_STDERR)).toEqual([3.2, 6.4, 6.5]);
  });

  it('returns nothing when ffmpeg selected no frame', () => {
    expect(parseShowinfoCutTimes('frame=  150 fps=0.0')).toEqual([]);
  });
});

describe('mergeCloseCuts', () => {
  it('drops cuts closer than the minimum scene length to the previous cut', () => {
    expect(mergeCloseCuts([3.2, 6.4, 6.5], 0.4)).toEqual([3.2, 6.4]);
  });

  it('drops a cut too close to the start of the video', () => {
    expect(mergeCloseCuts([0.1, 2], 0.4)).toEqual([2]);
  });
});

describe('detectSceneCuts', () => {
  it('builds the select filter with the threshold and merges the result', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: [/select='gt\(scene,0\.3\)',showinfo/], response: { stderr: SHOWINFO_STDERR, exitCode: 0 } },
    ]);

    await expect(detectSceneCuts('/v.mp4', runner)).resolves.toEqual([3.2, 6.4]);
    expect(sceneCutArgs('/v.mp4', 0.5)).toContain("select='gt(scene,0.5)',showinfo");
  });
});

describe('buildScenesFromCuts', () => {
  it('turns cuts into consecutive scenes covering the whole video', () => {
    expect(buildScenesFromCuts([3.2, 6.4], 10, 0.4)).toEqual([
      { index: 0, startSec: 0, endSec: 3.2, durationSec: 3.2 },
      { index: 1, startSec: 3.2, endSec: 6.4, durationSec: 3.2 },
      { index: 2, startSec: 6.4, endSec: 10, durationSec: 3.6 },
    ]);
  });

  it('returns one scene when there are no cuts and ignores a cut at the very end', () => {
    expect(buildScenesFromCuts([9.9], 10, 0.4)).toEqual([{ index: 0, startSec: 0, endSec: 10, durationSec: 10 }]);
  });
});

describe('extractSceneKeyframes', () => {
  it('extracts one frame per scene at its midpoint', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', argsPattern: [], response: { stderr: '', exitCode: 0 } }]);
    const scenes = buildScenesFromCuts([4], 10, 0.4);

    const keyframes = await extractSceneKeyframes('/v.mp4', scenes, (scene) => `/out/scene-${scene.index}.jpg`, runner);

    expect(keyframes).toEqual([
      { index: 0, atSec: 2, path: '/out/scene-0.jpg' },
      { index: 1, atSec: 7, path: '/out/scene-1.jpg' },
    ]);
    expect(sceneMidpointSec(scenes[1] as (typeof scenes)[number])).toBe(7);
  });
});
