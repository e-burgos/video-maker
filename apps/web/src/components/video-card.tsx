import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatUpdatedAt } from '../api/format-updated-at';
import { humanizeSlug } from '../api/humanize-slug';
import { projectHref, projectModeOf } from '../api/project-mode';
import { projectStatusKey } from '../api/project-status';
import type { ProjectStatusKey } from '../api/project-status';
import type { ProjectSummary, VideoFolder, VideoPlacement } from '../api/render-api-types';
import { useVideoCardThumbnail } from '../hooks/use-video-card-thumbnail';
import { artifactUrl } from '../api/artifact-url';
import { useLanguage, useT } from '../i18n/language-context';
import { ArchiveVideoModal } from './archive-video-modal';
import { AssignVideoModal } from './assign-video-modal';
import { Badge } from './ui/badge';
import type { BadgeTone } from './ui/badge';
import { DeleteVideoModal } from './delete-video-modal';

type OpenModal = 'none' | 'assign' | 'archive' | 'delete';

const STATUS_TONE: Readonly<Record<ProjectStatusKey, BadgeTone>> = {
  'projects.status.noMaterial': 'neutral',
  'projects.status.materialLoaded': 'accent',
  'projects.status.montageReady': 'warning',
  'projects.status.videoReady': 'success',
};

function VideoCardMedia({ slug }: { slug: string }) {
  const t = useT();
  const { language } = useLanguage();
  const { source, status } = useVideoCardThumbnail(slug);

  return (
    <div className="space-y-1.5">
      {status === 'ready' && source !== null ? (
        <video
          data-testid="video-card-thumbnail"
          src={`${artifactUrl(slug, source.path)}#t=0.5`}
          muted
          preload="metadata"
          className="aspect-video w-full rounded-control bg-black object-cover"
        />
      ) : (
        <div
          data-testid="video-card-thumbnail-placeholder"
          aria-hidden="true"
          className="flex aspect-video w-full items-center justify-center rounded-control border border-border-subtle bg-surface text-2xl text-ink-faint"
        >
          🎬
        </div>
      )}
      {source !== null && (
        <p data-testid="video-card-updated-at" className="text-[11px] text-ink-faint">
          {t('projects.updatedAt', { date: formatUpdatedAt(source.modifiedAtMs, language) })}
        </p>
      )}
    </div>
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
      className="relative rounded-panel border border-border-subtle bg-surface-raised/60 hover:border-border-strong data-[archived=true]:opacity-60"
    >
      <Link
        to={projectHref(video)}
        className="block space-y-3 p-4 pr-10"
      >
        <VideoCardMedia slug={video.slug} />
        <div>
          <p className="truncate text-sm font-medium text-ink">{humanizeSlug(video.slug)}</p>
          <p className="truncate font-mono text-[11px] text-ink-faint">{video.slug}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[projectStatusKey(video.layout)]}>
            {t(projectStatusKey(video.layout))}
          </Badge>
          {projectModeOf(video) === 'motion' && (
            <Badge tone="accent" data-testid="video-card-mode-badge">
              {t('projects.mode.motion')}
            </Badge>
          )}
        </div>
      </Link>

      <button
        type="button"
        data-testid="video-card-menu-open"
        aria-label={t('videoMenu.openAria', { slug: video.slug })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="absolute right-2 top-2 rounded-control border border-transparent px-2 py-1 text-sm leading-none text-ink-faint hover:border-border-strong hover:text-ink"
      >
        ⋮
      </button>

      {menuOpen && (
        <ul
          data-testid="video-card-menu"
          role="menu"
          className="absolute right-2 top-9 z-10 w-56 overflow-hidden rounded-panel border border-border-subtle bg-surface py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              data-testid="video-card-menu-assign"
              onClick={() => openModal('assign')}
              className="block w-full px-3 py-1.5 text-left text-xs text-ink-muted hover:bg-surface-muted"
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
              className="block w-full px-3 py-1.5 text-left text-xs text-ink-muted hover:bg-surface-muted"
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
              className="block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-danger/10"
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
