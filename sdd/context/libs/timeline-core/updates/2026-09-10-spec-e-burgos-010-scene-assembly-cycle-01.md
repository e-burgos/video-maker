# spec-e-burgos-010-scene-assembly cycle-01 — 2026-09-10

## Estado
La `Timeline` modela un segundo modo de trabajo. Además del A-roll, ahora representa un video
armado por escenas generativas: pista `scenes` opcional dentro de `tracks`, con visual discriminado
`asset` | `remotion` | `placeholder`. El modo A-roll no cambió — una `Timeline` sin escenas serializa
igual byte a byte, porque Zod no emite una clave opcional ausente.

Segundo productor de `Timeline`: `buildTimelineFromStoryboard`, puro, hermano de `buildTimeline`.
La duración de cada escena sale del `durationMs` real de su pista de voz más un padding
(`DEFAULT_SCENE_PADDING_MS`, 250 ms); sin voz cae en `estimatedDurationMs`. Las captions se arman
desde los `words.json` con el `groupWordsForCaptions` que ya existía, desplazadas al inicio de su
escena. Documento nuevo `SceneAssignment` (`work/scenes.json`): `sceneId → assetId`.

## Estructura
- `schemas/timeline.schema.ts` — `SceneClipSchema`, `SceneVisualSchema` (unión discriminada por
  `kind`), `SceneKenBurnsSchema`; `tracks.scenes` opcional. El visual `remotion` reutiliza
  `RemotionSceneDocumentSchema`, el `RemotionSceneSchema` del storyboard **con** su refinamiento
  cruzado aplicado (el schema pelado no valida que `code` traiga `codeLanguage`).
- `schemas/scene-assignment.schema.ts` — documento nuevo + `emptySceneAssignment`, `findSceneAssignment`.
- `timeline/validate-timeline.ts` — el concepto pasó a ser **pista visual primaria**:
  `scenes` si está y no está vacía, si no `aroll` (`primaryVisualTrackOf`). Contigüidad, solape y
  coincidencia con `durationFrames` se validan sobre la primaria. Códigos nuevos: `SCENES_AND_AROLL`,
  `SCENE_GAP`, `SCENE_OVERLAP`, `SCENE_ASSET_NOT_FOUND`. `EMPTY_AROLL` conserva su significado:
  no hay ninguna pista visual primaria.
- `timeline/build-timeline-from-storyboard.ts` — el productor y `StoryboardTimelineError`.
- `__fixtures__/scene-assembly.ts` — storyboard, manifest de voz, catálogo y asignación de ejemplo.

## Dependencias
Ninguna nueva. `timeline.schema.ts` ahora importa de `storyboard.schema.ts` (misma lib).

## Qué sigue
- La duración del clip de voz usa `msToFrames(..., 'floor')` a propósito: redondear hacia arriba
  hace que el clip reclame más frames de los que el wav tiene y dispara `CLIP_EXCEEDS_ASSET` con
  cualquier duración que no caiga en frame exacto. Hay test de regresión que lo demuestra.
- `TimelineIssueCode` es un tipo suma consumido por `apps/web`: ensancharlo obliga a actualizar
  `issue-severity.ts` en el mismo cambio.
