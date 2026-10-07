# spec-e-burgos-020-motion-mode cycle-03 — 2026-10-07

## Estado
Storyboard automático: `MotionBrief` (zod, `parseMotionBrief` con el campo), `buildAutoStoryboardRequest`
(prompt del sistema desde `SCENE_GUIDE` + marca + brief + guion, schema del storyboard),
`enforceBrief` (marca, formato, golpes, título y música del brief ganan; la voz de la respuesta se
descarta), `checkStoryboardAgainstBrief` (imágenes, equipos, cues, tema) y `generateMotionStoryboard`
(una reparación con los errores, suma de consumo, `brand-reveal` anclado al drop si el tema lo tiene).
`fitBeatGrid` lee el tempo de un tren regular de onsets por intervalo mediano (antes se anulaba). 117 tests.

## Estructura
`src/auto/{motion-brief,scene-guide,build-auto-storyboard-request,check-storyboard-against-brief,
generate-motion-storyboard}.ts`; `assets/briefs/displayads/plataforma-60s.json` + `images/`.

## Dependencias
Sin cambios (sólo `zod`). El puerto `AskStoryboardAgent` es estructural: render-api lo adapta desde su
`AiAgentPort` (`tokensIn/tokensOut` ↔ `inputTokens/outputTokens`) en cycle-04.

## Qué sigue
- `accent` se describe en el schema como texto que va DESPUÉS del título (en `suggestion`, parte del
  texto a resaltar): sin eso la IA lo repetía.
- La IA no ve las imágenes de marca (`brand:escena-04`…): si conviene que las use con criterio, sumar un
  `caption` por imagen al `BrandManifest`.
