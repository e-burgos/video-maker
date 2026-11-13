import type { ReactNode } from 'react';

import { isMigratedRoute } from './shell-navigation';

export function ShellContent({ pathname, children }: { pathname: string; children: ReactNode }) {
  if (isMigratedRoute(pathname)) {
    return (
      <main data-testid="shell-content" className="min-h-0 flex-1 overflow-y-auto text-[var(--cl-ink)]">
        {children}
      </main>
    );
  }

  return (
    <main
      data-testid="shell-content"
      data-surface="legacy"
      className="min-h-0 flex-1 overflow-y-auto rounded-[20px] border border-slate-700/60 bg-[var(--color-surface)] px-6 py-8 text-slate-100 shadow-[var(--tucu-shadow-card)]"
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
