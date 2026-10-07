import { describe, expect, it } from 'vitest';

import { testBrand } from '../__fixtures__/catalog-storyboard';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { checkStoryboardAgainstBrief, enforceBrief } from './check-storyboard-against-brief';
import type { MotionBrief } from './motion-brief';

const brief: MotionBrief = {
  version: 1,
  brand: 'acme',
  format: '9:16',
  beatSync: false,
  music: 'auto',
  script: 'Guion',
  images: [{ file: 'local.jpg', caption: 'Un local' }],
};

const validStoryboard: MotionStoryboard = {
  version: 1,
  title: 'Promo',
  brand: 'acme',
  format: '9:16',
  beatSync: false,
  music: { track: 'beat' },
  scenes: [
    { id: 'uno', kind: 'feature', vo: 'Mirá tu Árbol de pantallas', props: { title: 'Árbol', bullets: [{ text: 'Ok', cue: 'arbol' }], visual: { kind: 'image', src: 'images/local.jpg' } } },
    { id: 'dos', kind: 'product', vo: 'El Counter manda', props: { name: 'Counter', text: 'x', textCue: 'count', visual: { kind: 'device', device: 'counter' } } },
    { id: 'tres', kind: 'gallery', vo: 'Locales reales', props: { images: ['brand:local', 'images/local.jpg'] } },
  ],
};

const withScenes = (scenes: MotionStoryboard['scenes'], rest: Partial<MotionStoryboard> = {}): MotionStoryboard => ({ ...validStoryboard, ...rest, scenes });

describe('enforceBrief', () => {
  it('overrides version, brand, format, beat sync and title and keeps the rest', () => {
    const raw = { version: 2, brand: 'other', format: '16:9', beatSync: true, title: 'Mío', music: { track: 'calm' }, scenes: [] };
    expect(enforceBrief(raw, { ...brief, title: 'Del brief' })).toEqual({ version: 1, brand: 'acme', format: '9:16', beatSync: false, title: 'Del brief', music: { track: 'calm' }, scenes: [] });
  });

  it('keeps the title of the answer when the brief has none', () => {
    expect((enforceBrief({ title: 'Mío' }, brief) as { title: string }).title).toBe('Mío');
  });

  it('imposes a fixed track or silence but leaves auto to the answer', () => {
    expect((enforceBrief({ music: { track: 'calm' } }, { ...brief, music: 'beat' }) as { music: unknown }).music).toEqual({ track: 'beat' });
    expect((enforceBrief({ music: { track: 'calm' } }, { ...brief, music: null }) as { music: unknown }).music).toBeNull();
    expect((enforceBrief({ music: { track: 'calm' } }, brief) as { music: unknown }).music).toEqual({ track: 'calm' });
  });

  it('drops the voice of the answer so the brand voice applies', () => {
    expect(enforceBrief({ voice: { id: 'otra', lengthScale: 1 } }, brief)).not.toHaveProperty('voice');
  });

  it('passes through anything that is not an object', () => {
    expect(enforceBrief('x', brief)).toBe('x');
    expect(enforceBrief(null, brief)).toBeNull();
  });
});

describe('checkStoryboardAgainstBrief', () => {
  it('accepts a storyboard whose images, devices, cues and track are all known', () => {
    expect(checkStoryboardAgainstBrief(validStoryboard, brief, testBrand)).toEqual([]);
  });

  it('flags an image that is neither in the brief nor a brand image, at its path', () => {
    const [first] = validStoryboard.scenes;
    const scenes = [
      { ...(first as MotionStoryboard['scenes'][number]), props: { title: 'x', bullets: [], visual: { kind: 'image' as const, src: 'images/nope.jpg' } } },
      validStoryboard.scenes[2] as MotionStoryboard['scenes'][number],
    ];
    const issues = checkStoryboardAgainstBrief(withScenes(scenes as MotionStoryboard['scenes']), brief, testBrand);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('scenes[0].props.visual.src');
    expect(issues[0]?.message).toContain('images/nope.jpg');
  });

  it('flags unknown brand images inside galleries and ai-generate results', () => {
    const scenes: MotionStoryboard['scenes'] = [
      { id: 'g', kind: 'gallery', vo: 'Dos fotos', props: { images: ['brand:ghost', 'images/local.jpg'] } },
      { id: 'a', kind: 'ai-generate', vo: 'Listo', props: { title: 'IA', prompt: 'x', result: { image: 'images/zzz.jpg' } } },
    ];
    expect(checkStoryboardAgainstBrief(withScenes(scenes), brief, testBrand).map((i) => i.path)).toEqual(['scenes[0].props.images[0]', 'scenes[1].props.result.image']);
  });

  it('flags a device missing from the brand, including connections', () => {
    const scenes: MotionStoryboard['scenes'] = [
      { id: 'p', kind: 'product', vo: 'Equipo', props: { name: 'X', text: 'x', visual: { kind: 'device', device: 'ghost' } } },
      { id: 'c', kind: 'connections', vo: 'Conexiones', props: { title: 'x', device: 'phantom', links: [{ to: 'tv', label: 'TV' }] } },
    ];
    const issues = checkStoryboardAgainstBrief(withScenes(scenes), brief, testBrand);
    expect(issues.map((i) => i.path)).toEqual(['scenes[0].props.visual.device', 'scenes[1].props.device']);
  });

  it('flags a retired device so new videos never show a product that is no longer sold', () => {
    const scenes: MotionStoryboard['scenes'] = [{ id: 'p', kind: 'product', vo: 'Equipo', props: { name: 'X', text: 'x', visual: { kind: 'device', device: 'old' } } }];
    const issues = checkStoryboardAgainstBrief(withScenes(scenes), brief, testBrand);
    expect(issues).toEqual([{ path: 'scenes[0].props.visual.device', message: expect.stringMatching(/retired/u) }]);
  });

  it('flags a cue that is not the start of a word of the scene vo, in any cue field and nested screen state', () => {
    const scenes: MotionStoryboard['scenes'] = [
      { id: 'h', kind: 'hook', vo: 'Una pantalla apagada', props: { lines: [{ title: 'x', cue: 'ghost' }], screen: { text: 'x', offCue: 'apag', stampCue: 'nada' } } },
      { id: 's', kind: 'step', vo: 'Elegí la red', props: { label: 'Paso', title: 'x', visual: { kind: 'phone', states: [{ screen: { type: 'boot' }, cue: 'wifi' }] } } },
    ];
    const issues = checkStoryboardAgainstBrief(withScenes(scenes), brief, testBrand);
    expect(issues.map((i) => i.path)).toEqual(['scenes[0].props.lines[0].cue', 'scenes[0].props.screen.stampCue', 'scenes[1].props.visual.states[0].cue']);
    expect(issues[0]?.message).toContain('"ghost"');
  });

  it('matches cues ignoring accents and case', () => {
    const scenes: MotionStoryboard['scenes'] = [
      { id: 'h', kind: 'hook', vo: 'Cuánto cuesta ELÉCTRICA', props: { lines: [{ title: 'x', cue: 'CUANTO' }, { title: 'y', cue: 'electr' }] } },
      validStoryboard.scenes[0] as MotionStoryboard['scenes'][number],
    ];
    expect(checkStoryboardAgainstBrief(withScenes(scenes), brief, testBrand)).toEqual([]);
  });

  it('flags a music track outside the brand and accepts silence', () => {
    expect(checkStoryboardAgainstBrief({ ...validStoryboard, music: { track: 'ghost' } }, brief, testBrand)[0]?.path).toBe('music.track');
    expect(checkStoryboardAgainstBrief({ ...validStoryboard, music: null }, brief, testBrand)).toEqual([]);
  });
});
