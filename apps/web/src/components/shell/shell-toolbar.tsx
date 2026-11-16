import type { ReactNode } from 'react';

import { useDeclaredToolbarAction } from './toolbar-action-context';
import { useToolbarStatusSlot } from './toolbar-status-context';

export type ShellToolbarProps = {
  title: string;
  subtitle: string | null;
  status?: ReactNode;
};

export function ShellToolbar({ title, subtitle, status }: ShellToolbarProps) {
  const action = useDeclaredToolbarAction();
  const statusSlot = useToolbarStatusSlot();

  return (
    <header
      data-testid="shell-toolbar"
      className="glass-thick flex min-h-[52px] shrink-0 items-center gap-3 rounded-2xl py-2 pl-4 pr-2.5 text-[var(--cl-ink)] shadow-[var(--tucu-shadow-card)]"
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold leading-tight tracking-[-0.3px]">{title}</h1>
        {subtitle !== null && <p className="truncate text-xs text-[var(--cl-ink-3)]">{subtitle}</p>}
      </div>
      <div data-testid="toolbar-status" ref={statusSlot.setElement} className="flex shrink-0 items-center" />
      {status}
      {action !== null && (
        <button
          type="button"
          data-testid="toolbar-action"
          onClick={action.onClick}
          disabled={action.disabled === true || action.loading === true}
          aria-busy={action.loading === true}
          className="focus-cl whitespace-nowrap rounded-[10px] bg-[var(--cl-action-fill)] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_var(--cl-action-ring)] hover:bg-[var(--cl-action-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.label}
        </button>
      )}
    </header>
  );
}
