import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { ObjectStorage } from '../deps/object-storage';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { PUBLISH_THUMBNAIL_MAX_BYTES } from '../jobs/publish-job-params';
import { readReview } from '../review/review-store';
import { resolveProducerPath } from '../store/producer-writable-paths';
import type { YoutubeOAuth } from './youtube-oauth';
import { YOUTUBE_DEFAULT_LANGUAGE } from './youtube-constants';

function invalidFile(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'PUBLISH_FILE_INVALID', stage: null, resource, expected });
}

export async function assertPublishableVideo(
  storage: ObjectStorage,
  project: MediaProject,
  file: string,
): Promise<void> {
  const resolved = await resolveProducerPath(storage, project, file);
  const stat = await storage.stat(resolved.absolutePath);
  if (stat === null || stat.kind !== 'file' || stat.sizeBytes === 0) {
    throw invalidFile(file, 'an existing, non-empty .mp4 under out/');
  }
}

export async function assertPublishableThumbnail(
  storage: ObjectStorage,
  project: MediaProject,
  thumbnail: string,
): Promise<void> {
  const resolved = await resolveProducerPath(storage, project, thumbnail);
  const stat = await storage.stat(toAbsolutePath(project, resolved.relativePath));
  if (stat === null || stat.kind !== 'file' || stat.sizeBytes > PUBLISH_THUMBNAIL_MAX_BYTES) {
    throw invalidFile(thumbnail, `an existing image of at most ${String(PUBLISH_THUMBNAIL_MAX_BYTES)} bytes`);
  }
}

export async function assertYoutubeReady(oauth: YoutubeOAuth): Promise<void> {
  const status = await oauth.status();
  if (!status.clientConfigured) {
    throw new PipelineStageError({
      code: 'YOUTUBE_CLIENT_MISSING',
      stage: null,
      resource: 'youtube',
      hint: 'store the Google OAuth client id and secret in Settings first',
    });
  }
  if (!status.connected) {
    throw new PipelineStageError({
      code: 'YOUTUBE_NOT_CONNECTED',
      stage: null,
      resource: 'youtube',
      hint: 'connect a YouTube channel from Settings',
    });
  }
}

export function publishLanguageFromVoice(voiceId: string | null): string {
  const language = voiceId?.split(/[_-]/u)[0] ?? '';
  return /^[a-z]{2,3}$/u.test(language) ? language : YOUTUBE_DEFAULT_LANGUAGE;
}

export async function assertRenderReviewAllowsPublish(
  storage: ObjectStorage,
  project: MediaProject,
  file: string,
  ignoreReview: boolean,
): Promise<void> {
  if (ignoreReview) {
    return;
  }
  const review = await readReview(storage, project, file);
  if (review === null || review.report.status !== 'fail') {
    return;
  }
  const criticals = review.report.findings.filter((finding) => finding.severity === 'critical');
  throw new PipelineStageError({
    code: 'RENDER_REVIEW_FAILED',
    stage: null,
    resource: file,
    hint: `${String(criticals.length)} critical finding(s): ${criticals.map((finding) => finding.message).join(' | ')}`,
  });
}
