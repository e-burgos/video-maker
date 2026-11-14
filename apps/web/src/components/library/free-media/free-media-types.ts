import type { RenderApiClient } from '../../../api/render-api-client';

export type {
  AssetRole,
  FreeMediaResult,
  FreeMusicResult,
} from '../../../api/render-api-types';

export type RenderApiClientFacade = Pick<
  RenderApiClient,
  'searchFreeMedia' | 'importFreeMedia' | 'searchFreeMusic' | 'importFreeMusic'
>;
