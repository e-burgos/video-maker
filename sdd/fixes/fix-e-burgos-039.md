# FIX-e-burgos-039 — Rotación de salidas y transiciones (etapa 0 de motion graphics)

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-039 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Etapa 0 de `docs/research/2026-11-10-motion-graphics-productor.md`. En el modo B todas las escenas salían con la misma animación (opacidad + `y: -24` + blur). En el modo A cada preset alternaba siempre los mismos dos tipos en el mismo orden, y como el productor manda `seed: 0`, dos videos del mismo preset quedaban idénticos. El `light-leak` del preset `recipe` caía a un `fade`.

## Solución
- **timeline-core.** `random/seeded-random.ts`: mulberry32 (el de los punch-ins), `pickAvoidingPrevious`, `pickAvoidingRecent` y `hashStringToSeed`. Los punch-ins lo reusan sin cambiar su salida.
- **Modo A.** `planTransitions` recibe la semilla del montaje y elige el tipo sin repetir ninguno de los dos cortes anteriores; la dirección de `slide`/`whip-pan` también sale de la semilla. Los pools de los presets pasan a tres tipos: `software-demo` whip-pan/fade/slide, `educational` fade/light-leak/slide, `hardware` slide/fade/whip-pan, `recipe` light-leak/whip-pan/slide.
- **light-leak.** `lightLeak()` de Remotion no está instalado (`@remotion/effects` y `@remotion/light-leaks` no están en el repo). Se implementa una presentación propia en CSS (`transitions/light-leak.tsx`): fundido con un destello cálido ámbar/rosa que viaja de izquierda a derecha, pico 0,6 de opacidad a mitad del corte y sin blanco.
- **Modo B.** Campo opcional `exit` por escena (`blur-up`, `slide-left`, `scale-down`, `drop`, `wipe`, `iris`). El compositor completa los que faltan con una semilla derivada de marca + título, sin repetir ninguna de las dos salidas anteriores (con solo la anterior, cinco escenas podían alternar dos salidas), y antes de un capítulo nuevo usa un corte fuerte (`wipe`, `iris`, `slide-left`). El runtime lee `data-exit`; la última escena sigue con su fundido.

## Verificación
- `nx test`, `lint` y `build` en verde para timeline-core, auto-montage, composition-remotion y motion-graphics.
- Render de prueba por modo con escaneo de destellos blancos: ver el reporte del FIX-e-burgos-040.
