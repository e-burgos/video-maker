import { ProjectLayoutError } from '../errors/project-layout-error';
import { buildProjectSubdirectories, deriveProjectSlug, normalizeProjectRoot } from './project-paths';

export interface MediaProject {
  readonly slug: string;
  readonly root: string;
  readonly rawDir: string;
  readonly workDir: string;
  readonly outDir: string;
}

export function resolveMediaProject(rootPath: string): MediaProject {
  if (rootPath.trim().length === 0) {
    throw new ProjectLayoutError({ projectRoot: rootPath, missingPath: rootPath });
  }

  const root = normalizeProjectRoot(rootPath);
  const slug = deriveProjectSlug(root);
  const { rawDir, workDir, outDir } = buildProjectSubdirectories(root);

  return { slug, root, rawDir, workDir, outDir };
}
