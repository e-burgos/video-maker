import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONE_CLASS: Readonly<Record<BadgeTone, string>> = {
  neutral: 'border-border-strong text-ink-muted',
  accent: 'border-accent-soft/50 bg-accent-soft/10 text-accent-strong',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  danger: 'border-danger/50 bg-danger/10 text-danger',
  success: 'border-success/50 bg-success/10 text-success',
};

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${TONE_CLASS[tone]} ${className}`}
      {...props}
    />
  );
}
