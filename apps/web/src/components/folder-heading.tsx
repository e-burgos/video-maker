import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { VideoFolder } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { CollapseToggle } from './collapse-toggle';
import { ErrorNotice } from './error-notice';
import {
  DANGER_BUTTON_SMALL_CLASS,
  FIELD_SMALL_CLASS,
  PRIMARY_BUTTON_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
} from './ui/cl-controls';
import { OverflowMenu } from './ui/overflow-menu';

export type FolderHeadingProps = {
  folder: VideoFolder | null;
  total: number;
  onChanged: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function FolderHeading({
  folder,
  total,
  onChanged,
  collapsed = false,
  onToggleCollapsed,
}: FolderHeadingProps) {
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {onToggleCollapsed !== undefined && (
            <CollapseToggle
              name={title}
              collapsed={collapsed}
              onToggle={onToggleCollapsed}
              testId="folder-collapse-toggle"
            />
          )}
          <h3 className="truncate text-[15px] font-bold text-[var(--cl-ink)]">
            {title}{' '}
            <span data-testid="folder-count" className="font-data text-xs font-normal text-[var(--cl-ink-3)]">
              ({total})
            </span>
          </h3>
        </div>

        {folder !== null && (
          <OverflowMenu
            triggerLabel={t('folder.menuAria', { name: folder.name })}
            triggerTestId="folder-menu-open"
            menuTestId="folder-menu"
            items={[
              {
                id: 'rename',
                label: t('folder.rename'),
                testId: 'folder-rename-open',
                onSelect: () => {
                  setRenameValue(folder.name);
                  setRenaming(true);
                },
              },
              {
                id: 'category',
                label: t('folder.addCategory'),
                testId: 'folder-add-category-open',
                onSelect: () => setAdding(true),
              },
              {
                id: 'delete',
                label: t('folder.delete'),
                testId: 'folder-delete',
                tone: 'danger',
                onSelect: () => setConfirmingDelete(true),
              },
            ]}
          />
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
            className={`${FIELD_SMALL_CLASS} w-48`}
          />
          <button
            type="submit"
            data-testid="folder-rename-submit"
            disabled={pending || renameValue.trim() === '' || renameValue.trim() === folder.name}
            className={PRIMARY_BUTTON_SMALL_CLASS}
          >
            {t('folder.renameSubmit')}
          </button>
          <button
            type="button"
            data-testid="folder-rename-cancel"
            disabled={pending}
            onClick={() => setRenaming(false)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
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
            className={`${FIELD_SMALL_CLASS} w-48`}
          />
          <button
            type="submit"
            data-testid="folder-category-submit"
            disabled={pending}
            className={PRIMARY_BUTTON_SMALL_CLASS}
          >
            {t('folder.categorySubmit')}
          </button>
        </form>
      )}

      {folder !== null && confirmingDelete && (
        <div
          data-testid="folder-delete-confirm"
          role="group"
          className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-2.5"
        >
          <p className="text-xs text-[var(--cl-ink)]">{t('folder.deleteQuestion', { name: folder.name })}</p>
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
            className={DANGER_BUTTON_SMALL_CLASS}
          >
            {t('folder.deleteAccept')}
          </button>
          <button
            type="button"
            data-testid="folder-delete-cancel"
            disabled={pending}
            onClick={() => setConfirmingDelete(false)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('folder.deleteCancel')}
          </button>
        </div>
      )}

      {folder !== null && !collapsed && folder.categories.length > 0 && (
        <ul data-testid="folder-categories" className="flex flex-wrap gap-1.5">
          {folder.categories.map((category) => (
            <li key={category.id} className="glass-sub flex items-center gap-1 rounded-full px-2.5 py-1">
              <span className="text-[11px] text-[var(--cl-ink-2)]">{category.name}</span>
              <button
                type="button"
                data-testid="folder-category-delete"
                aria-label={t('folder.deleteCategoryAria', { name: category.name })}
                disabled={pending}
                onClick={() => {
                  void run(() => client.deleteCategory(folder.id, category.id));
                }}
                className="focus-cl rounded text-[11px] leading-none text-[var(--cl-ink-3)] hover:text-[var(--tucu-state-red-ink)] disabled:opacity-50"
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
