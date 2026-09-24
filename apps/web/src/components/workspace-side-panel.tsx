import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Timeline } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { assetMediaKind, formatDuration } from '../api/asset-media-kind';
import { assetRoleCopy } from '../api/asset-roles';
import { parseTimelineDocument } from '../api/parse-timeline';
import { playerTimeline } from '../api/player-timeline';
import { previewFormat, previewPresetFor } from '../api/preview-format';
import { useRenderApi } from '../api/render-api-context';
import { renderJobDeliverableUrl } from '../api/render-job-artifact';
import {
  groupAssetsByRole,
  latestSucceededJobOfKind,
  succeededJobsOfKindNewestFirst,
} from '../api/workspace-panel';
import type { WorkspaceTabId } from '../api/workspace-panel';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { AsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { TimelinePlayer } from './timeline-player';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { TabPanel, Tabs } from './ui/tabs';
import type { TabItem } from './ui/tabs';
import type { AssetListing, RenderJobListing } from '../api/render-api-types';

export type WorkspaceSidePanelProps = {
  slug: string;
  activeTab: WorkspaceTabId;
  onTabChange: (tab: WorkspaceTabId) => void;
  assets: AsyncResource<AssetListing>;
  jobs: AsyncResource<RenderJobListing>;
};

function MaterialThumbnail({ slug, path }: { slug: string; path: string }) {
  const src = artifactUrl(slug, path);
  const kind = assetMediaKind(path);

  if (kind === 'video') {
    return (
      <video
        src={src}
        muted
        preload="metadata"
        className="h-16 w-24 rounded-control bg-black object-cover"
      />
    );
  }

  if (kind === 'image') {
    return <img src={src} alt={path} className="h-16 w-24 rounded-control bg-black object-cover" />;
  }

  return (
    <div className="flex h-16 w-24 items-center justify-center rounded-control border border-border-subtle text-[10px] text-ink-faint">
      {kind}
    </div>
  );
}

function PreviewTab({ slug, jobs }: { slug: string; jobs: AsyncResource<RenderJobListing> }) {
  const client = useRenderApi();
  const t = useT();
  const latestRender = latestSucceededJobOfKind(jobs.data, 'render');
  const latestMontage = latestSucceededJobOfKind(jobs.data, 'montage');

  const loadTimeline = useCallback(
    async () => parseTimelineDocument(await client.getTimeline(slug)),
    [client, slug],
  );
  const timeline = useAsyncResource<Timeline>(
    loadTimeline,
    `workspace-timeline:${slug}:${latestMontage?.id ?? 'none'}`,
  );

  if (latestRender !== null) {
    return (
      <div className="space-y-2">
        <video
          data-testid="workspace-preview-video"
          src={renderJobDeliverableUrl(slug, latestRender.id)}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-panel bg-black"
        />
        <p className="text-xs text-ink-faint">
          {t('workspace.preview.latestRender')} · {latestRender.finishedAt ?? latestRender.createdAt}
        </p>
      </div>
    );
  }

  if (timeline.status === 'loading') {
    return <p className="text-sm text-ink-faint">{t('preview.loading')}</p>;
  }

  if (timeline.status === 'error') {
    if (timeline.error?.code === 'TIMELINE_NOT_FOUND') {
      return (
        <p data-testid="workspace-preview-empty" className="text-sm text-ink-faint">
          {t('workspace.preview.empty')}
        </p>
      );
    }
    return timeline.error !== null ? <ErrorNotice error={timeline.error} onRetry={timeline.reload} /> : null;
  }

  if (timeline.data === null) {
    return (
      <p data-testid="workspace-preview-empty" className="text-sm text-ink-faint">
        {t('workspace.preview.empty')}
      </p>
    );
  }

  const withUrls = playerTimeline(timeline.data, slug, window.location.origin);
  const playable = previewFormat(withUrls, previewPresetFor(withUrls));

  return <TimelinePlayer timeline={playable} />;
}

function MaterialTab({ slug, assets }: { slug: string; assets: AsyncResource<AssetListing> }) {
  const t = useT();

  if (assets.status === 'loading') {
    return <p className="text-sm text-ink-faint">{t('library.loading')}</p>;
  }

  if (assets.status === 'error' && assets.error !== null) {
    return <ErrorNotice error={assets.error} onRetry={assets.reload} />;
  }

  const groups = groupAssetsByRole(assets.data);

  if (groups.length === 0) {
    return (
      <p data-testid="workspace-material-empty" className="text-sm text-ink-faint">
        {t('workspace.material.empty')}
      </p>
    );
  }

  return (
    <div data-testid="workspace-material" className="space-y-4">
      {groups.map((group) => (
        <div key={group.role} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              {t(assetRoleCopy(group.role).nameKey)}
            </p>
            <Badge>{group.assets.length}</Badge>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {group.assets.map((asset) => (
              <div key={asset.path} title={asset.path} className="shrink-0 space-y-1">
                <MaterialThumbnail slug={slug} path={asset.path} />
                {asset.media !== null && asset.media.kind !== 'image' && (
                  <p className="text-[10px] text-ink-faint">{formatDuration(asset.media.durationMs)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Link
        to={`/projects/${encodeURIComponent(slug)}/library`}
        className="inline-block text-xs text-accent underline hover:text-accent-strong"
      >
        {t('workspace.material.openLibrary')}
      </Link>
    </div>
  );
}

function DeliveriesTab({ slug, jobs }: { slug: string; jobs: AsyncResource<RenderJobListing> }) {
  const t = useT();

  if (jobs.status === 'loading') {
    return <p className="text-sm text-ink-faint">{t('renderJobs.loading')}</p>;
  }

  if (jobs.status === 'error' && jobs.error !== null) {
    return <ErrorNotice error={jobs.error} onRetry={jobs.reload} />;
  }

  const deliveries = succeededJobsOfKindNewestFirst(jobs.data, 'render');

  if (deliveries.length === 0) {
    return (
      <p data-testid="workspace-deliveries-empty" className="text-sm text-ink-faint">
        {t('workspace.deliveries.empty')}
      </p>
    );
  }

  return (
    <ul data-testid="workspace-deliveries" className="space-y-3">
      {deliveries.map((job) => (
        <li key={job.id} className="space-y-2 rounded-panel border border-border-subtle bg-surface-raised/40 p-3">
          <video
            src={renderJobDeliverableUrl(slug, job.id)}
            controls
            preload="metadata"
            className="aspect-video w-full rounded-control bg-black"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
            <span>{t('workspace.deliveries.finishedAt', { date: job.finishedAt ?? job.createdAt })}</span>
            <a
              href={renderJobDeliverableUrl(slug, job.id)}
              className="text-accent underline hover:text-accent-strong"
            >
              {t('renderJob.download')}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceSidePanel({ slug, activeTab, onTabChange, assets, jobs }: WorkspaceSidePanelProps) {
  const t = useT();
  const tabs: readonly TabItem<WorkspaceTabId>[] = [
    { id: 'preview', label: t('workspace.tab.preview') },
    { id: 'material', label: t('workspace.tab.material') },
    { id: 'deliveries', label: t('workspace.tab.deliveries') },
  ];

  return (
    <Card data-testid="workspace-side-panel" className="flex flex-col gap-3 p-4">
      <Tabs tabs={tabs} value={activeTab} onChange={onTabChange} idPrefix="workspace" />

      <TabPanel id="preview" value={activeTab} idPrefix="workspace">
        <PreviewTab slug={slug} jobs={jobs} />
      </TabPanel>
      <TabPanel id="material" value={activeTab} idPrefix="workspace">
        <MaterialTab slug={slug} assets={assets} />
      </TabPanel>
      <TabPanel id="deliveries" value={activeTab} idPrefix="workspace">
        <DeliveriesTab slug={slug} jobs={jobs} />
      </TabPanel>
    </Card>
  );
}
