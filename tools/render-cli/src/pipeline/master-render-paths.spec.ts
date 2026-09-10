import { describe, expect, it } from 'vitest';

import { fixtureMediaProject } from '../__fixtures__/media-project';
import { resolveMasterRenderPaths } from './master-render-paths';

describe('resolveMasterRenderPaths', () => {
  it('usa el mismo layout que el job render de la API: intermedios en work/renders/<id>/', () => {
    const paths = resolveMasterRenderPaths(fixtureMediaProject);

    expect(paths).toEqual({
      publicDir: fixtureMediaProject.root,
      workDir: `${fixtureMediaProject.root}/work/renders/${fixtureMediaProject.slug}`,
      outDir: fixtureMediaProject.outDir,
      mutedVideoPath: `${fixtureMediaProject.root}/work/renders/${fixtureMediaProject.slug}/video-muted.mp4`,
      masterAudioPath: `${fixtureMediaProject.root}/work/renders/${fixtureMediaProject.slug}/master.wav`,
      deliverablePath: `${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`,
    });
  });

  it('conserva el nombre del entregable de la CLI: out/<slug>.mp4, no un uuid como el de la API', () => {
    expect(resolveMasterRenderPaths(fixtureMediaProject).deliverablePath).toBe(
      `${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`,
    );
  });

  it('el publicDir de Remotion es la raíz del proyecto, no raw/', () => {
    const paths = resolveMasterRenderPaths(fixtureMediaProject);
    expect(paths.publicDir).toBe(fixtureMediaProject.root);
    expect(paths.publicDir).not.toBe(fixtureMediaProject.rawDir);
  });
});
