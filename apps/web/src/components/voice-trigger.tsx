import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { voiceBlockers, voiceFailureKey } from '../api/voice-capability';
import { blockerId } from '../api/blockers';
import { useT } from '../i18n/language-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useProjectBrandVoice } from '../hooks/use-project-brand-voice';
import type { ServiceHealth, VoiceJob, VoiceListing } from '../api/render-api-types';
import { ErrorNotice } from './error-notice';
import { ToolbarStatus } from './shell/toolbar-status';
import { useToolbarAction } from './shell/use-toolbar-action';
import { DANGER_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { VoicePicker } from './voice-picker';

export const VOICE_ALREADY_EXISTS = 'VOICE_ALREADY_EXISTS';

export type VoiceTriggerProps = {
  slug: string;
  onCreated: (job: VoiceJob) => void;
  scriptPath?: string;
  hasVoice?: boolean;
};

export function defaultVoiceId(listing: VoiceListing | null): string | null {
  if (listing === null || listing.voices.length === 0) {
    return null;
  }
  return (listing.voices.find((voice) => voice.isDefault) ?? listing.voices[0])?.id ?? null;
}

export function brandVoiceIdIn(listing: VoiceListing | null, brandVoiceId: string | null): string | null {
  if (listing === null || brandVoiceId === null) {
    return null;
  }
  return listing.voices.some((voice) => voice.id === brandVoiceId) ? brandVoiceId : null;
}

export function VoiceTrigger({ slug, onCreated, scriptPath, hasVoice = false }: VoiceTriggerProps) {
  const client = useRenderApi();
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const loadVoices = useCallback(() => client.listVoices(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'health');
  const voices = useAsyncResource<VoiceListing>(loadVoices, 'voices');

  const [picked, setPicked] = useState<string | null>(null);
  const brandVoice = useProjectBrandVoice(slug);
  const t = useT();

  const createAction = useApiAction((overwrite: boolean, voiceId: string | null) =>
    client.createVoiceJob(slug, {
      voiceId,
      sceneIds: null,
      overwrite,
      ...(scriptPath === undefined ? {} : { scriptPath }),
    }),
  );

  const installedBrandVoiceId = brandVoiceIdIn(voices.data, brandVoice?.id ?? null);
  const selectedVoiceId = picked ?? installedBrandVoiceId ?? defaultVoiceId(voices.data);
  const voiceIdToSend = picked === null && installedBrandVoiceId !== null ? null : selectedVoiceId;

  async function generate(overwrite: boolean) {
    const job = await createAction.run(overwrite, voiceIdToSend);
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
  const pending = createAction.status === 'pending';
  const disabled =
    blockers.length > 0 ||
    selectedVoiceId === null ||
    pending ||
    voices.status === 'loading';
  const regenerates = scriptPath !== undefined || hasVoice;
  const selectedVoice = voices.data?.voices.find((voice) => voice.id === selectedVoiceId);

  useToolbarAction({
    label: pending
      ? scriptPath === undefined
        ? t('voice.generating')
        : t('voice.script.regenerating')
      : regenerates
        ? t('voice.script.regenerate')
        : t('voice.generate'),
    onClick: () => void generate(false),
    disabled,
    loading: pending,
  });

  return (
    <section data-testid="voice-trigger" className="glass flex flex-col gap-3 rounded-[20px] p-4">
      {selectedVoice !== undefined && (
        <ToolbarStatus>
          <StateBadge tone="green" dot size="sm" data-testid="voice-toolbar-selected">
            {selectedVoice.label}
          </StateBadge>
        </ToolbarStatus>
      )}
      <h2 className="m-0 text-base font-bold text-[var(--cl-ink)]">{t('voice.heading')}</h2>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">
        {scriptPath === undefined ? t('voice.triggerDescription') : t('voice.script.rerunNotice')}
      </p>

      {voices.data !== null && !catalogueEmpty && (
        <VoicePicker
          voices={voices.data.voices}
          selectedId={selectedVoiceId}
          onSelect={setPicked}
          disabled={pending}
        />
      )}

      {voices.status === 'loading' && (
        <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('voice.loadingCatalogue')}</p>
      )}

      {catalogueEmpty && (
        <p
          data-testid="voice-catalogue-empty"
          className="font-data m-0 text-xs text-[var(--tucu-state-orange-ink)]"
        >
          {t('voice.catalogueEmpty')}
        </p>
      )}

      {voices.status === 'error' && voices.error !== null && (
        <div data-testid="voice-catalogue-error" className="flex flex-col gap-2">
          <ErrorNotice error={voices.error} onRetry={voices.reload} />
          {catalogueErrorKey !== null && (
            <p className="m-0 text-sm text-[var(--tucu-state-orange-ink)]">{t(catalogueErrorKey)}</p>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <ul
          data-testid="voice-blockers"
          className="font-data m-0 list-none flex flex-col gap-0.5 p-0 text-xs text-[var(--tucu-state-orange-ink)]"
        >
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {needsConfirmation && (
        <div
          role="alertdialog"
          aria-label={t('voice.overwriteTitle')}
          className="flex flex-col gap-2 rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
        >
          <p className="m-0 text-sm text-[var(--cl-ink)]">{t('voice.overwriteWarning')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={pending}
              className={DANGER_BUTTON_SMALL_CLASS}
            >
              {t('voice.overwriteConfirm')}
            </button>
            <button
              type="button"
              onClick={createAction.reset}
              className={SECONDARY_BUTTON_SMALL_CLASS}
            >
              {t('voice.overwriteKeep')}
            </button>
          </div>
        </div>
      )}

      {createAction.error !== null && !needsConfirmation && (
        <div className="flex flex-col gap-2">
          <ErrorNotice error={createAction.error} />
          {explanationKey !== null && (
            <p
              data-testid="voice-failure-explanation"
              className="m-0 text-sm text-[var(--tucu-state-orange-ink)]"
            >
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
