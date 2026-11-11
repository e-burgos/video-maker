# FIX-e-burgos-074 — peakMs en el banco de SFX

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-074 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
En el studio, motion vio que con riser-2 la subida se adelantaba respecto del drop. Compose alinea los efectos por duración, pero no todos tienen la cresta al final. riser-2 es un «Build-Up and Hit»: sube, golpea a la mitad y después decae.

## Solución
- **Medición:** `sfx-bank.json` suma `peakMs` a los 18 efectos, el momento en que cada uno suena más fuerte. Se mide con una envolvente RMS de 100 ms que avanza de a 10 ms. Con 10 ms se marcaban transitorios sueltos: riser-3 daba 405 ms antes del final, cuando se oye a 180 ms.
- **Schema:** `peakMs` es obligatorio, y se rechaza una cresta que caiga después del final del efecto.
- **Fixtures:** `sfx-picks.ts` y el banco de prueba de render-api suman el campo.

## Crestas medidas

| Tipo | Dónde cae la cresta |
| --- | --- |
| Impactos | 50–80 ms después del inicio |
| Whoosh | a un tercio, 210–240 ms |
| Brillos | 150–290 ms |
| riser-1 | 1510 de 1570 ms |
| riser-3 | 2230 de 2410 ms |
| riser-2 | 990 de 2000 ms (golpe a la mitad) |
| Tipeo | 210–820 ms |
| Clicks | 60–90 ms |

## Verificación
`nx test` y `lint` en verde: motion-graphics (344) y render-api (2291).

## Pendiente de motion
Alinear compose por `peakMs`.
