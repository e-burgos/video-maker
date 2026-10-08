# spec-e-burgos-021-brand-kit — cycle-01 · plan (lite)

> Módulo: brand-kit | Subproyectos: libs/motion-graphics, apps/render-api, apps/desktop | Fecha: 2026-10-08
> Objetivo: biblioteca de marcas con API, paleta derivada y carpeta escribible; DisplayAds sin cambios visibles.
> Fuera de alcance: UI (cycle-02), uso en material crudo (cycle-04).

## Historias
- US-021-101 — Como dev quiero crear, duplicar, editar y borrar marcas por API para no escribirlas a mano. CA: `POST/PUT/DELETE /brands` validan con el schema, y una marca incluida responde 409 al editarla o borrarla.
- US-021-102 — Como dev quiero definir una marca con 4 colores base. CA: `deriveBrandTokens(palette)` produce las 37 variables `--mg-*`; los `tokens` retocados ganan.
- US-021-103 — Como dev quiero que las marcas se guarden fuera del `.app`. CA: `BRANDS_ROOT` por defecto es `dirname(MEDIA_ROOT)/brands`; la app de escritorio lo fija junto a la carpeta de proyectos.
- US-021-104 — Como dev quiero que DisplayAds siga idéntica. CA: snapshot de `brand-reveal` y `cta` de display-ads-easy-pro igual antes y después; duplicarla da una marca que compone igual.

## Tasks (detalle en tasks.json)
- TASK-001 — Schema de marca: `palette` y `tokens` opcionales, `css` opcional (exige `palette` sin `css`); `deriveBrandTokens` y `brandCss(brand)` en libs/motion-graphics con tests de contraste y de overrides. `palette` de DisplayAds cargada.
- TASK-002 — Resolución en dos raíces: `requireBrandDir` y `listMotionBrandDocuments` buscan en `BRANDS_ROOT` y en las incluidas; la composición genera `brand.css` cuando falta. Tests de pipeline con una marca sin css.
- TASK-003 — Config `BRANDS_ROOT` en render-api (`store-config`) y en desktop (junto a la carpeta de proyectos), `.gitignore` de `brands/` en el repo.
- TASK-004 — API `GET /brands`, `GET /brands/:id`, `POST /brands` (vacía o `duplicateFrom`), `PUT /brands/:id`, `DELETE /brands/:id`, `PUT /brands/:id/files/:kind/:name` (logo, isotipo, fuente, foto, música) con validación de tipo y tamaño. Tests de handler con `Object.keys().sort()`.
- TASK-005 — Verificación: snapshots antes y después de DisplayAds, duplicado compuesto y comparado, `pnpm studio` contra la API real.

## Decisiones técnicas
- `brand.css` generado se escribe en el proyecto de trabajo al componer (`assets/brand/brand.css`), nunca en la marca → la marca guarda sólo `palette` + `tokens`.
- `GET /motion/brands` sigue igual y suma las marcas del usuario; las rutas `/brands` son nuevas y propias de la biblioteca (registro: api.json de render-api).
- Un borrado mueve la carpeta a `brands/.trash/` en vez de eliminarla.
