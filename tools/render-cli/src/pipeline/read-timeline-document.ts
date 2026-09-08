import type { MediaProject } from '@video-maker/auto-montage';
import type { ReadTextFile } from '@video-maker/media-local';
import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import { StageFailedError } from '../errors/stage-failed-error';

export interface ReadTimelineDocumentDependencies {
  readonly readTextFile: ReadTextFile;
}

function parseJsonOrNull(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readTimelineDocument(
  project: MediaProject,
  deps: ReadTimelineDocumentDependencies,
): Promise<Timeline> {
  const timelinePath = join(project.workDir, 'timeline.json');
  const raw = await deps.readTextFile(timelinePath);

  const parsedJson = parseJsonOrNull(raw);
  const validation = TimelineSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new StageFailedError({
      stage: 'render',
      resource: 'work/timeline.json',
      reason: 'TIMELINE_UNREADABLE',
      cause: validation.error,
    });
  }

  return validation.data;
}
