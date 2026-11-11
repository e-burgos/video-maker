# FIX-e-burgos-038 — Banco de música por tipo de video, con rotación

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-038 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-10 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Todos los videos salían con los mismos dos temas de Display Ads. Los tutoriales grabados buscaban música en Wikimedia Commons, que devuelve resultados pobres. Además, cada proyecto de motion copiaba la carpeta `music/` entera de la marca, aunque usara un solo tema.

## Solución
- **Banco de Display Ads.** Suma 16 temas CC BY: Incompetech y Jamendo, a 96 kbps. Cada tema declara en `videoTypes` para qué videos sirve: `tutorial`, `product`, `vertical` o `institutional`. Créditos, licencias y orígenes en `music/CREDITS.md`.
- **Música local.** 19 temas de la Biblioteca de audio de YouTube no se pueden redistribuir. Viven fuera de git, en `brands/.local-music/<marca>/`: los MP3 más un `music.json`. `readBrand` y la lista de marcas de motion los suman como `local-music/<archivo>`.
- **Motion.** El pedido al modelo lista los tipos de cada tema. Pide uno que corresponda al formato o al tipo de video y evita los últimos tres que usó la marca. El uso se registra en `media/.music-usage.json`.
- **Tutoriales grabados.** `search_free_music` devuelve primero el banco de la marca del proyecto (`source: brand-bank`), ordenado por coincidencia y por el uso más viejo, y completa con Commons. `import_music` copia el tema del banco, registra el crédito y anota el uso.
- **Copia del proyecto.** El proyecto de motion copia la marca sin `music/` y después solo el tema elegido.

## Verificación
- `nx test` y `lint` en verde para motion-graphics (321), producer-tools (448), render-api (2265) y web (1647).
- El `music.json` local real y el `brand.json` real se leen bien, y los archivos de los 37 temas existen.
- Escucha previa del dev: los 35 temas mezclados bajo Daniela, a -15 dB de la voz, en una página de prueba. El dev eligió usarlos todos.
