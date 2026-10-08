import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { ObjectStorage } from '../deps/object-storage';
import { PUBLISH_DESCRIPTION_MAX_LENGTH } from '../jobs/publish-job-params';

const CREDITS_SUFFIX = '.credits.txt';
const PARAGRAPH_SEPARATOR = '\n\n';

export function creditsPathFor(videoFile: string): string {
  return `${videoFile.slice(0, -'.mp4'.length)}${CREDITS_SUFFIX}`;
}

export async function readCreditsText(
  storage: ObjectStorage,
  project: MediaProject,
  videoFile: string,
): Promise<string | null> {
  const absolutePath = toAbsolutePath(project, creditsPathFor(videoFile));
  const stat = await storage.stat(absolutePath);
  if (stat === null || stat.kind !== 'file') {
    return null;
  }
  const text = (await storage.readTextFile(absolutePath)).trim();
  return text === '' ? null : text;
}

export function appendCreditsOnce(description: string, credits: string | null): string {
  if (credits === null || description.includes(credits)) {
    return description;
  }
  const body = description
    .trimEnd()
    .slice(0, Math.max(0, PUBLISH_DESCRIPTION_MAX_LENGTH - credits.length - PARAGRAPH_SEPARATOR.length));
  return body === '' ? credits : `${body}${PARAGRAPH_SEPARATOR}${credits}`;
}
