import type { ReactNode } from 'react';

export function ShellContent({ children }: { children: ReactNode }) {
  return (
    <main data-testid="shell-content" className="min-h-0 flex-1 overflow-y-auto text-[var(--cl-ink)]">
      {children}
    </main>
  );
}
