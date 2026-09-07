import { describe, expect, it } from 'vitest';

import { ca013Assets } from '../__fixtures__/assets';
import { ca013Edl } from '../__fixtures__/edl';
import type { CaptionClip, Timeline, TimelineTransition, VideoClip } from '../schemas/timeline.schema';
import { buildTimeline } from './build-timeline';
import type { TimelineIssueCode } from './validate-timeline';
import { validateTimeline } from './validate-timeline';

function referenceTimeline(): Timeline {
  return buildTimeline(ca013Edl, ca013Assets);
}

function patchClipById<T extends { id: string }>(clips: readonly T[], id: string, patch: Partial<T>): T[] {
  return clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip));
}

function withAroll(timeline: Timeline, id: string, patch: Partial<VideoClip>): Timeline {
  return {
    ...timeline,
    tracks: { ...timeline.tracks, aroll: patchClipById(timeline.tracks.aroll, id, patch) },
  };
}

function withBroll(timeline: Timeline, id: string, patch: Partial<VideoClip>): Timeline {
  return {
    ...timeline,
    tracks: { ...timeline.tracks, broll: patchClipById(timeline.tracks.broll, id, patch) },
  };
}

function withCaption(timeline: Timeline, id: string, patch: Partial<CaptionClip>): Timeline {
  return {
    ...timeline,
    tracks: { ...timeline.tracks, captions: patchClipById(timeline.tracks.captions, id, patch) },
  };
}

function withoutCaptionBox(timeline: Timeline, id: string): Timeline {
  return {
    ...timeline,
    tracks: {
      ...timeline.tracks,
      captions: timeline.tracks.captions.map((caption) => {
        if (caption.id !== id) {
          return caption;
        }
        const withoutBox: CaptionClip = { ...caption };
        delete withoutBox.box;
        return withoutBox;
      }),
    },
  };
}

function withTransitions(timeline: Timeline, transitions: TimelineTransition[]): Timeline {
  return { ...timeline, transitions };
}

function withDurationFrames(timeline: Timeline, durationFrames: number): Timeline {
  return { ...timeline, durationFrames };
}

function issueCodes(result: ReturnType<typeof validateTimeline>): TimelineIssueCode[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function expectSingleIssue(
  result: ReturnType<typeof validateTimeline>,
  code: TimelineIssueCode,
  path: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.issues).toEqual([expect.objectContaining({ code, path })]);
}

describe('validateTimeline (CA-014)', () => {
  it('acepta la Timeline construida desde el fixture de referencia ca013Edl', () => {
    const result = validateTimeline(referenceTimeline());
    expect(result).toEqual({ ok: true });
  });

  it('reporta ASSET_NOT_FOUND cuando un clip referencia un asset inexistente', () => {
    const broken = withBroll(referenceTimeline(), 'broll-0001', { assetId: 'broll-does-not-exist' });

    expectSingleIssue(validateTimeline(broken), 'ASSET_NOT_FOUND', 'tracks.broll[0].assetId');
  });

  it('reporta CLIP_EXCEEDS_ASSET cuando un clip usa más material del que tiene el asset', () => {
    const broken = withAroll(referenceTimeline(), 'aroll-0002', { trimStartMs: 9999 });

    expectSingleIssue(validateTimeline(broken), 'CLIP_EXCEEDS_ASSET', 'tracks.aroll[1].durationFrames');
  });

  it('reporta AROLL_OVERLAP cuando dos clips de A-roll se solapan sin transición declarada', () => {
    const broken = withTransitions(referenceTimeline(), []);

    expectSingleIssue(validateTimeline(broken), 'AROLL_OVERLAP', 'tracks.aroll[1].from');
  });

  it('reporta AROLL_GAP cuando queda un hueco entre dos clips de A-roll', () => {
    const base = referenceTimeline();
    const [firstTransition] = base.transitions ?? [];
    expect(firstTransition).toBeDefined();
    const broken = withTransitions(base, [{ ...(firstTransition as TimelineTransition), durationFrames: 20 }]);

    expectSingleIssue(validateTimeline(broken), 'AROLL_GAP', 'tracks.aroll[1].from');
  });

  it('reporta DURATION_MISMATCH cuando durationFrames no coincide con el final del último clip', () => {
    const broken = withDurationFrames(referenceTimeline(), referenceTimeline().durationFrames + 5);

    expectSingleIssue(validateTimeline(broken), 'DURATION_MISMATCH', 'durationFrames');
  });

  it('reporta CLIP_OUT_OF_TIMELINE cuando un clip excede el rango de la Timeline', () => {
    const broken = withBroll(referenceTimeline(), 'broll-0001', { durationFrames: 300 });

    expectSingleIssue(validateTimeline(broken), 'CLIP_OUT_OF_TIMELINE', 'tracks.broll[0].from');
  });

  it('reporta TRANSITION_CLIP_NOT_FOUND cuando una transición referencia un clip inexistente', () => {
    const base = referenceTimeline();
    const brokenTransition: TimelineTransition = {
      betweenClipIds: ['aroll-0001', 'aroll-does-not-exist'],
      kind: 'fade',
      durationFrames: 5,
      timing: { type: 'linear' },
    };
    const broken = withTransitions(base, [...(base.transitions ?? []), brokenTransition]);

    expectSingleIssue(validateTimeline(broken), 'TRANSITION_CLIP_NOT_FOUND', 'transitions[1].betweenClipIds');
  });

  it('reporta CAPTION_OUT_OF_SAFE_ZONE cuando el box del caption cae fuera de la zona segura', () => {
    const broken = withCaption(referenceTimeline(), 'caption-0001', {
      box: { x: 0, y: 220, width: 880, height: 1300 },
    });

    expectSingleIssue(validateTimeline(broken), 'CAPTION_OUT_OF_SAFE_ZONE', 'tracks.captions[0].box');
  });

  it('no evalúa la zona segura cuando el caption no declara box', () => {
    const withoutBox = withoutCaptionBox(referenceTimeline(), 'caption-0001');

    expect(validateTimeline(withoutBox)).toEqual({ ok: true });
  });

  it('reporta SCHEMA_INVALID con el path exacto cuando la Timeline no cumple el schema', () => {
    const broken = withAroll(referenceTimeline(), 'aroll-0002', { id: 'aroll-0001' });

    expectSingleIssue(validateTimeline(broken), 'SCHEMA_INVALID', 'tracks.aroll[1].id');
  });

  it('acumula todos los issues a la vez sin cortar en el primero', () => {
    let broken = referenceTimeline();
    broken = withBroll(broken, 'broll-0001', { assetId: 'broll-does-not-exist' });
    broken = withAroll(broken, 'aroll-0002', { trimStartMs: 9999 });
    broken = withTransitions(broken, []);
    broken = withCaption(broken, 'caption-0001', { box: { x: 0, y: 220, width: 880, height: 1300 } });

    const result = validateTimeline(broken);

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toHaveLength(4);
    expect(issueCodes(result)).toEqual(
      expect.arrayContaining([
        'ASSET_NOT_FOUND',
        'CLIP_EXCEEDS_ASSET',
        'AROLL_OVERLAP',
        'CAPTION_OUT_OF_SAFE_ZONE',
      ]),
    );
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          'tracks.broll[0].assetId',
          'tracks.aroll[1].durationFrames',
          'tracks.aroll[1].from',
          'tracks.captions[0].box',
        ]),
      );
    }
  });
});
