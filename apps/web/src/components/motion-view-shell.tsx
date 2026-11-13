import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import type { RenderApiError } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { PANEL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type MotionViewShellProps = {
  slug: string;
  testId: string;
  loading: boolean;
  error: RenderApiError | null;
  onRetry: () => void;
  children: ReactNode;
};

export function MotionViewShell({ slug, testId, loading, error, onRetry, children }: MotionViewShellProps) {
  const t = useT();

  return (
    <section data-testid={testId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/projects/${encodeURIComponent(slug)}`}
          data-testid="motion-view-adjust-link"
          className={`${SECONDARY_BUTTON_SMALL_CLASS} no-underline`}
        >
          {t('motion.adjust.link')}
        </Link>
      </div>
      {loading && <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('motionView.loading')}</p>}
      {error !== null && <ErrorNotice surface="glass" error={error} onRetry={onRetry} />}
      {children}
    </section>
  );
}

export function MotionViewEmpty({ slug, testId, message }: { slug: string; testId: string; message: string }) {
  const t = useT();

  return (
    <div data-testid={testId} className={PANEL_CLASS}>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{message}</p>
      <Link
        to={`/projects/${encodeURIComponent(slug)}/motion`}
        className="text-sm font-semibold text-[var(--cl-action-text)] underline"
      >
        {t('motionView.openMotion')}
      </Link>
    </div>
  );
}
