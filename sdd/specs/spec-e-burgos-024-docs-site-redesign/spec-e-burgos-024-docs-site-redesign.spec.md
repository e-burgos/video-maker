# SPEC-e-burgos-024: Rediseño de la web, código abierto, inventario de tecnología y guía interactiva

> Estado: **completed** — registrada y cerrada el 2026-10-25 con el cycle-01 (lite).
> Pedido del dev: el repositorio `e-burgos/video-maker` pasa a ser público. La web `apps/docs-site` deja de ser un
> sitio de docs sobrio pensado sólo para bajar el `.dmg` y se convierte en la cara pública del proyecto.

## Situación actual

- Ocho páginas HTML generadas por `scripts/build.mjs`, estilos sobrios con un verde de acento, sin identidad visual,
  sin animaciones y sin JS. El modo oscuro sigue al sistema y no se puede elegir.
- No hay ningún enlace al repositorio en GitHub, ni a cómo contribuir, ni a la licencia del código.
- `package.json` declara `"license": "MIT"` pero no existe `LICENSE` en la raíz; el `README.md` raíz es el
  boilerplate del generador del monorepo.
- La página Licencias lista los binarios de terceros, pero no hay un lugar que explique qué tecnología usa la
  herramienta, para qué, y con qué licencia (incluida la del código propio).
- "Usar el estudio" es un texto largo: los dos caminos (motion graphics y material crudo) y el pipeline no se ven.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Identidad visual propia: hero potente, tipografía y paleta propias, animaciones sutiles que respetan `prefers-reduced-motion`, tema claro/oscuro elegible y persistido por visitante, responsive desde 320 px, accesible (contraste AA, foco visible, landmarks) y rápido (sin frameworks ni fuentes externas, JS vanilla mínimo y diferido) | cycle-01 |
| O-2 | Código abierto visible: enlace al repo en header, hero y footer; sección "Código abierto" con cómo contribuir y licencia; `LICENSE` MIT (Esteban Burgos) en la raíz y `README.md` raíz apto para repo público | cycle-01 |
| O-3 | Página "Tecnología" con el inventario real verificado contra el código: qué es, para qué lo usa Video Maker y licencia, cruzado con `THIRD_PARTY_NOTICES.md`; aviso de las condiciones propias de Remotion para empresas | cycle-01 |
| O-4 | Guía interactiva "Cómo funciona": diagrama animado del pipeline (idea/guion → voz → escenas → música → render) y un recorrido paso a paso de los dos caminos con las capturas reales; sin backend, y con JS apagado se lee todo como una lista ordenada | cycle-01 |
| O-5 | Web bilingüe español/inglés: todas las páginas, la guía y los textos de UI en los dos idiomas; español en las rutas actuales e inglés bajo `/en/`; selector de idioma visible, `lang` y `hreflang` correctos, preferencia recordada sin romper el sitio sin JS; paridad es/en verificada por test y por `check-links` | cycle-01 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | Se mantiene el generador estático propio (`src/content/*.mjs` + `render.mjs`), sin frameworks de cliente ni CDNs | Constitución del subproyecto; peso y simplicidad |
| D-02 | El inventario de tecnología es un módulo de datos (`src/tech-inventory.mjs`) con un test que exige que cada componente con binario o modelo empaquetado figure en `THIRD_PARTY_NOTICES.md` | Que la página no se desactualice ni invente |
| D-03 | La interactividad es mejora progresiva: el HTML trae todo el contenido; `site.js` sólo agrega tabs, stepper, tema y animaciones | Funciona sin JS y sin backend |
| D-04 | La URL del repositorio vive en `site-config.mjs` (`REPO_URL`), igual que `SITE_URL` | Un solo lugar si cambia el owner o el nombre |
| D-06 | Dominio sin cambios (`https://video.estebanburgos.com.ar`, `SITE_URL`) para canonical, Open Graph, sitemap y enlaces absolutos; `wrangler.toml` y el workflow de deploy no se tocan | Decisión del dev (2026-10-25) |
| D-07 | Slugs traducidos en inglés (`/en/installation/`), declarados por página en `site-config.mjs`; una página es un `id` con un slug por idioma | URLs legibles en cada idioma y pares `hreflang` derivados de un solo registro |
| D-05 | Ciclo `lite` (perfil solo); no crea tablas, endpoints ni contratos que otro subproyecto consuma | Regla de flow |

## Dependencias

- `spec-e-burgos-017-desktop-app` (crea `apps/docs-site`).
