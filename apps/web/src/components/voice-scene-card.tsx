import { useState } from 'react';

import { artifactUrl } from '../api/artifact-url';
import { useRenderApi } from '../api/render-api-context';
import { voiceFailureKey } from '../api/voice-capability';
import { useApiAction } from '../hooks/use-api-action';
import { useT } from '../i18n/language-context';
import type { TranslationParams } from '../i18n/translate';
import type { AssetListEntry, VoiceSceneStatus, VoiceTrack } from '../api/render-api-types';
import { AssetUploader } from './asset-uploader';
import { ErrorNotice } from './error-notice';

const VOICE_ROLES = ['voice'] as const;

export function takeFileName(path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  return segments.length === 0 ? path : (segments[segments.length - 1] as string);
}

export function formatSeconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function durationDelta(
  durationMs: number,
  estimatedDurationMs: number | null,
): TranslationParams | null {
  if (estimatedDurationMs === null) {
    return null;
  }

  const deltaMs = durationMs - estimatedDurationMs;
  return {
    sign: deltaMs >= 0 ? '+' : '−',
    seconds: (Math.abs(deltaMs) / 1000).toFixed(2),
  };
}

export type VoiceSceneCardProps = {
  slug: string;
  status: VoiceSceneStatus;
  track: VoiceTrack;
  narration: string | null;
  estimatedDurationMs: number | null;
  takes: readonly string[];
  onRegenerate: (sceneId: string) => void;
  onAttached: () => void;
  onTakeUploaded: () => void;
};

export function VoiceSceneCard({
  slug,
  status,
  track,
  narration,
  estimatedDurationMs,
  takes,
  onRegenerate,
  onAttached,
  onTakeUploaded,
}: VoiceSceneCardProps) {
  const client = useRenderApi();
  const [picked, setPicked] = useState('');
  const t = useT();

  const attachAction = useApiAction((fileName: string) =>
    client.attachVoiceTake(slug, status.sceneId, fileName),
  );

  async function attach(fileName: string) {
    const written = await attachAction.run(fileName);
    if (written !== null) {
      onAttached();
    }
  }

  function attachUploaded(entry: AssetListEntry) {
    onTakeUploaded();
    void attach(takeFileName(entry.path));
  }

  const stale = status.stale === true;
  const delta = durationDelta(track.durationMs, estimatedDurationMs);
  const explanationKey =
    attachAction.error === null ? null : voiceFailureKey(attachAction.error.code);
  const selectedTake = picked === '' ? (takes[0] ?? '') : picked;

  return (
    <li
      data-testid={`voice-scene-${status.sceneId}`}
      data-voice-source={track.source}
      data-voice-stale={String(stale)}
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm text-slate-100">
          {String(status.index).padStart(2, '0')} · {status.sceneId}
        </p>
        <p data-testid={`voice-source-${status.sceneId}`} className="font-mono text-xs text-slate-400">
          {track.source === 'uploaded'
            ? t('voiceScene.uploaded')
            : t('voiceScene.generated', { voiceId: track.voiceId ?? '' })}
        </p>
      </div>

      {narration !== null && <p className="text-sm text-slate-300">{narration}</p>}

      <audio
        controls
        preload="metadata"
        data-testid={`voice-audio-${status.sceneId}`}
        aria-label={t('voiceScene.trackLabel', { sceneId: status.sceneId })}
        src={artifactUrl(slug, track.path)}
        className="w-full"
      />

      <p data-testid={`voice-duration-${status.sceneId}`} className="font-mono text-xs text-slate-400">
        {t('voiceScene.real', { duration: formatSeconds(track.durationMs) })}
        {estimatedDurationMs === null || delta === null
          ? t('voiceScene.noEstimate')
          : t('voiceScene.estimated', {
              estimate: formatSeconds(estimatedDurationMs),
              delta: t('voiceScene.delta', delta),
            })}
      </p>

      {stale && (
        <p data-testid={`voice-stale-${status.sceneId}`} className="text-xs text-amber-300">
          {t('voiceScene.stale')}
        </p>
      )}

      {status.stale === null && (
        <p className="text-xs text-slate-500">
          {t('voiceScene.unknownStaleness')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onRegenerate(status.sceneId)}
          className={`rounded-md border px-3 py-1 text-xs ${
            stale
              ? 'border-amber-400/60 bg-amber-500/10 text-amber-100'
              : 'border-slate-700 text-slate-300'
          }`}
        >
          {t('voiceScene.regenerate')}
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-slate-800 p-3">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('voiceScene.ownRecording')}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`take-${status.sceneId}`} className="text-xs text-slate-400">
            {t('voiceScene.takeLabel')}
          </label>
          <select
            id={`take-${status.sceneId}`}
            aria-label={t('voiceScene.takeSelect', { sceneId: status.sceneId })}
            value={selectedTake}
            disabled={takes.length === 0}
            onChange={(event) => setPicked(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 disabled:opacity-40"
          >
            {takes.map((take) => (
              <option key={take} value={take}>
                {take}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={selectedTake === '' || attachAction.status === 'pending'}
            onClick={() => void attach(selectedTake)}
            className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs text-sky-100 disabled:opacity-40"
          >
            {attachAction.status === 'pending' ? t('voiceScene.attaching') : t('voiceScene.useTake')}
          </button>
        </div>

        <AssetUploader
          slug={slug}
          roles={VOICE_ROLES}
          fileInputLabel={t('voiceScene.uploadTake', { sceneId: status.sceneId })}
          onUploaded={attachUploaded}
        />

        {attachAction.error !== null && (
          <div className="space-y-1">
            <ErrorNotice error={attachAction.error} />
            {explanationKey !== null && (
              <p
                data-testid={`voice-attach-explanation-${status.sceneId}`}
                className="text-sm text-amber-100"
              >
                {t(explanationKey)}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
