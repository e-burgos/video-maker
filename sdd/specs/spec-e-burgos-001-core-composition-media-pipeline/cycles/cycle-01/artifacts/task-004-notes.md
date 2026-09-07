# TASK-004 — notas de implementación

## Desvío: naming de archivos

El `files[]` original de TASK-004 en `tasks.json` listaba
`units/convert-time.ts`, `format/default-format.ts` y `format/safe-zone.ts`. El contrato del
Arquitecto (architect.md §2 "Estructura", §11 "Trazabilidad CA → archivo → función") y la propia
spec (tabla CA-001/CA-002) nombran `units/units.ts` + `units/units.spec.ts` y
`format/format.ts` + `format/format.spec.ts`. Se implementó siguiendo architect.md, que es la
fuente de verdad del contrato técnico; `tasks.json` quedó actualizado con los nombres reales.
