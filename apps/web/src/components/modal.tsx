import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { useT } from '../i18n/language-context';

export type ModalProps = {
  title: string;
  testId: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
};

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

  return (
    <div
      data-testid={`${testId}-backdrop`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
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
        className={`max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            data-testid={`${testId}-close`}
            aria-label={t('modal.close')}
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-300">{children}</div>

        <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
