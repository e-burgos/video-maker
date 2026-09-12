import {
  DEFAULT_MUSIC_MIX,
  buildTimeline,
  defaultFormat,
  planDucking,
  validateTimeline,
} from '@video-maker/timeline-core';
import type { EditDecisionList, MediaAsset, MusicInput, Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import { timelineDocumentsEqual } from './timeline-document';
import {
  canSaveTimeline,
  canStartRender,
  initialTimelineEditState,
  timelineEditReducer,
} from './timeline-edit-state';

function twoValleyMusicTimeline(): Timeline {
  const format = defaultFormat('reels-9x16');
  const edl: EditDecisionList = {
    schemaVersion: 1,
    sourceAssetId: 'aroll-01',
    format,
    generatedBy: { tool: 'timeline-edit-state-spec', params: {} },
    decisions: [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 8000 },
      { id: 'duck-0001', type: 'duck', startMs: 500, endMs: 1200, gainDb: -18 },
      { id: 'duck-0002', type: 'duck', startMs: 5000, endMs: 5700, gainDb: -18 },
    ],
  };
  const assets: MediaAsset[] = [
    {
      id: 'aroll-01',
      kind: 'video',
      path: 'raw/aroll/01.mp4',
      durationMs: 30000,
      fps: 30,
      width: 1920,
      height: 1080,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'music-01',
      kind: 'audio',
      path: 'raw/audio/01.mp3',
      durationMs: 30000,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const music: MusicInput = { assetId: 'music-01' };

  return buildTimeline(edl, assets, music);
}

describe('initialTimelineEditState', () => {
  it('starts clean: saved equals draft, not dirty, no rejections, issues from the real validator', () => {
    const fixture = editableTimelineFixture();

    const state = initialTimelineEditState(fixture);

    expect(state.saved).toBe(fixture);
    expect(state.draft).toBe(fixture);
    expect(state.dirty).toBe(false);
    expect(state.rejections).toEqual([]);
    expect(state.issues).toEqual([]);
  });
});

describe('timelineEditReducer — rejection path (T-03 / CA-202)', () => {
  it('leaves the draft value-identical and adds the rejection when clip-trim-start is invalid', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const clipId = fixture.tracks.aroll[0]?.id ?? '';

    const result = timelineEditReducer(state, {
      type: 'clip-trim-start',
      track: 'aroll',
      clipId,
      trimStartMs: -1,
    });

    expect(timelineDocumentsEqual(result.draft, fixture)).toBe(true);
    expect(result.dirty).toBe(false);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe('TRIM_START_MS_INVALID');
  });

  it('rejects a clip-duration shorter than the real transition it touches, leaving draft untouched', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const transition = fixture.transitions?.[0];
    expect(transition).toBeDefined();
    const enteringClipId = transition?.betweenClipIds[1] ?? '';

    const result = timelineEditReducer(state, {
      type: 'clip-duration',
      track: 'aroll',
      clipId: enteringClipId,
      durationFrames: transition?.durationFrames ?? 0,
    });

    expect(timelineDocumentsEqual(result.draft, fixture)).toBe(true);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe('DURATION_SHORTER_THAN_TRANSITION');
  });

  it('rejects an empty caption word, leaving draft untouched', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const caption = fixture.tracks.captions[0];
    expect(caption).toBeDefined();

    const result = timelineEditReducer(state, {
      type: 'caption-word-text',
      clipId: caption?.id ?? '',
      wordIndex: 0,
      text: '',
    });

    expect(timelineDocumentsEqual(result.draft, fixture)).toBe(true);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe('CAPTION_WORD_TEXT_EMPTY');
  });

  it('clears a stale rejection once a subsequent action is accepted', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const clipId = fixture.tracks.aroll[0]?.id ?? '';

    const rejected = timelineEditReducer(state, {
      type: 'clip-trim-start',
      track: 'aroll',
      clipId,
      trimStartMs: -1,
    });
    expect(rejected.rejections).toHaveLength(1);

    const accepted = timelineEditReducer(rejected, {
      type: 'clip-trim-start',
      track: 'aroll',
      clipId,
      trimStartMs: 500,
    });

    expect(accepted.rejections).toEqual([]);
  });
});

describe('timelineEditReducer — accepted edits relayout, mirror and clamp (US-3-001)', () => {
  it('relayouts the aroll track and mirrors voice after a clip-duration edit', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const clipId = fixture.tracks.aroll[0]?.id ?? '';
    const shortened = (fixture.tracks.aroll[0]?.durationFrames ?? 0) - 5;

    const result = timelineEditReducer(state, {
      type: 'clip-duration',
      track: 'aroll',
      clipId,
      durationFrames: shortened,
    });

    expect(result.rejections).toEqual([]);
    expect(result.dirty).toBe(true);
    expect(result.draft.tracks.voice).toHaveLength(result.draft.tracks.aroll.length);
    result.draft.tracks.voice.forEach((voiceClip, index) => {
      const arollClip = result.draft.tracks.aroll[index];
      expect(voiceClip.from).toBe(arollClip?.from);
      expect(voiceClip.durationFrames).toBe(arollClip?.durationFrames);
      expect(voiceClip.trimStartMs).toBe(arollClip?.trimStartMs);
    });
    expect(validateTimeline(result.draft)).toEqual({ ok: true });
  });

  it('reorders the aroll track on aroll-move and relayouts from the new order', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const firstClipId = fixture.tracks.aroll[0]?.id ?? '';
    const lastIndex = fixture.tracks.aroll.length - 1;

    const result = timelineEditReducer(state, {
      type: 'aroll-move',
      clipId: firstClipId,
      toIndex: lastIndex,
    });

    expect(result.draft.tracks.aroll[lastIndex]?.id).toBe(firstClipId);
    expect(result.draft.tracks.aroll[0]?.from).toBe(0);
    expect(result.dirty).toBe(true);
  });

  it('does nothing when the moved clip id does not exist', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);

    const result = timelineEditReducer(state, { type: 'aroll-move', clipId: 'ghost', toIndex: 0 });

    expect(result).toBe(state);
  });

  it('edits a broll clip trim/duration without triggering a relayout of aroll', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const brollClip = fixture.tracks.broll[0];
    expect(brollClip).toBeDefined();

    const trimmed = timelineEditReducer(state, {
      type: 'clip-trim-start',
      track: 'broll',
      clipId: brollClip?.id ?? '',
      trimStartMs: 120,
    });

    expect(trimmed.rejections).toEqual([]);
    expect(trimmed.draft.tracks.broll[0]?.trimStartMs).toBe(120);
    expect(trimmed.draft.tracks.aroll).toEqual(fixture.tracks.aroll);

    const shortened = timelineEditReducer(trimmed, {
      type: 'clip-duration',
      track: 'broll',
      clipId: brollClip?.id ?? '',
      durationFrames: 5,
    });

    expect(shortened.rejections).toEqual([]);
    expect(shortened.draft.tracks.broll[0]?.durationFrames).toBe(5);
    expect(shortened.draft.tracks.aroll).toEqual(fixture.tracks.aroll);
    expect(shortened.draft.durationFrames).toBe(fixture.durationFrames);
  });

  it('does nothing when clip-trim-start, clip-duration or caption-word-text target an id that does not exist', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);

    expect(
      timelineEditReducer(state, {
        type: 'clip-trim-start',
        track: 'aroll',
        clipId: 'ghost',
        trimStartMs: 10,
      }),
    ).toBe(state);
    expect(
      timelineEditReducer(state, {
        type: 'clip-duration',
        track: 'aroll',
        clipId: 'ghost',
        durationFrames: 10,
      }),
    ).toBe(state);
    expect(
      timelineEditReducer(state, { type: 'caption-word-text', clipId: 'ghost', wordIndex: 0, text: 'x' }),
    ).toBe(state);

    const caption = fixture.tracks.captions[0];
    expect(caption).toBeDefined();
    expect(
      timelineEditReducer(state, {
        type: 'caption-word-text',
        clipId: caption?.id ?? '',
        wordIndex: 999,
        text: 'x',
      }),
    ).toBe(state);
  });

  it('accepts a caption word edit and leaves the rest of the caption untouched', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const caption = fixture.tracks.captions[0];
    expect(caption).toBeDefined();

    const result = timelineEditReducer(state, {
      type: 'caption-word-text',
      clipId: caption?.id ?? '',
      wordIndex: 0,
      text: 'edited',
    });

    expect(result.rejections).toEqual([]);
    expect(result.draft.tracks.captions[0]?.words[0]?.text).toBe('edited');
    expect(result.dirty).toBe(true);
  });
});

describe('timelineEditReducer — music-levels rescales against the real ducking producer (T-15 / CA-210)', () => {
  it('changes audioMix.music.* and audioMix.automation together, matching planDucking applied directly with the new levels', () => {
    const timeline = twoValleyMusicTimeline();
    const state = initialTimelineEditState(timeline);

    const result = timelineEditReducer(state, {
      type: 'music-levels',
      baseGainDb: -6,
      duckedGainDb: -30,
    });

    expect(result.draft.audioMix.music.baseGainDb).toBe(-6);
    expect(result.draft.audioMix.music.duckedGainDb).toBe(-30);

    const expectedPlan = planDucking(
      [
        { startMs: 500, endMs: 1200 },
        { startMs: 5000, endMs: 5700 },
      ],
      { ...DEFAULT_MUSIC_MIX, baseGainDb: -6, duckedGainDb: -30 },
      30,
    );

    expect(result.draft.audioMix.automation).toHaveLength(expectedPlan.automation.length);
    result.draft.audioMix.automation.forEach((keyframe, index) => {
      expect(keyframe.frame).toBe(expectedPlan.automation[index]?.frame);
      expect(keyframe.gainDb).toBeCloseTo(expectedPlan.automation[index]?.gainDb ?? NaN, 9);
    });
  });

  it('applies both levels in a single pass against the previous values, not a value already updated by the same dispatch', () => {
    const timeline = twoValleyMusicTimeline();
    const state = initialTimelineEditState(timeline);

    const result = timelineEditReducer(state, {
      type: 'music-levels',
      baseGainDb: -24,
      duckedGainDb: -12,
    });

    const expectedPlan = planDucking(
      [
        { startMs: 500, endMs: 1200 },
        { startMs: 5000, endMs: 5700 },
      ],
      { ...DEFAULT_MUSIC_MIX, baseGainDb: -24, duckedGainDb: -12 },
      30,
    );

    result.draft.audioMix.automation.forEach((keyframe, index) => {
      expect(keyframe.gainDb).toBeCloseTo(expectedPlan.automation[index]?.gainDb ?? NaN, 9);
    });
  });
});

describe('timelineEditReducer — output-preset and saved/reset', () => {
  it('applies the output preset via applyOutputPreset', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);

    const result = timelineEditReducer(state, { type: 'output-preset', preset: 'youtube-16x9' });

    expect(result.draft.format.preset).toBe('youtube-16x9');
    expect(result.draft.tracks.captions.every((caption) => !('box' in caption))).toBe(true);
    expect(validateTimeline(result.draft)).toEqual({ ok: true });
  });

  it('saved replaces both saved and draft, clearing rejections and dirty', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const rejected = timelineEditReducer(state, {
      type: 'clip-trim-start',
      track: 'aroll',
      clipId: fixture.tracks.aroll[0]?.id ?? '',
      trimStartMs: -1,
    });
    expect(rejected.rejections).toHaveLength(1);

    const confirmed: Timeline = { ...fixture, id: 'timeline-confirmed' };
    const result = timelineEditReducer(rejected, { type: 'saved', timeline: confirmed });

    expect(result.saved).toBe(confirmed);
    expect(result.draft).toBe(confirmed);
    expect(result.dirty).toBe(false);
    expect(result.rejections).toEqual([]);
  });

  it('reset reverts draft to saved and clears rejections', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const edited = timelineEditReducer(state, {
      type: 'clip-trim-start',
      track: 'aroll',
      clipId: fixture.tracks.aroll[0]?.id ?? '',
      trimStartMs: -1,
    });
    expect(edited.rejections).toHaveLength(1);

    const result = timelineEditReducer(edited, { type: 'reset' });

    expect(result.draft).toBe(fixture);
    expect(result.dirty).toBe(false);
    expect(result.rejections).toEqual([]);
  });
});

describe('canSaveTimeline / canStartRender (T-24 / CA-218)', () => {
  it('blocks save with a save-blocking issue (SCHEMA_INVALID) and allows it with a render-blocking one', () => {
    const fixture = editableTimelineFixture();
    const base = initialTimelineEditState(fixture);

    const saveBlocked = {
      ...base,
      dirty: true,
      issues: [{ code: 'SCHEMA_INVALID' as const, path: 'x', message: 'x' }],
    };
    const renderBlockedOnly = {
      ...base,
      dirty: true,
      issues: [{ code: 'CLIP_EXCEEDS_ASSET' as const, path: 'x', message: 'x' }],
    };

    expect(canSaveTimeline(saveBlocked)).toBe(false);
    expect(canSaveTimeline(renderBlockedOnly)).toBe(true);
  });

  it('requires dirty and zero rejections to allow save', () => {
    const fixture = editableTimelineFixture();
    const base = initialTimelineEditState(fixture);

    expect(canSaveTimeline({ ...base, dirty: false })).toBe(false);
    expect(
      canSaveTimeline({
        ...base,
        dirty: true,
        rejections: [{ code: 'TRIM_START_MS_INVALID', path: 'x', message: 'x' }],
      }),
    ).toBe(false);
    expect(canSaveTimeline({ ...base, dirty: true })).toBe(true);
  });

  it('blocks render when dirty or when any issue is present, regardless of severity', () => {
    const fixture = editableTimelineFixture();
    const base = initialTimelineEditState(fixture);

    expect(canStartRender({ ...base, dirty: true })).toBe(false);
    expect(
      canStartRender({
        ...base,
        dirty: false,
        issues: [{ code: 'CLIP_EXCEEDS_ASSET' as const, path: 'x', message: 'x' }],
      }),
    ).toBe(false);
    expect(canStartRender({ ...base, dirty: false, issues: [] })).toBe(true);
  });

  it('classifies VOICE_TRACK_NOT_MIRRORED as render-blocking: it still allows save but blocks render', () => {
    const fixture = editableTimelineFixture();
    const mismatched: Timeline = {
      ...fixture,
      tracks: { ...fixture.tracks, voice: fixture.tracks.voice.slice(0, -1) },
    };
    const state = initialTimelineEditState(mismatched);

    expect(state.issues.some((issue) => issue.code === 'VOICE_TRACK_NOT_MIRRORED')).toBe(true);
    expect(canStartRender({ ...state, dirty: false })).toBe(false);
    expect(canSaveTimeline({ ...state, dirty: true })).toBe(true);
  });
});

const LOGO_ASSET: MediaAsset = {
  id: 'raw/logo/brand.png',
  kind: 'image',
  path: 'raw/logo/brand.png',
  durationMs: 0,
  width: 800,
  height: 200,
  hasAudio: false,
  probedAt: '2026-09-01T00:00:00.000Z',
};

describe('timelineEditReducer — logo-style y caption-style (FIX-006-001)', () => {
  function withLogo() {
    const base = initialTimelineEditState(editableTimelineFixture());
    return timelineEditReducer(base, {
      type: 'logo-set',
      asset: LOGO_ASSET,
      position: 'bottom-right',
    });
  }

  it('logo-style cambia el ancho y la opacidad y ensucia el borrador', () => {
    const next = timelineEditReducer(withLogo(), {
      type: 'logo-style',
      widthRatio: 0.12,
      opacity: 0.4,
    });

    expect(next.draft.logo?.widthRatio).toBe(0.12);
    expect(next.draft.logo?.opacity).toBe(0.4);
    expect(next.dirty).toBe(true);
  });

  it('logo-style sobre un documento sin logo no cambia nada', () => {
    const base = initialTimelineEditState(editableTimelineFixture());
    const next = timelineEditReducer(base, { type: 'logo-style', widthRatio: 0.12, opacity: 1 });

    expect(next.draft).toBe(base.draft);
    expect(next.dirty).toBe(false);
  });

  it('caption-style escribe el estilo y deja el documento válido', () => {
    const base = initialTimelineEditState(editableTimelineFixture());
    const next = timelineEditReducer(base, { type: 'caption-style', captionStyle: 'subtle-lower' });

    expect(next.draft.captionStyle).toBe('subtle-lower');
    expect(next.dirty).toBe(true);
    expect(canSaveTimeline(next)).toBe(true);
  });

  it('volver al estilo guardado deja el borrador limpio otra vez', () => {
    const saved = { ...editableTimelineFixture(), captionStyle: 'off' as const };
    const base = initialTimelineEditState(saved);
    const changed = timelineEditReducer(base, { type: 'caption-style', captionStyle: 'clean-sans' });
    const back = timelineEditReducer(changed, { type: 'caption-style', captionStyle: 'off' });

    expect(back.dirty).toBe(false);
  });
});
