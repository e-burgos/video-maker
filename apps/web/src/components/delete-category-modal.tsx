import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoCategory } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { DANGER_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type DeleteCategoryModalProps = {
  folderId: string;
  folderName: string;
  category: VideoCategory;
  videoCount: number;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteCategoryModal({ folderId, folderName, category, videoCount, onClose, onDeleted }: DeleteCategoryModalProps) {
  const client = useRenderApi();
  const t = useT();
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.deleteCategory(folderId, category.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      testId="delete-category-modal"
      title={t('folder.deleteCategoryTitle', { name: category.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" data-testid="delete-category-cancel" disabled={pending} onClick={onClose} className={SECONDARY_BUTTON_SMALL_CLASS}>
            {t('folder.deleteCancel')}
          </button>
          <button
            type="button"
            data-testid="delete-category-submit"
            disabled={pending}
            onClick={() => {
              void submit();
            }}
            className={DANGER_BUTTON_SMALL_CLASS}
          >
            {t('folder.deleteCategorySubmit')}
          </button>
        </>
      }
    >
      <p className="text-sm">
        {videoCount === 0
          ? t('folder.deleteCategoryEmpty')
          : t(videoCount === 1 ? 'folder.deleteCategoryVideos.one' : 'folder.deleteCategoryVideos.other', {
              count: videoCount,
              folder: folderName,
            })}
      </p>
      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
