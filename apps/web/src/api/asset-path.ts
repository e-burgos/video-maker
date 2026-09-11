export function assetFileName(path: string): string {
  const lastSeparator = path.lastIndexOf('/');
  return lastSeparator === -1 ? path : path.slice(lastSeparator + 1);
}
