import { tmpdir } from 'node:os';

import { createProjectBrandResolver } from '../brands/project-brand-resolver';
import type { StoreConfig } from '../config/store-config';
import { DEFAULT_HOST, DEFAULT_PORT } from '../config/server-config';
import { readProducerConfig } from '../config/producer-config';
import type { ProducerConfig } from '../config/producer-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { createRenderJobQueue, recoverInterruptedJobs } from '../jobs/render-job-queue';
import type { RenderJobQueue } from '../jobs/render-job-queue';
import { createFreeMediaSearchCache } from '../media-search/free-media-search-cache';
import type { FreeMediaSearchCache } from '../media-search/free-media-search-cache';
import { createMusicSearchCache } from '../music/music-search-cache';
import type { MusicSearchCache } from '../music/music-search-cache';
import { createOpenRouterModelCatalog } from '../producer/openrouter-model-catalog';
import type { OpenRouterModelCatalog } from '../producer/openrouter-model-catalog';
import { createProducerTurnRegistry } from '../producer/producer-turn-registry';
import type { ProducerTurnRegistry } from '../producer/producer-turn-registry';
import { createPublishQueueJobLauncher } from '../youtube/publish-queue-job-launcher';
import { createPublishQueueScheduler, createRealPublishQueueTimer } from '../youtube/publish-queue-scheduler';
import type { PublishQueueScheduler } from '../youtube/publish-queue-scheduler';
import { createYoutubeServices } from '../youtube/youtube-services';
import type { YoutubeServices } from '../youtube/youtube-services';
import { createKeyedSerializer } from '../store/serialize-by-key';
import type { KeyedSerializer } from '../store/serialize-by-key';

export interface RenderApiRuntime {
  readonly jobs: RenderJobQueue;
  readonly producerTurns: ProducerTurnRegistry;
  readonly producer: ProducerConfig;
  readonly uploadSerializer: KeyedSerializer;
  readonly voicePreviewSerializer: KeyedSerializer;
  readonly brandPreviewSerializer: KeyedSerializer;
  readonly musicSearchCache: MusicSearchCache;
  readonly freeMediaSearchCache: FreeMediaSearchCache;
  readonly openRouterModelCatalog: OpenRouterModelCatalog;
  readonly youtube: YoutubeServices;
  readonly publishQueue: PublishQueueScheduler;
}

export function defaultProducerConfig(): ProducerConfig {
  return readProducerConfig({}, '.', `http://${DEFAULT_HOST}:${DEFAULT_PORT}`, tmpdir());
}

export function createRenderApiRuntime(
  deps: RenderApiDependencies,
  producer: ProducerConfig = defaultProducerConfig(),
  store?: StoreConfig,
): RenderApiRuntime {
  recoverInterruptedJobs(deps);
  const youtube = createYoutubeServices(deps);

  const jobs = createRenderJobQueue(
    deps,
    store === undefined ? undefined : createProjectBrandResolver(deps, store),
    youtube.client,
  );
  const publishQueue = createPublishQueueScheduler({
    localStore: deps.localStore,
    clock: deps.clock,
    timer: createRealPublishQueueTimer(),
    jobs,
    launchPublishJob: createPublishQueueJobLauncher(deps, store, jobs, youtube.oauth),
  });

  return {
    jobs,
    youtube,
    publishQueue,
    producerTurns: createProducerTurnRegistry(),
    producer,
    uploadSerializer: createKeyedSerializer(),
    voicePreviewSerializer: createKeyedSerializer(),
    brandPreviewSerializer: createKeyedSerializer(),
    musicSearchCache: createMusicSearchCache(),
    freeMediaSearchCache: createFreeMediaSearchCache(),
    openRouterModelCatalog: createOpenRouterModelCatalog(),
  };
}
