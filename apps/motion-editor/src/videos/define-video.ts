/**
 * Contrato de `video.ts` (DEC-73-002). `defineVideo` NUNCA tira excepciones:
 * normaliza el input, acumula diagnósticos en `issues[]` y devuelve siempre un
 * objeto. El slug NO viaja acá — lo pone el registro a partir del nombre de la
 * carpeta (DEC-OWNER-33-04). Las 11 reglas de validación están en la tabla
 * §3.4 de `architect.md` (TASK-FE-73-06).
 */
import type { ComponentType } from 'react';

/** Audiencia del video. Define el tono del guion, no el render. */
export type VideoAudience = 'prospecto' | 'cliente';

/** Modo de reproducción del stage. Se serializa a JSON para <SceneStage playback>. */
export interface VideoPlayback {
  mode: 'loop' | 'once';
}

/** Una entrada del timeline: nombre de escena + duración de pared, en segundos. */
export interface TimelineEntry {
  /** Tiene que coincidir EXACTAMENTE con una clave de `scenes`. */
  name: string;
  /** Duración en segundos. Número finito > 0. */
  dur: number;
  /** Ancla de time-stretch. La administra el editor; no se escribe a mano. */
  nat?: number;
  /** Campos extra que el editor pueda agregar en el futuro: se preservan al guardar. */
  [extra: string]: unknown;
}

/** Lo que el autor escribe en `src/videos/<slug>/video.ts`. NO lleva `slug`. */
export interface VideoInput {
  /** Título humano, el que se ve en el selector. Obligatorio, no vacío. */
  title: string;
  /** Obligatorio. */
  audience: VideoAudience;
  /** Mapa nombre de escena → componente. Obligatorio, al menos una entrada. */
  scenes: Record<string, ComponentType>;
  /** Timeline, normalmente `import timeline from './timeline.json'`. Obligatorio, no vacío. */
  timeline: readonly TimelineEntry[];
  /** Default 1920. DEC-OWNER-33-09: no se ejercita otro valor en este ciclo. */
  width?: number;
  /** Default 1080. */
  height?: number;
  /** Default 30. */
  fps?: number;
  /** Default { mode: 'loop' }. */
  playback?: VideoPlayback;
}

export type VideoIssueCode =
  | 'missing-title'
  | 'invalid-audience'
  | 'empty-scenes'
  | 'empty-timeline'
  | 'invalid-timeline-entry'
  | 'scene-not-found'
  | 'invalid-duration'
  | 'duplicate-scene-name'
  | 'unused-scene'
  | 'invalid-dimensions'
  | 'invalid-fps'
  /** Sólo la emite `validateTimelineShape` (usada también por el plugin de guardado, DEC-73-003 §5.4). */
  | 'invalid-nat'
  /** Idem: tope de sanidad de 500 entradas, DEC-73-003 §5.4. */
  | 'timeline-too-long';

export interface VideoIssue {
  /** 'error' ⇒ el video no se puede reproducir. 'warning' ⇒ se reproduce, pero avisa. */
  severity: 'error' | 'warning';
  code: VideoIssueCode;
  /** Mensaje accionable, en español, SIN el path (lo agrega el registro). */
  message: string;
}

/**
 * Resultado de defineVideo. NO tiene `slug`: lo pone el registro a partir del
 * nombre de la carpeta (DEC-OWNER-33-04).
 */
export interface VideoDefinition {
  /** Marca de origen: permite al registro verificar que el default export salió de defineVideo(). */
  readonly kind: 'display-ads/video-definition';
  title: string;
  audience: VideoAudience;
  width: number;
  height: number;
  fps: number;
  playback: VideoPlayback;
  scenes: Record<string, ComponentType>;
  /** Normalizado: array propio (no el objeto importado del JSON), en el orden declarado. */
  timeline: TimelineEntry[];
  /** Vacío = video sano. Nunca `undefined`. */
  issues: VideoIssue[];
}

const VALID_AUDIENCES: readonly VideoAudience[] = ['prospecto', 'cliente'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida la FORMA del timeline (sin conocer `scenes`): usada tanto por
 * `defineVideo` como por el plugin de guardado del editor (misma regla, un
 * solo lugar — DEC-73-003 §5.4).
 */
export function validateTimelineShape(timeline: unknown): VideoIssue[] {
  const issues: VideoIssue[] = [];

  if (!Array.isArray(timeline) || timeline.length === 0) {
    issues.push({
      severity: 'error',
      code: 'empty-timeline',
      message: '"timeline" está vacío. Cargá al menos una escena en timeline.json.',
    });
    return issues;
  }

  /** Tope de sanidad del plugin de guardado (DEC-73-003 §5.4): 500 entradas. */
  if (timeline.length > 500) {
    issues.push({
      severity: 'error',
      code: 'timeline-too-long',
      message: `el timeline tiene ${timeline.length} entradas; el máximo admitido es 500.`,
    });
  }

  const seenNames = new Map<string, number>();
  timeline.forEach((entry, i) => {
    if (!isPlainObject(entry) || typeof entry.name !== 'string' || entry.name.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'invalid-timeline-entry',
        message: `la entrada #${i} del timeline no tiene un "name" válido.`,
      });
      return;
    }

    const name = entry.name;
    const dur = entry.dur;
    if (typeof dur !== 'number' || !Number.isFinite(dur) || dur <= 0) {
      issues.push({
        severity: 'error',
        code: 'invalid-duration',
        message: `la escena "${name}" tiene dur=${String(dur)}. La duración tiene que ser un número finito mayor que 0.`,
      });
    }

    const nat = entry.nat;
    if (nat !== undefined && (typeof nat !== 'number' || !Number.isFinite(nat) || nat <= 0)) {
      issues.push({
        severity: 'error',
        code: 'invalid-nat',
        message: `la escena "${name}" tiene nat=${String(nat)}. Si viene, tiene que ser un número finito mayor que 0.`,
      });
    }

    const firstIndex = seenNames.get(name);
    if (firstIndex !== undefined) {
      issues.push({
        severity: 'error',
        code: 'duplicate-scene-name',
        message: `el nombre de escena "${name}" está repetido en el timeline (posiciones ${firstIndex} y ${i}). Los nombres tienen que ser únicos.`,
      });
    } else {
      seenNames.set(name, i);
    }
  });

  return issues;
}

/**
 * Declara un video. Normaliza defaults, valida y ACUMULA diagnósticos: NUNCA tira.
 * Si hay issues de severidad 'error', además hace console.error una vez por issue.
 */
export function defineVideo(input: VideoInput): VideoDefinition {
  const issues: VideoIssue[] = [];

  const rawTitle = input?.title;
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (title === '') {
    issues.push({
      severity: 'error',
      code: 'missing-title',
      message: 'falta "title" o está vacío. Es el nombre que se ve en el selector.',
    });
  }

  const audience = input?.audience;
  if (!VALID_AUDIENCES.includes(audience)) {
    issues.push({
      severity: 'error',
      code: 'invalid-audience',
      message: `"audience" tiene que ser "prospecto" o "cliente"; llegó «${String(audience)}».`,
    });
  }

  const scenes = isPlainObject(input?.scenes)
    ? (input.scenes as Record<string, ComponentType>)
    : {};
  const sceneKeys = Object.keys(scenes);
  if (sceneKeys.length === 0) {
    issues.push({
      severity: 'error',
      code: 'empty-scenes',
      message: '"scenes" está vacío: no hay ningún componente de escena declarado.',
    });
  }

  const rawTimeline = Array.isArray(input?.timeline) ? input.timeline : [];
  if (rawTimeline.length === 0) {
    issues.push({
      severity: 'error',
      code: 'empty-timeline',
      message: '"timeline" está vacío. Cargá al menos una escena en timeline.json.',
    });
  }

  const timeline: TimelineEntry[] = [];
  const seenNames = new Map<string, number>();
  const usedSceneNames = new Set<string>();

  rawTimeline.forEach((rawEntry, i) => {
    if (
      !isPlainObject(rawEntry) ||
      typeof (rawEntry as { name?: unknown }).name !== 'string' ||
      (rawEntry as { name: string }).name.trim() === ''
    ) {
      issues.push({
        severity: 'error',
        code: 'invalid-timeline-entry',
        message: `la entrada #${i} del timeline no tiene un "name" válido.`,
      });
      return;
    }

    const entry = { ...rawEntry } as TimelineEntry;
    const name = entry.name;
    timeline.push(entry);

    const dur = entry.dur;
    if (typeof dur !== 'number' || !Number.isFinite(dur) || dur <= 0) {
      issues.push({
        severity: 'error',
        code: 'invalid-duration',
        message: `la escena "${name}" tiene dur=${String(dur)}. La duración tiene que ser un número finito mayor que 0.`,
      });
    }

    const firstIndex = seenNames.get(name);
    if (firstIndex !== undefined) {
      issues.push({
        severity: 'error',
        code: 'duplicate-scene-name',
        message: `el nombre de escena "${name}" está repetido en el timeline (posiciones ${firstIndex} y ${i}). Los nombres tienen que ser únicos.`,
      });
    } else {
      seenNames.set(name, i);
    }

    usedSceneNames.add(name);
    if (sceneKeys.length > 0 && !sceneKeys.includes(name)) {
      issues.push({
        severity: 'error',
        code: 'scene-not-found',
        message: `la escena "${name}" está en el timeline pero no existe en "scenes". Claves disponibles: ${sceneKeys.join(', ')}.`,
      });
    }
  });

  for (const key of sceneKeys) {
    if (!usedSceneNames.has(key)) {
      issues.push({
        severity: 'warning',
        code: 'unused-scene',
        message: `el componente "${key}" está en "scenes" pero ningún tramo del timeline lo usa. ¿Te olvidaste de agregarlo a timeline.json?`,
      });
    }
  }

  const width = input?.width ?? 1920;
  const height = input?.height ?? 1080;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    issues.push({
      severity: 'error',
      code: 'invalid-dimensions',
      message: `"width"/"height" tienen que ser enteros mayores que 0; llegó ${width}×${height}.`,
    });
  }

  const fps = input?.fps ?? 30;
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) {
    issues.push({
      severity: 'error',
      code: 'invalid-fps',
      message: `"fps" tiene que ser un número finito mayor que 0; llegó ${String(fps)}.`,
    });
  }

  for (const issue of issues) {
    if (issue.severity === 'error') {
      console.error(`[defineVideo] ${issue.message}`);
    }
  }

  return {
    kind: 'display-ads/video-definition',
    title,
    audience,
    width,
    height,
    fps,
    playback: input?.playback ?? { mode: 'loop' },
    scenes,
    timeline,
    issues,
  };
}

/** Type guard usado por el registro. */
export function isVideoDefinition(value: unknown): value is VideoDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'display-ads/video-definition'
  );
}
