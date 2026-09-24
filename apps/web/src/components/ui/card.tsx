import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  raised?: boolean;
};

export function Card({ raised = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-panel border border-border-subtle ${raised ? 'bg-surface-raised/60' : 'bg-transparent'} ${className}`}
      {...props}
    />
  );
}
