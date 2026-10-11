import { describe, expect, it } from 'vitest';

import {
  directedLengthScale,
  hasVoiceDirection,
  VoiceScriptDirectionsSchema,
  VoiceDirectionSchema,
  voiceDirectionSynthesis,
} from './voice-direction';

describe('VoiceDirection (US-023-301)', () => {
  it('sin dirección no cambia ningún parámetro de síntesis', () => {
    expect(voiceDirectionSynthesis(undefined)).toEqual({ lengthScaleFactor: 1, trailingPauseMs: 0 });
    expect(voiceDirectionSynthesis({ pace: 'normal', energy: 'neutral' })).toEqual({
      lengthScaleFactor: 1,
      trailingPauseMs: 0,
    });
    expect(directedLengthScale(0.9, undefined)).toBe(0.9);
  });

  it('mapea el ritmo a un factor relativo del lengthScale base', () => {
    expect(directedLengthScale(1, { pace: 'slow' })).toBe(1.12);
    expect(directedLengthScale(1, { pace: 'fast' })).toBe(0.92);
    expect(directedLengthScale(0.9, { pace: 'slow' })).toBe(1.008);
  });

  it('mapea la energía a noise-scale y noise-scale-w', () => {
    expect(voiceDirectionSynthesis({ energy: 'calm' })).toMatchObject({ noiseScale: 0.5, noiseScaleW: 0.6 });
    expect(voiceDirectionSynthesis({ energy: 'lively' })).toMatchObject({ noiseScale: 0.8, noiseScaleW: 1 });
  });

  it('expone la pausa final y valida los rangos', () => {
    expect(voiceDirectionSynthesis({ pauseAfterMs: 600 }).trailingPauseMs).toBe(600);
    expect(VoiceDirectionSchema.safeParse({ pauseAfterMs: 2001 }).success).toBe(false);
    expect(VoiceDirectionSchema.safeParse({ pace: 'turbo' }).success).toBe(false);
    expect(VoiceDirectionSchema.safeParse({ unknown: 1 }).success).toBe(false);
  });

  it('distingue una dirección vacía de una real', () => {
    expect(hasVoiceDirection(undefined)).toBe(false);
    expect(hasVoiceDirection({})).toBe(false);
    expect(hasVoiceDirection({ pace: 'slow' })).toBe(true);
  });

  it('acepta un mapa por número de línea del guion y rechaza claves o valores inválidos', () => {
    expect(VoiceScriptDirectionsSchema.parse({ '1': { pace: 'fast' } })).toEqual({ '1': { pace: 'fast' } });
    expect(VoiceScriptDirectionsSchema.safeParse({ '0': { pace: 'fast' } }).success).toBe(false);
    expect(VoiceScriptDirectionsSchema.safeParse({ '1': { pace: 'x' } }).success).toBe(false);
  });
});
