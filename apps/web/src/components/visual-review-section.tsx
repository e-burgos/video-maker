import { VISUAL_NOT_REVIEWED_CHECK } from '@video-maker/timeline-core';
import type { SceneFrame, SceneVisualReview } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { formatClock } from '../api/review-format';
import type { ReviewReport } from '../api/review-types';
import { useT } from '../i18n/language-context';
import { Badge } from './ui/badge';

function BooleanLabel({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      data-good={good}
      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${good ? 'border-success/40 text-success' : 'border-danger/40 text-danger'}`}
    >
      {label}
    </span>
  );
}

function SceneVerdict({ verdict }: { verdict: SceneVisualReview | undefined }) {
  const t = useT();

  if (verdict === undefined) {
    return (
      <Badge data-testid="visual-scene-unreviewed" tone="neutral">
        {t('review.visual.unreviewed')}
      </Badge>
    );
  }

  return (
    <div data-testid="visual-scene-verdict" data-verdict={verdict.verdict} className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={verdict.verdict === 'ok' ? 'success' : 'danger'}>
          {t(verdict.verdict === 'ok' ? 'review.visual.verdict.ok' : 'review.visual.verdict.fix')}
        </Badge>
        <BooleanLabel label={t('review.visual.matchesVoice')} good={verdict.matchesVoice} />
        <BooleanLabel label={t('review.visual.legible')} good={verdict.legible} />
        <BooleanLabel label={t('review.visual.otherProduct')} good={!verdict.couldBeOtherProduct} />
      </div>
      <p className="text-ink">{t('review.visual.shows', { shows: verdict.shows })}</p>
      <p className="text-ink-muted">{verdict.note}</p>
    </div>
  );
}

function SceneCard({ slug, frame, verdict }: { slug: string; frame: SceneFrame; verdict: SceneVisualReview | undefined }) {
  const t = useT();

  return (
    <li data-testid="visual-scene" data-scene-id={frame.sceneId} className="space-y-1.5 rounded-md border border-slate-800 p-2">
      <div className="grid grid-cols-2 gap-1">
        {frame.frames.map((shot) => (
          <img
            key={shot.frame}
            src={artifactUrl(slug, shot.frame)}
            alt={t('review.visual.frameAlt', { index: String(frame.index) })}
            loading="lazy"
            className="aspect-video w-full rounded-control border border-border-subtle object-cover first:col-span-2 only:col-span-2"
          />
        ))}
      </div>
      <p className="text-xs font-medium text-slate-200">
        {t('review.visual.scene', { index: String(frame.index) })}
        <span className="ml-2 font-mono text-slate-500">
          {formatClock(frame.startSec)}–{formatClock(frame.endSec)}
        </span>
      </p>
      {frame.voice !== undefined && <p className="text-xs italic text-slate-400">{frame.voice}</p>}
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
    <section data-testid="visual-review" className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">{t('review.visual.heading')}</h4>
      {notReviewed && (
        <p
          data-testid="visual-not-reviewed-banner"
          role="alert"
          className="rounded-md border border-danger/60 bg-danger/10 px-2 py-1.5 text-sm font-medium text-danger"
        >
          {t('review.visual.notReviewedBanner')}
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
