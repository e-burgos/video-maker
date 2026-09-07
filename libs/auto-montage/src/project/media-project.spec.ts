import { describe, expect, it } from 'vitest';

import { ProjectLayoutError } from '../errors/project-layout-error';
import { resolveMediaProject } from './media-project';

describe('resolveMediaProject', () => {
  it('deriva slug y las tres subcarpetas a partir de la raíz del proyecto', () => {
    const project = resolveMediaProject('/tmp/media/pitch-deck');

    expect(project).toEqual({
      slug: 'pitch-deck',
      root: '/tmp/media/pitch-deck',
      rawDir: '/tmp/media/pitch-deck/raw',
      workDir: '/tmp/media/pitch-deck/work',
      outDir: '/tmp/media/pitch-deck/out',
    });
  });

  it('normaliza una raíz con slash final antes de derivar el slug', () => {
    const project = resolveMediaProject('/tmp/media/pitch-deck/');

    expect(project.root).toBe('/tmp/media/pitch-deck');
    expect(project.slug).toBe('pitch-deck');
  });

  it('no toca el filesystem: no lanza si raw/ no existe en disco', () => {
    expect(() => resolveMediaProject('/tmp/media/nonexistent-project')).not.toThrow();
  });

  it('normaliza la raíz del filesystem sin quitarle su slash', () => {
    const project = resolveMediaProject('/');

    expect(project.root).toBe('/');
    expect(project.rawDir).toBe('/raw');
  });

  it('lanza ProjectLayoutError cuando la raíz está vacía', () => {
    expect(() => resolveMediaProject('')).toThrow(ProjectLayoutError);
  });

  it('lanza ProjectLayoutError cuando la raíz es solo espacios', () => {
    expect(() => resolveMediaProject('   ')).toThrow(ProjectLayoutError);
  });
});
