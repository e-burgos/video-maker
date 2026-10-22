# FIX-e-burgos-035 — Motion: los cables de la escena de conexiones no llegan a la tele, al equipo ni a la fuente

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-035 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-22 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el Short vertical de Easy Pro el cable HDMI iba de la parte de abajo del equipo a la de arriba de la tele, que está encima: cruzaba por detrás y dejaba una punta suelta sobre la tele. El cable de la fuente quedaba corto o superpuesto.
- En 16:9 el cable de la fuente era una punta que no llegaba al equipo, por el margen transparente de la imagen.

## Solución
- En vertical, cada cable sale del lado que mira al otro elemento (arriba o abajo según la posición real).
- Los cables terminan dentro del equipo o de la etiqueta (`.dev`, `.mg-box`), que tapan la punta, en lugar de en el borde de la imagen con margen transparente.
- Las medidas se corrigen por la escala del render y los cables se recalculan en cada cuadro (`onUpdate`), con la posición real de cada elemento.

## Verificación
- motion-graphics lint/test en verde.
- Short vertical de Easy Pro y una prueba 16:9 renderizados y revisados en las escenas de HDMI y fuente.
