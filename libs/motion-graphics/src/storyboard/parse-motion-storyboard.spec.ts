import { describe, expect, it } from 'vitest';

import counter15 from '../../assets/storyboards/displayads/counter-15.json';
import easyPro from '../../assets/storyboards/displayads/easy-pro.json';
import presentacion from '../../assets/storyboards/displayads/presentacion.json';
import { MotionStudioError } from '../errors/motion-studio-error';
import { SCENE_KINDS } from './motion-storyboard.schema';
import { formatIssuePath, motionStoryboardJsonSchema, parseMotionStoryboard } from './parse-motion-storyboard';

describe('parseMotionStoryboard', () => {
  it.each([
    ['presentacion', presentacion],
    ['counter-15', counter15],
    ['easy-pro', easyPro],
  ])('accepts the shipped %s storyboard', (_, raw) => {
    expect(parseMotionStoryboard(raw).brand).toBe('displayads');
  });

  it('reports the path of every invalid field', () => {
    const bad = { ...presentacion, scenes: [{ ...presentacion.scenes[0], kind: 'nope' }, presentacion.scenes[1]] };
    expect(() => parseMotionStoryboard(bad)).toThrow(/scenes\[0\]\.kind/u);
    try {
      parseMotionStoryboard({});
    } catch (error) {
      expect(error).toBeInstanceOf(MotionStudioError);
      expect((error as MotionStudioError).code).toBe('STORYBOARD_INVALID');
    }
  });

  it('rejects duplicated scene ids', () => {
    const dup = { ...counter15, scenes: [counter15.scenes[0], counter15.scenes[0]] };
    expect(() => parseMotionStoryboard(dup)).toThrow(/duplicated scene id "intro"/u);
  });

  describe('voice direction and music mode', () => {
    const withDirection = (direction: unknown) => ({ ...counter15, scenes: [{ ...counter15.scenes[0], direction }, ...counter15.scenes.slice(1)] });

    it('accepts a scene direction and a music mode', () => {
      const parsed = parseMotionStoryboard({ ...withDirection({ pace: 'slow', energy: 'calm', pauseAfterMs: 600 }), music: { track: 'x', mode: 'segments', floorDb: -24 } });
      expect(parsed.scenes[0]?.direction).toEqual({ pace: 'slow', energy: 'calm', pauseAfterMs: 600 });
      expect(parsed.music).toMatchObject({ mode: 'segments', floorDb: -24 });
    });

    it('rejects an out-of-range direction naming its path', () => {
      expect(() => parseMotionStoryboard(withDirection({ pauseAfterMs: 9000 }))).toThrow(/scenes\[0\]\.direction\.pauseAfterMs/u);
      expect(() => parseMotionStoryboard(withDirection({ pace: 'turbo' }))).toThrow(/scenes\[0\]\.direction\.pace/u);
    });

    it('rejects an emphasis word that is not in the vo of the scene', () => {
      expect(() => parseMotionStoryboard(withDirection({ emphasis: ['zzzzzz'] }))).toThrow(/emphasis "zzzzzz" is not in the vo/u);
    });

    it('rejects a music floor outside the range', () => {
      expect(() => parseMotionStoryboard({ ...counter15, music: { track: 'x', mode: 'segments', floorDb: -2 } })).toThrow(/music\.floorDb/u);
    });
  });

  it('formats issue paths', () => {
    expect(formatIssuePath([])).toBe('');
    expect(formatIssuePath(['scenes', 2, 'props', 'title'])).toBe('scenes[2].props.title');
  });

  it('exposes a json schema with the whole scene catalog for the AI', () => {
    const schema = JSON.stringify(motionStoryboardJsonSchema());
    expect(SCENE_KINDS).toHaveLength(17);
    for (const kind of SCENE_KINDS) expect(schema).toContain(`"${kind}"`);
  });

  describe('ui-walkthrough', () => {
    const walkthrough = (steps: unknown[], props: Record<string, unknown> = {}) => ({
      ...counter15,
      scenes: [{ id: 'uno', kind: 'ui-walkthrough', vo: 'Tocá el botón', props: { image: 'images/captura.png', steps, ...props } }, counter15.scenes[1]],
    });

    it('accepts the six actions with defaults for the frame', () => {
      const parsed = parseMotionStoryboard(
        walkthrough([
          { action: 'move', x: 0, y: 1 },
          { action: 'click', x: 0.5, y: 0.5 },
          { action: 'type', x: 0.1, y: 0.1, w: 0.5, h: 0.1, text: 'Hola' },
          { action: 'highlight', x: 0.1, y: 0.1 },
          { action: 'callout', x: 0.5, y: 0.5, text: 'Acá' },
          { action: 'zoom', x: 0.5, y: 0.5, cue: 'tocá' },
        ]),
      );
      expect(parsed.scenes[0]?.kind).toBe('ui-walkthrough');
    });

    it.each([
      ['coordinates beyond 1', [{ action: 'click', x: 1.2, y: 0.5 }], /scenes\[0\]\.props\.steps\[0\]\.x/u],
      ['negative coordinates', [{ action: 'move', x: 0.5, y: -0.1 }], /steps\[0\]\.y/u],
      ['a zero size box', [{ action: 'highlight', x: 0.1, y: 0.1, w: 0, h: 0.1 }], /steps\[0\]\.w/u],
      ['a box that leaves the capture on x', [{ action: 'highlight', x: 0.8, y: 0.1, w: 0.4, h: 0.1 }], /steps\[0\]\.w: box leaves the capture/u],
      ['a box that leaves the capture on y', [{ action: 'zoom', x: 0.1, y: 0.9, w: 0.2, h: 0.2 }], /steps\[0\]\.h: box leaves the capture/u],
      ['type without text', [{ action: 'type', x: 0.1, y: 0.1, w: 0.2, h: 0.1 }], /steps\[0\]\.text: text is required when action is "type"/u],
      ['callout without text', [{ action: 'callout', x: 0.1, y: 0.1 }], /steps\[0\]\.text: text is required when action is "callout"/u],
      ['a size on a click', [{ action: 'click', x: 0.1, y: 0.1, w: 0.1, h: 0.1 }], /steps\[0\]\.w: w and h only apply/u],
      ['no steps', [], /steps/u],
      ['nine steps', Array.from({ length: 9 }, () => ({ action: 'move', x: 0.5, y: 0.5 })), /steps/u],
    ])('rejects %s naming scene and field', (_, steps, expected) => {
      expect(() => parseMotionStoryboard(walkthrough(steps))).toThrow(expected);
    });

    it('rejects an unknown frame', () => {
      expect(() => parseMotionStoryboard(walkthrough([{ action: 'move', x: 0.5, y: 0.5 }], { frame: 'tv' }))).toThrow(/props\.frame/u);
    });

    it('accepts a step that points at a box instead of coordinates', () => {
      const parsed = parseMotionStoryboard(walkthrough([{ action: 'highlight', box: 'Plan Propio' }], { boxes: [{ name: 'Plan Propio', x: 0.1, y: 0.1, w: 0.2, h: 0.1 }] }));
      expect(parsed.scenes[0]?.kind === 'ui-walkthrough' && parsed.scenes[0].props.steps[0]?.box).toBe('Plan Propio');
    });

    it.each([
      ['a box together with coordinates', [{ action: 'highlight', box: 'A', x: 0.1, y: 0.1 }], /steps\[0\]\.box: a step uses either box or x,y,w,h/u],
      ['a step with neither box nor position', [{ action: 'highlight' }], /steps\[0\]\.x: x and y are required unless box is set/u],
    ])('rejects %s', (_, steps, expected) => {
      expect(() => parseMotionStoryboard(walkthrough(steps))).toThrow(expected);
    });

    it('accepts minSec on any scene and rejects a non positive one', () => {
      const withMinSec = (minSec: number) => ({ ...counter15, scenes: [{ ...counter15.scenes[0], minSec }, counter15.scenes[1]] });
      expect(parseMotionStoryboard(withMinSec(4.5)).scenes[0]?.minSec).toBe(4.5);
      expect(() => parseMotionStoryboard(withMinSec(0))).toThrow(/minSec/u);
    });

    it('describes the coordinate convention to the AI', () => {
      expect(JSON.stringify(motionStoryboardJsonSchema())).toContain('0 = left edge, 1 = right edge');
    });
  });

  it('tells the AI that an accent follows the title instead of highlighting part of it', () => {
    expect(JSON.stringify(motionStoryboardJsonSchema())).toContain('right AFTER the title');
  });
});
