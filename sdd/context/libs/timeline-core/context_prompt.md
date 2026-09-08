# Context Prompt — libs/timeline-core

> Entry point para agentes que trabajen sobre `libs/timeline-core`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-001 cycle-01 + spec-e-burgos-002 cycle-02 | Fecha: 2026-09-08

- **Tipo:** lib de dominio TypeScript (sin I/O, sin React)
- **Estado:** completa para su alcance de `cycle-01` de `spec-e-burgos-001-core-composition-media-pipeline`
  (cerrado el 2026-09-07) y de `cycle-02` de `spec-e-burgos-002` (cerrado el 2026-09-07): los 6
  contratos Zod (`OutputFormat`, `MediaAsset`, `Transcription`, `EditDecisionList`, `AudioMixPlan`,
  `Timeline`) con sus invariantes, y todas las funciones puras del motor (`msToFrames`/`framesToMs`,
  `defaultFormat`/`safeZoneFor`, `detectSilencesFromWords`/`mergeSilences`/`pruneSilences`,
  `planPunchIns`, `remapMsAfterCuts`, `groupWordsForCaptions`/`pickEmphasisIndex`, `planDucking`,
  `buildTimeline`, `validateTimeline`, `normalizeTranscriptionWords` y los helpers de JSON Schema).
  CA-001..CA-016 en verde; 209 tests, cobertura 97.29 % statements.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (secciones "Contratos de datos" y "Cálculos del motor")
- **Cómo correr y testear:** `pnpm nx test timeline-core`, `pnpm nx lint timeline-core`, `pnpm nx build timeline-core`, `pnpm nx run timeline-core:schemas` (regenera los JSON Schema commiteados)
- **Consumidores previstos:** `libs/media-local` (aplica `normalizeTranscriptionWords` en sus parsers antes de validar contra `TranscriptionSchema` — pendiente en `cycle-02` de esa lib), `libs/composition-remotion` (`cycle-03`: necesita la Timeline de CA-013/CA-023 y cablear `scene.transform.anchor` a `punchInStyle` en `aroll-series.tsx`, dejando su propio fragmento en `sdd/context/libs/composition-remotion/updates/`), `libs/auto-montage`, `apps/render-api`, `apps/web`

## Pendientes conocidos

- Los fixtures de `src/__fixtures__/` no se exportan desde `src/index.ts`; falta decidir si
  `libs/composition-remotion` los consume públicamente o arma los suyos propios.
- `buildTimeline` fija el clip de música con `durationFrames` = duración de la Timeline: si el
  asset de música es más corto, `validateTimeline` lo reporta como `CLIP_EXCEEDS_ASSET`. No hay
  estrategia de loop/fade definida — la define el ciclo que la necesite.
