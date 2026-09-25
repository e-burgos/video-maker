# spec-e-burgos-018-producer-free-tier cycle-03 — 2026-09-25

## Estado
Material libre de video e imágenes (Wikimedia Commons + NASA Image and Video Library, sin key) y preview de
fotos para el modelo; verificado en vivo con los dos motores.

## Estructura
- `src/media-search/`: `commons-media-search.ts` (`filetype:video|bitmap`, licencia comercial, video mp4/webm,
  imagen jpg/png/webp), `nasa-media-search.ts` (solo ítems sin crédito o con crédito de NASA; `~medium.mp4`,
  `~large.jpg` con fallback a `~orig`), `free-media-search.ts` (**intercala** las fuentes antes de recortar a
  `maxResults`: concatenar dejaba a NASA en 0), caché por proyecto, `import-free-media.ts` (hosts
  `upload.wikimedia.org`/`images-assets.nasa.gov`, tope 200 MB video / 30 MB imagen, temp + promote a
  `raw/broll` o `raw/images`), `commons-shared.ts` y `download-shared.ts` compartidos con `music/`.
- `work/credits.json`: `MediaCreditEntry` con `kind: music|video|image`.
- Endpoints EP-046 `GET /projects/:slug/media/search`, EP-047 `POST /projects/:slug/media/import`, EP-048
  `POST /projects/:slug/images/preview` (JPEG ≤1280 px en `work/frames/previews/`).
- Puerto nuevo `resizeImage` (hermano de `extractFrame`). **Nunca `-ss` sobre una imagen fija**: el demuxer
  `image2` reporta duración casi nula, `-ss 0` salta el único frame y ffmpeg sale 0 sin escribir nada.

## Dependencias
Sin nuevas.

## Qué sigue
`cycle-04`: modelos gratuitos recomendados.
