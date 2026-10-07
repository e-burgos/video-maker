// src/videos/registry.ts — ÚNICO lugar con import.meta.glob. Sin lógica: sólo adaptación.
import { buildRegistry } from './build-registry';

/** Módulos de contrato: la clave es './<slug>/video.ts'. */
const videoModules = import.meta.glob<{ default: unknown }>('./*/video.ts', { eager: true });

/** Sonda de presencia: detecta carpetas que tienen timeline.json pero NO video.ts. */
const timelineModules = import.meta.glob('./*/timeline.json', { eager: true });

export const REGISTRY = buildRegistry(videoModules, Object.keys(timelineModules));

// Ruido total en runtime (§4.3 de architect.md): consola siempre, gate siempre.
// Un video roto no aborta el arranque de los demás — sólo lo dice, fuerte.
for (const issue of REGISTRY.issues) {
  if (issue.severity === 'error') console.error(`[motion-editor] ${issue.message}`);
  else console.warn(`[motion-editor] ${issue.message}`);
}
