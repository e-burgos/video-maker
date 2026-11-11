# FIX-e-burgos-062 — El modo B rota sus efectos del banco nuevo

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-062 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Todo video del modo B disparaba la regla `sfx-repetition` del FIX-e-burgos-061: `compose-template` ponía el mismo `whoosh.mp3` en cada corte, y la sesión de música midió 6, 5 y 8 seguidos en tres videos reales. Además, el whoosh, el riser y el impacto del drop salían de `runtime/sfx/`, que son de Pixabay y no se pueden redistribuir.

## Solución
- `pickMotionSfx` elige del banco `assets/sfx-bank` (FIX-e-burgos-059) con la semilla del proyecto:
  - un whoosh por corte, sin repetir ninguno de los dos anteriores;
  - un riser y un impacto para el drop.
- `composeProject` copia el banco al proyecto (`assets/sfx-bank`). La plantilla del storyboard pasa a usar marcadores `{{sfx_src:…}}` y `{{sfx_dur:…}}` para el riser y el impacto. El riser arranca su duración antes del drop, así termina justo ahí.
- Créditos: los efectos CC BY usados van a `sfx-credits.json` y `renderProject` los suma al `<video>.credits.txt`, haya música o no. También los devuelve como `sfxCredits`.
- Si el banco falta, los cortes quedan sin whoosh en lugar de fallar.
- **Fuera de alcance:** los archivos de Pixabay siguen en `runtime/sfx/` y la plantilla a mano `tools/motion-studio/templates/displayads/presentacion` todavía los referencia. Borrarlos espera la decisión del dev.

## Verificación
- `nx test`, `lint` y `build` en verde: motion-graphics 341, render-api 2288, motion-studio 17.
- Render real del storyboard de prueba (11 escenas):
  - 9 whooshes que rotan entre tres variantes sin repetir;
  - riser e impacto del banco;
  - créditos con la música y los dos efectos CC BY;
  - −14,1 LUFS, pico −1,3 dBTP y 0 destellos.
