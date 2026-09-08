import type { ReadTextFile } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { StageFailedError } from '../errors/stage-failed-error';
import { fixtureMediaProject } from '../__fixtures__/media-project';

import { readTimelineDocument } from './read-timeline-document';

const VALID_TIMELINE = {
  schemaVersion: 1,
  id: 'timeline-1',
  format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
  durationFrames: 30,
  assets: [],
  tracks: { aroll: [], broll: [], voice: [], music: [], captions: [] },
  audioMix: { voice: {}, music: {}, automation: [] },
};

function readTextFileReturning(content: string): ReadTextFile {
  return async () => content;
}

describe('readTimelineDocument', () => {
  it('parses and returns a valid timeline.json', async () => {
    const deps = { readTextFile: readTextFileReturning(JSON.stringify(VALID_TIMELINE)) };

    const timeline = await readTimelineDocument(fixtureMediaProject, deps);

    expect(timeline.id).toBe(VALID_TIMELINE.id);
    expect(timeline.format).toEqual(VALID_TIMELINE.format);
    expect(timeline.durationFrames).toBe(VALID_TIMELINE.durationFrames);
    expect(timeline.tracks).toEqual(VALID_TIMELINE.tracks);
  });

  it('throws STAGE_FAILED/TIMELINE_UNREADABLE for broken JSON', async () => {
    const deps = { readTextFile: readTextFileReturning('{ not json') };

    const error = await readTimelineDocument(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).stage).toBe('render');
    expect((error as StageFailedError).reason).toBe('TIMELINE_UNREADABLE');
    expect((error as StageFailedError).resource).toBe('work/timeline.json');
  });

  it('throws STAGE_FAILED/TIMELINE_UNREADABLE for JSON that parses but fails TimelineSchema', async () => {
    const deps = { readTextFile: readTextFileReturning(JSON.stringify({ ...VALID_TIMELINE, schemaVersion: 2 })) };

    const error = await readTimelineDocument(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).stage).toBe('render');
    expect((error as StageFailedError).reason).toBe('TIMELINE_UNREADABLE');
  });
});
