import { basename, extname, isAbsolute, join, normalize, relative } from 'node:path/posix';

import { PathEscapesProjectError } from '../errors/path-escapes-project-error';
import type { MediaProject } from './media-project';

export type ProjectRelativePath = string;

const RAW_DIRECTORY_NAME = 'raw';
const WORK_DIRECTORY_NAME = 'work';

export function normalizeProjectRoot(rootPath: string): string {
  const normalized = normalize(rootPath);
  return normalized === '/' ? normalized : normalized.replace(/\/+$/u, '');
}

export function deriveProjectSlug(root: string): string {
  return basename(root);
}

export function buildProjectSubdirectories(
  root: string,
): { rawDir: string; workDir: string; outDir: string } {
  return {
    rawDir: join(root, RAW_DIRECTORY_NAME),
    workDir: join(root, WORK_DIRECTORY_NAME),
    outDir: join(root, 'out'),
  };
}

export function toProjectRelativePath(
  project: MediaProject,
  absolutePath: string,
): ProjectRelativePath {
  const relativeToRoot = relative(project.root, normalize(absolutePath));
  if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
    throw new PathEscapesProjectError({
      projectRoot: project.root,
      attemptedPath: absolutePath,
    });
  }
  return relativeToRoot;
}

export function toAbsolutePath(project: MediaProject, relativePath: ProjectRelativePath): string {
  return join(project.root, relativePath);
}

export function isInsideRaw(relativePath: ProjectRelativePath): boolean {
  return relativePath.split('/')[0] === RAW_DIRECTORY_NAME;
}

export function rawAssetMirror(relativePath: ProjectRelativePath): string {
  const withoutRawPrefix = relativePath.replace(/^raw\//u, '');
  const extension = extname(withoutRawPrefix);
  return extension.length === 0 ? withoutRawPrefix : withoutRawPrefix.slice(0, -extension.length);
}

export function workPath(...segments: readonly string[]): ProjectRelativePath {
  return join(WORK_DIRECTORY_NAME, ...segments);
}

export function catalogPath(): ProjectRelativePath {
  return workPath('catalog.json');
}

export function transcriptPath(mirror: string): ProjectRelativePath {
  return workPath('transcripts', `${mirror}.json`);
}

export function extractedAudioPath(mirror: string): ProjectRelativePath {
  return workPath('audio', `${mirror}.wav`);
}

export function whisperOutBase(mirror: string): ProjectRelativePath {
  return workPath('whisper', mirror);
}

export function editDecisionListPath(): ProjectRelativePath {
  return workPath('edl.json');
}

export function timelinePath(): ProjectRelativePath {
  return workPath('timeline.json');
}
