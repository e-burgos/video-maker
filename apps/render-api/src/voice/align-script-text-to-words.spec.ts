import { describe, expect, it } from 'vitest';

import { alignScriptTextToWords } from './align-script-text-to-words';

function heard(...entries: readonly [string, number, number][]) {
  return entries.map(([text, startMs, endMs]) => ({ text, startMs, endMs }));
}

describe('alignScriptTextToWords', () => {
  it('keeps the script spelling with the timings Whisper heard for each word', () => {
    const words = alignScriptTextToWords(
      'La franja horaria manda.',
      heard(['La', 0, 200], ['franca', 200, 600], ['horaria', 600, 1000], ['manda', 1000, 1300]),
    );

    expect(words.map((word) => word.text)).toEqual(['La', 'franja', 'horaria', 'manda.']);
    expect(words.map((word) => [word.startMs, word.endMs])).toEqual([
      [0, 200],
      [200, 600],
      [600, 1000],
      [1000, 1300],
    ]);
  });

  it('spreads a brand name Whisper merged into one token over the time that token took', () => {
    const words = alignScriptTextToWords(
      'tutorial de Display Ads, nos vemos',
      heard(['tutorial', 0, 400], ['de', 400, 500], ['Displayance,', 500, 1100], ['nos', 1100, 1300], ['vemos', 1300, 1600]),
    );

    expect(words.map((word) => word.text)).toEqual(['tutorial', 'de', 'Display', 'Ads,', 'nos', 'vemos']);
    expect(words[2]).toEqual({ text: 'Display', startMs: 500, endMs: 800 });
    expect(words[3]).toEqual({ text: 'Ads,', startMs: 800, endMs: 1100 });
  });

  it('places a script word Whisper missed between its neighbours', () => {
    const words = alignScriptTextToWords('Creada, la sucursal', heard(['la', 300, 500], ['sucursal', 500, 1000]));

    expect(words).toEqual([
      { text: 'Creada,', startMs: 300, endMs: 400 },
      { text: 'la', startMs: 400, endMs: 500 },
      { text: 'sucursal', startMs: 500, endMs: 1000 },
    ]);
  });

  it('spreads the whole line over the heard span when nothing matches', () => {
    const words = alignScriptTextToWords('Hola mundo', heard(['xx', 0, 400], ['yy', 400, 1000]));

    expect(words).toEqual([
      { text: 'Hola', startMs: 0, endMs: 500 },
      { text: 'mundo', startMs: 500, endMs: 1000 },
    ]);
  });

  it('shares the last heard word with the script words Whisper dropped at the end', () => {
    const words = alignScriptTextToWords('Las campañas viven acá', heard(['Las', 0, 400], ['campañas', 400, 1200]));

    expect(words).toEqual([
      { text: 'Las', startMs: 0, endMs: 400 },
      { text: 'campañas', startMs: 400, endMs: 667 },
      { text: 'viven', startMs: 667, endMs: 933 },
      { text: 'acá', startMs: 933, endMs: 1200 },
    ]);
  });
});
