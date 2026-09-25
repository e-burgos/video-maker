import { describe, expect, it } from 'vitest';

import {
  projectSlugProblem,
  projectSlugProblemKey,
  slugifyFileName,
  uniqueProjectSlug,
} from './project-slug';

describe('projectSlugProblem', () => {
  it('accepts what the service accepts', () => {
    expect(projectSlugProblem('smoke-ingest')).toBeNull();
    expect(projectSlugProblem('video01')).toBeNull();
    expect(projectSlugProblem('a-b-c-1')).toBeNull();
  });

  it('rejects an empty slug before any request is emitted', () => {
    expect(projectSlugProblem('')).toBe('empty');
  });

  it('rejects exactly what the service answers PROJECT_SLUG_INVALID for', () => {
    expect(projectSlugProblem('Smoke')).toBe('not-kebab-case');
    expect(projectSlugProblem('smoke_ingest')).toBe('not-kebab-case');
    expect(projectSlugProblem('smoke/ingest')).toBe('not-kebab-case');
    expect(projectSlugProblem('-smoke')).toBe('not-kebab-case');
    expect(projectSlugProblem('smoke-')).toBe('not-kebab-case');
    expect(projectSlugProblem('smoke--ingest')).toBe('not-kebab-case');
    expect(projectSlugProblem('..')).toBe('not-kebab-case');
  });

  it('names the translation key of both problems', () => {
    expect(projectSlugProblemKey('empty')).toBe('projectSlug.empty');
    expect(projectSlugProblemKey('not-kebab-case')).toBe('projectSlug.notKebabCase');
  });
});

describe('slugifyFileName', () => {
  it('turns spaces and case into a valid kebab-case slug', () => {
    const slug = slugifyFileName('My Video Ad.mp4');
    expect(projectSlugProblem(slug)).toBeNull();
    expect(slug).toBe('my-video-ad');
  });

  it('strips accents instead of dropping the whole word', () => {
    expect(slugifyFileName('Campaña Verano.mov')).toBe('campana-verano');
  });

  it('collapses repeated separators and trims stray ones at the edges', () => {
    expect(slugifyFileName('  weird__name!!.mp4')).toBe('weird-name');
  });

  it('falls back to a generic slug when nothing alphanumeric survives', () => {
    const slug = slugifyFileName('___.mp4');
    expect(projectSlugProblem(slug)).toBeNull();
    expect(slug).toBe('project');
  });
});

describe('uniqueProjectSlug', () => {
  it('keeps the base slug when nothing collides', () => {
    expect(uniqueProjectSlug('demo', ['other'])).toBe('demo');
  });

  it('appends the next free numeric suffix on a collision', () => {
    expect(uniqueProjectSlug('demo', ['demo'])).toBe('demo-2');
    expect(uniqueProjectSlug('demo', ['demo', 'demo-2'])).toBe('demo-3');
  });
});
