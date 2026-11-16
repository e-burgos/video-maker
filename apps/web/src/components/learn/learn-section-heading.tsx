import type { ReactNode } from 'react';

export type LearnSectionHeadingProps = {
  title: string;
  lede?: ReactNode;
};

export function LearnSectionHeading({ title, lede }: LearnSectionHeadingProps) {
  return (
    <div className="px-1">
      <h2 className="m-0 text-xl font-bold tracking-tight text-[var(--cl-ink)]">{title}</h2>
      {lede !== undefined && <p className="mt-2 max-w-3xl text-sm text-[var(--cl-ink-2)]">{lede}</p>}
    </div>
  );
}
