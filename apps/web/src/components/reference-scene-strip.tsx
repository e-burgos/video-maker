import { artifactUrl } from '../api/artifact-url';
import { roundSeconds } from '../api/reference-format';
import { formatClock } from '../api/review-format';
import { useT } from '../i18n/language-context';
import type { ReferenceBrief } from '../api/reference-types';

export type ReferenceSceneStripProps = {
  slug: string;
  scenes: ReferenceBrief['scenes'];
};

export function ReferenceSceneStrip({
  slug,
  scenes,
}: ReferenceSceneStripProps) {
  const t = useT();

  return (
    <ol
      data-testid="reference-scene-strip"
      className="flex max-w-full gap-2 overflow-x-auto pb-2"
    >
      {scenes.map((scene) => {
        const number = String(scene.index + 1);
        return (
          <li
            key={scene.index}
            data-testid="reference-scene"
            className="w-36 shrink-0 space-y-1 glass-sub rounded-[10px] p-1.5"
          >
            <img
              src={artifactUrl(slug, scene.keyframe)}
              alt={t('reference.scene.keyframeAlt', { number })}
              loading="lazy"
              className="aspect-video w-full rounded bg-[#0b0d14] object-cover"
            />
            <p className="text-[11px] font-medium text-[var(--cl-ink)]">
              {t('reference.scene.label', { number })}
            </p>
            <p className="font-data text-[11px] text-[var(--cl-ink-2)]">
              {t('reference.scene.range', {
                start: formatClock(scene.startSec),
                end: formatClock(scene.endSec),
              })}
            </p>
            <p className="font-data text-[11px] text-[var(--cl-ink-2)]">
              {t('reference.seconds', {
                value: roundSeconds(scene.durationSec),
              })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
