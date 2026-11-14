# apps/desktop — spec-e-burgos-025-liquid-glass-rebrand cycle-06 (2026-11-13)

## Estado
`scripts/release-desktop.mjs` genera `dist/desktop/latest.json` (`version`, `url` del dmg estable, `sha256`, `publishedAt`) y lo sube a `descargas/latest.json` con content-type JSON después de los dmg. Lo consume «Buscar actualizaciones» vía `GET /api/app/update` del render-api. Sin `autoUpdater` (D-08).

## Estructura
- `buildUpdateManifest` y `contentType` en `buildWranglerR2PutArgs`, con tests.

## Dependencias
Sin cambios.

## Qué sigue
El primer release con este script deja disponible la comprobación de actualizaciones.
