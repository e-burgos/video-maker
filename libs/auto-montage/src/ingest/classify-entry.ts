import type { MediaKind } from '@video-maker/timeline-core';

import type { DirectoryEntry } from '../fs/directory-reader';
import { mediaKindForExtension } from './supported-extensions';

export type AssetRole = 'aroll' | 'broll' | 'image' | 'audio' | 'voice' | 'logo';

export type IgnoredReason =
  | 'hidden'
  | 'unsupported-extension'
  | 'unknown-directory'
  | 'unexpected-file'
  | 'extension-role-mismatch';

const ROLE_BY_DIRECTORY_NAME: Readonly<Record<string, AssetRole>> = {
  aroll: 'aroll',
  broll: 'broll',
  images: 'image',
  audio: 'audio',
  voice: 'voice',
  logo: 'logo',
};

const EXPECTED_KIND_BY_ROLE: Readonly<Record<AssetRole, MediaKind>> = {
  aroll: 'video',
  broll: 'video',
  image: 'image',
  audio: 'audio',
  voice: 'audio',
  logo: 'image',
};

export type TopLevelClassification =
  | { readonly kind: 'role'; readonly role: AssetRole }
  | { readonly kind: 'ignored'; readonly reason: 'hidden' | 'unknown-directory' | 'unexpected-file' }
  | { readonly kind: 'skip' };

export function classifyTopLevelEntry(entry: DirectoryEntry): TopLevelClassification {
  const isHidden = entry.name.startsWith('.');

  if (entry.isDirectory) {
    if (isHidden) {
      return { kind: 'skip' };
    }
    const role = ROLE_BY_DIRECTORY_NAME[entry.name];
    return role === undefined ? { kind: 'ignored', reason: 'unknown-directory' } : { kind: 'role', role };
  }

  return isHidden ? { kind: 'ignored', reason: 'hidden' } : { kind: 'ignored', reason: 'unexpected-file' };
}

export type FileClassification =
  | { readonly kind: 'asset' }
  | {
      readonly kind: 'ignored';
      readonly reason: 'hidden' | 'unsupported-extension' | 'extension-role-mismatch';
    };

export function classifyFileEntry(name: string, role: AssetRole): FileClassification {
  if (name.startsWith('.')) {
    return { kind: 'ignored', reason: 'hidden' };
  }

  const mediaKind = mediaKindForExtension(name);
  if (mediaKind === undefined) {
    return { kind: 'ignored', reason: 'unsupported-extension' };
  }

  return mediaKind === EXPECTED_KIND_BY_ROLE[role]
    ? { kind: 'asset' }
    : { kind: 'ignored', reason: 'extension-role-mismatch' };
}
