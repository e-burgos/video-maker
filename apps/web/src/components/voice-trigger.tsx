import { useCallback, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { voiceBlockers, voiceFailureKey } from '../api/voice-capability';
import { blockerId } from '../api/blockers';
import { useT } from '../i18n/language-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import type { ServiceHealth, VoiceJob, VoiceListing } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { VoicePicker } from './voice-picker';

export const VOICE_ALREADY_EXISTS = 'VOICE_ALREADY_EXISTS';

export type VoiceTriggerProps = {
  slug: string;
  onCreated: (job: VoiceJob) => void;
  scriptPath?: string;
};

export function defaultVoiceId(listing: VoiceListing | null): string | null {
  if (listing === null || listing.voices.length === 0) {
    return null;
  }
  return (listing.voices.find((voice) => voice.isDefault) ?? listing.voices[0])?.id ?? null;
}

export function VoiceTrigger({ slug, onCreated, scriptPath }: VoiceTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const loadVoices = useCallback(() => client.listVoices(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');
  const voices = useAsyncResource<VoiceListing>(loadVoices, 'voices');

  const [picked, setPicked] = useState<string | null>(null);
  const t = useT();

  const createAction = useApiAction((overwrite: boolean, voiceId: string | null) =>
    client.createVoiceJob(slug, {
      voiceId,
      sceneIds: null,
      overwrite,
      ...(scriptPath === undefined ? {} : { scriptPath }),
    }),
  );

  const selectedVoiceId = picked ?? defaultVoiceId(voices.data);

  async function generate(overwrite: boolean) {
    const job = await createAction.run(overwrite, selectedVoiceId);
    if (job !== null) {
      onCreated(job);
    }
  }

  const blockers = voiceBlockers(health.data);
  const catalogueEmpty = voices.data !== null && voices.data.voices.length === 0;
  const needsConfirmation = createAction.error?.code === VOICE_ALREADY_EXISTS;
  const explanationKey =
    createAction.error === null ? null : voiceFailureKey(createAction.error.code);
  const catalogueErrorKey =
    voices.error === null ? null : voiceFailureKey(voices.error.code);
  const disabled =
    blockers.length > 0 ||
    selectedVoiceId === null ||
    createAction.status === 'pending' ||
    voices.status === 'loading';

  return (
    <div
      data-testid="voice-trigger"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        {t('voice.heading')}
      </h2>
      <p className="text-sm text-slate-400">
        {scriptPath === undefined ? t('voice.triggerDescription') : t('voice.script.rerunNotice')}
      </p>

      {voices.data !== null && !catalogueEmpty && (
        <VoicePicker
          voices={voices.data.voices}
          selectedId={selectedVoiceId}
          onSelect={setPicked}
          disabled={createAction.status === 'pending'}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void generate(false)}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {scriptPath === undefined
            ? createAction.status === 'pending'
              ? t('voice.generating')
              : t('voice.generate')
            : createAction.status === 'pending'
              ? t('voice.script.regenerating')
              : t('voice.script.regenerate')}
        </button>
      </div>

      {voices.status === 'loading' && (
        <p className="text-xs text-slate-500">{t('voice.loadingCatalogue')}</p>
      )}

      {catalogueEmpty && (
        <p data-testid="voice-catalogue-empty" className="font-mono text-xs text-amber-300">
          {t('voice.catalogueEmpty')}
        </p>
      )}

      {voices.status === 'error' && voices.error !== null && (
        <div data-testid="voice-catalogue-error" className="space-y-2">
          <ErrorNotice error={voices.error} onRetry={voices.reload} />
          {catalogueErrorKey !== null && (
            <p className="text-sm text-amber-100">{t(catalogueErrorKey)}</p>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <ul data-testid="voice-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label={t('voice.overwriteTitle')}
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <p className="text-sm text-amber-100">{t('voice.overwriteWarning')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={createAction.status === 'pending'}
              className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              {t('voice.overwriteConfirm')}
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              {t('voice.overwriteKeep')}
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <div className="space-y-2">
          <ErrorNotice error={createAction.error} />
          {explanationKey !== null && (
            <p data-testid="voice-failure-explanation" className="text-sm text-amber-100">
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
