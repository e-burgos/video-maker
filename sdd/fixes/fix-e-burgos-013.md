# FIX-e-burgos-013 — La marca se escribe "Display Ads" en los videos motion y en los borradores de YouTube

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-013 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-09 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- `brand.json` de DisplayAds tenía `name: "DisplayAds"`. Ese nombre es el texto de la etiqueta de marca de todos los
  videos motion (al lado del isotipo) y el "nombre escrito" con el que el borrador de YouTube reemplaza al nombre
  hablado: un título "en Display Ads" salía "en DisplayAds". La regla del dueño es que todo texto lleve espacio; sólo
  el wordmark del logo (imagen) dice "DisplayAds".

## Solución
- `name: "Display Ads"`. Al coincidir con `spokenName`, el borrador ya no lo reescribe; la etiqueta de los videos
  motion muestra "Display Ads". El logo (imagen) no cambia.
