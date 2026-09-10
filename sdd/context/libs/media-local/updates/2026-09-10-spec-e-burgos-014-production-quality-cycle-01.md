# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
La cama musical se normaliza en el grafo del mix **antes** de aplicar las ganancias del preset.
`buildMusicBedChain` antepone `volume=<g>dB` cuando el asset trae `audio.integratedLufs`, con
`g = musicNormalizationGainDb(integratedLufs, audioMix.music.referenceLufs)`. Sin medición no
emite nodo alguno: el comportamiento viejo se conserva byte a byte.

## Estructura
- `buildMusicBedChain` acepta `measuredLufs?`; `buildAudioMixGraph` lo resuelve desde
  `timeline.assets` por `clip.assetId`.
- `apad` pasa a `apad=whole_dur=<duración del video en s>` (antes `apad` a secas, stream infinito
  acotado sólo por el `atrim` siguiente). El `atrim=end` se conserva: también recorta una música
  más larga que el edit. **Cambio de contrato deliberado**: los tests de string del filtergraph se
  actualizaron.
- `FIRST_AUDIO_STREAM` se exporta desde el barrel (lo usa el ingest de `auto-montage`).

## Dependencias
Ninguna nueva. Se eligió `volume=NdB` y no una segunda pasada de `loudnorm`: ganancia lineal
invariante en el tiempo, determinista, testeable como string y sin el resampleo a 192 kHz.

## Qué sigue
La medición NO se hace acá: la escribe el ingest de `auto-montage` en el catálogo. Si alguna vez
se mezcla una Timeline armada a mano sin `integratedLufs`, la cama vuelve al nivel crudo del
archivo — es la degradación elegida, no un bug.
