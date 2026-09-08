import { describe, expect, it } from 'vitest';

import { fixtureMediaProject } from '../__fixtures__/media-project';

import { resolveRenderTarget } from './resolve-render-target';

describe('resolveRenderTarget', () => {
  it('sets publicDir to the project root, never the raw directory (CA-014)', () => {
    const target = resolveRenderTarget(fixtureMediaProject);

    expect(target.publicDir).toBe(fixtureMediaProject.root);
    expect(target.publicDir).not.toBe(fixtureMediaProject.rawDir);
  });

  it('sets outPath to <root>/out/<slug>.mp4, with no flag to override it', () => {
    const target = resolveRenderTarget(fixtureMediaProject);

    expect(target.outPath).toBe(`${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`);
  });

  it('is a pure function of the project (same input, same output)', () => {
    expect(resolveRenderTarget(fixtureMediaProject)).toEqual(resolveRenderTarget(fixtureMediaProject));
  });
});
