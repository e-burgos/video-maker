import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';

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
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
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
            className="rounded-md border border-rose-400/60 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/30 disabled:opacity-40"
          >
            {pending ? t('videoMenu.deleting') : t('videoMenu.deleteSubmit')}
          </button>
        </>
      }
    >
      <p className="text-rose-200">{t('videoMenu.deleteWarning')}</p>

      <ul className="space-y-1 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 font-mono text-xs text-rose-100/90">
        <li>{t('videoMenu.deleteRaw')}</li>
        <li>{t('videoMenu.deleteWork')}</li>
        <li>{t('videoMenu.deleteOut')}</li>
      </ul>

      {placement.archived && (
        <p data-testid="delete-video-archived-note" className="text-xs text-slate-400">
          {t('videoMenu.deleteArchivedNote')}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">{t('videoMenu.deleteConfirmLabel', { slug })}</span>
        <input
          data-testid="delete-video-confirmation"
          aria-label={t('videoMenu.deleteConfirmLabel', { slug })}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
        />
      </label>

      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
