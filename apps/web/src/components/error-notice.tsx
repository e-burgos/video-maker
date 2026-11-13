import { errorDetailLines } from '../api/render-api-error';
import { errorExplanationKey } from '../api/error-explanations';
import { useT } from '../i18n/language-context';
import type { RenderApiError } from '../api/render-api-error';

export type ErrorNoticeProps = {
  error: RenderApiError;
  onRetry?: () => void;
  surface?: 'legacy' | 'glass';
};

type NoticeStyle = { box: string; code: string; message: string; detail: string; retry: string };

const NOTICE_STYLE: Readonly<Record<NonNullable<ErrorNoticeProps['surface']>, NoticeStyle>> = {
  legacy: {
    box: 'rounded-lg border border-rose-500/40 bg-rose-500/10 p-4',
    code: 'font-mono text-sm font-semibold text-rose-300',
    message: 'mt-1 text-sm text-rose-100',
    detail: 'mt-1 font-mono text-xs text-rose-200/80',
    retry: 'mt-3 rounded-md border border-rose-400/50 px-3 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20',
  },
  glass: {
    box: 'rounded-[12px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-4',
    code: 'font-data text-sm font-semibold text-[var(--tucu-state-red-ink)]',
    message: 'mt-1 text-sm text-[var(--cl-ink)]',
    detail: 'font-data mt-1 text-xs text-[var(--cl-ink-2)]',
    retry: 'focus-cl glass-sub mt-3 h-8 rounded-[10px] px-3 text-xs font-semibold text-[var(--cl-ink)] hover:border-[var(--cl-ink-3)]',
  },
};

export function ErrorNotice({ error, onRetry, surface = 'legacy' }: ErrorNoticeProps) {
  const t = useT();
  const details = errorDetailLines(error);
  const explanationKey = errorExplanationKey(error.code);
  const style = NOTICE_STYLE[surface];

  return (
    <div role="alert" className={style.box}>
      <p className={style.code}>{error.code}</p>
      <p className={style.message}>
        {explanationKey === null ? error.message : t(explanationKey)}
      </p>
      {explanationKey !== null && (
        <p data-testid="error-technical-detail" className={style.detail}>
          {error.message}
        </p>
      )}
      {details.length > 0 && (
        <ul className={`mt-2 space-y-0.5 ${style.detail}`}>
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={style.retry}
        >
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}
