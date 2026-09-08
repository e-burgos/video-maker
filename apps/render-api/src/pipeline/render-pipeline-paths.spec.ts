import { describe, expect, it } from 'vitest';

import { resolveRenderPipelinePaths } from './render-pipeline-paths';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const RENDER_ID = 'r-2026-09-08-01';

describe('resolveRenderPipelinePaths', () => {
  it('places the intermediates under work/renders/<renderId> and the deliverable under out/', () => {
    const paths = resolveRenderPipelinePaths(PROJECT_ROOT, RENDER_ID);

    expect(paths.workDir.path).toBe(`${PROJECT_ROOT}/work/renders/${RENDER_ID}`);
    expect(paths.mutedVideo.path).toBe(`${PROJECT_ROOT}/work/renders/${RENDER_ID}/video-muted.mp4`);
    expect(paths.masterAudio.path).toBe(`${PROJECT_ROOT}/work/renders/${RENDER_ID}/master.wav`);
    expect(paths.outDir.path).toBe(`${PROJECT_ROOT}/out`);
    expect(paths.deliverable.path).toBe(`${PROJECT_ROOT}/out/${RENDER_ID}.mp4`);
  });

  it('exposes project-relative resources alongside the filesystem paths', () => {
    const paths = resolveRenderPipelinePaths(PROJECT_ROOT, RENDER_ID);

    expect(paths.publicDir).toBe(PROJECT_ROOT);
    expect(paths.workDir.resource).toBe(`work/renders/${RENDER_ID}`);
    expect(paths.mutedVideo.resource).toBe(`work/renders/${RENDER_ID}/video-muted.mp4`);
    expect(paths.masterAudio.resource).toBe(`work/renders/${RENDER_ID}/master.wav`);
    expect(paths.outDir.resource).toBe('out');
    expect(paths.deliverable.resource).toBe(`out/${RENDER_ID}.mp4`);

    for (const file of [paths.workDir, paths.outDir, paths.mutedVideo, paths.masterAudio, paths.deliverable]) {
      expect(file.resource.startsWith(PROJECT_ROOT)).toBe(false);
      expect(file.resource.startsWith('/')).toBe(false);
    }
  });
});
