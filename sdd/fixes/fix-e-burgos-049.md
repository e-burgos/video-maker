# FIX-e-burgos-049 — True peak bajo el techo después del AAC, en los dos másters

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-049 |
| **Tipo** | FIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El vertical de la prueba conjunta salió con el pico verdadero en −0,28 dBTP, cuando el techo es −1. `loudnorm` deja el audio en −1,5 dBTP, que es el techo menos 0,5 dB de margen para el encoder. Pero con este material, el AAC a 192k suma entre 1,5 y 1,8 dB.

## Solución
- **Motion** (`normalizeVideoMasterLoudness`): después del loudnorm y el AAC, mide el true peak del MP4 temporal.
- **Montaje** (`normalizeMasterLoudness`): después de normalizar el WAV, lo codifica a una sonda AAC con el mismo códec y bitrate del mux (`aac`, 192k), la mide y la borra. Lo hace también cuando el WAV no necesitaba normalizarse.
- **Reintento:** si el pico pasa del techo (−1 dBTP), se rehace el loudnorm **una sola vez** desde el original. El target se baja en lo que sumó el encoder más 0,5 dB de margen (`true-peak-guard.ts`).
- El margen general de 0,5 dB no cambia: solo se ajustan los másters que lo necesitan.
- El resultado suma `truePeakRetried`.

## Verificación
- `nx test` y `lint` en verde para media-local (448, con casos nuevos de reintento en los dos másters) y render-api (2273).
- En la corrida en paralelo, `review-measurements` tuvo un timeout suelto; corrido solo pasa.
- **Prueba real sobre el audio del vertical**, en el peor caso, porque la copia ya venía codificada dos veces:
  - motion pasó de +1,01 a −1,08 dBTP;
  - el montaje quedó en −1,59 dBTP después del AAC;
  - los dos reintentaron.
- **Sin el margen de 0,5 dB**, el reintento quedaba en −0,93 y −0,83. El sobrepico del AAC crece cuando loudnorm limita más.

## Costo
En ese peor caso el integrado baja a unos −15 LUFS. El review lo marca como sugerencia (tolerancia de 1 LU), no como crítico. Además, cada máster del montaje suma una codificación AAC de prueba.
