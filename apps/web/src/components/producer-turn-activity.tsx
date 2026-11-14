import { useEffect, useRef, useState } from 'react';

import { stripSuggestionsFence } from '../api/producer-suggestions-fence';
import { producerFailureKey } from '../api/producer-capability';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { ProducerMarkdown } from './producer-message-list';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
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

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-[var(--cl-action-text)] border-t-transparent motion-reduce:animate-none"
    />
  );
}

function StepMarker({ current }: { current: boolean }) {
  return current ? (
    <span className="mt-[3px] shrink-0">
      <Spinner />
    </span>
  ) : (
    <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--tucu-state-green-ink)]" />
  );
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
  const running = status === 'running';
  const events = turn?.events ?? [];

  return (
    <div
      data-testid="producer-turn-activity"
      data-status={status}
      className="glass-sub min-w-0 space-y-3 rounded-[14px] p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-[var(--cl-ink-2)]">
          {running && <Spinner />}
          {running ? t('producer.working') : t('producer.turnStatus', { status })}
          {turn !== null && (
            <span data-testid="producer-turn-elapsed" className="font-data font-normal text-[var(--cl-ink-3)]">
              {formatElapsed(turn.startedAt, now)}
            </span>
          )}
        </p>
        {running && (
          <button type="button" disabled={canceling} onClick={onCancel} className={SECONDARY_BUTTON_SMALL_CLASS}>
            {canceling ? t('producer.canceling') : t('producer.cancel')}
          </button>
        )}
      </div>

      <ol
        ref={feedRef}
        data-testid="producer-turn-events"
        className="max-h-64 space-y-1.5 overflow-y-auto pr-1 text-[12.5px] text-[var(--cl-ink-2)]"
      >
        {events.map((event, index) => (
          <li
            key={index}
            data-event-type={event.type}
            className="flex min-w-0 items-start gap-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            <StepMarker current={running && index === events.length - 1} />
            <span className="min-w-0 flex-1">
              {event.type === 'text' ? <ProducerMarkdown text={eventLabel(event)} /> : eventLabel(event)}
            </span>
          </li>
        ))}
        {eventCount === 0 && (
          <li className="flex items-center gap-2 text-[var(--cl-ink-3)]">
            <Spinner />
            {t('producer.waitingFirstStep')}
          </li>
        )}
      </ol>

      {failure !== null && (
        <div
          data-testid="producer-turn-failure"
          role="alert"
          className="rounded-[12px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-3"
        >
          <p className="font-data text-xs font-semibold text-[var(--tucu-state-red-ink)]">{failure.code}</p>
          <p className="mt-1 text-sm text-[var(--tucu-state-red-ink)]">
            {failureKey === null ? failure.message : t(failureKey)}
          </p>
        </div>
      )}

      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}
