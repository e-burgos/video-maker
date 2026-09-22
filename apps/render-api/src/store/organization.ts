export interface VideoCategory {
  readonly id: string;
  readonly name: string;
}

export interface VideoFolder {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly VideoCategory[];
}

export interface VideoPlacement {
  readonly folderId: string | null;
  readonly categoryId: string | null;
  readonly archived: boolean;
}

export interface Organization {
  readonly folders: readonly VideoFolder[];
  readonly videos: Readonly<Record<string, VideoPlacement>>;
}

export const EMPTY_ORGANIZATION: Organization = { folders: [], videos: {} };

export const UNPLACED_VIDEO: VideoPlacement = { folderId: null, categoryId: null, archived: false };

const IDENTIFIER_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
const MAX_NAME_LENGTH = 60;

export function isValidIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').slice(0, MAX_NAME_LENGTH);
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

export function toIdentifier(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function uniqueIdentifier(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${String(suffix)}`)) {
    suffix += 1;
  }
  return `${base}-${String(suffix)}`;
}

export function folderIdentifiers(organization: Organization): ReadonlySet<string> {
  return new Set(organization.folders.map((folder) => folder.id));
}

export function findFolder(organization: Organization, folderId: string): VideoFolder | null {
  return organization.folders.find((folder) => folder.id === folderId) ?? null;
}

export function findCategory(folder: VideoFolder, categoryId: string): VideoCategory | null {
  return folder.categories.find((category) => category.id === categoryId) ?? null;
}

export function placementOf(organization: Organization, slug: string): VideoPlacement {
  return organization.videos[slug] ?? UNPLACED_VIDEO;
}

export function addFolder(organization: Organization, name: string): { organization: Organization; folder: VideoFolder } {
  const folder: VideoFolder = {
    id: uniqueIdentifier(toIdentifier(name), folderIdentifiers(organization)),
    name: normalizeName(name),
    categories: [],
  };
  return { organization: { ...organization, folders: [...organization.folders, folder] }, folder };
}

export function renameFolder(organization: Organization, folderId: string, name: string): Organization {
  return {
    ...organization,
    folders: organization.folders.map((folder) =>
      folder.id === folderId ? { ...folder, name: normalizeName(name) } : folder,
    ),
  };
}

function isDefaultPlacement(placement: VideoPlacement): boolean {
  return placement.folderId === null && placement.categoryId === null && !placement.archived;
}

function pruneDefaultPlacements(videos: Organization['videos']): Organization['videos'] {
  return Object.fromEntries(
    Object.entries(videos).filter(([, placement]) => !isDefaultPlacement(placement)),
  );
}

function withoutVideo(videos: Organization['videos'], slug: string): Organization['videos'] {
  return Object.fromEntries(Object.entries(videos).filter(([key]) => key !== slug));
}

function withoutFolderPlacements(
  videos: Organization['videos'],
  folderId: string,
): Organization['videos'] {
  return pruneDefaultPlacements(
    Object.fromEntries(
      Object.entries(videos).map(([slug, placement]) =>
        placement.folderId === folderId
          ? [slug, { ...placement, folderId: null, categoryId: null }]
          : [slug, placement],
      ),
    ),
  );
}

export function removeFolder(organization: Organization, folderId: string): Organization {
  return {
    folders: organization.folders.filter((folder) => folder.id !== folderId),
    videos: withoutFolderPlacements(organization.videos, folderId),
  };
}

export function addCategory(
  organization: Organization,
  folder: VideoFolder,
  name: string,
): { organization: Organization; category: VideoCategory } {
  const category: VideoCategory = {
    id: uniqueIdentifier(toIdentifier(name), new Set(folder.categories.map((entry) => entry.id))),
    name: normalizeName(name),
  };
  return {
    organization: {
      ...organization,
      folders: organization.folders.map((entry) =>
        entry.id === folder.id ? { ...entry, categories: [...entry.categories, category] } : entry,
      ),
    },
    category,
  };
}

function withoutCategoryPlacements(
  videos: Organization['videos'],
  folderId: string,
  categoryId: string,
): Organization['videos'] {
  return Object.fromEntries(
    Object.entries(videos).map(([slug, placement]) =>
      placement.folderId === folderId && placement.categoryId === categoryId
        ? [slug, { ...placement, categoryId: null }]
        : [slug, placement],
    ),
  );
}

export function removeCategory(
  organization: Organization,
  folderId: string,
  categoryId: string,
): Organization {
  return {
    folders: organization.folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, categories: folder.categories.filter((category) => category.id !== categoryId) }
        : folder,
    ),
    videos: withoutCategoryPlacements(organization.videos, folderId, categoryId),
  };
}

function withPlacement(
  organization: Organization,
  slug: string,
  placement: VideoPlacement,
): Organization {
  if (isDefaultPlacement(placement)) {
    return { ...organization, videos: withoutVideo(organization.videos, slug) };
  }

  return { ...organization, videos: { ...organization.videos, [slug]: placement } };
}

export function placeVideo(
  organization: Organization,
  slug: string,
  target: { folderId: string | null; categoryId: string | null },
): Organization {
  const current = placementOf(organization, slug);
  return withPlacement(organization, slug, { ...current, ...target });
}

export function archiveVideo(organization: Organization, slug: string, archived: boolean): Organization {
  const current = placementOf(organization, slug);
  return withPlacement(organization, slug, { ...current, archived });
}

export function forgetVideo(organization: Organization, slug: string): Organization {
  return { ...organization, videos: withoutVideo(organization.videos, slug) };
}
