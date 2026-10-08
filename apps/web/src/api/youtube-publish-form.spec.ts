import { describe, expect, it } from 'vitest';

import {
  addTags,
  buildPublishInput,
  emptyPublishFormValues,
  formatPublishDuration,
  localDateTimeValue,
  publishIssues,
  removeTag,
  tagsCharCount,
} from './youtube-publish-form';
import type { YouTubePublishFormValues } from './youtube-publish-form';

const NOW = new Date(2026, 9, 8, 12, 0, 0);

function values(overrides: Partial<YouTubePublishFormValues> = {}): YouTubePublishFormValues {
  return { ...emptyPublishFormValues('public', 'out/video.mp4'), title: 'A title', ...overrides };
}

describe('youtube publish form', () => {
  it('accepts a complete form', () => {
    expect(publishIssues(values(), NOW)).toEqual([]);
  });

  it('rejects a missing file and an empty title', () => {
    expect(publishIssues(values({ file: '', title: '   ' }), NOW)).toEqual(['fileMissing', 'titleEmpty']);
  });

  it('enforces the title, description and tag limits', () => {
    const issues = publishIssues(
      values({ title: 'x'.repeat(101), description: 'y'.repeat(5001), tags: ['z'.repeat(501)] }),
      NOW,
    );

    expect(issues).toEqual(['titleTooLong', 'descriptionTooLong', 'tagsTooLong']);
  });

  it('requires a future moment when scheduled', () => {
    expect(publishIssues(values({ scheduled: true }), NOW)).toEqual(['scheduleMissing']);
    expect(publishIssues(values({ scheduled: true, publishAtLocal: '2026-10-08T11:00' }), NOW)).toEqual([
      'scheduleNotFuture',
    ]);
    expect(publishIssues(values({ scheduled: true, publishAtLocal: '2026-10-09T09:30' }), NOW)).toEqual([]);
  });

  it('adds tags splitting on commas, trimming hashes and ignoring duplicates', () => {
    expect(addTags(['Cats'], '#dogs, cats , birds\nfish')).toEqual(['Cats', 'dogs', 'birds', 'fish']);
  });

  it('removes a tag and counts the characters of the rest', () => {
    const tags = removeTag(['one', 'three'], 'one');

    expect(tags).toEqual(['three']);
    expect(tagsCharCount(tags)).toBe(5);
  });

  it('builds the publish input with only the optional fields that were chosen', () => {
    const plain = buildPublishInput(values({ title: ' A title ', tags: ['a'] }));

    expect(Object.keys(plain).sort()).toEqual(['description', 'file', 'privacy', 'tags', 'title']);
    expect(plain.title).toBe('A title');

    const full = buildPublishInput(
      values({
        scheduled: true,
        publishAtLocal: '2026-10-09T09:30',
        playlistId: 'PL1',
        thumbnail: 'raw/images/cover.png',
      }),
    );

    expect(Object.keys(full).sort()).toEqual([
      'description',
      'file',
      'playlistId',
      'privacy',
      'publishAt',
      'tags',
      'thumbnail',
      'title',
    ]);
    expect(full.publishAt).toBe(new Date(2026, 9, 9, 9, 30).toISOString());
  });

  it('formats local date-times and durations', () => {
    expect(localDateTimeValue(new Date(2026, 0, 5, 7, 4))).toBe('2026-01-05T07:04');
    expect(formatPublishDuration(125)).toBe('2:05');
  });
});
