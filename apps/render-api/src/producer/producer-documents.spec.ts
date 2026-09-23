import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { parseProducerConversation, parseProducerSession } from './producer-documents';
import type { ProducerMessage } from './producer-documents';

const PATH = 'work/producer/conversation.json';

const USER_MESSAGE = {
  id: 'msg-0001',
  role: 'user',
  text: 'Contame qué material hay',
  createdAt: '2026-09-10T10:00:00.000Z',
};

const ASSISTANT_MESSAGE = {
  id: 'msg-0002',
  role: 'assistant',
  text: 'Tenés un A-roll y tres fotos',
  createdAt: '2026-09-10T10:01:00.000Z',
  suggestions: ['Proponé un guion', 'Buscá música libre'],
  turnId: 'turn-0001',
};

function codeOf(run: () => unknown): string {
  try {
    run();
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('parseProducerConversation', () => {
  it('acepta el documento completo y devuelve las claves del contrato, ni una más', () => {
    const conversation = parseProducerConversation(
      { messages: [USER_MESSAGE, ASSISTANT_MESSAGE] },
      PATH,
    );

    expect(conversation.messages).toHaveLength(2);
    expect(Object.keys(conversation.messages[0] as ProducerMessage).sort()).toEqual([
      'createdAt',
      'id',
      'role',
      'text',
    ]);
    expect(Object.keys(conversation.messages[1] as ProducerMessage).sort()).toEqual([
      'createdAt',
      'id',
      'role',
      'suggestions',
      'text',
      'turnId',
    ]);
    expect(conversation.messages[1]?.suggestions).toEqual([
      'Proponé un guion',
      'Buscá música libre',
    ]);
  });

  it('acepta un texto vacío del asistente pero no un id ni un createdAt vacíos', () => {
    expect(parseProducerConversation({ messages: [{ ...USER_MESSAGE, text: '' }] }, PATH).messages).toHaveLength(1);
    expect(codeOf(() => parseProducerConversation({ messages: [{ ...USER_MESSAGE, id: '' }] }, PATH))).toBe(
      'PRODUCER_STATE_INVALID',
    );
    expect(codeOf(() => parseProducerConversation({ messages: [{ ...USER_MESSAGE, createdAt: '' }] }, PATH))).toBe(
      'PRODUCER_STATE_INVALID',
    );
  });

  it('rechaza el documento sin messages, un mensaje que no es objeto y un rol desconocido', () => {
    expect(codeOf(() => parseProducerConversation({}, PATH))).toBe('PRODUCER_STATE_INVALID');
    expect(codeOf(() => parseProducerConversation({ messages: ['hola'] }, PATH))).toBe('PRODUCER_STATE_INVALID');
    expect(codeOf(() => parseProducerConversation({ messages: [{ ...USER_MESSAGE, role: 'system' }] }, PATH))).toBe(
      'PRODUCER_STATE_INVALID',
    );
  });

  it('rechaza suggestions que no son strings y un turnId vacío', () => {
    expect(
      codeOf(() => parseProducerConversation({ messages: [{ ...ASSISTANT_MESSAGE, suggestions: [1] }] }, PATH)),
    ).toBe('PRODUCER_STATE_INVALID');
    expect(
      codeOf(() => parseProducerConversation({ messages: [{ ...ASSISTANT_MESSAGE, turnId: '' }] }, PATH)),
    ).toBe('PRODUCER_STATE_INVALID');
  });

  it('nombra el archivo ilegible en el resource del error', () => {
    try {
      parseProducerConversation({ messages: [{ role: 'user' }] }, PATH);
      expect.unreachable('debía tirar');
    } catch (error) {
      expect(isRenderApiError(error) ? error.resource : null).toBe(PATH);
    }
  });
});

describe('parseProducerSession', () => {
  it('acepta la sesión completa', () => {
    expect(
      parseProducerSession(
        {
          sessionId: '11111111-2222-3333-4444-555555555555',
          model: 'sonnet',
          createdAt: '2026-09-10T10:00:00.000Z',
          lastTurnAt: '2026-09-10T10:20:00.000Z',
        },
        'work/producer/session.json',
      ),
    ).toEqual({
      sessionId: '11111111-2222-3333-4444-555555555555',
      model: 'sonnet',
      createdAt: '2026-09-10T10:00:00.000Z',
      lastTurnAt: '2026-09-10T10:20:00.000Z',
    });
  });

  it('rechaza la sesión sin sessionId, sin model o que no es objeto', () => {
    expect(codeOf(() => parseProducerSession([], 'work/producer/session.json'))).toBe('PRODUCER_STATE_INVALID');
    expect(
      codeOf(() =>
        parseProducerSession(
          { model: 'sonnet', createdAt: 'a', lastTurnAt: 'b' },
          'work/producer/session.json',
        ),
      ),
    ).toBe('PRODUCER_STATE_INVALID');
    expect(
      codeOf(() =>
        parseProducerSession(
          { sessionId: 'x', createdAt: 'a', lastTurnAt: 'b' },
          'work/producer/session.json',
        ),
      ),
    ).toBe('PRODUCER_STATE_INVALID');
  });
});
