# FIX-e-burgos-053 — La música libre no acepta CC BY-SA

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-053 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
`search_free_music` aceptaba temas CC BY-SA de Openverse y de Commons. Esa licencia trata la sincronización de música con imagen como obra derivada, así que un video que usara uno de esos temas tendría que publicarse entero bajo CC BY-SA, para siempre:

- cualquiera podría bajarlo, remixarlo o reutilizarlo comercialmente con solo dar crédito;
- YouTube no ofrece esa licencia: solo «Licencia estándar» o «CC BY».

## Solución
- `isPublishableMusicLicense` (`music-license.ts`) acepta CC BY, CC0 y dominio público, y descarta todo share-alike.
- Openverse pide `license=by,cc0,pdm` y filtra con esa regla. La música de Commons también.
- La búsqueda de B-roll de Commons (imágenes y video) no cambia.
- La descripción de la tool `search_free_music` dice que nunca devuelve share-alike.

## Decisión
El dev eligió esta opción el 2026-11-11, después de ver la pérdida medida en Openverse:
- se pierde un 50 % de calm, un 60 % de ambient y un 40 % de inspiring;
- upbeat y piano siguen con más de 240 temas;
- el banco de la marca va primero.

## Verificación
- `nx test` y `lint` en verde para producer-tools (448) y render-api (2277). `review-measurements` dio el timeout suelto conocido y pasa corrido solo.
- **Búsqueda real:** desde `cafe-aroma-crudo`, «calm tutorial» devuelve 8 temas CC BY 3.0 y ninguno BY-SA.

## Lo que ya había
- El banco de Display Ads no tenía temas BY-SA.
- El único BY-SA importado fue «Lo-fi Love Song», en el proyecto de prueba `prueba-banco-musica`, que no se publica.
