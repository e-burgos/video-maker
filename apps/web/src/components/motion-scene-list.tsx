import type { MotionStoryboard, MotionStoryboardReport } from '../api/motion-types';
import { useT } from '../i18n/language-context';

export type MotionSceneListProps = {
  storyboard: MotionStoryboard;
  stats: MotionStoryboardReport | null;
};

export function MotionSceneList({ storyboard, stats }: MotionSceneListProps) {
  const t = useT();

  return (
    <div data-testid="motion-storyboard" className="flex flex-col gap-3">
      <h2 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{t('motion.storyboard.heading')}</h2>
      {stats !== null && (
        <p data-testid="motion-storyboard-stats" className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
          {t('motion.storyboard.stats', {
            scenes: storyboard.scenes.length,
            repaired: stats.repaired ? t('motion.storyboard.yes') : t('motion.storyboard.no'),
            tokensIn: stats.tokensIn,
            tokensOut: stats.tokensOut,
            cost: stats.costUsd === null ? '-' : `$${stats.costUsd.toFixed(4)}`,
          })}
        </p>
      )}
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {storyboard.scenes.map((scene, index) => (
          <li key={scene.id} data-testid="motion-scene" className="glass-sub flex flex-col gap-1 rounded-[12px] p-3 text-sm">
            <p className="font-data m-0 text-xs text-[var(--cl-ink-3)]">
              {index + 1} · {scene.kind}
              {scene.chapter === undefined
                ? ''
                : ` · ${t('motion.storyboard.sceneChapter', { chapter: scene.chapter })}`}
            </p>
            <p className="m-0 text-[var(--cl-ink)]">{scene.vo}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
