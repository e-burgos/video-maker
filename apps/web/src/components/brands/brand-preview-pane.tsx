import { useCallback, useEffect, useRef, useState } from 'react';

import { brandPreviewUrl } from '../../api/brand-files';
import type { BrandPreview } from '../../api/brand-types';
import { useRenderApi } from '../../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../../api/render-api-error';
import type { BrandPreviewSignal } from '../../hooks/use-brand-editor';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { OPAQUE_MEDIA_FRAME_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_SMALL_HINT_CLASS } from './brand-controls';

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
    <section data-testid="brand-preview-pane" className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={PANEL_HEADING_CLASS}>{t('brands.preview.title')}</h2>
        <button
          type="button"
          data-testid="brand-preview-refresh"
          disabled={composing}
          onClick={() => void compose()}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {composing && preview !== null ? t('brands.preview.composing') : t('brands.preview.refresh')}
        </button>
      </div>
      <div className={`${OPAQUE_MEDIA_FRAME_CLASS} aspect-video w-full border border-[var(--tucu-glass-sub-line)]`}>
        {preview !== null && (
          <iframe
            ref={frame}
            title={t('brands.preview.frameTitle')}
            data-testid="brand-preview-frame"
            src={`${brandPreviewUrl(preview.url)}?t=${encodeURIComponent(preview.composedAt)}`}
            onLoad={() => postTokens(latestTokens.current)}
            className="h-full w-full border-0 bg-[#0b0d14]"
          />
        )}
        {preview === null && (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-white/70">
            {composing ? t('brands.preview.composing') : t('brands.preview.unavailable')}
          </div>
        )}
      </div>
      <p className={BRAND_SMALL_HINT_CLASS}>{t('brands.preview.hint')}</p>
      {error !== null && <ErrorNotice error={error} onRetry={() => void compose()} surface="glass" />}
    </section>
  );
}
