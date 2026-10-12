# spec-e-burgos-023-production-quality cycle-05 — 2026-10-12

## Estado
Job `reference {file}` (probe/scenes/transcribe/keyframes/persist) que deja `work/reference/<nombre>.brief.json` y `work/reference/<nombre>/scene-NN.jpg`; `GET /projects/:slug/references` y `GET .../references/:name`; errores `REFERENCE_FILE_INVALID` (422), `REFERENCE_FILE_NOT_FOUND` y `REFERENCE_NOT_FOUND` (404). Rol `reference` en el store y en `assetCounts`.

## Estructura
Nuevos `src/reference/` (puerto `ReferenceMeasurements`, `build-reference-brief.ts`), `jobs/run-reference-pipeline.ts` y `http/handlers/references-handler.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
