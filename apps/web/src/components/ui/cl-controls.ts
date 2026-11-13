const BUTTON_BASE =
  'focus-cl inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_MD = 'h-10 px-4 text-sm';
const SIZE_SM = 'h-8 px-3 text-xs';

const SECONDARY_TONE =
  'glass-sub text-[var(--cl-ink)] hover:border-[var(--cl-ink-3)]';
const PRIMARY_TONE =
  'border border-transparent bg-[var(--cl-action-fill)] text-white shadow-[0_2px_12px_var(--cl-action-ring)] hover:bg-[var(--cl-action-fill-hover)]';
const DANGER_TONE =
  'border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] text-[var(--tucu-state-red-ink)] hover:border-[var(--tucu-state-red-ink)]';

export const SECONDARY_BUTTON_CLASS = `${BUTTON_BASE} ${SIZE_MD} ${SECONDARY_TONE}`;
export const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} ${SIZE_MD} ${PRIMARY_TONE}`;
export const SECONDARY_BUTTON_SMALL_CLASS = `${BUTTON_BASE} ${SIZE_SM} ${SECONDARY_TONE}`;
export const PRIMARY_BUTTON_SMALL_CLASS = `${BUTTON_BASE} ${SIZE_SM} ${PRIMARY_TONE}`;
export const DANGER_BUTTON_SMALL_CLASS = `${BUTTON_BASE} ${SIZE_SM} ${DANGER_TONE}`;

export const FIELD_CLASS =
  'focus-cl glass-sub h-10 min-w-0 rounded-[10px] px-3 text-sm text-[var(--cl-ink)] placeholder:text-[var(--cl-ink-3)]';
export const FIELD_SMALL_CLASS =
  'focus-cl glass-sub h-8 min-w-0 rounded-[10px] px-2.5 text-xs text-[var(--cl-ink)] placeholder:text-[var(--cl-ink-3)]';
export const FIELD_LABEL_CLASS = 'text-xs font-medium text-[var(--cl-ink-2)]';
export const MUTED_TEXT_CLASS = 'text-[var(--cl-ink-2)]';
