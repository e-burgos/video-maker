import { StateBadge } from '@e-burgos/tucu-ui';
import { useEffect, useRef, useState } from 'react';
import type { VoiceDirection } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { formatUpdatedAt } from '../api/format-updated-at';
import { directedSceneCount } from '../api/motion-storyboard-draft';
import { motionImagePath, motionPropEntries } from '../api/motion-scene-props';
import type { MotionPropValue } from '../api/motion-scene-props';
import type { MotionMeasuredBox, MotionOverviewScene, MotionScene, MotionStoryboard } from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import { hasDirection } from '../api/voice-direction';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useMotionStoryboardDraft } from '../hooks/use-motion-storyboard-draft';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useLanguage, useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { MotionJobStatus } from './motion-job-status';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';
import { MusicModeFields } from './music-mode-fields';
import { useToolbarAction } from './shell/use-toolbar-action';
import { OPAQUE_MEDIA_FRAME_CLASS, PANEL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { VoiceDirectionEditor } from './voice-direction-editor';

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
      <span className={`${OPAQUE_MEDIA_FRAME_CLASS} h-16 w-24 shrink-0`}>
        <img
          src={artifactUrl(slug, motionImagePath(value.file))}
          alt={value.file}
          loading="lazy"
          className="size-full bg-[#0b0d14] object-cover"
        />
      </span>
    );
  }
  if (value.kind === 'brand') {
    return (
      <span
        data-testid="motion-brand-chip"
        className="glass-thin font-data rounded-full px-2 py-0.5 text-xs text-[var(--cl-ink-2)]"
      >
        {value.ref}
      </span>
    );
  }
  return <span className="text-sm text-[var(--cl-ink)]">{value.text}</span>;
}

function MeasuredBoxesList({ boxes }: { boxes: readonly MotionMeasuredBox[] }) {
  const t = useT();
  const { language } = useLanguage();
  if (boxes.length === 0) return null;
  return (
    <section
      data-testid="motion-measured-boxes"
      className="flex flex-col gap-1 rounded-[14px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
    >
      <h3 className="m-0 text-sm font-bold text-[var(--cl-ink)]">{t('motionStoryboard.measuredBoxes.heading')}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {boxes.map((box) => (
          <li key={`${box.image}-${box.name}`} className="text-xs text-[var(--cl-ink-2)]">
            {t('motionStoryboard.measuredBoxes.item', {
              name: box.name,
              image: box.image,
              who: box.measuredBy === 'producer' ? t('motionStoryboard.measuredBoxes.producer') : box.measuredBy,
              date: box.measuredAt === null ? t('motionStoryboard.measuredBoxes.unknownDate') : formatUpdatedAt(Date.parse(box.measuredAt), language),
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SceneCard({
  slug,
  scene,
  index,
  timing,
  direction,
  onDirectionChange,
}: {
  slug: string;
  scene: MotionScene;
  index: number;
  timing: MotionOverviewScene | undefined;
  direction: VoiceDirection | undefined;
  onDirectionChange: (direction: VoiceDirection | undefined) => void;
}) {
  const t = useT();
  const entries = motionPropEntries(scene.props);

  return (
    <li
      data-testid="motion-storyboard-scene"
      className="glass-sub flex flex-col gap-2 rounded-[12px] p-3"
    >
      <p className="font-data m-0 flex flex-wrap items-center gap-2 text-xs text-[var(--cl-ink-3)]">
        <span>{index + 1}</span>
        <span>{scene.kind}</span>
        {hasDirection(direction) && (
          <span data-testid="motion-direction-badge">
            <StateBadge tone="purple" size="sm">
              {t('voiceDirection.badge')}
            </StateBadge>
          </span>
        )}
        {timing !== undefined && (
          <span data-testid="motion-scene-duration">
            {t('motionStoryboard.sceneDuration', {
              seconds: (timing.endSec - timing.startSec).toFixed(1),
            })}
          </span>
        )}
      </p>
      <p className="m-0 text-sm text-[var(--cl-ink)]">{scene.vo}</p>
      {entries.length > 0 && (
        <dl className="m-0 flex flex-col gap-1">
          {entries.map((entry) => (
            <div key={entry.name} className="flex flex-wrap items-center gap-2">
              <dt className="font-data text-xs text-[var(--cl-ink-3)]">{entry.name}</dt>
              <dd className="m-0 flex flex-wrap items-center gap-2">
                {entry.values.map((value, position) => (
                  <PropValue key={position} slug={slug} value={value} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <VoiceDirectionEditor
        target={t('voiceDirection.sceneTarget', { sceneId: scene.id })}
        text={scene.vo}
        direction={direction}
        onChange={onDirectionChange}
      />
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
    <div data-testid="motion-storyboard-header" className={PANEL_CLASS}>
      <h2 className="m-0 text-base font-bold text-[var(--cl-ink)]">{storyboard.title}</h2>
      <p className="font-data m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--cl-ink-2)]">
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
  const client = useRenderApi();
  const overview = useMotionOverview(slug);
  const storyboard = overview.data?.storyboard ?? null;
  const timings = new Map((overview.data?.timeline?.scenes ?? []).map((scene) => [scene.id, scene]));

  const [jobId, setJobId] = useState<string | null>(null);
  const draft = useMotionStoryboardDraft(slug, storyboard, overview.reload, (job) => setJobId(job.id));
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const job = poll.job;
  const handledJob = useRef<string | null>(null);
  const reloadOverview = overview.reload;

  useEffect(() => {
    if (job === null || job.kind !== 'motion' || job.state !== 'succeeded' || handledJob.current === job.id) {
      return;
    }
    handledJob.current = job.id;
    reloadOverview();
  }, [job, reloadOverview]);

  const busy =
    draft.saveAction.status === 'pending' ||
    draft.regenerateAction.status === 'pending' ||
    (jobId !== null && (poll.polling || job === null));
  const regenerating = draft.regenerateAction.status === 'pending';

  useToolbarAction(
    storyboard === null
      ? null
      : {
          label: regenerating ? t('motionDirection.regenerating') : t('motionDirection.regenerate'),
          onClick: () => void draft.regenerate(),
          disabled: !draft.valid || busy,
          loading: regenerating,
        },
  );

  return (
    <MotionViewShell
      slug={slug}
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

      <MeasuredBoxesList boxes={overview.data?.measuredBoxes ?? []} />

      {storyboard !== null && (
        <>
          <StoryboardHeader
            storyboard={storyboard}
            musicCredit={overview.data?.timeline?.musicCredit ?? null}
          />

          {draft.music !== null && (
            <div className={PANEL_CLASS}>
              <MusicModeFields
                mode={draft.music.mode}
                floorText={draft.music.floorText}
                onModeChange={draft.setMusicMode}
                onFloorTextChange={draft.setFloorText}
              />
            </div>
          )}

          <div data-testid="motion-direction-bar" className="glass flex flex-wrap items-center gap-3 rounded-[20px] p-4">
            <span data-testid="motion-direction-count" className="font-data text-xs text-[var(--cl-ink-2)]">
              {t('motionDirection.directedCount', {
                count: directedSceneCount(storyboard, draft.edits),
              })}
            </span>
            <button
              type="button"
              disabled={!draft.dirty || !draft.valid || busy}
              onClick={() => void draft.save()}
              className={SECONDARY_BUTTON_SMALL_CLASS}
            >
              {draft.saveAction.status === 'pending'
                ? t('motionDirection.saving')
                : t('motionDirection.save')}
            </button>
            {draft.dirty && (
              <StateBadge tone="orange" dot size="sm">
                {t('motionDirection.dirty')}
              </StateBadge>
            )}
            {draft.saved && !draft.dirty && (
              <span role="status">
                <StateBadge tone="green" dot size="sm">
                  {t('motionDirection.saved')}
                </StateBadge>
              </span>
            )}
          </div>

          {draft.saveAction.error !== null && <ErrorNotice error={draft.saveAction.error} />}
          {draft.regenerateAction.error !== null && <ErrorNotice error={draft.regenerateAction.error} />}
          {job !== null && <MotionJobStatus job={job} onRetried={(retried) => setJobId(retried.id)} />}
          {poll.error !== null && job === null && <ErrorNotice error={poll.error} />}

          <section className={PANEL_CLASS}>
            {groupScenesByChapter(storyboard.scenes).map((group, position) => (
              <div key={`${group.chapter ?? 'none'}-${position}`} className="flex flex-col gap-2">
                {group.chapter !== null && (
                  <h3 data-testid="motion-storyboard-chapter" className="m-0 text-sm font-bold text-[var(--cl-ink)]">
                    {group.chapter}
                  </h3>
                )}
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.scenes.map(({ scene, index }) => (
                    <SceneCard
                      key={scene.id}
                      slug={slug}
                      scene={scene}
                      index={index}
                      timing={timings.get(scene.id)}
                      direction={draft.directionOf(scene)}
                      onDirectionChange={(next) => draft.setDirection(scene.id, next)}
                    />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </>
      )}
    </MotionViewShell>
  );
}
