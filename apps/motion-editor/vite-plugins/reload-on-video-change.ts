/**
 * Plugin de Vite dev-only: fuerza **recarga completa** cuando cambia el
 * `timeline.json` o el `video.ts` de un video.
 *
 * Por qué existe (bug real, 2026-07-29): el registro descubre los videos con
 * import.meta.glob('./star/video.ts', { eager: true }) (glob eager). Vite hot-updatea bien
 * los `.tsx` de escenas (React Refresh), pero **no propaga el cambio de un
 * `.json` importado a través de ese glob eager**: el módulo del video sigue
 * sirviendo el timeline viejo. El resultado es una divergencia silenciosa —
 * mapa de escenas NUEVO contra timeline VIEJO — que el stage muestra como
 * `unmapped scene: <nombre>` y que sólo se arreglaba recargando a mano.
 *
 * Apareció al renombrar una escena (`Montaje` → `Ubicacion`): el mapa ya no
 * tenía `Montaje`, el timeline en memoria todavía la pedía.
 *
 * Una recarga completa es la respuesta honesta: el timeline define la
 * composición entera (duración, orden, qué escenas se montan), así que no hay
 * un parche parcial que deje el estado coherente. Es el mismo criterio que
 * usa Vite cuando un módulo no puede aceptar HMR.
 *
 * `apply: 'serve'` lo deja fuera del build.
 */
import type { HmrContext, Plugin } from 'vite';

/** Coincide con `src/videos/<slug>/timeline.json` y `src/videos/<slug>/video.ts`. */
const VIDEO_DEF = /[/\\]src[/\\]videos[/\\][^/\\]+[/\\](timeline\.json|video\.ts)$/;

export default function reloadOnVideoChangePlugin(): Plugin {
  return {
    name: 'motion-editor-reload-on-video-change',
    apply: 'serve',
    handleHotUpdate(ctx: HmrContext) {
      if (!VIDEO_DEF.test(ctx.file)) return;
      ctx.server.ws.send({ type: 'full-reload', path: '*' });
      // Devolver [] evita que Vite intente además un update parcial que, como
      // se explicó arriba, no llega al módulo del video.
      return [];
    },
  };
}
