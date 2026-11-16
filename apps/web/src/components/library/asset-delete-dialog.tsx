import { useState } from 'react';

import { assetFileName } from '../../api/asset-path';
import { useRenderApi } from '../../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../../api/render-api-error';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { Modal } from '../modal';
import {
  DANGER_BUTTON_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
} from '../ui/cl-controls';
import type { AssetDeletion, AssetRole } from '../../api/render-api-types';

export type DeleteTarget = { role: AssetRole; path: string };

export type AssetDeleteDialogProps = {
  slug: string;
  targets: readonly DeleteTarget[];
  onDeleted: (deletion: AssetDeletion) => void;
  onClose: () => void;
};

type DeleteStep = 'confirm' | 'in-use';

export function AssetDeleteDialog({
  slug,
  targets,
  onDeleted,
  onClose,
}: AssetDeleteDialogProps) {
  const client = useRenderApi();
  const t = useT();
  const [remaining, setRemaining] = useState<readonly DeleteTarget[]>(targets);
  const [step, setStep] = useState<DeleteStep>('confirm');
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);
  const head = remaining[0];

  async function deleteRemaining(forceFirst: boolean): Promise<void> {
    setPending(true);
    setError(null);
    let rest = remaining;
    let force = forceFirst;
    while (rest.length > 0) {
      const target = rest[0] as DeleteTarget;
      try {
        const deletion = await client.deleteAsset({
          slug,
          role: target.role,
          filename: assetFileName(target.path),
          force,
        });
        onDeleted(deletion);
        rest = rest.slice(1);
        force = false;
      } catch (cause) {
        const typed =
          cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
        setRemaining(rest);
        setError(typed);
        setStep(typed.code === 'ASSET_IN_USE' ? 'in-use' : 'confirm');
        setPending(false);
        return;
      }
    }
    setPending(false);
    onClose();
  }

  if (head === undefined) {
    return null;
  }

  const title =
    targets.length === 1
      ? t('assetDelete.question', { filename: assetFileName(head.path) })
      : t('library.delete.many', { count: targets.length });

  return (
    <Modal
      title={title}
      testId="asset-delete-confirm"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            data-testid="asset-delete-cancel"
            disabled={pending}
            onClick={onClose}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('assetDelete.cancel')}
          </button>
          <button
            type="button"
            data-testid={
              step === 'in-use' ? 'asset-delete-force' : 'asset-delete-accept'
            }
            disabled={pending}
            onClick={() => void deleteRemaining(step === 'in-use')}
            className={DANGER_BUTTON_SMALL_CLASS}
          >
            {step === 'in-use'
              ? t('assetDelete.force')
              : t('assetDelete.accept')}
          </button>
        </>
      }
    >
      {step === 'in-use' ? (
        <div data-testid="asset-delete-in-use" className="space-y-1">
          <p className="m-0 font-semibold text-[var(--tucu-state-orange-ink)]">
            {t('assetDelete.inUseTitle')}
          </p>
          <p className="font-data m-0 text-xs text-[var(--cl-ink)]">
            {assetFileName(head.path)}
          </p>
          {error?.payload?.hint !== undefined && (
            <p
              data-testid="asset-delete-in-use-uses"
              className="font-data m-0 text-xs"
            >
              {t('assetDelete.inUseUses', { uses: error.payload.hint })}
            </p>
          )}
          <p className="m-0">{t('assetDelete.inUseWarning')}</p>
        </div>
      ) : (
        <p className="m-0">{t('assetDelete.warning')}</p>
      )}
      {pending && <p className="m-0 text-xs">{t('assetDelete.pending')}</p>}
      {error !== null && step !== 'in-use' && (
        <ErrorNotice error={error} />
      )}
    </Modal>
  );
}
