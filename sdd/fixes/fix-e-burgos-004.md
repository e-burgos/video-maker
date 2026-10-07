# FIX-e-burgos-004 — La página Motion muestra el video ya renderizado

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-004 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-07 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-020-motion-mode |

## Problema
La página Motion sólo mostraba el video del job lanzado en esa visita; al volver, o en un proyecto importado, no había reproductor.

## Solución
Al abrir la página se lista lo generado del proyecto y se muestra el MP4 más reciente de `out/` con el crédito de su `.credits.txt`.
Se importaron al estudio los videos hechos por CLI (Easy Pro, Counter 15, presentación y la promo de IA) en Display Ads › Motion graphics.
