function numericParts(version: string): readonly number[] | null {
  const [core = ''] = version.trim().replace(/^v/, '').split(/[-+]/);
  const parts = core.split('.');
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  return parts.map(Number);
}

export function isNewerVersion(candidate: string, installed: string): boolean | null {
  const candidateParts = numericParts(candidate);
  const installedParts = numericParts(installed);
  if (candidateParts === null || installedParts === null) {
    return null;
  }
  const length = Math.max(candidateParts.length, installedParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (candidateParts[index] ?? 0) - (installedParts[index] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return false;
}
