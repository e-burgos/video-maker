export function joinPath(...segments: string[]): string {
  return segments.join('/').replace(/\/{2,}/gu, '/');
}
