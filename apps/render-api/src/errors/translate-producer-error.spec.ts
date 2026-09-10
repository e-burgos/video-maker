import { describe, expect, it } from 'vitest';

import type { ProducerTurnResult } from '../producer/producer-agent';
import { classifyProducerTurn } from './translate-producer-error';

const OK: ProducerTurnResult = {
  exitCode: 0,
  canceled: false,
  timedOut: false,
  spawnFailed: false,
  stderr: '',
};

function classify(result: Partial<ProducerTurnResult>, rateLimited = false, hasAnswer = true) {
  return classifyProducerTurn({ result: { ...OK, ...result }, rateLimited, hasAnswer });
}

function codeOf(outcome: ReturnType<typeof classify>): string {
  return outcome.kind === 'failed' ? outcome.error.code : outcome.kind;
}

describe('classifyProducerTurn', () => {
  it('un turno con respuesta y exit 0 es éxito', () => {
    expect(classify({})).toEqual({ kind: 'succeeded' });
  });

  it('el binario ausente gana sobre todo lo demás: PRODUCER_UNAVAILABLE', () => {
    expect(codeOf(classify({ spawnFailed: true, canceled: true, exitCode: null }, true, false))).toBe(
      'PRODUCER_UNAVAILABLE',
    );
  });

  it('la cancelación del usuario no es un error del productor', () => {
    expect(classify({ canceled: true, exitCode: null }, false, false)).toEqual({ kind: 'canceled' });
  });

  it('el 429 de la suscripción sale como PRODUCER_RATE_LIMITED, no como fallo genérico', () => {
    expect(codeOf(classify({ exitCode: 1 }, true, false))).toBe('PRODUCER_RATE_LIMITED');
  });

  it('el timeout y la falta de respuesta salen como PRODUCER_TURN_FAILED con hints distintos', () => {
    const timedOut = classify({ timedOut: true, exitCode: null }, false, false);
    const noAnswer = classify({ exitCode: 1 }, false, false);

    expect(codeOf(timedOut)).toBe('PRODUCER_TURN_FAILED');
    expect(codeOf(noAnswer)).toBe('PRODUCER_TURN_FAILED');
    expect(timedOut.kind === 'failed' ? timedOut.error.hint : null).toContain(
      'PRODUCER_TURN_TIMEOUT_MS',
    );
    expect(noAnswer.kind === 'failed' ? noAnswer.error.hint : null).toContain('manually');
  });

  it('un exit 0 sin respuesta del asistente tampoco es éxito', () => {
    expect(codeOf(classify({ exitCode: 0 }, false, false))).toBe('PRODUCER_TURN_FAILED');
  });

  it('nunca filtra el stderr del proceso al payload del error', () => {
    const outcome = classify({ exitCode: 1, stderr: '/Users/dev/secret/path exploded' }, false, false);
    const payload = JSON.stringify(outcome.kind === 'failed' ? outcome.error.hint : '');
    expect(payload).not.toContain('/Users/dev');
  });
});
