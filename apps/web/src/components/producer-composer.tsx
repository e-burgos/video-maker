import type { Ref } from 'react';
import { Link } from 'react-router-dom';

import type { ProducerEngineId, ProducerModelOption } from '../api/render-api-types';
import type { Blocker } from '../api/blockers';
import { blockerId } from '../api/blockers';
import { translateProducerModel } from '../api/producer-model-i18n';
import { producerEngineActiveLabel } from '../api/producer-engine-i18n';
import { useT } from '../i18n/language-context';

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
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <textarea
        ref={textareaRef}
        aria-label={t('producer.composerLabel')}
        value={value}
        rows={3}
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
        className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="producer-model" className="text-xs font-medium text-ink-faint">
            {t('producer.modelLabel')}
          </label>
          <select
            id="producer-model"
            data-testid="producer-model-picker"
            value={model}
            disabled={blocked || pending || busy}
            title={chosen?.description ?? ''}
            onChange={(event) => onModelChange(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
          >
            {translatedModels.map((option) => (
              <option key={option.id} value={option.id} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
          {chosen !== null && (
            <span data-testid="producer-model-help" className="text-xs text-ink-faint">
              {chosen.label} — {chosen.description}
              {activeEngine !== null && ` · ${producerEngineActiveLabel(t, activeEngine)}`}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-faint">{t('producer.sendHint')}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={onSend}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {pending ? t('producer.sending') : busy ? t('producer.queue') : t('producer.send')}
        </button>
      </div>

      {blocked && (
        <ul data-testid="producer-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      {engineUnavailable && (
        <Link
          to="/settings"
          data-testid="producer-composer-settings-link"
          className="inline-block text-xs text-sky-300 underline hover:text-sky-200"
        >
          {t('producer.blocker.goToSettings')}
        </Link>
      )}
    </div>
  );
}
