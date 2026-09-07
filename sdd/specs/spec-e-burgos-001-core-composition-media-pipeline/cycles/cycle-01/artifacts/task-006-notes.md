# TASK-006 — Notas de implementación

## Naming de archivos y mulberry32 sin archivo propio

Mismo patrón que TASK-005: `architect.md` sección 2 ubica los archivos en
`src/punch-in/random.ts` + `src/punch-in/plan.ts` y `src/silence/remap.ts`, pero `tasks.json`
(fuente de esta task) pide `src/punch-in/plan-punch-ins.ts` y
`src/timeline/remap-ms-after-cuts.ts`. Se usaron los nombres de `tasks.json`. `mulberry32` no
se separó en un archivo propio: es un detalle privado de `planPunchIns` (no forma parte de la
API pública de la sección 4.3) y `tasks.json` no lista `random.ts` entre los archivos de la
task, así que quedó como función interna de `plan-punch-ins.ts`.

## `remapMsAfterCuts` reutiliza `KeepRange` de `pruneSilences`

La firma de la sección 4.2 usa el mismo `KeepRange` que ya exporta
`src/silence/prune-silences.ts` (creado en TASK-005); no se redefine el tipo.
