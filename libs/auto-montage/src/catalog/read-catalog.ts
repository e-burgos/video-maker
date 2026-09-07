import type { ReadTextFile } from '@video-maker/media-local';

import { CatalogUnreadableError } from '../errors/catalog-unreadable-error';
import type { MediaProject } from '../project/media-project';
import { catalogPath, toAbsolutePath } from '../project/project-paths';
import { CATALOG_SCHEMA_VERSION, CatalogSchema } from './catalog.schema';
import type { Catalog } from './catalog.schema';

export interface ReadCatalogDependencies {
  readonly readTextFile: ReadTextFile;
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function extractSchemaVersion(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof candidate === 'number' ? candidate : undefined;
}

export async function readCatalog(
  project: MediaProject,
  deps: ReadCatalogDependencies,
): Promise<Catalog | null> {
  const relativeCatalogPath = catalogPath();
  const absoluteCatalogPath = toAbsolutePath(project, relativeCatalogPath);

  let raw: string;
  try {
    raw = await deps.readTextFile(absoluteCatalogPath);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    throw new CatalogUnreadableError({
      catalogPath: relativeCatalogPath,
      issues: ['No se pudo leer el archivo del catálogo.'],
      cause: error,
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (cause) {
    throw new CatalogUnreadableError({
      catalogPath: relativeCatalogPath,
      issues: ['El contenido del catálogo no es JSON válido.'],
      cause,
    });
  }

  const foundSchemaVersion = extractSchemaVersion(parsedJson);
  if (foundSchemaVersion !== undefined && foundSchemaVersion !== CATALOG_SCHEMA_VERSION) {
    throw new CatalogUnreadableError({
      catalogPath: relativeCatalogPath,
      issues: [
        `schemaVersion del catálogo es ${foundSchemaVersion}; la versión vigente es ${CATALOG_SCHEMA_VERSION}.`,
      ],
    });
  }

  const result = CatalogSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new CatalogUnreadableError({
      catalogPath: relativeCatalogPath,
      issues: result.error.issues.map((issue) => issue.message),
      cause: result.error,
    });
  }

  if (result.data.projectSlug !== project.slug) {
    throw new CatalogUnreadableError({
      catalogPath: relativeCatalogPath,
      issues: [
        `projectSlug del catálogo es "${result.data.projectSlug}"; se esperaba "${project.slug}".`,
      ],
    });
  }

  return result.data;
}
