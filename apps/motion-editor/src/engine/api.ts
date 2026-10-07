/**
 * Fachada tipada sobre el motor de animación y el panel de tweaks.
 *
 * Los dos son librerías vendorizadas (`.jsx`) que exportan a `window`.
 * Importarlas acá — después de global-react — garantiza el orden de
 * evaluación, así que el resto del proyecto sólo importa desde este módulo
 * y trabaja siempre con tipos.
 */
import type { CSSProperties, ReactNode, ComponentType } from 'react';

import './global-react';
import './animations-v2.jsx';
import '../tweaks/tweaks-panel.jsx';

/* ── Tipos del motor ── */

export type EaseFn = (t: number) => number;

export interface EasingLib {
  linear: EaseFn;
  easeInQuad: EaseFn; easeOutQuad: EaseFn; easeInOutQuad: EaseFn;
  easeInCubic: EaseFn; easeOutCubic: EaseFn; easeInOutCubic: EaseFn;
  easeInQuart: EaseFn; easeOutQuart: EaseFn; easeInOutQuart: EaseFn;
  easeInExpo: EaseFn; easeOutExpo: EaseFn; easeInOutExpo: EaseFn;
  easeInSine: EaseFn; easeOutSine: EaseFn; easeInOutSine: EaseFn;
  easeOutBack: EaseFn; easeInOutBack: EaseFn;
  easeOutElastic: EaseFn;
  [name: string]: EaseFn;
}

/** Una entrada de la lista de escenas (window.OM_SCENES). */
export interface SceneEntry {
  /** Debe coincidir con una clave de SCENE_MAP. */
  name: string;
  /** Duración en segundos. */
  dur: number;
  /** Ancla de time-stretch: la administra el editor, no la escribas a mano. */
  nat?: number;
  [extra: string]: unknown;
}

/** Lo que devuelve useScene() dentro de una escena activa. */
export interface SceneState {
  /** Reloj local de la escena, en segundos desde su primer frame. */
  localTime: number;
  /** 0 → 1 a lo largo de la escena. */
  progress: number;
  /** Duración de pared de la escena, en segundos. */
  dur: number;
  /** Índice de la escena en la lista. */
  index: number;
  /** Cantidad total de escenas. */
  count: number;
  /** La entrada completa, con cualquier campo extra que le hayas puesto. */
  scene: SceneEntry;
}

export interface SceneStageProps {
  width: number;
  height: number;
  /** El literal JSON tal cual viene de window.OM_SCENES — no lo re-serialices. */
  scenes: string;
  /** El literal JSON tal cual viene de window.OM_PLAYBACK. */
  playback?: string;
  bg?: string;
  autoplay?: boolean;
  transition?: 'cut' | 'overlap';
  /** Mapa nombre de escena → componente. */
  children: Record<string, ComponentType>;
}

interface EngineGlobals {
  Easing: EasingLib;
  clamp: (v: number, min: number, max: number) => number;
  interpolate: (t: number, input: number[], output: number[], ease?: EaseFn) => number;
  useScene: () => SceneState;
  SceneStage: ComponentType<SceneStageProps>;
}

/* ── Tipos del panel de tweaks ── */

export interface TweakDefaults {
  captions: boolean;
  motionEditor: boolean;
  [key: string]: unknown;
}

interface TweaksGlobals {
  useTweaks: <T extends object>(defaults: T) => [T, (key: keyof T & string, value: unknown) => void];
  TweaksPanel: ComponentType<{ children?: ReactNode }>;
  TweakSection: ComponentType<{ label: string }>;
  TweakToggle: ComponentType<{ label: string; value: boolean; onChange: (v: boolean) => void }>;
  TweakSlider: ComponentType<{
    label: string; value: number; min: number; max: number;
    step?: number; unit?: string; onChange: (v: number) => void;
  }>;
  TweakColor: ComponentType<{
    label: string; value: string; options: string[]; onChange: (v: string) => void;
  }>;
}

type Globals = EngineGlobals & TweaksGlobals;

const g = window as unknown as Globals;

export const Easing = g.Easing;
export const clamp = g.clamp;
export const interpolate = g.interpolate;
export const useScene = g.useScene;
export const SceneStage = g.SceneStage;

export const useTweaks = g.useTweaks;
export const TweaksPanel = g.TweaksPanel;
export const TweakSection = g.TweakSection;
export const TweakToggle = g.TweakToggle;
export const TweakSlider = g.TweakSlider;
export const TweakColor = g.TweakColor;

/** Atajo para estilos inline, que es cómo se estila todo el video. */
export type S = CSSProperties;
