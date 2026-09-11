import { errorDetailLines } from '../api/render-api-error';
import { errorExplanationKey } from '../api/error-explanations';
import { useT } from '../i18n/language-context';
import type { RenderApiError } from '../api/render-api-error';

export type ErrorNoticeProps = {
  error: RenderApiError;
  onRetry?: () => void;
};

export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const t = useT();
  const details = errorDetailLines(error);
  const explanationKey = errorExplanationKey(error.code);

  return (
    <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
      <p className="font-mono text-sm font-semibold text-rose-300">{error.code}</p>
      <p className="mt-1 text-sm text-rose-100">
        {explanationKey === null ? error.message : t(explanationKey)}
      </p>
      {explanationKey !== null && (
        <p data-testid="error-technical-detail" className="mt-1 font-mono text-xs text-rose-200/80">
          {error.message}
        </p>
      )}
      {details.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-xs text-rose-200/80">
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-rose-400/50 px-3 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
        >
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}
