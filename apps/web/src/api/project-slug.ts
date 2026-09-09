const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

export type ProjectSlugProblem = 'empty' | 'not-kebab-case';

export function projectSlugProblem(value: string): ProjectSlugProblem | null {
  if (value.length === 0) {
    return 'empty';
  }

  return PROJECT_SLUG_PATTERN.test(value) ? null : 'not-kebab-case';
}

export function projectSlugProblemMessage(problem: ProjectSlugProblem): string {
  return problem === 'empty'
    ? 'Enter a project slug.'
    : 'A slug is one lowercase kebab-case segment: letters, digits and single dashes.';
}
