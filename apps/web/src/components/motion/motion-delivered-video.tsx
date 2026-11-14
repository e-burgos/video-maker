import { artifactUrl } from '../../api/artifact-url';
import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';

export type DeliveredVideo = { path: string; durationSec: number | null; musicCredit: string | null };

export function MotionDeliveredVideo({ slug, video }: { slug: string; video: DeliveredVideo }) {
  const t = useT();

  return (
    <section data-testid="motion-video" className={PANEL_CLASS}>
      <h2 className={PANEL_HEADING_CLASS}>{t('motion.video.heading')}</h2>
      <div className={`${OPAQUE_MEDIA_FRAME_CLASS} aspect-video w-full max-w-4xl`}>
        <video
          src={artifactUrl(slug, video.path)}
          controls
          preload="metadata"
          className="size-full bg-[#0b0d14] object-contain"
        />
      </div>
      <p className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
        {video.durationSec === null ? video.path : t('motion.video.path', { path: video.path, duration: video.durationSec })}
      </p>
      {video.musicCredit !== null && (
        <p data-testid="motion-music-credit" className="m-0 text-xs text-[var(--cl-ink-2)]">
          {t('motion.video.credit', { credit: video.musicCredit })}
        </p>
      )}
    </section>
  );
}
