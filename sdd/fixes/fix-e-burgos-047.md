# FIX-e-burgos-047 — Openverse como fuente de música libre

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-047 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Cuando el banco de la marca no alcanza, o la marca no tiene banco, `search_free_music` completaba solo con Wikimedia Commons, que para música de fondo devuelve discursos o nada. Por ejemplo, «calm tutorial music» da 0 resultados.

## Solución
- **Orden de fuentes:** banco de la marca, después **Openverse** y por último Commons. Si una fuente falla se pasa a la siguiente. Solo da `MUSIC_SOURCE_UNAVAILABLE` si fallan todas y el banco no aportó nada.
- **Filtros de Openverse** (`openverse-music-search.ts`):
  - `category=music`;
  - licencias CC BY, CC BY-SA, CC0 y Public Domain Mark, el mismo criterio que ya se aplicaba a Commons; quedan afuera ND y NC;
  - duración de 30 s a 10 min;
  - solo URLs de descarga de Jamendo (`prod-N.storage.jamendo.com`) o de `upload.wikimedia.org`.
- **Búsqueda:** si el mood completo no trae nada, prueba con palabras sueltas. Son hasta 3 pedidos, porque el acceso anónimo admite 20 por minuto y 200 por día.
- **Import:** `import_music` descarga desde Jamendo con un nombre de archivo legible (`<título>.mp3`) y deja el crédito con autor, licencia y la página del tema.
- **Contrato:** `source` acepta `'openverse'` en la salida de `search_free_music` y en el cliente, y la descripción de la tool menciona la nueva fuente. El prompt compartido del productor no se tocó.

## Verificación
- `nx test` y `lint` en verde: render-api (2273) y producer-tools (448). Hay specs nuevos para el parser, los filtros, el reintento por palabras y el orden banco → Openverse → Commons.
- **Búsqueda real:** desde el proyecto `cafe-aroma-crudo`, cuya marca no tiene banco, «calm tutorial» y «upbeat product» devuelven 6 temas de Jamendo cada uno.
- **Import real:** se importó «Lo-fi Love Song» (FABENZ, CC BY-SA 3.0) en `prueba-banco-musica`. Quedó un MP3 válido de 141 s y su crédito.

## Fuera de este fix
- **SFX de Openverse.** El montaje no tiene pista de efectos y motion arma los suyos con su propio banco. Conectar efectos externos pasa por los `sfxTags` de motion.
- **CC BY-SA.** Se acepta igual que en Commons, pero pide compartir la obra derivada con la misma licencia. Si el dev lo quiere más estricto, alcanza con sacar `by-sa` de la lista.
