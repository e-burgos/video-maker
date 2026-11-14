import { useEffect, useRef } from 'react';

import { artifactUrl } from '../../api/artifact-url';
import { assetFileName } from '../../api/asset-path';
import { useT } from '../../i18n/language-context';
import type { ViewerItem } from './viewer-model';

export type ViewerThumbStripProps = {
  slug: string;
  items: readonly ViewerItem[];
  activeIndexes: readonly number[];
  onPick: (index: number) => void;
};

function StripThumb({
  slug,
  item,
  index,
}: {
  slug: string;
  item: ViewerItem;
  index: number;
}) {
  if (item.kind === 'image') {
    return (
      <img
        src={artifactUrl(slug, item.path)}
        alt=""
        loading="lazy"
        className="size-full bg-[#0b0d14] object-cover"
      />
    );
  }
  return (
    <span className="font-data grid size-full place-items-center bg-[#0b0d14] text-[11px] uppercase text-white/70">
      {item.kind === 'video' || item.kind === 'audio' ? item.kind : index + 1}
    </span>
  );
}

export function ViewerThumbStrip({
  slug,
  items,
  activeIndexes,
  onPick,
}: ViewerThumbStripProps) {
  const t = useT();
  const activeButton = useRef<HTMLButtonElement | null>(null);
  const primaryIndex = activeIndexes[0] ?? 0;

  useEffect(() => {
    activeButton.current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [primaryIndex]);

  return (
    <ul
      data-testid="viewer-strip"
      aria-label={t('viewer.strip.label')}
      className="m-0 flex list-none gap-2 overflow-x-auto p-1"
    >
      {items.map((item, index) => {
        const active = activeIndexes.includes(index);
        return (
          <li key={item.path} className="shrink-0">
            <button
              type="button"
              data-testid="viewer-strip-item"
              aria-label={t('viewer.strip.item', {
                filename: assetFileName(item.path),
              })}
              aria-current={index === primaryIndex ? 'true' : undefined}
              ref={index === primaryIndex ? activeButton : undefined}
              onClick={() => onPick(index)}
              className={`focus-cl h-14 w-20 overflow-hidden rounded-[10px] border-2 p-0 ${
                active
                  ? 'border-[var(--cl-action)]'
                  : 'border-white/10 hover:border-white/40'
              }`}
            >
              <StripThumb slug={slug} item={item} index={index} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
