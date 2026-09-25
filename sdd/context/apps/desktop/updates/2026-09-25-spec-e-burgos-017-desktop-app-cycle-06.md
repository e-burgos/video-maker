# spec-e-burgos-017-desktop-app cycle-06 — 2026-09-25

## Estado
Versión 0.1.0 publicada: `Video-Maker-0.1.0-arm64.dmg` y el nombre estable `Video-Maker-arm64.dmg` en el bucket R2
`video-maker-downloads`, servidos por https://video.estebanburgos.com.ar/descargas/.

## Estructura
`scripts/release-desktop.mjs` (`pnpm desktop:release`): build, copia estable, sha256, notas desde `CHANGELOG.md`;
con `--publish` sube a R2 con `wrangler` (sesión o `CLOUDFLARE_API_TOKEN` con permiso de R2) y verifica por HEAD.
La app incluye `Resources/licenses/` (licencias de Electron y Chromium) además de `THIRD_PARTY_NOTICES.md`.

## Dependencias
Sin cambios.

## Qué sigue
Sin firma no hay auto-actualización: cada versión nueva se publica con el mismo comando y se reinstala a mano.
