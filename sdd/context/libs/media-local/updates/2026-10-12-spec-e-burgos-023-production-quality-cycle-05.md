# spec-e-burgos-023-production-quality cycle-05 — 2026-10-12

## Estado
`detectSceneCuts` muestrea puntajes de escena a 4 cuadros por segundo (`metadata=print`) y elige picos locales sobre un umbral adaptativo (media + 2 desvíos, entre 0,05 y 0,3) con escena mínima de 1,5 s: detecta transiciones suaves de motion además de cortes secos. `extractSceneKeyframes` saca un cuadro en la mitad de cada escena.

## Estructura
Nuevos `ffmpeg/detect-scene-cuts.ts` y `ffmpeg/extract-scene-keyframes.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
