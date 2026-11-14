import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { stepsForMode, videoStepPath } from './shell-navigation';
import type { StepStatus } from './shell-navigation';

export type VideoStepsNavProps = {
  slug: string;
  title: string;
  isMotion: boolean;
  statusByPath?: Readonly<Record<string, StepStatus>>;
  footer?: ReactNode;
};

const DOT_CLASS: Readonly<Record<StepStatus, string>> = {
  pending: 'bg-[var(--cl-ink-3)] opacity-50',
  ok: 'bg-[#28a745]',
  warn: 'bg-[#e8890c]',
};

function stepClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive
    ? 'bg-[color-mix(in_srgb,var(--cl-action)_12%,transparent)] font-semibold text-[var(--cl-action-text)]'
    : 'text-[var(--cl-ink-2)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_6%,transparent)]';
  return `focus-cl flex items-center gap-2 rounded-[9px] px-2 py-1 text-[12.5px] ${tone}`;
}

export function VideoStepsNav({ slug, title, isMotion, statusByPath = {}, footer }: VideoStepsNavProps) {
  const t = useT();

  return (
    <div data-testid="video-block" className="glass-thin ml-2.5 mt-0.5 mb-1.5 flex flex-col gap-0.5 rounded-[14px] p-1.5">
      <p className="truncate px-2 pb-1.5 pt-1 text-xs font-semibold text-[var(--cl-ink)]" title={title}>
        {title}
      </p>
      <nav data-testid="project-nav" aria-label={t('nav.videoSteps.label')} className="flex flex-col gap-0.5">
        {stepsForMode(isMotion).map((step) => {
          const status = statusByPath[step.path] ?? 'pending';
          return (
            <NavLink
              key={step.labelKey}
              to={videoStepPath(slug, step)}
              end={step.end}
              data-status={status}
              className={stepClass}
            >
              <span aria-hidden data-step-dot className={`size-[7px] shrink-0 rounded-full ${DOT_CLASS[status]}`} />
              <span className="first-letter:uppercase">{t(step.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
      {footer !== undefined && <div className="mt-1 border-t border-[var(--tucu-glass-sub-line)] px-1 pt-1.5">{footer}</div>}
    </div>
  );
}
