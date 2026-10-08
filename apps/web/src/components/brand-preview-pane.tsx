import { useCallback, useEffect, useRef, useState } from 'react';

import { brandPreviewUrl } from '../api/brand-files';
import type { BrandPreview } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { BrandPreviewSignal } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

export const BRAND_TOKENS_MESSAGE = 'mg-brand-tokens';
export const LIVE_RECOMPOSE_DELAY_MS = 1500;

export type BrandPreviewPaneProps = {
  brandId: string;
  signal: BrandPreviewSignal;
};

export function BrandPreviewPane({ brandId, signal }: BrandPreviewPaneProps) {
  const client = useRenderApi();
  const t = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const latestTokens = useRef<Record<string, string> | null>(null);
  const [preview, setPreview] = useState<BrandPreview | null>(null);
  const [composing, setComposing] = useState(true);
  const [error, setError] = useState<RenderApiError | null>(null);

  const postTokens = useCallback((tokens: Record<string, string> | null) => {
    if (tokens === null) {
      return;
    }
    frame.current?.contentWindow?.postMessage(
      { type: BRAND_TOKENS_MESSAGE, tokens },
      window.location.origin,
    );
  }, []);

  const compose = useCallback(async (): Promise<void> => {
    setComposing(true);
    setError(null);
    try {
      setPreview(await client.composeBrandPreview(brandId));
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setComposing(false);
    }
  }, [client, brandId]);

  useEffect(() => {
    void compose();
  }, [compose]);

  useEffect(() => {
    if (signal.recomposeToken > 0) {
      void compose();
    }
  }, [signal.recomposeToken, compose]);

  useEffect(() => {
    latestTokens.current = signal.tokens;
    if (signal.tokensToken === 0) {
      return;
    }
    postTokens(signal.tokens);
    const timer = setTimeout(() => {
      void compose();
    }, LIVE_RECOMPOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [signal.tokensToken, signal.tokens, postTokens, compose]);

  return (
    <div data-testid="brand-preview-pane" className="space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border-strong bg-slate-950">
        {preview !== null && (
          <iframe
            ref={frame}
            title={t('brands.preview.frameTitle')}
            data-testid="brand-preview-frame"
            src={`${brandPreviewUrl(preview.url)}?t=${encodeURIComponent(preview.composedAt)}`}
            onLoad={() => postTokens(latestTokens.current)}
            className="h-full w-full border-0"
          />
        )}
        {preview === null && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            {composing ? t('brands.preview.composing') : t('brands.preview.unavailable')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button data-testid="brand-preview-refresh" disabled={composing} onClick={() => void compose()}>
          {composing && preview !== null ? t('brands.preview.composing') : t('brands.preview.refresh')}
        </Button>
        <span className="text-xs text-ink-faint">{t('brands.preview.hint')}</span>
      </div>
      {error !== null && <ErrorNotice error={error} onRetry={() => void compose()} />}
    </div>
  );
}
