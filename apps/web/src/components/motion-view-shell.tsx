import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { humanizeSlug } from '../api/humanize-slug';
import type { RenderApiError } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type MotionViewShellProps = {
  slug: string;
  title: string;
  testId: string;
  loading: boolean;
  error: RenderApiError | null;
  onRetry: () => void;
  children: ReactNode;
};

export function MotionViewShell({
  slug,
  title,
  testId,
  loading,
  error,
  onRetry,
  children,
}: MotionViewShellProps) {
  const t = useT();

  return (
    <section data-testid={testId} className="space-y-6">
      <header className="space-y-2">
        <Link to="/" className="text-xs text-ink-faint hover:text-ink-muted">
          {t('library.backToProjects')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="font-mono text-xs text-ink-faint">{humanizeSlug(slug)}</p>
        <Link
          to={`/projects/${encodeURIComponent(slug)}`}
          data-testid="motion-view-adjust-link"
          className="inline-block rounded-control border border-accent px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          {t('motion.adjust.link')}
        </Link>
      </header>
      {loading && <p className="text-sm text-ink-faint">{t('motionView.loading')}</p>}
      {error !== null && <ErrorNotice error={error} onRetry={onRetry} />}
      {children}
    </section>
  );
}

export function MotionViewEmpty({
  slug,
  testId,
  message,
}: {
  slug: string;
  testId: string;
  message: string;
}) {
  const t = useT();

  return (
    <div
      data-testid={testId}
      className="space-y-2 rounded-panel border border-border-subtle bg-surface-raised/40 p-4"
    >
      <p className="text-sm text-ink-muted">{message}</p>
      <Link
        to={`/projects/${encodeURIComponent(slug)}/motion`}
        className="text-sm text-accent-strong underline"
      >
        {t('motionView.openMotion')}
      </Link>
    </div>
  );
}
