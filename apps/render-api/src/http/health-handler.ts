import { basename, isAbsolute, relative } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { EngineModuleStatus } from '../engine/engine-modules';
import type { BinaryStatus } from '../engine/media-binaries';
import type { RenderJobQueueSize } from '../jobs/render-job-queue';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpResponse } from './http-message';
import type { RenderApiRuntime } from './render-api-runtime';

const SERVICE_NAME = 'render-api';
const SERVICE_CYCLE = 3;

export interface HealthStoreInfo {
  readonly schemaVersion: number;
  readonly dbPath: string;
}

export interface HealthBody {
  readonly status: 'ok' | 'degraded';
  readonly service: 'render-api';
  readonly cycle: number;
  readonly time: string;
  readonly engine: readonly EngineModuleStatus[];
  readonly binaries: readonly BinaryStatus[];
  readonly capabilities: {
    readonly renderPipeline: boolean;
    readonly assetStore: boolean;
    readonly jobQueue: boolean;
    readonly montageQueue: boolean;
    readonly storyboardQueue: boolean;
    readonly voiceQueue: boolean;
    readonly producer: boolean;
  };
  readonly jobs: RenderJobQueueSize;
  readonly store: HealthStoreInfo;
}

function relativeDbPath(store: StoreConfig): string {
  const relativePath = relative(store.mediaRoot, store.dbPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return basename(store.dbPath);
  }
  return relativePath;
}

export async function handleHealth(
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const engine = await deps.preloadEngineModules();
  const binaries = await deps.probeMediaBinaries();
  const producer = await deps.probeProducerBinary();

  const status =
    engine.every((module) => module.loaded) && binaries.every((binary) => binary.resolved)
      ? 'ok'
      : 'degraded';

  const body: HealthBody = {
    status,
    service: SERVICE_NAME,
    cycle: SERVICE_CYCLE,
    time: deps.clock.nowIso(),
    engine,
    binaries,
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer,
    },
    jobs: runtime.jobs.size(),
    store: {
      schemaVersion: deps.localStore.schemaVersion,
      dbPath: relativeDbPath(store),
    },
  };

  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE },
    body,
  };
}
