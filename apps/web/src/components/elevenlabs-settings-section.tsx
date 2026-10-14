import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
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
    <div
      data-testid="settings-elevenlabs-section"
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-lg font-semibold text-slate-100">{t('settings.eleven.heading')}</h2>
      <p className="text-sm text-slate-400">{t('settings.eleven.note')}</p>

      {settings.status === 'loading' && <p className="text-sm text-slate-500">{t('settings.eleven.loading')}</p>}
      {settings.status === 'error' && settings.error !== null && (
        <ErrorNotice error={settings.error} onRetry={settings.reload} />
      )}

      {data !== null && (
        <>
          {keyStep === 'view' && keyConfigured && (
            <div className="flex flex-wrap items-center gap-3">
              <span data-testid="settings-elevenlabs-key-loaded" className="font-mono text-sm text-slate-300">
                {tier === null
                  ? t('settings.eleven.keyLoadedNoTier')
                  : t('settings.eleven.keyLoaded', { tier })}
              </span>
              <button
                type="button"
                onClick={() => setKeyStep('edit')}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
              >
                {t('settings.eleven.keyReplace')}
              </button>
              <button
                type="button"
                onClick={() => setKeyStep('confirmRemove')}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-500/60 hover:text-rose-200"
              >
                {t('settings.eleven.keyRemove')}
              </button>
            </div>
          )}

          {keyStep === 'confirmRemove' && (
            <div className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">
              <p className="text-xs text-rose-100">{t('settings.eleven.keyRemoveConfirm')}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="settings-elevenlabs-key-remove-accept"
                  disabled={removeKey.status === 'pending'}
                  onClick={() => void confirmRemoveKey()}
                  className="rounded-md border border-rose-400/60 px-2 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {t('settings.eleven.keyRemove')}
                </button>
                <button
                  type="button"
                  onClick={() => setKeyStep('view')}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {t('settings.eleven.keyRemoveCancel')}
                </button>
              </div>
            </div>
          )}

          {showKeyForm && (
            <form onSubmit={submitKey} data-testid="settings-elevenlabs-key-form" className="space-y-2">
              {!keyConfigured && <p className="text-xs text-slate-500">{t('settings.eleven.keyMissing')}</p>}
              <label htmlFor="settings-elevenlabs-key" className="block text-sm text-slate-400">
                {t('settings.eleven.keyLabel')}
              </label>
              <input
                id="settings-elevenlabs-key"
                type="password"
                autoComplete="off"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                className="w-72 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100"
              />
              <div>
                <button
                  type="submit"
                  disabled={saveKey.status === 'pending'}
                  className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
                >
                  {t('settings.eleven.keySave')}
                </button>
              </div>
            </form>
          )}

          {saveKey.error !== null && <ErrorNotice error={saveKey.error} />}
          {removeKey.error !== null && <ErrorNotice error={removeKey.error} />}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">{t('settings.eleven.voicesHeading')}</h3>
            {voices.length === 0 ? (
              <p className="text-xs text-slate-500">{t('settings.eleven.voicesEmpty')}</p>
            ) : (
              <ul data-testid="settings-elevenlabs-voices" className="space-y-1">
                {voices.map((voice) => (
                  <li
                    key={voice.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-800 px-3 py-2"
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm text-slate-100">{voice.label}</span>
                      {voice.description !== '' && (
                        <span className="block text-xs text-slate-400">{voice.description}</span>
                      )}
                      <span className="block font-mono text-xs text-slate-500">{voice.id}</span>
                    </span>
                    <button
                      type="button"
                      disabled={saveVoices.status === 'pending'}
                      aria-label={t('settings.eleven.voiceRemove', { label: voice.label })}
                      onClick={() => void persistVoices(voices.filter((entry) => entry.id !== voice.id))}
                      className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-500/60 hover:text-rose-200"
                    >
                      {t('settings.eleven.keyRemove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addVoice} className="flex flex-wrap items-end gap-2">
              <input
                aria-label={t('settings.eleven.voiceId')}
                placeholder={t('settings.eleven.voiceId')}
                value={voiceIdDraft}
                onChange={(event) => setVoiceIdDraft(event.target.value)}
                className="w-56 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 placeholder:text-slate-600"
              />
              <input
                aria-label={t('settings.eleven.voiceName')}
                placeholder={t('settings.eleven.voiceName')}
                value={voiceNameDraft}
                onChange={(event) => setVoiceNameDraft(event.target.value)}
                className="w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={saveVoices.status === 'pending'}
                className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
              >
                {t('settings.eleven.voiceAdd')}
              </button>
            </form>
            {saveVoices.error !== null && <ErrorNotice error={saveVoices.error} />}
          </div>
        </>
      )}
    </div>
  );
}
