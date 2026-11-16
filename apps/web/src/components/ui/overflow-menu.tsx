import { LucideIcons } from '@e-burgos/tucu-ui';
import { useEffect, useRef, useState } from 'react';

export type OverflowMenuItem = {
  id: string;
  label: string;
  testId: string;
  tone?: 'default' | 'danger';
  onSelect: () => void;
};

export type OverflowMenuProps = {
  triggerLabel: string;
  triggerTestId: string;
  menuTestId: string;
  items: readonly OverflowMenuItem[];
  className?: string;
};

const ITEM_BASE = 'focus-cl block w-full rounded-lg px-3 py-2 text-left text-xs font-medium';
const ITEM_TONE: Readonly<Record<NonNullable<OverflowMenuItem['tone']>, string>> = {
  default: 'text-[var(--cl-ink)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_8%,transparent)]',
  danger: 'text-[var(--tucu-state-red-ink)] hover:bg-[var(--tucu-state-red-soft)]',
};

export function OverflowMenu({ triggerLabel, triggerTestId, menuTestId, items, className = '' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function closeOnOutsidePointer(event: MouseEvent): void {
      if (container.current !== null && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={container} className={`relative z-10 ${className}`}>
      <button
        type="button"
        data-testid={triggerTestId}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="focus-cl glass-sub grid size-8 place-items-center rounded-[10px] text-[var(--cl-ink-2)] hover:border-[var(--cl-ink-3)] hover:text-[var(--cl-ink)]"
      >
        <LucideIcons.MoreVertical aria-hidden size={16} />
      </button>
      {open && (
        <ul
          data-testid={menuTestId}
          role="menu"
          className="glass-thick absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl p-1 shadow-[var(--tucu-shadow-float)]"
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                data-testid={item.testId}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`${ITEM_BASE} ${ITEM_TONE[item.tone ?? 'default']}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
