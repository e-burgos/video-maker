# Verificación — spec-e-burgos-022 cycle-02 (2026-10-13)

## Automática
- `nx run-many -t lint test build` verde: local-store (80), render-api (2218), web (1633); build de desktop verde.
- render-api arrancó con su loader real en un puerto aparte y respondió `GET /publish-queue`, `PUT /publish-queue/settings` y `GET /integrations/youtube/category-playlists`.

## Studio real (sin publicar nada)
- Con la tabla vacía, `GET /publish-queue` → `paused: true, dailyLimit: 10, publishedLast24h: 0`: la cola nace pausada.
- Migración (`.motion-work/youtube-tutorials/migrate-queue-to-studio.py`): los 9 videos de `publish-queue.txt` (chat-ia, sugerencias-ia, generar-contenido-ia, competidores-ia, uso-ia, perfil-organizacion, crear-rol, usuarios, comprar-producto-v2) entraron en ese orden con el metadato aprobado (`tut/<slug>/final.json`), el render de `last-job.json`, `privacy: public`, `ignoreReview: true` y sus listas del manifiesto (categoría + general). Los IDs coinciden con `GET /integrations/youtube/playlists`.
- Mapeo de las 7 categorías de la carpeta Display Ads y lista general «Tutoriales Display Ads» guardados; Configuración › YouTube › «Listas por categoría» los muestra.
- Página «Cola de publicación» (link «Publicación» en el header): Pausada, «Publicados en las últimas 24 h: 0 de 10», 9 ítems «En cola»; mover un ítem reordena en el servidor (se devolvió a su lugar).
- `publish-queue.sh` y `publish.sh` retirados (`*.retired`); `publish-queue.txt` marcado como migrado.

## Pendiente
- La publicación real con la cola (reintento por cuota, ya publicado) se verifica al reactivarla (punto 13 del plan).
