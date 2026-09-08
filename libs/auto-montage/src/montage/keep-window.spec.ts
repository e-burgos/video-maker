import type { KeepRange } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { clampToKeep, findEnclosingKeep } from './keep-window';

function keep(id: string, startMs: number, endMs: number): KeepRange {
  return { id, startMs, endMs };
}

describe('findEnclosingKeep (D-11)', () => {
  it('devuelve el keep que contiene por completo el rango pedido', () => {
    const keeps = [keep('keep-0001', 0, 1000), keep('keep-0002', 2000, 5000)];

    expect(findEnclosingKeep(keeps, 2200, 2800)?.id).toBe('keep-0002');
  });

  it('devuelve undefined si el rango no cabe entero en ningún keep', () => {
    const keeps = [keep('keep-0001', 0, 1000)];

    expect(findEnclosingKeep(keeps, 800, 1200)).toBeUndefined();
  });

  it('devuelve undefined si el startMs no cae en ningún keep', () => {
    const keeps = [keep('keep-0001', 0, 1000), keep('keep-0002', 2000, 5000)];

    expect(findEnclosingKeep(keeps, 1500, 1600)).toBeUndefined();
  });
});

describe('clampToKeep (D-11)', () => {
  it('clampea endMs cuando el rango excede el final del keep', () => {
    expect(clampToKeep(keep('keep-0001', 0, 1000), 800, 1500)).toEqual({
      startMs: 800,
      endMs: 1000,
    });
  });

  it('no modifica endMs cuando ya cae dentro del keep', () => {
    expect(clampToKeep(keep('keep-0001', 0, 1000), 200, 600)).toEqual({
      startMs: 200,
      endMs: 600,
    });
  });

  it('devuelve undefined si startMs cae antes del keep', () => {
    expect(clampToKeep(keep('keep-0001', 500, 1000), 200, 800)).toBeUndefined();
  });

  it('devuelve undefined si startMs cae en o después del final del keep', () => {
    expect(clampToKeep(keep('keep-0001', 0, 1000), 1000, 1200)).toBeUndefined();
  });
});
