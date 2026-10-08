# spec-e-burgos-021-brand-kit cycle-04 — 2026-10-08

## Estado
Proyectos de material crudo con marca: `applyProjectBrand` (en `POST /projects` y `PUT /projects/:slug/brand`) deja el
logo en `raw/logo/brand-<id>.png` catalogado (SVG rasterizado con el Chrome headless de Remotion vía el puerto
`rasterizeSvg`; `BRAND_LOGO_RASTERIZE_FAILED` 503) y las fuentes en `work/brand/fonts/`; al cambiar de marca reemplaza el
logo en el timeline. El detalle del proyecto trae `captionTheme`. El montaje recibe la marca; `captionStyle: 'brand'`
sin marca → 422. El job de voz sin `voiceId` usa la voz y la velocidad de la marca si está instalada.

## Estructura
Nuevos `src/brands/apply-project-brand.ts`, `project-brand-context.ts`, `project-brand-resolver.ts`, `rasterize-svg.ts`,
`src/deps/svg-rasterizer.ts`.

## Dependencias
Sin cambios.

## Qué sigue
Sin pendientes.
