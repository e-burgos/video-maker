# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
La composición dibuja el logo y aplica la misma normalización de música que el grafo de ffmpeg.

## Estructura
- `helpers/logo-overlay-style.ts` (puro, dentro de `coverage.include` por el glob de `helpers/**`):
  `logoOverlayBox` calcula ancho `widthRatio × format.width` **recortado al espacio entre
  márgenes** y margen `marginRatio × format.width` igual en los dos ejes; `logoOverlayStyle` emite
  sólo la esquina que corresponde (nunca `right` y `left` a la vez).
- `components/logo-overlay.tsx`: `<div style>` + `<Img>`. `TimelineComposition` lo monta **entre
  `BrollTrack` y `KineticCaptions`** —el logo nunca puede tapar texto— y también con
  `audio: 'muted'`, porque el video mudo es el que se muxea.
- `timelineToSequenceProps` gana `logo: LogoSequenceProps | null` (un `assetId` que no resuelve
  cae en `unresolvedAssetIds`) y `AudioSequenceProps.normalizationGainDb`; el `volume` constante ya
  sale de `gainDbToVolume(clip.gainDb + normalizationGainDb)`.
- `volumeAtFrame(automation, frame, offsetDb = 0)`: tercer parámetro opcional, sumado en dB antes
  de convertir a volumen. El clamp a 1 de `gainDbToVolume` sigue aplicando, así que en el preview
  la cama nunca pasa de fondo de escala (en el master ese techo lo pone el `alimiter` del bus).

## Dependencias
Ninguna nueva. `musicNormalizationGainDb` viene de `timeline-core`: la ganancia no se recalcula
acá, para no repetir el problema de la copia de `gainDbToVolume`.

## Qué sigue
`src/components/logo-overlay.tsx` quedó fuera de `coverage.include`, como el resto de
`src/components/**` salvo los tres ya incluidos: toda su lógica vive en el helper puro.
