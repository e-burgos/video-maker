# TASK-002 — notas de implementación

## Desvío de naming respecto a `tasks.json`

`tasks.json` listaba como archivo previsto
`libs/timeline-core/src/__fixtures__/transcription.fixture.ts` y no mencionaba un fixture de
assets. `architect.md` (sección 2 "Estructura" y sección 6 "Estrategia de fixtures") es
explícito y consistente en nombrar los fixtures **sin** el sufijo `.fixture`:
`src/__fixtures__/transcription.ts` y `src/__fixtures__/assets.ts`. Se siguió `architect.md`
(fuente de verdad de nombres) y se creó también `assets.ts`, necesario para ejercitar
`MediaAssetSchema` en `schemas.spec.ts`. `tasks.json` quedó actualizado con los nombres reales
en `files[]`.

## Archivos adicionales no listados originalmente en la task

- `src/schemas/primitives.ts` y `src/types/units.ts`: la task pide explícitamente "primitivas"
  en su título y son prerequisito de `output-format.schema.ts`; viven en `src/types/units.ts`
  (alias `Ms/Frame/Db/Lufs/Scale/AssetId/ClipId/DecisionId/Fps/Rounding`, D-05) y
  `src/schemas/primitives.ts` (`MsSchema/FrameSchema/DbSchema/LufsSchema/ScaleSchema/IdSchema/FpsSchema`,
  sección 3.1 de `architect.md`), tal como los define la estructura de la sección 2.
- `src/index.ts`: se actualizó el barrel con los schemas y tipos de esta task (no incluye aún
  EDL/AudioMixPlan/Timeline, que llegan en TASK-003).

## Pendiente para TASK-003 / TASK-011

- `src/schemas/registry.ts` y `src/__fixtures__/index.ts` (barrel interno de fixtures) no se
  crean todavía: dependen de `edl.ts` (TASK-003) y de `json-schema.ts` (TASK-011).
- El test de superficie de `index.ts` contra la tabla completa de la sección 4 de
  `architect.md` se agrega en TASK-011, cuando existan todos los schemas.
