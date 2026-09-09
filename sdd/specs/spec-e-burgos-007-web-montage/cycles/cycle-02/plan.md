# spec-e-burgos-007-web-montage — cycle-02 · plan (lite)

> Módulo: web-montage | Subproyectos: apps/web | Fecha: 2026-09-09
> Objetivo: que el Web Studio pueda **producir** la Timeline que hoy sólo consume — botón
> "Generate montage" en la biblioteca de assets sobre el job `kind: 'montage'` de `cycle-01`,
> progreso por etapa, confirmación explícita antes de pisar una timeline editada, estado vacío
> accionable en el preview y salud del servicio que muestre si el montaje es posible; con un E2E
> Playwright que va **de `raw/` al MP4** por la web. Cierra la spec.
> Fuera de alcance: cambiar `apps/render-api` (el contrato de `cycle-01` se consume tal cual),
> edición del EDL, progreso de upload, refresco automático del listado de jobs, y cualquier
> traducción de los códigos de error del servicio (se muestran literales, D-7 de spec-006).

## Historias

- US-2-001 — Como dev quiero generar el montaje desde la biblioteca de assets eligiendo preset y
  seed, para no depender de `tools/render-cli` para llegar a una Timeline.
  CA: el botón crea un job `kind: 'montage'` con el `preset` y el `seed` elegidos y expone su id.
- US-2-002 — Como dev quiero ver el progreso del montaje por etapa, para saber que la transcripción
  avanza y no está colgada.
  CA: el panel muestra `stage` y, en `probe`/`transcribe`, `processedAssets/totalAssets` y `percent`.
- US-2-003 — Como dev quiero que al terminar el montaje la app me lleve al preview, para seguir el
  flujo sin navegar a mano. CA: al pasar a `succeeded` la app navega a `/projects/:slug/preview`.
- US-2-004 — Como dev quiero que regenerar sobre un proyecto ya editado me pida confirmación, para
  no perder la edición a mano. CA: ante `409 TIMELINE_ALREADY_EXISTS` no se crea job, aparece una
  confirmación que dice que se pisa la timeline editada, y sólo al confirmar se reintenta con
  `overwrite: true`.
- US-2-005 — Como dev quiero ver el código de error del job de montaje, para distinguir un binario
  faltante de un proyecto sin material. CA: un job `failed` muestra `error.code` y `error.message`
  literales; los `MONTAGE_*` de request-time se muestran igual sin tabla de traducción.
- US-2-006 — Como dev quiero que el preview de un proyecto sin timeline me ofrezca generarla, para
  no leer un error donde corresponde una acción. CA: con `TIMELINE_NOT_FOUND` la página muestra un
  estado vacío con un link a la biblioteca, no un `ErrorNotice`.
- US-2-007 — Como dev quiero ver en el panel de salud los cuatro binarios y `montageQueue`, para
  saber antes de apretar si el servicio puede montar. CA: el panel lista los 4 binarios con su
  `envVar` y su estado y las 4 capabilities; con Whisper sin resolver o `montageQueue: false` el
  botón "Generate montage" queda deshabilitado con el motivo escrito.
- US-2-008 — Como dev quiero un E2E que vaya de `raw/` al MP4 por la web, para que el cierre de la
  spec sea evidencia y no una promesa. CA: `montage-smoke.mjs` corre sobre un `RENDER_API_MEDIA_ROOT`
  temporal con sólo `raw/` y termina en un MP4 verificado con `ffprobe` contra el stream de video.

## Tasks (detalle en tasks.json)

- TASK-001 — `src/api/render-api-types.ts` + `src/api/parse-render-job.ts`: discriminante `kind`,
  `MONTAGE_PRESETS`/`MONTAGE_STAGES`, `MontageJobProgress`, `MontageJobReport`, `MontageJob`,
  `Job = RenderJob | MontageJob`, `kind` en el summary y `montageQueue` en `ServiceCapabilities`;
  `parseJob`/`parseRenderJob` y `nextPollPlan` sobre `Job`. Lo valida su `.spec.ts` (payload de
  cada `kind` aserado con `Object.keys(...).sort()` contra el contrato de `sdd/api.json`).
- TASK-002 — `src/api/render-api-client.ts`: `createMontageJob(slug, { preset, seed, overwrite })`
  con body `{ kind: 'montage', … }`, `getRenderJob`/`cancelRenderJob` devolviendo `Job`,
  `createRenderJob` sin body (retro-compatible). Nuevo `src/api/montage-capability.ts` con
  `montageBlockers(health)` puro. Lo validan sus `.spec.ts`.
- TASK-003 — `src/components/montage-trigger.tsx`: selector de preset, seed, botón "Generate
  montage" deshabilitado con motivo cuando `montageBlockers` no está vacío, y flujo de confirmación
  ante `409 TIMELINE_ALREADY_EXISTS` que reintenta con `overwrite: true`. Lo valida su `.spec.tsx`.
- TASK-004 — `src/components/montage-job-panel.tsx` (etapa, contador de assets, `error.code`,
  `onSucceeded`) sobre `useRenderJobPoll` ya widened, y cableado en `AssetLibraryPage` con
  `useNavigate` al preview. Lo validan sus `.spec.tsx`.
- TASK-005 — `ProjectPreviewPage`: estado vacío accionable cuando el error es `TIMELINE_NOT_FOUND`
  (link a la biblioteca), `ErrorNotice` para cualquier otro código. Lo valida su `.spec.tsx`.
- TASK-006 — `ServiceHealthBadge`: disclosure con los 4 binarios (`name`, `envVar`, `resolved`),
  los módulos de engine y las 4 capabilities. Lo valida su `.spec.tsx`.
- TASK-007 — E2E: extraer los helpers de `e2e/studio-smoke.mjs` a `e2e/smoke-helpers.mjs` (con
  carga del `.env` raíz para las cuatro variables de media) y escribir `e2e/montage-smoke.mjs`:
  copia de `media/smoke-ingest` con **sólo** `raw/` → biblioteca → "Generate montage" → progreso →
  preview → 409 verificado → edición → save → render → descarga → `ffprobe`. Ejecutado, con
  capturas, guion literal y `ffprobe` en `cycles/cycle-02/artifacts/`.
- TASK-008 — `apps/web/README.md` con el flujo completo por la web y el guion copiable del E2E, y
  los registros del ciclo (`components.json`, `cycle.json`, `global.json`, `specs/index.json`).

## Decisiones técnicas

- **D-13 · El `kind` se modela como unión discriminada en `apps/web`, no como campo opcional.**
  `Job = RenderJob | MontageJob` espeja exactamente `apps/render-api/src/jobs/render-job.ts`: el
  `progress` y el `report` de montaje tienen **otros nombres de campo** (`processedAssets`/
  `totalAssets` vs `renderedFrames`/`totalFrames`), y un campo opcional dejaría que el compilador
  acepte leer `renderedFrames` de un job de montaje. Registro afectado: ninguno nuevo — es el
  consumo de `EP-012`/`EP-013`/`EP-014` ya publicados. Los nombres de preset se declaran en la app
  (`MONTAGE_PRESETS`), derivados de `MONTAGE_PRESETS` de `libs/auto-montage`, porque `apps/web` no
  aliasa esa lib (D-5 de spec-006).
- **D-14 · El 409 no se previene, se maneja.** El botón no consulta `layout.timeline` para
  deshabilitarse: manda el job y usa el `409 TIMELINE_ALREADY_EXISTS` del servicio como la señal de
  confirmación. Es la única fuente que no puede quedar desactualizada respecto del disco, y el
  servicio garantiza que no registra job ni toca un byte en ese caso (D-6 de la spec).
- **D-15 · Un solo panel de job por tipo, no uno genérico.** `RenderJobPanel` sigue sirviendo al
  render (descarga del MP4, frames) y `MontageJobPanel` al montaje (assets, salto al preview):
  fusionarlos daría un componente con dos ramas excluyentes y ningún test más barato.
- **D-16 · El E2E carga el `.env` raíz desde el propio script.** Las cuatro variables de media son
  obligatorias para que el job de montaje resuelva Whisper, y `nx` no las inyecta al correr un
  `.mjs` suelto: `loadRootEnv()` rellena sólo las que falten, así que un `set -a && source .env`
  previo sigue ganando. Registro afectado: ninguno; queda documentado en el README de `apps/web`.
- **D-17 · `components.json` suma los componentes nuevos y marca `updated` los tocados**
  (`AssetLibraryPage`, `ProjectPreviewPage`, `ServiceHealthBadge`, `useRenderJobPoll`), con
  `MontageTrigger`, `MontageJobPanel` y `montageBlockers` como `implemented` de este ciclo.
