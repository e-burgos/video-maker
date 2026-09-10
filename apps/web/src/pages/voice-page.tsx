import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StoryboardDocument } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { ErrorNotice } from '../components/error-notice';
import { VoiceJobPanel } from '../components/voice-job-panel';
import { VoiceSceneCard, takeFileName } from '../components/voice-scene-card';
import { VoiceTrigger } from '../components/voice-trigger';
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
  return (
    <div
      data-testid="voice-empty-state"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="text-sm text-slate-300">
        <span className="font-mono text-slate-100">{slug}</span> has no voice-over yet.
      </p>
      <p className="text-sm text-slate-400">
        Pick a voice above and generate it: Piper reads every scene of the storyboard on this
        machine and the real duration of each track becomes the duration of its scene.
      </p>
    </div>
  );
}

export function VoicePage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();

  const loadVoice = useCallback(() => client.getVoice(slug), [client, slug]);
  const loadStoryboard = useCallback(() => client.getStoryboard(slug), [client, slug]);
  const loadAssets = useCallback(() => client.listAssets(slug), [client, slug]);

  const voice = useAsyncResource<VoiceDocument>(loadVoice, `voice:${slug}`);
  const storyboard = useAsyncResource<StoryboardDocument>(loadStoryboard, `storyboard:${slug}`);
  const assets = useAsyncResource<AssetListing>(loadAssets, `assets:${slug}`);

  const [jobId, setJobId] = useState<string | null>(null);

  const regenerateAction = useApiAction((sceneId: string, voiceId: string | null) =>
    client.createVoiceJob(slug, { voiceId, sceneIds: [sceneId], overwrite: true }),
  );

  const reload = useCallback(() => {
    voice.reload();
    assets.reload();
  }, [assets, voice]);

  const document = voice.data;
  const trackOf = (sceneId: string): VoiceTrack | undefined =>
    document?.manifest.tracks.find((track) => track.sceneId === sceneId);

  async function regenerate(sceneId: string) {
    const job = await regenerateAction.run(sceneId, trackOf(sceneId)?.voiceId ?? null);
    if (job !== null) {
      setJobId(job.id);
    }
  }

  const missing = voice.status === 'error' && voice.error?.code === VOICE_NOT_FOUND;
  const takes = recordedTakes(assets.data);

  return (
    <section className="space-y-6">
      <div>
        <Link to={`/projects/${slug}`} className="text-xs text-slate-500 hover:text-slate-300">
          ← asset library
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">{slug} · voice</h1>
        <p className="mt-1 text-sm text-slate-400">
          The voice is the clock of the video: every scene lasts what its track lasts, not what the
          model estimated. Edit the script on the{' '}
          <Link to={`/projects/${slug}/storyboard`} className="text-sky-300 hover:text-sky-200">
            storyboard page
          </Link>
          ; a scene whose narration changed is flagged here.
        </p>
      </div>

      <VoiceTrigger slug={slug} onCreated={(job) => setJobId(job.id)} />

      <VoiceJobPanel jobId={jobId} onSucceeded={reload} />

      {regenerateAction.error !== null && <ErrorNotice error={regenerateAction.error} />}

      {voice.status === 'loading' && <p className="text-sm text-slate-500">Loading voice tracks…</p>}

      {missing && <VoiceEmptyState slug={slug} />}

      {voice.status === 'error' && voice.error !== null && !missing && (
        <ErrorNotice error={voice.error} onRetry={voice.reload} />
      )}

      {document !== null && (
        <div className="space-y-3">
          <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
            tracks <span className="text-slate-600">({document.scenes.length})</span>
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
