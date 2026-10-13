import type { PublishQueueRecord } from '@video-maker/local-store';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { parsePublishJobInput } from '../jobs/publish-job-params';
import type { RenderJobQueue } from '../jobs/render-job-queue';
import type { Job } from '../jobs/render-job';
import { sampleFileClassifierFor } from '../jobs/sample-files';
import { resolveExistingProject } from '../store/project-scope';
import {
  assertPublishableThumbnail,
  assertPublishableVideo,
  assertRenderReviewAllowsPublish,
  assertYoutubeReady,
} from './publish-preconditions';
import { resolvePublishLanguage } from './resolve-publish-language';
import type { YoutubeOAuth } from './youtube-oauth';

export function publishQueueItemToJobBody(item: PublishQueueRecord, playlistIds: readonly string[]): Record<string, unknown> {
  return { ...item.metadata, platform: 'youtube', file: item.file, playlistIds };
}

export function createPublishQueueJobLauncher(
  deps: RenderApiDependencies,
  store: StoreConfig | undefined,
  jobs: RenderJobQueue,
  oauth: YoutubeOAuth,
): (item: PublishQueueRecord, playlistIds: readonly string[]) => Promise<Job> {
  return async (item, playlistIds) => {
    if (store === undefined) {
      throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null, resource: 'store' });
    }
    const input = parsePublishJobInput(
      publishQueueItemToJobBody(item, playlistIds),
      Date.parse(deps.clock.nowIso()),
    );
    const project = await resolveExistingProject(deps, store, item.slug);
    await assertPublishableVideo(deps.storage, project, input.file, sampleFileClassifierFor(jobs, item.slug));
    await assertRenderReviewAllowsPublish(deps.storage, project, input.file, input.ignoreReview);
    if (input.thumbnail !== null) {
      await assertPublishableThumbnail(deps.storage, project, input.thumbnail);
    }
    await assertYoutubeReady(oauth);

    const { defaultLanguage, ...rest } = input;
    return jobs.create({
      kind: 'publish',
      slug: item.slug,
      projectRoot: project.root,
      ...rest,
      defaultLanguage: await resolvePublishLanguage(deps, store, item.slug, defaultLanguage),
    });
  };
}
