import { describe, expect, it } from 'vitest';

import { parseHyperframesBeats } from './parse-hyperframes-beats';

describe('parseHyperframesBeats', () => {
  it('reads the onsets written by hyperframes beats', () => {
    const json = JSON.stringify({ version: 1, audio: 'assets/music.mp3', beats: [{ time: 0.708, strength: 0.501 }, { time: 1.01, strength: 0.738 }] });
    expect(parseHyperframesBeats(json)).toEqual([{ time: 0.708, strength: 0.501 }, { time: 1.01, strength: 0.738 }]);
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['{"version":1}', 'no "beats" array'],
    ['{"beats":[{"time":-1,"strength":0.2}]}', 'beats[0]'],
    ['{"beats":[null]}', 'beats[0]'],
  ])('rejects %s', (json, message) => {
    expect(() => parseHyperframesBeats(json)).toThrow(message);
  });
});
