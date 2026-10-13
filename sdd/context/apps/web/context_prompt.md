# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre, si los hay**.
> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

- **Tipo:** app React 19 (SPA local sobre `apps/render-api`)
- **Estado:** **producto completo de punta a punta, en español (default) e inglés.** La pantalla por
  proyecto es un **workspace centrado en el chat** (`/projects/:slug`): conversación persistida con
  el productor a la izquierda (turnos en vivo, cancelación, chips de sugerencias y opciones
  numeradas, fila de **recetas** con prompt completo precargado —hoy **Tutorial**—, archivos que se
  arrastran al chat o se adjuntan y llegan como tarjeta de propuesta de rol) y un panel lateral con
  pestañas **Vista previa · Material · Entregas** que cambia solo al terminar un montaje o un
  render. `/settings` configura el motor del productor (Claude Code u OpenRouter, key de sólo
  escritura, catálogo con recomendados) y el chat muestra el costo de cada turno. Biblioteca,
  storyboard, voz y preview siguen existiendo como **Edición avanzada**: biblioteca de assets por
  rol con subida, **borrado con confirmación** (manejo de `409 ASSET_IN_USE` con "Delete anyway") y
  sección **Generated** con lo que produjo el motor; storyboard generativo editable escena por
  escena con hoja numerada de prompts (o **modo guion** de sólo lectura si el proyecto se narró
  desde un script, ahora explicando también los códigos de falta de motor OpenRouter); voz (síntesis
  por escena, duración real contra la estimada, regeneración de una escena, sustitución por
  grabación propia, o el mismo **modo guion**); preview de la `Timeline` en el `<Player>` de
  Remotion con edición del documento (trim y orden de escenas, captions, música, preset de salida,
  logo con bumpers) y un único `PUT`. Los cuatro paneles de job soportan **reintento** (`EP-036`)
  para un job `failed`/`canceled`, y uno `failed` con `JOB_INTERRUPTED` se etiqueta "Interrumpido".
  El inicio (`/`) lista videos en tarjetas con miniatura y crea uno soltando un archivo; las
  carpetas se listan vacías y se renombran inline. Una ruta `/guide` perezosa explica cada sección,
  la tabla de presets de salida y tres flujos típicos, en los dos idiomas. Consume `EP-001`..`EP-008`,
  `EP-011`..`EP-026`, `EP-028` y `EP-036`. Suite con cobertura piso 80 % (`coverage.include` sin
  recortar; no remedida en esta consolidación). Cero dependencias npm propias además de
  `@remotion/player`. Desde spec-018 suma modo motion, marcas, YouTube y su cola, revisión de renders, propuesta,
  muestras, referencias y dirección de voz (ver `constitution.md` §5).
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
  uploader; `cycle-02`: i18n `en`/`es` y sección de guía) · `spec-017-desktop-app` (`cycle-02`:
  reintento de jobs interrumpidos; `cycle-03`: español default, carpetas, i18n de modelos;
  `cycle-04`: `/settings` y motor OpenRouter; `cycle-05`: workspace centrado en el chat) ·
  `spec-018-producer-free-tier` · `spec-020-motion-mode` · `spec-021-brand-kit` · `spec-022-youtube-publishing` ·
  `spec-023-production-quality`.
- **Backend único:** `apps/render-api` (ver `sdd/context/apps/render-api/`), por el
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
  montaje, storyboard y voz muestran el job hasta que termina. Ningún CA lo pide. Distinto del
  **reintento** (`EP-036`), que sí existe para los cuatro paneles.
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
  expone un `DELETE` de `work/producer/`), y **un turno perdido por reinicio da
  `PRODUCER_TURN_NOT_FOUND`** sin reenganche posible (registro in-memory).
- **El costo del turno del productor se muestra en el chat** (`message.usage.costUsd`, formateado
  por idioma); el `usage` del reporte de storyboard sigue sin dibujarse en ninguna pantalla.
- **Los dos `404` de `/favicon.ico`** en consola no son un defecto: `index.html` no declara icono.
- **`vite.config.ts` imprime un warning de deprecación de Vite** (`ESM syntax in a file loaded as
  CommonJS`) que comparten **todos** los proyectos del workspace: cambio transversal, no de esta app.
- **El MCP de Playwright de este harness no sirve en esta máquina** (necesita la extensión
  "Playwright MCP Bridge"). La verificación visual usa el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, porque el `chromium_headless_shell` que ese build
  espera no está descargado.
- **El borrado de un asset es inline en la tarjeta, no un modal**: con muchos usos de timeline la
  tarjeta crece bastante. No hay borrado múltiple ni deshacer, y un borrado con `force` puede romper
  la timeline — la UI sólo avisa, no lo impide.
- **No hay borrado de archivos generados** (narración, guion, `out/*.mp4`) desde la sección
  "Generated" de la biblioteca. Follow-up abierto.
- **El modo guion de Voz/Storyboard es de sólo lectura**: para cambiar el texto narrado hay que
  volver al productor; no hay edición inline del guion todavía.
- **Sumar una receta al productor toca cuatro lugares, dos de ellos fuera de esta app**
  (`PRODUCER_RECIPES` + prompt por idioma + dos claves de catálogo en `apps/web`, **y** el system
  prompt del productor en `apps/render-api` **y** la skill `video-producer`): si se olvida
  cualquiera de los dos últimos, el agente no sabe qué parámetros aplicar al oír el nombre de la
  receta.
- **El chunk inicial bajó a 294 kB reales con el workspace de chat** (`spec-017 cycle-05`), después
  de haber subido hasta 533,9 kB (arriba del aviso de 500 kB de Vite) sobre la nav clásica en
  `cycle-02`..`cycle-04`: la próxima pantalla o catálogo de copy que entre al chunk inicial (en vez
  de una ruta o un `await import()` perezoso) probablemente lo vuelve a disparar.
- **El switch de idioma no ofrece un tercer idioma listo para usar**: agregar uno implica sumar el
  módulo de catálogo, sumarlo a `LANGUAGES` y resolver cada clave que `tsc` señale como faltante.
- **Quedan superficies de Edición avanzada en inglés o con 404 esperables** tras el rediseño del
  workspace (`cycle-05`): el input de archivos del storyboard y otros documentos todavía no creados.
