const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export function externalUrlToOpen(targetUrl: string, appOrigin: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }
  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.origin === appOrigin) return null;
  return parsed.toString();
}
