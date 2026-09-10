export type ProducerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  blockers: readonly string[];
};

export function ProducerComposer({
  value,
  onChange,
  onSend,
  pending,
  blockers,
}: ProducerComposerProps) {
  const blocked = blockers.length > 0;
  const empty = value.trim() === '';
  const disabled = blocked || pending || empty;

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

      <div className="flex items-center justify-between gap-3">
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
