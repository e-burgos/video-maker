import { useCallback, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Timeline } from '@video-maker/timeline-core';

import { parseTimelineDocument } from '../api/parse-timeline';
import { playerTimeline } from '../api/player-timeline';
import { PREVIEW_PRESETS, previewFormat, previewPresetFor } from '../api/preview-format';
import type { PreviewPreset } from '../api/preview-format';
import { useRenderApi } from '../api/render-api-context';
import {
  initialTimelineEditState,
  timelineEditReducer,
} from '../api/timeline-edit/timeline-edit-state';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useAsyncResource } from '../hooks/use-async-resource';
import { CaptionEditor } from '../components/caption-editor';
import { ClipTrackEditor } from '../components/clip-track-editor';
import { ErrorNotice } from '../components/error-notice';
import { MusicMixEditor } from '../components/music-mix-editor';
import { OutputPresetSelector } from '../components/output-preset-selector';
import { RenderJobList } from '../components/render-job-list';
import { RenderJobPanel } from '../components/render-job-panel';
import { RenderTrigger } from '../components/render-trigger';
import { TimelineIssueList } from '../components/timeline-issue-list';
import { TimelinePlayer } from '../components/timeline-player';
import { TimelineSaveBar } from '../components/timeline-save-bar';

const PRESET_LABELS: Record<PreviewPreset, string> = {
  'reels-9x16': '9:16',
  'youtube-16x9': '16:9',
};

function captureFrameFromLocation(search: string): number | null {
  const frameParam = new URLSearchParams(search).get('frame');
  return frameParam === null ? null : Number(frameParam);
}

function trackSummary(timeline: Timeline): string {
  const { tracks } = timeline;

  return [
    `${tracks.aroll.length} a-roll`,
    `${tracks.broll.length} b-roll`,
    `${tracks.voice.length} voice`,
    `${tracks.music.length} music`,
    `${tracks.captions.length} captions`,
  ].join(' · ');
}

export const TIMELINE_NOT_FOUND = 'TIMELINE_NOT_FOUND';

type TimelineEmptyStateProps = {
  slug: string;
  onRetry: () => void;
};

function TimelineEmptyState({ slug, onRetry }: TimelineEmptyStateProps) {
  return (
    <div
      data-testid="timeline-empty-state"
      className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/40 p-6"
    >
      <p className="text-sm font-medium text-slate-200">This project has no timeline yet.</p>
      <p className="text-sm text-slate-400">
        Generate the montage from the asset library: the service ingests the raw material and builds
        the timeline this page plays.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/projects/${slug}`}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100"
        >
          Generate montage
        </Link>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
        >
          Retry
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

  const playable = useMemo(() => {
    const withUrls = playerTimeline(editState.draft, slug, window.location.origin);
    return previewFormat(withUrls, preset ?? previewPresetFor(withUrls));
  }, [preset, slug, editState.draft]);

  const dispatchAction = useCallback((action: TimelineEditAction) => dispatch(action), []);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-wide text-slate-500">format</span>
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
        <span className="text-xs text-slate-600">preview only — nothing is persisted</span>
      </div>

      <OutputPresetSelector preset={editState.draft.format.preset} dispatch={dispatchAction} />

      <TimelinePlayer
        timeline={playable}
        {...(captureFrame !== null ? { initialFrame: captureFrame, controls: false } : {})}
      />

      <dl className="grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">canvas</dt>
          <dd data-testid="preview-canvas">
            {playable.format.width}×{playable.format.height} @ {playable.format.fps} fps
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">duration</dt>
          <dd data-testid="preview-duration">
            {playable.durationFrames} frames · {(playable.durationFrames / playable.format.fps).toFixed(2)}{' '}
            s
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">tracks</dt>
          <dd data-testid="preview-tracks">{trackSummary(editState.draft)}</dd>
        </div>
      </dl>

      <TimelineIssueList issues={editState.issues} />

      <TimelineSaveBar slug={slug} state={editState} dispatch={dispatchAction} />

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">music</h2>
        <MusicMixEditor music={editState.draft.audioMix.music} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">a-roll</h2>
        <ClipTrackEditor track="aroll" clips={editState.draft.tracks.aroll} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">b-roll</h2>
        <ClipTrackEditor track="broll" clips={editState.draft.tracks.broll} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">captions</h2>
        <CaptionEditor captions={editState.draft.tracks.captions} dispatch={dispatchAction} />
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">render</h2>
        <RenderTrigger slug={slug} state={editState} onCreated={(job) => setSelectedJobId(job.id)} />
        <RenderJobList slug={slug} onSelect={setSelectedJobId} />
        <RenderJobPanel slug={slug} jobId={selectedJobId} />
      </div>
    </>
  );
}

export function ProjectPreviewPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(
    async () => parseTimelineDocument(await client.getTimeline(slug)),
    [client, slug],
  );
  const timeline = useAsyncResource<Timeline>(load, `timeline:${slug}`);

  return (
    <section className="space-y-6">
      <div>
        <Link to={`/projects/${slug}`} className="text-xs text-slate-500 hover:text-slate-300">
          ← asset library
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">{slug} preview</h1>
        <p className="mt-1 text-sm text-slate-400">
          The persisted timeline rendered by the same composition the render uses. The player mixes
          voice and ducked music, but never applies the -14 LUFS mastering of the deliverable.
        </p>
      </div>

      {timeline.status === 'loading' && <p className="text-sm text-slate-500">Loading timeline…</p>}
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
