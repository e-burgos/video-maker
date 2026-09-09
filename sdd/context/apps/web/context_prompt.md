# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-006 cycle-03 | Fecha: 2026-09-09
> Consolidado por el orquestador al abrir `cycle-01` de `spec-e-burgos-007-web-montage`.

- **Tipo:** app React 19 (SPA local sobre `apps/render-api`)
- **Estado:** **producto completo de punta a punta.** `spec-e-burgos-006-web-studio` cerró en
  `cycle-03`: shell con salud del servicio, alta y listado de proyectos, biblioteca de assets por
  rol reproducidos desde el servicio, preview de la `Timeline` persistida en el `<Player>` de
  Remotion con la composición real, edición del documento (trim y orden de escenas, texto de
  captions, niveles de música con reescritura de la automation, preset de salida) reflejada en el
  Player antes de guardar y persistida con un único `PUT` completo, y jobs de render con polling,
  cancelación y descarga del MP4. Consume `EP-001`..`EP-008` y `EP-011`..`EP-015`.
  Suite: **42 archivos / 306 tests**, 99,09 % stmts · 96,07 % branch · 98,72 % funcs ·
  99,37 % lines, piso 80 %, `coverage.include` sin recortar.
- **Descopado a propósito:** la **edición del EDL (`EP-009`/`EP-010`)**, porque `buildTimeline` sólo
  se invoca desde `libs/auto-montage` y guardar un EDL editado escribiría `work/edl.json` sin efecto
  observable ni en el Player ni en un render. La edición cubre `trimStartMs`/`durationFrames` y el
  orden de clips, `text` de captions, `audioMix.music.baseGainDb`/`duckedGainDb` y el preset de
  `format`; `assetId`, `transform`, `fit`, `muted`, el timing de captions, la envolvente de ducking
  y `audioMix.voice.*` **no tienen control de edición**.
- **Specs que la gobiernan:** `spec-e-burgos-006-web-studio` (la creó, completed) ·
  `spec-e-burgos-007-web-montage` (`cycle-02`: generar el montaje desde la biblioteca de assets).
- **Backend único:** `apps/render-api` (ver `sdd/context/apps/render-api/` + `updates/`), por el
  proxy `/api` del dev-server. `sdd/api.json` es el contrato.
- **Cómo correr y testear:** `pnpm nx test web` (jsdom + cobertura), `pnpm nx lint web`,
  `pnpm nx build web`; en desarrollo `pnpm nx dev web` con `apps/render-api` levantado.
  Variables: `RENDER_API_URL` (default `http://127.0.0.1:4310`), `WEB_PORT`/`PORT` (default 4200),
  `VITE_BASE_PATH`.

## Hallazgos abiertos y trampas conocidas (medidos, no razonados)

- **El encuadre del preview NO es el del render**: el navegador hace `object-fit: contain`
  (letterbox) y el render llena el cuadro. No lo causa el conmutador de backend (forzar `render`
  dentro del Player da el mismo letterbox). Alinearlo **cambia la salida del render** (`sha256` de
  `video-muted.mp4` pasó de `c1b9fd9f…` a `2ed415d8…`), así que es decisión de spec, no un fix
  cosmético. `apps/web/e2e/capture-frame-240.mjs` reproduce la medición con un comando y sin
  renderizar nada.
- **`FIND-01` (medido):** `planDucking` de `libs/timeline-core` pierde el keyframe fraccionario de
  cola de release cuando dos valles están cerca — el frame truncado coincide con el attack-start del
  valle siguiente y `dedupeKeyframesByFrame` conserva el último `.set()`. Afecta al render y al
  preview por igual. Candidato a `[FIX]` contra `timeline-core`.
- **El `<Player>` no aplica `loudnorm`**: lo que se escucha es la curva de ducking de la Timeline,
  no el master a -14 LUFS. Está escrito en pantalla desde `cycle-02`; **no volver a "arreglarlo"**.
- **`asset-media-kind.ts` / `content-type-for.ts` del servicio son un par sin test que los ate.**
  Si un ciclo toca una de las dos tablas, tocar la otra.
- **El listado de jobs no se refresca solo** cuando el job seguido cambia de estado: sólo un botón
  manual. Ningún CA lo exige.
- **El upload no reporta progreso**: `fetch` no lo expone sin `XMLHttpRequest`; un asset grande
  muestra `Uploading…` y nada más.
- **`TimelineEditState` no expone si la reescala de la automation tuvo efecto**, así que la UI no
  puede avisar el caso `span === 0` (los dos niveles iguales): el cambio se acepta y no se oye nada.
- **Reordenar b-roll no cambia un pixel** (el b-roll no tiene orden observable): los botones de
  reordenar aparecen sólo con `track === 'aroll'`.
- **Los dos `404` de `/favicon.ico`** en consola no son un defecto: `index.html` no declara icono.
- **`vite.config.ts` imprime un warning de deprecación de Vite** (`ESM syntax in a file loaded as
  CommonJS`) que comparten **todos** los proyectos del workspace: cambio transversal, no de esta app.
- **El MCP de Playwright de este harness no sirve en esta máquina** (necesita la extensión
  "Playwright MCP Bridge"). La verificación visual usa el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, porque el `chromium_headless_shell` que ese build
  espera no está descargado.
