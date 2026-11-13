import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StoryboardDocument, VoiceScriptManifest } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from '../components/error-notice';
import { VoiceJobPanel } from '../components/voice-job-panel';
import { VoiceSceneCard, takeFileName } from '../components/voice-scene-card';
import { VoiceScriptSection } from '../components/voice-script-section';
import { VoiceTrigger } from '../components/voice-trigger';
import { PRODUCER_SCRIPT_PATH, VOICE_SCRIPT_MANIFEST_PATH } from '../api/generated-files';
import { parseVoiceScriptManifest } from '../api/parse-voice-script';
import type { AssetListing, VoiceDocument, VoiceTrack } from '../api/render-api-types';
import { MotionVoiceView } from '../components/motion-voice-view';
import { ProjectModeGate } from '../components/project-mode-gate';
import { PRIMARY_BUTTON_SMALL_CLASS } from '../components/ui/cl-controls';

export const VOICE_NOT_FOUND = 'VOICE_NOT_FOUND';

export function recordedTakes(listing: AssetListing | null): string[] {
  if (listing === null) {
    return [];
  }

  return listing.assets
    .filter((asset) => asset.role === 'voice')
    .map((asset) => takeFileName(asset.path))
    .sort();
}

function VoiceEmptyState({ slug }: { slug: string }) {
  const t = useT();

  return (
    <div data-testid="voice-empty-state" className="glass flex flex-col gap-2 rounded-[20px] p-4">
      <p className="m-0 text-sm font-semibold text-[var(--cl-ink)]">{t('voice.emptyTitle', { slug })}</p>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('voice.emptyBody')}</p>
      <Link to={`/projects/${slug}`} className={`${PRIMARY_BUTTON_SMALL_CLASS} no-underline`}>
        {t('voice.emptyProducer')}
      </Link>
    </div>
  );
}

function ClassicVoicePage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();

  const loadVoice = useCallback(() => client.getVoice(slug), [client, slug]);
  const loadStoryboard = useCallback(() => client.getStoryboard(slug), [client, slug]);
  const loadAssets = useCallback(() => client.listAssets(slug), [client, slug]);

  const loadScriptManifest = useCallback(
    async () => parseVoiceScriptManifest(await client.getProjectFile(slug, VOICE_SCRIPT_MANIFEST_PATH)),
    [client, slug],
  );

  const voice = useAsyncResource<VoiceDocument>(loadVoice, `voice:${slug}`);
  const storyboard = useAsyncResource<StoryboardDocument>(loadStoryboard, `storyboard:${slug}`);
  const assets = useAsyncResource<AssetListing>(loadAssets, `assets:${slug}`);
  const scriptManifest = useAsyncResource<VoiceScriptManifest | null>(
    loadScriptManifest,
    `voice-script:${slug}`,
  );

  const [jobId, setJobId] = useState<string | null>(null);

  const regenerateAction = useApiAction((sceneId: string, voiceId: string | null) =>
    client.createVoiceJob(slug, { voiceId, sceneIds: [sceneId], overwrite: true }),
  );

  const reload = useCallback(() => {
    voice.reload();
    assets.reload();
    scriptManifest.reload();
  }, [assets, scriptManifest, voice]);

  const document = voice.data;
  const trackOf = (sceneId: string): VoiceTrack | undefined =>
    document?.manifest.tracks.find((track) => track.sceneId === sceneId);

  async function regenerate(sceneId: string) {
    const job = await regenerateAction.run(sceneId, trackOf(sceneId)?.voiceId ?? null);
    if (job !== null) {
      setJobId(job.id);
    }
  }

  const takes = recordedTakes(assets.data);
  const manifest = scriptManifest.data;
  const scriptMode = storyboard.data === null && manifest !== null;
  const missing = !scriptMode && voice.status === 'error' && voice.error?.code === VOICE_NOT_FOUND;

  return (
    <section data-testid="voice-page" className="flex flex-col gap-4">
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">
        {t('voice.descriptionBefore')}{' '}
        <Link
          to={`/projects/${slug}/storyboard`}
          className="font-semibold text-[var(--cl-action-text)] underline"
        >
          {t('voice.descriptionLink')}
        </Link>
        {t('voice.descriptionAfter')}
      </p>

      <VoiceTrigger
        slug={slug}
        hasVoice={document !== null}
        onCreated={(job) => setJobId(job.id)}
        {...(scriptMode ? { scriptPath: PRODUCER_SCRIPT_PATH } : {})}
      />

      <VoiceJobPanel jobId={jobId} onSucceeded={reload} onRetried={(job) => setJobId(job.id)} />

      {regenerateAction.error !== null && (
        <ErrorNotice surface="glass" error={regenerateAction.error} />
      )}

      {voice.status === 'loading' && (
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('voice.loading')}</p>
      )}

      {missing && <VoiceEmptyState slug={slug} />}

      {scriptMode && manifest !== null && (
        <VoiceScriptSection slug={slug} manifest={manifest} onJobCreated={(job) => setJobId(job.id)} />
      )}

      {voice.status === 'error' && voice.error !== null && !missing && (
        <ErrorNotice surface="glass" error={voice.error} onRetry={voice.reload} />
      )}

      {document !== null && !scriptMode && (
        <section data-testid="voice-takes" className="glass flex flex-col gap-3 rounded-[20px] p-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-[var(--cl-ink)]">
            {t('voice.tracksHeading')}
            <StateBadge tone="neutral" size="sm">
              {document.scenes.length}
            </StateBadge>
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 min-[1100px]:grid-cols-2">
            {document.scenes.map((status) => {
              const track = trackOf(status.sceneId);
              if (track === undefined) {
                return null;
              }
              const scene = storyboard.data?.scenes.find(
                (candidate) => candidate.id === status.sceneId,
              );

              return (
                <VoiceSceneCard
                  key={status.sceneId}
                  slug={slug}
                  status={status}
                  track={track}
                  narration={scene?.narration ?? null}
                  estimatedDurationMs={scene?.estimatedDurationMs ?? null}
                  takes={takes}
                  onRegenerate={(sceneId) => void regenerate(sceneId)}
                  onAttached={reload}
                  onTakeUploaded={assets.reload}
                />
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

export function VoicePage() {
  const { slug = '' } = useParams<{ slug: string }>();

  return (
    <ProjectModeGate
      slug={slug}
      footage={<ClassicVoicePage />}
      motion={<MotionVoiceView slug={slug} />}
    />
  );
}
