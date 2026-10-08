import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { loadProjectBrandContext } from './project-brand-context';
import type { ProjectBrandContext } from './project-brand-context';

export type ProjectBrandResolver = (slug: string) => Promise<ProjectBrandContext | null>;

const UNRESOLVABLE_BRAND_CODES: readonly string[] = ['BRAND_UNKNOWN', 'INVALID_INPUT', 'BRAND_MANIFEST_INVALID'];

export function createProjectBrandResolver(deps: RenderApiDependencies, store: StoreConfig): ProjectBrandResolver {
  return async (slug) => {
    const brandId = deps.localStore.projects.get(slug)?.brand ?? null;
    if (brandId === null) {
      return null;
    }
    try {
      return await loadProjectBrandContext(deps, store, brandId);
    } catch (cause) {
      if (cause instanceof PipelineStageError && UNRESOLVABLE_BRAND_CODES.includes(cause.code)) {
        return null;
      }
      throw cause;
    }
  };
}
