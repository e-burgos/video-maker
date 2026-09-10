# spec-e-burgos-010-scene-assembly cycle-01 — 2026-09-10

## Estado
La mezcla de audio ahora dura exactamente lo que el video. Antes terminaba en el último clip de
audio, y como el mux usa `-shortest`, cualquier `Timeline` cuyo final no tuviera audio salía
recortada: el modo storyboard entrega la última escena con padding sin voz y el MP4 salía 10 frames
más corto que la `Timeline`. En el modo A-roll nunca se vio porque ahí la voz espeja al A-roll.

## Estructura
`mix/build-audio-mix-graph.ts` — la cadena final del `amix` es
`amix → asetpts=N/SR/TB → apad=whole_dur=<durationFrames/fps> → atrim=end=<misma duración>`.
Los tres nodos son necesarios y cada uno por su motivo:
- `asetpts=N/SR/TB` reconstruye el reloj desde el conteo de muestras. `loudnorm` desfasa el PTS, y
  sin esta reconstrucción el `atrim` corta un frame antes de lo pedido.
- `apad=whole_dur=` rellena hasta la duración exacta. **Nunca un `apad` pelado**: sin límite genera
  silencio infinito, y con un grafo de varias voces el `atrim` posterior no lo termina — llenó el
  disco en el smoke de este ciclo.
- `atrim=end=` cubre la dirección contraria, recortar una mezcla más larga que el video.

`mix/build-music-bed-chain.ts` quedó endurecido igual (`apad=whole_dur=` en vez de `apad`).

## Dependencias
Ninguna nueva.

## Qué sigue
Hay test que exige `whole_dur` en **todo** `apad` del grafo. Si aparece otro `apad`, va acotado.
