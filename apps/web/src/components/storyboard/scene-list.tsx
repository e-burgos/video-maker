import type { StoryboardScene } from '@video-maker/timeline-core';

import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { formatClock, formatSceneSeconds } from './storyboard-model';
import type { SceneStatus, SceneTiming } from './storyboard-model';

const STATUS_KEY: Readonly<Record<SceneStatus, TranslationKey>> = {
  ready: 'storyboard.sceneStatus.ready',
  edited: 'storyboard.sceneStatus.edited',
  incomplete: 'storyboard.sceneStatus.incomplete',
};

const STATUS_DOT: Readonly<Record<SceneStatus, string>> = {
  ready: 'bg-[var(--tucu-state-green-ink)]',
  edited: 'bg-[var(--tucu-state-orange-ink)]',
  incomplete: 'bg-[var(--tucu-state-red-ink)]',
};

export type SceneListProps = {
  scenes: readonly StoryboardScene[];
  selectedId: string;
  statuses: ReadonlyMap<string, SceneStatus>;
  timings: ReadonlyMap<string, SceneTiming>;
  onSelect: (sceneId: string) => void;
};

export function SceneList({ scenes, selectedId, statuses, timings, onSelect }: SceneListProps) {
  const t = useT();

  return (
    <nav
      aria-label={t('storyboard.sceneList.label')}
      data-testid="storyboard-scene-list"
      className="glass rounded-[20px] p-2 min-[1100px]:sticky min-[1100px]:top-0"
    >
      <ul className="m-0 flex max-h-44 list-none flex-col gap-1 overflow-y-auto p-0 min-[1100px]:max-h-[calc(100vh-14rem)]">
        {scenes.map((scene) => {
          const status = statuses.get(scene.id) ?? 'ready';
          const timing = timings.get(scene.id);
          const selected = scene.id === selectedId;

          return (
            <li key={scene.id}>
              <button
                type="button"
                data-testid={`storyboard-scene-row-${scene.id}`}
                data-scene-status={status}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(scene.id)}
                className={`focus-cl grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] px-3 py-2 text-left ${
                  selected
                    ? 'bg-[color-mix(in_srgb,var(--cl-action)_16%,transparent)]'
                    : 'hover:bg-[color-mix(in_srgb,var(--cl-ink)_6%,transparent)]'
                }`}
              >
                <span className="font-data text-sm text-[var(--cl-ink-3)]">
                  {String(scene.index).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--cl-ink)]">
                    {t('storyboardScene.heading', { index: scene.index })}
                  </span>
                  <span className="font-data block truncate text-xs text-[var(--cl-ink-2)]">
                    {timing === undefined ? '' : `${formatClock(timing.startMs)} · `}
                    {t('storyboard.sceneDuration', { seconds: formatSceneSeconds(scene.estimatedDurationMs) })}
                  </span>
                </span>
                <span aria-hidden className={`size-2.5 rounded-full ${STATUS_DOT[status]}`} />
                <span className="sr-only">{t(STATUS_KEY[status])}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
