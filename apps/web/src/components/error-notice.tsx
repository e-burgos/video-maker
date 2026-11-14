import { errorDetailLines } from '../api/render-api-error';
import { errorExplanationKey } from '../api/error-explanations';
import { useT } from '../i18n/language-context';
import type { RenderApiError } from '../api/render-api-error';

export type ErrorNoticeProps = {
  error: RenderApiError;
  onRetry?: () => void;
};

const STYLE = {
  box: 'rounded-[12px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-4',
  code: 'font-data text-sm font-semibold text-[var(--tucu-state-red-ink)]',
  message: 'mt-1 text-sm text-[var(--cl-ink)]',
  detail: 'font-data mt-1 text-xs text-[var(--cl-ink-2)]',
  retry: 'focus-cl glass-sub mt-3 h-8 rounded-[10px] px-3 text-xs font-semibold text-[var(--cl-ink)] hover:border-[var(--cl-ink-3)]',
} as const;

export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const t = useT();
  const details = errorDetailLines(error);
  const explanationKey = errorExplanationKey(error.code);

  return (
    <div role="alert" className={STYLE.box}>
      <p className={STYLE.code}>{error.code}</p>
      <p className={STYLE.message}>
        {explanationKey === null ? error.message : t(explanationKey)}
      </p>
      {explanationKey !== null && (
        <p data-testid="error-technical-detail" className={STYLE.detail}>
          {error.message}
        </p>
      )}
      {details.length > 0 && (
        <ul className={`mt-2 space-y-0.5 ${STYLE.detail}`}>
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={STYLE.retry}
        >
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}
