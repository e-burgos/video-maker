# spec-e-burgos-018-producer-free-tier cycle-03 — 2026-09-25

## Estado
El contrato pasa de 14 a 17 tools: `search_free_media`, `import_media` y `view_images`.

## Estructura
- `view_images` (1–6 paths de fotos del proyecto) va en `TOOLS_WITHOUT_OUTPUT_SCHEMA` junto a `extract_frames`;
  verificado que el `tool_result` del `stream-json` de Claude trae `[image, text]` y que el runtime OpenRouter manda
  la imagen al modelo.
- Cliente: métodos `searchFreeMedia`, `importFreeMedia`, `previewImages`.
- Prompt: B-roll o fotos libres con `search_free_media`/`import_media`; mirar fotos con `view_images`, nunca con
  `extract_frames`.

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
