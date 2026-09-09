import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Timeline } from '@video-maker/timeline-core';

import { parseTimelineDocument } from '../api/parse-timeline';
import { playerTimeline } from '../api/player-timeline';
import { PREVIEW_PRESETS, previewFormat, previewPresetFor } from '../api/preview-format';
import type { PreviewPreset } from '../api/preview-format';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { ErrorNotice } from '../components/error-notice';
import { TimelinePlayer } from '../components/timeline-player';

const PRESET_LABELS: Record<PreviewPreset, string> = {
  'reels-9x16': '9:16',
  'youtube-16x9': '16:9',
};

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

export function ProjectPreviewPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(
    async () => parseTimelineDocument(await client.getTimeline(slug)),
    [client, slug],
  );
  const timeline = useAsyncResource<Timeline>(load, `timeline:${slug}`);
  const [preset, setPreset] = useState<PreviewPreset | null>(null);

  const playable = useMemo(() => {
    if (timeline.data === null) {
      return null;
    }
    const withUrls = playerTimeline(timeline.data, slug, window.location.origin);
    return previewFormat(withUrls, preset ?? previewPresetFor(withUrls));
  }, [preset, slug, timeline.data]);

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
      {timeline.status === 'error' && timeline.error !== null && (
        <ErrorNotice error={timeline.error} onRetry={timeline.reload} />
      )}

      {playable !== null && (
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

          <TimelinePlayer timeline={playable} />

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
                {playable.durationFrames} frames ·{' '}
                {(playable.durationFrames / playable.format.fps).toFixed(2)} s
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-slate-600">tracks</dt>
              <dd data-testid="preview-tracks">{trackSummary(playable)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
