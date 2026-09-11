export function queryFlag(rawPath: string, name: string): boolean {
  const queryIndex = rawPath.indexOf('?');
  if (queryIndex === -1) {
    return false;
  }

  return new URLSearchParams(rawPath.slice(queryIndex + 1)).get(name) === 'true';
}
