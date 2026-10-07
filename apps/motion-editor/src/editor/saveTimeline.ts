/**
 * Cliente del endpoint dev-only de guardado del timeline (DEC-73-003 §10.6).
 * Sólo existe en desarrollo: `import.meta.env.DEV` se reemplaza por `false`
 * en el build de producción, así que el `fetch` desaparece por DCE. El
 * plugin del servidor (`apply: 'serve'`) tampoco existe en producción: doble
 * garantía de ausencia.
 */
import { validateTimelineShape, type TimelineEntry } from '../videos/define-video';

export type SaveState = 'idle' | 'saving' | 'ok' | 'error';

export interface SaveTimelineClientResult {
  ok: boolean;
  /** Mensaje accionable en español cuando `ok` es false. */
  message?: string;
}

/**
 * Valida localmente (misma regla que el servidor, `validateTimelineShape`) y,
 * si el timeline es válido, guarda `src/videos/<slug>/timeline.json` vía el
 * plugin dev-only. El servidor REVALIDA igual: el cliente no es un control
 * de seguridad, sólo evita un viaje de red innecesario.
 */
export async function saveTimeline(
  slug: string,
  timeline: readonly TimelineEntry[],
): Promise<SaveTimelineClientResult> {
  if (!import.meta.env.DEV) {
    return { ok: false, message: 'El guardado sólo existe en desarrollo.' };
  }

  const errors = validateTimelineShape(timeline).filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, message: errors.map((issue) => issue.message).join(' ') };
  }

  try {
    const res = await fetch('/__motion-editor/save-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, timeline }),
    });

    const data: unknown = await res.json().catch(() => null);
    const parsed = data as { ok?: boolean; message?: string } | null;

    if (!res.ok || parsed?.ok !== true) {
      return { ok: false, message: parsed?.message ?? `Error HTTP ${res.status} al guardar.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error de red inesperado.' };
  }
}
