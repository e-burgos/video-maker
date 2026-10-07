# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
22 tools: `get_motion_brands`, `read_motion_brief`, `write_motion_brief`, `read_motion_storyboard`;
`start_job` acepta `kind: motion`; `get_project_overview` trae `mode`; receta motion en el prompt
cuando el proyecto es motion (brief → storyboard → resumen y OK → video).

## Estructura
Sin archivos nuevos: `contract/tool-schemas.ts`, `tool-names.ts`, `client/*`, `handlers/studio-tool-handlers.ts`,
`prompt/build-producer-prompt.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin tool para escribir el storyboard (existe `PUT`): sumarla si el productor necesita editar escenas.
