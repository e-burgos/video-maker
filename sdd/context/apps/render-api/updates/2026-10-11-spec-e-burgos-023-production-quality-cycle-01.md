# spec-e-burgos-023-production-quality cycle-01 — 2026-10-11

## Estado
Revisión automática de renders: capa `src/review/` (collector de entradas footage/motion con puertos de medición
inyectables y reglas puras) y job `review` (collect → measure → rules → write) que deja `out/<render>.review.json`.
Se encola solo al terminar `render` y `motion`. `GET /projects/:slug/reviews` (lista o `?file=`), `reviewStatus` en
las opciones de publicación y 409 `RENDER_REVIEW_FAILED` al publicar un render `fail` salvo `ignoreReview: true`
(persistido). Margen voz/música por tramo: crítico < 10 dB, sugerencia < 15 dB (calibrado al oído del dueño).
Duración medida por el stream de video. `MOTION_MUSIC_TRACK_VOLUME` exportada desde motion-graphics.

## Estructura
`src/review/*` (reglas, umbrales, collector, adaptador ffmpeg), `jobs/run-review-pipeline.ts`,
`jobs/review-job-params.ts`, handler de reviews.

## Dependencias
Sin cambios.

## Qué sigue
El margen motion no contempla whoosh/riser/impacto; la zona segura de subtítulos se evalúa por el contenedor.
