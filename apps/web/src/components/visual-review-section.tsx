import { StateBadge } from '@e-burgos/tucu-ui';
import { VISUAL_NOT_REVIEWED_CHECK } from '@video-maker/timeline-core';
import type { SceneFrame, SceneVisualReview } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { formatClock } from '../api/review-format';
import type { ReviewReport } from '../api/review-types';
import { useT } from '../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS } from './ui/cl-controls';

function BooleanLabel({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      data-good={good}
      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${good ? 'border-[var(--tucu-state-green-line)] text-[var(--tucu-state-green-ink)]' : 'border-[var(--tucu-state-red-line)] text-[var(--tucu-state-red-ink)]'}`}
    >
      {label}
    </span>
  );
}

function SceneVerdict({ verdict }: { verdict: SceneVisualReview | undefined }) {
  const t = useT();

  if (verdict === undefined) {
    return (
      <StateBadge data-testid="visual-scene-unreviewed" tone="neutral" size="sm">
        {t('review.visual.unreviewed')}
      </StateBadge>
    );
  }

  return (
    <div data-testid="visual-scene-verdict" data-verdict={verdict.verdict} className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StateBadge tone={verdict.verdict === 'ok' ? 'green' : 'red'} dot size="sm">
          {t(verdict.verdict === 'ok' ? 'review.visual.verdict.ok' : 'review.visual.verdict.fix')}
        </StateBadge>
        <BooleanLabel label={t('review.visual.matchesVoice')} good={verdict.matchesVoice} />
        <BooleanLabel label={t('review.visual.legible')} good={verdict.legible} />
        <BooleanLabel label={t('review.visual.otherProduct')} good={!verdict.couldBeOtherProduct} />
      </div>
      <p className="m-0 text-[var(--cl-ink)]">{t('review.visual.shows', { shows: verdict.shows })}</p>
      <p className="m-0 text-[var(--cl-ink-2)]">{verdict.note}</p>
    </div>
  );
}

function SceneCard({ slug, frame, verdict }: { slug: string; frame: SceneFrame; verdict: SceneVisualReview | undefined }) {
  const t = useT();

  return (
    <li data-testid="visual-scene" data-scene-id={frame.sceneId} className="m-0 flex flex-col gap-1.5 rounded-[12px] border border-[var(--tucu-glass-sub-line)] p-2">
      <div className={`${OPAQUE_MEDIA_FRAME_CLASS} grid grid-cols-2 gap-1`}>
        {frame.frames.map((shot) => (
          <img
            key={shot.frame}
            src={artifactUrl(slug, shot.frame)}
            alt={t('review.visual.frameAlt', { index: String(frame.index) })}
            loading="lazy"
            className="aspect-video w-full object-cover first:col-span-2 only:col-span-2"
          />
        ))}
      </div>
      <p className="m-0 text-xs font-medium text-[var(--cl-ink)]">
        {t('review.visual.scene', { index: String(frame.index) })}
        <span className="font-data ml-2 text-[var(--cl-ink-3)]">
          {formatClock(frame.startSec)}–{formatClock(frame.endSec)}
        </span>
      </p>
      {frame.voice !== undefined && <p className="m-0 text-xs italic text-[var(--cl-ink-2)]">{frame.voice}</p>}
      <SceneVerdict verdict={verdict} />
    </li>
  );
}

export function VisualReviewSection({ slug, report }: { slug: string; report: ReviewReport }) {
  const t = useT();
  const frames = report.sceneFrames ?? [];
  const notReviewed = report.findings.some((finding) => finding.check === VISUAL_NOT_REVIEWED_CHECK);

  if (frames.length === 0 && !notReviewed) {
    return null;
  }

  return (
    <section data-testid="visual-review" className="flex flex-col gap-2">
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--cl-ink-2)]">{t('review.visual.heading')}</h4>
      {notReviewed && (
        <p
          data-testid="visual-not-reviewed-banner"
          role="alert"
          className="m-0 rounded-[10px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] px-2 py-1.5 text-sm font-medium text-[var(--tucu-state-red-ink)]"
        >
          {t('review.visual.notReviewedBanner')}
        </p>
      )}
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {frames.map((frame) => (
          <SceneCard
            key={frame.sceneId}
            slug={slug}
            frame={frame}
            verdict={report.visualReview?.scenes.find((scene) => scene.sceneId === frame.sceneId)}
          />
        ))}
      </ul>
    </section>
  );
}
