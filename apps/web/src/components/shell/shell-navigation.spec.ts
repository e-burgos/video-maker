import { describe, expect, it } from 'vitest';

import { SIDEBAR_SECTIONS, isMigratedRoute, projectSlugFromPathname, stepsForMode, toolbarHeadingFor } from './shell-navigation';

describe('toolbarHeadingFor', () => {
  it('maps each top level route to its own title', () => {
    expect(toolbarHeadingFor('/').titleKey).toBe('toolbar.title.videos');
    expect(toolbarHeadingFor('/brands/acme').titleKey).toBe('toolbar.title.brands');
    expect(toolbarHeadingFor('/publish-queue').titleKey).toBe('toolbar.title.publishQueue');
    expect(toolbarHeadingFor('/settings').titleKey).toBe('toolbar.title.settings');
    expect(toolbarHeadingFor('/guide').titleKey).toBe('toolbar.title.guide');
  });

  it('titles a video route with its step and leaves the subtitle to the video name', () => {
    expect(toolbarHeadingFor('/projects/demo')).toEqual({ titleKey: 'toolbar.title.producer', subtitleKey: null });
    expect(toolbarHeadingFor('/projects/demo/storyboard/').titleKey).toBe('toolbar.title.storyboard');
    expect(toolbarHeadingFor('/projects/a%20b/motion').titleKey).toBe('toolbar.title.motion');
  });
});

describe('shell navigation helpers', () => {
  it('treats every route of the studio as off the legacy surface', () => {
    expect(isMigratedRoute('/')).toBe(true);
    expect(isMigratedRoute('/projects/demo')).toBe(true);
    expect(isMigratedRoute('/projects/demo/')).toBe(true);
    expect(isMigratedRoute('/projects/demo/library')).toBe(true);
    expect(isMigratedRoute('/projects/demo/storyboard')).toBe(true);
    expect(isMigratedRoute('/projects/demo/voice/')).toBe(true);
    expect(isMigratedRoute('/projects/demo/preview')).toBe(true);
    expect(isMigratedRoute('/projects/demo/motion/')).toBe(true);
    expect(isMigratedRoute('/brands')).toBe(true);
    expect(isMigratedRoute('/brands/acme')).toBe(true);
    expect(isMigratedRoute('/brands/acme/')).toBe(true);
    expect(isMigratedRoute('/publish-queue')).toBe(true);
    expect(isMigratedRoute('/publish-queue/')).toBe(true);
    expect(SIDEBAR_SECTIONS.flatMap((section) => section.items.map((item) => item.to)).every(isMigratedRoute)).toBe(true);
    expect(isMigratedRoute('/settings')).toBe(true);
    expect(isMigratedRoute('/settings/')).toBe(true);
    expect(isMigratedRoute('/guide')).toBe(true);
    expect(isMigratedRoute('/guide/')).toBe(true);
  });

  it('keeps the motion step only for motion videos', () => {
    expect(stepsForMode(false).some((step) => step.motionOnly === true)).toBe(false);
    expect(stepsForMode(true).some((step) => step.motionOnly === true)).toBe(true);
  });

  it('reads the slug of a video route only', () => {
    expect(projectSlugFromPathname('/projects/demo/voice')).toBe('demo');
    expect(projectSlugFromPathname('/brands')).toBeNull();
  });
});
