import type { BrandMusicReaders } from '@video-maker/motion-graphics';

import { locateBrand, readManifest } from '../brands/brand-library';
import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { readLocalMusicTracks } from './local-music';

export function brandMusicReaders(deps: RenderApiDependencies, store: StoreConfig): BrandMusicReaders {
  return {
    readBrandMusicSource: async (brandId) => readManifest(deps, await locateBrand(deps, store, brandId)),
    readLocalTracks: (brandId) => readLocalMusicTracks(deps.storage, store.brandsRoot, brandId),
  };
}

export function brandDirLocator(deps: RenderApiDependencies, store: StoreConfig): (brandId: string) => Promise<string> {
  return async (brandId) => (await locateBrand(deps, store, brandId)).dir;
}
