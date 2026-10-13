# FIX-e-burgos-028 — Las cajas que el productor mide sobre una captura quedan registradas como medidas

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-028 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Las cajas medidas por el productor mirando la captura (no venían en el brief) no se distinguían de las dadas, y la verificación no podía separarlas.

## Solución
- `ImageBoxSchema` suma `source: given|measured` (default given) con `measuredBy`/`measuredAt` obligatorios si es measured. `write_motion_brief` completa quién/cuándo, conserva las medidas y rechaza pisar una given. `listMeasuredBoxes` llega al overview motion (`measuredBoxes`) y la vista del storyboard las lista aparte «a confirmar».

## Verificación
- motion-graphics, producer-tools, render-api y web lint/test/build verde.
