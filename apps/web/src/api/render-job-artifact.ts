import { artifactUrl } from './artifact-url';

export const SAMPLE_VIDEO_SUFFIX = '.sample.mp4';

export function isSampleVideoPath(path: string): boolean {
  return path.endsWith(SAMPLE_VIDEO_SUFFIX);
}

export function renderJobDeliverableUrl(slug: string, jobId: string): string {
  return artifactUrl(slug, `out/${jobId}.mp4`);
}

export function renderJobSampleUrl(slug: string, jobId: string): string {
  return artifactUrl(slug, `out/${jobId}${SAMPLE_VIDEO_SUFFIX}`);
}
