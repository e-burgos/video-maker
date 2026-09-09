import { useCallback, useEffect, useRef, useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export type AsyncResourceStatus = 'loading' | 'ready' | 'error';

export type AsyncResource<T> = {
  status: AsyncResourceStatus;
  data: T | null;
  error: RenderApiError | null;
  isRefreshing: boolean;
  reload: () => void;
};

type ResourceState<T> = {
  status: AsyncResourceStatus;
  data: T | null;
  error: RenderApiError | null;
  isRefreshing: boolean;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useAsyncResource<T>(load: () => Promise<T>, key: string): AsyncResource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    status: 'loading',
    data: null,
    error: null,
    isRefreshing: false,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const loadRef = useRef(load);
  const requestSequence = useRef(0);
  const previousKeyRef = useRef(key);

  loadRef.current = load;

  useEffect(() => {
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    const keyChanged = previousKeyRef.current !== key;
    previousKeyRef.current = key;

    setState((current) =>
      keyChanged || current.data === null
        ? { status: 'loading', data: null, error: null, isRefreshing: false }
        : { status: 'ready', data: current.data, error: null, isRefreshing: true },
    );

    loadRef
      .current()
      .then((data) => {
        if (sequence === requestSequence.current) {
          setState({ status: 'ready', data, error: null, isRefreshing: false });
        }
      })
      .catch((cause: unknown) => {
        if (sequence === requestSequence.current) {
          setState((current) =>
            current.data === null
              ? { status: 'error', data: null, error: toRenderApiError(cause), isRefreshing: false }
              : { status: 'ready', data: current.data, error: toRenderApiError(cause), isRefreshing: false },
          );
        }
      });

    return () => {
      requestSequence.current += 1;
    };
  }, [key, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    isRefreshing: state.isRefreshing,
    reload,
  };
}
