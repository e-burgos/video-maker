# FIX-e-burgos-048 — Margen voz/música crítico debajo de 15 dB

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-048 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El review marcaba crítico un margen voz/música menor a 10 dB, y entre 10 y 15 dB solo dejaba una sugerencia. La regla del dev para publicar (FIX-015) pide ≥15 dB, así que un video podía pasar el review y fallar el chequeo previo a publicar.

## Solución
- Los dos umbrales pasan a uno solo: `VOICE_MUSIC_MIN_MARGIN_DB = 15`.
- Cualquier tramo con la voz a menos de 15 dB por encima de la música y los efectos es **crítico**. El arreglo propuesto dice cuántos dB hay que bajar.
- Ya no hay banda de sugerencia.

## Decisión
El dev eligió esta opción el 2026-11-11: «Seguir de acuerdo a tu recomendación». Reemplaza la calibración del 2026-10-11 (commit 5e38205), que aceptaba como sugerencia una mezcla aprobada de oído con 13 dB en su peor tramo.

## Verificación
- `nx test` y `lint` de render-api en verde (2273).
- El test de la mezcla de 13 dB ahora exige una falla crítica y propone bajar 2,0 dB.
- El caso de 13,5 dB en footage también es crítico y marca el tramo correcto.

## Efecto
Los videos con un margen de 10 a 15 dB, que antes pasaban, ahora fallan el review hasta que se baje la música.
