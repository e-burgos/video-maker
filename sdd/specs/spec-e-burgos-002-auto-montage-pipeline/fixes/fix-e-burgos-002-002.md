# FIX-e-burgos-002-002 — `render-cli`: token de etapa genérico `[uso]` y superficie de salida bilingüe

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | FIX-e-burgos-002-002                     |
| **Tipo**      | IMPROVEMENT                              |
| **Severidad** | low                                      |
| **Keyword**   | [IMPROVEMENT]                            |
| **Fecha**     | 2026-09-08                               |
| **Autor**     | e-burgos                                 |
| **Estado**    | implemented                              |
| **Spec**      | spec-e-burgos-002-auto-montage-pipeline  |
| **Origen**    | D-5 de `spec-e-burgos-005-render-service` y § "Pendientes" de la constitución de `tools/render-cli` |

## Problema

Dos pendientes declarados al cerrar `spec-002 cycle-03`, con la decisión explícitamente diferida a
`spec-005` "donde pasan a ser payload de API":

1. **N-2 — token de etapa genérico.** `formatCliError` deriva el header como
   `error [${error.stage === null ? 'uso' : error.stage}] …`. Los errores de uso sobre un comando ya
   conocido (`--preset`/`--seed` inválidos en `ingest|plan|render`, falta de `<project-root>`,
   positional extra) llegan con `stage === null` y se reportan como `[uso]` en vez de la etapa del
   comando. `stageForArgument` existe, está testeado y **ningún llamador de producción lo usa**: la
   columna `'project-root'` de `STAGE_FOR_ARGUMENT` está cableada al vacío. Es código muerto con
   nombre de función viva.
2. **Superficie de salida bilingüe.** `formatCliError` emite etiquetas en castellano (`recurso:`,
   `esperado:`, `causa:`, `sugerencia:`, `[uso]`, `[interno]`) sobre tokens de datos en inglés
   (`ingest|plan|render`, `unknown-preset`). Contradice D-4 de `spec-005` ("todo payload de máquina
   es inglés") y la regla del repo (código, identificadores y payloads en inglés).

## Solución

1. Cablear `stageForArgument(command, argument)` en la construcción de los errores de argumento de
   `parse-cli-args.ts`, de modo que un error de uso **sobre un comando ya reconocido** lleve la
   etapa de ese comando. El token genérico queda **sólo** para el caso en que ni siquiera se
   reconoció el comando (ahí no hay etapa que informar y `stage: null` es la verdad).
2. Traducir a inglés las seis etiquetas de `formatCliError`: `[usage]`, `[internal]`, `resource:`,
   `expected:`, `cause:`, `hint:`.

**No cambia ningún exit code:** `CLI_USAGE` y `CLI_ARGUMENT` siguen mapeando a `2` (`exitCodeFor`
no se toca). Los tokens de datos ya eran ingleses, así que ningún consumidor de máquina se rompe.

## Justificación del bypass del SPEC GATE

Cambio cosmético y de trazabilidad sobre una spec ya `completed`, sin contratos ni entidades
nuevas, sin dependencias y sin cambio de exit codes. La decisión de fondo (qué idioma habla la
superficie de máquina) ya está tomada y escrita: es D-4 de `spec-005`. Un ciclo SDD completo para
aplicar una decisión ya tomada sobre dos archivos es desproporcionado. `spec-005 cycle-03` es el
ciclo en que la API y la CLI comparten por primera vez la traducción de errores de las libs, que es
la condición que D-5 puso para hacerlo.

## Alcance descopado (con recomendación escrita)

El tercer follow-up heredado — **"el exit code exacto sólo se observa invocando el binario, nunca
`nx run`"** — **no se resuelve con código y queda descopado**: no es un defecto de `render-cli`
sino el comportamiento de Nx, que normaliza todo fallo de `nx:run-commands` a `1`. Ya está
capturado donde sirve: como evidencia medida en la spec de `spec-005`, como lección destilada en
`sdd/memory/lessons.md` y como procedimiento copiable en el README de `apps/render-api`.
**Recomendación:** dejarlo así; convertirlo en código (por ejemplo, un target que propague el exit
code) agregaría una capa de indirección propia para compensar una limitación de la herramienta, y
el procedimiento documentado ya evita el error.

## Archivos afectados

- `tools/render-cli/src/errors/format-cli-error.ts`
- `tools/render-cli/src/errors/format-cli-error.spec.ts`
- `tools/render-cli/src/args/parse-cli-args.ts`
- `tools/render-cli/src/args/parse-cli-args.spec.ts`
- `tools/render-cli/src/cli.spec.ts`

## Verificación

`pnpm nx run-many -t lint test build -p render-cli` en verde. Tests: (a) un error de `--preset`
inválido en `render` reporta la etapa `render` y no el token genérico; (b) un comando desconocido
sigue reportando el token genérico; (c) las seis etiquetas del formateo son inglesas y ningún test
de la suite espera castellano.
