# Verificacion cycle-01 · DisplayAds sin cambios visibles

Scripts: `verify-brand-kit.sh` (re-compone con el CLI motion-studio y compara) y `duplicate-brand.ts` (duplica una marca con el codigo de `brand-library` sobre el storage real). Mismo directorio.

## Oraculo
Los proyectos de trabajo base (`brand-baseline/ia-promo`, `easy-pro`) ya traian un `storyboard.json` editado despues de su `index.html.tpl` (otra foto en la galeria de ia-promo, otros volumenes de musica en `script.json`). Comparar contra su snapshot crudo mide esa deriva y no el codigo: ia-promo a 47 s dio PSNR 13.25 dB con el codigo nuevo. Por eso el oraculo es una re-composicion con el codigo de HEAD (checkout `git archive HEAD` en `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/old-code`) sobre las mismas entradas, y se compara el codigo nuevo contra esa referencia. La corrida con deriva demuestra ademas que la comparacion detecta diferencias.

## Corridas (storyboard + compose, voz reusada, sin sintesis ni render completo)
| Corrida | Codigo | Marca | Salida |
| --- | --- | --- | --- |
| Referencia | HEAD | displayads | `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/brand-reference/{ia-promo,easy-pro}` + `*-snap` |
| Despues | rama actual | displayads | `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/brand-after/...` |
| Duplicado | rama actual | displayads-copy (BRANDS_ROOT temporal `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/brands-tmp`, creada con `createBrand({name:'DisplayAds', id:'displayads-copy', duplicateFrom:'displayads'})`) | `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/brand-duplicate/...` |

## Resultados (referencia vs despues, y referencia vs duplicado)
- `index.html.tpl`, `index.html` y `script.json` de ia-promo y easy-pro: byte-identicos a la referencia, tanto con displayads como con la copia.
- Snapshots (ia-promo a 3, 16.5, 24, 32, 47, 57 s; easy-pro a 3, 9, 30, 57 s): PSNR `inf` en las 10 capturas, en ambas comparaciones.
- Duplicado con otro nombre ("DisplayAds Copy"): el unico cambio del tpl es el nombre en `alt` del logo y en el bug; PSNR 38.3-38.9 dB, diferencia confinada a la palabra "Copy" en la esquina (diff visual revisado en `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/diff-easy-3s.png`).
- La copia no tiene `css`: `assets/brand/brand.css` se genera al componer (paleta derivada + las 35 variables efectivas de DisplayAds como `tokens`, que ganan).

## Marca desde cero
`createBrand({name:'Árbol Verde'})` sobre el storage real: crea `brand.json` (palette DisplayAds, typography Outfit/Geist/Geist Mono, 3 fuentes copiadas, voz es_AR-daniela-high 1.08, sin musica/fotos/devices) y `img/logo.svg` con la fuente embebida (43 KB). Render del logo en Chrome headless: `/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/wm.png` (Outfit blanca sobre transparente). `motion-studio storyboard` con esa marca y `music: null` compone y escribe `assets/brand/brand.css` derivado (`/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-video-maker/939035ff-18a5-4233-85a4-92cca64dd250/scratchpad/starter-proj`).

## Notas
- Las variables de DisplayAds son 35 (no 37 como decia el plan); el test compara el conjunto de nombres contra `brand.css`.
- `--mg-border`/`--mg-border-strong` se derivan del color de texto (DisplayAds usa blanco puro): la copia por duplicado no lo nota porque conserva todas las variables como tokens.
