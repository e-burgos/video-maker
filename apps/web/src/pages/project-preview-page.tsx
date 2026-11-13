import { useCallback, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Timeline } from '@video-maker/timeline-core';

import { parseTimelineDocument } from '../api/parse-timeline';
import { playerTimeline } from '../api/player-timeline';
import { previewFormat, previewPresetFor } from '../api/preview-format';
import type { PreviewPreset } from '../api/preview-format';
import { useRenderApi } from '../api/render-api-context';
import { BUMPER_EDGES, bumperSeconds } from '../api/timeline-edit/logo-bumpers';
import { initialTimelineEditState, timelineEditReducer } from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
import { ErrorNotice } from '../components/error-notice';
import { PreviewSettingsPanel } from '../components/preview/preview-settings-panel';
import { PreviewStagePanel } from '../components/preview/preview-stage-panel';
import { PreviewToolbarStatus } from '../components/preview/preview-toolbar-status';
import { RenderHistoryPanel } from '../components/preview/render-history-panel';
import { TimelineIssueList } from '../components/timeline-issue-list';
import { TimelineSaveBar } from '../components/timeline-save-bar';
import { PRIMARY_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../components/ui/cl-controls';
import { YouTubePublishSection } from '../components/youtube-publish-section';
import { MotionPreviewView } from '../components/motion-preview-view';
import { ProjectModeGate } from '../components/project-mode-gate';

function captureFrameFromLocation(search: string): number | null {
  const frameParam = new URLSearchParams(search).get('frame');
  return frameParam === null ? null : Number(frameParam);
}

function durationSummary(draft: Timeline, playable: Timeline, t: TranslateFn): string {
  const content = t('preview.durationValue', {
    frames: playable.durationFrames,
    seconds: (playable.durationFrames / playable.format.fps).toFixed(2),
  });
  const bumperParts = BUMPER_EDGES.map((edge) => bumperSeconds(draft, edge))
    .filter((seconds): seconds is number => seconds !== null)
    .map((seconds) => t('preview.durationBumper', { seconds: String(seconds) }));

  return [content, ...bumperParts].join(' ');
}

function trackSummary(timeline: Timeline, t: TranslateFn): string {
  const { tracks } = timeline;

  return t('preview.trackSummary', {
    aroll: tracks.aroll.length,
    broll: tracks.broll.length,
    voice: tracks.voice.length,
    music: tracks.music.length,
    captions: tracks.captions.length,
  });
}

export const TIMELINE_NOT_FOUND = 'TIMELINE_NOT_FOUND';

type TimelineEmptyStateProps = {
  slug: string;
  onRetry: () => void;
};

function TimelineEmptyState({ slug, onRetry }: TimelineEmptyStateProps) {
  const t = useT();

  return (
    <div data-testid="timeline-empty-state" className="glass flex flex-col gap-3 rounded-[20px] p-5">
      <p className="m-0 text-sm font-semibold text-[var(--cl-ink)]">{t('preview.emptyTitle')}</p>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('preview.emptyBody')}</p>
      <div className="flex flex-wrap gap-2">
        <Link to={`/projects/${slug}/library`} className={`${PRIMARY_BUTTON_SMALL_CLASS} no-underline`}>
          {t('preview.generateMontage')}
        </Link>
        <button type="button" onClick={onRetry} className={SECONDARY_BUTTON_SMALL_CLASS}>
          {t('error.retry')}
        </button>
      </div>
    </div>
  );
}

type StudioViewProps = {
  slug: string;
  initialTimeline: Timeline;
};

function StudioView({ slug, initialTimeline }: StudioViewProps) {
  const [editState, dispatch] = useReducer(
    timelineEditReducer,
    initialTimeline,
    initialTimelineEditState,
  );
  const [preset, setPreset] = useState<PreviewPreset | null>(null);
  const captureFrame = captureFrameFromLocation(window.location.search);
  const t = useT();

  const playable = useMemo(() => {
    const withUrls = playerTimeline(editState.draft, slug, window.location.origin);
    return previewFormat(withUrls, preset ?? previewPresetFor(withUrls));
  }, [preset, slug, editState.draft]);

  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(() => client.getProject(slug), [client, slug]),
    `studio-project:${slug}`,
  );
  const brandTheme = project.data?.captionTheme ?? null;
  const brandBackground = brandTheme?.boxColor;

  const dispatchAction = useCallback(
    (action: TimelineEditAction) =>
      dispatch(
        action.type === 'bumper-enabled' && action.enabled && brandBackground !== undefined
          ? { ...action, defaultBackgroundColor: brandBackground }
          : action,
      ),
    [brandBackground],
  );

  return (
    <div data-testid="preview-page" className="flex min-h-full flex-col gap-4">
      <PreviewToolbarStatus state={editState} />
      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PreviewStagePanel
            playable={playable}
            captureFrame={captureFrame}
            onPresetChange={setPreset}
            summary={{
              canvas: `${playable.format.width}×${playable.format.height} @ ${playable.format.fps} fps`,
              duration: durationSummary(editState.draft, playable, t),
              tracks: trackSummary(editState.draft, t),
            }}
          />

          <TimelineIssueList issues={editState.issues} />
          <TimelineIssueList issues={editState.warnings} />

          <RenderHistoryPanel slug={slug} state={editState} />

          <section className="glass flex min-w-0 flex-col gap-3 rounded-[20px] p-4">
            <h2 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{t('youtube.publish.section')}</h2>
            <YouTubePublishSection slug={slug} />
          </section>
        </div>

        <PreviewSettingsPanel
          slug={slug}
          draft={editState.draft}
          brandTheme={brandTheme}
          dispatch={dispatchAction}
        />
      </div>

      <TimelineSaveBar slug={slug} state={editState} dispatch={dispatchAction} />
    </div>
  );
}

function ClassicProjectPreviewPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(
    async () => parseTimelineDocument(await client.getTimeline(slug)),
    [client, slug],
  );
  const timeline = useAsyncResource<Timeline>(load, `timeline:${slug}`);
  const t = useT();

  return (
    <section data-testid="project-preview-page" className="flex min-h-full flex-col gap-4">
      {timeline.status === 'loading' && (
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('preview.loading')}</p>
      )}
      {timeline.status === 'error' &&
        timeline.error !== null &&
        (timeline.error.code === TIMELINE_NOT_FOUND ? (
          <TimelineEmptyState slug={slug} onRetry={timeline.reload} />
        ) : (
          <ErrorNotice surface="glass" error={timeline.error} onRetry={timeline.reload} />
        ))}

      {timeline.data !== null && <StudioView key={slug} slug={slug} initialTimeline={timeline.data} />}
    </section>
  );
}

export function ProjectPreviewPage() {
  const { slug = '' } = useParams<{ slug: string }>();

  return (
    <ProjectModeGate
      slug={slug}
      footage={<ClassicProjectPreviewPage />}
      motion={<MotionPreviewView slug={slug} />}
    />
  );
}
