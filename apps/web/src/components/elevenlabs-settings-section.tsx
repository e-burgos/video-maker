import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { SettingsPanel } from './settings/settings-panel';
import { ErrorNotice } from './error-notice';
import {
  DANGER_BUTTON_SMALL_CLASS,
  DANGER_NOTICE_CLASS,
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  HINT_TEXT_CLASS,
  ROW_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
} from './ui/cl-controls';
import type { ElevenLabsVoiceEntry } from '../api/render-api-types';

type KeyStep = 'view' | 'edit' | 'confirmRemove';

export function ElevenLabsSettingsSection() {
  const client = useRenderApi();
  const t = useT();
  const settings = useAsyncResource(
    useCallback(() => client.getElevenLabsSettings(), [client]),
    'elevenlabs-settings',
  );
  const data = settings.data;

  const [keyStep, setKeyStep] = useState<KeyStep>('view');
  const [keyDraft, setKeyDraft] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const [voiceIdDraft, setVoiceIdDraft] = useState('');
  const [voiceNameDraft, setVoiceNameDraft] = useState('');

  const saveKey = useApiAction((key: string) => client.putElevenLabsKey(key));
  const removeKey = useApiAction(() => client.deleteElevenLabsKey());
  const saveVoices = useApiAction((voices: ElevenLabsVoiceEntry[]) => client.putElevenLabsVoices(voices));

  const keyConfigured = data?.keyConfigured ?? false;
  const voices = data?.voices ?? [];
  const showKeyForm = keyStep === 'edit' || (keyStep === 'view' && !keyConfigured);

  async function submitKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = keyDraft.trim();
    if (candidate === '') {
      return;
    }
    setKeyDraft('');
    const result = await saveKey.run(candidate);
    if (result !== null) {
      setTier(result.tier);
      setKeyStep('view');
      settings.reload();
    }
  }

  async function confirmRemoveKey() {
    const result = await removeKey.run();
    if (result !== null) {
      setTier(null);
      setKeyStep('view');
      settings.reload();
    }
  }

  async function persistVoices(next: ElevenLabsVoiceEntry[]) {
    const result = await saveVoices.run(next);
    if (result !== null) {
      settings.reload();
    }
    return result !== null;
  }

  async function addVoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = voiceIdDraft.trim();
    const label = voiceNameDraft.trim();
    if (id === '' || label === '' || voices.some((voice) => voice.id === id)) {
      return;
    }
    const saved = await persistVoices([...voices, { id, label, description: '' }]);
    if (saved) {
      setVoiceIdDraft('');
      setVoiceNameDraft('');
    }
  }

  return (
    <SettingsPanel
      testId="settings-elevenlabs-section"
      heading={t('settings.eleven.heading')}
      description={t('settings.eleven.note')}
    >
      {settings.status === 'loading' && <p className={HINT_TEXT_CLASS}>{t('settings.eleven.loading')}</p>}
      {settings.status === 'error' && settings.error !== null && (
        <ErrorNotice error={settings.error} onRetry={settings.reload} />
      )}

      {data !== null && (
        <>
          {keyStep === 'view' && keyConfigured && (
            <div className={`${ROW_CLASS} justify-between`}>
              <span data-testid="settings-elevenlabs-key-loaded" className="font-data text-sm text-[var(--cl-ink)]">
                {tier === null
                  ? t('settings.eleven.keyLoadedNoTier')
                  : t('settings.eleven.keyLoaded', { tier })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setKeyStep('edit')} className={SECONDARY_BUTTON_SMALL_CLASS}>
                  {t('settings.eleven.keyReplace')}
                </button>
                <button type="button" onClick={() => setKeyStep('confirmRemove')} className={SECONDARY_BUTTON_SMALL_CLASS}>
                  {t('settings.eleven.keyRemove')}
                </button>
              </div>
            </div>
          )}

          {keyStep === 'confirmRemove' && (
            <div className={DANGER_NOTICE_CLASS}>
              <p className="m-0 text-xs text-[var(--cl-ink)]">{t('settings.eleven.keyRemoveConfirm')}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="settings-elevenlabs-key-remove-accept"
                  disabled={removeKey.status === 'pending'}
                  onClick={() => void confirmRemoveKey()}
                  className={DANGER_BUTTON_SMALL_CLASS}
                >
                  {t('settings.eleven.keyRemove')}
                </button>
                <button type="button" onClick={() => setKeyStep('view')} className={SECONDARY_BUTTON_SMALL_CLASS}>
                  {t('settings.eleven.keyRemoveCancel')}
                </button>
              </div>
            </div>
          )}

          {showKeyForm && (
            <form onSubmit={submitKey} data-testid="settings-elevenlabs-key-form" className="flex flex-col gap-2">
              {!keyConfigured && <p className={HINT_TEXT_CLASS}>{t('settings.eleven.keyMissing')}</p>}
              <label htmlFor="settings-elevenlabs-key" className={FIELD_LABEL_CLASS}>
                {t('settings.eleven.keyLabel')}
              </label>
              <input
                id="settings-elevenlabs-key"
                type="password"
                autoComplete="off"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                className={`${FIELD_CLASS} font-data w-full`}
              />
              <div>
                <button type="submit" disabled={saveKey.status === 'pending'} className={SECONDARY_BUTTON_CLASS}>
                  {t('settings.eleven.keySave')}
                </button>
              </div>
            </form>
          )}

          {saveKey.error !== null && <ErrorNotice error={saveKey.error} />}
          {removeKey.error !== null && <ErrorNotice error={removeKey.error} />}

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-[var(--cl-ink)]">{t('settings.eleven.voicesHeading')}</h3>
            {voices.length === 0 ? (
              <p className={HINT_TEXT_CLASS}>{t('settings.eleven.voicesEmpty')}</p>
            ) : (
              <ul data-testid="settings-elevenlabs-voices" className="m-0 flex list-none flex-col gap-2 p-0">
                {voices.map((voice) => (
                  <li key={voice.id} className={`${ROW_CLASS} flex-nowrap items-start justify-between`}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[var(--cl-ink)]">{voice.label}</span>
                      {voice.description !== '' && (
                        <span className="text-xs text-[var(--cl-ink-2)]">{voice.description}</span>
                      )}
                      <span className="font-data break-all text-xs text-[var(--cl-ink-3)]">{voice.id}</span>
                    </span>
                    <button
                      type="button"
                      disabled={saveVoices.status === 'pending'}
                      aria-label={t('settings.eleven.voiceRemove', { label: voice.label })}
                      onClick={() => void persistVoices(voices.filter((entry) => entry.id !== voice.id))}
                      className={`${SECONDARY_BUTTON_SMALL_CLASS} shrink-0`}
                    >
                      {t('settings.eleven.keyRemove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addVoice} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t('settings.eleven.voiceId')}
                placeholder={t('settings.eleven.voiceId')}
                value={voiceIdDraft}
                onChange={(event) => setVoiceIdDraft(event.target.value)}
                className={`${FIELD_CLASS} font-data min-w-[10rem] flex-1`}
              />
              <input
                aria-label={t('settings.eleven.voiceName')}
                placeholder={t('settings.eleven.voiceName')}
                value={voiceNameDraft}
                onChange={(event) => setVoiceNameDraft(event.target.value)}
                className={`${FIELD_CLASS} min-w-[8rem] flex-1`}
              />
              <button type="submit" disabled={saveVoices.status === 'pending'} className={SECONDARY_BUTTON_CLASS}>
                {t('settings.eleven.voiceAdd')}
              </button>
            </form>
            {saveVoices.error !== null && <ErrorNotice error={saveVoices.error} />}
          </div>
        </>
      )}
    </SettingsPanel>
  );
}
