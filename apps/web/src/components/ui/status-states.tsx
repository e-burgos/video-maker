import type { ReactNode } from 'react';

export function LoadingState({ message }: { message: string }) {
  return (
    <p role="status" className="m-0 text-sm text-[var(--cl-ink-2)]">
      {message}
    </p>
  );
}

export type EmptyStateProps = {
  message: string;
  title?: string;
  children?: ReactNode;
};

export function EmptyState({ message, title, children }: EmptyStateProps) {
  return (
    <div className="space-y-1">
      {title !== undefined && <p className="m-0 text-sm font-bold text-[var(--cl-ink)]">{title}</p>}
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{message}</p>
      {children}
    </div>
  );
}
