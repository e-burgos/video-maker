# TASK-005 — Notas de implementación

## Naming de archivos en `src/silence/`

`architect.md` sección 2 (árbol de estructura) nombra los archivos `detect.ts`, `merge.ts`,
`prune.ts`, pero tanto `tasks.json` como `planner.md` (sección "Archivos a crear/modificar")
usan `detect-silences.ts`, `merge-silences.ts`, `prune-silences.ts`. Se implementó con estos
últimos nombres por ser los que coinciden en dos documentos y en el `tasks.json` fuente de la
task. No es un cambio de contrato de funciones/firmas, solo de nombre de archivo.

## `src/timeline/ids.ts` creado en esta task

`sequentialId(prefix, index)` (D-13) es requerido por `pruneSilences` para generar los ids
`keep-0001`/`cut-0001`. La sección 2 de `architect.md` ubica este archivo en `src/timeline/ids.ts`
como implementación única compartida con `planPunchIns` (TASK-006), pero ninguna task previa lo
había creado. Se creó acá, sin lógica condicional (una sola función pura, sin ramas), cubierto
transitivamente por los tests de `prune.spec.ts`. TASK-006 debe reusarlo, no reimplementarlo.

## `CutReason` agregado a `src/index.ts`

El tipo `CutReason` ya existía en `schemas/edit-decision-list.schema.ts` pero no se reexportaba
desde el barrel. Se agregó porque `CutRange.reason` (API pública 4.2) lo necesita. Sin cambio de
definición, solo se sumó su reexport de tipo.
