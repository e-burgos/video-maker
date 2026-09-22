import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';

export type ArchiveVideoModalProps = {
  slug: string;
  placement: VideoPlacement;
  onClose: () => void;
  onArchived: () => void;
};

export function ArchiveVideoModal({ slug, placement, onClose, onArchived }: ArchiveVideoModalProps) {
  const client = useRenderApi();
  const t = useT();
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);
  const restoring = placement.archived;

  async function submit(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.putVideoPlacement(slug, { ...placement, archived: !restoring });
      onArchived();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      testId="archive-video-modal"
      title={restoring ? t('videoMenu.restoreTitle', { slug }) : t('videoMenu.archiveTitle', { slug })}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            data-testid="archive-video-cancel"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
          >
            {t('videoMenu.cancel')}
          </button>
          <button
            type="button"
            data-testid="archive-video-submit"
            disabled={pending}
            onClick={() => {
              void submit();
            }}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
          >
            {pending
              ? t('videoMenu.saving')
              : restoring
                ? t('videoMenu.restoreSubmit')
                : t('videoMenu.archiveSubmit')}
          </button>
        </>
      }
    >
      <p>{restoring ? t('videoMenu.restoreExplanation') : t('videoMenu.archiveExplanation')}</p>
      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
