import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'border border-accent-soft/50 bg-accent-soft/10 text-accent-strong hover:border-accent-soft/70',
  secondary: 'border border-border-strong text-ink-muted hover:border-ink-faint hover:text-ink',
  ghost: 'border border-transparent text-ink-muted hover:border-border-subtle',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-control px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  );
}
