# FIX-e-burgos-006 — Proyectos de motion graphics completos en el estudio

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-006 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-08 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-020-motion-mode |

## Problema
En los videos motion, storyboard, voz y vista previa mostraban vacíos (sólo leían artefactos de material crudo); la
barra del proyecto no llevaba al productor ni a Motion; las sugerencias del productor salían como texto crudo y al
tocarlas se enviaban. En display-ads-ia-promo el productor no conocía el formato de las fotos del storyboard, falló dos
renders, regeneró el storyboard entero y perdió el volumen de la música (0,15 → 0,5) y los capítulos.

## Solución
- Barra única por modo en todas las pantallas del proyecto.
- Vistas motion de lectura sobre `GET /motion/overview`: escenas por capítulo con textos y fotos, pistas de voz con
  "desactualizada", video con escenas para saltar y créditos. Biblioteca motion: sólo fotos ("Fotos del video").
- Sugerencias: cargan la caja y le dan foco; el bloque se quita de la actividad del turno.
- `PUT /motion/storyboard` valida las fotos y nombra el formato y las disponibles; el error llega al modelo.
- Regenerar conserva `music.volume`; la receta motion explica el formato y prohíbe regenerar para cambiar fotos o textos.
