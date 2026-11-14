import { useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Timeline } from '@video-maker/timeline-core';

import { artifactUrl } from '../../api/artifact-url';
import { parseTimelineDocument } from '../../api/parse-timeline';
import { playerTimeline } from '../../api/player-timeline';
import { previewFormat, previewPresetFor } from '../../api/preview-format';
import { useRenderApi } from '../../api/render-api-context';
import { renderDeliveriesNewestFirst, latestSucceededJobOfKind } from '../../api/workspace-panel';
import { useAsyncResource } from '../../hooks/use-async-resource';
import type { AsyncResource } from '../../hooks/use-async-resource';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { TimelinePlayer } from '../timeline-player';
import type { GeneratedListing, ProjectDetail, RenderJobListing } from '../../api/render-api-types';

export type WorkspacePreviewProps = {
  slug: string;
  jobs: AsyncResource<RenderJobListing>;
  generated: GeneratedListing | null;
};

const STAGE_CLASS = 'relative aspect-video w-full overflow-hidden rounded-[12px] bg-[#0b0d14]';

function Stage({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className={STAGE_CLASS}>
      {children}
    </div>
  );
}

function StageMessage({ children }: { children: ReactNode }) {
  return <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white/75">{children}</p>;
}

function EmptyStage() {
  const t = useT();
  return (
    <div className="space-y-2">
      <Stage testId="workspace-preview-empty">
        <StageMessage>{t('workspace.preview.emptyTitle')}</StageMessage>
      </Stage>
      <p className="text-xs text-[var(--cl-ink-2)]">{t('workspace.preview.empty')}</p>
    </div>
  );
}

function PreviewContent({ slug, jobs, generated }: WorkspacePreviewProps) {
  const client = useRenderApi();
  const t = useT();
  const latestRender = renderDeliveriesNewestFirst(jobs.data, generated)[0] ?? null;
  const latestMontage = latestSucceededJobOfKind(jobs.data, 'montage');

  const project = useAsyncResource<ProjectDetail>(
    useCallback(() => client.getProject(slug), [client, slug]),
    `project-detail:${slug}`,
  );
  const timelineExists = project.data?.layout.timeline ?? null;

  const loadTimeline = useCallback(async () => {
    if (timelineExists !== true) {
      return null;
    }
    return parseTimelineDocument(await client.getTimeline(slug));
  }, [client, slug, timelineExists]);
  const timeline = useAsyncResource<Timeline | null>(
    loadTimeline,
    `workspace-timeline:${slug}:${latestMontage?.id ?? 'none'}:${timelineExists}`,
  );

  if (latestRender !== null) {
    return (
      <div className="space-y-2">
        <Stage>
          <video
            data-testid="workspace-preview-video"
            src={artifactUrl(slug, latestRender.path)}
            controls
            preload="metadata"
            className="size-full bg-[#0b0d14] object-contain"
          />
        </Stage>
        <p className="font-data text-xs text-[var(--cl-ink-2)]">
          {t('workspace.preview.latestRender')} · {latestRender.finishedAt}
        </p>
      </div>
    );
  }

  if (project.status === 'loading' || timeline.status === 'loading') {
    return (
      <Stage>
        <StageMessage>{t('preview.loading')}</StageMessage>
      </Stage>
    );
  }

  if (timeline.status === 'error' && timeline.error?.code !== 'TIMELINE_NOT_FOUND') {
    return timeline.error !== null ? <ErrorNotice error={timeline.error} onRetry={timeline.reload} /> : null;
  }

  if (timeline.data === null) {
    return <EmptyStage />;
  }

  const withUrls = playerTimeline(timeline.data, slug, window.location.origin);
  const playable = previewFormat(withUrls, previewPresetFor(withUrls));

  return (
    <Stage>
      <TimelinePlayer timeline={playable} fit />
    </Stage>
  );
}

export function WorkspacePreview(props: WorkspacePreviewProps) {
  const t = useT();

  return (
    <section data-testid="workspace-preview" className="glass flex shrink-0 flex-col gap-3 rounded-[20px] p-4">
      <h2 className="text-[15px] font-bold text-[var(--cl-ink)]">{t('workspace.preview.heading')}</h2>
      <PreviewContent {...props} />
    </section>
  );
}
