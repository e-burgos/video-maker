import { useT } from '../../../i18n/language-context';
import { assetRoleCopy } from '../../../api/asset-roles';
import { OPAQUE_MEDIA_FRAME_CLASS, LINK_CLASS, PRIMARY_BUTTON_SMALL_CLASS } from '../../ui/cl-controls';
import { FREE_MEDIA_TAB_LABEL, IMPORT_ROLE_BY_TAB, SOURCE_LABEL, formatDimensions, formatDuration } from './free-media-model';
import type { FreeResult } from './free-media-model';
import type { ImportPhase } from './use-free-media-session';

export type FreeMediaResultCardProps = {
  result: FreeResult;
  phase: ImportPhase | undefined;
  onImport: (result: FreeResult) => void;
};

export function FreeMediaResultCard({ result, phase, onImport }: FreeMediaResultCardProps) {
  const t = useT();
  const role = t(assetRoleCopy(IMPORT_ROLE_BY_TAB[result.tab]).shortNameKey);
  const sourceKey = SOURCE_LABEL[result.source];
  const facts = [formatDuration(result.durationMs), formatDimensions(result.width, result.height)].filter(
    (fact): fact is string => fact !== null,
  );
  const imported = phase === 'imported';

  return (
    <li
      data-testid="free-media-result"
      data-result-id={result.resultId}
      data-phase={phase ?? 'idle'}
      className="glass-sub flex min-w-0 flex-col gap-2 rounded-[14px] p-3"
    >
      <div className={`${OPAQUE_MEDIA_FRAME_CLASS} flex h-20 items-center justify-center`}>
        <span className="font-data text-xs uppercase tracking-wide text-white/70">{t(FREE_MEDIA_TAB_LABEL[result.tab])}</span>
      </div>
      <p className="m-0 line-clamp-2 text-sm font-semibold text-[var(--cl-ink)]" title={result.title}>
        {result.title}
      </p>
      <dl className="m-0 flex flex-col gap-0.5 text-xs text-[var(--cl-ink-2)]">
        <div className="flex gap-1">
          <dt className="sr-only">{t('library.freeMedia.source')}</dt>
          <dd className="m-0">{sourceKey === undefined ? result.source : t(sourceKey)}</dd>
          {facts.length > 0 && (
            <dd className="font-data m-0 text-[var(--cl-ink-3)]">· {facts.join(' · ')}</dd>
          )}
        </div>
        <div className="flex gap-1">
          <dt className="font-semibold text-[var(--cl-ink)]">{t('library.freeMedia.license')}:</dt>
          <dd className="m-0 min-w-0 break-words">{result.license}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-semibold text-[var(--cl-ink)]">{t('library.freeMedia.author')}:</dt>
          <dd className="m-0 min-w-0 break-words">{result.author}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <a href={result.pageUrl} target="_blank" rel="noreferrer" className={`${LINK_CLASS} text-xs`}>
          {t('library.freeMedia.viewSource')}
        </a>
        <button
          type="button"
          data-testid="free-media-import"
          disabled={phase === 'importing' || imported}
          onClick={() => onImport(result)}
          className={PRIMARY_BUTTON_SMALL_CLASS}
        >
          {imported
            ? t('library.freeMedia.imported')
            : phase === 'importing'
              ? t('library.freeMedia.importing')
              : t('library.freeMedia.import', { role })}
        </button>
      </div>
    </li>
  );
}
