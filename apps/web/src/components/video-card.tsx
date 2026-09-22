import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { ProjectLayout, ProjectSummary, VideoFolder, VideoPlacement } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { ArchiveVideoModal } from './archive-video-modal';
import { AssignVideoModal } from './assign-video-modal';
import { DeleteVideoModal } from './delete-video-modal';

const LAYOUT_FLAGS: ReadonlyArray<keyof ProjectLayout> = ['raw', 'catalog', 'timeline', 'edl', 'out'];

type OpenModal = 'none' | 'assign' | 'archive' | 'delete';

function LayoutFlags({ layout }: { layout: ProjectLayout }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {LAYOUT_FLAGS.map((flag) => (
        <li
          key={flag}
          data-present={layout[flag]}
          className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 data-[present=true]:border-emerald-500/50 data-[present=true]:text-emerald-300"
        >
          {flag}
        </li>
      ))}
    </ul>
  );
}

export type VideoCardProps = {
  video: ProjectSummary;
  placement: VideoPlacement;
  folders: readonly VideoFolder[];
  onChanged: () => void;
};

export function VideoCard({ video, placement, folders, onChanged }: VideoCardProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<OpenModal>('none');
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent): void {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen]);

  function openModal(next: OpenModal): void {
    setMenuOpen(false);
    setModal(next);
  }

  function afterChange(): void {
    setModal('none');
    onChanged();
  }

  return (
    <div
      ref={container}
      data-testid="video-card"
      data-video={video.slug}
      data-archived={placement.archived}
      className="relative rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-600 data-[archived=true]:opacity-60"
    >
      <Link
        to={`/projects/${encodeURIComponent(video.slug)}/producer`}
        className="block p-4 pr-10"
      >
        <p className="font-mono text-sm font-medium text-slate-100">{video.slug}</p>
        <div className="mt-3">
          <LayoutFlags layout={video.layout} />
        </div>
      </Link>

      <button
        type="button"
        data-testid="video-card-menu-open"
        aria-label={t('videoMenu.openAria', { slug: video.slug })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="absolute right-2 top-2 rounded-md border border-transparent px-2 py-1 text-sm leading-none text-slate-500 hover:border-slate-600 hover:text-slate-200"
      >
        ⋮
      </button>

      {menuOpen && (
        <ul
          data-testid="video-card-menu"
          role="menu"
          className="absolute right-2 top-9 z-10 w-56 overflow-hidden rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              data-testid="video-card-menu-assign"
              onClick={() => openModal('assign')}
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
            >
              {t('videoMenu.assign')}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              data-testid="video-card-menu-archive"
              onClick={() => openModal('archive')}
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
            >
              {placement.archived ? t('videoMenu.restore') : t('videoMenu.archive')}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              data-testid="video-card-menu-delete"
              onClick={() => openModal('delete')}
              className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-rose-500/10"
            >
              {t('videoMenu.delete')}
            </button>
          </li>
        </ul>
      )}

      {modal === 'assign' && (
        <AssignVideoModal
          slug={video.slug}
          placement={placement}
          folders={folders}
          onClose={() => setModal('none')}
          onAssigned={afterChange}
        />
      )}
      {modal === 'archive' && (
        <ArchiveVideoModal
          slug={video.slug}
          placement={placement}
          onClose={() => setModal('none')}
          onArchived={afterChange}
        />
      )}
      {modal === 'delete' && (
        <DeleteVideoModal
          slug={video.slug}
          placement={placement}
          onClose={() => setModal('none')}
          onDeleted={afterChange}
        />
      )}
    </div>
  );
}
