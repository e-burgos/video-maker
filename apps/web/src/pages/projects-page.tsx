import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { useRenderApi } from '../api/render-api-context';
import { archivedVideos, groupVideos, placementFor } from '../api/video-grouping';
import type { VideoGroup } from '../api/video-grouping';
import { useT } from '../i18n/language-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { categorySectionKey, folderSectionKey, useCollapsedSections } from '../hooks/use-collapsed-sections';
import { CollapseToggle } from '../components/collapse-toggle';
import { CreateFolderForm } from '../components/create-folder-form';
import { CreateProjectByDrop } from '../components/create-project-by-drop';
import { CreateProjectForm } from '../components/create-project-form';
import { ErrorNotice } from '../components/error-notice';
import { FolderHeading } from '../components/folder-heading';
import { HomeDropHint } from '../components/home-drop-hint';
import { Button } from '../components/ui/button';
import { VideoCard } from '../components/video-card';
import type { ProjectSummary, VideoOrganization } from '../api/render-api-types';

function VideoGrid({
  videos,
  organization,
  onChanged,
}: {
  videos: readonly ProjectSummary[];
  organization: VideoOrganization;
  onChanged: () => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <li key={video.slug}>
          <VideoCard
            video={video}
            placement={placementFor(organization, video.slug)}
            folders={organization.folders}
            onChanged={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

function FolderSection({
  group,
  organization,
  onChanged,
  isCollapsed,
  toggle,
}: {
  group: VideoGroup;
  organization: VideoOrganization;
  onChanged: () => void;
  isCollapsed: (key: string) => boolean;
  toggle: (key: string) => void;
}) {
  const t = useT();
  const folderId = group.folder?.id ?? 'unassigned';
  const folderKey = folderSectionKey(folderId);
  const folderCollapsed = isCollapsed(folderKey);

  return (
    <section
      data-testid="folder-section"
      data-folder={folderId}
      data-collapsed={folderCollapsed}
      className="space-y-3 rounded-xl border border-slate-800/80 p-4"
    >
      <FolderHeading
        folder={group.folder}
        total={group.total}
        onChanged={onChanged}
        collapsed={folderCollapsed}
        onToggleCollapsed={() => toggle(folderKey)}
      />

      {folderCollapsed ? null : group.total === 0 ? (
        <p data-testid="folder-empty" className="text-sm text-slate-500">
          {t('projects.folderEmpty')}
        </p>
      ) : (
        group.buckets
          .filter((bucket) => bucket.videos.length > 0)
          .map((bucket) => {
            const categoryId = bucket.category?.id ?? 'uncategorized';
            const categoryName = bucket.category === null ? t('projects.noCategory') : bucket.category.name;
            const categoryKey = categorySectionKey(folderId, categoryId);
            const categoryCollapsed = isCollapsed(categoryKey);
            return (
              <div
                key={categoryId}
                data-testid="category-bucket"
                data-category={categoryId}
                data-collapsed={categoryCollapsed}
                className="space-y-2"
              >
                <div className="flex items-center gap-1">
                  <CollapseToggle
                    name={categoryName}
                    collapsed={categoryCollapsed}
                    onToggle={() => toggle(categoryKey)}
                    testId="category-collapse-toggle"
                  />
                  <h4 className="text-xs font-medium tracking-wide text-ink-faint">
                    {categoryName}{' '}
                    <span className="text-slate-600">({bucket.videos.length})</span>
                  </h4>
                </div>
                {!categoryCollapsed && (
                  <VideoGrid videos={bucket.videos} organization={organization} onChanged={onChanged} />
                )}
              </div>
            );
          })
      )}
    </section>
  );
}

function ReadyProjects({
  videos,
  organization,
  onChanged,
}: {
  videos: readonly ProjectSummary[];
  organization: VideoOrganization;
  onChanged: () => void;
}) {
  const t = useT();
  const [showArchived, setShowArchived] = useState(false);
  const { isCollapsed, toggle } = useCollapsedSections();
  const archived = archivedVideos(videos, organization);
  const groups = groupVideos(videos, organization);

  if (videos.length === 0 && groups.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t('projects.empty')}{' '}
        <Link to="/guide" className="text-sky-300 underline hover:text-sky-200">
          {t('guide.howDoesThisWork')}
        </Link>
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <FolderSection
            key={group.folder?.id ?? 'unassigned'}
            group={group}
            organization={organization}
            onChanged={onChanged}
            isCollapsed={isCollapsed}
            toggle={toggle}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <section data-testid="archived-section" className="space-y-3">
          <button
            type="button"
            data-testid="archived-toggle"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((open) => !open)}
            className="text-sm text-slate-400 underline hover:text-slate-200"
          >
            {showArchived
              ? t('projects.hideArchived', { count: String(archived.length) })
              : t('projects.showArchived', { count: String(archived.length) })}
          </button>
          {showArchived && (
            <VideoGrid videos={archived} organization={organization} onChanged={onChanged} />
          )}
        </section>
      )}
    </>
  );
}

export function ProjectsPage() {
  const client = useRenderApi();
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);

  const loadVideos = useCallback(() => client.listProjects(), [client]);
  const loadOrganization = useCallback(() => client.getOrganization(), [client]);
  const videos = useAsyncResource<ProjectSummary[]>(loadVideos, 'projects');
  const organization = useAsyncResource<VideoOrganization>(loadOrganization, 'organization');

  const reloadVideos = videos.reload;
  const reloadOrganization = organization.reload;
  const reloadAll = useCallback(() => {
    reloadVideos();
    reloadOrganization();
  }, [reloadOrganization, reloadVideos]);

  const videoList = videos.data;
  const organizationData = organization.data;
  const existingSlugs = videoList?.map((video) => video.slug) ?? [];
  const isEmpty = videos.status === 'ready' && videoList !== null && videoList.length === 0;

  return (
    <CreateProjectByDrop existingSlugs={existingSlugs}>
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('projects.title')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('projects.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <CreateFolderForm onCreated={reloadAll} />
            <Button
              variant="primary"
              data-testid="new-video-cta"
              onClick={() => setCreateOpen((open) => !open)}
            >
              {t('projects.newVideoCta')}
            </Button>
          </div>
        </div>

        {createOpen && (
          <CreateProjectForm
            existingSlugs={existingSlugs}
            onCreated={() => {
              setCreateOpen(false);
              reloadAll();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        )}

        {!isEmpty && <HomeDropHint />}

        {(videos.status === 'loading' || organization.status === 'loading') && (
          <p className="text-sm text-ink-faint">{t('projects.loading')}</p>
        )}
        {videos.status === 'error' && videos.error !== null && (
          <ErrorNotice error={videos.error} onRetry={reloadAll} />
        )}
        {organization.status === 'error' && organization.error !== null && (
          <ErrorNotice error={organization.error} onRetry={reloadAll} />
        )}

        {isEmpty && <HomeDropHint hero />}

        {videos.status === 'ready' &&
          videoList !== null &&
          organization.status === 'ready' &&
          organizationData !== null && (
            <ReadyProjects videos={videoList} organization={organizationData} onChanged={reloadAll} />
          )}
      </section>
    </CreateProjectByDrop>
  );
}
