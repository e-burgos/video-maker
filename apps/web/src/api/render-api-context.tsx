import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { createRenderApiClient } from './render-api-client';
import type { RenderApiClient } from './render-api-client';

const RenderApiContext = createContext<RenderApiClient | null>(null);

export type RenderApiProviderProps = {
  client?: RenderApiClient;
  children: ReactNode;
};

export function RenderApiProvider({ client, children }: RenderApiProviderProps) {
  const value = useMemo(
    () => client ?? createRenderApiClient((url, init) => globalThis.fetch(url, init)),
    [client],
  );

  return <RenderApiContext.Provider value={value}>{children}</RenderApiContext.Provider>;
}

export function useRenderApi(): RenderApiClient {
  const client = useContext(RenderApiContext);

  if (client === null) {
    throw new Error('useRenderApi must be used inside a RenderApiProvider');
  }

  return client;
}
