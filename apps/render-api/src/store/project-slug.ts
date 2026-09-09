const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

export function isValidProjectSlug(value: string): boolean {
  return PROJECT_SLUG_PATTERN.test(value);
}
