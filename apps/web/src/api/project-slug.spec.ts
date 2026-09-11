import { describe, expect, it } from 'vitest';

import { projectSlugProblem, projectSlugProblemKey } from './project-slug';

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
