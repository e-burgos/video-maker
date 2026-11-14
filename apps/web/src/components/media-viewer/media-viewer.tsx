import { LucideIcons } from '@e-burgos/tucu-ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { MaterialReviewItem } from '@video-maker/timeline-core';

import { assetFileName } from '../../api/asset-path';
import { useT } from '../../i18n/language-context';
import { comparePartnerIndex, stepIndex } from './viewer-model';
import type { ViewerItem } from './viewer-model';
import { ViewerDetail } from './viewer-detail';
import { ViewerStage } from './viewer-stage';
import { ViewerThumbStrip } from './viewer-thumb-strip';
import { useDialogFocus } from './use-dialog-focus';

export type MediaViewerProps = {
  slug: string;
  items: readonly ViewerItem[];
  startPath: string;
  selectedPaths: readonly string[];
  startCompare: boolean;
  review: ReadonlyMap<string, MaterialReviewItem>;
  trigger: HTMLElement | null;
  onClose: () => void;
};

const DARK_SURFACE_TOKENS = {
  '--cl-ink': '#f5f5f7',
  '--cl-ink-2': 'rgba(235, 235, 245, 0.72)',
  '--cl-ink-3': 'rgba(235, 235, 245, 0.62)',
  '--cl-action': '#409cff',
} as CSSProperties;

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

const KBD_CLASS =
  'font-data grid h-5 min-w-5 place-items-center rounded-md border border-white/30 px-1 text-[11px] text-white';
const HEADER_BUTTON_CLASS =
  'focus-cl inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50';

function startIndexOf(items: readonly ViewerItem[], startPath: string): number {
  return Math.max(
    0,
    items.findIndex((item) => item.path === startPath),
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && TYPING_TAGS.includes(target.tagName);
}

export function MediaViewer({
  slug,
  items,
  startPath,
  selectedPaths,
  startCompare,
  review,
  trigger,
  onClose,
}: MediaViewerProps) {
  const t = useT();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => startIndexOf(items, startPath));
  const [compareRequested, setCompareRequested] = useState(startCompare);
  const [pinnedPartner, setPinnedPartner] = useState<number | null>(() => {
    if (!startCompare) {
      return null;
    }
    const first = startIndexOf(items, startPath);
    return comparePartnerIndex(items, selectedPaths, first);
  });

  useDialogFocus(root, trigger);

  const current = items[index];
  const partnerIndex = compareRequested
    ? (pinnedPartner ?? comparePartnerIndex(items, selectedPaths, index))
    : null;
  const partner = partnerIndex === null ? undefined : items[partnerIndex];
  const comparing = partner !== undefined;
  const canCompare = items.length > 1;

  const step = useCallback(
    (direction: -1 | 1) => {
      setPinnedPartner(null);
      setIndex((position) => stepIndex(items.length, position, direction));
    },
    [items.length],
  );

  const toggleCompare = useCallback(() => {
    if (items.length < 2) {
      return;
    }
    setPinnedPartner(null);
    setCompareRequested((requested) => !requested);
  }, [items.length]);

  const pick = useCallback((target: number) => {
    setPinnedPartner(null);
    setIndex(target);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      ) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        toggleCompare();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, step, toggleCompare]);

  if (current === undefined) {
    return null;
  }

  const visible =
    comparing && partner !== undefined ? [current, partner] : [current];
  const activeIndexes =
    comparing && partnerIndex !== null ? [index, partnerIndex] : [index];
  const title =
    comparing && partner !== undefined
      ? t('viewer.title.compare', {
          a: assetFileName(current.path),
          b: assetFileName(partner.path),
        })
      : assetFileName(current.path);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="media-viewer"
      data-compare={comparing}
      style={DARK_SURFACE_TOKENS}
      className="fixed inset-0 z-[70] grid grid-cols-1 overflow-y-auto bg-[#0a0c14] text-white outline-none motion-safe:animate-[viewer-in_140ms_ease-out] md:grid-cols-[minmax(0,1fr)_17rem] md:overflow-hidden"
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 p-4 max-md:min-h-[85vh]">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2
            id={titleId}
            data-testid="viewer-title"
            className="font-data min-w-0 truncate text-sm font-bold"
          >
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <kbd className={KBD_CLASS}>←</kbd>
              <kbd className={KBD_CLASS}>→</kbd>
              {t('viewer.hint.navigate')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className={KBD_CLASS}>C</kbd>
              {t('viewer.hint.compare')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className={KBD_CLASS}>Esc</kbd>
              {t('viewer.hint.close')}
            </span>
            <button
              type="button"
              data-testid="viewer-prev"
              aria-label={t('viewer.prev')}
              onClick={() => step(-1)}
              className={`${HEADER_BUTTON_CLASS} w-8 px-0`}
            >
              <LucideIcons.ChevronLeft
                aria-hidden
                size={16}
                className="h-4 w-4 shrink-0"
                strokeWidth={2.25}
              />
            </button>
            <button
              type="button"
              data-testid="viewer-next"
              aria-label={t('viewer.next')}
              onClick={() => step(1)}
              className={`${HEADER_BUTTON_CLASS} w-8 px-0`}
            >
              <LucideIcons.ChevronRight
                aria-hidden
                size={16}
                className="h-4 w-4 shrink-0"
                strokeWidth={2.25}
              />
            </button>
            <button
              type="button"
              data-testid="viewer-compare"
              aria-pressed={comparing}
              disabled={!canCompare}
              onClick={toggleCompare}
              className={HEADER_BUTTON_CLASS}
            >
              {comparing ? t('viewer.compare.exit') : t('viewer.compare.enter')}
            </button>
            <button
              type="button"
              data-testid="viewer-close"
              aria-label={t('viewer.close')}
              onClick={onClose}
              className={`${HEADER_BUTTON_CLASS} w-8 px-0`}
            >
              <LucideIcons.X
                aria-hidden
                size={16}
                className="h-4 w-4 shrink-0"
                strokeWidth={2.25}
              />
            </button>
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 gap-3 ${comparing ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {visible.map((item, position) => (
            <ViewerStage
              key={item.path}
              slug={slug}
              item={item}
              side={!comparing ? 'single' : position === 0 ? 'left' : 'right'}
            />
          ))}
        </div>

        <ViewerThumbStrip
          slug={slug}
          items={items}
          activeIndexes={activeIndexes}
          onPick={pick}
        />
      </div>

      <aside className="min-h-0 space-y-4 overflow-y-auto border-white/10 bg-[#121623] p-4 max-md:border-t md:border-l">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="m-0 text-sm font-bold text-white">
            {t('viewer.detail.heading')}
          </h3>
          <span
            data-testid="viewer-position"
            className="font-data text-xs text-white/70"
          >
            {t('viewer.position', { index: index + 1, total: items.length })}
          </span>
        </div>
        {visible.map((item, position) => (
          <div
            key={item.path}
            className={position > 0 ? 'border-t border-white/10 pt-4' : ''}
          >
            <ViewerDetail
              slug={slug}
              item={item}
              review={review.get(item.path)}
            />
          </div>
        ))}
      </aside>
    </div>,
    document.body,
  );
}
