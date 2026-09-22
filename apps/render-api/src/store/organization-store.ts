import { join } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';
import { EMPTY_ORGANIZATION, isValidIdentifier, normalizeName } from './organization';
import type { Organization, VideoCategory, VideoFolder, VideoPlacement } from './organization';

export const ORGANIZATION_DIRECTORY = '.studio';
export const ORGANIZATION_FILENAME = 'organization.json';

export function organizationPath(mediaRoot: string): string {
  return join(mediaRoot, ORGANIZATION_DIRECTORY, ORGANIZATION_FILENAME);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCategory(value: unknown): VideoCategory | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, name } = value;
  if (typeof id !== 'string' || !isValidIdentifier(id) || typeof name !== 'string') {
    return null;
  }
  return { id, name: normalizeName(name) };
}

function parseFolder(value: unknown): VideoFolder | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, name, categories } = value;
  if (typeof id !== 'string' || !isValidIdentifier(id) || typeof name !== 'string') {
    return null;
  }
  const parsed = Array.isArray(categories)
    ? categories.map(parseCategory).filter((category): category is VideoCategory => category !== null)
    : [];
  return { id, name: normalizeName(name), categories: parsed };
}

function parsePlacement(value: unknown): VideoPlacement | null {
  if (!isRecord(value)) {
    return null;
  }
  const { folderId, categoryId, archived } = value;
  return {
    folderId: typeof folderId === 'string' && isValidIdentifier(folderId) ? folderId : null,
    categoryId: typeof categoryId === 'string' && isValidIdentifier(categoryId) ? categoryId : null,
    archived: archived === true,
  };
}

export function parseOrganization(value: unknown): Organization {
  if (!isRecord(value)) {
    return EMPTY_ORGANIZATION;
  }

  const folders = Array.isArray(value['folders'])
    ? value['folders'].map(parseFolder).filter((folder): folder is VideoFolder => folder !== null)
    : [];

  const known = new Set(folders.map((folder) => folder.id));
  const rawVideos = isRecord(value['videos']) ? value['videos'] : {};
  const videos: Record<string, VideoPlacement> = {};

  for (const [slug, entry] of Object.entries(rawVideos)) {
    const placement = parsePlacement(entry);
    if (placement === null) {
      continue;
    }
    const folderId = placement.folderId !== null && known.has(placement.folderId) ? placement.folderId : null;
    const folder = folders.find((candidate) => candidate.id === folderId);
    const categoryId =
      folder !== undefined && placement.categoryId !== null &&
      folder.categories.some((category) => category.id === placement.categoryId)
        ? placement.categoryId
        : null;
    videos[slug] = { folderId, categoryId, archived: placement.archived };
  }

  return { folders, videos };
}

export async function readOrganization(storage: ObjectStorage, mediaRoot: string): Promise<Organization> {
  try {
    return parseOrganization(JSON.parse(await storage.readTextFile(organizationPath(mediaRoot))));
  } catch {
    return EMPTY_ORGANIZATION;
  }
}

export async function writeOrganization(
  storage: ObjectStorage,
  mediaRoot: string,
  organization: Organization,
): Promise<void> {
  await storage.ensureDirectory(join(mediaRoot, ORGANIZATION_DIRECTORY));
  await storage.writeTextFile(organizationPath(mediaRoot), `${JSON.stringify(organization, null, 2)}\n`);
}
