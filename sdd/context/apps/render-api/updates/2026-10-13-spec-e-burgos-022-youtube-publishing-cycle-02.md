# spec-e-burgos-022 cycle-02 — 2026-10-13

## Estado
Cola de publicación: `youtube/publish-queue-scheduler.ts` (tick 60 s, un publicador, límite diario de 24 h, cuota → +1 h a toda la cola, sin conexión → pausa, ya publicado → `already-published`, listas por categoría + general) arranca con el server y nace pausada. Rutas EP-067..EP-073 (`/publish-queue*`, `/integrations/youtube/category-playlists`). El job `publish` acepta `playlistIds[]`.

## Estructura
Nuevos: `youtube/publish-queue-scheduler.ts`, `publish-queue-job-launcher.ts`, `publish-queue-settings.ts`, `resolve-publish-language.ts`, `http/handlers/publish-queue-handler.ts`.

## Dependencias
`LocalStorePort.publishQueue`.

## Qué sigue
cycle-03: tool del productor y app de escritorio.
