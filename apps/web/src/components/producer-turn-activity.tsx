import { useEffect, useRef, useState } from 'react';

import { stripSuggestionsFence } from '../api/producer-suggestions-fence';
import { producerFailureKey } from '../api/producer-capability';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { ProducerMarkdown } from './producer-message-list';
import type { RenderApiError } from '../api/render-api-error';
import type { ProducerEvent, ProducerTurn } from '../api/render-api-types';

export type ProducerTurnActivityProps = {
  turn: ProducerTurn | null;
  polling: boolean;
  error: RenderApiError | null;
  canceling: boolean;
  onCancel: () => void;
};

const ELAPSED_TICK_MS = 1000;

export function formatElapsed(startedAt: string, now: number): string {
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) {
    return '—';
  }

  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function eventLabel(event: ProducerEvent): string {
  if (event.type === 'text') {
    return stripSuggestionsFence(event.text);
  }
  if (event.type === 'tool') {
    return `${event.name} · ${event.summary}`;
  }
  return event.status;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const id = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  return now;
}

export function ProducerTurnActivity({
  turn,
  polling,
  error,
  canceling,
  onCancel,
}: ProducerTurnActivityProps) {
  const t = useT();
  const now = useNow(polling);
  const feedRef = useRef<HTMLOListElement>(null);
  const eventCount = turn?.events.length ?? 0;

  useEffect(() => {
    const feed = feedRef.current;
    if (feed !== null) {
      feed.scrollTop = feed.scrollHeight;
    }
  }, [eventCount]);

  if (turn === null && error === null) {
    return null;
  }

  const status = turn?.status ?? 'running';
  const failure = turn?.error ?? null;
  const failureKey = failure === null ? null : producerFailureKey(failure.code);

  return (
    <div
      data-testid="producer-turn-activity"
      data-status={status}
      className="min-w-0 space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-400">
          {status === 'running' ? t('producer.working') : t('producer.turnStatus', { status })}
          {turn !== null && (
            <span data-testid="producer-turn-elapsed" className="ml-2 text-slate-500">
              {formatElapsed(turn.startedAt, now)}
            </span>
          )}
        </p>
        {status === 'running' && (
          <button
            type="button"
            disabled={canceling}
            onClick={onCancel}
            className="rounded-md border border-amber-400/60 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
          >
            {canceling ? t('producer.canceling') : t('producer.cancel')}
          </button>
        )}
      </div>

      <ol
        ref={feedRef}
        data-testid="producer-turn-events"
        className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400"
      >
        {turn?.events.map((event, index) => (
          <li key={index} data-event-type={event.type} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {event.type === 'text' ? <ProducerMarkdown text={eventLabel(event)} /> : eventLabel(event)}
          </li>
        ))}
        {eventCount === 0 && (
          <li className="text-slate-600">{t('producer.waitingFirstStep')}</li>
        )}
      </ol>

      {failure !== null && (
        <div data-testid="producer-turn-failure" role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3">
          <p className="font-mono text-xs font-semibold text-rose-300">{failure.code}</p>
          <p className="mt-1 text-sm text-rose-100">
            {failureKey === null ? failure.message : t(failureKey)}
          </p>
        </div>
      )}

      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}
