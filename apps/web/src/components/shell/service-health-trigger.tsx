import { useT } from '../../i18n/language-context';
import { DOT_CLASS_BY_STATE } from './service-health-state';
import type { ServiceHealthState } from './service-health-state';

type ServiceHealthTriggerProps = {
  state: ServiceHealthState;
  label: string;
  onOpen: () => void;
};

export function ServiceHealthTrigger({ state, label, onOpen }: ServiceHealthTriggerProps) {
  const t = useT();

  return (
    <button
      type="button"
      data-testid="service-health-trigger"
      aria-haspopup="dialog"
      aria-label={`${label}, ${t('health.details')}`}
      title={label}
      onClick={onOpen}
      className="focus-cl flex w-full min-w-0 items-center gap-2 rounded-[10px] border border-[var(--tucu-glass-sub-line)] bg-[var(--tucu-glass-sub-bg)] px-2.5 py-2 text-left text-xs text-[var(--cl-ink-2)] hover:border-[var(--cl-ink-3)] max-[1099px]:size-8 max-[1099px]:justify-center max-[1099px]:p-0"
    >
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT_CLASS_BY_STATE[state]}`} />
      <span data-testid="service-health-label" className="min-w-0 flex-1 break-words max-[1099px]:hidden">
        {label}
      </span>
      <span aria-hidden="true" className="shrink-0 text-[var(--cl-ink-3)] max-[1099px]:hidden">
        ›
      </span>
    </button>
  );
}
