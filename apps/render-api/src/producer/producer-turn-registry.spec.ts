import { describe, expect, it, vi } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { createProducerTurnRegistry } from './producer-turn-registry';

const AT = '2026-09-10T10:00:00.000Z';
const LATER = '2026-09-10T10:05:00.000Z';

function codeOf(run: () => unknown): string {
  try {
    run();
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('createProducerTurnRegistry', () => {
  it('abre el turno en running, sin eventos, sin respuesta y sin error', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);

    expect(registry.get('turn-1')).toEqual({
      turnId: 'turn-1',
      slug: 'demo-01',
      status: 'running',
      startedAt: AT,
      finishedAt: null,
      events: [],
      assistantMessage: null,
      suggestions: [],
      error: null,
    });
  });

  it('rechaza un segundo turno del MISMO proyecto con PRODUCER_TURN_ACTIVE', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);

    expect(codeOf(() => registry.reserve('demo-01', 'turn-2', AT))).toBe('PRODUCER_TURN_ACTIVE');
    expect(codeOf(() => registry.get('turn-2'))).toBe('PRODUCER_TURN_NOT_FOUND');
  });

  it('deja correr en paralelo turnos de proyectos distintos', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.reserve('demo-espacio', 'turn-2', AT);

    expect(registry.activeFor('demo-01')?.turnId).toBe('turn-1');
    expect(registry.activeFor('demo-espacio')?.turnId).toBe('turn-2');
  });

  it('libera el proyecto cuando el turno termina', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.settle('turn-1', { status: 'succeeded', finishedAt: LATER, assistantMessage: 'listo' });

    expect(registry.activeFor('demo-01')).toBeNull();
    registry.reserve('demo-01', 'turn-2', LATER);
    expect(registry.activeFor('demo-01')?.turnId).toBe('turn-2');
  });

  it('acumula los eventos en orden y no pierde los del turno ya cerrado', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.appendEvents('turn-1', [{ type: 'status', status: 'started' }]);
    registry.appendEvents('turn-1', [{ type: 'text', text: 'hola' }]);
    registry.appendEvents('turn-1', []);
    registry.settle('turn-1', { status: 'succeeded', finishedAt: LATER, assistantMessage: 'hola' });

    expect(registry.get('turn-1').events).toEqual([
      { type: 'status', status: 'started' },
      { type: 'text', text: 'hola' },
    ]);
  });

  it('ignora eventos de un turno que no existe en vez de romper el stream', () => {
    const registry = createProducerTurnRegistry();
    expect(() => registry.appendEvents('turn-x', [{ type: 'text', text: 'hola' }])).not.toThrow();
  });

  it('guarda respuesta y sugerencias al cerrar bien, y el error al cerrar mal', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.settle('turn-1', {
      status: 'succeeded',
      finishedAt: LATER,
      assistantMessage: 'listo',
      suggestions: ['Dale'],
    });
    expect(registry.get('turn-1')).toMatchObject({
      status: 'succeeded',
      assistantMessage: 'listo',
      suggestions: ['Dale'],
      error: null,
    });

    registry.reserve('demo-01', 'turn-2', LATER);
    registry.settle('turn-2', {
      status: 'failed',
      finishedAt: LATER,
      error: { code: 'PRODUCER_TURN_FAILED', stage: null, message: 'sin respuesta' },
    });
    expect(registry.get('turn-2')).toMatchObject({
      status: 'failed',
      assistantMessage: null,
      suggestions: [],
      error: { code: 'PRODUCER_TURN_FAILED' },
    });
  });

  it('el primer cierre gana: un settle tardío no pisa el estado terminal', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.settle('turn-1', { status: 'canceled', finishedAt: LATER });
    registry.settle('turn-1', { status: 'succeeded', finishedAt: LATER, assistantMessage: 'tarde' });

    expect(registry.get('turn-1').status).toBe('canceled');
  });

  it('cancelar llama al canceler del proceso hijo y devuelve el turno', () => {
    const registry = createProducerTurnRegistry();
    const cancel = vi.fn();
    registry.reserve('demo-01', 'turn-1', AT);
    registry.attachCanceler('turn-1', cancel);

    expect(registry.requestCancel('turn-1').turnId).toBe('turn-1');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancelar un turno inexistente o ya terminado es 404 y 409, no un no-op silencioso', () => {
    const registry = createProducerTurnRegistry();
    expect(codeOf(() => registry.requestCancel('turn-x'))).toBe('PRODUCER_TURN_NOT_FOUND');

    registry.reserve('demo-01', 'turn-1', AT);
    registry.settle('turn-1', { status: 'succeeded', finishedAt: LATER, assistantMessage: 'ok' });
    expect(codeOf(() => registry.requestCancel('turn-1'))).toBe('PRODUCER_TURN_NOT_CANCELABLE');
  });

  it('cancelar un turno reservado que todavía no arrancó el proceso no rompe', () => {
    const registry = createProducerTurnRegistry();
    registry.reserve('demo-01', 'turn-1', AT);
    expect(() => registry.requestCancel('turn-1')).not.toThrow();
  });

  it('cancelAll mata todo turno vivo y no toca los cerrados: el hijo no puede sobrevivir al servicio', () => {
    const registry = createProducerTurnRegistry();
    const first = vi.fn();
    const second = vi.fn();
    const closed = vi.fn();

    registry.reserve('demo-01', 'turn-1', AT);
    registry.attachCanceler('turn-1', first);
    registry.reserve('demo-espacio', 'turn-2', AT);
    registry.attachCanceler('turn-2', second);
    registry.reserve('otro', 'turn-3', AT);
    registry.attachCanceler('turn-3', closed);
    registry.settle('turn-3', { status: 'succeeded', finishedAt: LATER, assistantMessage: 'ok' });

    expect(registry.cancelAll()).toBe(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    expect(registry.cancelAll()).toBe(2);
  });

  it('activeFor es null para un proyecto que nunca habló', () => {
    expect(createProducerTurnRegistry().activeFor('otro')).toBeNull();
  });
});
