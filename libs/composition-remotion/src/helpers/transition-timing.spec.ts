import { describe, expect, it } from 'vitest';
import type { TimelineTransition } from '@video-maker/timeline-core';
import { transitionTiming } from './transition-timing';

const springTransition: TimelineTransition = {
  betweenClipIds: ['aroll-0001', 'aroll-0002'],
  kind: 'fade',
  durationFrames: 9,
  timing: { type: 'spring', damping: 200, stiffness: 100, mass: 1 },
};

describe('transitionTiming', () => {
  it('devuelve un springTiming cuya duración exacta es transition.durationFrames', () => {
    const timing = transitionTiming(springTransition, 30);

    expect(timing.getDurationInFrames({ fps: 30 })).toBe(9);
  });

  it('devuelve un linearTiming de progreso constante para timing.type "linear"', () => {
    const linearTransition: TimelineTransition = { ...springTransition, timing: { type: 'linear' } };

    const timing = transitionTiming(linearTransition, 30);

    expect(timing.getDurationInFrames({ fps: 30 })).toBe(9);
    expect(timing.getProgress({ frame: 4.5, fps: 30 })).toBeCloseTo(0.5);
  });

  it('sigue devolviendo un timing válido de 9 frames para kind "light-leak"', () => {
    const lightLeakTransition: TimelineTransition = { ...springTransition, kind: 'light-leak' };

    const timing = transitionTiming(lightLeakTransition, 30);

    expect(timing.getDurationInFrames({ fps: 30 })).toBe(9);
  });

  it('sigue devolviendo un timing válido de 9 frames para un kind desconocido', () => {
    const unknownKindTransition = { ...springTransition, kind: 'unknown-kind' } as unknown as TimelineTransition;

    const timing = transitionTiming(unknownKindTransition, 30);

    expect(timing.getDurationInFrames({ fps: 30 })).toBe(9);
  });

  it('acota la duración de la transición a 2 s de la Timeline (clamp por fps)', () => {
    const longTransition: TimelineTransition = { ...springTransition, durationFrames: 240 };

    expect(transitionTiming(longTransition, 30).getDurationInFrames({ fps: 30 })).toBe(60);
    expect(transitionTiming(longTransition, 60).getDurationInFrames({ fps: 60 })).toBe(120);
  });

  it('nunca devuelve una transición de menos de 1 frame', () => {
    const emptyTransition: TimelineTransition = { ...springTransition, durationFrames: 0 };

    expect(transitionTiming(emptyTransition, 30).getDurationInFrames({ fps: 30 })).toBe(1);
  });
});
