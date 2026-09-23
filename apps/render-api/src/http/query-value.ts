export function queryValue(rawPath: string, name: string): string | null {
  const queryIndex = rawPath.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }

  return new URLSearchParams(rawPath.slice(queryIndex + 1)).get(name);
}
