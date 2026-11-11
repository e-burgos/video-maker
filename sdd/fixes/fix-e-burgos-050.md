# FIX-e-burgos-050 — Bumpers por piezas (etapa 2 de motion graphics)

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-050 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Etapa 2 de `docs/research/2026-11-10-motion-graphics-productor.md`. La presentación de marca del modo A era siempre una placa lisa con el logo y uno de tres zooms. Las recetas además fijaban `slide-up` en el intro y `zoom` en el outro, así que todos los videos abrían y cerraban igual.

## Solución
- **Piezas** (campos opcionales nuevos del bumper en `timeline-core`):
  - `background`: `solid`, `gradient`, `noise` (manchas que se mueven con `@remotion/noise`), `shapes` (estrellas, polígonos y círculos que entran escalonados con `@remotion/shapes`) o `glow`.
  - `reveal`: `fade`, `zoom`, `slide-up`, `wipe`, `blur-in` o `pop`.
  - `accentColor`.
  - `caption`: un remate que se tipea debajo del logo.
- **Rotación por video.** `bumpers.style` lleva `rotate`, `seed`, los pools y los colores. `resolveBumperLook` elige por semilla: lo explícito gana, y el outro nunca repite el fondo ni el revelado del intro. Sin `style.rotate` todo queda como antes (fondo liso y la `animation` de siempre).
- **auto-montage.** Cada montaje nuevo deja `bumpers.style = { rotate: true, seed }`, más el `bumperStyle` de la marca si llega. Los bumpers ya editados de un re-montaje no se tocan.
- **Marca.** El `brand.json` admite un bloque `bumpers` (`backgrounds`, `reveals`, `outroCaption`). Display Ads rota cuatro fondos animados y cinco revelados.
- **Productor.** `patch_timeline` conserva `bumpers.style` cuando el patch solo trae intro y outro.
- **Web.** El editor de bumpers suma revelado, fondo animado (con "automático" cuando la timeline rota) y el texto debajo del logo.
- **Dependencias.** Se suman `@remotion/noise` y `@remotion/shapes` 4.0.522, también en los externals de render-api y en las deps del instalador desktop.
  - `@remotion/paths` no entra: los logos son PNG.
  - `motion-blur` no hace falta: el revelado con desenfoque sale con CSS.
  - Sin SFX en los bumpers.

## Verificación
- `nx test`, `lint` y `build` en verde: timeline-core 461, auto-montage 381, composition-remotion 379, motion-graphics 331, producer-tools 449, render-api 2267, web 1651.
- Renders reales en `media/prueba-motion-guion` con las semillas 101, 202 y 316. Los cinco fondos y los seis revelados salen bien; el outro lleva la web tipeada y nunca repite el look del intro. El escaneo de destellos de los bumpers da 0.

## Pendiente
- Pasar la paleta y la url de la marca desde render-api al montaje: es territorio de la sesión de música y espera su OK.
- Actualizar las recetas del prompt del productor, que todavía nombran `slide-up` y `zoom` (archivo compartido).
