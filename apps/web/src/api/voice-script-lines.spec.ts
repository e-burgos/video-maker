import { describe, expect, it } from 'vitest';
import type { VoiceScriptLine, VoiceScriptManifest } from '@video-maker/timeline-core';

import {
  formatTimecode,
  lineEndMs,
  overflowOf,
  requestedStartOf,
  totalDurationSeconds,
} from './voice-script-lines';

function line(overrides: Partial<VoiceScriptLine> = {}): VoiceScriptLine {
  return {
    index: 1,
    text: 'Cada anuncio arranca de una plantilla.',
    path: 'work/voice/lines/line-01.wav',
    startMs: 0,
    durationMs: 4200,
    ...overrides,
  };
}

describe('formatTimecode', () => {
  it.each([
    [0, '0:00'],
    [9_000, '0:09'],
    [62_400, '1:02'],
    [600_000, '10:00'],
  ])('%i ms es %s', (ms, expected) => {
    expect(formatTimecode(ms)).toBe(expected);
  });
});

describe('lineEndMs', () => {
  it('usa el endMs del manifest cuando está', () => {
    expect(lineEndMs(line({ startMs: 10_000, durationMs: 3_000, endMs: 12_500 }))).toBe(12_500);
  });

  it('cae a startMs + durationMs en un manifest v1 anterior', () => {
    expect(lineEndMs(line({ startMs: 10_000, durationMs: 3_000 }))).toBe(13_000);
  });
});

describe('overflowOf y requestedStartOf', () => {
  it('una línea sin marca no pidió ningún inicio y no desborda', () => {
    expect(requestedStartOf(line())).toBeNull();
    expect(overflowOf(line())).toBe(0);
  });

  it('requestedStartMs null tampoco es una marca', () => {
    expect(requestedStartOf(line({ requestedStartMs: null }))).toBeNull();
  });

  it('una línea con marca y desborde los informa', () => {
    const timed = line({ requestedStartMs: 22_000, overflowMs: 840 });

    expect(requestedStartOf(timed)).toBe(22_000);
    expect(overflowOf(timed)).toBe(840);
  });

  it('una marca en 0 es una marca, no la ausencia de una', () => {
    expect(requestedStartOf(line({ requestedStartMs: 0 }))).toBe(0);
  });
});

describe('totalDurationSeconds', () => {
  it('informa la duración de la pista con un decimal', () => {
    const manifest = { durationMs: 63_480 } as VoiceScriptManifest;

    expect(totalDurationSeconds(manifest)).toBe('63.5');
  });
});
