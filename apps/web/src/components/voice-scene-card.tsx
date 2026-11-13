import { StateBadge } from '@e-burgos/tucu-ui';
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
import { FIELD_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

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
      className="glass-sub min-w-0 flex flex-col gap-3 rounded-[14px] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 flex min-w-0 items-baseline gap-2">
          <span className="font-data text-sm font-semibold text-[var(--cl-ink)]">
            {String(status.index).padStart(2, '0')}
          </span>
          <span className="font-data truncate text-xs text-[var(--cl-ink-3)]">{status.sceneId}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {stale && (
            <StateBadge tone="orange" dot size="sm" data-testid={`voice-stale-badge-${status.sceneId}`}>
              {t('voiceScene.staleBadge')}
            </StateBadge>
          )}
          <p data-testid={`voice-source-${status.sceneId}`} className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
            {track.source === 'uploaded'
              ? t('voiceScene.uploaded')
              : t('voiceScene.generated', { voiceId: track.voiceId ?? '' })}
          </p>
        </div>
      </div>

      {narration !== null && <p className="m-0 text-sm text-[var(--cl-ink)]">{narration}</p>}

      <audio
        controls
        preload="metadata"
        data-testid={`voice-audio-${status.sceneId}`}
        aria-label={t('voiceScene.trackLabel', { sceneId: status.sceneId })}
        src={artifactUrl(slug, track.path)}
        className="w-full"
      />

      <p data-testid={`voice-duration-${status.sceneId}`} className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
        {t('voiceScene.real', { duration: formatSeconds(track.durationMs) })}
        {estimatedDurationMs === null || delta === null
          ? t('voiceScene.noEstimate')
          : t('voiceScene.estimated', {
              estimate: formatSeconds(estimatedDurationMs),
              delta: t('voiceScene.delta', delta),
            })}
      </p>

      {stale && (
        <p data-testid={`voice-stale-${status.sceneId}`} className="m-0 text-xs text-[var(--tucu-state-orange-ink)]">
          {t('voiceScene.stale')}
        </p>
      )}

      {status.stale === null && (
        <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('voiceScene.unknownStaleness')}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onRegenerate(status.sceneId)}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t('voiceScene.regenerate')}
        </button>
      </div>

      <details className="rounded-[12px] border border-[var(--tucu-glass-sub-line)] p-3">
        <summary className="focus-cl cursor-pointer rounded-[8px] text-xs font-bold text-[var(--cl-ink)]">
          {t('voiceScene.ownRecording')}
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`take-${status.sceneId}`} className="text-xs text-[var(--cl-ink-2)]">
              {t('voiceScene.takeLabel')}
            </label>
            <select
              id={`take-${status.sceneId}`}
              aria-label={t('voiceScene.takeSelect', { sceneId: status.sceneId })}
              value={selectedTake}
              disabled={takes.length === 0}
              onChange={(event) => setPicked(event.target.value)}
              className={`${FIELD_SMALL_CLASS} font-data`}
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
              className={SECONDARY_BUTTON_SMALL_CLASS}
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
            <div className="flex flex-col gap-1">
              <ErrorNotice surface="glass" error={attachAction.error} />
              {explanationKey !== null && (
                <p
                  data-testid={`voice-attach-explanation-${status.sceneId}`}
                  className="m-0 text-sm text-[var(--tucu-state-orange-ink)]"
                >
                  {t(explanationKey)}
                </p>
              )}
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
