# spec-e-burgos-010-scene-assembly cycle-01 — 2026-09-10

## Estado
La lib tiene un segundo camino de producción de `Timeline`, hermano de `autoMontage`:
`assembleFromStoryboard` arma `work/timeline.json` desde el storyboard en vez de desde el A-roll.
Usa **los mismos escritores** (`writeTimeline` → `serializeMontageDocument`), que es lo que garantiza
que los dos productores emitan el mismo formato byte a byte.

## Estructura
- `assemble/assemble-from-storyboard.ts` — partido en tres pasos exportados para que el job pueda
  informar etapas honestas: `collectAssembleInputs` (lee storyboard, catálogo, manifest de voz,
  `words.json` y `scenes.json`), `buildAssembledTimeline` (delega en el productor puro de
  `timeline-core` y valida) y `persistAssembledTimeline`. `assembleFromStoryboard` los compone.
  Las pistas de voz se convierten en `MediaAsset` sintéticos desde el manifest, con `probedAt` =
  `updatedAt` del track para que la salida sea determinista.
- `assemble/map-numbered-scene-files.ts` — mapeo numerado puro: `01.mp4`, `02-cocina.png`,
  `scene-03.mov`, `scene_04`, `Scene05`. Sólo mira el nombre del archivo, rechaza el `0` y los
  números que arrancan dentro de una palabra, y reporta cada archivo descartado con su razón
  (`no-leading-number`, `no-scene-for-number`, `scene-already-taken`).
- `assemble/storyboard-format.ts` — `outputPresetFor` mapea el formato del storyboard al preset.
- `errors/assemble-input-error.ts` — `ASSEMBLE_INPUT_INVALID` con su `reason` tipada.
- `project/project-paths.ts` — `storyboardDocumentPath`, `voiceManifestPath`, `sceneAssignmentPath`.

## Dependencias
Ninguna nueva.

## Qué sigue
El camino de ensamblado **no escribe `edl.json`**: un `EditDecisionList` es una lista de decisiones
sobre un `sourceAssetId` único y el storyboard no tiene fuente única. Un EDL degenerado sería un
documento que miente.
