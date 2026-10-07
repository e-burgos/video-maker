/**
 * Núcleo puro del endpoint dev-only de guardado del timeline (DEC-73-003).
 * Sin dependencias de Vite: recibe la raíz de `src/videos/` y el body YA
 * parseado, y devuelve status + body. El middleware (`save-timeline.ts`) es
 * un adaptador delgado sobre esta función.
 *
 * ÚNICA SUPERFICIE DE SEGURIDAD REAL DEL CICLO (INV-LOCAL-33-2): el slug que
 * llega en el body NUNCA se concatena a un path. Se COMPARA contra el
 * listado de carpetas leído del disco (`listVideoSlugs`), y el path de
 * destino se arma con el nombre que devolvió `readdir`, nunca con el string
 * del request. Ver §5.3 de `sdd/cycles/cycle-73/architect.md`.
 */
import { existsSync, readdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { validateTimelineShape, type TimelineEntry } from '../src/videos/define-video';

export type SaveTimelineErrorCode =
  | 'invalid_payload'
  | 'unknown_slug'
  | 'invalid_timeline'
  | 'path_assertion_failed'
  | 'write_failed';

export interface SaveTimelineResult {
  status: 200 | 400 | 403 | 405 | 413 | 415 | 422 | 500;
  body:
    | { ok: true; path: string; bytes: number; scenes: number }
    | { ok: false; error: SaveTimelineErrorCode; message: string };
}

/**
 * Lista las carpetas de `videosRoot` que tienen AMBOS `video.ts` y
 * `timeline.json` — la misma convención que usa el registro del lado
 * cliente (`build-registry.ts`). Se recalcula en cada llamada, contra el
 * disco, nunca contra un caché.
 */
export function listVideoSlugs(videosRoot: string): string[] {
  if (!existsSync(videosRoot)) return [];

  return readdirSync(videosRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter(
      (entry) =>
        existsSync(join(videosRoot, entry.name, 'video.ts')) &&
        existsSync(join(videosRoot, entry.name, 'timeline.json')),
    )
    .map((entry) => entry.name);
}

/** Contador monótono de módulo para el sufijo del archivo temporal (nunca Date.now/Math.random, ver §5.5). */
let tmpFileCounter = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Orden fijo de claves al serializar una entrada: name, dur, nat (si es número finito), luego el resto alfabético. */
function serializeEntry(entry: TimelineEntry): Record<string, unknown> {
  const { name, dur, nat, ...rest } = entry;
  const ordered: Record<string, unknown> = { name, dur };
  if (typeof nat === 'number' && Number.isFinite(nat)) {
    ordered.nat = nat;
  }
  for (const key of Object.keys(rest).sort()) {
    ordered[key] = rest[key];
  }
  return ordered;
}

/**
 * Núcleo puro: recibe el body YA parseado y la raíz de `src/videos/`;
 * devuelve status + body. No conoce HTTP: el middleware traduce esto a una
 * respuesta real.
 */
export function saveTimeline(args: { videosRoot: string; body: unknown }): SaveTimelineResult {
  const { videosRoot, body } = args;

  // 1. Payload: forma mínima antes de tocar el disco.
  if (!isPlainObject(body)) {
    return reject(400, 'invalid_payload', 'El body tiene que ser un objeto JSON.');
  }
  const { slug, timeline } = body;
  if (typeof slug !== 'string') {
    return reject(400, 'invalid_payload', 'Falta "slug" (string) o no es del tipo esperado.');
  }
  if (timeline === undefined) {
    return reject(400, 'invalid_payload', 'Falta "timeline" (array).');
  }

  // 2. El listado sale del DISCO, no del request.
  const known = listVideoSlugs(videosRoot);

  // 3. El slug recibido SÓLO se COMPARA. Nunca se concatena.
  const folder = known.find((name) => name === slug);
  if (folder === undefined) {
    return reject(
      403,
      'unknown_slug',
      `El video "${slug}" no existe en src/videos/. Videos disponibles: ${known.join(', ')}.`,
    );
  }

  // 4. El path se arma con el nombre que devolvió readdir, NO con el del request.
  const target = join(videosRoot, folder, 'timeline.json');

  // 5. Aserción defensiva (redundante por construcción; protege contra un refactor futuro).
  const rel = relative(videosRoot, target).split(sep);
  if (rel.length !== 2 || rel[0] !== folder || rel[1] !== 'timeline.json') {
    return reject(500, 'path_assertion_failed', 'La ruta de destino calculada no es la esperada.');
  }

  // 6. Validación estructural: misma regla que usa defineVideo, un solo lugar.
  const issues = validateTimelineShape(timeline);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return reject(422, 'invalid_timeline', errors.map((issue) => issue.message).join(' '));
  }

  // 7. Serialización con orden de claves fijo, indentado 2, LF, newline final.
  const entries = (timeline as readonly TimelineEntry[]).map(serializeEntry);
  const content = JSON.stringify(entries, null, 2) + '\n';

  // 8. Escritura atómica: tmp en el mismo directorio + rename.
  const tmpPath = join(videosRoot, folder, `timeline.json.tmp-${process.pid}-${tmpFileCounter++}`);
  try {
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, target);
  } catch {
    try {
      unlinkSync(tmpPath);
    } catch {
      // el temporal puede no haberse llegado a crear; no es un error a reportar
    }
    return reject(500, 'write_failed', 'No se pudo escribir timeline.json (permisos o disco).');
  }

  return {
    status: 200,
    body: {
      ok: true,
      path: `src/videos/${folder}/timeline.json`,
      bytes: Buffer.byteLength(content, 'utf-8'),
      scenes: entries.length,
    },
  };
}

function reject(
  status: 400 | 403 | 405 | 413 | 415 | 422 | 500,
  error: SaveTimelineErrorCode,
  message: string,
): SaveTimelineResult {
  return { status, body: { ok: false, error, message } };
}
