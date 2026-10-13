# FIX-e-burgos-021 — Las muestras se reconocen por el dato del render y no por el nombre del archivo

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-021 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- La web (Biblioteca, Entregas, Vista previa, publicar) y render-api deducían que un mp4 es muestra por el sufijo .sample.mp4; el render ya guarda sample: true en su reporte.

## Solución
- El clasificador `apps/render-api/src/jobs/sample-files.ts` cruza cada archivo con el job que lo produjo y usa `report.sample`; el sufijo `.sample.mp4` queda sólo como respaldo sin job. `RenderJobSummary` y cada archivo de `GET /projects/:slug/generated` llevan `sample`; overview motion, borrador y precondiciones de publicación deciden con ese dato. La web usa `file.sample`/`job.sample` y se borró `isSampleVideoPath`.

## Verificación
- render-api y web lint/test/build verde; GET generated en el studio marca out/video.sample.mp4 por el job y la Biblioteca muestra la insignia Muestra.
