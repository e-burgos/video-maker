# spec-e-burgos-018-producer-free-tier — cycle-03 · plan (lite)

> Módulo: producer-free-tier | Subproyectos: apps/render-api, libs/producer-tools | Fecha: 2026-09-25
> Flow: **lite** — perfil `solo`, sin aprobaciones intermedias a pedido del dev.
> Objetivo: material libre para B-roll e imágenes, y que el productor pueda mirar una foto (O-3 de la spec).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C3-01 | Mismo patrón que `search_free_music`/`import_music`: búsqueda con caché y `resultId` estable, import por `resultId`, crédito en `work/credits.json` (entrada `kind: "video"`/`"image"` junto a las de música) | Ya probado; la web y el productor ya conocen `credits.json` |
| D-C3-02 | Wikimedia Commons: `filetype:video` / `filetype:bitmap`, licencia con `isFreeCommercialLicense` (CC0, PD, CC BY, CC BY-SA); video solo mp4/webm (un ogv se toma por su derivado webm transcodificado si existe, si no se descarta); imágenes jpg/png/webp | La ingesta acepta webm pero no ogv |
| D-C3-03 | NASA Image and Video Library (`images-api.nasa.gov`, sin key): solo ítems sin `photographer`/`secondary_creator` o con crédito de NASA; video `~medium.mp4`, imagen `~large.jpg` (o `~orig` si no hay); licencia registrada "NASA (dominio público, pautas de uso de medios de NASA)" | NASA mezcla material de terceros con copyright (ej. "Rocket Lab") |
| D-C3-04 | Import a `raw/broll/` (video) o `raw/images/` (imagen), hosts permitidos `upload.wikimedia.org` e `images-assets.nasa.gov`, tope 200 MB video / 30 MB imagen, escritura temporal + promote como la música | Mismas garantías que música |
| D-C3-05 | `view_images`: hasta 6 paths de imágenes del proyecto; render-api las achica con ffmpeg a JPEG ≤1280 px en `work/frames/previews/` y la tool devuelve las imágenes **sin `outputSchema`** (MCP) y como imagen en el runtime OpenRouter cuando el modelo acepta imágenes | Fotos crudas pueden pesar >5 MB; con `outputSchema` Claude Code tira la imagen |
| D-C3-06 | El prompt del productor: para B-roll libre usar `search_free_media`; para mirar fotos usar `view_images`, nunca `extract_frames` | Hoy en la Receta Publicidad prueba herramientas |

## Historias

- **US-018-301 — B-roll libre.** CA: `search_free_media {query, kind: video|image, maxResults}` devuelve candidatos con
  título, fuente, licencia, autor, duración (video) o tamaño (imagen) y URL de la página; `import_media {resultId}` deja
  el archivo en `raw/broll` o `raw/images` y suma su crédito a `work/credits.json`.
- **US-018-302 — Mirar fotos.** CA: `view_images {paths}` hace que el modelo reciba las fotos como imagen (verificado en
  el `tool_result` del `stream-json` de Claude y en el runtime OpenRouter).

## Tasks (detalle en tasks.json)

- **TASK-001** — Búsqueda Commons + NASA en render-api.
- **TASK-002** — Import con crédito.
- **TASK-003** — Endpoint de preview de imágenes.
- **TASK-004** — Tools MCP/OpenRouter y prompt.
- **TASK-005** — Verificación real.
- **TASK-006** — Cierre.
