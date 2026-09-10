# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
`plan` y `run` aceptan `--script <ruta>` y `--no-logo`; `ingest` y `render` rechazan las cuatro
opciones de planificación con `unexpected-option`.

## Estructura
- `PlanOptions` gana `scriptPath: string | null` y `logo: LogoMode`. La ruta del guion se resuelve
  igual que `<project-root>` (contra la raíz del workspace, no contra el proyecto de medios), y si
  no se puede leer el error es `STAGE_INPUT_MISSING` con `reason: 'script-missing'` en la etapa
  `plan`.
- `CliArgument` gana `'script'` y `'logo'` en `stageForArgument`.
- `PlanReport` gana `logoAssetId` y `scriptAlignment`; `formatReport` agrega la línea
  `  logo: <assetId>|none` siempre, y `  script-corrections: N` con el desglose
  `replaced/removed/inserted/dropped` sólo cuando se pasó un guion.

## Dependencias
Ninguna nueva.

## Qué sigue
El conteo de assets del reporte de `ingest` sigue mostrando los cuatro roles originales; el logo
se ve en la línea propia del reporte de `plan`.
