# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Estado
Migración 4: `projects.mode TEXT NOT NULL DEFAULT 'footage'`; `ProjectMode`/`PROJECT_MODES`;
`insert(slug, importedAt?, mode = 'footage')`.

## Estructura
`schema/project-mode.ts` (fuera de `studio-schema.ts`: el test de migraciones itera sus valores como tablas).

## Dependencias
Sin cambios.

## Qué sigue
Nada.
