import { describe, expect, it } from 'vitest';

import {
  compactDirection,
  directedLineCount,
  emphasisInLine,
  hasDirection,
  isEmphasized,
  sameDirections,
  setLineDirection,
  toggleEmphasis,
  withEnergy,
  withPace,
  withPauseAfterMs,
  wordsOfLine,
} from './voice-direction';

describe('compactDirection', () => {
  it('drops the defaults so an untouched direction is no direction', () => {
    expect(compactDirection({ pace: 'normal', energy: 'neutral', pauseAfterMs: 0, emphasis: [] })).toBeUndefined();
  });

  it('keeps what departs from the voice defaults, and the intent', () => {
    expect(compactDirection({ intent: 'reassuring', pace: 'slow', pauseAfterMs: 400 })).toEqual({
      intent: 'reassuring',
      pace: 'slow',
      pauseAfterMs: 400,
    });
  });
});

describe('field setters', () => {
  it('sets the pace and goes back to nothing when it returns to normal', () => {
    const slow = withPace(undefined, 'slow');
    expect(slow).toEqual({ pace: 'slow' });
    expect(withPace(slow, 'normal')).toBeUndefined();
  });

  it('keeps the other fields when one changes', () => {
    expect(withEnergy({ pace: 'fast' }, 'lively')).toEqual({ pace: 'fast', energy: 'lively' });
  });

  it('clamps the pause to 0..2000 ms', () => {
    expect(withPauseAfterMs(undefined, 5000)).toEqual({ pauseAfterMs: 2000 });
    expect(withPauseAfterMs({ pauseAfterMs: 300 }, -20)).toBeUndefined();
    expect(withPauseAfterMs(undefined, Number.NaN)).toBeUndefined();
  });
});

describe('emphasis', () => {
  it('offers each distinct word of the line with three letters or more', () => {
    expect(wordsOfLine('El editor la ajusta, el editor!')).toEqual(['editor', 'ajusta']);
  });

  it('toggles a word on and off', () => {
    const on = toggleEmphasis(undefined, 'editor');
    expect(on).toEqual({ emphasis: ['editor'] });
    expect(isEmphasized(on, 'EDITOR')).toBe(true);
    expect(toggleEmphasis(on, 'editor')).toBeUndefined();
  });

  it('refuses a ninth word', () => {
    const full = { emphasis: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'] };
    expect(toggleEmphasis(full, 'nueve')).toBe(full);
  });

  it('keeps only the stressed words that are still in the text', () => {
    expect(emphasisInLine({ emphasis: ['editor', 'plantilla'] }, 'El editor la ajusta')).toEqual({
      emphasis: ['editor'],
    });
  });
});

describe('script directions', () => {
  it('stores a line by its number and removes it when the direction empties', () => {
    const withLine = setLineDirection({}, 2, { pace: 'slow' });
    expect(withLine).toEqual({ '2': { pace: 'slow' } });
    expect(setLineDirection(withLine, 2, undefined)).toEqual({});
  });

  it('counts only lines that really carry a direction', () => {
    expect(directedLineCount({ '1': { pace: 'slow' }, '2': { pace: 'normal' } })).toBe(1);
    expect(hasDirection({ energy: 'calm' })).toBe(true);
    expect(hasDirection(undefined)).toBe(false);
  });

  it('compares directions ignoring defaults and key order', () => {
    expect(sameDirections({ '1': { pace: 'slow', energy: 'calm' } }, { '1': { energy: 'calm', pace: 'slow' } })).toBe(true);
    expect(sameDirections({ '1': { pace: 'normal' } }, {})).toBe(true);
    expect(sameDirections({ '1': { pace: 'slow' } }, {})).toBe(false);
  });
});
