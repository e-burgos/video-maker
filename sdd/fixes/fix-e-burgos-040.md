# FIX-e-burgos-040 — Transiciones oficiales de Remotion (etapa 1 de motion graphics)

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-040 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Etapa 1 de `docs/research/2026-11-10-motion-graphics-productor.md`. `@remotion/transitions@4.0.522` ya estaba instalado, pero solo se usaban `fade` y `slide`.

## Solución
- `TimelineTransitionKindSchema` y `TransitionKindSchema` suman `wipe`, `flip`, `clock-wipe` e `iris` (JSON Schemas regenerados).
- `presentationFor` arma `wipe()` y `flip()` con la dirección de la timeline, y `clockWipe()`/`iris()` con el ancho y alto de la composición (los lee `ArollSeries` con `useVideoConfig`).
- `planTransitions` le da dirección también a `wipe` y `flip`.
- Pools por preset: `software-demo` whip-pan/wipe/fade/slide/flip · `educational` fade/light-leak/wipe/iris/slide · `hardware` slide/flip/fade/whip-pan/clock-wipe · `recipe` light-leak/whip-pan/iris/clock-wipe/slide.
- **Fuera:** `zoomBlur`, `zoomInOut` y `filmBurn` existen en la versión instalada pero son presentaciones HTML-in-Canvas: tiran error salvo en Chrome ≥148 con `chrome://flags/#canvas-draw-element`. `cube()` es pago y no se usa.

## Verificación
- `nx test`, `lint` y `build` en verde para timeline-core, auto-montage, composition-remotion, motion-graphics, producer-tools, render-api y web (un test de `settings-page` falla solo bajo carga y pasa aislado).
- Render de prueba del modo A y del modo B con escaneo de destellos blancos: ver la sección de renders del reporte final de la sesión.
