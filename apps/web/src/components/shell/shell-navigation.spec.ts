import { describe, expect, it } from 'vitest';

import { projectSlugFromPathname, stepsForMode, toolbarHeadingFor } from './shell-navigation';

describe('toolbarHeadingFor', () => {
  it('maps each top level route to its own title', () => {
    expect(toolbarHeadingFor('/').titleKey).toBe('toolbar.title.videos');
    expect(toolbarHeadingFor('/brands/acme').titleKey).toBe('toolbar.title.brands');
    expect(toolbarHeadingFor('/publish-queue').titleKey).toBe('toolbar.title.publishQueue');
    expect(toolbarHeadingFor('/settings').titleKey).toBe('toolbar.title.settings');
    expect(toolbarHeadingFor('/learn').titleKey).toBe('toolbar.title.learn');
    expect(toolbarHeadingFor('/guide').titleKey).toBe('toolbar.title.learn');
  });

  it('titles a video route with its step and leaves the subtitle to the video name', () => {
    expect(toolbarHeadingFor('/projects/demo')).toEqual({ titleKey: 'toolbar.title.producer', subtitleKey: null });
    expect(toolbarHeadingFor('/projects/demo/storyboard/').titleKey).toBe('toolbar.title.storyboard');
    expect(toolbarHeadingFor('/projects/a%20b/motion').titleKey).toBe('toolbar.title.motion');
  });
});

describe('shell navigation helpers', () => {
  it('keeps the motion step only for motion videos', () => {
    expect(stepsForMode(false).some((step) => step.motionOnly === true)).toBe(false);
    expect(stepsForMode(true).some((step) => step.motionOnly === true)).toBe(true);
  });

  it('reads the slug of a video route only', () => {
    expect(projectSlugFromPathname('/projects/demo/voice')).toBe('demo');
    expect(projectSlugFromPathname('/brands')).toBeNull();
  });
});
