/**
 * Test-first (TASK-TEST-FE-73-05) de las validaciones de `defineVideo`
 * (DEC-73-002, tabla §3.4 de architect.md). `defineVideo` hoy es la versión
 * PROVISORIA (TASK-FE-73-01): sin las 11 reglas. Este archivo tiene que fallar
 * (rojo) antes de implementarlas en TASK-FE-73-06.
 *
 * Contrato duro: NUNCA `throw`. Todo se acumula en `issues[]`.
 */
import { describe, expect, it, vi } from 'vitest';
import { defineVideo, validateTimelineShape } from './define-video';

const Comp = () => null;

describe('defineVideo — nunca tira, siempre devuelve un objeto', () => {
  it('no tira aunque el input esté completamente roto', () => {
    expect(() =>
      // @ts-expect-error input deliberadamente inválido para probar robustez
      defineVideo({}),
    ).not.toThrow();
  });

  it('video sano: sin issues, valores normalizados', () => {
    const v = defineVideo({
      title: '  Cómo funciona  ',
      audience: 'prospecto',
      scenes: { Apertura: Comp },
      timeline: [{ name: 'Apertura', dur: 8 }],
    });
    expect(v.issues).toEqual([]);
    expect(v.title).toBe('Cómo funciona');
    expect(v.width).toBe(1920);
    expect(v.height).toBe(1080);
    expect(v.fps).toBe(30);
    expect(v.playback).toEqual({ mode: 'loop' });
    expect(v.kind).toBe('display-ads/video-definition');
  });

  it('missing-title: título vacío o ausente', () => {
    const v = defineVideo({
      title: '   ',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [{ name: 'A', dur: 1 }],
    });
    expect(v.issues.some((i) => i.code === 'missing-title' && i.severity === 'error')).toBe(true);
  });

  it('invalid-audience: valor fuera de prospecto/cliente', () => {
    const v = defineVideo({
      title: 'X',
      // @ts-expect-error audience inválida a propósito
      audience: 'inversor',
      scenes: { A: Comp },
      timeline: [{ name: 'A', dur: 1 }],
    });
    const issue = v.issues.find((i) => i.code === 'invalid-audience');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('inversor');
  });

  it('empty-scenes: scenes vacío', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: {},
      timeline: [{ name: 'A', dur: 1 }],
    });
    expect(v.issues.some((i) => i.code === 'empty-scenes')).toBe(true);
  });

  it('empty-timeline: timeline vacío', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [],
    });
    expect(v.issues.some((i) => i.code === 'empty-timeline')).toBe(true);
  });

  it('scene-not-found: el video sigue devolviéndose (no pantalla negra) y nombra la escena', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { Apertura: Comp },
      timeline: [{ name: 'Mañana', dur: 5 }],
    });
    const issue = v.issues.find((i) => i.code === 'scene-not-found');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('Mañana');
    expect(issue?.message).toContain('Apertura');
    // Sigue habiendo un objeto devuelto (contrato: nunca throw, nunca undefined).
    expect(v.kind).toBe('display-ads/video-definition');
  });

  it('invalid-duration: dur en cero o negativa señala la escena puntual', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp, B: Comp },
      timeline: [
        { name: 'A', dur: 0 },
        { name: 'B', dur: -3 },
      ],
    });
    const issues = v.issues.filter((i) => i.code === 'invalid-duration');
    expect(issues).toHaveLength(2);
    expect(issues.some((i) => i.message.includes('A'))).toBe(true);
    expect(issues.some((i) => i.message.includes('B'))).toBe(true);
  });

  it('duplicate-scene-name: nombre repetido en el timeline', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [
        { name: 'A', dur: 1 },
        { name: 'A', dur: 2 },
      ],
    });
    const issue = v.issues.find((i) => i.code === 'duplicate-scene-name');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('A');
  });

  it('unused-scene: componente declarado que ningún tramo usa — warning, no error', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp, SinUsar: Comp },
      timeline: [{ name: 'A', dur: 1 }],
    });
    const issue = v.issues.find((i) => i.code === 'unused-scene');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('SinUsar');
  });

  it('invalid-dimensions: width/height no enteros positivos', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [{ name: 'A', dur: 1 }],
      width: -1,
      height: 0,
    });
    expect(v.issues.some((i) => i.code === 'invalid-dimensions')).toBe(true);
  });

  it('invalid-fps: fps no finito o no positivo', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [{ name: 'A', dur: 1 }],
      fps: 0,
    });
    expect(v.issues.some((i) => i.code === 'invalid-fps')).toBe(true);
  });

  it('junta TODOS los issues de una pasada, no corta en el primero', () => {
    const v = defineVideo({
      title: 'X',
      audience: 'prospecto',
      scenes: { A: Comp },
      timeline: [
        { name: 'A', dur: 0 },
        { name: 'B', dur: -1 },
      ],
    });
    // invalid-duration (A), invalid-duration (B) y scene-not-found (B).
    expect(v.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('hace console.error una vez por issue de severidad error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    defineVideo({
      title: '',
      audience: 'prospecto',
      scenes: {},
      timeline: [],
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('validateTimelineShape — validación estructural reutilizada por el plugin de guardado', () => {
  it('array vacío es inválido', () => {
    expect(validateTimelineShape([]).length).toBeGreaterThan(0);
  });

  it('timeline válido no produce issues', () => {
    expect(validateTimelineShape([{ name: 'A', dur: 1 }])).toEqual([]);
  });

  it('dur inválida produce issue', () => {
    expect(validateTimelineShape([{ name: 'A', dur: 0 }]).length).toBeGreaterThan(0);
  });
});
