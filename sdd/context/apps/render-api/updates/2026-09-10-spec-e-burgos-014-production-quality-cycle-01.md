# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
El job `montage` acepta el guion y el modo de logo, y su reporte los devuelve.

## Estructura
- `POST /projects/:slug/jobs` (EP-012, `updated`) acepta `scriptPath` **XOR** `scriptText` y
  `logo: 'auto' | 'off'`. Tres códigos nuevos: `MONTAGE_SCRIPT_INVALID` (422),
  `MONTAGE_LOGO_INVALID` (422) y `MONTAGE_SCRIPT_NOT_FOUND` (404, **al asentar el job**, no en el
  request: el archivo se lee en la etapa `plan`).
- `MontageJobReport` gana `logoAssetId: string | null` y `scriptAlignment` (los cinco contadores o
  `null`).
- Ripple del rol `logo` de `auto-montage`: `AssetListEntry.role` y `ToCatalogAssetInput.role` pasan
  al tipo del catálogo, y `countAssetsByRole` filtra con `isAssetRole` para que `assetCounts`
  **siga teniendo exactamente las cinco claves** que `apps/web` ya consume. `ASSET_ROLES` (roles
  subibles por HTTP) no cambió.

## Dependencias
Ninguna nueva.

## Qué sigue
Subir un logo por `POST /projects/:slug/assets` sigue sin soportarse: ensanchar `ASSET_ROLES`
ensancha `assetCounts` en el payload y `apps/web` estaba fuera de alcance. Entra con la pantalla
del chat.
