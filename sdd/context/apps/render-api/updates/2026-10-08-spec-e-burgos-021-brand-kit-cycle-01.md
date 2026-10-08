# spec-e-burgos-021-brand-kit cycle-01 — 2026-10-08

## Estado
Biblioteca de marcas: `GET/POST /brands`, `GET/PUT/DELETE /brands/:id`, `PUT /brands/:id/files/:kind/:name`,
`GET /brands/:id/files/*`. Marcas del usuario en `BRANDS_ROOT` (default `dirname(MEDIA_ROOT)/brands`), incluidas de
sólo lectura (`409 BRAND_READ_ONLY`), duplicar fija todas las variables de la original, borrar mueve a
`.trash/`. `GET /motion/brands` lista ambas raíces con `source`. Errores nuevos `BRAND_UNKNOWN` (404),
`BRAND_EXISTS` (409), `BRAND_READ_ONLY` (409), `BRAND_MANIFEST_INVALID` (422), `BRAND_FILE_INVALID` (422).

## Estructura
Nuevo `src/brands/` (`brand-library.ts`, `brand-palette.ts`, `wordmark-svg.ts`) y `http/handlers/brands-handler.ts`.
El confinamiento de `ObjectStorage` admite `brandsRoot` y `<motionAssetsRoot>/brands` además de `mediaRoot`.

## Dependencias
Sin cambios.

## Qué sigue
cycle-02: `/brands/:id/preview` y `/brands/:id/fonts`.
