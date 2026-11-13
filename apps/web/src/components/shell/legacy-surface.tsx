import type { ReactNode } from 'react';

export function LegacySurface({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="legacy-surface"
      className="dark [color-scheme:dark] rounded-[20px] border border-slate-700/60 bg-[var(--color-surface)] p-6 text-slate-100 shadow-[var(--tucu-shadow-card)]"
    >
      {children}
    </div>
  );
}
