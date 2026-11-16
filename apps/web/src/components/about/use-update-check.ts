import { useCallback, useRef, useState } from 'react';

import { useRenderApi } from '../../api/render-api-context';
import type { AppUpdate } from '../../api/render-api-types';

export type UpdateCheckPhase = 'idle' | 'checking' | 'done';

export type UpdateCheck = {
  phase: UpdateCheckPhase;
  result: AppUpdate | null;
  check: () => Promise<void>;
};

export function useUpdateCheck(): UpdateCheck {
  const client = useRenderApi();
  const [phase, setPhase] = useState<UpdateCheckPhase>('idle');
  const [result, setResult] = useState<AppUpdate | null>(null);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPhase('checking');
    try {
      setResult(await client.getAppUpdate());
    } catch {
      setResult({ status: 'unknown', installedVersion: '' });
    } finally {
      inFlight.current = false;
      setPhase('done');
    }
  }, [client]);

  return { phase, result, check };
}
