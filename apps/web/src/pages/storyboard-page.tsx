import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { StoryboardDocument, StoryboardScene } from '@video-maker/timeline-core';

import { copyToClipboard } from '../api/clipboard';
import { PRODUCER_SCRIPT_PATH } from '../api/generated-files';
import { parseStoryboardDocument } from '../api/parse-storyboard';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT, useTn } from '../i18n/language-context';
import { ErrorNotice } from '../components/error-notice';
import { ProducerScriptPanel } from '../components/producer-script-panel';
import { MotionStoryboardView } from '../components/motion-storyboard-view';
import { ProjectModeGate } from '../components/project-mode-gate';
import { LegacySurface } from '../components/shell/legacy-surface';
import { ToolbarStatus } from '../components/shell/toolbar-status';
import { SceneList } from '../components/storyboard/scene-list';
import { sceneStatuses, sceneTimings } from '../components/storyboard/storyboard-model';
import { StoryboardCharacterSheet } from '../components/storyboard-character-sheet';
import { StoryboardHeaderEditor } from '../components/storyboard-header-editor';
import { StoryboardJobPanel } from '../components/storyboard-job-panel';
import { StoryboardPromptSheet } from '../components/storyboard-prompt-sheet';
import { StoryboardSaveBar } from '../components/storyboard-save-bar';
import { StoryboardSceneEditor } from '../components/storyboard-scene-editor';
import { StoryboardTrigger } from '../components/storyboard-trigger';

export const STORYBOARD_NOT_FOUND = 'STORYBOARD_NOT_FOUND';

type StoryboardEmptyStateProps = {
  slug: string;
};

function StoryboardEmptyState({ slug }: StoryboardEmptyStateProps) {
  const t = useT();

  return (
    <div data-testid="storyboard-empty-state" className="glass flex flex-col gap-2 rounded-[20px] p-4">
      <p className="m-0 text-sm font-semibold text-[var(--cl-ink)]">
        {t('storyboard.emptyTitle', { slug })}
      </p>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('storyboard.emptyBody')}</p>
    </div>
  );
}

function ClassicStoryboardPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(
    async () => parseStoryboardDocument(await client.getStoryboard(slug)),
    [client, slug],
  );
  const stored = useAsyncResource<StoryboardDocument>(load, `storyboard:${slug}`);
  const loadProducerScript = useCallback(
    () => client.getProjectFile(slug, PRODUCER_SCRIPT_PATH),
    [client, slug],
  );
  const producerScript = useAsyncResource<string>(loadProducerScript, `producer-script:${slug}`);

  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoryboardDocument | null>(null);
  const [saved, setSaved] = useState<StoryboardDocument | null>(null);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const t = useT();
  const tn = useTn();

  const baseline = saved ?? stored.data;
  const storyboard = draft ?? baseline;
  const dirty = draft !== null && baseline !== null && JSON.stringify(draft) !== JSON.stringify(baseline);

  const reload = useCallback(() => {
    setDraft(null);
    setSaved(null);
    stored.reload();
  }, [stored]);

  async function copyScenePrompt(scene: StoryboardScene) {
    const copied = await copyToClipboard(scene.visualPrompt);
    setCopiedSceneId(copied ? scene.id : null);
  }

  const timings = useMemo(() => sceneTimings(storyboard?.scenes ?? []), [storyboard]);
  const statuses = useMemo(
    () => (storyboard === null ? new Map() : sceneStatuses(storyboard, baseline)),
    [storyboard, baseline],
  );
  const selectedScene =
    storyboard?.scenes.find((scene) => scene.id === selectedSceneId) ?? storyboard?.scenes[0];

  const missing =
    stored.status === 'error' && stored.error?.code === STORYBOARD_NOT_FOUND && saved === null;
  const script = producerScript.data;

  return (
    <section data-testid="storyboard-page" className="flex min-h-full flex-col gap-4">
      <StoryboardTrigger
        slug={slug}
        hasStoryboard={storyboard !== null}
        onCreated={(job) => setJobId(job.id)}
      />

      <StoryboardJobPanel jobId={jobId} onSucceeded={reload} onRetried={(job) => setJobId(job.id)} />

      {stored.status === 'loading' && (
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('storyboard.loading')}</p>
      )}

      {missing && script !== null && <ProducerScriptPanel script={script} />}

      {missing && script === null && <StoryboardEmptyState slug={slug} />}

      {stored.status === 'error' && stored.error !== null && !missing && (
        <ErrorNotice surface="glass" error={stored.error} onRetry={reload} />
      )}

      {storyboard !== null && selectedScene !== undefined && (
        <>
          <ToolbarStatus>
            <StateBadge tone="teal" dot size="sm" data-testid="storyboard-scene-count">
              {tn('storyboard.sceneCount', storyboard.scenes.length)}
            </StateBadge>
          </ToolbarStatus>

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[17rem_minmax(0,1fr)]">
            <SceneList
              scenes={storyboard.scenes}
              selectedId={selectedScene.id}
              statuses={statuses}
              timings={timings}
              onSelect={setSelectedSceneId}
            />

            <div className="flex min-w-0 flex-col gap-4">
              <StoryboardSceneEditor
                key={selectedScene.id}
                storyboard={storyboard}
                scene={selectedScene}
                {...(timings.has(selectedScene.id) ? { timing: timings.get(selectedScene.id) } : {})}
                onChange={setDraft}
                onCopyPrompt={(target) => void copyScenePrompt(target)}
              />

              {copiedSceneId !== null && (
                <p
                  data-testid="storyboard-scene-copied"
                  className="m-0 text-xs text-[var(--tucu-state-green-ink)]"
                >
                  {t('storyboard.promptCopied', { sceneId: copiedSceneId })}
                </p>
              )}

              <StoryboardHeaderEditor storyboard={storyboard} onChange={setDraft} />

              <StoryboardCharacterSheet storyboard={storyboard} onChange={setDraft} />

              {script !== null && (
                <ProducerScriptPanel
                  script={script}
                  defaultOpen={false}
                  explainsMissingStoryboard={false}
                />
              )}

              <StoryboardPromptSheet slug={slug} dirty={dirty} />
            </div>
          </div>

          <StoryboardSaveBar
            slug={slug}
            storyboard={storyboard}
            dirty={dirty}
            onSaved={(next) => {
              setSaved(next);
              setDraft(null);
            }}
            onDiscard={() => setDraft(null)}
          />
        </>
      )}
    </section>
  );
}

export function StoryboardPage() {
  const { slug = '' } = useParams<{ slug: string }>();

  return (
    <ProjectModeGate
      slug={slug}
      footage={<ClassicStoryboardPage />}
      motion={
        <LegacySurface>
          <MotionStoryboardView slug={slug} />
        </LegacySurface>
      }
    />
  );
}
