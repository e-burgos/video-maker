import type { MediaProject } from '@video-maker/auto-montage';

export const FIXTURE_PROJECT_ROOT = '/media/p';

export const fixtureMediaProject: MediaProject = {
  slug: 'p',
  root: FIXTURE_PROJECT_ROOT,
  rawDir: '/media/p/raw',
  workDir: '/media/p/work',
  outDir: '/media/p/out',
};
