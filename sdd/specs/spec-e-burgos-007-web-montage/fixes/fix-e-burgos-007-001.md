# FIX-e-burgos-007-001 — Ni la CLI ni el job `montage` eligen el formato de salida: todo sale 9:16

| Campo         | Valor                                                     |
| ------------- | --------------------------------------------------------- |
| **ID**        | FIX-e-burgos-007-001                                      |
| **Tipo**      | IMPROVEMENT                                               |
| **Severidad** | medium                                                    |
| **Keyword**   | [IMPROVEMENT]                                             |
| **Fecha**     | 2026-09-11                                                |
| **Autor**     | e-burgos                                                  |
| **Estado**    | implemented                                               |
| **Spec**      | spec-e-burgos-007-web-montage                             |
| **Origen**    | Caso real `media/display-ads`: una grabación de pantalla 16:9 se planificó vertical. |

## Problema

`resolveMontageInputs` acepta `options.outputPreset` desde `spec-e-burgos-002`, pero **nadie se lo
pasa**: `tools/render-cli` y el job `montage` llaman a `autoMontage` sin él, así que todo proyecto cae
en `outputPreset ?? 'reels-9x16'`. `youtube-16x9` existe en `libs/timeline-core` y era inalcanzable
desde los dos únicos caminos de entrada.

## Solución

- `render-cli`: `--format <reels-9x16|tiktok-9x16|shorts-9x16|youtube-16x9>` en `plan` y `run`
  (`CLI_ARGUMENT` con `reason: unknown-format` para cualquier otro valor; `ingest` y `render` lo
  rechazan como a las otras cuatro opciones). El reporte de `plan` abre con
  `format: <preset> <ancho>x<alto>@<fps>`.
- API: `format` en el body del job `montage`, mismos cuatro valores, `422 MONTAGE_FORMAT_INVALID`
  para el resto. Los dos caminos lo pasan a `autoMontage` como `outputPreset` y termina en
  `timeline.format`.
- `libs/timeline-core` exporta `OUTPUT_PRESETS` para que CLI y API validen contra la misma lista.

## Decisión: el default queda en `reels-9x16`, no se deriva del A-roll

Se evaluó el **default inteligente** (A-roll apaisado → `youtube-16x9`, vertical → `reels-9x16`) y se
descartó, con dos alternativas sobre la mesa:

1. *Default inteligente siempre*: cambia el formato de los renders de referencia
   (`media/smoke-ingest`, A-roll 1280×720 apaisado, hoy vertical) y rompe el oráculo de no-regresión
   de `spec-e-burgos-002`/`014` sin que ningún cambio de contrato lo anuncie.
2. *Default inteligente sólo si el proyecto no tiene `timeline.json` previo*: evita (1) pero vuelve
   el comando **no idempotente** — el mismo `plan` sobre el mismo material da 16:9 la primera vez y
   9:16 la segunda, porque él mismo escribe el `timeline.json` que apaga la regla. Un default que
   depende del estado del disco es peor que uno fijo.

**Recomendación adoptada:** default fijo `reels-9x16` en los dos caminos y decisión explícita de quien
invoca. El productor de la app —que ya mide el A-roll con `ffprobe` en su primer paso— manda `format`
según la orientación del material (`FIX-e-burgos-015-002` lo instruye en la skill y en el system
prompt). Así la salida no cambia nunca sola, el oráculo de no-regresión sigue válido y el usuario
igual obtiene 16:9 en una grabación de pantalla sin pedirlo a mano.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre specs cerradas. No crea endpoints, módulos ni entidades: un flag
opcional en la CLI, un campo opcional en el body de EP-012 y un argumento que la librería ya aceptaba.
Perfil `solo`, sin ciclo abierto.

## Archivos

`output-format.schema` e `index` en `libs/timeline-core`; `preset-names`, `parse-cli-args`,
`stage-for-argument`, `plan-command`, `cli-report`, `to-reports`, `format-report` y el README en
`tools/render-cli`; `montage-job-params`, `jobs-handler`, `render-job`, `render-job-queue`,
`run-montage-pipeline`, los tres archivos de errores y el README en `apps/render-api`; más
`sdd/api.json`. Lista completa en `affected_files` de `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
