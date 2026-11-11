# FIX-e-burgos-065 — Fuera los efectos de Pixabay

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-065 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Los 8 efectos de `libs/motion-graphics/assets/runtime/sfx/` venían de las skills de HyperFrames, pero los archivos eran de Pixabay. La Pixabay Content License no permite distribuirlos sueltos, ni en el repo público ni en el instalador. Además, el CREDITS.md de la marca los daba por Apache 2.0, y la plantilla a mano de presentación de Display Ads seguía usando seis de ellos. El dev aprobó sacarlos.

## Solución
- **Elecciones del banco.** `pickMotionSfx` ofrece dos variantes distintas de cada tipo del banco (`whoosh`, `impact`, `shimmer`, `riser`, `typing`, `click`). Las plantillas las piden como `{{sfx_src:<tipo>}}` / `{{sfx_dur:<tipo>}}`, y la segunda variante como `{{sfx_src:<tipo>:2}}`.
- **Plantilla `tools/motion-studio/templates/displayads/presentacion`.** Pasa al banco:
  - riser → `riser`;
  - impacto → `impact`;
  - click → `click`;
  - notificación → `shimmer`;
  - pop → `click:2`;
  - campana → `shimmer:2`.
- **Créditos.** Solo se acreditan los CC BY que aparecen en el `index.html` compuesto.
- **Borrado y CREDITS.** Se borraron los 8 archivos de `runtime/sfx/`, y el CREDITS.md de la marca ahora explica de dónde salen los efectos y por qué se quitaron los anteriores.
- **Pendiente de la sesión de música (archivos suyos):**
  - el SKILL `video-producer` (§ efectos del modo B) todavía nombra `runtime/sfx/`;
  - dos specs de review usan esas rutas como texto de prueba, sin leer archivos.

## Verificación
- `nx test`, `lint` y `build` en verde: motion-graphics 342, motion-studio 17, render-api 2291.
- Render real de la plantilla de presentación (86,6 s):
  - todos los efectos salen de `assets/sfx-bank/` y no queda ninguna referencia a `runtime/sfx`;
  - 7 whooshes rotando;
  - créditos con la música y el único CC BY usado;
  - −14,3 LUFS, pico −2,0 dBTP y 0 destellos;
  - ningún efecto supera el momentáneo de su contexto.
