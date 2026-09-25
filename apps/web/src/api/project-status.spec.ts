import { describe, expect, it } from 'vitest';

import { projectStatusKey } from './project-status';

describe('projectStatusKey', () => {
  it('says there is no material when raw/ is empty', () => {
    expect(
      projectStatusKey({ raw: false, catalog: false, timeline: false, edl: false, out: false }),
    ).toBe('projects.status.noMaterial');
  });

  it('says material is loaded once raw/ has assets but there is no timeline yet', () => {
    expect(
      projectStatusKey({ raw: true, catalog: true, timeline: false, edl: false, out: false }),
    ).toBe('projects.status.materialLoaded');
  });

  it('says the cut is ready once a timeline exists but nothing rendered yet', () => {
    expect(
      projectStatusKey({ raw: true, catalog: true, timeline: true, edl: false, out: false }),
    ).toBe('projects.status.montageReady');
  });

  it('says the video is ready once out/ has a deliverable, regardless of the other flags', () => {
    expect(
      projectStatusKey({ raw: true, catalog: true, timeline: true, edl: true, out: true }),
    ).toBe('projects.status.videoReady');
  });
});
