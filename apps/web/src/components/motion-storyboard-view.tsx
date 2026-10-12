import { useEffect, useRef, useState } from 'react';
import type { VoiceDirection } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { directedSceneCount } from '../api/motion-storyboard-draft';
import { motionImagePath, motionPropEntries } from '../api/motion-scene-props';
import type { MotionPropValue } from '../api/motion-scene-props';
import type { MotionOverviewScene, MotionScene, MotionStoryboard } from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import { hasDirection } from '../api/voice-direction';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useMotionStoryboardDraft } from '../hooks/use-motion-storyboard-draft';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { MotionJobStatus } from './motion-job-status';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';
import { MusicModeFields } from './music-mode-fields';
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
      className="space-y-2 rounded-panel border border-border-subtle bg-surface-raised/40 p-3"
    >
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-faint">
        <span>{index + 1}</span>
        <span>{scene.kind}</span>
        {hasDirection(direction) && (
          <span
            data-testid="motion-direction-badge"
            className="rounded-full border border-accent px-2 py-0.5 text-accent-strong"
          >
            {t('voiceDirection.badge')}
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

          {draft.music !== null && (
            <div className="rounded-panel border border-border-subtle p-4">
              <MusicModeFields
                mode={draft.music.mode}
                floorText={draft.music.floorText}
                onModeChange={draft.setMusicMode}
                onFloorTextChange={draft.setFloorText}
              />
            </div>
          )}

          <div
            data-testid="motion-direction-bar"
            className="flex flex-wrap items-center gap-3 rounded-panel border border-border-subtle p-3"
          >
            <span data-testid="motion-direction-count" className="font-mono text-xs text-ink-faint">
              {t('motionDirection.directedCount', {
                count: directedSceneCount(storyboard, draft.edits),
              })}
            </span>
            <button
              type="button"
              disabled={!draft.dirty || !draft.valid || busy}
              onClick={() => void draft.save()}
              className="rounded-control border border-border-strong px-3 py-1.5 text-sm text-ink disabled:opacity-40"
            >
              {draft.saveAction.status === 'pending'
                ? t('motionDirection.saving')
                : t('motionDirection.save')}
            </button>
            <button
              type="button"
              disabled={!draft.valid || busy}
              onClick={() => void draft.regenerate()}
              className="rounded-control border border-accent px-3 py-1.5 text-sm text-ink disabled:opacity-40"
            >
              {draft.regenerateAction.status === 'pending'
                ? t('motionDirection.regenerating')
                : t('motionDirection.regenerate')}
            </button>
            {draft.dirty && (
              <span className="text-xs text-warning">{t('motionDirection.dirty')}</span>
            )}
            {draft.saved && !draft.dirty && (
              <span role="status" className="text-xs text-success">
                {t('motionDirection.saved')}
              </span>
            )}
          </div>

          {draft.saveAction.error !== null && <ErrorNotice error={draft.saveAction.error} />}
          {draft.regenerateAction.error !== null && <ErrorNotice error={draft.regenerateAction.error} />}
          {job !== null && <MotionJobStatus job={job} onRetried={(retried) => setJobId(retried.id)} />}
          {poll.error !== null && job === null && <ErrorNotice error={poll.error} />}

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
                    direction={draft.directionOf(scene)}
                    onDirectionChange={(next) => draft.setDirection(scene.id, next)}
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
