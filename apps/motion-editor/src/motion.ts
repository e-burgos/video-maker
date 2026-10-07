import type { CSSProperties } from 'react';
import { Easing, clamp, useScene, type EaseFn, type SceneEntry } from './engine/api';

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Progreso 0→1 de un tramo que arranca en `at` y dura `dur` segundos
 * del reloj local de la escena.
 */
export const seg = (t: number, at: number, dur: number, ease?: EaseFn): number => {
  const p = clamp((t - at) / dur, 0, 1);
  return ease ? ease(p) : p;
};

export interface EnterStyle extends CSSProperties {
  opacity: number;
  transform: string;
}

/**
 * Los TRES únicos helpers de movimiento del video.
 * Regla del proyecto: no usar easing ni transforms fuera de acá — es lo que
 * mantiene el ritmo consistente entre escenas.
 */
export const MOTION = {
  /** Aparición: sube y se opaca. */
  enter(t: number, at: number, dur = 0.55, dy = 26): EnterStyle {
    const p = seg(t, at, dur, Easing.easeOutCubic);
    return { opacity: p, transform: `translateY(${(1 - p) * dy}px)` };
  },
  /** Trazo: 0→1 para barras, líneas, contadores y barridos. */
  draw(t: number, at: number, dur = 0.8): number {
    return seg(t, at, dur, Easing.easeOutCubic);
  },
  /** Escala con leve sobrepaso, para entradas de piezas grandes. */
  pop(t: number, at: number, dur = 0.5): number {
    return 0.94 + 0.06 * seg(t, at, dur, Easing.easeOutBack);
  },
};

export interface Clock {
  /** Reloj local de la escena, en segundos. */
  t: number;
  /** Largo natural de la escena (soporta el time-stretch del editor). */
  len: number;
  /** 0 → 1 a lo largo de la escena. */
  p: number;
  /** La entrada de la escena, con sus campos extra. */
  scene: SceneEntry;
}

/**
 * Reloj normalizado de escena. Toda la animación tiene que salir de acá:
 * si usás tu propio clock, el editor de timeline y el export de video se
 * desincronizan.
 */
export function useClock(): Clock {
  const s = useScene();
  const t = s.localTime;
  const len = s.progress > 0.002 ? t / s.progress : s.dur;
  return { t, len, p: s.progress, scene: s.scene };
}
