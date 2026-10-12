import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { dirname, join } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';
import { PipelineStageError } from '../errors/pipeline-stage-error';

const ABSOLUTE_PATH_PATTERN = /^([a-zA-Z]:)?[/\\]/u;
export const READABLE_PROJECT_TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.srt'] as const;
export const MAX_READABLE_PROJECT_TEXT_BYTES = 256 * 1024;
const WRITABLE_TEXT_DIRECTORY = 'work/producer/';
const WRITABLE_TEXT_EXACT_FILE = 'work/credits.json';
const PROPOSAL_FILE = 'work/producer/proposal.json';

export interface ResolvedProducerPath {
  readonly relativePath: string;
  readonly absolutePath: string;
}

function isPortableProducerPath(relativePath: string): boolean {
  return (
    relativePath.trim().length > 0 &&
    !relativePath.includes('\\') &&
    !ABSOLUTE_PATH_PATTERN.test(relativePath) &&
    !relativePath.split('/').includes('..')
  );
}

async function nearestExistingRealPath(storage: ObjectStorage, absolutePath: string): Promise<string> {
  let current = absolutePath;
  const tailSegments: string[] = [];

  for (;;) {
    const resolved = await storage.realPath(current);
    if (resolved !== null) {
      return tailSegments.length === 0 ? resolved : join(resolved, ...tailSegments);
    }

    const parent = dirname(current);
    if (parent === current) {
      return absolutePath;
    }
    tailSegments.unshift(current.slice(parent.length + 1));
    current = parent;
  }
}

async function assertWithinProjectRoot(
  storage: ObjectStorage,
  project: MediaProject,
  relativePath: string,
  absolutePath: string,
): Promise<void> {
  const [resolvedTarget, resolvedRoot] = await Promise.all([
    nearestExistingRealPath(storage, absolutePath),
    storage.realPath(project.root),
  ]);
  const root = resolvedRoot ?? project.root;
  const isInsideRoot = resolvedTarget === root || resolvedTarget.startsWith(`${root}/`);

  if (!isInsideRoot) {
    throw new PipelineStageError({ code: 'PATH_OUTSIDE_PROJECT', stage: null, resource: relativePath });
  }
}

export async function resolveProducerPath(
  storage: ObjectStorage,
  project: MediaProject,
  rawPath: string,
): Promise<ResolvedProducerPath> {
  if (!isPortableProducerPath(rawPath)) {
    throw new PipelineStageError({ code: 'PATH_OUTSIDE_PROJECT', stage: null, resource: rawPath });
  }

  const absolutePath = toAbsolutePath(project, rawPath);
  await assertWithinProjectRoot(storage, project, rawPath, absolutePath);

  return { relativePath: rawPath, absolutePath };
}

export function assertReadableProjectText(relativePath: string): void {
  const isUnderWork = relativePath === 'work' || relativePath.startsWith('work/');
  const hasAllowedExtension = READABLE_PROJECT_TEXT_EXTENSIONS.some((extension) =>
    relativePath.endsWith(extension),
  );

  if (!isUnderWork || !hasAllowedExtension) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: relativePath,
      expected: `a .txt, .md, .json or .srt file under work/`,
    });
  }
}

export function assertWritableProjectText(relativePath: string): void {
  if (relativePath === PROPOSAL_FILE) {
    throw new PipelineStageError({
      code: 'PATH_NOT_WRITABLE',
      stage: null,
      resource: relativePath,
      expected: 'the production proposal endpoints; its approval is never written as text',
    });
  }

  const isAllowed =
    relativePath === WRITABLE_TEXT_EXACT_FILE || relativePath.startsWith(WRITABLE_TEXT_DIRECTORY);

  if (!isAllowed) {
    throw new PipelineStageError({
      code: 'PATH_NOT_WRITABLE',
      stage: null,
      resource: relativePath,
      expected: `under ${WRITABLE_TEXT_DIRECTORY} or exactly ${WRITABLE_TEXT_EXACT_FILE}`,
    });
  }
}
