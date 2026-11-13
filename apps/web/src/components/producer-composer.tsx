import type { ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';

import type { ProducerEngineId, ProducerModelOption } from '../api/render-api-types';
import type { Blocker } from '../api/blockers';
import { blockerId } from '../api/blockers';
import { translateProducerModel } from '../api/producer-model-i18n';
import { producerEngineActiveLabel } from '../api/producer-engine-i18n';
import { useT } from '../i18n/language-context';
import { FIELD_SMALL_CLASS, PRIMARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type ProducerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  busy?: boolean;
  blockers: readonly Blocker[];
  models: readonly ProducerModelOption[];
  model: string;
  onModelChange: (model: string) => void;
  activeEngine?: ProducerEngineId | null;
  placeholder?: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  attachment?: ReactNode;
};

export function ProducerComposer({
  value,
  onChange,
  onSend,
  pending,
  busy = false,
  blockers,
  models,
  model,
  onModelChange,
  activeEngine = null,
  placeholder,
  textareaRef,
  attachment,
}: ProducerComposerProps) {
  const t = useT();
  const blocked = blockers.length > 0;
  const empty = value.trim() === '';
  const disabled = blocked || pending || empty;
  const translatedModels = models.map((option) => translateProducerModel(t, option));
  const chosen = translatedModels.find((option) => option.id === model) ?? null;
  const engineUnavailable = blockers.some((blocker) => blocker.key === 'producer.blocker.unavailable');

  return (
    <div
      data-testid="producer-composer"
      className="glass-sub space-y-2 rounded-[14px] p-3 focus-within:outline focus-within:outline-[3px] focus-within:outline-[var(--cl-action-ring)]"
    >
      <textarea
        ref={textareaRef}
        aria-label={t('producer.composerLabel')}
        value={value}
        rows={2}
        disabled={blocked}
        placeholder={placeholder ?? t('producer.composerPlaceholder')}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) {
            return;
          }
          event.preventDefault();
          if (!disabled) {
            onSend();
          }
        }}
        className="w-full resize-none bg-transparent px-1 text-sm text-[var(--cl-ink)] outline-none placeholder:text-[var(--cl-ink-3)] disabled:opacity-40"
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="producer-model" className="sr-only">
          {t('producer.modelLabel')}
        </label>
        <select
          id="producer-model"
          data-testid="producer-model-picker"
          value={model}
          disabled={blocked || pending || busy}
          title={chosen?.description ?? ''}
          onChange={(event) => onModelChange(event.target.value)}
          className={`${FIELD_SMALL_CLASS} font-semibold disabled:opacity-40`}
        >
          {translatedModels.map((option) => (
            <option key={option.id} value={option.id} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="min-w-0 flex-1 text-xs text-[var(--cl-ink-3)]">{t('producer.sendHint')}</p>
        {attachment}
        <button type="button" disabled={disabled} onClick={onSend} className={PRIMARY_BUTTON_SMALL_CLASS}>
          {pending ? t('producer.sending') : busy ? t('producer.queue') : t('producer.send')}
        </button>
      </div>

      {chosen !== null && (
        <p data-testid="producer-model-help" className="text-[11px] text-[var(--cl-ink-3)]">
          {chosen.label} — {chosen.description}
          {activeEngine !== null && ` · ${producerEngineActiveLabel(t, activeEngine)}`}
        </p>
      )}

      {blocked && (
        <ul data-testid="producer-blockers" className="font-data space-y-0.5 text-xs text-[var(--tucu-state-orange-ink)]">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {engineUnavailable && (
        <Link
          to="/settings"
          data-testid="producer-composer-settings-link"
          className="focus-cl inline-block rounded text-xs text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]"
        >
          {t('producer.blocker.goToSettings')}
        </Link>
      )}
    </div>
  );
}
