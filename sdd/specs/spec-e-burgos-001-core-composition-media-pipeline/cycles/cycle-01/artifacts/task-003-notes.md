# TASK-003 — notas de implementación

## Desvío de naming respecto a `tasks.json`

`tasks.json` listaba `libs/timeline-core/src/__fixtures__/edl.fixture.ts`. `architect.md`
(sección 2 "Estructura" y sección 6.3 "Estrategia de fixtures") nombra el archivo
`src/__fixtures__/edl.ts`, consistente con `assets.ts` y `transcription.ts` de TASK-002 (ver
`task-002-notes.md`). Se siguió `architect.md` y se actualizó `files[]` con el nombre real.

## Archivo adicional no listado originalmente en la task

- `src/index.ts`: se actualizó el barrel con los schemas y tipos de `EditDecisionList`,
  `AudioMixPlan` y `Timeline` de esta task (regla de superficie de la sección 2 de
  `architect.md`).

## Pendiente para tasks futuras

- `src/schemas/registry.ts`, `src/schemas/json-schema.ts` y `tools/generate-schemas.ts` siguen
  sin crear: dependen de que existan todos los schemas (ya completos desde esta task) pero su
  implementación es explícitamente TASK-011.
- `AudioMixPlanSchema.voice`/`.music` usan `z.object` (no `z.strictObject`) porque la spec no
  declara `additionalProperties: false` en esos sub-objetos — mismo criterio que `MediaAssetAudio`
  de TASK-002.
