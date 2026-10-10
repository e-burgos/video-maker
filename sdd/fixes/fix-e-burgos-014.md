# FIX-e-burgos-014 — Los videos motion se entregan a -14 LUFS

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-014 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-09 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- FIX-e-burgos-010 normalizó el máster de los videos de material crudo, pero el render de motion (HyperFrames)
  mezcla voz y música dentro del MP4 y nada lo medía: los videos de "Conocé Display Ads" salían entre -20 y -24 LUFS,
  mucho más bajos que los tutoriales a -14.

## Solución
- `normalizeVideoMasterLoudness` (media-local) mide el primer stream de audio del MP4 y, si está a más de 0,5 LU del
  objetivo o con el pico alto, reescribe el MP4 copiando el video y re-codificando sólo el audio con un loudnorm
  lineal de segunda pasada (AAC 192k, 0,5 dB de margen de pico).
- El `render` de motion lo aplica en los dos caminos: el CLI `motion-studio` y el job `motion` de render-api.
