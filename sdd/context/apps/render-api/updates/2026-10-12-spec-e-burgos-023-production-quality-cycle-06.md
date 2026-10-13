# spec-e-burgos-023-production-quality cycle-06 — 2026-10-12

## Estado
`POST images/preview` acepta `brand:<clave>` y registra lo visto en `work/producer/viewed-images.json`; `GET/PUT /projects/:slug/material-review` (`MATERIAL_NOT_VIEWED`, `MATERIAL_REVIEW_INVALID`); la propuesta adjunta `materialWarnings`; el job review de motion extrae un cuadro por escena (`out/<render>.review/scene-NN.jpg`), marca `visual-not-reviewed` y compara la duración con la propuesta aprobada; `PUT /projects/:slug/reviews/visual` (`VISUAL_REVIEW_NOT_VIEWED`, `VISUAL_REVIEW_INVALID`); la voz de cada escena sale de `work/motion/voice-manifest.json`; el storyboard motion pide `--effort low` y 15 min por llamada (FIX-016).

## Estructura
Nuevos `material/`, `http/handlers/material-review-handler.ts`, `http/handlers/visual-review-handler.ts`, `review/scene-frames.ts`, `review/motion-scene-voices.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Partir el turno de producción completa (supera 30 min).
