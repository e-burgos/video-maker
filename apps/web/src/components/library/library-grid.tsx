import { useT } from '../../i18n/language-context';
import { AssetTile } from './asset-tile';
import { thumbnailColumns } from './library-model';
import type { AssetListEntry } from '../../api/render-api-types';
import type { ThumbnailSize } from './library-model';

export type LibraryGridProps = {
  slug: string;
  assets: readonly AssetListEntry[];
  selected: readonly string[];
  size: ThumbnailSize;
  filtered: boolean;
  onToggleSelected: (path: string) => void;
  onOpen: (path: string, trigger: HTMLElement) => void;
  onDelete: (asset: AssetListEntry) => void;
  onUpload: () => void;
};

export function LibraryGrid({
  slug,
  assets,
  selected,
  size,
  filtered,
  onToggleSelected,
  onOpen,
  onDelete,
  onUpload,
}: LibraryGridProps) {
  const t = useT();

  return (
    <div className="space-y-2">
      {assets.length === 0 && (
        <p
          data-testid="library-empty"
          className="m-0 text-sm text-[var(--cl-ink-2)]"
        >
          {filtered ? t('library.grid.emptyFilter') : t('library.grid.empty')}
        </p>
      )}
      <ul
        data-testid="library-grid"
        aria-label={t('library.grid.label')}
        className={`m-0 grid list-none gap-3 p-0 ${thumbnailColumns(size)}`}
      >
        {assets.map((asset) => (
          <AssetTile
            key={asset.path}
            slug={slug}
            asset={asset}
            selected={selected.includes(asset.path)}
            onToggleSelected={() => onToggleSelected(asset.path)}
            onOpen={(trigger) => onOpen(asset.path, trigger)}
            onDelete={() => onDelete(asset)}
          />
        ))}
        <li className="min-w-0">
          <button
            type="button"
            data-testid="library-drop-tile"
            onClick={onUpload}
            className="focus-cl flex aspect-[4/3] w-full items-center justify-center rounded-[14px] border border-dashed border-[var(--cl-ink-3)] text-xs font-semibold text-[var(--cl-action-text)]"
          >
            {t('library.tile.drop')}
          </button>
        </li>
      </ul>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">
        {t('library.grid.hint')}
      </p>
    </div>
  );
}
