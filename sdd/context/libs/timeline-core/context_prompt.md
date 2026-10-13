# Context Prompt — libs/timeline-core

> Entry point para agentes que trabajen sobre `libs/timeline-core`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

- **Tipo:** lib de dominio TypeScript (sin I/O, sin React)
- **Contratos recientes** (bumpers, `captionTheme`, geometría de subtítulos, revisión, propuesta, referencia, dirección de
  voz, música por tramos): `constitution.md` §5.
- **Estado:** completa para su alcance acumulado. Los contratos Zod del motor (`OutputFormat`,
  `MediaAsset`, `Transcription`, `EditDecisionList`, `AudioMixPlan`, `Timeline`) con sus
  invariantes, más los contratos del modo generativo (`StoryboardDocument` + propuesta y JSON Schema
  derivado, `VoiceManifest`, `VoiceScriptManifest`), y todas las funciones puras del motor
  (`msToFrames`/`framesToMs`, `defaultFormat`/`safeZoneFor`, `detectSilencesFromWords`/
  `mergeSilences`/`pruneSilences`, `planPunchIns`, `remapMsAfterCuts`, `groupWordsForCaptions`/
  `pickEmphasisIndex`, `captionGroupingForStyle`, `planDucking`, `musicNormalizationGainDb`,
  `hashNarration` y los helpers de manifest de voz, `parseVoiceScriptLines`/
  `planVoiceScriptPlacements`, `buildTimeline`, `validateTimeline`, `normalizeTranscriptionWords`
  y los helpers de JSON Schema).
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (secciones "Contratos de datos" y "Cálculos del motor"); las extensiones posteriores vienen de `spec-008` (storyboard), `spec-009` (voz), `spec-014` (calidad de producción) y los fixes 003-003 / 007-002 / 009-002.
- **Cómo correr y testear:** `pnpm nx test timeline-core`, `pnpm nx lint timeline-core`, `pnpm nx build timeline-core`, `pnpm nx run timeline-core:schemas` (regenera los JSON Schema commiteados)
- **Consumidores:** `libs/media-local` (aplica `normalizeTranscriptionWords` en sus parsers antes de validar contra `TranscriptionSchema`), `libs/composition-remotion` (cablea `scene.transform.anchor` a `punchInStyle` y lee `timeline.captionStyle`/`timeline.logo`), `libs/auto-montage`, `apps/render-api`, `apps/render-cli`, `apps/web`

## Pendientes conocidos

- Los fixtures de `src/__fixtures__/` no se exportan desde `src/index.ts`; falta decidir si
  `libs/composition-remotion` los consume públicamente o arma los suyos propios.
- `buildTimeline` fija el clip de música con `durationFrames` = duración de la Timeline: si el
  asset de música es más corto, `validateTimeline` lo reporta como `CLIP_EXCEEDS_ASSET`. No hay
  estrategia de loop/fade definida — la define el ciclo que la necesite.
- `MediaAsset.audio.integratedLufs` es opcional: quien no lo mida no normaliza.
- `durationMs` del `VoiceManifest` es la fuente de verdad de la duración de cada escena y **no**
  reemplaza a `estimatedDurationMs` del `StoryboardDocument`: quien arme la Timeline lee el manifest.
- `StoryboardDocument` y `VoiceManifest` no están en `timelineSchemaRegistry` ni en el bundle de
  JSON Schema; sumarlos obliga a regenerar los `.schema.json` versionados.
- `captionsStyle` y `musicTags`/`sfxTags` del storyboard son strings libres.
- `planVoiceScriptPlacements` acelera **por línea**, no reparte el sobrante entre frases seguidas, y
  no valida marcas no monótonas (`[0:30]` después de `[0:40]` desplaza, no falla).
- `minWords` de `groupWordsForCaptions` no reparte: el rango "6–10" es un objetivo, no una garantía.
