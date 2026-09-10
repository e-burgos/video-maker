import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { ProducerEvent } from './producer-stream-events';

export const PRODUCER_TURN_STATUSES = ['running', 'succeeded', 'failed', 'canceled'] as const;

export type ProducerTurnStatus = (typeof PRODUCER_TURN_STATUSES)[number];

export interface ProducerTurnRecord {
  readonly turnId: string;
  readonly slug: string;
  readonly status: ProducerTurnStatus;
  readonly model: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly events: readonly ProducerEvent[];
  readonly assistantMessage: string | null;
  readonly suggestions: readonly string[];
  readonly error: RenderApiErrorPayload | null;
}

export interface ProducerTurnSettlement {
  readonly status: Exclude<ProducerTurnStatus, 'running'>;
  readonly finishedAt: string;
  readonly assistantMessage?: string;
  readonly suggestions?: readonly string[];
  readonly error?: RenderApiErrorPayload;
}

export interface ProducerTurnRegistry {
  readonly reserve: (slug: string, turnId: string, startedAt: string, model: string) => void;
  readonly attachCanceler: (turnId: string, cancel: () => void) => void;
  readonly appendEvents: (turnId: string, events: readonly ProducerEvent[]) => void;
  readonly settle: (turnId: string, settlement: ProducerTurnSettlement) => void;
  readonly get: (turnId: string) => ProducerTurnRecord;
  readonly activeFor: (slug: string) => ProducerTurnRecord | null;
  readonly requestCancel: (turnId: string) => ProducerTurnRecord;
  readonly cancelAll: () => number;
}

interface MutableTurn {
  record: ProducerTurnRecord;
  cancel: (() => void) | null;
}

function notFound(turnId: string): PipelineStageError {
  return new PipelineStageError({ code: 'PRODUCER_TURN_NOT_FOUND', stage: null, resource: turnId });
}

export function createProducerTurnRegistry(): ProducerTurnRegistry {
  const turns = new Map<string, MutableTurn>();

  const activeFor = (slug: string): ProducerTurnRecord | null => {
    for (const turn of turns.values()) {
      if (turn.record.slug === slug && turn.record.status === 'running') {
        return turn.record;
      }
    }
    return null;
  };

  const find = (turnId: string): MutableTurn => {
    const turn = turns.get(turnId);
    if (turn === undefined) {
      throw notFound(turnId);
    }
    return turn;
  };

  return {
    reserve: (slug, turnId, startedAt, model) => {
      const active = activeFor(slug);
      if (active !== null) {
        throw new PipelineStageError({
          code: 'PRODUCER_TURN_ACTIVE',
          stage: null,
          resource: active.turnId,
          hint: 'wait for the running turn to finish or cancel it',
        });
      }

      turns.set(turnId, {
        cancel: null,
        record: {
          turnId,
          slug,
          status: 'running',
          model,
          startedAt,
          finishedAt: null,
          events: [],
          assistantMessage: null,
          suggestions: [],
          error: null,
        },
      });
    },

    attachCanceler: (turnId, cancel) => {
      find(turnId).cancel = cancel;
    },

    appendEvents: (turnId, events) => {
      const turn = turns.get(turnId);
      if (turn === undefined || events.length === 0) {
        return;
      }
      turn.record = { ...turn.record, events: [...turn.record.events, ...events] };
    },

    settle: (turnId, settlement) => {
      const turn = find(turnId);
      if (turn.record.status !== 'running') {
        return;
      }
      turn.cancel = null;
      turn.record = {
        ...turn.record,
        status: settlement.status,
        finishedAt: settlement.finishedAt,
        assistantMessage: settlement.assistantMessage ?? null,
        suggestions: settlement.suggestions ?? [],
        error: settlement.error ?? null,
      };
    },

    get: (turnId) => find(turnId).record,

    activeFor,

    cancelAll: () => {
      let canceled = 0;
      for (const turn of turns.values()) {
        if (turn.record.status === 'running') {
          turn.cancel?.();
          canceled += 1;
        }
      }
      return canceled;
    },

    requestCancel: (turnId) => {
      const turn = find(turnId);
      if (turn.record.status !== 'running') {
        throw new PipelineStageError({
          code: 'PRODUCER_TURN_NOT_CANCELABLE',
          stage: null,
          resource: turnId,
          expected: 'a running turn',
        });
      }
      turn.cancel?.();
      return turn.record;
    },
  };
}
