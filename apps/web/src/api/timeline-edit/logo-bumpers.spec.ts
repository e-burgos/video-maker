import { describe, expect, it } from 'vitest';
import { TimelineSchema } from '@video-maker/timeline-core';
import type { LogoOverlay, Timeline } from '@video-maker/timeline-core';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  BUMPER_DURATIONS_MS,
  BUMPER_LOGO_WIDTH_RATIO_BY_SIZE,
  DEFAULT_LOGO_BUMPER,
  bumperLogoSizeOf,
  bumperSeconds,
  isBumperColor,
  setTimelineBumperEnabled,
  setTimelineBumperStyle,
} from './logo-bumpers';

const LOGO: LogoOverlay = {
  assetId: 'aroll-cam-01',
  position: 'bottom-right',
  widthRatio: 0.18,
  marginRatio: 0.035,
  opacity: 1,
};

function withLogo(): Timeline {
  return { ...editableTimelineFixture(), logo: LOGO };
}

describe('logo bumpers del borrador', () => {
  it('tildar el inicio escribe el bumper con los defaults del schema', () => {
    const timeline = setTimelineBumperEnabled(withLogo(), 'intro', true);

    expect(timeline.bumpers?.intro).toEqual(DEFAULT_LOGO_BUMPER);
    expect(timeline.bumpers?.outro).toBeUndefined();
    expect(TimelineSchema.safeParse(timeline).success).toBe(true);
  });

  it('destildar apaga el bumper pero conserva sus ajustes', () => {
    const enabled = setTimelineBumperStyle(
      setTimelineBumperEnabled(withLogo(), 'outro', true),
      'outro',
      { backgroundColor: '#0b1020', durationMs: 3000 },
    );

    const disabled = setTimelineBumperEnabled(enabled, 'outro', false);

    expect(disabled.bumpers?.outro).toEqual({
      ...DEFAULT_LOGO_BUMPER,
      enabled: false,
      backgroundColor: '#0b1020',
      durationMs: 3000,
    });
  });

  it('sin logo en la Timeline no se puede prender un bumper', () => {
    const timeline = setTimelineBumperEnabled(editableTimelineFixture(), 'intro', true);

    expect(timeline.bumpers).toBeUndefined();
  });

  it('un estilo sobre un bumper que no existe no inventa nada', () => {
    const timeline = setTimelineBumperStyle(withLogo(), 'intro', { durationMs: 4000 });

    expect(timeline.bumpers).toBeUndefined();
  });

  it('el estilo sólo pisa los campos que llegan', () => {
    const enabled = setTimelineBumperEnabled(withLogo(), 'intro', true);

    const styled = setTimelineBumperStyle(enabled, 'intro', { animation: 'slide-up' });

    expect(styled.bumpers?.intro).toEqual({ ...DEFAULT_LOGO_BUMPER, animation: 'slide-up' });
  });

  it('las cuatro duraciones de la UI caen dentro del rango del schema', () => {
    const timeline = setTimelineBumperEnabled(withLogo(), 'intro', true);

    for (const durationMs of BUMPER_DURATIONS_MS) {
      const styled = setTimelineBumperStyle(timeline, 'intro', { durationMs });
      expect(TimelineSchema.safeParse(styled).success).toBe(true);
    }
  });

  it('los tres tamaños del logo mapean a 0.3 / 0.4 / 0.55 y vuelven a su nombre', () => {
    expect(BUMPER_LOGO_WIDTH_RATIO_BY_SIZE).toEqual({ small: 0.3, medium: 0.4, large: 0.55 });
    expect(bumperLogoSizeOf(0.3)).toBe('small');
    expect(bumperLogoSizeOf(0.4)).toBe('medium');
    expect(bumperLogoSizeOf(0.55)).toBe('large');
    expect(bumperLogoSizeOf(0.42)).toBe('medium');
  });

  it('isBumperColor acepta sólo hex #rrggbb', () => {
    expect(isBumperColor('#0b1020')).toBe(true);
    expect(isBumperColor('#FFFFFF')).toBe(true);
    expect(isBumperColor('#fff')).toBe(false);
    expect(isBumperColor('0b1020')).toBe(false);
    expect(isBumperColor('white')).toBe(false);
  });

  it('bumperSeconds sólo cuenta los bumpers prendidos', () => {
    const timeline = setTimelineBumperStyle(
      setTimelineBumperEnabled(withLogo(), 'intro', true),
      'intro',
      { durationMs: 1500 },
    );

    expect(bumperSeconds(timeline, 'intro')).toBe(1.5);
    expect(bumperSeconds(timeline, 'outro')).toBeNull();
    expect(bumperSeconds(setTimelineBumperEnabled(timeline, 'intro', false), 'intro')).toBeNull();
  });
});
