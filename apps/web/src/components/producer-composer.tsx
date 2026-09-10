import type { ProducerModelOption } from '../api/render-api-types';

export type ProducerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  blockers: readonly string[];
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
  const blocked = blockers.length > 0;
  const empty = value.trim() === '';
  const disabled = blocked || pending || empty;
  const chosen = models.find((option) => option.id === model) ?? null;

  return (
    <div
      data-testid="producer-composer"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <textarea
        aria-label="Message for the producer"
        value={value}
        rows={3}
        disabled={blocked}
        placeholder="Tell the producer what you want and what material you have…"
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
            model
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
            {models.map((option) => (
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
          Enter sends · Shift+Enter adds a line
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={onSend}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>

      {blocked && (
        <ul data-testid="producer-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
