import { describe, expect, it } from 'vitest';

import { comparePartnerIndex, stepIndex, viewerItemOf } from './viewer-model';
import type { ViewerItem } from './viewer-model';

function item(path: string): ViewerItem {
  return { path, role: 'image', kind: 'image', sizeBytes: 1, facts: [] };
}

const ITEMS = [item('a.png'), item('b.png'), item('c.png')];

describe('stepIndex', () => {
  it('wraps in both directions', () => {
    expect(stepIndex(3, 2, 1)).toBe(0);
    expect(stepIndex(3, 0, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});

describe('comparePartnerIndex', () => {
  it('has no partner with fewer than two files', () => {
    expect(comparePartnerIndex([item('a.png')], [], 0)).toBeNull();
  });

  it('falls back to the next file when nothing else is selected', () => {
    expect(comparePartnerIndex(ITEMS, [], 2)).toBe(0);
    expect(comparePartnerIndex(ITEMS, ['a.png'], 0)).toBe(1);
  });

  it('prefers the next selected file after the current one', () => {
    expect(comparePartnerIndex(ITEMS, ['a.png', 'c.png'], 0)).toBe(2);
    expect(comparePartnerIndex(ITEMS, ['a.png', 'b.png'], 1)).toBe(0);
  });
});

describe('viewerItemOf', () => {
  it('lists dimensions and duration of a probed video', () => {
    const viewer = viewerItemOf({
      path: 'raw/aroll/clip.mp4',
      role: 'aroll',
      fingerprint: { sizeBytes: 10, modifiedAtMs: 1 },
      media: {
        id: 'x',
        kind: 'video',
        path: 'raw/aroll/clip.mp4',
        durationMs: 22500,
        fps: 30,
        width: 1280,
        height: 720,
        probedAt: 't',
      },
    });

    expect(viewer.kind).toBe('video');
    expect(viewer.facts).toEqual(['1280×720', '0:23', '30 fps']);
  });
});
