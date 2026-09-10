# spec-e-burgos-009-voice-over cycle-01 — 2026-09-09

## Estado

Contrato nuevo `VoiceManifest` (`work/voice/manifest.json`): el documento que declara, por escena,
la pista de voz que el resto del pipeline va a usar. Vive acá y no en `apps/render-api` por la misma
regla que trajo a `StoryboardDocument`: `spec-010` produce la `Timeline` desde storyboard + voz
dentro de las libs, y `spec-012` lee las palabras para las captions.

`VoiceTrack` por escena: `sceneId`, `index`, `source` (`generated` | `uploaded`), `path`,
`wordsPath`, `durationMs` (medido, no estimado), `sampleRate`, `voiceId`, `narrationHash` y
`updatedAt`. El schema es estricto y cruza tres invariantes: una sola pista por escena, pistas
ordenadas por `index`, y `voiceId` presente si y sólo si `source` es `generated`.

## Estructura

- `src/schemas/voice-manifest.schema.ts`: `VoiceManifestSchema`, `VoiceTrackSchema`,
  `VoiceTrackSourceSchema`, `emptyVoiceManifest`.
- `src/voice/hash-narration.ts`: `hashNarration` (FNV-1a de 64 bits en hex de 16 dígitos). **No es
  criptográfico**: su único trabajo es responder "¿cambió el texto desde que se sintetizó esta
  pista?". Puro y determinista, evita meter `node:crypto` en una lib pura.
- `src/voice/merge-voice-manifest.ts`: `upsertVoiceTrack` (reemplaza por `sceneId` manteniendo el
  orden por `index`), `findVoiceTrack`, `isVoiceTrackStale`, `dropVoiceTracksOutsideScenes`.

## Dependencias

Ninguna. Zod y nada más, como el resto de la lib.

## Qué sigue

- `VoiceManifest` no está en `sdd/schemas/` ni en el bundle de JSON Schema de la lib
  (`buildJsonSchemaBundle`): es un documento de `work/`, no un contrato de la Timeline. Si algún
  consumidor externo lo necesita, hay que sumarlo al registry y regenerar.
- `durationMs` es la fuente de verdad de la duración de cada escena y todavía **no** reemplaza a
  `estimatedDurationMs` en el `StoryboardDocument`: quien arme la Timeline (`spec-010`) tiene que
  leer el manifest, no el storyboard.
- `PUBLIC_VALUE_EXPORTS` de `schemas.spec.ts` es una lista cerrada: todo export nuevo de `index.ts`
  hay que agregarlo ahí o la suite lo marca.
