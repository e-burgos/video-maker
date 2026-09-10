import { describe, expect, it } from 'vitest';

import { producerConversation, producerTurn, succeededTurn } from './__fixtures__/producer';
import {
  isTerminalProducerTurnStatus,
  parseProducerConversation,
  parseProducerTurn,
  parseProducerTurnAccepted,
} from './parse-producer';
import { RenderApiError } from './render-api-error';

function shapeOf(value: object): string[] {
  return Object.keys(value).sort();
}

describe('parseProducerConversation', () => {
  it('accepts the exact shape EP-022 documents and nothing else', () => {
    const parsed = parseProducerConversation(producerConversation());

    expect(shapeOf(parsed)).toEqual(['activeTurn', 'messages', 'session', 'slug']);
    expect(shapeOf(parsed.messages[1] as object)).toEqual([
      'createdAt',
      'id',
      'role',
      'suggestions',
      'text',
      'turnId',
    ]);
    expect(shapeOf(parsed.session as object)).toEqual([
      'createdAt',
      'lastTurnAt',
      'model',
      'sessionId',
    ]);
  });

  it('accepts the empty conversation of a project that never talked to the producer', () => {
    const parsed = parseProducerConversation({
      slug: 'demo-01',
      messages: [],
      session: null,
      activeTurn: null,
    });

    expect(parsed.messages).toEqual([]);
    expect(parsed.session).toBeNull();
  });

  it('carries the running turn when the service reports one', () => {
    const parsed = parseProducerConversation(
      producerConversation({ activeTurn: producerTurn() }),
    );

    expect(parsed.activeTurn?.turnId).toBe('turn-0001');
    expect(parsed.activeTurn?.events).toHaveLength(4);
  });

  it.each([
    ['a message with an unknown role', { role: 'system' }],
    ['a message without createdAt', { createdAt: 3 }],
    ['suggestions that are not strings', { suggestions: [1, 2] }],
    ['a turnId that is not a string', { turnId: 7 }],
  ])('rejects %s', (_label, overrides) => {
    const body = producerConversation();
    Object.assign(body.messages[0] as object, overrides);

    expect(() => parseProducerConversation(body)).toThrow(RenderApiError);
  });

  it('rejects a body without the messages array', () => {
    expect(() =>
      parseProducerConversation({ slug: 'demo-01', session: null, activeTurn: null }),
    ).toThrow(RenderApiError);
  });
});

describe('parseProducerTurn', () => {
  it('accepts the exact shape EP-024 documents', () => {
    const parsed = parseProducerTurn(succeededTurn());

    expect(shapeOf(parsed)).toEqual([
      'assistantMessage',
      'error',
      'events',
      'finishedAt',
      'slug',
      'startedAt',
      'status',
      'suggestions',
      'turnId',
    ]);
  });

  it('accepts the three event shapes and rejects a fourth one', () => {
    expect(
      parseProducerTurn(
        producerTurn({
          events: [
            { type: 'text', text: 'hola' },
            { type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' },
            { type: 'status', status: 'tool failed' },
          ],
        }),
      ).events,
    ).toHaveLength(3);

    expect(() =>
      parseProducerTurn(
        producerTurn({ events: [{ type: 'thinking', text: 'x' } as never] }),
      ),
    ).toThrow(RenderApiError);
  });

  it('rejects a tool event without a summary', () => {
    expect(() =>
      parseProducerTurn(producerTurn({ events: [{ type: 'tool', name: 'Bash' } as never] })),
    ).toThrow(RenderApiError);
  });

  it('carries the typed error of a failed turn', () => {
    const parsed = parseProducerTurn(
      producerTurn({
        status: 'failed',
        finishedAt: '2026-09-10T10:02:00.000Z',
        error: { code: 'PRODUCER_RATE_LIMITED', stage: null, message: 'quota exhausted' },
      }),
    );

    expect(parsed.error?.code).toBe('PRODUCER_RATE_LIMITED');
  });

  it('rejects an unknown status', () => {
    expect(() => parseProducerTurn(producerTurn({ status: 'pending' as never }))).toThrow(
      RenderApiError,
    );
  });
});

describe('parseProducerTurnAccepted', () => {
  it('accepts the 202 body of EP-023', () => {
    const parsed = parseProducerTurnAccepted({
      slug: 'demo-01',
      turnId: 'turn-0002',
      startedAt: '2026-09-10T10:10:00.000Z',
      status: 'running',
    });

    expect(shapeOf(parsed)).toEqual(['slug', 'startedAt', 'status', 'turnId']);
  });

  it('rejects a 202 body whose status is not running', () => {
    expect(() =>
      parseProducerTurnAccepted({
        slug: 'demo-01',
        turnId: 'turn-0002',
        startedAt: '2026-09-10T10:10:00.000Z',
        status: 'queued',
      }),
    ).toThrow(RenderApiError);
  });
});

describe('isTerminalProducerTurnStatus', () => {
  it('treats running as the only non terminal status', () => {
    expect(isTerminalProducerTurnStatus('running')).toBe(false);
    expect(isTerminalProducerTurnStatus('succeeded')).toBe(true);
    expect(isTerminalProducerTurnStatus('failed')).toBe(true);
    expect(isTerminalProducerTurnStatus('canceled')).toBe(true);
  });
});
