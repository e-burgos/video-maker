# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-016 cycle-01 | Fecha: 2026-09-11
> Consolidado por el orquestador al abrir `cycle-02` de `spec-e-burgos-016-studio-usability`.

- **Tipo:** app React 19 (SPA local sobre `apps/render-api`)
- **Estado:** **producto completo de punta a punta.** El nav por proyecto es
  `producer · library · storyboard · voice · preview` y el productor es el punto de partida de
  cada proyecto. Cubre: chat persistido con el productor (turnos en vivo, cancelación, chips de
  sugerencias y opciones numeradas, selector de modelo, estado vacío con el inventario real),
  biblioteca de assets por rol con subida y disparo del montaje, storyboard generativo editable
  escena por escena con hoja numerada de prompts, voz (síntesis por escena, duración real contra la
  estimada, regeneración de una escena, sustitución por grabación propia), preview de la `Timeline`
  en el `<Player>` de Remotion con edición del documento (trim y orden de escenas, captions,
  niveles de música con reescritura de la automation, preset de salida, capa de logo) y un único
  `PUT`, y jobs de render con polling, cancelación y descarga del MP4. La voz se elige desde
  **tarjetas audibles** (`VoicePicker`: etiqueta legible, idioma, calidad, descripción y demo de
  `EP-026` reproducida en el navegador) y cada rol de subida llega con **qué le hace al video
  final**, el directorio `raw/<rol>/` destino, la marca de obligatorio y la regla de matching de
  B-roll. Consume `EP-001`..`EP-008`, `EP-011`..`EP-025` y `EP-026`. Suite: **78 archivos /
  742 tests**, 98,71 % stmts · 95,96 % branch · 98,73 % funcs · 98,96 % lines, piso 80 %,
  `coverage.include` sin recortar.
  Cero dependencias npm propias además de `@remotion/player`.
- **Descopado a propósito:** la **edición del EDL (`EP-009`/`EP-010`)**, porque `buildTimeline` sólo
  se invoca desde `libs/auto-montage` y guardar un EDL editado escribiría `work/edl.json` sin efecto
  observable ni en el Player ni en un render. La edición de la Timeline cubre
  `trimStartMs`/`durationFrames` y el orden de clips, `text` de captions,
  `audioMix.music.baseGainDb`/`duckedGainDb`, el preset de `format` y el on/off y la esquina del
  logo; `assetId`, `transform`, `fit`, `muted`, el timing de captions, la envolvente de ducking,
  `audioMix.voice.*` y `widthRatio`/`marginRatio`/`opacity` del logo **no tienen control de edición**.
- **Specs que la gobiernan:** `spec-006-web-studio` (la creó) · `spec-007-web-montage` ·
  `spec-008-ai-storyboard` (c02) · `spec-009-voice-over` (c02) · `spec-015-studio-producer` (c02) ·
  `spec-016-studio-usability` (`cycle-01`: tarjetas de voz con preview y descripciones de rol en el
  uploader; `cycle-02`: i18n `en`/`es` y sección de guía).
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
  no el master a -14 LUFS. Está escrito en pantalla; **no volver a "arreglarlo"**.
- **`asset-media-kind.ts` / `content-type-for.ts` del servicio son un par sin test que los ate.**
  Si un ciclo toca una de las dos tablas, tocar la otra.
- **Ningún panel de job cancela salvo el de render** (`EP-015` lo soporta para los cuatro `kind`):
  montaje, storyboard y voz muestran el job hasta que termina. Ningún CA lo pide.
- **El listado de jobs no se refresca solo** cuando el job seguido cambia de estado: sólo un botón
  manual. **`RenderJobList` mezcla los cuatro `kind` sin columna `kind`**, aunque el summary ya la
  trae. **El montaje no refresca la biblioteca antes de navegar** (la fuente pasa de `raw-scan` a
  `catalog` y sólo se ve al volver). Cosmético.
- **El upload no reporta progreso**: `fetch` no lo expone sin `XMLHttpRequest`; un asset grande
  muestra `Uploading…` y nada más.
- **`TimelineEditState` no expone si la reescala de la automation tuvo efecto**, así que la UI no
  puede avisar el caso `span === 0` (los dos niveles iguales): el cambio se acepta y no se oye nada.
- **Reordenar b-roll no cambia un pixel** (el b-roll no tiene orden observable): los botones de
  reordenar aparecen sólo con `track === 'aroll'`.
- **`processedAssets`/`totalAssets` del job de montaje llegan siempre en `null`** (medido en dos
  corridas E2E): la UI ya los muestra; el que no los emite es el decorador del `CommandRunner` de
  `apps/render-api`. Candidato a `[FIX]` contra ese subproyecto.
- **El storyboard no permite reordenar, agregar ni borrar escenas**: sólo se editan las que el
  agente propuso (el `index` es la posición y el schema lo verifica). Es trabajo de `spec-010` o
  `spec-013`. **`captionsStyle`, `musicTags` y `sfxTags` se editan como texto libre** a la espera de
  `spec-012` y `spec-011`. **La hoja de prompts se lee del documento guardado**, así que con cambios
  sin guardar copia los prompts previos; la UI lo avisa en vez de guardar sola.
- **La voz no se elige por escena**: el selector es del proyecto, aunque `EP-012` acepta
  `voice` + `sceneIds` juntos, y el `VoicePicker` ya es un componente reusable. El demo tampoco
  ofrece volumen ni velocidad, y **la frase del preview es siempre la misma y en español**: una voz
  instalada de otro idioma la leería con fonética cruzada (hoy las tres instaladas son `es_*`). **No hay vuelta atrás de una pista `uploaded` a una generada**: el
  servicio no expone un `DELETE` de la pista y regenerar con `overwrite: true` pisa las otras tomas.
- **`durationMs` del manifest de voz se muestra pero nadie lo consume**: `buildTimelineFromStoryboard`
  (`spec-010`) tiene que leerlo y no la `estimatedDurationMs` del storyboard — en la corrida real las
  cinco escenas duraron **menos** de lo estimado (0,35 s a 2,02 s).
- **La conversación del productor no se puede borrar ni reiniciar desde la UI** (el servicio no
  expone un `DELETE` de `work/producer/`), **un turno perdido por reinicio da
  `PRODUCER_TURN_NOT_FOUND`** sin reenganche posible (registro in-memory), y **el productor no sube
  archivos**: el material entra por la biblioteca o por el panel del logo.
- **Todo el copy de la app está en inglés y repartido entre componentes**: sólo `asset-roles.ts`,
  `montage-presets.ts` y los cuatro traductores de códigos de error lo tienen centralizado. No hay
  mecanismo de traducción ni switch de idioma — es exactamente el trabajo de `cycle-02`.
- **El costo en tokens no se muestra en ninguna pantalla**: el `usage` del reporte de storyboard
  llega a la UI y no se dibuja, y el contrato del turno del productor directamente no lo expone.
- **Los dos `404` de `/favicon.ico`** en consola no son un defecto: `index.html` no declara icono.
- **`vite.config.ts` imprime un warning de deprecación de Vite** (`ESM syntax in a file loaded as
  CommonJS`) que comparten **todos** los proyectos del workspace: cambio transversal, no de esta app.
- **El MCP de Playwright de este harness no sirve en esta máquina** (necesita la extensión
  "Playwright MCP Bridge"). La verificación visual usa el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, porque el `chromium_headless_shell` que ese build
  espera no está descargado.
