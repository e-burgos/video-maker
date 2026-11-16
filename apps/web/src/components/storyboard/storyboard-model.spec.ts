import { describe, expect, it } from 'vitest';

import { storyboardFixture } from '../../api/__fixtures__/storyboard';
import { setSceneText } from '../../api/storyboard-edit/storyboard-document';
import { formatClock, formatSceneSeconds, sceneStatuses, sceneTimings } from './storyboard-model';

describe('sceneTimings', () => {
  it('chains the estimated durations from zero', () => {
    const timings = sceneTimings(storyboardFixture().scenes);

    expect(timings.get('scene-01')).toEqual({ startMs: 0, endMs: 4200 });
    expect(timings.get('scene-02')).toEqual({ startMs: 4200, endMs: 9200 });
    expect(timings.get('scene-03')).toEqual({ startMs: 9200, endMs: 13000 });
  });
});

describe('clock formatting', () => {
  it('writes minutes and padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9200)).toBe('0:09');
    expect(formatClock(75_400)).toBe('1:15');
  });

  it('rounds a scene length to whole seconds', () => {
    expect(formatSceneSeconds(4200)).toBe('4');
    expect(formatSceneSeconds(4600)).toBe('5');
  });
});

describe('sceneStatuses', () => {
  it('marks every scene ready when nothing differs from the stored storyboard', () => {
    const stored = storyboardFixture();
    const statuses = sceneStatuses(stored, stored);

    expect([...statuses.values()]).toEqual(['ready', 'ready', 'ready']);
  });

  it('marks the edited scene and leaves the rest ready', () => {
    const stored = storyboardFixture();
    const draft = setSceneText(stored, 'scene-02', 'narration', 'Otra narración.');
    const statuses = sceneStatuses(draft, stored);

    expect(statuses.get('scene-01')).toBe('ready');
    expect(statuses.get('scene-02')).toBe('edited');
  });

  it('marks a scene that no longer validates as incomplete before edited', () => {
    const stored = storyboardFixture();
    const draft = setSceneText(stored, 'scene-03', 'narration', '');
    const statuses = sceneStatuses(draft, stored);

    expect(statuses.get('scene-03')).toBe('incomplete');
    expect(statuses.get('scene-01')).toBe('ready');
  });
});
