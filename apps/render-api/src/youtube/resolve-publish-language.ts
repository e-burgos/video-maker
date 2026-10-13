import { createProjectBrandResolver } from '../brands/project-brand-resolver';
import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { publishLanguageFromVoice } from './publish-preconditions';
import { YOUTUBE_DEFAULT_LANGUAGE } from './youtube-constants';

export async function resolvePublishLanguage(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
  requested: string | null,
): Promise<string> {
  if (requested !== null) {
    return requested;
  }
  try {
    const brand = await createProjectBrandResolver(deps, store)(slug);
    return publishLanguageFromVoice(brand?.voice.id ?? null);
  } catch {
    return YOUTUBE_DEFAULT_LANGUAGE;
  }
}
