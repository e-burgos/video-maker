import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { translateProducerModel } from '../api/producer-model-i18n';
import { producerEngineLabel } from '../api/producer-engine-i18n';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from '../components/error-notice';
import type { ProducerEngineId, ProducerSettings, ProducerSettingsUpdate } from '../api/render-api-types';

const OPENROUTER_KEY_PREFIX = 'sk-or-v1-';
const OPENROUTER_KEY_MIN_LENGTH = OPENROUTER_KEY_PREFIX.length + 8;
const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';

type EngineChoice = ProducerEngineId | 'auto';
type KeyStep = 'view' | 'edit' | 'confirmRemove';

function isPlausibleOpenRouterKey(value: string): boolean {
  return value.startsWith(OPENROUTER_KEY_PREFIX) && value.length >= OPENROUTER_KEY_MIN_LENGTH;
}

export function SettingsPage() {
  const client = useRenderApi();
  const t = useT();

  const loadSettings = useCallback(() => client.getProducerSettings(), [client]);
  const settings = useAsyncResource<ProducerSettings>(loadSettings, 'producer-settings-page');
  const data = settings.data;

  const [engineChoice, setEngineChoice] = useState<EngineChoice>('auto');
  const [claudeModel, setClaudeModel] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const [keyStep, setKeyStep] = useState<KeyStep>('view');
  const [keyDraft, setKeyDraft] = useState('');
  const [keyFormatInvalid, setKeyFormatInvalid] = useState(false);

  useEffect(() => {
    if (data === null) {
      return;
    }
    setEngineChoice(data.engine ?? 'auto');
    setClaudeModel(data.models.claude ?? data.engines.claudeCli.models[0]?.id ?? '');
    setOpenrouterModel(data.models.openrouter ?? data.engines.openrouter.models[0]?.id ?? '');
    setKeyStep('view');
  }, [data]);

  const saveSettings = useApiAction((update: ProducerSettingsUpdate) =>
    client.updateProducerSettings(update),
  );
  const saveKey = useApiAction((apiKey: string) => client.putOpenRouterKey(apiKey));
  const removeKey = useApiAction(() => client.deleteOpenRouterKey());

  async function saveAll() {
    setJustSaved(false);
    const result = await saveSettings.run({
      engine: engineChoice === 'auto' ? null : engineChoice,
      models: { claude: claudeModel, openrouter: openrouterModel },
    });
    if (result !== null) {
      setJustSaved(true);
      settings.reload();
    }
  }

  async function submitKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = keyDraft;
    if (!isPlausibleOpenRouterKey(candidate)) {
      setKeyFormatInvalid(true);
      return;
    }
    setKeyFormatInvalid(false);
    setKeyDraft('');
    const result = await saveKey.run(candidate);
    if (result !== null) {
      setKeyStep('view');
      settings.reload();
    }
  }

  async function confirmRemoveKey() {
    const result = await removeKey.run();
    if (result !== null) {
      setKeyStep('view');
      settings.reload();
    }
  }

  const keyPresent = data?.engines.openrouter.keyPresent ?? false;
  const showKeyForm = keyStep === 'edit' || (keyStep === 'view' && !keyPresent);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('settings.description')}</p>
      </div>

      {settings.status === 'loading' && <p className="text-sm text-slate-500">{t('settings.loading')}</p>}

      {settings.status === 'error' && settings.error !== null && (
        <ErrorNotice error={settings.error} onRetry={settings.reload} />
      )}

      {data !== null && (
        <div className="space-y-6">
          <div
            data-testid="settings-producer-section"
            className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.producerHeading')}</h2>

            <div className="flex items-center gap-2">
              <label htmlFor="settings-engine" className="text-sm text-slate-400">
                {t('settings.engineLabel')}
              </label>
              <select
                id="settings-engine"
                aria-label={t('settings.engineLabel')}
                value={engineChoice}
                onChange={(event) => setEngineChoice(event.target.value as EngineChoice)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                <option value="auto">{t('settings.engine.auto')}</option>
                <option value="claude-cli">{producerEngineLabel(t, 'claude-cli')}</option>
                <option value="openrouter">{producerEngineLabel(t, 'openrouter')}</option>
              </select>
            </div>

            <ul data-testid="settings-engine-status" className="space-y-1 font-mono text-xs text-slate-400">
              <li data-testid="settings-engine-status-claudeCli">
                {producerEngineLabel(t, 'claude-cli')} ·{' '}
                {data.engines.claudeCli.available
                  ? t('settings.engine.available')
                  : t('settings.engine.unavailable')}
                {!data.engines.claudeCli.available && data.engines.claudeCli.reason !== null && (
                  <span className="ml-1 text-slate-500">({data.engines.claudeCli.reason})</span>
                )}
              </li>
              <li data-testid="settings-engine-status-openrouter">
                {producerEngineLabel(t, 'openrouter')} ·{' '}
                {keyPresent ? t('settings.engine.available') : t('settings.engine.unavailable')}
                {!keyPresent && (
                  <span className="ml-1 text-slate-500">({t('settings.engine.openrouterKeyMissing')})</span>
                )}
              </li>
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="settings-model-claude" className="text-sm text-slate-400">
                {t('settings.defaultModel.claude')}
              </label>
              <select
                id="settings-model-claude"
                aria-label={t('settings.defaultModel.claude')}
                value={claudeModel}
                onChange={(event) => setClaudeModel(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                {data.engines.claudeCli.models.map((option) => {
                  const translated = translateProducerModel(t, option);
                  return (
                    <option key={translated.id} value={translated.id}>
                      {translated.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="settings-model-openrouter" className="text-sm text-slate-400">
                {t('settings.defaultModel.openrouter')}
              </label>
              <select
                id="settings-model-openrouter"
                aria-label={t('settings.defaultModel.openrouter')}
                value={openrouterModel}
                onChange={(event) => setOpenrouterModel(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                {data.engines.openrouter.models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saveSettings.status === 'pending'}
                onClick={() => void saveAll()}
                className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
              >
                {saveSettings.status === 'pending' ? t('settings.saving') : t('settings.save')}
              </button>
              {justSaved && saveSettings.status !== 'pending' && (
                <span data-testid="settings-producer-saved" className="text-xs text-emerald-300">
                  {t('settings.saved')}
                </span>
              )}
            </div>

            {saveSettings.error !== null && <ErrorNotice error={saveSettings.error} />}
          </div>

          <div
            data-testid="settings-key-section"
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.key.heading')}</h2>

            {keyStep === 'view' && keyPresent && (
              <div className="flex flex-wrap items-center gap-3">
                <span data-testid="settings-key-loaded" className="font-mono text-sm text-slate-300">
                  {t('settings.key.loaded', { hint: data.engines.openrouter.keyHint ?? '' })}
                </span>
                <button
                  type="button"
                  onClick={() => setKeyStep('edit')}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {t('settings.key.replace')}
                </button>
                <button
                  type="button"
                  onClick={() => setKeyStep('confirmRemove')}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-500/60 hover:text-rose-200"
                >
                  {t('settings.key.remove')}
                </button>
              </div>
            )}

            {keyStep === 'confirmRemove' && (
              <div
                data-testid="settings-key-remove-confirm"
                className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-2"
              >
                <p className="text-xs text-rose-100">{t('settings.key.removeConfirm')}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="settings-key-remove-accept"
                    disabled={removeKey.status === 'pending'}
                    onClick={() => void confirmRemoveKey()}
                    className="rounded-md border border-rose-400/60 px-2 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {removeKey.status === 'pending' ? t('settings.key.removing') : t('settings.key.remove')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyStep('view')}
                    disabled={removeKey.status === 'pending'}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
                  >
                    {t('settings.key.removeCancel')}
                  </button>
                </div>
              </div>
            )}

            {showKeyForm && (
              <form onSubmit={submitKey} data-testid="settings-key-form" className="space-y-2">
                <label htmlFor="settings-openrouter-key" className="block text-sm text-slate-400">
                  {t('settings.key.inputLabel')}
                </label>
                <input
                  id="settings-openrouter-key"
                  type="password"
                  autoComplete="off"
                  aria-label={t('settings.key.inputLabel')}
                  value={keyDraft}
                  placeholder={t('settings.key.placeholder')}
                  onChange={(event) => {
                    setKeyDraft(event.target.value);
                    setKeyFormatInvalid(false);
                  }}
                  className="w-72 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                />
                {keyFormatInvalid && (
                  <p role="alert" className="text-xs text-amber-300">
                    {t('settings.key.formatHint')}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saveKey.status === 'pending'}
                    className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
                  >
                    {saveKey.status === 'pending' ? t('settings.saving') : t('settings.key.save')}
                  </button>
                  <a
                    href={OPENROUTER_KEYS_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-sky-300 underline hover:text-sky-200"
                  >
                    {t('settings.key.getOne')}
                  </a>
                </div>
              </form>
            )}

            {saveKey.error !== null && <ErrorNotice error={saveKey.error} />}
            {removeKey.error !== null && <ErrorNotice error={removeKey.error} />}
          </div>
        </div>
      )}
    </section>
  );
}
