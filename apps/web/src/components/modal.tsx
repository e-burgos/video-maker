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
};

const STYLE = {
  backdrop: 'bg-black/40 text-[var(--cl-ink)]',
  panel: 'glass-thick rounded-[20px] shadow-[var(--tucu-shadow-float)]',
  title: 'font-bold text-[var(--cl-ink)]',
  close: 'focus-cl glass-sub grid size-8 shrink-0 place-items-center rounded-[10px] text-sm text-[var(--cl-ink-2)] hover:text-[var(--cl-ink)]',
  body: 'text-[var(--cl-ink-2)]',
} as const;

export function Modal({ title, testId, onClose, children, footer, wide = false }: ModalProps) {
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${STYLE.backdrop}`}
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
        className={`flex max-h-[90vh] w-full flex-col gap-4 p-5 outline-none ${STYLE.panel} ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <h2 id={titleId} className={`text-base font-semibold ${STYLE.title}`}>
            {title}
          </h2>
          <button
            type="button"
            data-testid={`${testId}-close`}
            aria-label={t('modal.close')}
            onClick={onClose}
            className={STYLE.close}
          >
            ×
          </button>
        </div>

        <div data-testid={`${testId}-body`} className={`min-h-0 flex-1 space-y-3 overflow-y-auto text-sm ${STYLE.body}`}>{children}</div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
