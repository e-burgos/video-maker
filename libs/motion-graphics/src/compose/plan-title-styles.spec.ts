import { describe, expect, it } from 'vitest';

import { catalogStoryboard } from '../__fixtures__/catalog-storyboard';
import { TITLE_STYLES } from '../storyboard/motion-storyboard.schema';
import type { MotionStoryboard, MotionStoryboardScene } from '../storyboard/motion-storyboard.schema';
import { planTitleStyles } from './plan-title-styles';

function hook(id: string, extra: Partial<MotionStoryboardScene> = {}): MotionStoryboardScene {
  return { id, kind: 'hook', vo: `Escena ${id}`, props: { title: 'Título' }, ...extra } as MotionStoryboardScene;
}

function storyboardOf(scenes: MotionStoryboardScene[], title = 'Prueba'): MotionStoryboard {
  return { ...catalogStoryboard, title, scenes };
}

describe('planTitleStyles', () => {
  const scenes = Array.from({ length: 12 }, (_, i) => hook(`s${i}`));

  it('da un estilo a cada escena y nunca repite ninguno de los dos anteriores', () => {
    const styles = planTitleStyles(storyboardOf(scenes));
    const sequence = scenes.map((s) => styles.get(s.id));

    expect(sequence.every((style) => style !== undefined && TITLE_STYLES.includes(style))).toBe(true);
    sequence.slice(2).forEach((style, i) => expect([sequence[i], sequence[i + 1]]).not.toContain(style));
    expect(new Set(sequence).size).toBeGreaterThan(3);
  });

  it('es determinista para el mismo storyboard y cambia entre videos distintos', () => {
    const sequence = (title: string) => [...planTitleStyles(storyboardOf(scenes, title)).values()].join();

    expect(sequence('A')).toBe(sequence('A'));
    expect(new Set(['A', 'B', 'C', 'D', 'E'].map(sequence)).size).toBeGreaterThan(1);
  });

  it('respeta el estilo pedido y lo cuenta para la rotación de las siguientes', () => {
    const fixed = [hook('a', { titleStyle: 'scramble' }), hook('b'), hook('c', { titleStyle: 'mask-up' }), hook('d')];
    const styles = planTitleStyles(storyboardOf(fixed));

    expect(styles.get('a')).toBe('scramble');
    expect(styles.get('b')).not.toBe('scramble');
    expect(styles.get('c')).toBe('mask-up');
    expect(['mask-up', styles.get('b')]).not.toContain(styles.get('d'));
  });
});
