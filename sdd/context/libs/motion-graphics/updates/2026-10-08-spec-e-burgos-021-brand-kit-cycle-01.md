# spec-e-burgos-021-brand-kit cycle-01 — 2026-10-08

## Estado
`BrandManifest` suma `palette` (fondo, acento, acento 2, texto), `tokens` (variables `--mg-*` retocadas) y `typography`;
`css` e `isotipo` son opcionales (sin `css` hace falta `palette`) y `music` puede estar vacío. `deriveBrandTokens`
deriva las 35 variables de DisplayAds; `brandCss` = css del archivo o derivado + `tokens` al final. La composición
escribe `assets/brand/brand.css` generado cuando la marca no tiene css o tiene tokens. Marcas en dos raíces: la del
usuario primero (`ports.userBrandsRoot`) y las incluidas.

## Estructura
Nuevos `src/brand/color.ts`, `derive-brand-tokens.ts`, `brand-css.ts`. DisplayAds gana `palette` y `typography` y
conserva su `brand.css`.

## Dependencias
Sin cambios.

## Qué sigue
cycle-02: vista previa de marca reutilizando `composeStoryboard` con timeline sintético.
