# FIX-e-burgos-011 — Subtítulos que respetan la frase, caja de una línea y logo propio de los bumpers

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-011 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-09 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- La revisión de display-ads de la tanda de tutoriales marcó que `subtle-lower` cortaba frases por cantidad de
  palabras ("que conoce / tu negocio", "tus datos / reales.", "de tu / cuenta."), juntaba dos oraciones en un bloque
  y que su caja de dos líneas (15 % del alto) tapaba botones narrados de la UI.
- El dueño pidió el isotipo chico como marca de agua en los tutoriales, pero los bumpers usaban el mismo logo que el
  cuerpo: no había forma de mostrar el logo largo en la entrada y la salida.

## Solución
- `groupWordsForCaptions` con `respectPhrases`: corta siempre en fin de oración y en silencios, y parte cada oración
  que no entra en `maxChars`/`maxWords` en el mejor punto (después de coma/dos puntos, antes de una conjunción, nunca
  después de un artículo o preposición), con piezas de al menos 3 palabras. `subtle-lower` lo activa con 52
  caracteres por línea; los demás estilos no cambian.
- Preset `subtle-lower`: una sola línea, caja del 8 % del alto y letra hasta 3,8 % del alto.
- `LogoBumper.logoAssetId` opcional: cada bumper puede mostrar su propio logo (cae al del cuerpo si no lo trae);
  validación `BUMPER_LOGO_ASSET_NOT_FOUND`/`_NOT_IMAGE`, sin aviso `BUMPER_WITHOUT_LOGO` cuando lo trae, y el
  re-montaje arrastra ese asset desde la Timeline previa.
