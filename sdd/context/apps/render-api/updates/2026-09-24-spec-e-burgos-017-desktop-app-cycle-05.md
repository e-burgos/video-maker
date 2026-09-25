# spec-e-burgos-017-desktop-app cycle-05 — 2026-09-24

## Estado
Bandeja de entrada de assets: EP-042..045 (subir a `raw/inbox/`, listar pendientes, confirmar con rol, descartar).
La propuesta de rol es determinista a partir del probe y del nombre (`store/propose-asset-role.ts`, razones como
códigos estables que traduce la web). Confirmar mueve el archivo a `raw/<rol>/` y lo suma al catálogo con el
mismo camino que una subida normal (`store/ingest-asset-into-catalog.ts`, extraído del handler de assets).

## Estructura
`store/asset-inbox.ts`, `http/handlers/asset-inbox-handler.ts`; códigos `INBOX_ASSET_NOT_FOUND` (404) y
`UNSUPPORTED_MEDIA_TYPE` (415); el contexto del productor incluye los pendientes. `scripts/esbuild-node-bundle.mjs`
define `process.env.NODE_ENV="production"` (el bundle traía la rama de desarrollo de React).

## Dependencias
`local-store` migración 3 (`assets`).

## Qué sigue
`GET /projects/:slug/assets` falla con `CATALOG_UNREADABLE` si la carpeta del proyecto se renombra fuera de la API
(el slug dentro de `work/catalog.json` no coincide).
