import type { TranslationKey } from '../../i18n/messages-en';
import type { StepStatus } from './shell-navigation';

export const STEP_STATUS_LABEL: Readonly<Record<StepStatus, TranslationKey>> = {
  pending: 'nav.videoSteps.status.pending',
  ok: 'nav.videoSteps.status.ok',
  warn: 'nav.videoSteps.status.warn',
};

const DOT_CLASS: Readonly<Record<StepStatus, string>> = {
  pending: 'bg-[var(--cl-ink-3)] opacity-50',
  ok: 'bg-[#28a745]',
  warn: 'bg-[#e8890c]',
};

export function stepDotClass(status: StepStatus): string {
  return DOT_CLASS[status];
}
