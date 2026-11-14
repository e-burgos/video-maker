import { useCallback, useEffect, useRef, useState } from 'react';

import { useRenderApi } from '../../../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../../../api/render-api-error';
import { importFreeResult, searchFreeResults } from './free-media-model';
import type { FreeMediaTab, FreeResult } from './free-media-model';

export type SearchPhase = 'idle' | 'loading' | 'ready' | 'error';

export type ImportPhase = 'importing' | 'imported' | 'failed';

export type FreeMediaSession = {
  phase: SearchPhase;
  results: readonly FreeResult[];
  searchError: RenderApiError | null;
  imports: Readonly<Record<string, ImportPhase>>;
  importError: RenderApiError | null;
  search: (text: string, maxResults: number) => void;
  importResult: (result: FreeResult) => void;
};

function asApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useFreeMediaSession(slug: string, tab: FreeMediaTab, onImported: () => void): FreeMediaSession {
  const client = useRenderApi();
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [results, setResults] = useState<readonly FreeResult[]>([]);
  const [searchError, setSearchError] = useState<RenderApiError | null>(null);
  const [imports, setImports] = useState<Readonly<Record<string, ImportPhase>>>({});
  const [importError, setImportError] = useState<RenderApiError | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    sequence.current += 1;
    setPhase('idle');
    setResults([]);
    setSearchError(null);
    setImports({});
    setImportError(null);
  }, [tab]);

  const search = useCallback(
    (text: string, maxResults: number) => {
      const current = ++sequence.current;
      setPhase('loading');
      setSearchError(null);
      setImportError(null);
      void searchFreeResults(client, slug, tab, text, maxResults).then(
        (found) => {
          if (sequence.current === current) {
            setResults(found);
            setImports({});
            setPhase('ready');
          }
        },
        (cause: unknown) => {
          if (sequence.current === current) {
            setResults([]);
            setSearchError(asApiError(cause));
            setPhase('error');
          }
        },
      );
    },
    [client, slug, tab],
  );

  const importResult = useCallback(
    (result: FreeResult) => {
      setImports((current) => ({ ...current, [result.resultId]: 'importing' }));
      setImportError(null);
      void importFreeResult(client, slug, result).then(
        () => {
          setImports((current) => ({ ...current, [result.resultId]: 'imported' }));
          onImported();
        },
        (cause: unknown) => {
          setImports((current) => ({ ...current, [result.resultId]: 'failed' }));
          setImportError(asApiError(cause));
        },
      );
    },
    [client, slug, onImported],
  );

  return { phase, results, searchError, imports, importError, search, importResult };
}
