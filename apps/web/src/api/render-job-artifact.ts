import { artifactUrl } from './artifact-url';

export function renderJobDeliverableUrl(slug: string, jobId: string): string {
  return artifactUrl(slug, `out/${jobId}.mp4`);
}
