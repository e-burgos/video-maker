import { describe, expect, it } from 'vitest';
import { defaultFormat } from '@video-maker/timeline-core';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import { captionBoxFor } from './caption-box';
import { captionBoxStyle, captionClipPlan } from './caption-clip-plan';
import { captionPreset } from './caption-preset';
import { captionSafeZone } from './caption-safe-zone';
import { timelineToSequenceProps } from './timeline-to-sequence-props';
import type { CaptionSequenceProps } from './timeline-to-sequence-props';
import type { CaptionBox } from './timeline-types';

const FORMAT = defaultFormat('tiktok-9x16');
const PRESET = captionPreset('bold-impact');
const CLIP_BOX: CaptionBox = { x: 10, y: 20, width: 300, height: 100 };

function clipWithBox(box: CaptionBox | null): CaptionSequenceProps {
  return {
    clipId: 'cap-0001',
    from: 0,
    durationInFrames: 30,
    words: [{ text: 'hola', fromFrame: 0, durationFrames: 30 }],
    emphasisIndex: null,
    box,
  };
}

describe('captionClipPlan', () => {
  it('sin boxSource, usa la caja del preset e ignora la del clip (D-19, default)', () => {
    const [plan] = captionClipPlan({
      clips: [clipWithBox(CLIP_BOX)],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
    });

    const expectedBox = captionBoxFor(captionSafeZone(FORMAT, 'tiktok'), FORMAT, PRESET);

    expect(plan?.box).toEqual(expectedBox);
    expect(plan?.box).not.toEqual(CLIP_BOX);
  });

  it("con boxSource: 'clip' y box presente, gana la caja del clip", () => {
    const [plan] = captionClipPlan({
      clips: [clipWithBox(CLIP_BOX)],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
      boxSource: 'clip',
    });

    expect(plan?.box).toEqual(CLIP_BOX);
  });

  it("con boxSource: 'clip' y box null, cae a la caja del preset", () => {
    const [plan] = captionClipPlan({
      clips: [clipWithBox(null)],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
      boxSource: 'clip',
    });

    const expectedBox = captionBoxFor(captionSafeZone(FORMAT, 'tiktok'), FORMAT, PRESET);

    expect(plan?.box).toEqual(expectedBox);
  });

  it("contra la Timeline real: boxSource 'clip' reproduce clip.box; el default respeta boxHeightRatio del preset y difiere (R-9)", () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const clips = timelineToSequenceProps(timeline).captions;
    const timelineBox = timeline.tracks.captions[0]?.box;

    expect(timelineBox).toBeDefined();

    const [planWithClipSource] = captionClipPlan({
      clips,
      format: timeline.format,
      preset: PRESET,
      boxSource: 'clip',
    });

    expect(planWithClipSource?.box).toEqual(timelineBox);

    const [planWithPresetSource] = captionClipPlan({
      clips,
      format: timeline.format,
      preset: PRESET,
    });

    expect(planWithPresetSource?.box).not.toEqual(timelineBox);
    expect(planWithPresetSource?.box.height).toBe(
      Math.round(timeline.format.height * PRESET.boxHeightRatio),
    );
  });

  it('fontSize es por clip: una frase corta cabe con letra más grande que una frase larga en la misma caja (CA-005)', () => {
    const shortWordClip: CaptionSequenceProps = {
      clipId: 'cap-short',
      from: 0,
      durationInFrames: 30,
      words: [{ text: 'sí', fromFrame: 0, durationFrames: 30 }],
      emphasisIndex: null,
      box: null,
    };
    const longWordsClip: CaptionSequenceProps = {
      clipId: 'cap-long',
      from: 0,
      durationInFrames: 30,
      words: [
        { text: 'interminable', fromFrame: 0, durationFrames: 10 },
        { text: 'explicación', fromFrame: 10, durationFrames: 10 },
        { text: 'detallada', fromFrame: 20, durationFrames: 10 },
      ],
      emphasisIndex: null,
      box: null,
    };

    const [shortPlan, longPlan] = captionClipPlan({
      clips: [shortWordClip, longWordsClip],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
    });

    expect(shortPlan?.fontSize).toBeGreaterThan(longPlan?.fontSize ?? Number.POSITIVE_INFINITY);
  });

  it('platform llega hasta la caja: tiktok angosta el ancho en al menos 150 px (CA-002)', () => {
    const [withPlatform] = captionClipPlan({
      clips: [clipWithBox(null)],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
    });
    const [withoutPlatform] = captionClipPlan({
      clips: [clipWithBox(null)],
      format: FORMAT,
      preset: PRESET,
    });

    expect(withPlatform?.box).not.toEqual(withoutPlatform?.box);
    expect((withoutPlatform?.box.width ?? 0) - (withPlatform?.box.width ?? 0)).toBeGreaterThanOrEqual(
      150,
    );
  });
});

describe('captionBoxStyle', () => {
  it('emite position/left/top/width/height/fontSize desde la caja, sin transform ni opacity', () => {
    const [plan] = captionClipPlan({
      clips: [clipWithBox(null)],
      format: FORMAT,
      preset: PRESET,
      platform: 'tiktok',
    });

    expect(plan).toBeDefined();
    if (plan === undefined) {
      throw new Error('expected a caption clip plan entry');
    }

    const style = captionBoxStyle(plan.box, plan.fontSize);

    expect(style).toEqual({
      position: 'absolute',
      left: plan.box.x,
      top: plan.box.y,
      width: plan.box.width,
      height: plan.box.height,
      paddingLeft: 0,
      paddingRight: 0,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: plan.fontSize,
      textAlign: 'center',
    });
    expect('transform' in style).toBe(false);
    expect('opacity' in style).toBe(false);
  });

  it('reserva a los costados la misma fracción que usó el ajuste de tamaño (FIX-003-004)', () => {
    const subtitle = captionPreset('subtle-lower');
    const [plan] = captionClipPlan({
      clips: [clipWithBox(null)],
      format: FORMAT,
      preset: subtitle,
      platform: 'tiktok',
    });

    if (plan === undefined) {
      throw new Error('expected a caption clip plan entry');
    }

    const style = captionBoxStyle(plan.box, plan.fontSize, subtitle.sidePaddingRatio);
    const reserved = Math.round(plan.box.width * subtitle.sidePaddingRatio);

    expect(style.paddingLeft).toBe(reserved);
    expect(style.paddingRight).toBe(reserved);
    expect(style.boxSizing).toBe('border-box');
    expect(reserved).toBeGreaterThan(0);
  });
});
