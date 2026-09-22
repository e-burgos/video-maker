import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoFolder, VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';

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
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
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
            className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? t('videoMenu.saving') : t('videoMenu.assignSubmit')}
          </button>
        </>
      }
    >
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">{t('videoMenu.folderLabel')}</span>
        <select
          data-testid="assign-video-folder"
          aria-label={t('videoMenu.folderLabel')}
          value={folderId}
          onChange={(event) => {
            setFolderId(event.target.value);
            setCategoryId(NO_FOLDER);
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
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
        <span className="text-xs text-slate-400">{t('videoMenu.categoryLabel')}</span>
        <select
          data-testid="assign-video-category"
          aria-label={t('videoMenu.categoryLabel')}
          value={categoryId}
          disabled={selectedFolder === null || selectedFolder.categories.length === 0}
          onChange={(event) => setCategoryId(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-50"
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
        <p data-testid="assign-video-no-categories" className="text-xs text-slate-500">
          {t('videoMenu.noCategoriesHint')}
        </p>
      )}

      {folders.length === 0 && (
        <p data-testid="assign-video-no-folders" className="text-xs text-amber-300">
          {t('videoMenu.noFoldersHint')}
        </p>
      )}

      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
