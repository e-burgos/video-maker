import { Collapse, LucideIcons } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';

export type PreviewSettingsSectionProps = {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function PreviewSettingsSection({ id, title, summary, open, onOpenChange, children }: PreviewSettingsSectionProps) {
  return (
    <Collapse
      variant="unstyled"
      open={open}
      onOpenChange={onOpenChange}
      data-testid={`preview-section-${id}`}
      className="glass-sub overflow-hidden rounded-[14px]"
      headerClassName="focus-cl flex w-full items-center gap-3 px-3.5 py-3 text-left"
      panelClassName="flex flex-col gap-3 border-t border-[var(--tucu-glass-sub-line)] px-3.5 py-3"
      label={
        <>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-bold text-[var(--cl-ink)]">{title}</span>
            <span data-testid={`preview-summary-${id}`} className="font-data truncate text-xs text-[var(--cl-ink-2)]">
              {summary}
            </span>
          </span>
          <LucideIcons.ChevronDown
            aria-hidden
            size={16}
            className={`shrink-0 text-[var(--cl-ink-3)] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </>
      }
    >
      {children}
    </Collapse>
  );
}
