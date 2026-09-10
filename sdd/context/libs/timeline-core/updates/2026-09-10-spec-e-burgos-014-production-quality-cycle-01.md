# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
El contrato del motor ya describe cómo se normaliza la música y dónde va el logo.
`MusicMixSettings` gana `referenceLufs` (default **-16**, `z.number().max(0)`) y
`src/audio/music-normalization.ts` expone `musicNormalizationGainDb(measuredLufs, referenceLufs)`
—clamp ±18 dB, 0 sin medición o con `-inf`— que es la **única** fuente de la ganancia de
normalización para los dos renderers. La `Timeline` gana `logo?: LogoOverlay` opcional en la raíz
(`assetId`, `position` default `bottom-right`, `widthRatio` 0.32, `marginRatio` 0.035,
`opacity` 1) y `validateTimeline` dos códigos nuevos: `LOGO_ASSET_NOT_FOUND` y
`LOGO_ASSET_NOT_IMAGE`.

## Estructura
- `src/audio/music-normalization.ts` (+ spec): primer archivo bajo `src/audio/`.
- `buildTimeline(edl, assets, music?, logo?)`: `MusicInput.mix?: MusicMixSettings` alimenta
  `audioMix.music` **y** `planDucking`. Antes se hardcodeaba `DEFAULT_MUSIC_MIX`, así que cambiar
  un preset de `auto-montage` era un no-op: el consumidor real es `audioMix.automation`.
  `LogoInput` es el cuarto parámetro y los defaults los aplica `LogoOverlaySchema.parse`.
- JSON Schema regenerado (`pnpm nx run timeline-core:schemas`): `timeline.schema.json` y
  `audio-mix-plan.schema.json`.

## Dependencias
Sin dependencias nuevas. `audio-mix-plan.schema.ts` importa la constante de `src/audio/`, no al
revés.

## Qué sigue
`MediaAsset.audio.integratedLufs` sigue siendo opcional: quien no lo mida no normaliza. Si alguna
vez se quiere una referencia por proyecto editable desde la web, ya está en el documento
(`audioMix.music.referenceLufs`) y no hace falta tocar el schema.
