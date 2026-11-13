import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { DANGER_BUTTON_SMALL_CLASS, FIELD_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type DeleteVideoModalProps = {
  slug: string;
  placement: VideoPlacement;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteVideoModal({ slug, placement, onClose, onDeleted }: DeleteVideoModalProps) {
  const client = useRenderApi();
  const t = useT();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);

  const confirmed = confirmation.trim() === slug;

  async function submit(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.deleteVideo(slug);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      surface="glass"
      testId="delete-video-modal"
      title={t('videoMenu.deleteTitle', { slug })}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            data-testid="delete-video-cancel"
            disabled={pending}
            onClick={onClose}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('videoMenu.cancel')}
          </button>
          <button
            type="button"
            data-testid="delete-video-submit"
            disabled={pending || !confirmed}
            onClick={() => {
              void submit();
            }}
            className={DANGER_BUTTON_SMALL_CLASS}
          >
            {pending ? t('videoMenu.deleting') : t('videoMenu.deleteSubmit')}
          </button>
        </>
      }
    >
      <p className="text-[var(--tucu-state-red-ink)]">{t('videoMenu.deleteWarning')}</p>

      <ul className="font-data space-y-1 rounded-[10px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-3 text-xs text-[var(--tucu-state-red-ink)]">
        <li>{t('videoMenu.deleteRaw')}</li>
        <li>{t('videoMenu.deleteWork')}</li>
        <li>{t('videoMenu.deleteOut')}</li>
      </ul>

      {placement.archived && (
        <p data-testid="delete-video-archived-note" className="text-xs text-[var(--cl-ink-2)]">
          {t('videoMenu.deleteArchivedNote')}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-[var(--cl-ink-2)]">{t('videoMenu.deleteConfirmLabel', { slug })}</span>
        <input
          data-testid="delete-video-confirmation"
          aria-label={t('videoMenu.deleteConfirmLabel', { slug })}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={`${FIELD_SMALL_CLASS} font-data h-9 w-full text-sm`}
        />
      </label>

      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </Modal>
  );
}
