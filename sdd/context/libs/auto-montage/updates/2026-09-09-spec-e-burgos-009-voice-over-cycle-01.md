# spec-e-burgos-009-voice-over cycle-01 — 2026-09-09

## Estado

Quinto rol de asset: `voice`, para la locución que el usuario graba con su micrófono. Se descubre
en `raw/voice/`, espera `MediaKind` `audio` (un video ahí se ignora con
`extension-role-mismatch`) y entra al catálogo como cualquier otro rol.

## Estructura

- `src/ingest/classify-entry.ts`: `AssetRole` pasa de cuatro a cinco miembros;
  `ROLE_BY_DIRECTORY_NAME` mapea `voice → voice` (a diferencia de `images → image`, el directorio y
  el rol se llaman igual) y `EXPECTED_KIND_BY_ROLE` lo ata a `audio`.
- `src/catalog/catalog.schema.ts`: `AssetRoleSchema` gana `'voice'`.

## Dependencias

Ninguna.

## Qué sigue

- `DEFAULT_TRANSCRIBE_ROLES` sigue siendo `['aroll']`: la ingesta **no** transcribe `raw/voice/`.
  La locución la transcribe el job `voice` de `apps/render-api` cuando se la asocia a una escena,
  porque recién ahí se sabe a qué escena pertenece. Sumar `voice` a los roles transcritos por
  default duplicaría el trabajo.
- Ensanchar `AssetRole` es un cambio global: los dos `Record<AssetRole, …>` del repo
  (`countAssetsByRole` y `EXPECTED_KIND_BY_ROLE`) los marcó el compilador, pero un `Record` nuevo en
  otro subproyecto también lo va a exigir.
