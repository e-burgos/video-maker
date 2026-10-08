# FIX-e-burgos-005 — Ajustar videos de motion graphics con el productor

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-005 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-07 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-020-motion-mode |

## Problema
Desde la app no se podía pedir ajustes de un video de motion graphics: no había acceso al chat, el workspace mostraba
material crudo y el productor no podía editar escenas. La música sonaba muy alta y la pantalla del Counter 15 no
mostraba el contenido con su inclinación.

## Solución
- Botón "Ajustar con el productor" y workspace motion con ejemplos de pedidos.
- Tool `write_motion_storyboard` y receta de ajuste (editar lo mínimo, mostrar, OK, fase video); nunca regenera el storyboard para un ajuste.
- Voz parcial: `voice-manifest.json`, sólo se re-sintetizan las escenas cuyo texto cambió.
- `storyboard.music.volume` (default 0,5).
- Pantallas de equipos con homografía (`matrix3d`) desde las cuatro esquinas del vidrio.
