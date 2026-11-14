# apps/render-api — spec-e-burgos-025-liquid-glass-rebrand cycle-06 (2026-11-13)

## Estado
Nuevo `GET /api/app/update` (EP-074): lee el manifiesto `latest.json` publicado en R2 y lo compara con la versión instalada (`resolveAppVersion`); responde `up-to-date`, `available` o `unknown` con 200, nunca 500.

## Estructura
- `http/handlers/app-update-handler.ts` (fetch con timeout de 4 s, `no-store`) y `app-update/compare-versions.ts`.
- Env nueva `VIDEO_MAKER_UPDATE_MANIFEST_URL` (default `https://video.estebanburgos.com.ar/descargas/latest.json`).

## Dependencias
Sin cambios.

## Qué sigue
Probarlo de punta a punta cuando el próximo release publique `latest.json`.
