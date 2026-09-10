# spec-e-burgos-008-ai-storyboard cycle-01 — 2026-09-09

## Estado

La lib de contratos gana el documento que gobierna el modo generativo del estudio:
`StoryboardDocument` (Zod), su versión de **propuesta** (lo que devuelve el modelo, sin ids ni
índices) y el JSON Schema **derivado** del mismo esquema. 233 tests, cobertura 97,62 % stmts ·
91,92 % branch (piso 85 %).

## Estructura

- `src/schemas/storyboard.schema.ts`: `StoryboardDocumentSchema` (título, idioma, formato,
  hoja de personajes, `captionsStyle`, `musicTags` y escenas ordenadas con `narration`,
  `visualPrompt`, `visualSource` `upload | asset | remotion-scene`, `assetId`, `remotionScene`,
  `estimatedDurationMs`, `captionsStyle` por escena, `musicTags`, `sfxTags`),
  `StoryboardProposalSchema`, `storyboardProposalJsonSchema()` y `toStoryboardDocument()`.
- **`remotionScene` es un objeto plano con `kind` y props opcionales**, validado por refinamiento
  cruzado (props requeridas y props prohibidas por `kind`), no una unión discriminada: las uniones
  son lo que peor sobrevive a la salida estructurada de un agente, y la validación estricta se
  conserva del lado de Zod.
- **El modelo nunca asigna `id`, `index` ni `createdAt`**: los pone `toStoryboardDocument()`, y el
  `index` se deriva de la posición en el array (un refinamiento del documento lo exige).
- El JSON Schema **se deriva** del objeto sin refinar (un refinamiento cruzado no es representable)
  y **descarta `$schema` y `$id`** — ver abajo. No se registró en `timelineSchemaRegistry`: ese
  registry alimenta los `.schema.json` versionados de `libs/timeline-core/schemas/`, y sumarlo
  obligaría a regenerarlos. Hacerlo es decisión de un ciclo futuro.

## Dependencias

Ninguna nueva en runtime. Los tests usan `ajv`/`ajv/dist/2020`, ya presente como devDependency raíz,
para validar las propuestas de ejemplo contra el JSON Schema derivado.

## Qué sigue

- **Un JSON Schema con la clave `$schema` desactiva en silencio la salida estructurada** de
  `claude -p` (medido en 2.1.123: `is_error: false`, `subtype: "success"`, sin `structured_output`).
  Todo schema que se le pase a un agente CLI sale sin `$schema` ni `$id`; hay un test que lo sostiene.
- `captionsStyle` y `musicTags`/`sfxTags` son strings libres hasta `spec-012` y `spec-011`.
- `spec-010` agrega `buildTimelineFromStoryboard` acá: es el segundo productor de `Timeline`,
  hermano de `autoMontage`, con la duración de cada escena tomada de su pista de voz.
