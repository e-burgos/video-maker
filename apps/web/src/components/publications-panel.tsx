import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback } from 'react';

import { formatDateTime } from '../api/format-updated-at';
import { PUBLICATION_STATE_TONE, PUBLICATION_STATUS_LABEL } from '../api/publication-status';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useLanguage, useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import type { Publication } from '../api/youtube-types';

export type PublicationsPanelProps = {
  slug: string;
  refreshToken: number;
};

function publicationMoment(publication: Publication): number {
  const reference = publication.publishAt ?? publication.publishedAt ?? publication.createdAt;
  return Date.parse(reference);
}

export function PublicationsPanel({ slug, refreshToken }: PublicationsPanelProps) {
  const client = useRenderApi();
  const t = useT();
  const { language } = useLanguage();
  const load = useCallback(async () => client.listPublications(slug), [client, slug]);
  const publications = useAsyncResource<Publication[]>(load, `publications:${slug}:${refreshToken}`);

  if (publications.status === 'error' && publications.error !== null) {
    return <ErrorNotice surface="glass" error={publications.error} onRetry={publications.reload} />;
  }

  const rows = publications.data ?? [];

  if (rows.length === 0) {
    return publications.status === 'loading' ? null : (
      <p data-testid="publications-empty" className="text-xs text-[var(--cl-ink-2)]">
        {t('publications.empty')}
      </p>
    );
  }

  return (
    <div data-testid="publications-panel" className="space-y-2">
      <h3 className="text-xs font-semibold text-[var(--cl-ink-2)]">{t('publications.heading')}</h3>
      <ul className="space-y-2">
        {rows.map((publication) => (
          <li
            key={publication.id}
            data-testid="publication-row"
            className="glass-sub flex flex-wrap items-center justify-between gap-2 rounded-[14px] p-2.5 text-xs"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold text-[var(--cl-ink)]">{publication.title}</p>
              <p className="font-data text-[11px] text-[var(--cl-ink-3)]">
                {Number.isNaN(publicationMoment(publication))
                  ? publication.file
                  : formatDateTime(publicationMoment(publication), language)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StateBadge tone={PUBLICATION_STATE_TONE[publication.status]} dot size="sm">
                {t(PUBLICATION_STATUS_LABEL[publication.status])}
              </StateBadge>
              {publication.url !== null && (
                <a
                  href={publication.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-cl rounded text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]"
                >
                  {t('publications.viewOnYoutube')}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
