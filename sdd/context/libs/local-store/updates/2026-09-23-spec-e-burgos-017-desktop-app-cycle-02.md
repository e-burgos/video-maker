# spec-e-burgos-017-desktop-app cycle-02 — 2026-09-23

## Estado
Lib creada: base SQLite del estudio con la migración 1 (8 tablas) y cinco repositorios, 100% de
cobertura, verificada con la importación real de los 17 proyectos de `media/`.

## Estructura
`database/` (apertura y migraciones por `user_version`), `schema/` (Drizzle, con un test que asera que
coincide con la base migrada), `repositories/`. `producer_messages` tiene una columna `model` que el
plan no listaba. El único `(slug, seq)` es un índice con nombre para que el test de drift lo reconozca.

## Dependencias
`better-sqlite3` 13.0.3 (binario precompilado darwin-arm64, en `onlyBuiltDependencies`),
`drizzle-orm` 0.45.3, `@types/better-sqlite3`.

## Qué sigue
`cycle-03` recompila `better-sqlite3` para el Node de Electron (`@electron/rebuild`). `cycle-05` suma la
tabla de assets con su clasificación.
