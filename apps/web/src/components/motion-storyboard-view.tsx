import { artifactUrl } from '../api/artifact-url';
import { motionImagePath, motionPropEntries } from '../api/motion-scene-props';
import type { MotionPropValue } from '../api/motion-scene-props';
import type { MotionOverviewScene, MotionScene, MotionStoryboard } from '../api/motion-types';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useT } from '../i18n/language-context';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';

export type MotionStoryboardViewProps = {
  slug: string;
};

type ChapterGroup = { chapter: string | null; scenes: { scene: MotionScene; index: number }[] };

const DEFAULT_MUSIC_VOLUME = 0.5;

export function formatMusicVolume(volume: number | undefined): string {
  return `${Math.round((volume ?? DEFAULT_MUSIC_VOLUME) * 100)} %`;
}

export function groupScenesByChapter(scenes: readonly MotionScene[]): ChapterGroup[] {
  const groups: ChapterGroup[] = [];
  scenes.forEach((scene, index) => {
    const chapter = scene.chapter ?? null;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.chapter === chapter) {
      last.scenes.push({ scene, index });
      return;
    }
    groups.push({ chapter, scenes: [{ scene, index }] });
  });
  return groups;
}

function PropValue({ slug, value }: { slug: string; value: MotionPropValue }) {
  if (value.kind === 'image') {
    return (
      <img
        src={artifactUrl(slug, motionImagePath(value.file))}
        alt={value.file}
        loading="lazy"
        className="h-16 w-24 rounded-control border border-border-subtle object-cover"
      />
    );
  }
  if (value.kind === 'brand') {
    return (
      <span
        data-testid="motion-brand-chip"
        className="rounded-full border border-border-strong px-2 py-0.5 font-mono text-xs text-ink-muted"
      >
        {value.ref}
      </span>
    );
  }
  return <span className="text-sm text-ink">{value.text}</span>;
}

function SceneCard({
  slug,
  scene,
  index,
  timing,
}: {
  slug: string;
  scene: MotionScene;
  index: number;
  timing: MotionOverviewScene | undefined;
}) {
  const t = useT();
  const entries = motionPropEntries(scene.props);

  return (
    <li
      data-testid="motion-storyboard-scene"
      className="space-y-2 rounded-panel border border-border-subtle bg-surface-raised/40 p-3"
    >
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-faint">
        <span>{index + 1}</span>
        <span>{scene.kind}</span>
        {timing !== undefined && (
          <span data-testid="motion-scene-duration">
            {t('motionStoryboard.sceneDuration', {
              seconds: (timing.endSec - timing.startSec).toFixed(1),
            })}
          </span>
        )}
      </p>
      <p className="text-sm text-ink">{scene.vo}</p>
      {entries.length > 0 && (
        <dl className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.name} className="flex flex-wrap items-center gap-2">
              <dt className="font-mono text-xs text-ink-faint">{entry.name}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {entry.values.map((value, position) => (
                  <PropValue key={position} slug={slug} value={value} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function StoryboardHeader({
  storyboard,
  musicCredit,
}: {
  storyboard: MotionStoryboard;
  musicCredit: string | null;
}) {
  const t = useT();

  return (
    <div
      data-testid="motion-storyboard-header"
      className="space-y-1 rounded-panel border border-border-subtle p-4"
    >
      <h2 className="text-lg font-medium text-ink">{storyboard.title}</h2>
      <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-faint">
        <span>{t('motionStoryboard.brand', { brand: storyboard.brand })}</span>
        <span>{t('motionStoryboard.format', { format: storyboard.format })}</span>
        <span>
          {storyboard.beatSync ? t('motionStoryboard.beatSyncOn') : t('motionStoryboard.beatSyncOff')}
        </span>
        {storyboard.music !== null && (
          <span>{t('motionStoryboard.music', { track: storyboard.music.track, volume: formatMusicVolume(storyboard.music.volume) })}</span>
        )}
        {musicCredit !== null && <span>{musicCredit}</span>}
      </p>
    </div>
  );
}

export function MotionStoryboardView({ slug }: MotionStoryboardViewProps) {
  const t = useT();
  const overview = useMotionOverview(slug);
  const storyboard = overview.data?.storyboard ?? null;
  const timings = new Map((overview.data?.timeline?.scenes ?? []).map((scene) => [scene.id, scene]));

  return (
    <MotionViewShell
      slug={slug}
      title={t('motionStoryboard.title')}
      testId="motion-storyboard-view"
      loading={overview.status === 'loading'}
      error={overview.error}
      onRetry={overview.reload}
    >
      {overview.status === 'ready' && storyboard === null && (
        <MotionViewEmpty
          slug={slug}
          testId="motion-storyboard-empty"
          message={t('motionStoryboard.empty')}
        />
      )}

      {storyboard !== null && (
        <>
          <StoryboardHeader
            storyboard={storyboard}
            musicCredit={overview.data?.timeline?.musicCredit ?? null}
          />
          {groupScenesByChapter(storyboard.scenes).map((group, position) => (
            <div key={`${group.chapter ?? 'none'}-${position}`} className="space-y-2">
              {group.chapter !== null && (
                <h3 data-testid="motion-storyboard-chapter" className="text-sm font-medium text-ink">
                  {group.chapter}
                </h3>
              )}
              <ol className="space-y-2">
                {group.scenes.map(({ scene, index }) => (
                  <SceneCard
                    key={scene.id}
                    slug={slug}
                    scene={scene}
                    index={index}
                    timing={timings.get(scene.id)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </>
      )}
    </MotionViewShell>
  );
}
