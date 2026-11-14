import type { ReactNode } from 'react';

import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';

export type SettingsPanelProps = {
  heading: string;
  description?: string;
  testId?: string;
  children: ReactNode;
};

export function SettingsPanel({ heading, description, testId, children }: SettingsPanelProps) {
  return (
    <section data-testid={testId} className={`${PANEL_CLASS} gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className={PANEL_HEADING_CLASS}>{heading}</h2>
        {description !== undefined && <p className="m-0 text-xs text-[var(--cl-ink-2)]">{description}</p>}
      </div>
      {children}
    </section>
  );
}
