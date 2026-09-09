import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { createRenderJobQueue } from '../jobs/render-job-queue';
import type { RenderJobQueue } from '../jobs/render-job-queue';
import { createKeyedSerializer } from '../store/serialize-by-key';
import type { KeyedSerializer } from '../store/serialize-by-key';

export interface RenderApiRuntime {
  readonly jobs: RenderJobQueue;
  readonly uploadSerializer: KeyedSerializer;
}

export function createRenderApiRuntime(deps: RenderApiDependencies): RenderApiRuntime {
  return {
    jobs: createRenderJobQueue(deps),
    uploadSerializer: createKeyedSerializer(),
  };
}
