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

  it('formats issue paths', () => {
    expect(formatIssuePath([])).toBe('');
    expect(formatIssuePath(['scenes', 2, 'props', 'title'])).toBe('scenes[2].props.title');
  });

  it('exposes a json schema with the whole scene catalog for the AI', () => {
    const schema = JSON.stringify(motionStoryboardJsonSchema());
    expect(SCENE_KINDS).toHaveLength(16);
    for (const kind of SCENE_KINDS) expect(schema).toContain(`"${kind}"`);
  });

  it('tells the AI that an accent follows the title instead of highlighting part of it', () => {
    expect(JSON.stringify(motionStoryboardJsonSchema())).toContain('right AFTER the title');
  });
});
