# FIX-e-burgos-059 — Banco de efectos de sonido CC0/CC BY

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-059 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El dev pidió efectos de sonido, empezando por los intros y cierres. Los únicos efectos del repo son 8 de Pixabay (`runtime/sfx/`, modo B). Su licencia no permite distribuirlos sueltos en un repo público ni en el instalador, y además estaban acreditados por error como Apache 2.0.

## Solución
- **Banco:** `libs/motion-graphics/assets/sfx-bank/` tiene 18 efectos, 3 por tipo: `whoosh`, `impact`, `shimmer`, `riser`, `typing` y `click`. Salen de Freesound vía Openverse y solo son **CC0** o **CC BY**.
- **Curación:** sobre 146 candidatos se midió la envolvente de cada uno (posición del pico, ataque, subida, transitorios por segundo, piso de ruido y silencio inicial), sin títulos fuera de tono como combate, terror o explosiones. Se eligieron los 3 de mayor puntaje por tipo.
- **Normalización:**
  - se recorta el silencio inicial; en el tipeo se toman los 2,5 s con más teclas;
  - fundido de salida;
  - nivel de −18 LUFS de loudness momentáneo máximo, con el pico verdadero ≤ −2 dBTP;
  - MP3 a 192k y 48 kHz.
- **`sfx-bank.json`:** un manifiesto con id, tipo, archivo, título, autor, licencia, fuente, duración y niveles medidos. `CREDITS.md` tiene la tabla de créditos.
- **Código** (`libs/motion-graphics/src/sfx/sfx-bank.ts`):
  - `parseSfxBank` rechaza todo lo que no sea CC0, CC BY o Public Domain Mark, y los ids repetidos;
  - `pickSfxVariant` elige la variante de cada tipo con una semilla por video y evita las usadas recién.
- **Créditos:** `work/credits.json` acepta `kind: sfx`, y al publicar se rotula «Efecto de sonido».
- **Corrección de licencia:** `music/CREDITS.md` ya no llama Apache 2.0 a los SFX de Pixabay del modo B.

## Verificación
- `nx test` y `lint` en verde: motion-graphics (336) y render-api (2278).
- El test del banco real comprueba que estén los archivos, las licencias permitidas, los picos ≤ −2 dBTP y al menos 2 variantes por tipo.
- Página de escucha para que el dev confirme a oído: https://claude.ai/artifact/AA4WU45ioxFvQmwDQXV5Yq

## Pendiente
- Mezclar los cues de los bumpers en los dos másters (contrato de motion en `timeline-core`).
- La regla de review contra la ametralladora.
- Pasar el modo B a este banco y sacar los 8 de Pixabay; eso toca código de motion.
