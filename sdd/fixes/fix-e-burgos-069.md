# FIX-e-burgos-069 — Escaneo de destellos que no confunde fondos blancos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-069 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El escaneo de destellos blancos que se corre antes de entregar o publicar (regla del dev después de los 8 tutoriales con destello del 2026-11-05) era un comando de ffmpeg suelto: `negate,blackdetect=d=0`. Contaba como destello cualquier tramo casi blanco, también un bumper de fondo blanco o una interfaz clara que dura varios segundos. Eso daba falsos positivos y obligaba a revisar a ojo cada caso. El review de render-api no tiene esta regla: solo detecta negro y congelado.

## Solución
- `render-cli flash-scan <proyecto>` escanea el MP4 más nuevo de `out/` con el mismo filtro (`negate,blackdetect=d=0:pix_th=0.1:picture_black_ratio_th=0.9`). Separa los resultados en dos grupos:
  - **destellos**: tramos casi blancos de menos de 0,5 s. Son los que importan, y el reporte arranca con `FLASHES` si hay alguno;
  - **tramos claros**: los de 0,5 s o más (bumper blanco, interfaz clara). Se listan aparte con su rango, para revisarlos si hace falta, pero no cuentan como destello.

## Verificación
- `nx test`, `lint` y `build` en verde para render-cli (198).
- Sobre renders reales:
  - `prueba-motion-guion` (interfaz blanca): 0 destellos y 3 tramos claros de 9 a 22 s, que antes contaban como destellos.
  - `prueba-motion-a`: 0 y 0.
