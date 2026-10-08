# Verificacion backend cycle-02 (TASK-001, TASK-002)

## Vista previa (TASK-001)
- `brand-preview.real.spec.ts` compone DisplayAds y una marca recien creada con el storage de Node y los puertos reales de motion-graphics en un `BRANDS_ROOT` temporal: `index.html` existe en `<brandsRoot>/.preview/<id>/`, trae el logo (`assets/brand/img/logo.svg`), `data-scene="reveal"` y `data-scene="cta"`, el runtime GSAP y `assets/brand/brand.css`, sin `<audio>`.
- Timeline sintetico: 2 escenas de 4.5 s (`reveal`, `cta`), `voDuration` 0, `words.json` `{}`, sin musica. Duracion total 9 s.
- El script de vista previa se agrega solo al `index.html` del preview: reproduce `window.__timelines.motion` en bucle (`repeat(-1)`, pausa de 0.8 s) y aplica por `postMessage` `{ type: 'mg-brand-tokens', tokens }` cada `--mg-*` sobre `document.documentElement.style`.

## Google Fonts (TASK-002)
Humo real con red, una sola corrida por familia (`smoke-google-font.ts <brandsRoot> <familia>`, mismo directorio), sobre una marca `smoke-fonts` creada en un `BRANDS_ROOT` temporal:

| Familia | Peticiones al CSS | Archivos | Cabecera |
| --- | --- | --- | --- |
| Poppins (no variable) | `wght@100..900` rechazada (400), `wght@400;700` aceptada | `poppins-latin-400/700.woff2` (7.9 KB, 7.8 KB), `poppins-latin-ext-400/700.woff2` (5.6 KB, 5.4 KB) | `wOF2` en los 4 |
| Inter (variable) | `wght@100..900` | `inter-latin.woff2` (48 KB), `inter-latin-ext.woff2` (85 KB), `weight` `100 900` | `wOF2` en ambos |
| "Nope Nope Fonts" | las 3 peticiones rechazadas | ninguno | `BRAND_FONT_UNKNOWN` |

Cada entrada de `fonts[]` guarda `weight` y `unicodeRange` del bloque `@font-face` de Google; `fontFaces` los emite, asi `latin` y `latin-ext` de una misma familia se complementan en vez de pisarse.
