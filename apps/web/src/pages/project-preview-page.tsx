import { useCallback, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Timeline } from '@video-maker/timeline-core';

import { parseTimelineDocument } from '../api/parse-timeline';
import { playerTimeline } from '../api/player-timeline';
import { PREVIEW_PRESETS, previewFormat, previewPresetFor } from '../api/preview-format';
import type { PreviewPreset } from '../api/preview-format';
import { useRenderApi } from '../api/render-api-context';
import { BUMPER_EDGES, bumperSeconds } from '../api/timeline-edit/logo-bumpers';
import {
  initialTimelineEditState,
  timelineEditReducer,
} from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
import { CaptionEditor } from '../components/caption-editor';
import { CaptionStyleSelector } from '../components/caption-style-selector';
import { ClipTrackEditor } from '../components/clip-track-editor';
import { ErrorNotice } from '../components/error-notice';
import { LogoOverlayEditor } from '../components/logo-overlay-editor';
import { MusicMixEditor } from '../components/music-mix-editor';
import { OutputPresetSelector } from '../components/output-preset-selector';
import { RenderJobList } from '../components/render-job-list';
import { RenderJobPanel } from '../components/render-job-panel';
import { RenderTrigger } from '../components/render-trigger';
import { TimelineIssueList } from '../components/timeline-issue-list';
import { TimelinePlayer } from '../components/timeline-player';
import { TimelineSaveBar } from '../components/timeline-save-bar';
import { YouTubePublishSection } from '../components/youtube-publish-section';
import { MotionPreviewView } from '../components/motion-preview-view';
import { ProjectModeGate } from '../components/project-mode-gate';

const PRESET_LABELS: Record<PreviewPreset, string> = {
  'reels-9x16': '9:16',
  'youtube-16x9': '16:9',
};

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
    <div
      data-testid="timeline-empty-state"
      className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/40 p-6"
    >
      <p className="text-sm font-medium text-slate-200">{t('preview.emptyTitle')}</p>
      <p className="text-sm text-slate-400">{t('preview.emptyBody')}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/projects/${slug}/library`}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100"
        >
          {t('preview.generateMontage')}
        </Link>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
        >
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
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
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.formatLabel')}
        </span>
        {PREVIEW_PRESETS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={playable.format.preset === candidate}
            onClick={() => setPreset(candidate)}
            className={
              playable.format.preset === candidate
                ? 'rounded-md bg-slate-200 px-3 py-1 font-mono text-xs text-slate-900'
                : 'rounded-md border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 hover:border-slate-500'
            }
          >
            {PRESET_LABELS[candidate]}
          </button>
        ))}
        <span className="text-xs text-slate-600">{t('preview.formatNote')}</span>
      </div>

      <OutputPresetSelector preset={editState.draft.format.preset} dispatch={dispatchAction} />

      <TimelinePlayer
        timeline={playable}
        {...(captureFrame !== null ? { initialFrame: captureFrame, controls: false } : {})}
      />

      <dl className="grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">
            {t('preview.canvas')}
          </dt>
          <dd data-testid="preview-canvas">
            {playable.format.width}×{playable.format.height} @ {playable.format.fps} fps
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">
            {t('preview.duration')}
          </dt>
          <dd data-testid="preview-duration">
            {durationSummary(editState.draft, playable, t)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">
            {t('preview.tracks')}
          </dt>
          <dd data-testid="preview-tracks">{trackSummary(editState.draft, t)}</dd>
        </div>
      </dl>

      <TimelineIssueList issues={editState.issues} />
      <TimelineIssueList issues={editState.warnings} />

      <TimelineSaveBar slug={slug} state={editState} dispatch={dispatchAction} />

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.logo')}
        </h2>
        <LogoOverlayEditor
          slug={slug}
          {...(editState.draft.logo === undefined ? {} : { logo: editState.draft.logo })}
          {...(editState.draft.bumpers === undefined ? {} : { bumpers: editState.draft.bumpers })}
          dispatch={dispatchAction}
        />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.music')}
        </h2>
        <MusicMixEditor music={editState.draft.audioMix.music} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.aroll')}
        </h2>
        <ClipTrackEditor track="aroll" clips={editState.draft.tracks.aroll} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.broll')}
        </h2>
        <ClipTrackEditor track="broll" clips={editState.draft.tracks.broll} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.captions')}
        </h2>
        <CaptionStyleSelector
          {...(editState.draft.captionStyle === undefined
            ? {}
            : { captionStyle: editState.draft.captionStyle })}
          {...(editState.draft.captionTheme === undefined ? {} : { captionTheme: editState.draft.captionTheme })}
          brandTheme={brandTheme}
          dispatch={dispatchAction}
        />
        <CaptionEditor captions={editState.draft.tracks.captions} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('preview.section.render')}
        </h2>
        <RenderTrigger slug={slug} state={editState} onCreated={(job) => setSelectedJobId(job.id)} />
        <RenderJobList slug={slug} onSelect={setSelectedJobId} />
        <RenderJobPanel
          slug={slug}
          jobId={selectedJobId}
          onRetried={(job) => setSelectedJobId(job.id)}
        />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('youtube.publish.section')}
        </h2>
        <YouTubePublishSection slug={slug} />
      </div>
    </>
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
    <section className="space-y-6">
      <div>
        <Link to={`/projects/${slug}/library`} className="text-xs text-slate-500 hover:text-slate-300">
          {t('preview.backToLibrary')}
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
          {t('preview.title', { slug })}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t('preview.description')}</p>
      </div>

      {timeline.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('preview.loading')}</p>
      )}
      {timeline.status === 'error' &&
        timeline.error !== null &&
        (timeline.error.code === TIMELINE_NOT_FOUND ? (
          <TimelineEmptyState slug={slug} onRetry={timeline.reload} />
        ) : (
          <ErrorNotice error={timeline.error} onRetry={timeline.reload} />
        ))}

      {timeline.data !== null && (
        <StudioView key={slug} slug={slug} initialTimeline={timeline.data} />
      )}
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
