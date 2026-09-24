import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoFolder } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type FolderHeadingProps = {
  folder: VideoFolder | null;
  total: number;
  onChanged: () => void;
};

export function FolderHeading({ folder, total, onChanged }: FolderHeadingProps) {
  const client = useRenderApi();
  const t = useT();
  const [categoryName, setCategoryName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState<RenderApiError | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  const title = folder === null ? t('projects.unassigned') : folder.name;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">
          {title}{' '}
          <span data-testid="folder-count" className="font-normal text-slate-500">
            ({total})
          </span>
        </h3>

        {folder !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="folder-rename-open"
              onClick={() => {
                setRenameValue(folder.name);
                setRenaming((open) => !open);
              }}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              {t('folder.rename')}
            </button>
            <button
              type="button"
              data-testid="folder-add-category-open"
              onClick={() => setAdding((open) => !open)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              {t('folder.addCategory')}
            </button>
            <button
              type="button"
              data-testid="folder-delete"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-500/60 hover:text-rose-200"
            >
              {t('folder.delete')}
            </button>
          </div>
        )}
      </div>

      {folder !== null && renaming && (
        <form
          data-testid="folder-rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = renameValue.trim();
            if (trimmed === '' || trimmed === folder.name) {
              return;
            }
            void run(async () => {
              await client.renameFolder(folder.id, trimmed);
              setRenaming(false);
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            data-testid="folder-rename-name"
            aria-label={t('folder.renameNameLabel')}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="w-48 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          />
          <button
            type="submit"
            data-testid="folder-rename-submit"
            disabled={pending || renameValue.trim() === '' || renameValue.trim() === folder.name}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
          >
            {t('folder.renameSubmit')}
          </button>
          <button
            type="button"
            data-testid="folder-rename-cancel"
            disabled={pending}
            onClick={() => setRenaming(false)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
          >
            {t('folder.renameCancel')}
          </button>
        </form>
      )}

      {folder !== null && adding && (
        <form
          data-testid="folder-add-category-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (categoryName.trim() === '') {
              return;
            }
            void run(async () => {
              await client.createCategory(folder.id, categoryName);
              setCategoryName('');
              setAdding(false);
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            data-testid="folder-category-name"
            aria-label={t('folder.categoryNameLabel')}
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder={t('folder.categoryPlaceholder')}
            className="w-48 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600"
          />
          <button
            type="submit"
            data-testid="folder-category-submit"
            disabled={pending}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
          >
            {t('folder.categorySubmit')}
          </button>
        </form>
      )}

      {folder !== null && confirmingDelete && (
        <div
          data-testid="folder-delete-confirm"
          role="group"
          className="flex flex-wrap items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2"
        >
          <p className="text-xs text-rose-100">{t('folder.deleteQuestion', { name: folder.name })}</p>
          <button
            type="button"
            data-testid="folder-delete-accept"
            disabled={pending}
            onClick={() => {
              void run(async () => {
                await client.deleteFolder(folder.id);
                setConfirmingDelete(false);
              });
            }}
            className="rounded-md border border-rose-400/60 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {t('folder.deleteAccept')}
          </button>
          <button
            type="button"
            data-testid="folder-delete-cancel"
            disabled={pending}
            onClick={() => setConfirmingDelete(false)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
          >
            {t('folder.deleteCancel')}
          </button>
        </div>
      )}

      {folder !== null && folder.categories.length > 0 && (
        <ul data-testid="folder-categories" className="flex flex-wrap gap-1.5">
          {folder.categories.map((category) => (
            <li key={category.id} className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5">
              <span className="text-[11px] text-slate-400">{category.name}</span>
              <button
                type="button"
                data-testid="folder-category-delete"
                aria-label={t('folder.deleteCategoryAria', { name: category.name })}
                disabled={pending}
                onClick={() => {
                  void run(() => client.deleteCategory(folder.id, category.id));
                }}
                className="text-[11px] leading-none text-slate-600 hover:text-rose-300 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}
