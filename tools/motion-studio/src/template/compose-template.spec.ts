import { describe, expect, it } from 'vitest';

import type { MotionScript } from '../script/motion-script';
import { composeTemplate, wordTime } from './compose-template';
import type { MotionTimeline, SceneWords } from './motion-timeline';

const script: MotionScript = {
  voice: 'es_AR-daniela-high',
  lengthScale: 1.08,
  music: { file: 'm.mp3', credit: 'Tema · CC BY 4.0' },
  noWhooshOn: ['drop'],
  scenes: [
    { id: 'hook', vo: 'Hola', minBars: 1, anchor: null },
    { id: 'drop', vo: 'Display Ads', minBars: 1, anchor: 4 },
    { id: 'end', vo: 'Chau', minBars: 1, anchor: null },
  ],
  sfx: [
    { id: 'click', scene: 'end', word: 'chau', offset: -0.1 },
    { id: 'riser', scene: 'drop', word: null, offset: -3.4 },
  ],
};

const timeline: MotionTimeline = {
  beatSync: true,
  duration: 9,
  bpm: 120,
  beatLength: 0.5,
  beats: [0, 0.5, 1],
  scenes: [
    { id: 'hook', start: 0, end: 4, voStart: 0.25, voDuration: 1 },
    { id: 'drop', start: 4, end: 6.5, voStart: 4.25, voDuration: 1.2 },
    { id: 'end', start: 6.5, end: 9, voStart: 6.75, voDuration: 0.8 },
  ],
  musicAutomation: { version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 0 }] }] },
  musicCredit: 'Tema · CC BY 4.0',
};

const words: SceneWords = { end: [{ w: 'Chau.', t: 0.1, e: 0.5 }], drop: [{ w: 'Display', t: 0, e: 0.3 }] };

describe('composeTemplate', () => {
  it('fills scene timing, voice and whoosh tracks, sfx anchored to words and the credit', () => {
    const html = composeTemplate(
      '<div data-start="{{start:drop}}" data-duration="{{dur:drop}}"></div>{{voice_tracks}}|{{whoosh_tracks}}|{{sfx:click}}|{{sfx:riser}}|{{music_credit}}|{{duration}}',
      script,
      timeline,
      words,
    );
    expect(html).toContain('data-start="4" data-duration="2.5"');
    expect(html).toContain('id="vo-hook" src="assets/audio/vo-hook.wav" data-start="0.25" data-duration="1"');
    expect(html).toContain('id="sfx-whoosh-end"');
    expect(html).not.toContain('sfx-whoosh-drop');
    expect(html).not.toContain('sfx-whoosh-hook');
    expect(html).toContain('|6.75|0.6|Tema · CC BY 4.0|9');
  });

  it('embeds the timeline, words and automation as JSON', () => {
    const html = composeTemplate("{{timeline_json}}\n{{words_json}}\n'{{music_automation}}'", script, timeline, words);
    const [tl = '', w = ''] = html.split('\n');
    expect(JSON.parse(tl).scenes).toHaveLength(3);
    expect(JSON.parse(tl).scenes[1]).toMatchObject({ id: 'drop', vo: 'Display Ads' });
    expect(JSON.parse(w).end[0].w).toBe('Chau.');
  });

  it('fails on a placeholder without value', () => {
    expect(() => composeTemplate('{{start:missing}}', script, timeline, words)).toThrow('{{start:missing}}');
  });

  it('fails when a sfx word is not spoken', () => {
    const broken = { ...script, sfx: [{ id: 'x', scene: 'end', word: 'hola', offset: 0 }] };
    expect(() => composeTemplate('', broken, timeline, words)).toThrow('word "hola" not found');
  });
});

describe('wordTime', () => {
  it('resolves a word by normalized prefix to absolute time', () => {
    expect(wordTime(timeline, words, 'drop', 'displ')).toBe(4.25);
  });
});
