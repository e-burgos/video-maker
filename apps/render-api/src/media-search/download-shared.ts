import type { ObjectStorage } from '../deps/object-storage';

export function withSuffix(baseName: string, suffix: number): string {
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex <= 0
    ? `${baseName}-${suffix}`
    : `${baseName.slice(0, dotIndex)}-${suffix}${baseName.slice(dotIndex)}`;
}

export async function resolveUniqueFileName(
  storage: ObjectStorage,
  directory: string,
  baseName: string,
): Promise<string> {
  const entries = await storage.listDirectory(directory);
  const taken = new Set((entries ?? []).map((entry) => entry.name));
  if (!taken.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (taken.has(withSuffix(baseName, suffix))) {
    suffix += 1;
  }
  return withSuffix(baseName, suffix);
}
