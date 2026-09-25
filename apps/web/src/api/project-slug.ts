import type { TranslationKey } from '../i18n/messages-en';

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

export type ProjectSlugProblem = 'empty' | 'not-kebab-case';

export function projectSlugProblem(value: string): ProjectSlugProblem | null {
  if (value.length === 0) {
    return 'empty';
  }

  return PROJECT_SLUG_PATTERN.test(value) ? null : 'not-kebab-case';
}

export function projectSlugProblemKey(problem: ProjectSlugProblem): TranslationKey {
  return problem === 'empty' ? 'projectSlug.empty' : 'projectSlug.notKebabCase';
}

const FALLBACK_SLUG = 'project';

export function slugifyFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/u, '');
  const slug = withoutExtension
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return slug.length === 0 ? FALLBACK_SLUG : slug;
}

export function uniqueProjectSlug(base: string, existing: readonly string[]): string {
  if (!existing.includes(base)) {
    return base;
  }

  let counter = 2;
  while (existing.includes(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}
