# FIX-e-burgos-045 — Relleno de Commons más limpio y marcas duplicadas que heredan la música

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-045 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
- `search_free_music` completa con Wikimedia Commons cuando el banco de la marca no alcanza. Buscaba el mood tal cual, y para «corporate institutional» traía discursos presidenciales y una entrevista de 99 minutos.
- Duplicar una marca copiaba su carpeta `music/` entera (49 MB en Display Ads) y la lista de temas, en vez de usar el banco heredado de FIX-042.

## Solución
- **Duración.** Commons descarta audio de menos de 30 s o de más de 10 min.
- **Búsqueda.** A la consulta se le agrega «music», salvo que el mood ya lo traiga.
- **Duplicar marca.** La copia ya no incluye `music/`: queda con `music: []` y `musicFrom: <marca de origen>`. Si el origen también hereda, la copia recibe los temas propios del origen y los de su madre.

## Verificación
- `nx test` y `lint` de render-api en verde (2267). Al primer intento hubo un timeout suelto de `review-measurements`, que no se repitió.
- **Commons real, «corporate institutional».** Antes: 12 discursos y entrevistas. Con «music»: piezas musicales.
- **Commons real, «calm» y «upbeat».** Con «music» traen Kevin MacLeod y Rafael Krux, en lugar de grabaciones de pronunciación.
- **Duplicado.** Probado solo con el test: para no crear una marca en `brands/`, no dupliqué ninguna marca real.

## Límite
Commons sigue siendo pobre para música de fondo: «calm tutorial music» no devuelve nada. El reemplazo de fondo es Openverse.
