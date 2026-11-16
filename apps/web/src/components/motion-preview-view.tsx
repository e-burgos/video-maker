import { useRef } from 'react';

import { artifactUrl } from '../api/artifact-url';
import type { MotionOverviewScene } from '../api/motion-types';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useT } from '../i18n/language-context';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';
import { RenderReviewPanel } from './render-review-panel';
import { SampleTrigger } from './sample-trigger';
import { OPAQUE_MEDIA_FRAME_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
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
    <ol data-testid="motion-preview-scenes" className="m-0 flex list-none flex-wrap gap-2 p-0">
      {scenes.map((scene) => (
        <li key={scene.id}>
          <button type="button" onClick={() => onSeek(scene.startSec)} className={`${SECONDARY_BUTTON_SMALL_CLASS} font-data`}>
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
      testId="motion-preview-view"
      loading={overview.status === 'loading'}
      error={overview.error}
      onRetry={overview.reload}
    >
      {overview.status === 'ready' && video === null && (
        <MotionViewEmpty slug={slug} testId="motion-preview-empty" message={t('motionPreview.empty')} />
      )}

      {overview.data?.storyboard != null && (
        <div data-testid="motion-preview-sample" className={PANEL_CLASS}>
          <SampleTrigger slug={slug} kind="motion" />
        </div>
      )}

      {video !== null && (
        <>
          <section className={PANEL_CLASS}>
            <h2 className={PANEL_HEADING_CLASS}>{t('motionPreview.title')}</h2>
            {video.outdated && (
              <div
                role="note"
                data-testid="motion-preview-outdated"
                className="rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3 text-sm text-[var(--cl-ink)]"
              >
                {t('motionPreview.outdated')}
              </div>
            )}

            <div className={`${OPAQUE_MEDIA_FRAME_CLASS} aspect-video w-full max-w-4xl`}>
              <video
                ref={videoRef}
                src={artifactUrl(slug, video.path)}
                controls
                preload="metadata"
                className="size-full bg-[#0b0d14] object-contain"
              />
            </div>

            <p className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
              {video.path}
              {timeline !== null && ` · ${t('motionPreview.duration', { seconds: timeline.durationSec.toFixed(1) })}`}
            </p>

            {video.credits !== null && (
              <div data-testid="motion-preview-credits" className="flex flex-col gap-1">
                <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('motionPreview.creditsNote')}</p>
                <p className="font-data m-0 whitespace-pre-wrap text-xs text-[var(--cl-ink)]">{video.credits}</p>
              </div>
            )}

            {timeline !== null && timeline.scenes.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="m-0 text-sm font-bold text-[var(--cl-ink)]">{t('motionPreview.scenes')}</h3>
                <SceneStrip scenes={timeline.scenes} onSeek={seek} />
              </div>
            )}
          </section>

          <section className={PANEL_CLASS}>
            <RenderReviewPanel slug={slug} file={video.path} />
          </section>

          <section className={PANEL_CLASS}>
            <h2 className={PANEL_HEADING_CLASS}>{t('youtube.publish.section')}</h2>
            <YouTubePublishSection slug={slug} />
          </section>
        </>
      )}
    </MotionViewShell>
  );
}
