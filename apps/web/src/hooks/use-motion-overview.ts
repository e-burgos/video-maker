import { useCallback } from 'react';

import type { MotionOverview } from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from './use-async-resource';
import type { AsyncResource } from './use-async-resource';

export function useMotionOverview(slug: string): AsyncResource<MotionOverview> {
  const client = useRenderApi();
  return useAsyncResource(
    useCallback(() => client.getMotionOverview(slug), [client, slug]),
    `motion-overview:${slug}`,
  );
}
