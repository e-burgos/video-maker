# Constitución — apps/docs-site

> Versión 1.2 | Última actualización: consolidación del fragmento de spec-024 cycle-01 | Fecha: 2026-11-13

## 1. Propósito

- **Tipo:** sitio estático (Cloudflare Pages)
- **Rol en el sistema:** web pública bilingüe (es/en) de documentación y descarga de la app de escritorio:
  requisitos, instalación (incluida la apertura sin firma), primer arranque, cómo conectar Claude u OpenRouter,
  uso del estudio, cómo funciona, tecnología, código abierto (MIT), preguntas frecuentes y licencias.

## 2. Stack tecnológico

- HTML y CSS estáticos generados en el build, sin frameworks de cliente ni CDNs externos.

## 3. Estructura y patrones

- Web bilingüe: 11 páginas × es/en = 22. Español en las rutas de siempre (`/`, `/instalacion/`…), inglés bajo `/en/`
  con slugs traducidos. `src/site-config.mjs → PAGES` es el registro único `{ id, group: main|guide, slugs: { es, en } }`
  (con `SITE_URL`, `DOWNLOAD_URL` y `REPO_URL`); `routes.mjs` deriva path, profundidad, hrefs relativos, canonical y
  alternates (`es`, `en`, `x-default` → es). Agregar una página = entrada en `PAGES` + clave `nav.<id>` en los dos
  idiomas de `i18n.mjs` + renderer en `PAGE_RENDERERS` de `scripts/build.mjs`.
- Contenido: `src/content/*.mjs` con `renderPage(ctx)`, `ctx = { locale, pageId, path, depth }`; copy por idioma
  (`COPY.es/en` o `bodyEs/bodyEn`). `components.mjs` (pipeline, tabs + stepper, feature grid) y `content/journeys.mjs`
  (etapas y pasos). `src/render.mjs`, `src/styles.css`; `public/` con capturas reales de la app, Outfit
  auto-hospedada (`public/fonts/` + `OFL.txt`); `sitemap.xml` y `robots.txt` en la raíz del dist.
- Identidad: paleta rosa/violeta con tokens claro/oscuro, tema elegible y recordado, animaciones apagadas con
  `prefers-reduced-motion`, sin scroll horizontal a 390 px. Repo visible en header, hero y footer; `LICENSE` MIT y README raíz.
- Inventario de tecnología: `src/tech-inventory.mjs` + `tech-inventory.spec.mjs`, que cruza contra
  `THIRD_PARTY_NOTICES.md` (licencia y versión), `node_modules`, `package.json` raíz (versiones fijadas), menciones reales
  en cada `usedBy` (`codeMarker`) y los directorios de `apps/libs/tools`. Si cambia un binario, una licencia o un
  subproyecto, el test falla hasta actualizar el inventario.
- JS de cliente en `src/client/*.mjs` (lógica pura testeada + cableado DOM), publicado como `assets/js/*.js` con los
  imports reescritos. El script inline del `<head>` se genera con el código fuente de las mismas funciones testeadas
  (tema sin parpadeo; redirección por idioma sólo si el visitante eligió idioma con el selector). Mejora progresiva:
  sin JS se ven todos los pasos como listas; tabs, stepper, tema y menú móvil arrancan `hidden`.
- Verificación: `scripts/check-links.mjs` (enlaces, `lang`, pares `hreflang` recíprocos), `scripts/capture-screenshots.mjs`
  (`--pages --locales --themes --viewports --full-page --out`, informa overflow horizontal) y
  `scripts/smoke-interactions.mjs` (Playwright: sin JS, tabs, stepper, tema, idioma, menú móvil). Playwright es
  instalación global; no hay dependencias npm propias.
- `functions/descargas/[[path]].js` sirve el `.dmg` desde el binding R2 `DOWNLOADS` con soporte de Range;
  `wrangler.toml` (Pages + binding al bucket `video-maker-downloads`).
- Publicado en https://video.estebanburgos.com.ar (Cloudflare Pages, proyecto `video-maker`, subdominio
  `video-maker-bqo.pages.dev`). Deploy: `.github/workflows/deploy-docs-site.yml` en cada push a `main` que toque
  `apps/docs-site/**` (`pnpm dlx wrangler@4 pages deploy`).

## 4. Convenciones propias

- El botón de descarga apunta siempre al nombre estable del `.dmg` bajo `/descargas/`.
- "Conectar la IA" lleva precios reales (DeepSeek V4.1 Flash US$0.14/0.42, Receta Tutorial ≈ US$0.13) y el aviso de
  que no se recomiendan los modelos gratis; actualizar capturas y precios cuando cambien la interfaz o las tarifas.
- Pendiente: recapturar las capturas de la app en inglés para `/en/` (hoy se aclara que muestran la interfaz en español);
  al hacer público el repo, los enlaces a GitHub dejan de dar 404 en `check-links`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
