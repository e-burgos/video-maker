# spec-e-burgos-023-production-quality cycle-04 — 2026-10-12

## Estado
Propuesta del proyecto en `work/producer/proposal.json` con `GET/PUT /projects/:slug/proposal` y `POST .../proposal/approve` (`PROPOSAL_NOT_FOUND`); el texto del productor no puede escribirla (PATH_NOT_WRITABLE). Estimación recalculada en cada GET con la mediana de segundos de proceso por segundo de video del historial de jobs. Jobs `render` y `motion` aceptan `sample {seconds 8-20}`: salida `out/<id>.sample.mp4`, reporte `sample: true`, sin job de revisión, excluida de publicar y de la vista motion.

## Estructura
Nuevo `src/proposal/` (estimate-production, estimate-engine, job-history, proposal-store, proposal-paths), `http/handlers/proposal-handler.ts` y `jobs/sample-job-params.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Reiniciar el studio sólo con la cola de publicación frenada (ver lessons).
