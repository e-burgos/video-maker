# spec-e-burgos-006-web-studio — cycle-02 · plan (lite)

> Módulo: web-studio | Subproyectos: apps/web, libs/composition-remotion | Fecha: 2026-09-09
> Objetivo: montar la composición real de `libs/composition-remotion` en un `<Player>` de Remotion
> dentro de `apps/web`, alimentado por la `Timeline` persistida del proyecto (`EP-007`) y con los
> assets resueltos por URL de `EP-011`, sin cambiar un solo byte de la salida del render ni ningún
> contrato público que `apps/render-api` o `tools/render-cli` consuman. Fuera de alcance: edición
> del timeline, jobs de render, descarga del MP4 y E2E de punta a punta (todo `cycle-03`);
> autenticación y despliegue (no son de esta spec).

Contexto leído una vez al abrir: `sdd/memory/lessons.md` completo · `sdd/dual-harness/rules/sdd-gates.md`
§ Flow · `sdd/specs/spec-e-burgos-006-web-studio/*.spec.md` (D-1..D-11, plan de ciclos) ·
`cycles/cycle-01/plan.md` y `artifacts/visual-verification.md` · `sdd/context/apps/web/` (base
consolidado en este mismo turno) · `sdd/context/libs/composition-remotion/` (base + fragmento
`fix-e-burgos-001-002`) · `libs/composition-remotion/README.md` § OffthreadVideo vs Video ·
`sdd/api.json` (`EP-007`, `EP-011`, `EP-012`..`EP-014`) · código real de `remotion@4.0.522`
(`get-remotion-environment`, `OffthreadVideo`, `Html5Video`).

## Historias

- **US-2-001** — Como dev quiero que la composición elija `<OffthreadVideo>` cuando se está
  renderizando y `<Video>` cuando corre en un `<Player>` del navegador, para poder previsualizar sin
  tocar el camino del render. CA: el default sin proveedor es `render`, la salida del render sigue
  siendo byte-idéntica y ningún contrato público cambia (D-8, CA-101, CA-102, CA-106).
- **US-2-002** — Como dev quiero abrir la preview de un proyecto y ver su `Timeline` persistida
  reproduciéndose, con transporte y scrub, para juzgar el montaje antes de gastar un render. CA:
  la página lee `EP-007`, monta `<Player>` con `TimelineComposition` y los controles de Remotion
  (CA-103, CA-107).
- **US-2-003** — Como dev quiero que los clips y la música del preview salgan del proyecto real y
  no de `public/`, para que lo que veo sea el material que se va a renderizar. CA: cada `src` del
  Player apunta a `/api/projects/<slug>/files/...` en el mismo origen, y `media/` no se copia a
  ningún lado (D-6, CA-104).
- **US-2-004** — Como dev quiero ver los kinetic captions de spec-003 y escuchar el audio de la
  timeline dentro del Player. CA: `AudioTrack` montado (modo `mix`, el default) y `KineticCaptions`
  dibujando sobre el video; queda escrito que el Player **no** aplica `loudnorm` y sólo reproduce
  la automatización de ganancia (CA-105).
- **US-2-005** — Como dev quiero elegir 9:16 o 16:9 en la preview sin tocar el documento
  persistido, para ver el encuadre y las safe zones del otro formato. CA: el override cambia
  `format` **y** `safeZone` juntos y nunca escribe por `EP-008` (CA-108).
- **US-2-006** — Como dev quiero evidencia de que el Player reproduce de verdad, no de que el
  componente monta. CA: Playwright mide en el navegador `readyState` y `currentTime` avanzando con
  frames de video visibles, y las capturas quedan en `artifacts/` (D-10, CA-109).

## Tasks (detalle en tasks.json)

- **TASK-001** — `libs/composition-remotion`: `VideoBackendContext`/`VideoBackendProvider`/
  `useVideoBackend` (default `'render'`) y `TimelineVideo`, el componente conmutable; `ArollScene`
  y `BrollMedia` pasan a usarlo; exports nuevos en el barrel; `coverage.include` sumando los dos
  archivos nuevos. Lo validan: `video-backend.spec.tsx`, `timeline-video.spec.tsx` (los dos
  backends + el default sin proveedor) y `contract-surface.spec.ts` (la firma de `inputProps` que
  arma `renderTimeline` no cambia).
- **TASK-002** — Evidencia de no-regresión del render: un job real de `apps/render-api` sobre
  `media/smoke-ingest` con gate de memoria previo, y `shasum`/`ffprobe` contra la línea base
  medida hoy (`video-muted.mp4` = `c1b9fd9f…`, `out/*.mp4` = `4bfe9f7b…`, `nb_frames` 538 a 30 fps).
  Sin código nuevo: la task es la medición y su registro en `artifacts/render-non-regression.md`.
- **TASK-003** — `apps/web`, frontera: `@remotion/player@4.0.522` (única dep npm nueva de la spec,
  D-2), alias `@video-maker/composition-remotion` y `@video-maker/timeline-core` en
  `resolve.alias` del `vite.config.ts` de la app, `getTimeline()` (`EP-007`) en el cliente,
  `playerTimeline()` (reescribe cada `MediaAsset.path` a la URL absoluta same-origin de `EP-011`) y
  `previewFormat()` (override de formato + safe zone). Lo validan: los specs de cada helper y el
  caso de `EP-007` en `render-api-client.spec.ts`.
- **TASK-004** — `apps/web`, pantalla: `TimelinePlayer` (envuelve `TimelineComposition` en
  `VideoBackendProvider value="player"` y monta `<Player>` con la metadata de
  `computeTimelineMetadata`), `ProjectPreviewPage` (`EP-004` + `EP-007`, estados de carga/error,
  selector de formato, resumen de pistas) y la ruta `/projects/:slug/preview` con su link desde la
  biblioteca. Lo validan: `timeline-player.spec.tsx` y `project-preview-page.spec.tsx`.
- **TASK-005** — Cierre verificable: verificación visual real con Playwright (`readyState`,
  `currentTime` avanzando, `<video>` con dimensiones) contra `render-api` real, capturas y guion
  literal en `artifacts/`; alta de los componentes nuevos en `sdd/components.json`; README de
  `apps/web` y nota del Player en el README de la lib.

## Decisiones técnicas (obligatoria si toca schema/api/components)

- **Mecanismo del video conmutable: contexto React explícito con default `'render'`, no
  `getRemotionEnvironment()`.** `TimelineVideo` lee `useVideoBackend()`; sin proveedor vale
  `'render'` y monta `<OffthreadVideo>` exactamente con los props de hoy. `apps/web` envuelve la
  composición en `<VideoBackendProvider value="player">` y ahí monta `<Video>`.
  **Fundamento medido sobre `remotion@4.0.522` (no sobre la documentación):**
  1. `getRemotionEnvironment().isRendering` se calcula con `window.process.env.NODE_ENV === 'test'`
     o `'production' && window.remotion_puppeteerTimeout !== undefined` — globals internos, no
     documentados como contrato, y **no simulables en jsdom sin falsificarlos**. Un cambio de esa
     heurística en una versión futura cambiaría la salida del render en silencio: es exactamente el
     antipatrón de la lección *"leer quién produce un dato antes de dar default a un flag que elige
     entre dos fuentes"*.
  2. `OffthreadVideo` de 4.0.522 **ya hace ese branch internamente**
     (`environment.isRendering ? OffthreadVideoForRendering : VideoForPreview`), así que
     reimplementarlo con `getRemotionEnvironment()` sería duplicar la heurística de Remotion para
     terminar en el mismo `VideoForPreview`. Lo que aporta valor no es *detectar* el entorno sino
     **declararlo**: el default `'render'` deja el árbol del render idéntico por construcción, y el
     preview queda en el camino que Remotion documenta para el Player (`<Video>`/`Html5Video`, que
     usa `VideoForPreview` con `onlyWarnForMediaSeekingError: false`).
  3. El contexto es testeable sin globals: dos tests montan `TimelineVideo` con y sin proveedor y
     verifican qué componente eligió.
- **Ningún contrato público cambia** (condición de que el ciclo siga siendo `lite`, D-8):
  `renderTimeline`, `RenderTimelineOptions`, `RenderTimelineError`, `TimelineAudioMode` y
  `TimelineCompositionProps` quedan **idénticos**; `renderTimeline` sigue armando
  `inputProps: { timeline, ...(audio === 'muted' ? { audio } : {}) }` sin clave nueva. Lo único que
  crece es el barrel, con exports aditivos (`TimelineVideo`, `VideoBackendProvider`,
  `useVideoBackend`, tipo `VideoBackend`). `apps/render-api` y `tools/render-cli` no se tocan.
  Registro afectado: ninguno (`sdd/api.json` y `sdd/schema.json` sin cambios).
- **Evidencia de no-regresión: hash, no inspección visual.** El pipeline de `render-api` es
  byte-determinista sobre `media/smoke-ingest` — cuatro corridas previas dieron el mismo
  `sha256` de `video-muted.mp4` (`c1b9fd9f33ba…`) y tres el mismo `out/<job>.mp4` (`4bfe9f7bc07d…`).
  Un job nuevo después del cambio que reproduzca esos hashes es prueba de byte-equivalencia, mucho
  más fuerte que comparar `nb_frames`. Se reporta igual el `ffprobe` del stream de video
  (`nb_frames`/`r_frame_rate`, nunca `format.duration` — lección vigente).
  **`composition-remotion:smoke` no se usa como evidencia**: sus assets viven en
  `libs/composition-remotion/public/example/`, gitignoreado y hoy vacío en esta máquina.
- **Resolución de assets en el Player: reescritura de la Timeline en `apps/web`, no cambio en
  `assetSrc`.** `assetSrc` manda `staticFile(path)` para rutas relativas, que en el navegador
  resolvería contra el `public/` de la app (vacío, D-6), y `file:///…` para rutas absolutas, que el
  navegador no puede cargar. `playerTimeline(timeline, slug)` mapea cada `MediaAsset.path` a
  `new URL(artifactUrl(slug, path), window.location.origin).toString()`, que cae en la rama
  `URL_SCHEME_PATTERN` de `assetSrc` y se devuelve tal cual. Es same-origin gracias al proxy `/api`
  (D-4): el `<video>` puede pedir `Range` a `EP-011` sin CORS. **`media/` no se copia a `public/`.**
- **Audio del Player: el modo `mix` por default, sin `loudnorm`.** La composición monta
  `AudioTrack` (el `audio` prop se omite, como en `remotion studio`), así que el preview reproduce
  la voz al `gainDb` de cada clip y la música por la automatización de ducking. El master real
  aplica `loudnorm` a -14 LUFS en `media-local`, que el navegador **no** ejecuta: la paridad
  prometida es la curva de ducking, no el nivel absoluto (constitución de la lib, § paridad de
  `gainDbToVolume`). Queda escrito en el README de la lib.
- **Selector de formato: override de preview, nunca escritura.** `previewFormat(timeline, preset)`
  devuelve una Timeline nueva con `format: defaultFormat(preset)` **y** `safeZone:
  safeZoneFor(...)`: el `safeZone` persistido de 9:16 (`top 220 / bottom 400`) sobre un lienzo 16:9
  dejaría los captions fuera de cuadro, y `TimelineComposition` prefiere `timeline.safeZone` sobre
  el default del formato. No emite `EP-008` ni ningún otro request de escritura.
- **`@remotion/player@4.0.522`, versión exacta idéntica a `remotion`** (`pnpm ls remotion` →
  4.0.522). Es la única dependencia npm nueva de toda la spec, prevista por D-2; `@remotion/player`
  comparte el contexto interno de Remotion y una versión distinta rompe en runtime sin error de
  tipos.
- **Alias de workspace en los resolvedores que importan** (lección más cara del repo): `apps/web`
  pasa a importar `@video-maker/composition-remotion` y `@video-maker/timeline-core`.
  `tsconfig.base.json` ya los declara (archivo protegido, **no se toca**); falta `resolve.alias` en
  `apps/web/vite.config.ts`, que cubre a la vez Vitest y el bundle del navegador. `webpackOverride`
  no aplica acá: el bundle de Remotion es el del render y ese camino no cambia. Se verifica que
  `web:build` bundlea **y** que el Player carga en Chrome, no sólo que `tsc` pasa.
- **`sdd/components.json` gana los componentes del ciclo**: `TimelineVideo` y `VideoBackendProvider`
  bajo `libs/composition-remotion` (COMP-009, COMP-010) y `TimelinePlayer` y `ProjectPreviewPage`
  bajo `apps/web` (COMP-012, COMP-013). Registro afectado: `sdd/components.json`.
- **`sdd/schema.json` no se toca**: el producto no tiene base de datos.
