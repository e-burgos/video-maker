import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';
import type { ReadTextFile } from '@video-maker/media-local';

import type { MediaProject } from '../project/media-project';
import { timelinePath, toAbsolutePath } from '../project/project-paths';

export interface ReadExistingTimelineDependencies {
  readonly readTextFile: ReadTextFile;
}

export async function readExistingTimeline(
  project: MediaProject,
  deps: ReadExistingTimelineDependencies,
): Promise<Timeline | null> {
  let raw: string;
  try {
    raw = await deps.readTextFile(toAbsolutePath(project, timelinePath()));
  } catch {
    return null;
  }

  try {
    const parsed = TimelineSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
