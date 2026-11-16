import { LucideIcons } from '@e-burgos/tucu-ui';

import { artifactUrl } from '../../api/artifact-url';
import { formatBytes } from '../../api/asset-media-kind';
import { assetFileName } from '../../api/asset-path';
import { assetRoleCopy } from '../../api/asset-roles';
import { useT } from '../../i18n/language-context';
import { viewerItemOf } from '../media-viewer/viewer-model';
import { OverflowMenu } from '../ui/overflow-menu';
import type { ViewerItem } from '../media-viewer/viewer-model';
import type { AssetListEntry } from '../../api/render-api-types';

export type AssetTileProps = {
  slug: string;
  asset: AssetListEntry;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: (trigger: HTMLElement) => void;
  onDelete: () => void;
};

const THUMB_CLASS = 'pointer-events-none size-full bg-[#0b0d14] object-cover';

function TileThumbnail({ slug, item }: { slug: string; item: ViewerItem }) {
  const src = artifactUrl(slug, item.path);

  if (item.kind === 'image') {
    return <img src={src} alt="" loading="lazy" className={THUMB_CLASS} />;
  }
  if (item.kind === 'video') {
    return (
      <video
        src={src}
        muted
        preload="metadata"
        tabIndex={-1}
        className={THUMB_CLASS}
      />
    );
  }
  return (
    <span className="font-data pointer-events-none grid size-full place-items-center bg-[#0b0d14] text-xs uppercase text-white/70">
      {item.kind}
    </span>
  );
}

export function AssetTile({
  slug,
  asset,
  selected,
  onToggleSelected,
  onOpen,
  onDelete,
}: AssetTileProps) {
  const t = useT();
  const item = viewerItemOf(asset);
  const filename = assetFileName(asset.path);
  const facts = [formatBytes(item.sizeBytes), ...item.facts].join(' · ');

  return (
    <li
      data-testid="asset-card"
      data-asset-path={asset.path}
      data-role={asset.role}
      data-selected={selected}
      className={`glass-sub relative flex min-w-0 flex-col gap-1.5 rounded-[14px] p-1.5 ${selected ? 'ring-2 ring-[var(--cl-action)]' : ''}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-[#0b0d14]">
        <button
          type="button"
          data-testid="asset-open"
          aria-label={t('library.tile.open', { filename })}
          onClick={(event) => onOpen(event.currentTarget)}
          className="focus-cl absolute inset-0 size-full rounded-[10px] p-0"
        >
          <TileThumbnail slug={slug} item={item} />
        </button>
        <span className="font-data pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#0b0d14]">
          {t(assetRoleCopy(asset.role).shortNameKey)}
        </span>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          data-testid="asset-select"
          aria-label={t('library.tile.select', { filename })}
          onClick={onToggleSelected}
          className={`focus-cl absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border-2 border-white p-0 ${
            selected
              ? 'bg-[var(--cl-action-fill)] text-white'
              : 'bg-black/60 text-transparent hover:text-white'
          }`}
        >
          <LucideIcons.Check aria-hidden size={14} strokeWidth={3} />
        </button>
      </div>
      <div className="flex min-w-0 items-start justify-between gap-1 px-0.5">
        <div className="min-w-0">
          <p
            className="font-data truncate text-xs font-semibold text-[var(--cl-ink)]"
            title={asset.path}
          >
            {filename}
          </p>
          <p className="font-data truncate text-[11px] text-[var(--cl-ink-2)]">
            {facts}
          </p>
        </div>
        <OverflowMenu
          triggerLabel={t('library.tile.menu', { filename })}
          triggerTestId="asset-menu"
          menuTestId="asset-menu-list"
          items={[
            {
              id: 'delete',
              label: t('assetDelete.action'),
              testId: 'asset-delete-open',
              tone: 'danger',
              onSelect: onDelete,
            },
          ]}
        />
      </div>
    </li>
  );
}
