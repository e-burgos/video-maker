import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useRenderApi } from '../api/render-api-context';
import { ALL_FOLDERS, effectiveFolderSelection, filterVideosByQuery, visibleGroups } from '../api/video-filter';
import { archivedVideos, groupVideos } from '../api/video-grouping';
import { useT } from '../i18n/language-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useCollapsedSections } from '../hooks/use-collapsed-sections';
import { CreateProjectByDrop } from '../components/create-project-by-drop';
import { ErrorNotice } from '../components/error-notice';
import { HomeDropHint } from '../components/home-drop-hint';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../components/ui/cl-controls';
import { CreateFolderModal } from '../components/videos/create-folder-modal';
import { CreateVideoModal } from '../components/videos/create-video-modal';
import { FolderSection, VideoGrid } from '../components/videos/video-groups';
import { VideoFolderChips } from '../components/videos/video-folder-chips';
import { VideoSearchBar } from '../components/videos/video-search-bar';
import { VideosSkeleton } from '../components/videos/videos-skeleton';
import type { ProjectSummary, VideoOrganization } from '../api/render-api-types';
import { EmptyState } from '../components/ui/status-states';

type ReadyProjectsProps = {
  videos: readonly ProjectSummary[];
  organization: VideoOrganization;
  query: string;
  selectedFolder: string;
  onClearQuery: () => void;
  onChanged: () => void;
};

function ReadyProjects({ videos, organization, query, selectedFolder, onClearQuery, onChanged }: ReadyProjectsProps) {
  const t = useT();
  const [showArchived, setShowArchived] = useState(false);
  const { isCollapsed, toggle } = useCollapsedSections();
  const searching = query.trim() !== '';
  const matching = filterVideosByQuery(videos, query);
  const archived = archivedVideos(matching, organization);
  const groups = visibleGroups(groupVideos(matching, organization), selectedFolder, searching);

  if (searching && groups.length === 0 && archived.length === 0) {
    return (
      <div data-testid="videos-no-results" className="flex flex-col items-start gap-3">
        <p className="text-sm text-[var(--cl-ink-2)]">{t('projects.noResults', { query: query.trim() })}</p>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClearQuery}>
          {t('projects.clearSearch')}
        </button>
      </div>
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

      {archived.length > 0 && selectedFolder === ALL_FOLDERS && (
        <section data-testid="archived-section" className="space-y-3">
          <button
            type="button"
            data-testid="archived-toggle"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((open) => !open)}
            className="focus-cl rounded text-sm text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]"
          >
            {showArchived
              ? t('projects.hideArchived', { count: String(archived.length) })
              : t('projects.showArchived', { count: String(archived.length) })}
          </button>
          {showArchived && <VideoGrid videos={archived} organization={organization} onChanged={onChanged} />}
        </section>
      )}
    </>
  );
}

function EmptyVideos({ onCreate }: { onCreate: () => void }) {
  const t = useT();

  return (
    <div className="space-y-4">
      <HomeDropHint hero />
      <div className="flex flex-wrap items-center gap-3">
        <EmptyState message={t('projects.empty')} />
        <button type="button" data-testid="empty-new-video" className={PRIMARY_BUTTON_CLASS} onClick={onCreate}>
          {t('projects.newVideoCta')}
        </button>
        <Link to="/guide" className="focus-cl rounded text-sm text-[var(--cl-action-text)] underline">
          {t('guide.howDoesThisWork')}
        </Link>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const client = useRenderApi();
  const t = useT();
  const [createVideoOpen, setCreateVideoOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chosenFolder, setChosenFolder] = useState(ALL_FOLDERS);

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

  const openCreateVideo = useCallback(() => setCreateVideoOpen(true), []);
  useToolbarAction({ label: t('projects.newVideoCta'), onClick: openCreateVideo });

  const videoList = videos.data;
  const organizationData = organization.data;
  const existingSlugs = videoList?.map((video) => video.slug) ?? [];
  const loaded =
    videos.status === 'ready' && organization.status === 'ready' && videoList !== null && organizationData !== null
      ? { videos: videoList, organization: organizationData }
      : null;
  const isEmpty = loaded !== null && loaded.videos.length === 0 && loaded.organization.folders.length === 0;
  const isLoading = videos.status === 'loading' || organization.status === 'loading';

  const chipGroups = useMemo(
    () =>
      videoList === null || organizationData === null
        ? []
        : groupVideos(filterVideosByQuery(videoList, query), organizationData),
    [videoList, organizationData, query],
  );
  const selectedFolder = effectiveFolderSelection(chipGroups, chosenFolder);
  const totalMatching = chipGroups.reduce((sum, group) => sum + group.total, 0);

  return (
    <CreateProjectByDrop existingSlugs={existingSlugs}>
      <VideoSearchBar query={query} onQueryChange={setQuery} onNewFolder={() => setCreateFolderOpen(true)} />

      {loaded !== null && !isEmpty && (
        <VideoFolderChips groups={chipGroups} totalVideos={totalMatching} selected={selectedFolder} onSelect={setChosenFolder} />
      )}

      <section data-testid="videos-panel" className="glass flex-1 space-y-4 rounded-[20px] p-4 shadow-[var(--tucu-shadow-panel)]">
        {isLoading && <VideosSkeleton />}
        {videos.status === 'error' && videos.error !== null && (
          <ErrorNotice error={videos.error} onRetry={reloadAll} />
        )}
        {organization.status === 'error' && organization.error !== null && (
          <ErrorNotice error={organization.error} onRetry={reloadAll} />
        )}

        {isEmpty && <EmptyVideos onCreate={openCreateVideo} />}

        {loaded !== null && !isEmpty && (
          <ReadyProjects
            videos={loaded.videos}
            organization={loaded.organization}
            query={query}
            selectedFolder={selectedFolder}
            onClearQuery={() => setQuery('')}
            onChanged={reloadAll}
          />
        )}

        {loaded !== null && !isEmpty && <HomeDropHint />}
      </section>

      <CreateVideoModal
        isOpen={createVideoOpen}
        setIsOpen={setCreateVideoOpen}
        existingSlugs={existingSlugs}
        onCreated={() => {
          setCreateVideoOpen(false);
          reloadAll();
        }}
      />
      <CreateFolderModal isOpen={createFolderOpen} setIsOpen={setCreateFolderOpen} onCreated={reloadAll} />
    </CreateProjectByDrop>
  );
}
