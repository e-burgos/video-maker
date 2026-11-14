import { StateBadge } from '@e-burgos/tucu-ui';

import type { AppUpdate } from '../../api/render-api-types';
import { useLanguage, useT } from '../../i18n/language-context';
import {
  HINT_TEXT_CLASS,
  PANEL_CLASS,
  PANEL_HEADING_CLASS,
  PRIMARY_BUTTON_SMALL_CLASS,
  WARNING_TEXT_CLASS,
} from '../ui/cl-controls';
import { LoadingState } from '../ui/status-states';
import { UPDATE_BADGE_LABEL, UPDATE_BADGE_TONE, formatPublishedDate, isSafeDownloadUrl } from './update-check-model';
import type { UpdateCheckPhase } from './use-update-check';

export type VersionTabProps = {
  installedVersion: string | null;
  loading: boolean;
  phase: UpdateCheckPhase;
  result: AppUpdate | null;
};

function UpdateResult({ result }: { result: AppUpdate }) {
  const t = useT();
  const { language } = useLanguage();
  const published = formatPublishedDate(result.publishedAt, language);
  const latest = result.latestVersion ?? '';

  return (
    <div data-testid="about-update-result" data-status={result.status} role="status" className="flex flex-col gap-2">
      <StateBadge tone={UPDATE_BADGE_TONE[result.status]} dot size="sm" className="self-start">
        {t(UPDATE_BADGE_LABEL[result.status])}
      </StateBadge>
      {result.status === 'up-to-date' && (
        <p className="m-0 text-sm text-[var(--cl-ink)]">
          {t('about.update.upToDate')} {latest !== '' && t('about.update.upToDateLatest', { version: latest })}
        </p>
      )}
      {result.status === 'available' && (
        <>
          <p className="m-0 text-sm text-[var(--cl-ink)]">
            {t('about.update.available', { version: latest })}
            {published !== null && ` ${t('about.update.published', { date: published })}`}
          </p>
          {isSafeDownloadUrl(result.downloadUrl) && (
            <a
              data-testid="about-update-download"
              href={result.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${PRIMARY_BUTTON_SMALL_CLASS} self-start`}
            >
              {t('about.update.download', { version: latest })}
            </a>
          )}
        </>
      )}
      {result.status === 'unknown' && <p className={WARNING_TEXT_CLASS}>{t('about.update.unknown')}</p>}
    </div>
  );
}

export function VersionTab({ installedVersion, loading, phase, result }: VersionTabProps) {
  const t = useT();

  return (
    <div data-testid="about-version" className="flex min-w-0 flex-col gap-4">
      <section className={`${PANEL_CLASS} max-w-2xl`}>
        <h3 className={PANEL_HEADING_CLASS}>{t('about.version.installed')}</h3>
        {installedVersion === null && loading && <LoadingState message={t('about.version.loading')} />}
        {installedVersion === null && !loading && <p className={WARNING_TEXT_CLASS}>{t('about.version.unavailable')}</p>}
        {installedVersion !== null && (
          <p data-testid="about-installed-version" className="font-data m-0 text-3xl font-bold text-[var(--cl-ink)]">
            {installedVersion}
          </p>
        )}
      </section>
      <section className={`${PANEL_CLASS} max-w-2xl`}>
        <h3 className={PANEL_HEADING_CLASS}>{t('about.update.action')}</h3>
        {phase === 'idle' && <p className={HINT_TEXT_CLASS}>{t('about.update.idle')}</p>}
        {phase === 'checking' && <LoadingState message={t('about.update.checking')} />}
        {phase === 'done' && result !== null && <UpdateResult result={result} />}
      </section>
    </div>
  );
}
