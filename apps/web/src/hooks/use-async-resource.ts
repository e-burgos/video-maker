import { useCallback, useEffect, useRef, useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export type AsyncResourceStatus = 'loading' | 'ready' | 'error';

export type AsyncResource<T> = {
  status: AsyncResourceStatus;
  data: T | null;
  error: RenderApiError | null;
  reload: () => void;
};

type ResourceState<T> = {
  status: AsyncResourceStatus;
  data: T | null;
  error: RenderApiError | null;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useAsyncResource<T>(load: () => Promise<T>, key: string): AsyncResource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const loadRef = useRef(load);
  const requestSequence = useRef(0);

  loadRef.current = load;

  useEffect(() => {
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    setState({ status: 'loading', data: null, error: null });

    loadRef
      .current()
      .then((data) => {
        if (sequence === requestSequence.current) {
          setState({ status: 'ready', data, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setState({ status: 'error', data: null, error: toRenderApiError(cause) });
        }
      });

    return () => {
      requestSequence.current += 1;
    };
  }, [key, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { status: state.status, data: state.data, error: state.error, reload };
}
