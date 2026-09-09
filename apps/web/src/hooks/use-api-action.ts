import { useCallback, useEffect, useRef, useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export type ApiActionStatus = 'idle' | 'pending' | 'ok' | 'error';

export type ApiAction<Args extends unknown[], T> = {
  status: ApiActionStatus;
  error: RenderApiError | null;
  run: (...args: Args) => Promise<T | null>;
  reset: () => void;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useApiAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
): ApiAction<Args, T> {
  const [status, setStatus] = useState<ApiActionStatus>('idle');
  const [error, setError] = useState<RenderApiError | null>(null);
  const actionRef = useRef(action);
  const requestSequence = useRef(0);
  const mountedRef = useRef(true);

  actionRef.current = action;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: Args): Promise<T | null> => {
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    setStatus('pending');
    setError(null);

    try {
      const result = await actionRef.current(...args);
      if (mountedRef.current && sequence === requestSequence.current) {
        setStatus('ok');
        setError(null);
      }
      return result;
    } catch (cause) {
      const typed = toRenderApiError(cause);
      if (mountedRef.current && sequence === requestSequence.current) {
        setStatus('error');
        setError(typed);
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    requestSequence.current += 1;
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, run, reset };
}
