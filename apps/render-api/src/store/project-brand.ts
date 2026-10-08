import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { locateBrand } from '../brands/brand-library';

export async function brandExists(deps: RenderApiDependencies, store: StoreConfig, id: string): Promise<boolean> {
  try {
    await locateBrand(deps, store, id);
    return true;
  } catch (cause) {
    if (cause instanceof PipelineStageError && (cause.code === 'BRAND_UNKNOWN' || cause.code === 'INVALID_INPUT')) {
      return false;
    }
    throw cause;
  }
}

export async function assertBrandExists(deps: RenderApiDependencies, store: StoreConfig, id: string): Promise<void> {
  if (!(await brandExists(deps, store, id))) {
    throw new PipelineStageError({ code: 'BRAND_UNKNOWN', stage: null, resource: id });
  }
}
