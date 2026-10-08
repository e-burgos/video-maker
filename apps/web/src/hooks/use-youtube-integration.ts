import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import type { YouTubeIntegration } from '../api/youtube-types';
import { useAsyncResource } from './use-async-resource';
import type { AsyncResource } from './use-async-resource';

export function useYouTubeIntegration(): AsyncResource<YouTubeIntegration> {
  const client = useRenderApi();
  const load = useCallback(async () => client.getYouTubeIntegration(), [client]);
  return useAsyncResource<YouTubeIntegration>(load, 'youtube-integration');
}
