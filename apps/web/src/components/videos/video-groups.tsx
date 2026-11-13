import { placementFor } from '../../api/video-grouping';
import type { VideoGroup } from '../../api/video-grouping';
import type { ProjectSummary, VideoOrganization } from '../../api/render-api-types';
import { categorySectionKey, folderSectionKey } from '../../hooks/use-collapsed-sections';
import { useT } from '../../i18n/language-context';
import { CollapseToggle } from '../collapse-toggle';
import { FolderHeading } from '../folder-heading';
import { VideoCard } from '../video-card';
import { folderIdOf } from '../../api/video-filter';

export type VideoGridProps = {
  videos: readonly ProjectSummary[];
  organization: VideoOrganization;
  onChanged: () => void;
};

export function VideoGrid({ videos, organization, onChanged }: VideoGridProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

export type FolderSectionProps = {
  group: VideoGroup;
  organization: VideoOrganization;
  onChanged: () => void;
  isCollapsed: (key: string) => boolean;
  toggle: (key: string) => void;
};

export function FolderSection({ group, organization, onChanged, isCollapsed, toggle }: FolderSectionProps) {
  const t = useT();
  const folderId = folderIdOf(group);
  const folderKey = folderSectionKey(folderId);
  const folderCollapsed = isCollapsed(folderKey);

  return (
    <section data-testid="folder-section" data-folder={folderId} data-collapsed={folderCollapsed} className="space-y-3 border-t border-[var(--tucu-glass-sub-line)] pt-4 first:border-t-0 first:pt-0">
      <FolderHeading
        folder={group.folder}
        total={group.total}
        onChanged={onChanged}
        collapsed={folderCollapsed}
        onToggleCollapsed={() => toggle(folderKey)}
      />

      {folderCollapsed ? null : group.total === 0 ? (
        <p data-testid="folder-empty" className="text-sm text-[var(--cl-ink-2)]">
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
                  <h4 className="text-xs font-semibold text-[var(--cl-ink-2)]">
                    {categoryName} <span className="font-data text-[var(--cl-ink-3)]">({bucket.videos.length})</span>
                  </h4>
                </div>
                {!categoryCollapsed && <VideoGrid videos={bucket.videos} organization={organization} onChanged={onChanged} />}
              </div>
            );
          })
      )}
    </section>
  );
}
