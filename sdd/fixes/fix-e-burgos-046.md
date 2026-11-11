# FIX-e-burgos-046 — Transiciones en los tutoriales con voz por guion

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-046 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Un tutorial con voz por guion y A-roll mudo (`voice: script`) no corta silencios. El montaje lo dejaba en un solo keep y el video salía sin ninguna transición, así que la rotación de FIX-039/040 no le llegaba. Además, el formulario manual de montaje de la web proponía siempre la semilla 0.

## Solución
- **auto-montage.** `splitKeepAtScriptLines` parte el keep único en el medio del hueco entre líneas del guion, sin perder material ni dejar tramos más cortos que `minKeepMs`. Con keeps por línea va una transición cada 2 líneas, en lugar del `every` del preset, que está pensado para keeps cortos por silencio. No se agregan punch-ins, igual que antes, para no hacer zoom sobre grabaciones de pantalla.
- **Handles.** Una transición entre keeps contiguos lleva `handles: true` (campo opcional nuevo del EDL). `buildTimeline` no retrocede el cursor: el clip entrante arranca antes y recorta antes. Así la timeline no se acorta y la voz, que es una pista continua, no se desincroniza. La pista de voz se salta esa entrada para no reproducir dos veces el mismo audio. Sin `handles` todo sigue como antes.
- **web.** La semilla del formulario arranca vacía ("automática") y se omite en el pedido, así render-api la deriva del video (FIX-041). Un número sigue sirviendo para repetir un montaje.

## Verificación
- `nx test`, `lint` y `build` en verde: timeline-core 455, auto-montage 380, composition-remotion 368, render-api 2266, web 1648.
- Render real con una copia del tutorial «crear grupo» (`media/prueba-motion-guion`):
  - 6 keeps por línea y 2 transiciones (iris y slide).
  - La timeline dura lo mismo que el A-roll, y los clips de voz quedan contiguos y en sincronía.
  - El escaneo de destellos solo marca los tramos largos de interfaz clara, los mismos del A-roll original: ningún destello nuevo.
