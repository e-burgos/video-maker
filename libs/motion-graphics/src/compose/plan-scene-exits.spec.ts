import { describe, expect, it } from 'vitest';

import { catalogStoryboard } from '../__fixtures__/catalog-storyboard';
import type { MotionStoryboard, MotionStoryboardScene } from '../storyboard/motion-storyboard.schema';
import { planSceneExits } from './plan-scene-exits';

function hook(id: string, extra: Partial<MotionStoryboardScene> = {}): MotionStoryboardScene {
  return { id, kind: 'hook', vo: `Escena ${id}`, props: { title: 'Título' }, ...extra } as MotionStoryboardScene;
}

function storyboardOf(scenes: MotionStoryboardScene[], title = 'Prueba'): MotionStoryboard {
  return { ...catalogStoryboard, title, scenes };
}

describe('planSceneExits', () => {
  const scenes = Array.from({ length: 12 }, (_, i) => hook(`s${i}`));

  it('asigna una salida a cada escena menos la última y nunca repite la anterior', () => {
    const exits = planSceneExits(storyboardOf(scenes));
    const sequence = scenes.slice(0, -1).map((s) => exits.get(s.id));

    expect(exits.has('s11')).toBe(false);
    expect(sequence.every((exit) => exit !== undefined)).toBe(true);
    sequence.slice(2).forEach((exit, i) => expect([sequence[i], sequence[i + 1]]).not.toContain(exit));
    expect(new Set(sequence).size).toBeGreaterThan(2);
  });

  it('es determinista para el mismo storyboard y cambia entre videos distintos', () => {
    const sequence = (title: string) => [...planSceneExits(storyboardOf(scenes, title)).values()];

    expect(sequence('Video A')).toEqual(sequence('Video A'));
    expect(sequence('Video A')).not.toEqual(sequence('Video B'));
  });

  it('usa un corte fuerte antes de un capítulo nuevo', () => {
    const withChapters = [hook('a'), hook('b', { chapter: 'Dos' }), hook('c'), hook('d', { chapter: 'Tres' }), hook('e')];
    const exits = planSceneExits(storyboardOf(withChapters));

    expect(['wipe', 'iris', 'slide-left']).toContain(exits.get('a'));
    expect(['wipe', 'iris', 'slide-left']).toContain(exits.get('c'));
  });

  it('respeta la salida que pidió el storyboard', () => {
    const exits = planSceneExits(storyboardOf([hook('a', { exit: 'iris' }), hook('b', { exit: 'iris' }), hook('c')]));

    expect(exits.get('a')).toBe('iris');
    expect(exits.get('b')).toBe('iris');
  });
});
