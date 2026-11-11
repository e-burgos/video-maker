# FIX-e-burgos-057 — Contrato de efectos de sonido en los bumpers

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-057 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El dev pidió efectos de sonido en los intros y cierres por piezas. Los bumpers no tenían dónde declarar efectos, y la mezcla de la sesión de música necesitaba un contrato para saber qué sonido va, cuándo y a qué volumen.

## Solución
- **Schema** (`timeline-core`), campos opcionales nuevos en cada bumper:
  - `sfxKind`: `whoosh`, `impact`, `shimmer`, `click` o `none` (silencio).
  - `sfx`: hasta 6 cues explícitos. Cada cue lleva `{ atMs, assetId, gainDb ≤ 0, fadeInMs?, fadeOutMs? }`, con `atMs` relativo al inicio del bumper.
- **Mapeo.** `resolveBumperLook` suma `sfxKind`. Cada revelado pide un efecto:
  - barrido y deslizar: whoosh;
  - rebote y zoom: golpe (`impact`);
  - desenfoque y fundido: brillo (`shimmer`);
  - el fondo resplandor también prefiere brillo.
- **Prioridades.**
  - La rotación nunca repite en el outro el efecto del intro.
  - El efecto elegido a mano gana, y `none` silencia el bumper.
  - Sin `style.rotate` y sin efecto elegido, los bumpers viejos siguen mudos.
- **Plan para la mezcla.** `planBumperSfx(timeline)` devuelve los cues en tiempo absoluto del video final (el outro va después del intro y del contenido):
  - `source: 'auto'`: trae `kind`, `atMs`, `gainDb` y `fadeOutMs`. La sesión de música elige el archivo del banco.
  - `source: 'cue'`: trae los explícitos con su `assetId`, que ganan sobre los automáticos.
  - El remate tipeado suma como mucho 3 clicks a −24 dB.

## Verificación
- `nx test`, `lint` y `build` en verde: timeline-core 469, composition-remotion 379, auto-montage 381, producer-tools 448, web 1651.
