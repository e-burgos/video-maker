# FIX-e-burgos-067 — La cama de música del montaje baja 2 dB

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-067 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El review del FIX-e-burgos-048 exige que la voz quede 15 dB por encima de la música. Con la cama de los presets, el tutorial de prueba quedaba en 14,6 dB, al límite. El dev aprobó bajar la cama unos 2 dB, una vez integrada la normalización lineal del máster (FIX-e-burgos-064), que ya no altera el balance de la mezcla.

## Solución
- `software-demo`, `educational` y `recipe` pasan de −8/−18 a −10/−20 dB (base/duckeada).
- `hardware`, el preset de publicidad, pasa de −4/−12 a −6/−14 dB.
- La receta Publicidad del productor sigue fijando −4/−12 a propósito.
- **Pendiente** (archivo compartido, falta OK de la sesión de música): los números de la receta Tutorial en `build-producer-prompt.ts`, que todavía dicen −8/−18. Como esa receta dice "do not override them", el productor no los pisa: el texto queda viejo, pero no cambia la mezcla. Lo mismo pasa con la tabla §5 del SKILL `video-producer`, que es de la sesión de música.

## Verificación
- `nx test`, `lint` y `build` en verde: auto-montage 381, render-api 2291 (un test de probe de medios hace timeout bajo carga y pasa aislado), web 1653.
- Review del studio sobre `media/prueba-motion-guion`, re-montado con los presets nuevos: margen voz/música de 16,6 dB (antes 14,6, que era crítico), estado `pass`, máster en −14,18 LUFS y pico −1,45 dBTP. La música sigue en la mezcla a −10 dB en los tramos sin voz.
