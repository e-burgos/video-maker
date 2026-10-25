# spec-e-burgos-024-docs-site-redesign cycle-01 — 2026-10-25

## Estado

- Web pública bilingüe: 11 páginas × es/en = 22. Español en las rutas de siempre (`/`, `/instalacion/`…), inglés bajo
  `/en/` con slugs traducidos. Páginas nuevas: Cómo funciona (pipeline animado + recorrido por pasos de los dos
  caminos), Tecnología (inventario verificado por test) y Código abierto (repo, cómo correrlo, cómo contribuir, MIT).
- Identidad propia: Outfit auto-hospedada (`public/fonts/` + `OFL.txt`), paleta rosa/violeta con tokens claro/oscuro,
  tema elegible y recordado, animaciones apagadas con `prefers-reduced-motion`, sin scroll horizontal a 390 px.
- Repo visible en header, hero y footer (`REPO_URL` en `site-config.mjs`). `LICENSE` MIT y README raíz para repo público.
- Dominio, `wrangler.toml` y workflow de deploy sin cambios. `sitemap.xml` y `robots.txt` nuevos en la raíz del dist.

## Estructura

- `site-config.mjs → PAGES`: registro único `{ id, group: main|guide, slugs: { es, en } }`; `routes.mjs` deriva path,
  profundidad, hrefs relativos, canonical y alternates (`es`, `en`, `x-default` → es). Agregar una página = entrada en
  `PAGES` + clave `nav.<id>` en los dos idiomas de `i18n.mjs` + renderer en `PAGE_RENDERERS` de `scripts/build.mjs`.
- Módulos de contenido: `renderPage(ctx)` con `ctx = { locale, pageId, path, depth }`; copy por idioma (`COPY.es/en` o
  `bodyEs/bodyEn`). `components.mjs` (pipeline, tabs + stepper, feature grid), `content/journeys.mjs` (etapas y pasos).
- Inventario: `src/tech-inventory.mjs` (datos) + `tech-inventory.spec.mjs`, que cruza contra `THIRD_PARTY_NOTICES.md`
  (licencia y versión), `node_modules` (licencia npm), `package.json` raíz (versiones fijadas), menciones reales en cada
  `usedBy` (`codeMarker`) y los directorios de `apps/libs/tools`. Si cambia un binario, una licencia o un subproyecto,
  el test falla hasta actualizar el inventario.
- JS de cliente en `src/client/*.mjs` (lógica pura testeada + cableado DOM), publicado como `assets/js/*.js` con los
  imports reescritos. El script inline del `<head>` se genera con el código fuente de las mismas funciones testeadas
  (tema sin parpadeo y redirección por idioma sólo si el visitante eligió idioma con el selector).
- Mejora progresiva: sin JS se ven todos los pasos como listas; tabs, stepper, tema y menú móvil arrancan `hidden`.
- Verificación: `scripts/check-links.mjs` valida además `lang` y pares `hreflang` recíprocos; `scripts/capture-screenshots.mjs`
  (`--pages --locales --themes --viewports --full-page --out`) informa overflow horizontal por página;
  `scripts/smoke-interactions.mjs` prueba sin JS, tabs, stepper, tema, idioma y menú móvil con Playwright.

## Dependencias

- Sin dependencias npm nuevas. Playwright (instalación global) sólo para capturas y smoke.

## Qué sigue

- Recapturar las capturas de la app en inglés para las páginas `/en/` (hoy se aclara que muestran la interfaz en español).
- Al hacer público el repo, los enlaces a GitHub dejan de dar 404 en `check-links`.
