import { useCallback, useEffect, useRef, useState } from 'react';

import type { BrandDetail, BrandManifest } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export const LIVE_SAVE_DEBOUNCE_MS = 400;

export type BrandSaveMode = 'recompose' | 'live' | 'silent';

export type BrandSaveState = 'idle' | 'saving' | 'saved' | 'error';

export type BrandPreviewSignal = {
  recomposeToken: number;
  tokens: Record<string, string> | null;
  tokensToken: number;
};

export type BrandEditor = {
  status: 'loading' | 'ready' | 'error';
  loadError: RenderApiError | null;
  detail: BrandDetail | null;
  manifest: BrandManifest | null;
  readOnly: boolean;
  saveState: BrandSaveState;
  saveError: RenderApiError | null;
  previewSignal: BrandPreviewSignal;
  reload: () => void;
  update: (
    change: (manifest: BrandManifest) => BrandManifest,
    mode?: BrandSaveMode,
  ) => Promise<BrandDetail | null>;
  applyDetail: (detail: BrandDetail, recompose: boolean) => void;
};

function asApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useBrandEditor(id: string): BrandEditor {
  const client = useRenderApi();
  const [status, setStatus] = useState<BrandEditor['status']>('loading');
  const [loadError, setLoadError] = useState<RenderApiError | null>(null);
  const [detail, setDetail] = useState<BrandDetail | null>(null);
  const [manifest, setManifest] = useState<BrandManifest | null>(null);
  const [saveState, setSaveState] = useState<BrandSaveState>('idle');
  const [saveError, setSaveError] = useState<RenderApiError | null>(null);
  const [previewSignal, setPreviewSignal] = useState<BrandPreviewSignal>({
    recomposeToken: 0,
    tokens: null,
    tokensToken: 0,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const manifestRef = useRef<BrandManifest | null>(null);
  const versionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const idRef = useRef(id);
  idRef.current = id;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    setLoadError(null);
    setSaveState('idle');
    client
      .getBrand(id)
      .then((loaded) => {
        if (!current) {
          return;
        }
        manifestRef.current = loaded.manifest;
        versionRef.current = 0;
        setDetail(loaded);
        setManifest(loaded.manifest);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (current) {
          setLoadError(asApiError(cause));
          setStatus('error');
        }
      });
    return () => {
      current = false;
    };
  }, [client, id, reloadToken]);

  const persist = useCallback(
    async (mode: BrandSaveMode): Promise<BrandDetail | null> => {
      const sent = manifestRef.current;
      if (sent === null) {
        return null;
      }
      const version = versionRef.current;
      setSaveState('saving');
      setSaveError(null);
      try {
        const next = await client.putBrand(idRef.current, sent);
        if (!mountedRef.current) {
          return next;
        }
        setDetail(next);
        if (versionRef.current === version) {
          manifestRef.current = next.manifest;
          setManifest(next.manifest);
        }
        setSaveState('saved');
        if (mode === 'live') {
          setPreviewSignal((signal) => ({
            ...signal,
            tokens: next.tokens,
            tokensToken: signal.tokensToken + 1,
          }));
        } else if (mode === 'recompose') {
          setPreviewSignal((signal) => ({
            ...signal,
            tokens: next.tokens,
            recomposeToken: signal.recomposeToken + 1,
          }));
        }
        return next;
      } catch (cause) {
        if (mountedRef.current) {
          setSaveError(asApiError(cause));
          setSaveState('error');
        }
        return null;
      }
    },
    [client],
  );

  const update = useCallback(
    (
      change: (current: BrandManifest) => BrandManifest,
      mode: BrandSaveMode = 'recompose',
    ): Promise<BrandDetail | null> => {
      const current = manifestRef.current;
      if (current === null) {
        return Promise.resolve(null);
      }
      const next = change(current);
      manifestRef.current = next;
      versionRef.current += 1;
      setManifest(next);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (mode === 'live') {
        setSaveState('saving');
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void persist('live');
        }, LIVE_SAVE_DEBOUNCE_MS);
        return Promise.resolve(null);
      }
      return persist(mode);
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void persist('silent');
      }
    },
    [persist],
  );

  const applyDetail = useCallback((next: BrandDetail, recompose: boolean) => {
    manifestRef.current = next.manifest;
    versionRef.current += 1;
    setDetail(next);
    setManifest(next.manifest);
    setSaveState('saved');
    if (recompose) {
      setPreviewSignal((signal) => ({
        ...signal,
        tokens: next.tokens,
        recomposeToken: signal.recomposeToken + 1,
      }));
    }
  }, []);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    status,
    loadError,
    detail,
    manifest,
    readOnly: detail?.source === 'built-in',
    saveState,
    saveError,
    previewSignal,
    reload,
    update,
    applyDetail,
  };
}
