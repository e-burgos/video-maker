import type { MotionStoryboard, MotionStoryboardReport } from '../api/motion-types';
import { useT } from '../i18n/language-context';

export type MotionSceneListProps = {
  storyboard: MotionStoryboard;
  stats: MotionStoryboardReport | null;
};

export function MotionSceneList({ storyboard, stats }: MotionSceneListProps) {
  const t = useT();

  return (
    <div data-testid="motion-storyboard" className="space-y-3">
      <h2 className="text-sm font-medium text-ink">{t('motion.storyboard.heading')}</h2>
      {stats !== null && (
        <p data-testid="motion-storyboard-stats" className="font-mono text-xs text-ink-faint">
          {t('motion.storyboard.stats', {
            scenes: storyboard.scenes.length,
            repaired: stats.repaired ? t('motion.storyboard.yes') : t('motion.storyboard.no'),
            tokensIn: stats.tokensIn,
            tokensOut: stats.tokensOut,
            cost: stats.costUsd === null ? '-' : `$${stats.costUsd.toFixed(4)}`,
          })}
        </p>
      )}
      <ol className="space-y-2">
        {storyboard.scenes.map((scene, index) => (
          <li
            key={scene.id}
            data-testid="motion-scene"
            className="rounded-panel border border-border-subtle bg-surface-raised/40 p-3 text-sm"
          >
            <p className="font-mono text-xs text-ink-faint">
              {index + 1} · {scene.kind}
              {scene.chapter === undefined
                ? ''
                : ` · ${t('motion.storyboard.sceneChapter', { chapter: scene.chapter })}`}
            </p>
            <p className="text-ink">{scene.vo}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
