import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoFolder, VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { FIELD_LABEL_CLASS, FIELD_SMALL_CLASS, PRIMARY_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type AssignVideoModalProps = {
  slug: string;
  placement: VideoPlacement;
  folders: readonly VideoFolder[];
  onClose: () => void;
  onAssigned: () => void;
};

const NO_FOLDER = '';

export function AssignVideoModal({
  slug,
  placement,
  folders,
  onClose,
  onAssigned,
}: AssignVideoModalProps) {
  const client = useRenderApi();
  const t = useT();
  const [folderId, setFolderId] = useState(placement.folderId ?? NO_FOLDER);
  const [categoryId, setCategoryId] = useState(placement.categoryId ?? NO_FOLDER);
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);

  const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null;

  async function submit(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.putVideoPlacement(slug, {
        folderId: folderId === NO_FOLDER ? null : folderId,
        categoryId: folderId === NO_FOLDER || categoryId === NO_FOLDER ? null : categoryId,
        archived: placement.archived,
      });
      onAssigned();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      surface="glass"
      testId="assign-video-modal"
      title={t('videoMenu.assignTitle', { slug })}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            data-testid="assign-video-cancel"
            disabled={pending}
            onClick={onClose}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('videoMenu.cancel')}
          </button>
          <button
            type="button"
            data-testid="assign-video-submit"
            disabled={pending}
            onClick={() => {
              void submit();
            }}
            className={PRIMARY_BUTTON_SMALL_CLASS}
          >
            {pending ? t('videoMenu.saving') : t('videoMenu.assignSubmit')}
          </button>
        </>
      }
    >
      <label className="block space-y-1">
        <span className={FIELD_LABEL_CLASS}>{t('videoMenu.folderLabel')}</span>
        <select
          data-testid="assign-video-folder"
          aria-label={t('videoMenu.folderLabel')}
          value={folderId}
          onChange={(event) => {
            setFolderId(event.target.value);
            setCategoryId(NO_FOLDER);
          }}
          className={`${FIELD_SMALL_CLASS} h-9 w-full text-sm`}
        >
          <option value={NO_FOLDER}>{t('projects.unassigned')}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className={FIELD_LABEL_CLASS}>{t('videoMenu.categoryLabel')}</span>
        <select
          data-testid="assign-video-category"
          aria-label={t('videoMenu.categoryLabel')}
          value={categoryId}
          disabled={selectedFolder === null || selectedFolder.categories.length === 0}
          onChange={(event) => setCategoryId(event.target.value)}
          className={`${FIELD_SMALL_CLASS} h-9 w-full text-sm disabled:opacity-50`}
        >
          <option value={NO_FOLDER}>{t('videoMenu.noCategory')}</option>
          {(selectedFolder?.categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {selectedFolder !== null && selectedFolder.categories.length === 0 && (
        <p data-testid="assign-video-no-categories" className="text-xs text-[var(--cl-ink-3)]">
          {t('videoMenu.noCategoriesHint')}
        </p>
      )}

      {folders.length === 0 && (
        <p data-testid="assign-video-no-folders" className="text-xs text-[var(--tucu-state-orange-ink)]">
          {t('videoMenu.noFoldersHint')}
        </p>
      )}

      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </Modal>
  );
}
