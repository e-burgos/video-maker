import { LucideIcons, StateBadge } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatUpdatedAt } from '../api/format-updated-at';
import { projectDisplayName } from '../api/humanize-slug';
import { projectHref, projectModeOf } from '../api/project-mode';
import { PROJECT_STATUS_TONE, projectStatusKey } from '../api/project-status';
import { PUBLICATION_STATE_TONE, PUBLICATION_STATUS_LABEL } from '../api/publication-status';
import type { ProjectSummary, VideoFolder, VideoPlacement } from '../api/render-api-types';
import { useVideoCardThumbnail } from '../hooks/use-video-card-thumbnail';
import { artifactUrl } from '../api/artifact-url';
import { useLanguage, useT } from '../i18n/language-context';
import { ArchiveVideoModal } from './archive-video-modal';
import { AssignVideoModal } from './assign-video-modal';
import { DeleteVideoModal } from './delete-video-modal';
import { OverflowMenu } from './ui/overflow-menu';

type OpenModal = 'none' | 'assign' | 'archive' | 'delete';

function VideoCardMedia({ slug }: { slug: string }) {
  const t = useT();
  const { language } = useLanguage();
  const { source, status } = useVideoCardThumbnail(slug);

  return (
    <div className="space-y-1.5">
      <div className="aspect-video w-full overflow-hidden rounded-[10px] bg-[#0b0d14]">
        {status === 'ready' && source !== null ? (
          <video
            data-testid="video-card-thumbnail"
            src={`${artifactUrl(slug, source.path)}#t=0.5`}
            muted
            preload="metadata"
            className="size-full bg-[#0b0d14] object-cover"
          />
        ) : (
          <div
            data-testid="video-card-thumbnail-placeholder"
            aria-hidden="true"
            className="grid size-full place-items-center text-white/40"
          >
            <LucideIcons.Film size={26} />
          </div>
        )}
      </div>
      {source !== null && (
        <p data-testid="video-card-updated-at" className="font-data text-[11px] text-[var(--cl-ink-3)]">
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
  const [modal, setModal] = useState<OpenModal>('none');
  const statusKey = projectStatusKey(video.layout);
  const publication = video.lastPublication;

  function afterChange(): void {
    setModal('none');
    onChanged();
  }

  return (
    <div
      data-testid="video-card"
      data-video={video.slug}
      data-archived={placement.archived}
      className="glass-sub relative flex h-full flex-col gap-2.5 rounded-[14px] p-2.5 hover:border-[var(--cl-ink-3)]"
    >
      <VideoCardMedia slug={video.slug} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[var(--cl-ink)]">{projectDisplayName(video)}</p>
        <p className="font-data truncate text-[11px] text-[var(--cl-ink-3)]">{video.slug}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StateBadge tone={PROJECT_STATUS_TONE[statusKey]} dot size="sm">
          {t(statusKey)}
        </StateBadge>
        {placement.archived && (
          <StateBadge tone="neutral" size="sm" data-testid="video-card-archived-badge">
            {t('projects.status.archived')}
          </StateBadge>
        )}
        {projectModeOf(video) === 'motion' && (
          <StateBadge tone="neutral" size="sm" data-testid="video-card-mode-badge">
            {t('projects.mode.motion')}
          </StateBadge>
        )}
        {publication != null && publication.status !== 'failed' && (
          <span data-testid="video-card-publication" className="relative z-10 inline-flex items-center gap-1.5">
            <StateBadge tone={PUBLICATION_STATE_TONE[publication.status]} dot size="sm">
              {t(PUBLICATION_STATUS_LABEL[publication.status])}
            </StateBadge>
            {publication.url !== null && (
              <a
                href={publication.url}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-cl inline-flex items-center gap-1 rounded text-[11px] text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]"
              >
                {t('publications.viewOnYoutube')}
                <LucideIcons.ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5">
        <Link
          to={projectHref(video)}
          aria-label={t('videoCard.openAria', { slug: video.slug })}
          className="focus-cl inline-flex h-8 flex-1 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--cl-action)_12%,transparent)] text-xs font-semibold text-[var(--cl-action-text)] after:absolute after:inset-0 after:rounded-[14px] hover:bg-[color-mix(in_srgb,var(--cl-action)_20%,transparent)]"
        >
          {t('videoCard.open')}
        </Link>
        <OverflowMenu
          triggerLabel={t('videoMenu.openAria', { slug: video.slug })}
          triggerTestId="video-card-menu-open"
          menuTestId="video-card-menu"
          items={[
            { id: 'assign', label: t('videoMenu.assign'), testId: 'video-card-menu-assign', onSelect: () => setModal('assign') },
            {
              id: 'archive',
              label: placement.archived ? t('videoMenu.restore') : t('videoMenu.archive'),
              testId: 'video-card-menu-archive',
              onSelect: () => setModal('archive'),
            },
            { id: 'delete', label: t('videoMenu.delete'), testId: 'video-card-menu-delete', tone: 'danger', onSelect: () => setModal('delete') },
          ]}
        />
      </div>

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
