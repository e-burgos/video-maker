# spec-e-burgos-024-docs-site-redesign — cycle-01 · plan (lite)

> Módulo: docs-site-redesign | Subproyectos: apps/docs-site (+ `LICENSE` y `README.md` de la raíz) | Fecha: 2026-10-25
> Objetivo: la web pública del proyecto, bilingüe es/en, con identidad propia, el repo a la vista, la tecnología
> verificada y una guía interactiva de cómo se usa.
> Fuera de alcance: dominio, `wrangler.toml` y workflow de deploy (sin cambios); capturas nuevas de la app (se
> reusan las de `public/screenshots/`, que están en español); traducir el `THIRD_PARTY_NOTICES.md` (ya está en inglés).

## Historias

- US-024-101 — Como visitante quiero una web que se vea como un producto. CA: hero con titular, CTA de descarga y de
  GitHub y una maqueta animada con una captura real; paleta y tipografía propias (Outfit auto-hospedada); tema
  claro/oscuro elegible que se recuerda y sigue al sistema por defecto; animaciones que se apagan con
  `prefers-reduced-motion`; sin scroll horizontal a 360 px; foco visible y skip-link; sin CDNs ni frameworks.
- US-024-102 — Como dev que llega desde la web quiero el código. CA: enlace al repo en header, hero y footer; página
  "Código abierto" con cómo correrlo, cómo contribuir (SDD, `pnpm sdd:validate`, issues/PR) y licencia; `LICENSE`
  MIT a nombre de Esteban Burgos en la raíz; README raíz que describe el proyecto y enlaza la web.
- US-024-103 — Como visitante quiero saber qué usa la herramienta. CA: página "Tecnología" agrupada por función, con
  qué es, para qué lo usa Video Maker y licencia de cada componente; los subproyectos del monorepo; aviso de la
  licencia de Remotion para empresas. Un test falla si un componente empaquetado no figura en
  `THIRD_PARTY_NOTICES.md`, si la licencia declarada de un paquete npm no coincide con `node_modules`, o si la lista de
  subproyectos no coincide con `apps/`, `libs/` y `tools/`.
- US-024-104 — Como usuario nuevo quiero ver cómo se usa. CA: página "Cómo funciona" con el pipeline animado
  (idea/guion → voz → escenas → música → render) y un recorrido por pasos de los dos caminos (motion graphics y
  material crudo) con las capturas reales; tabs y stepper con teclado y ARIA; sin JS se ven los dos caminos como
  listas ordenadas completas.
- US-024-105 — Como visitante de habla inglesa quiero la web en inglés. CA: las 11 páginas en es (rutas actuales) y
  en (`/en/…`); selector de idioma en header y footer que lleva a la misma página en el otro idioma; `<html lang>`,
  `hreflang` (es, en, x-default), canonical y Open Graph absolutos sobre `SITE_URL`; `sitemap.xml` con alternates;
  la preferencia se recuerda (sin JS, los enlaces funcionan igual). Test de paridad: mismas claves de UI y mismas
  páginas en los dos idiomas; `check-links` valida los pares `hreflang` del sitio construido.

## Tasks (detalle en tasks.json)

- TASK-001 — i18n del generador y layout nuevo.
- TASK-002 — sistema visual y JS de mejora progresiva.
- TASK-003 — home, Cómo funciona y Código abierto.
- TASK-004 — inventario y página Tecnología.
- TASK-005 — inglés de las páginas existentes + paridad.
- TASK-006 — `LICENSE` y README.
- TASK-007 — verificación con capturas y cierre.

## Decisiones técnicas

- Un registro único de páginas en `site-config.mjs`: `{ id, group, slugs: { es, en } }`; profundidad, rutas,
  canonical y alternates salen de ahí. Cada módulo de contenido exporta `renderPage({ locale, depth, … })` y devuelve
  título/descr./cuerpo para ese idioma.
- `src/client/site-logic.js` (funciones puras, testeadas) + `src/client/site.js` (cableado DOM, `type="module"`,
  diferido). Preferencias en `localStorage` envuelto en try/catch; tema aplicado por un script inline mínimo en
  `<head>` para evitar el parpadeo.
- Redirección por idioma sólo cuando el visitante eligió idioma con el selector (nunca por `navigator.language`, para
  no desviar crawlers ni a quien entra por un enlace compartido sin haber elegido).
- No toca `schema.json`, `api.json` ni `components.json`.
