import { resolveMediaProject, toAbsolutePath } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { parseProducerConversation, parseProducerSession } from '../producer/producer-documents';
import { producerConversationPath, producerSessionPath } from '../producer/producer-paths';
import { isValidProjectSlug } from './project-slug';
import { organizationPath, parseOrganization } from './organization-store';
import type { Organization, VideoPlacement } from './organization';

const ORGANIZATION_IMPORT_SETTINGS_KEY = 'import.organization.v1';

export interface ImportSkip {
  readonly slug: string;
  readonly reason: string;
}

export interface ImportLegacyMediaReport {
  readonly projectsImported: number;
  readonly organizationImported: boolean;
  readonly conversationsImported: number;
  readonly skipped: readonly ImportSkip[];
}

function uniqueSuffixed(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${String(suffix)}`)) {
    suffix += 1;
  }
  return `${base}-${String(suffix)}`;
}

function categoryRemapKey(folderId: string | null, categoryId: string): string {
  return `${folderId ?? ''}::${categoryId}`;
}

async function importProjectDirectories(deps: RenderApiDependencies, store: StoreConfig): Promise<number> {
  const entries = await deps.storage.listDirectory(store.mediaRoot);
  const slugs = (entries ?? [])
    .filter((entry) => entry.isDirectory && isValidProjectSlug(entry.name))
    .map((entry) => entry.name);

  let imported = 0;
  for (const slug of slugs) {
    if (!deps.localStore.projects.exists(slug)) {
      deps.localStore.projects.insert(slug, deps.clock.nowIso());
      imported += 1;
    }
  }
  return imported;
}

function importOrganizationTables(deps: RenderApiDependencies, organization: Organization): void {
  const usedCategoryIds = new Set<string>();
  const categoryIdRemap = new Map<string, string>();

  for (const folder of organization.folders) {
    deps.localStore.organization.createFolder(folder.id, folder.name);
    for (const category of folder.categories) {
      const newId = uniqueSuffixed(category.id, usedCategoryIds);
      usedCategoryIds.add(newId);
      if (newId !== category.id) {
        categoryIdRemap.set(categoryRemapKey(folder.id, category.id), newId);
      }
      deps.localStore.organization.createCategory(newId, folder.id, category.name);
    }
  }

  for (const [slug, placement] of Object.entries(organization.videos)) {
    if (!deps.localStore.projects.exists(slug)) {
      continue;
    }

    const categoryId =
      placement.categoryId === null
        ? null
        : (categoryIdRemap.get(categoryRemapKey(placement.folderId, placement.categoryId)) ?? placement.categoryId);
    const resolvedPlacement: VideoPlacement = {
      folderId: placement.folderId,
      categoryId,
      archived: placement.archived,
    };
    deps.localStore.organization.setPlacement(slug, resolvedPlacement);
  }
}

async function importOrganizationDocument(
  deps: RenderApiDependencies,
  store: StoreConfig,
  skipped: ImportSkip[],
): Promise<boolean> {
  if (deps.localStore.settings.get(ORGANIZATION_IMPORT_SETTINGS_KEY) !== null) {
    return false;
  }

  const current = deps.localStore.organization.getOrganization();
  if (current.folders.length > 0 || Object.keys(current.videos).length > 0) {
    return false;
  }

  const relativePath = organizationPath(store.mediaRoot);
  const stat = await deps.storage.stat(relativePath);
  if (stat === null) {
    return false;
  }

  const raw = await deps.storage.readTextFile(relativePath);

  let organization: Organization;
  try {
    organization = parseOrganization(JSON.parse(raw));
  } catch {
    skipped.push({ slug: '.studio/organization.json', reason: 'organization.json is not valid JSON' });
    return false;
  }

  importOrganizationTables(deps, organization);

  deps.localStore.settings.set(ORGANIZATION_IMPORT_SETTINGS_KEY, {
    sha256: deps.hashText(raw),
    importedAt: deps.clock.nowIso(),
  });

  return true;
}

async function importProducerSession(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
  skipped: ImportSkip[],
): Promise<void> {
  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const relativePath = producerSessionPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  const stat = await deps.storage.stat(absolutePath);
  if (stat === null) {
    return;
  }

  try {
    const raw = await deps.storage.readTextFile(absolutePath);
    const session = parseProducerSession(JSON.parse(raw), relativePath);
    deps.localStore.producer.setSession(slug, {
      sessionId: session.sessionId,
      model: session.model,
      startedAt: session.createdAt,
      updatedAt: session.lastTurnAt,
    });
  } catch {
    skipped.push({ slug, reason: 'session.json is not valid JSON' });
  }
}

async function importProducerForProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
  skipped: ImportSkip[],
): Promise<boolean> {
  if (deps.localStore.producer.getConversation(slug).length > 0) {
    return false;
  }

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const relativePath = producerConversationPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  const stat = await deps.storage.stat(absolutePath);
  if (stat === null) {
    return false;
  }

  let document: unknown;
  try {
    const raw = await deps.storage.readTextFile(absolutePath);
    document = JSON.parse(raw);
  } catch {
    skipped.push({ slug, reason: 'conversation.json is not valid JSON' });
    return false;
  }

  let messages;
  try {
    messages = parseProducerConversation(document, relativePath).messages;
  } catch {
    skipped.push({ slug, reason: 'conversation.json failed validation' });
    return false;
  }

  for (const message of messages) {
    deps.localStore.producer.appendMessage(slug, message);
  }

  await importProducerSession(deps, store, slug, skipped);

  return true;
}

export async function importLegacyMedia(
  deps: RenderApiDependencies,
  store: StoreConfig,
): Promise<ImportLegacyMediaReport> {
  const skipped: ImportSkip[] = [];

  const projectsImported = await importProjectDirectories(deps, store);
  const organizationImported = await importOrganizationDocument(deps, store, skipped);

  let conversationsImported = 0;
  for (const record of deps.localStore.projects.list()) {
    try {
      if (await importProducerForProject(deps, store, record.slug, skipped)) {
        conversationsImported += 1;
      }
    } catch (cause) {
      skipped.push({ slug: record.slug, reason: cause instanceof Error ? cause.message : 'unknown import error' });
    }
  }

  return { projectsImported, organizationImported, conversationsImported, skipped };
}
