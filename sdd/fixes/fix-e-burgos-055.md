# FIX-e-burgos-055 — La rotación de bumpers no vuelve al look viejo

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-055 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
En la prueba con el productor dentro del studio (`media/prueba-motion-guion`, proyecto sin marca), el intro rotado cayó en fondo liso con fundido. Es exactamente la placa vieja: sin pools de marca, la rotación elegía entre los cinco fondos y los seis revelados, incluidos `solid` y `fade`.

## Solución
- Sin pools de marca, `resolveBumperLook` rota solo entre fondos animados (`gradient`, `noise`, `shapes`, `glow`) y revelados con movimiento (`zoom`, `slide-up`, `wipe`, `blur-in`, `pop`).
- `solid` y `fade` siguen disponibles si se fijan a mano o si la marca los incluye en su bloque `bumpers`.

## Verificación
- `nx test`, `lint` y `build` en verde para timeline-core (462) y composition-remotion (379).
- Un test recorre 60 semillas y comprueba que ninguna da fondo liso ni fundido.
