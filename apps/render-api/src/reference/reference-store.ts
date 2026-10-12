import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { ReferenceBriefSchema } from '@video-maker/timeline-core';
import type { ReferenceBrief } from '@video-maker/timeline-core';

import type { ObjectStorage } from '../deps/object-storage';
import { REFERENCE_BRIEF_SUFFIX, REFERENCE_WORK_DIRECTORY, referenceBriefPath } from './reference-paths';

export interface StoredReference {
  readonly name: string;
  readonly briefFile: string;
  readonly brief: ReferenceBrief;
}

export async function writeReferenceBrief(
  storage: ObjectStorage,
  project: MediaProject,
  name: string,
  brief: ReferenceBrief,
): Promise<string> {
  const briefFile = referenceBriefPath(name);
  await storage.ensureDirectory(toAbsolutePath(project, REFERENCE_WORK_DIRECTORY));
  await storage.writeTextFile(toAbsolutePath(project, briefFile), `${JSON.stringify(ReferenceBriefSchema.parse(brief), null, 2)}\n`);
  return briefFile;
}

async function readBriefAt(storage: ObjectStorage, project: MediaProject, briefFile: string): Promise<ReferenceBrief | null> {
  const path = toAbsolutePath(project, briefFile);
  if ((await storage.stat(path))?.kind !== 'file') {
    return null;
  }
  try {
    const parsed = ReferenceBriefSchema.safeParse(JSON.parse(await storage.readTextFile(path)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readReferenceBrief(
  storage: ObjectStorage,
  project: MediaProject,
  name: string,
): Promise<StoredReference | null> {
  const briefFile = referenceBriefPath(name);
  const brief = await readBriefAt(storage, project, briefFile);
  return brief === null ? null : { name, briefFile, brief };
}

export async function listReferenceBriefs(storage: ObjectStorage, project: MediaProject): Promise<StoredReference[]> {
  const entries = (await storage.listDirectory(toAbsolutePath(project, REFERENCE_WORK_DIRECTORY))) ?? [];
  const references: StoredReference[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(REFERENCE_BRIEF_SUFFIX)) {
      continue;
    }
    const name = entry.name.slice(0, -REFERENCE_BRIEF_SUFFIX.length);
    const stored = await readReferenceBrief(storage, project, name);
    if (stored !== null) {
      references.push(stored);
    }
  }
  return references.sort((left, right) => left.name.localeCompare(right.name));
}
