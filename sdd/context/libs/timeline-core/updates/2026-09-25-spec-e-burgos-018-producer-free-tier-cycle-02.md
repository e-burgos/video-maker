# spec-e-burgos-018-producer-free-tier cycle-02 — 2026-09-25

## Estado
El JSON Schema del storyboard que ve el modelo dice la verdad sobre los campos condicionales; el contrato
guardado (`StoryboardProposalSchema`/`StoryboardDocument`) no cambió.

## Estructura
- `StoryboardProposalForModelSchema`: `assetId` y `remotionScene` requeridos y nullable; `remotionScene` es una
  unión discriminada por `kind` con ramas estrictas. `storyboardProposalJsonSchema()` sale de este schema.
- `normalizeStoryboardProposalInput()` quita las claves en `null` antes del `safeParse` real.
- Patrón para cualquier contrato con salida estructurada: una regla de `superRefine` no llega al JSON Schema; en
  el schema para el modelo, lo condicional va requerido + nullable y se normaliza antes de validar.

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
