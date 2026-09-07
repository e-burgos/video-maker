import { describe, expect, it } from 'vitest';
import type { GainKeyframe } from '@video-maker/timeline-core';
import { gainDbToVolume, volumeAtFrame } from './audio-gain';

describe('gainDbToVolume', () => {
  it('devuelve 1 para 0 dB', () => {
    expect(gainDbToVolume(0)).toBe(1);
  });

  it('devuelve ~0.501 para -6 dB', () => {
    expect(gainDbToVolume(-6)).toBeCloseTo(0.501, 3);
  });

  it('devuelve ~0.2512 para -12 dB', () => {
    expect(gainDbToVolume(-12)).toBeCloseTo(0.2512, 4);
  });

  it('devuelve ~0.0631 para -24 dB', () => {
    expect(gainDbToVolume(-24)).toBeCloseTo(0.0631, 4);
  });

  it('devuelve 0 para -Infinity dB', () => {
    expect(gainDbToVolume(-Infinity)).toBe(0);
  });

  it('devuelve un valor cercano a 0 para un dB muy negativo', () => {
    expect(gainDbToVolume(-200)).toBeCloseTo(0, 8);
  });

  it('clampea a 1 una ganancia positiva', () => {
    expect(gainDbToVolume(6)).toBe(1);
  });
});

describe('volumeAtFrame', () => {
  const automation: readonly GainKeyframe[] = [
    { frame: 0, gainDb: -12 },
    { frame: 26, gainDb: -12 },
    { frame: 30, gainDb: -24 },
    { frame: 98, gainDb: -24 },
    { frame: 110, gainDb: -12 },
  ];

  it('devuelve 1 cuando la automatización está vacía', () => {
    expect(volumeAtFrame([], 0)).toBe(1);
  });

  it('devuelve el gainDb del primer keyframe en y antes del primer frame', () => {
    expect(volumeAtFrame(automation, 0)).toBeCloseTo(0.2512, 4);
  });

  it('interpola linealmente en dB entre dos keyframes', () => {
    expect(volumeAtFrame(automation, 28)).toBeCloseTo(0.1259, 4);
  });

  it('devuelve el plateau cuando el frame cae dentro de un tramo plano', () => {
    expect(volumeAtFrame(automation, 60)).toBeCloseTo(0.0631, 4);
  });

  it('devuelve el gainDb del último keyframe en y después del último frame', () => {
    expect(volumeAtFrame(automation, 264)).toBeCloseTo(0.2512, 4);
  });
});
