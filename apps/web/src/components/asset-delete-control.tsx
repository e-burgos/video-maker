import { useState } from 'react';

import { assetFileName } from '../api/asset-path';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import type { AssetDeletion, AssetRole } from '../api/render-api-types';

export type AssetDeleteControlProps = {
  slug: string;
  role: AssetRole;
  path: string;
  onDeleted: (deletion: AssetDeletion) => void;
};

type DeleteStep = 'closed' | 'confirm' | 'in-use';

export function AssetDeleteControl({ slug, role, path, onDeleted }: AssetDeleteControlProps) {
  const client = useRenderApi();
  const t = useT();
  const [step, setStep] = useState<DeleteStep>('closed');
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);
  const filename = assetFileName(path);

  async function requestDelete(force: boolean): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const deletion = await client.deleteAsset({ slug, role, filename, force });
      setStep('closed');
      onDeleted(deletion);
    } catch (cause) {
      const typed = cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
      setError(typed);
      setStep(typed.code === 'ASSET_IN_USE' ? 'in-use' : 'confirm');
    } finally {
      setPending(false);
    }
  }

  if (step === 'closed') {
    return (
      <button
        type="button"
        data-testid="asset-delete-open"
        aria-label={t('assetDelete.openAria', { filename })}
        onClick={() => {
          setError(null);
          setStep('confirm');
        }}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-500/60 hover:text-rose-200"
      >
        {t('assetDelete.action')}
      </button>
    );
  }

  return (
    <div
      data-testid="asset-delete-confirm"
      role="group"
      aria-label={t('assetDelete.openAria', { filename })}
      className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2"
    >
      <p className="text-xs text-rose-100">{t('assetDelete.question', { filename })}</p>

      {step === 'in-use' ? (
        <div data-testid="asset-delete-in-use" className="space-y-1">
          <p className="text-xs font-semibold text-amber-200">{t('assetDelete.inUseTitle')}</p>
          {error?.payload?.hint !== undefined && (
            <p data-testid="asset-delete-in-use-uses" className="font-mono text-[11px] text-amber-100/80">
              {t('assetDelete.inUseUses', { uses: error.payload.hint })}
            </p>
          )}
          <p className="text-xs text-amber-100/80">{t('assetDelete.inUseWarning')}</p>
        </div>
      ) : (
        <p className="text-xs text-rose-200/80">{t('assetDelete.warning')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={step === 'in-use' ? 'asset-delete-force' : 'asset-delete-accept'}
          disabled={pending}
          onClick={() => {
            void requestDelete(step === 'in-use');
          }}
          className="rounded-md border border-rose-400/60 px-2 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
        >
          {step === 'in-use' ? t('assetDelete.force') : t('assetDelete.accept')}
        </button>
        <button
          type="button"
          data-testid="asset-delete-cancel"
          disabled={pending}
          onClick={() => {
            setError(null);
            setStep('closed');
          }}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
        >
          {t('assetDelete.cancel')}
        </button>
        {pending && <span className="text-xs text-slate-400">{t('assetDelete.pending')}</span>}
      </div>

      {error !== null && step !== 'in-use' && <ErrorNotice error={error} />}
    </div>
  );
}
