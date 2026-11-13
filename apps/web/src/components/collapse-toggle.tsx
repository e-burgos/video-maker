import { useT } from '../i18n/language-context';

export type CollapseToggleProps = {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  testId: string;
};

export function CollapseToggle({ name, collapsed, onToggle, testId }: CollapseToggleProps) {
  const t = useT();

  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={!collapsed}
      aria-label={t(collapsed ? 'section.expand' : 'section.collapse', { name })}
      onClick={onToggle}
      className="focus-cl inline-flex size-6 items-center justify-center rounded-md text-[var(--cl-ink-2)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_8%,transparent)] hover:text-[var(--cl-ink)]"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
