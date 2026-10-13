# FIX-e-burgos-022 — La revisión automática suma los efectos de sonido al margen voz/música y controla la zona segura de los subtítulos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-022 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- El margen voz/música por tramo no contaba whooshes ni sfx, y nada controlaba que los subtítulos queden tapados por el isotipo, el chat o recuadros superpuestos.

## Solución
- El margen voz/música por tramo suma (suma de potencias) los efectos de sonido del `index.html` motion (`<audio id="sfx-*">`) que pisan la voz; si el efecto rompe el margen, el arreglo pide bajarlo a él. Regla nueva `caption-safe-zone`: rectángulo de subtítulos contra isotipo, zona del chat abajo a la derecha (tutoriales) y recuadros pip. La geometría de subtítulos y del recuadro pip pasó a `libs/timeline-core/src/captions/caption-geometry.ts`, usada por la composición y por la revisión.

## Verificación
- render-api, timeline-core y composition-remotion lint/test/build verde (render sin cambios en sus tests). Prueba real sobre copias: tutorial con isotipo agrandado → crítico caption-safe-zone; motion v2 con un whoosh dentro de una frase → crítico voice-music-margin que pide bajar el efecto; sin tocar, ambos sin hallazgos nuevos.
