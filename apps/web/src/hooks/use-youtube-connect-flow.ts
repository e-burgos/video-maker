import { useCallback, useEffect, useRef, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export const YOUTUBE_CONNECT_POLL_INTERVAL_MS = 2000;
export const YOUTUBE_CONNECT_MAX_POLLS = 150;

export type YouTubeConnectPhase = 'idle' | 'starting' | 'waiting' | 'timedOut';

export type YouTubeConnectFlow = {
  phase: YouTubeConnectPhase;
  authUrl: string | null;
  error: RenderApiError | null;
  start: () => Promise<void>;
  cancel: () => void;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function useYouTubeConnectFlow(onConnected: () => void): YouTubeConnectFlow {
  const client = useRenderApi();
  const [phase, setPhase] = useState<YouTubeConnectPhase>('idle');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<RenderApiError | null>(null);
  const runRef = useRef(0);
  const onConnectedRef = useRef(onConnected);

  onConnectedRef.current = onConnected;

  useEffect(
    () => () => {
      runRef.current += 1;
    },
    [],
  );

  const waitForConnection = useCallback(
    async (run: number) => {
      for (let attempt = 0; attempt < YOUTUBE_CONNECT_MAX_POLLS; attempt += 1) {
        await pause(YOUTUBE_CONNECT_POLL_INTERVAL_MS);
        if (run !== runRef.current) {
          return;
        }
        try {
          const integration = await client.getYouTubeIntegration();
          if (run !== runRef.current) {
            return;
          }
          if (integration.connected) {
            setPhase('idle');
            setAuthUrl(null);
            onConnectedRef.current();
            return;
          }
        } catch {
          continue;
        }
      }
      if (run === runRef.current) {
        setPhase('timedOut');
      }
    },
    [client],
  );

  const start = useCallback(async () => {
    runRef.current += 1;
    const run = runRef.current;
    setError(null);
    setPhase('starting');
    try {
      const started = await client.connectYouTube();
      if (run !== runRef.current) {
        return;
      }
      setAuthUrl(started.authUrl);
      setPhase('waiting');
      window.open(started.authUrl, '_blank', 'noopener');
      await waitForConnection(run);
    } catch (cause) {
      if (run === runRef.current) {
        setError(toRenderApiError(cause));
        setPhase('idle');
      }
    }
  }, [client, waitForConnection]);

  const cancel = useCallback(() => {
    runRef.current += 1;
    setPhase('idle');
    setAuthUrl(null);
  }, []);

  return { phase, authUrl, error, start, cancel };
}
