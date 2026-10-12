import { describe, expect, it } from 'vitest';

import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { adaptiveSceneThreshold, detectSceneCuts, parseSceneScores, pickSceneCuts, sceneScoreArgs } from './detect-scene-cuts';
import { buildScenesFromCuts, extractSceneKeyframes, sceneMidpointSec } from './extract-scene-keyframes';

const METADATA_STDERR = `Input #0, mov,mp4, from 'v.mp4':
[Parsed_metadata_3 @ 0x6000] frame:0    pts:0       pts_time:0
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.000000
[Parsed_metadata_3 @ 0x6000] frame:1    pts:1       pts_time:0.25
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.010000
[Parsed_metadata_3 @ 0x6000] frame:2    pts:2       pts_time:2.5
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.120000
[Parsed_metadata_3 @ 0x6000] frame:3    pts:3       pts_time:2.75
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.080000
[Parsed_metadata_3 @ 0x6000] frame:4    pts:4       pts_time:5
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.900000
[Parsed_metadata_3 @ 0x6000] frame:5    pts:5       pts_time:5.25
[Parsed_metadata_3 @ 0x6000] lavfi.scene_score=0.010000
frame=  6 fps=0.0
`;

function scoresAt(...pairs: [number, number][]) {
  return pairs.map(([atSec, score]) => ({ atSec, score }));
}

describe('parseSceneScores', () => {
  it('pairs each sampled frame time with its scene score', () => {
    expect(parseSceneScores(METADATA_STDERR)).toEqual(
      scoresAt([0, 0], [0.25, 0.01], [2.5, 0.12], [2.75, 0.08], [5, 0.9], [5.25, 0.01]),
    );
  });

  it('returns nothing when ffmpeg printed no frame', () => {
    expect(parseSceneScores('frame=  150 fps=0.0')).toEqual([]);
  });
});

describe('adaptiveSceneThreshold', () => {
  it('stays at the floor for a calm video so soft transitions still count', () => {
    const calm = scoresAt(...Array.from({ length: 40 }, (_, index): [number, number] => [index / 4, 0.005]));
    expect(adaptiveSceneThreshold(calm)).toBe(0.05);
  });

  it('never rises above the ceiling so hard cuts survive in busy footage', () => {
    const busy = scoresAt(...Array.from({ length: 40 }, (_, index): [number, number] => [index / 4, index % 2 === 0 ? 0 : 0.9]));
    expect(adaptiveSceneThreshold(busy)).toBe(0.3);
  });
});

describe('pickSceneCuts', () => {
  it('keeps local peaks above the threshold and drops the start of the video', () => {
    const scores = scoresAt([0, 0], [0.25, 0.4], [0.5, 0], [2.5, 0.12], [2.75, 0.08], [5, 0.9], [5.25, 0.01]);
    expect(pickSceneCuts(scores, 0.05, 1.5)).toEqual([2.5, 5]);
  });

  it('keeps only the strongest peak of a transition spread over several frames', () => {
    const scores = scoresAt([4, 0.1], [4.25, 0.02], [4.5, 0.3], [4.75, 0.01], [9, 0.2]);
    expect(pickSceneCuts(scores, 0.05, 1.5)).toEqual([4.5, 9]);
  });
});

describe('detectSceneCuts', () => {
  it('samples scene scores and picks cuts with the adaptive threshold', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: [/fps=4,scale=320:-2,select='gte\(scene,0\)',metadata=print/], response: { stderr: METADATA_STDERR, exitCode: 0 } },
    ]);

    await expect(detectSceneCuts('/v.mp4', runner)).resolves.toEqual([5]);
    expect(sceneScoreArgs('/v.mp4')).toContain('-an');
  });

  it('uses a fixed threshold when one is given', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', argsPattern: [], response: { stderr: METADATA_STDERR, exitCode: 0 } }]);

    await expect(detectSceneCuts('/v.mp4', runner, { threshold: 0.1 })).resolves.toEqual([2.5, 5]);
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
