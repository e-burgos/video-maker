import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { ObjectStorage } from '../../deps/object-storage';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PRODUCER_DIRECTORY_NAME } from '../../producer/producer-paths';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { VOICE_DIRECTORY_NAME } from '../../voice/voice-paths';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';
import type { RouteParams } from '../router';

export const GENERATED_OUT_ROOT = 'out';

export const GENERATED_ROOTS = [
  workPath(VOICE_DIRECTORY_NAME),
  workPath(PRODUCER_DIRECTORY_NAME),
  GENERATED_OUT_ROOT,
] as const;

export interface GeneratedFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface GeneratedBody {
  readonly slug: string;
  readonly roots: readonly string[];
  readonly files: readonly GeneratedFile[];
}

async function listFilesUnder(
  storage: ObjectStorage,
  project: MediaProject,
  relativeDirectory: string,
): Promise<GeneratedFile[]> {
  const entries = await storage.listDirectory(toAbsolutePath(project, relativeDirectory));
  if (entries === null) {
    return [];
  }

  const files: GeneratedFile[] = [];
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory) {
      files.push(...(await listFilesUnder(storage, project, relativePath)));
      continue;
    }
    const stat = await storage.stat(toAbsolutePath(project, relativePath));
    if (stat?.kind === 'file') {
      files.push({
        path: relativePath,
        sizeBytes: stat.sizeBytes,
        modifiedAtMs: stat.modifiedAtMs,
      });
    }
  }

  return files;
}

export async function handleGetGenerated(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const files: GeneratedFile[] = [];
  for (const root of GENERATED_ROOTS) {
    files.push(...(await listFilesUnder(deps.storage, project, root)));
  }

  const body: GeneratedBody = { slug, roots: [...GENERATED_ROOTS], files };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
