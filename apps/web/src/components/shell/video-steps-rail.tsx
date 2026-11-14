import { NavLink } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { stepsForMode, videoStepPath } from './shell-navigation';
import type { StepStatus } from './shell-navigation';
import { STEP_STATUS_LABEL, stepDotClass } from './video-step-status';

export type VideoStepsRailProps = {
  slug: string;
  title: string;
  isMotion: boolean;
  statusByPath?: Readonly<Record<string, StepStatus>>;
};

function railStepClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive
    ? 'bg-[color-mix(in_srgb,var(--cl-action)_14%,transparent)] text-[var(--cl-action-text)] ring-1 ring-[var(--cl-action)]'
    : 'text-[var(--cl-ink-2)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_6%,transparent)]';
  return `focus-cl font-data relative flex size-8 items-center justify-center rounded-[10px] text-xs font-semibold ${tone}`;
}

export function VideoStepsRail({ slug, title, isMotion, statusByPath = {} }: VideoStepsRailProps) {
  const t = useT();

  return (
    <nav
      data-testid="project-rail-nav"
      aria-label={`${t('nav.videoSteps.label')}: ${title}`}
      className="glass-sub mb-1 flex flex-col items-center gap-1 rounded-[12px] py-1.5"
    >
      {stepsForMode(isMotion).map((step, index) => {
        const status = statusByPath[step.path] ?? 'pending';
        const label = `${t(step.labelKey)} (${t(STEP_STATUS_LABEL[status])})`;
        return (
          <NavLink
            key={step.labelKey}
            to={videoStepPath(slug, step)}
            end={step.end}
            data-status={status}
            title={label}
            aria-label={label}
            className={railStepClass}
          >
            {index + 1}
            <span aria-hidden data-step-dot className={`absolute right-1 top-1 size-[6px] rounded-full ${stepDotClass(status)}`} />
          </NavLink>
        );
      })}
    </nav>
  );
}
