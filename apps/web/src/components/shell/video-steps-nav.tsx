import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { stepsForMode, videoStepPath } from './shell-navigation';
import type { StepStatus } from './shell-navigation';
import { stepDotClass } from './video-step-status';

export type VideoStepsNavProps = {
  slug: string;
  title: string;
  isMotion: boolean;
  statusByPath?: Readonly<Record<string, StepStatus>>;
  footer?: ReactNode;
};

function stepClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive
    ? 'bg-[color-mix(in_srgb,var(--cl-action)_12%,transparent)] font-semibold text-[var(--cl-action-text)]'
    : 'text-[var(--cl-ink-2)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_6%,transparent)]';
  return `focus-cl flex items-center gap-2 rounded-[9px] px-2 py-[2px] text-[12.5px] ${tone}`;
}

export function VideoStepsNav({ slug, title, isMotion, statusByPath = {}, footer }: VideoStepsNavProps) {
  const t = useT();

  return (
    <div data-testid="video-block" className="glass-sub ml-2.5 mt-0.5 mb-1 flex flex-col gap-0 rounded-[14px] p-1">
      <p className="truncate px-2 pb-1 pt-0.5 text-xs font-semibold text-[var(--cl-ink)]" title={title}>
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
              <span aria-hidden data-step-dot className={`size-[7px] shrink-0 rounded-full ${stepDotClass(status)}`} />
              <span className="first-letter:uppercase">{t(step.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
      {footer !== undefined && <div className="mt-0.5 border-t border-[var(--tucu-glass-sub-line)] px-1 pt-1">{footer}</div>}
    </div>
  );
}
