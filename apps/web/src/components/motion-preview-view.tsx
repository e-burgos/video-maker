import { useRef } from 'react';

import { artifactUrl } from '../api/artifact-url';
import type { MotionOverviewScene } from '../api/motion-types';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useT } from '../i18n/language-context';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';
import { RenderReviewPanel } from './render-review-panel';
import { YouTubePublishSection } from './youtube-publish-section';

export type MotionPreviewViewProps = {
  slug: string;
};

function SceneStrip({
  scenes,
  onSeek,
}: {
  scenes: readonly MotionOverviewScene[];
  onSeek: (seconds: number) => void;
}) {
  const t = useT();

  return (
    <ol data-testid="motion-preview-scenes" className="flex flex-wrap gap-2">
      {scenes.map((scene) => (
        <li key={scene.id}>
          <button
            type="button"
            onClick={() => onSeek(scene.startSec)}
            className="rounded-control border border-border-strong px-3 py-1.5 font-mono text-xs text-ink-muted hover:border-ink-faint hover:text-ink"
          >
            {t('motionPreview.sceneRange', {
              id: scene.id,
              start: scene.startSec.toFixed(1),
              end: scene.endSec.toFixed(1),
            })}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function MotionPreviewView({ slug }: MotionPreviewViewProps) {
  const t = useT();
  const overview = useMotionOverview(slug);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = overview.data?.video ?? null;
  const timeline = overview.data?.timeline ?? null;

  function seek(seconds: number) {
    if (videoRef.current !== null) {
      videoRef.current.currentTime = seconds;
    }
  }

  return (
    <MotionViewShell
      slug={slug}
      title={t('motionPreview.title')}
      testId="motion-preview-view"
      loading={overview.status === 'loading'}
      error={overview.error}
      onRetry={overview.reload}
    >
      {overview.status === 'ready' && video === null && (
        <MotionViewEmpty slug={slug} testId="motion-preview-empty" message={t('motionPreview.empty')} />
      )}

      {video !== null && (
        <div className="space-y-4">
          {video.outdated && (
            <p
              role="note"
              data-testid="motion-preview-outdated"
              className="rounded-panel border border-warning p-3 text-sm text-warning"
            >
              {t('motionPreview.outdated')}
            </p>
          )}

          <video
            ref={videoRef}
            src={artifactUrl(slug, video.path)}
            controls
            preload="metadata"
            className="w-full max-w-3xl rounded-control bg-black"
          />

          <p className="font-mono text-xs text-ink-faint">
            {video.path}
            {timeline !== null &&
              ` · ${t('motionPreview.duration', { seconds: timeline.durationSec.toFixed(1) })}`}
          </p>

          <RenderReviewPanel slug={slug} file={video.path} />

          {video.credits !== null && (
            <div data-testid="motion-preview-credits" className="space-y-1">
              <p className="text-xs text-ink-muted">{t('motionPreview.creditsNote')}</p>
              <p className="whitespace-pre-wrap font-mono text-xs text-ink">{video.credits}</p>
            </div>
          )}

          {timeline !== null && timeline.scenes.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-ink">{t('motionPreview.scenes')}</h2>
              <SceneStrip scenes={timeline.scenes} onSeek={seek} />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-ink">{t('youtube.publish.section')}</h2>
            <YouTubePublishSection slug={slug} />
          </div>
        </div>
      )}
    </MotionViewShell>
  );
}
