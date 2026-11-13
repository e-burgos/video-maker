import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '../i18n/language-context';

export type ModalProps = {
  title: string;
  testId: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
  surface?: 'legacy' | 'glass';
};

const SURFACE_STYLE = {
  legacy: {
    backdrop: 'bg-slate-950/80',
    panel: 'rounded-xl border border-slate-700 bg-slate-900 shadow-xl',
    title: 'text-slate-100',
    close: 'rounded-md border border-slate-700 px-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200',
    body: 'text-slate-300',
  },
  glass: {
    backdrop: 'bg-black/40 text-[var(--cl-ink)]',
    panel: 'glass-thick rounded-[20px] shadow-[var(--tucu-shadow-float)]',
    title: 'font-bold text-[var(--cl-ink)]',
    close: 'focus-cl glass-sub grid size-8 shrink-0 place-items-center rounded-[10px] text-sm text-[var(--cl-ink-2)] hover:text-[var(--cl-ink)]',
    body: 'text-[var(--cl-ink-2)]',
  },
} as const;

export function Modal({ title, testId, onClose, children, footer, wide = false, surface = 'legacy' }: ModalProps) {
  const style = SURFACE_STYLE[surface];
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    panel.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      data-testid={`${testId}-backdrop`}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${style.backdrop}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panel}
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full space-y-4 overflow-y-auto p-5 outline-none ${style.panel} ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className={`text-base font-semibold ${style.title}`}>
            {title}
          </h2>
          <button
            type="button"
            data-testid={`${testId}-close`}
            aria-label={t('modal.close')}
            onClick={onClose}
            className={style.close}
          >
            ×
          </button>
        </div>

        <div className={`space-y-3 text-sm ${style.body}`}>{children}</div>

        <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
