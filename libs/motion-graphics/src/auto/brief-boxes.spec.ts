import { describe, expect, it } from 'vitest';

import { minimalBrand } from '../__fixtures__/catalog-storyboard';
import { parseMotionStoryboard } from '../storyboard/parse-motion-storyboard';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { applyBriefBoxes, checkStoryboardBoxes, listMeasuredBoxes } from './brief-boxes';
import { checkStoryboardAgainstBrief } from './check-storyboard-against-brief';
import { parseMotionBrief } from './motion-brief';

const boxes = [
  { name: 'Plan Propio', x: 0.175, y: 0.358, w: 0.308, h: 0.104 },
  { name: 'Plan Flex', x: 0.175, y: 0.477, w: 0.308, h: 0.134 },
];

const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Guion', images: [{ file: 'cotizador.png', caption: 'Cotizador', boxes }] });

const storyboardWith = (steps: unknown[], props: Record<string, unknown> = {}): MotionStoryboard =>
  parseMotionStoryboard({
    version: 1,
    title: 'Promo',
    brand: 'acme',
    format: '16:9',
    beatSync: false,
    music: null,
    scenes: [
      { id: 'uno', kind: 'ui-walkthrough', vo: 'Elegí el plan propio', props: { image: 'images/cotizador.png', steps, ...props } },
      { id: 'dos', kind: 'cta', vo: 'Cotizá', props: { button: 'Ir' } },
    ],
  });

describe('brief images with boxes', () => {
  it('accepts named boxes inside the image and rejects the ones that leave it or repeat a name', () => {
    expect(brief.images[0]?.boxes).toHaveLength(2);
    const image = (list: unknown[]) => () => parseMotionBrief({ version: 1, brand: 'acme', script: 'x', images: [{ file: 'a.png', caption: 'a', boxes: list }] });
    expect(image([{ name: 'A', x: 0.8, y: 0, w: 0.4, h: 0.1 }])).toThrow(/leaves the image/u);
    expect(image([{ name: 'A', x: 0, y: 0, w: 0.1, h: 0.1 }, { name: 'A', x: 0.5, y: 0.5, w: 0.1, h: 0.1 }])).toThrow(/duplicated box name/u);
  });
});

describe('checkStoryboardBoxes', () => {
  it('accepts raw coordinates that match a measured box within the tolerance', () => {
    const storyboard = storyboardWith([{ action: 'highlight', x: 0.18, y: 0.36, w: 0.305, h: 0.108 }]);
    expect(checkStoryboardBoxes(storyboard, brief)).toEqual([]);
  });

  it('rejects an estimated highlight naming the closest measured box', () => {
    const storyboard = storyboardWith([{ action: 'highlight', x: 0.24, y: 0.375, w: 0.18, h: 0.1 }]);
    const [issue] = checkStoryboardBoxes(storyboard, brief);
    expect(issue?.path).toBe('scenes[0].props.steps[0]');
    expect(issue?.message).toContain('use box "Plan Propio" (x 0.175, y 0.358, w 0.308, h 0.104)');
  });

  it('rejects zoom and type estimates too, and a highlight without a measured size', () => {
    const storyboard = storyboardWith([
      { action: 'zoom', x: 0.3, y: 0.3, w: 0.5, h: 0.5 },
      { action: 'type', x: 0.3, y: 0.3, w: 0.1, h: 0.05, text: 'Hola' },
      { action: 'highlight', x: 0.175, y: 0.358 },
    ]);
    expect(checkStoryboardBoxes(storyboard, brief)).toHaveLength(3);
  });

  it('lets moves, clicks and callouts use raw points', () => {
    const storyboard = storyboardWith([{ action: 'click', x: 0.3, y: 0.4 }, { action: 'callout', x: 0.5, y: 0.5, text: 'Acá' }]);
    expect(checkStoryboardBoxes(storyboard, brief)).toEqual([]);
  });

  it('ignores captures without measured boxes', () => {
    const plain = parseMotionBrief({ version: 1, brand: 'acme', script: 'x', images: [{ file: 'cotizador.png', caption: 'Cotizador' }] });
    expect(checkStoryboardBoxes(storyboardWith([{ action: 'highlight', x: 0.24, y: 0.375, w: 0.18, h: 0.1 }]), plain)).toEqual([]);
  });

  it('flags a box name the image does not have, listing the ones it has', () => {
    const [issue] = checkStoryboardBoxes(storyboardWith([{ action: 'highlight', box: 'Plan Gold' }]), brief);
    expect(issue?.message).toContain('box "Plan Gold" does not exist');
    expect(issue?.message).toContain('"Plan Propio", "Plan Flex"');
  });

  it('flags a box step when the storyboard carries no boxes and there is no brief', () => {
    const [issue] = checkStoryboardBoxes(storyboardWith([{ action: 'highlight', box: 'Plan Propio' }]), null);
    expect(issue?.message).toContain('the image has no measured boxes');
  });

  it('is part of the brief check', () => {
    const storyboard = storyboardWith([{ action: 'highlight', x: 0.24, y: 0.375, w: 0.18, h: 0.1 }]);
    expect(checkStoryboardAgainstBrief(storyboard, brief, minimalBrand).some((issue) => issue.message.includes('Plan Propio'))).toBe(true);
  });
});

describe('applyBriefBoxes', () => {
  it('copies the boxes of the brief image into a walkthrough that points at them', () => {
    const applied = applyBriefBoxes(storyboardWith([{ action: 'highlight', box: 'Plan Flex' }]), brief);
    const scene = applied.scenes[0];
    expect(scene?.kind === 'ui-walkthrough' && scene.props.boxes).toMatchObject(boxes);
    expect(checkStoryboardBoxes(applied, brief)).toEqual([]);
  });

  it('leaves walkthroughs that use raw coordinates untouched', () => {
    const storyboard = storyboardWith([{ action: 'highlight', x: 0.175, y: 0.358, w: 0.308, h: 0.104 }]);
    expect(applyBriefBoxes(storyboard, brief)).toEqual(storyboard);
  });
});

describe('measured boxes', () => {
  const measuredBrief = parseMotionBrief({
    version: 1,
    brand: 'acme',
    script: 'Guion',
    images: [
      {
        file: 'cotizador.png',
        caption: 'Cotizador',
        boxes: [
          { name: 'Plan Propio', x: 0.175, y: 0.358, w: 0.308, h: 0.104 },
          { name: 'Boton', x: 0.6, y: 0.8, w: 0.2, h: 0.1, source: 'measured', measuredBy: 'producer', measuredAt: '2026-10-13T10:00:00.000Z' },
        ],
      },
    ],
  });

  it('defaults to given when a stored brief has no source', () => {
    expect(brief.images[0]?.boxes?.every((box) => box.source === 'given')).toBe(true);
  });

  it('requires measuredBy and measuredAt on a measured box and forbids them on a given one', () => {
    const image = (box: unknown) => () => parseMotionBrief({ version: 1, brand: 'acme', script: 'x', images: [{ file: 'a.png', caption: 'a', boxes: [box] }] });
    const base = { name: 'A', x: 0, y: 0, w: 0.1, h: 0.1 };
    expect(image({ ...base, source: 'measured' })).toThrow(/needs measuredBy/u);
    expect(image({ ...base, measuredBy: 'producer', measuredAt: '2026-10-13T10:00:00.000Z' })).toThrow(/source is given/u);
  });

  it('lists only the measured boxes apart, as measured by the producer on a date', () => {
    expect(listMeasuredBoxes(measuredBrief)).toEqual([
      { image: 'images/cotizador.png', name: 'Boton', measuredBy: 'producer', measuredAt: '2026-10-13T10:00:00.000Z', message: 'Caja "Boton" de images/cotizador.png: medida por el productor el 13/10/2026; confirmala con el dueño.' },
    ]);
    expect(listMeasuredBoxes(brief)).toEqual([]);
    expect(listMeasuredBoxes(null)).toEqual([]);
  });

  it('tells the origin of a measured box when a step names a box that does not exist', () => {
    const storyboard = storyboardWith([{ action: 'highlight', box: 'Nada' }]);
    const [issue] = checkStoryboardBoxes(storyboard, measuredBrief);
    expect(issue?.message).toContain('"Boton" (medida por el productor el 13/10/2026)');
    expect(issue?.message).toContain('"Plan Propio"');
  });
});
