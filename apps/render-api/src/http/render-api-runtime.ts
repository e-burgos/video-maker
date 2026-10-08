import { tmpdir } from 'node:os';

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
}

export function defaultProducerConfig(): ProducerConfig {
  return readProducerConfig({}, '.', `http://${DEFAULT_HOST}:${DEFAULT_PORT}`, tmpdir());
}

export function createRenderApiRuntime(
  deps: RenderApiDependencies,
  producer: ProducerConfig = defaultProducerConfig(),
): RenderApiRuntime {
  recoverInterruptedJobs(deps);

  return {
    jobs: createRenderJobQueue(deps),
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
