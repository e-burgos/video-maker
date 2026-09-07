import { guardEnsureDirectory, guardWriteTextFile } from '../fs/guard-raw-writes';
import type { EnsureDirectory } from '../fs/ensure-directory';
import type { WriteTextFile } from '../fs/write-text-file';
import type { MediaProject } from '../project/media-project';
import { catalogPath, toAbsolutePath, workPath } from '../project/project-paths';
import { CatalogSchema } from './catalog.schema';
import type { Catalog } from './catalog.schema';

export interface WriteCatalogDependencies {
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
}

export async function writeCatalog(
  project: MediaProject,
  catalog: Catalog,
  deps: WriteCatalogDependencies,
): Promise<void> {
  const parsedCatalog = CatalogSchema.parse(catalog);
  const serialized = `${JSON.stringify(parsedCatalog, null, 2)}\n`;

  const ensureDirectory = guardEnsureDirectory(project, deps.ensureDirectory);
  const writeTextFile = guardWriteTextFile(project, deps.writeTextFile);

  await ensureDirectory(toAbsolutePath(project, workPath()));
  await writeTextFile(toAbsolutePath(project, catalogPath()), serialized);
}
