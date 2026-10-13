import { useEffect } from 'react';

import { useAsyncResource } from './use-async-resource';
import type { AsyncResource } from './use-async-resource';

export function usePolledResource<T>(load: () => Promise<T>, key: string, intervalMs: number): AsyncResource<T> {
  const resource = useAsyncResource<T>(load, key);
  const { reload } = resource;

  useEffect(() => {
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);

  return resource;
}
