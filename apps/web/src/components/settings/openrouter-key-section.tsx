import { useState } from 'react';
import type { FormEvent } from 'react';

import { useRenderApi } from '../../api/render-api-context';
import { useApiAction } from '../../hooks/use-api-action';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import {
  DANGER_BUTTON_SMALL_CLASS,
  DANGER_NOTICE_CLASS,
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  LINK_CLASS,
  ROW_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
  WARNING_TEXT_CLASS,
} from '../ui/cl-controls';
import { SettingsPanel } from './settings-panel';

const OPENROUTER_KEY_PREFIX = 'sk-or-v1-';
const OPENROUTER_KEY_MIN_LENGTH = OPENROUTER_KEY_PREFIX.length + 8;
const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';

type KeyStep = 'view' | 'edit' | 'confirmRemove';

function isPlausibleOpenRouterKey(value: string): boolean {
  return value.startsWith(OPENROUTER_KEY_PREFIX) && value.length >= OPENROUTER_KEY_MIN_LENGTH;
}

export type OpenRouterKeySectionProps = {
  keyPresent: boolean;
  keyHint: string | null;
  onChanged: () => void;
};

export function OpenRouterKeySection({ keyPresent, keyHint, onChanged }: OpenRouterKeySectionProps) {
  const client = useRenderApi();
  const t = useT();
  const [keyStep, setKeyStep] = useState<KeyStep>('view');
  const [keyDraft, setKeyDraft] = useState('');
  const [keyFormatInvalid, setKeyFormatInvalid] = useState(false);
  const saveKey = useApiAction((apiKey: string) => client.putOpenRouterKey(apiKey));
  const removeKey = useApiAction(() => client.deleteOpenRouterKey());

  const showKeyForm = keyStep === 'edit' || (keyStep === 'view' && !keyPresent);
  const removing = removeKey.status === 'pending';

  async function submitKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = keyDraft;
    if (!isPlausibleOpenRouterKey(candidate)) {
      setKeyFormatInvalid(true);
      return;
    }
    setKeyFormatInvalid(false);
    setKeyDraft('');
    if ((await saveKey.run(candidate)) !== null) {
      setKeyStep('view');
      onChanged();
    }
  }

  async function confirmRemoveKey() {
    if ((await removeKey.run()) !== null) {
      setKeyStep('view');
      onChanged();
    }
  }

  return (
    <SettingsPanel testId="settings-key-section" heading={t('settings.key.heading')} description={t('settings.key.note')}>
      {keyStep === 'view' && keyPresent && (
        <div className={`${ROW_CLASS} justify-between`}>
          <span data-testid="settings-key-loaded" className="font-data min-w-0 break-all text-sm text-[var(--cl-ink)]">
            {t('settings.key.loaded', { hint: keyHint ?? '' })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setKeyStep('edit')} className={SECONDARY_BUTTON_SMALL_CLASS}>
              {t('settings.key.replace')}
            </button>
            <button type="button" onClick={() => setKeyStep('confirmRemove')} className={SECONDARY_BUTTON_SMALL_CLASS}>
              {t('settings.key.remove')}
            </button>
          </div>
        </div>
      )}

      {keyStep === 'confirmRemove' && (
        <div data-testid="settings-key-remove-confirm" className={DANGER_NOTICE_CLASS}>
          <p className="m-0 text-xs text-[var(--cl-ink)]">{t('settings.key.removeConfirm')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="settings-key-remove-accept"
              disabled={removing}
              onClick={() => void confirmRemoveKey()}
              className={DANGER_BUTTON_SMALL_CLASS}
            >
              {removing ? t('settings.key.removing') : t('settings.key.remove')}
            </button>
            <button
              type="button"
              onClick={() => setKeyStep('view')}
              disabled={removing}
              className={SECONDARY_BUTTON_SMALL_CLASS}
            >
              {t('settings.key.removeCancel')}
            </button>
          </div>
        </div>
      )}

      {showKeyForm && (
        <form onSubmit={submitKey} data-testid="settings-key-form" className="flex flex-col gap-2">
          <label htmlFor="settings-openrouter-key" className={FIELD_LABEL_CLASS}>
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
            className={`${FIELD_CLASS} font-data w-full`}
          />
          {keyFormatInvalid && (
            <p role="alert" className={WARNING_TEXT_CLASS}>
              {t('settings.key.formatHint')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saveKey.status === 'pending'} className={SECONDARY_BUTTON_CLASS}>
              {saveKey.status === 'pending' ? t('settings.saving') : t('settings.key.save')}
            </button>
            <a href={OPENROUTER_KEYS_URL} target="_blank" rel="noreferrer noopener" className={`${LINK_CLASS} text-xs`}>
              {t('settings.key.getOne')}
            </a>
          </div>
        </form>
      )}

      {saveKey.error !== null && <ErrorNotice error={saveKey.error} />}
      {removeKey.error !== null && <ErrorNotice error={removeKey.error} />}
    </SettingsPanel>
  );
}
