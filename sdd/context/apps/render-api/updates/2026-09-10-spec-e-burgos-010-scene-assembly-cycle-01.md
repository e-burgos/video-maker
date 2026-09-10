# spec-e-burgos-010-scene-assembly cycle-01 — 2026-09-10

## Estado
El servicio expone la asignación de visuales por escena y ejecuta el ensamblado como quinto tipo de
job en la misma cola de concurrencia 1. `/health` suma `capabilities.assembleQueue`.

## Estructura
- Endpoints nuevos: **EP-022** `GET /projects/:slug/scenes`, **EP-023** `PUT /projects/:slug/scenes`,
  **EP-024** `POST /projects/:slug/scenes/import`. El GET responde 200 con una asignación vacía
  cuando todavía no hay `work/scenes.json` (nunca 404) y devuelve un `slot` por escena del
  storyboard con su `visualPrompt`, que es lo que la UI necesita para dibujar el hueco.
- `scenes/scenes-store.ts` y `scenes/scene-import.ts` — lectura/escritura del documento y el import
  numerado en lote sobre los directorios `raw/` de los roles pedidos.
- Job `kind: 'assemble'` — `jobs/assemble-job-params.ts`, `assemble-job-progress.ts`,
  `assemble-pipeline-observer.ts`, `run-assemble-pipeline.ts`. Etapas `collect|build|persist`,
  409 `TIMELINE_ALREADY_EXISTS` sin `overwrite`, y exige storyboard antes de encolar.
  Su reporte declara `editDecisionListPath: null`.
- `errors/translate-assemble-error.ts` — traduce los errores del motor a códigos de la API por
  `reason`, en vez de colapsarlos todos en un `ASSEMBLE_FAILED`.
- Códigos nuevos: `SCENES_INVALID`, `SCENE_NOT_FOUND`, `SCENE_IMPORT_ROLES_INVALID`,
  `SCENE_IMPORT_REPLACE_INVALID`, `ASSEMBLE_INPUT_INVALID`, `ASSEMBLE_FAILED`,
  `ASSEMBLE_MUSIC_INVALID`, `ASSEMBLE_PADDING_INVALID`, `ASSEMBLE_OVERWRITE_INVALID`.

## Dependencias
Ninguna nueva. Consume `collectAssembleInputs`/`buildAssembledTimeline`/`persistAssembledTimeline`
de `@video-maker/auto-montage`.

## Qué sigue
`RENDER_API_ERROR_CODES` tiene tres listas espejo que hay que actualizar juntas: el union,
`http-status-for.ts` y su spec, y `to-error-payload.ts`. El build las cruza todas.
