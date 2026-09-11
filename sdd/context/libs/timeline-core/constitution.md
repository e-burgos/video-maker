# Constitución — libs/timeline-core

> Versión 1.1 | Última actualización: spec-008 c01 + spec-009 c01 + spec-014 c01 + fixes 003-003 / 007-002 / 009-002 | Fecha: 2026-09-11
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-001-core-composition-media-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib de dominio (TypeScript puro, isomórfica)
- **Rol en el sistema:** fuente de verdad de los contratos de datos del motor de video
  (`Timeline`, `EditDecisionList`, `Transcription`, `MediaAsset`, `AudioMixPlan`, `OutputFormat`,
  `StoryboardDocument`, `VoiceManifest`, `VoiceScriptManifest`) y de los cálculos de edición que los
  producen y validan. Ninguna otra lib define esos tipos.

## 2. Stack tecnológico

- TypeScript estricto (ESM, `module: esnext`, `target: es2022`)
- Zod 4 para schemas y tipos inferidos; JSON Schema generado con `z.toJSONSchema()`
- Vitest para tests; sin dependencias de runtime fuera de `zod` (dev del workspace: `@swc-node/register` para el target `schemas`, Vitest 4 + `@vitest/coverage-v8`, `ajv`/`ajv/dist/2020` en los tests de JSON Schema derivado, Prettier)
- La lib **no tiene `package.json` propio**: se consume por source vía el alias de `tsconfig.base.json`

## 3. Estructura y patrones

- `src/index.ts` es la única superficie pública. `PunchInAnchorSchema` y `ClipTransformSchema` no se exportan ahí. `PUBLIC_VALUE_EXPORTS` de `schemas.spec.ts` es una **lista cerrada**: todo export nuevo del índice hay que agregarlo ahí o la suite lo marca.
- `src/schemas/` — un archivo por contrato (`primitives.ts`, `registry.ts`, `json-schema.ts` incluidos), exporta el schema Zod y el tipo inferido
- `src/units/`, `src/format/`, `src/silence/`, `src/punch-in/`, `src/captions/`, `src/ducking/`, `src/audio/`, `src/voice/`, `src/timeline/` (`build-timeline.ts`, `validate-timeline.ts`, `remap-ms-after-cuts.ts`, `ids.ts`) — un módulo por familia de cálculos, funciones puras. Nombres de archivo: los de `tasks.json`/`planner.md` (`detect-silences.ts`, `plan-punch-ins.ts`, `remap-ms-after-cuts.ts`), no los abreviados de `architect.md` §2.
- `src/types/units.ts` — tipos de unidades (`Ms`, `Frame`)
- `schemas/*.schema.json` — JSON Schema generado y commiteado (test anti-drift). Se regenera con `pnpm nx run timeline-core:schemas` (`node -r @swc-node/register ./tools/generate-schemas.ts` — registro **CJS**; `--import @swc-node/register/esm-register` rompe por interop ESM/CJS en este repo). Determinista: dos corridas seguidas dejan `git diff` vacío. `schemas.spec.ts` compara byte a byte contra los archivos de `schemas/` (CA-016), así que tras tocar cualquier schema Zod hay que correrlo y commitear el resultado.
- `src/schemas/json-schema.ts` post-procesa la salida de `z.toJSONSchema(registry)`: Zod extrae subestructuras compartidas a un documento sintético `__shared`, y el post-proceso las inlinea como `$defs` locales para que los archivos queden autocontenidos.
- **Timeline.** `ClipTransform` (en `tracks.aroll[]`/`tracks.broll[]`) tiene un campo opcional `anchor: PunchInAnchor` (`src/schemas/timeline.schema.ts`, importa `PunchInAnchorSchema` de `./edit-decision-list.schema`); `buildTimeline` lo propaga desde `PunchInDecision.anchor` únicamente al sub-rango con zoom que ese punch-in genera (`KeepSubRange.anchor?`), nunca a los sub-ranges sin zoom. La raíz tiene además `logo?: LogoOverlay` (`assetId`, `position` default `bottom-right`, `widthRatio` 0.32, `marginRatio` 0.035, `opacity` 1 — defaults aplicados por `LogoOverlaySchema.parse`) y `captionStyle?` (ausente = comportamiento previo; `'off'` apaga la capa). `validateTimeline` tiene los códigos `LOGO_ASSET_NOT_FOUND` y `LOGO_ASSET_NOT_IMAGE`.
- **`buildTimeline(edl, assets, music?, logo?, voice?, captionStyle?)`.** `MusicInput.mix?: MusicMixSettings` alimenta `audioMix.music` **y** `planDucking` (antes se hardcodeaba `DEFAULT_MUSIC_MIX`, así que cambiar un preset de `auto-montage` era un no-op: el consumidor real es `audioMix.automation`). `VoiceInput` (`{ assetId, durationMs? }`) construye la pista `voice` desde un asset propio en vez de espejar el A-roll: `buildVoiceTrack` mapea **uno a uno** los clips de A-roll (mismo `from`, `durationFrames`, `trimStartMs`) cambiando sólo el `assetId`; `durationMs` recorta `durationFrames` (`framesFittingInto` baja un frame si el `ceil` del validador se pasaría) y un clip que queda en 0 frames no se emite. `captionStyle` se emite con `optionalField` después de `safeZone`: ausente ⇒ la clave no existe ⇒ documento idéntico al anterior.
- **Captions.** `captions/caption-style.ts` define `CAPTION_STYLES`, `isCaptionStyle` y `captionGroupingForStyle(style)` (devuelve `null` salvo para `subtle-lower`). `captions/group-words-for-captions.ts` tiene `minWords` (default `1`): cantidad, duración y hueco cortan siempre; el fin de oración recién corta cuando el grupo alcanzó `minWords` — con `minWords: 1` el OR es idéntico al anterior. `tracks.captions[].words` admite 1–10 y `emphasisIndex` 0–9.
- **Audio.** `src/audio/music-normalization.ts` expone `musicNormalizationGainDb(measuredLufs, referenceLufs)` (clamp ±18 dB, 0 sin medición o con `-inf`), **única** fuente de la ganancia de normalización para los dos renderers; `MusicMixSettings.referenceLufs` default **-16**. `audio-mix-plan.schema.ts` importa la constante de `src/audio/`, no al revés.
- **Storyboard.** `src/schemas/storyboard.schema.ts`: `StoryboardDocumentSchema`, `StoryboardProposalSchema`, `storyboardProposalJsonSchema()` y `toStoryboardDocument()`. `remotionScene` es un **objeto plano con `kind`** validado por refinamiento cruzado, no una unión discriminada (las uniones son lo que peor sobrevive a la salida estructurada de un agente). El modelo nunca asigna `id`, `index` ni `createdAt`: los pone `toStoryboardDocument()` y el `index` se deriva de la posición. El JSON Schema se deriva del objeto **sin refinar** y **descarta `$schema` y `$id`** — un JSON Schema con `$schema` desactiva en silencio la salida estructurada de `claude -p`. No está en `timelineSchemaRegistry`.
- **Voz.** `src/schemas/voice-manifest.schema.ts` (`VoiceManifest`, `VoiceTrack` por escena con `sceneId`, `index`, `source`, `path`, `wordsPath`, `durationMs` medido, `sampleRate`, `voiceId`, `narrationHash`, `updatedAt`; invariantes: una pista por escena, orden por `index`, `voiceId` sii `source: 'generated'`) y `emptyVoiceManifest`. `src/voice/hash-narration.ts`: `hashNarration` (FNV-1a 64 bits, **no criptográfico**, evita `node:crypto`). `src/voice/merge-voice-manifest.ts`: `upsertVoiceTrack`, `findVoiceTrack`, `isVoiceTrackStale`, `dropVoiceTracksOutsideScenes`. `VoiceManifest` no está en el bundle de JSON Schema: es un documento de `work/`.
- **Guion cronometrado.** `voice/parse-voice-script-lines.ts`: `parseVoiceScriptLines` (`[m:ss]`, `[mm:ss]`, `[m:ss-m:ss]` con separador `-`/`–`/`—`), `hasVoiceScriptTimeMarks`, `stripVoiceScriptTimeMarks` (lo que no matchea queda como texto: `[nota] Frase` no es una marca). `voice/plan-voice-script-placements.ts`: `planVoiceScriptPlacements(lines, { gapMs, allowSpeedUp })` devuelve `startMs`/`endMs`/`requestedStartMs`/`overflowMs`/`lengthScale`; el remedio va colchón → `--length-scale` (tope `VOICE_SCRIPT_MIN_LENGTH_SCALE = 0.85`) → desplazar, y **sin marcas reproduce exactamente el encadenado anterior**. `schemas/voice-script-manifest.schema.ts`: `lines[]` con `endMs`, `requestedStartMs` (nullable), `overflowMs` y `lengthScale` **opcionales** (`schemaVersion` sigue en `1`); `voiceScriptManifestIsTimed(manifest)` es la única definición de "guion cronometrado".
- `src/__fixtures__/` — EDL y transcripciones de ejemplo para tests; **no** se exportan desde `src/index.ts`
- **Targets de `project.json` (todos explícitos, sin targets inferidos por plugin):** `lint` (`@nx/eslint:lint`), `test` (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json` — typecheck + `.d.ts`; Vitest no typechequea) y `schemas`. Se quitaron de `nx.json` los plugins `@nx/vitest` (inferia `test` en modo watch, cuelga `nx run-many -t test` fuera de CI) y `@nx/eslint/plugin` (target `eslint:lint` duplicado). Matiza `architect.md` D-02/D-04: sin bundler, pero **con** target `build`.

## 4. Convenciones propias

- **Cero I/O y cero React**: no importar `node:*`, `fs`, `child_process` ni `react`
- **Determinismo**: nada de `Date.now()`, `Math.random()` ni lectura de `process.env`; la variación se recibe por `seed`
- **Unidades**: `Ms` (enteros) en el dominio de medios, `Frame` (enteros) en la timeline; una única función de conversión
- **Sin comentarios** en el código (regla del repo); nombres declarativos y funciones cortas
- ESLint de la lib impone mecánicamente las reglas de determinismo: `no-explicit-any`, `no-restricted-globals` (`Date`, `process`), `no-restricted-properties` (`Math.random`) y `no-restricted-imports` (`node:*`, `fs`, `path`, `child_process`, `os`, `react`)
- Las funciones públicas devuelven objetos propios: `safeZoneFor` y `buildTimeline` no comparten estado entre llamadas (regla 6 de `architect.md` §12)
- Tags Nx: `scope:engine`, `type:domain`. Boundaries Nx: `type:domain` → `onlyDependOnLibsWithTags: []` (no depende de ninguna otra lib del repo)
- Alias de import: **`@video-maker/timeline-core`** (scope `@video-maker/*`, no el `@shared-utils` heredado); declarado en `tsconfig.base.json → paths`, apuntando a `src/index.ts` (consumo por source, sin bundler)
