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
import { VoiceScriptPanel } from '../components/voice-script-panel';
import { VoiceTrigger } from '../components/voice-trigger';
import { PRODUCER_SCRIPT_PATH, VOICE_SCRIPT_MANIFEST_PATH } from '../api/generated-files';
import { parseVoiceScriptManifest } from '../api/parse-voice-script';
import type { AssetListing, VoiceDocument, VoiceTrack } from '../api/render-api-types';

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
    <div
      data-testid="voice-empty-state"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="text-sm text-slate-300">{t('voice.emptyTitle', { slug })}</p>
      <p className="text-sm text-slate-400">{t('voice.emptyBody')}</p>
      <Link
        to={`/projects/${slug}`}
        className="inline-block rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100"
      >
        {t('voice.emptyProducer')}
      </Link>
    </div>
  );
}

export function VoicePage() {
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
    <section className="space-y-6">
      <div>
        <Link to={`/projects/${slug}/library`} className="text-xs text-slate-500 hover:text-slate-300">
          {t('voice.backToLibrary')}
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
          {t('voice.title', { slug })}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('voice.descriptionBefore')}{' '}
          <Link to={`/projects/${slug}/storyboard`} className="text-sky-300 hover:text-sky-200">
            {t('voice.descriptionLink')}
          </Link>
          {t('voice.descriptionAfter')}
        </p>
      </div>

      <VoiceTrigger
        slug={slug}
        onCreated={(job) => setJobId(job.id)}
        {...(scriptMode ? { scriptPath: PRODUCER_SCRIPT_PATH } : {})}
      />

      <VoiceJobPanel jobId={jobId} onSucceeded={reload} onRetried={(job) => setJobId(job.id)} />

      {regenerateAction.error !== null && <ErrorNotice error={regenerateAction.error} />}

      {voice.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('voice.loading')}</p>
      )}

      {missing && <VoiceEmptyState slug={slug} />}

      {scriptMode && manifest !== null && <VoiceScriptPanel slug={slug} manifest={manifest} />}

      {voice.status === 'error' && voice.error !== null && !missing && (
        <ErrorNotice error={voice.error} onRetry={voice.reload} />
      )}

      {document !== null && !scriptMode && (
        <div className="space-y-3">
          <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
            {t('voice.tracksHeading')}{' '}
            <span className="text-slate-600">({document.scenes.length})</span>
          </h2>
          <ul className="space-y-3">
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
        </div>
      )}
    </section>
  );
}
