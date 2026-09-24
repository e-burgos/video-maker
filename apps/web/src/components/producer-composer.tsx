import type { ProducerModelOption } from '../api/render-api-types';
import type { Blocker } from '../api/blockers';
import { blockerId } from '../api/blockers';
import { translateProducerModel } from '../api/producer-model-i18n';
import { useT } from '../i18n/language-context';

export type ProducerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  blockers: readonly Blocker[];
  models: readonly ProducerModelOption[];
  model: string;
  onModelChange: (model: string) => void;
};

export function ProducerComposer({
  value,
  onChange,
  onSend,
  pending,
  blockers,
  models,
  model,
  onModelChange,
}: ProducerComposerProps) {
  const t = useT();
  const blocked = blockers.length > 0;
  const empty = value.trim() === '';
  const disabled = blocked || pending || empty;
  const translatedModels = models.map((option) => translateProducerModel(t, option));
  const chosen = translatedModels.find((option) => option.id === model) ?? null;

  return (
    <div
      data-testid="producer-composer"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <textarea
        aria-label={t('producer.composerLabel')}
        value={value}
        rows={3}
        disabled={blocked}
        placeholder={t('producer.composerPlaceholder')}
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
          <label htmlFor="producer-model" className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
            {t('producer.modelLabel')}
          </label>
          <select
            id="producer-model"
            data-testid="producer-model-picker"
            value={model}
            disabled={blocked || pending}
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
            <span data-testid="producer-model-help" className="text-[11px] text-slate-500">
              {chosen.description}
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-slate-500">
          {t('producer.sendHint')}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={onSend}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {pending ? t('producer.sending') : t('producer.send')}
        </button>
      </div>

      {blocked && (
        <ul data-testid="producer-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
