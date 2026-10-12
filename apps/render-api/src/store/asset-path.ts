export const ASSET_ROLES = ['aroll', 'broll', 'image', 'audio', 'voice', 'logo', 'reference'] as const;

export type AssetRole = (typeof ASSET_ROLES)[number];

export const SERVABLE_ROOTS = ['raw', 'work', 'out'] as const;

const RAW_DIRECTORY_BY_ROLE: Readonly<Record<AssetRole, string>> = {
  aroll: 'aroll',
  broll: 'broll',
  image: 'images',
  audio: 'audio',
  voice: 'voice',
  logo: 'logo',
  reference: 'reference',
};

const WINDOWS_DRIVE_LETTER_PATTERN = /^[A-Za-z]:[\\/]/u;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

function isPortable(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !WINDOWS_DRIVE_LETTER_PATTERN.test(value) &&
    !URI_SCHEME_PATTERN.test(value)
  );
}

export function isAssetRole(value: string): value is AssetRole {
  return (ASSET_ROLES as readonly string[]).includes(value);
}

export function rawDirectoryForRole(role: AssetRole): string {
  return RAW_DIRECTORY_BY_ROLE[role];
}

export function isPortableFileName(value: string): boolean {
  return isPortable(value) && !value.includes('/') && value !== '.' && value !== '..';
}

export function isPortableArtifactPath(value: string): boolean {
  if (!isPortable(value)) {
    return false;
  }

  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '..')) {
    return false;
  }

  const root = segments[0];
  return root !== undefined && (SERVABLE_ROOTS as readonly string[]).includes(root);
}
