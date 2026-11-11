# FIX-e-burgos-042 — Las submarcas usan el banco de música de la marca madre

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-042 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Webs para negocios, Clientes y Tu negocio online son copias de Display Ads, con sus 2 temas viejos. Los tutoriales de opticagestion están en esas submarcas, así que no usaban el banco de FIX-e-burgos-038.

## Solución
- **Campo `musicFrom`.** El manifiesto acepta el campo opcional `musicFrom` con el id de otra marca. La marca suma después de sus temas los de la madre: los del repo y los locales. No duplica archivos. Si un id choca, gana el tema propio.
- **Rutas.** Un tema heredado se anota como `brand-music/<marca>/<archivo>`. Motion (`brandTrackPath`), `search_free_music`, `import_music` y la lista de marcas lo resuelven dentro de la marca dueña, aunque haya varios niveles de herencia.
- **Ciclos.** Si una marca termina heredando de sí misma, se rechaza con `BRAND_INVALID`.
- **Datos locales.** Los `brand.json` de las 3 submarcas de Display Ads viven en `brands/`, fuera de git, y quedaron con `"musicFrom": "displayads"`.
- **Rotación.** Se lleva por marca: cada submarca recuerda sus propios usos.

## Verificación
- `nx test` y `lint` en verde para motion-graphics (326), render-api (2266) y producer-tools (448).
- **Lista de marcas.** Con la API real, las 3 submarcas muestran 37 temas cada una, 19 de ellos locales.
- **Búsqueda.** Desde `opticagestion-clientes` devuelve temas tranquilos para tutorial, con su duración real.
- **Video motion.** Un video vertical de `displayads-webs-para-negocios` eligió «The Corporate Upbeat», un tema de la madre, y copió solo ese archivo. La voz quedó 17,3 dB sobre la música y el máster en −14,2 LUFS.
