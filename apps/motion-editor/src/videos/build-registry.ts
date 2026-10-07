/**
 * Núcleo puro del registro por convención (DEC-73-001). Sin `import.meta.glob`
 * acá adentro: recibe los mapas ya resueltos por `registry.ts` y produce el
 * listado + los diagnósticos. Testeable con mapas sintéticos, sin fixtures en
 * disco (DEC-73-007).
 */
import type { VideoDefinition, VideoIssueCode } from './define-video';
import { isVideoDefinition } from './define-video';

export type RegistryIssueCode =
  | 'missing-video-module' // hay timeline.json y no hay video.ts
  | 'missing-timeline-file' // hay video.ts y no hay timeline.json
  | 'invalid-slug' // el nombre de carpeta no es kebab-case
  | 'no-default-export'
  | 'not-a-video-definition' // el default export no salió de defineVideo()
  | VideoIssueCode; // los que vienen de defineVideo, re-prefijados

export interface RegistryIssue {
  severity: 'error' | 'warning';
  code: RegistryIssueCode;
  /** Slug afectado, o null si la carpeta ni siquiera produce un slug válido. */
  slug: string | null;
  /** Path relativo a la raíz de la app, para que el mensaje sea accionable. */
  where: string; // p.ej. 'src/videos/conexion-android/video.ts'
  /** Mensaje final, ya prefijado con `where`. */
  message: string;
}

export interface RegisteredVideo {
  /** Derivado del nombre de la carpeta. Única fuente de verdad del identificador. */
  slug: string;
  definition: VideoDefinition;
  /** false si tiene al menos un issue de severidad 'error'. */
  playable: boolean;
  issues: RegistryIssue[];
}

export interface VideoRegistry {
  /** Orden estable: alfabético por slug, localeCompare('es', { numeric: true }). */
  videos: RegisteredVideo[];
  bySlug: ReadonlyMap<string, RegisteredVideo>;
  /** Slug por defecto cuando no hay ?v=: el primer video PLAYABLE del orden. null si no hay ninguno. */
  defaultSlug: string | null;
  /** Todos los issues, incluidos los de carpetas que no llegaron a producir un video. */
  issues: RegistryIssue[];
}

const VIDEO_MODULE_KEY = /^\.\/([^/]+)\/video\.ts$/;
const TIMELINE_KEY = /^\.\/([^/]+)\/timeline\.json$/;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function extractSlug(key: string, pattern: RegExp): string | null {
  const m = pattern.exec(key);
  return m ? m[1] : null;
}

/**
 * Construye el registro a partir de los dos mapas de `import.meta.glob`
 * (o de sus equivalentes sintéticos en tests). Nunca tira: un módulo roto
 * queda excluido de `videos` y aparece en `issues`.
 */
export function buildRegistry(
  videoModules: Record<string, unknown>,
  timelineKeys: readonly string[],
): VideoRegistry {
  const issues: RegistryIssue[] = [];
  const videos: RegisteredVideo[] = [];

  // Carpetas que declaran video.ts (independientemente de si son válidas).
  const videoSlugs = new Set<string>();
  for (const key of Object.keys(videoModules)) {
    const slug = extractSlug(key, VIDEO_MODULE_KEY);
    if (slug !== null) videoSlugs.add(slug);
  }
  // Carpetas que declaran timeline.json.
  const timelineSlugs = new Set<string>();
  for (const key of timelineKeys) {
    const slug = extractSlug(key, TIMELINE_KEY);
    if (slug !== null) timelineSlugs.add(slug);
  }

  // Todas las carpetas candidatas: union de ambos conjuntos, orden estable.
  const allSlugsRaw = [...new Set([...videoSlugs, ...timelineSlugs])].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  );

  for (const slug of allSlugsRaw) {
    const hasVideoModule = videoSlugs.has(slug);
    const hasTimeline = timelineSlugs.has(slug);
    const where = `src/videos/${slug}/`;

    if (!KEBAB_CASE.test(slug)) {
      issues.push({
        severity: 'error',
        code: 'invalid-slug',
        slug: null,
        where,
        message:
          `src/videos/${slug}/: el nombre de la carpeta no es un slug válido ` +
          `(kebab-case: minúsculas, números y guiones). Renombrala, por ejemplo "${slug
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')}".`,
      });
      continue;
    }

    if (!hasVideoModule) {
      issues.push({
        severity: 'error',
        code: 'missing-video-module',
        slug,
        where,
        message:
          `src/videos/${slug}/: falta video.ts (se encontró timeline.json). ` +
          `Un video se da de alta creando video.ts con: export default defineVideo({ ... }).`,
      });
      continue;
    }

    if (!hasTimeline) {
      issues.push({
        severity: 'error',
        code: 'missing-timeline-file',
        slug,
        where,
        message:
          `src/videos/${slug}/: falta timeline.json. ` +
          `Creá el archivo con al menos una entrada: [{ "name": "Apertura", "dur": 6 }].`,
      });
      continue;
    }

    const modulePath = `./${slug}/video.ts`;
    const mod = videoModules[modulePath] as { default?: unknown } | undefined;
    if (!mod || !('default' in mod)) {
      issues.push({
        severity: 'error',
        code: 'no-default-export',
        slug,
        where: `${where}video.ts`,
        message: `src/videos/${slug}/video.ts: no tiene export default.`,
      });
      continue;
    }

    if (!isVideoDefinition(mod.default)) {
      issues.push({
        severity: 'error',
        code: 'not-a-video-definition',
        slug,
        where: `${where}video.ts`,
        message:
          `src/videos/${slug}/video.ts: el export default no salió de defineVideo(). ` +
          `Escribí: export default defineVideo({ ... }).`,
      });
      continue;
    }

    const definition = mod.default;
    // Re-prefija los issues de defineVideo con el path de este video.
    const definitionIssues: RegistryIssue[] = definition.issues.map((i) => ({
      severity: i.severity,
      code: i.code,
      slug,
      where: `${where}video.ts`,
      message: `src/videos/${slug}/video.ts: ${i.message}`,
    }));
    issues.push(...definitionIssues);

    const playable = !definitionIssues.some((i) => i.severity === 'error');
    videos.push({ slug, definition, playable, issues: definitionIssues });
  }

  const bySlug = new Map(videos.map((v) => [v.slug, v]));
  const defaultSlug = videos.find((v) => v.playable)?.slug ?? null;

  return { videos, bySlug, defaultSlug, issues };
}
