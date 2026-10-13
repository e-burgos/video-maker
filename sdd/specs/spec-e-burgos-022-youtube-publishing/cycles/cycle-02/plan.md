# spec-e-burgos-022-youtube-publishing — cycle-02 · plan (lite)

> Módulo: youtube-publishing | Subproyectos: libs/local-store, apps/render-api, apps/web | Fecha: 2026-10-13
> Objetivo: cola de publicación programada dentro del estudio que reemplaza `.motion-work/youtube-tutorials/publish-queue.sh` y `publish.sh`.
> Fuera de alcance: tool del productor y app de escritorio (cycle-03). La cola se migra pausada: no se publica nada en este ciclo.

## Historias
- US-022-201 — Como dev quiero encolar varios videos y que el estudio los publique solo. CA: una tabla `publish_queue` guarda cada ítem (proyecto, archivo, metadatos, orden, estado); el estudio publica de a uno, en orden, sin pasar el límite diario configurable (10 por defecto, ventana de 24 h); puedo pausar, reanudar, reordenar, quitar y reintentar.
- US-022-202 — Como dev no quiero perder un día por la cuota. CA: un `YOUTUBE_QUOTA_EXCEEDED` deja el ítem en cola con próximo intento en 1 h (reintento horario); `YOUTUBE_NOT_CONNECTED` pausa la cola y lo dice; otro error marca `failed` y sigue con el próximo.
- US-022-203 — Como dev quiero listas por categoría y no publicar dos veces. CA: Configuración › YouTube asigna una lista a cada categoría de carpeta y una lista general; un ítem sin listas propias va a la de su categoría y a la general. Si el archivo ya está publicado/programado/subiendo, el ítem queda `already-published` con el enlace y no se sube; al agregarlo, la web avisa.
- US-022-204 — Como dev quiero la cola actual adentro del estudio. CA: los 9 videos de `publish-queue.txt` quedan en la cola del estudio con su metadato aprobado (`final.json`), su render (`last-job.json`) y sus listas, con la cola pausada; los scripts quedan retirados.

## Tasks (detalle en tasks.json)
- TASK-001 — Migración v7 `publish_queue` (id, slug FK, file, metadata JSON, position, status `queued|publishing|published|already-published|failed`, attempts, last_error, next_attempt_at, job_id, url, created_at, updated_at) + repositorio.
- TASK-002 — `publish-queue-scheduler.ts` con reloj y timer inyectados (tick de 60 s y tras cada cambio), recuperación al arrancar, `playlistIds[]` en el job `publish` (compatible con `playlistId`), rutas `GET /publish-queue`, `POST /publish-queue/items`, `PATCH|DELETE /publish-queue/items/:id`, `PUT /publish-queue/settings`, `GET|PUT /integrations/youtube/category-playlists`. Ajustes en `settings` (`youtube.queue`, `youtube.categoryPlaylists`, `youtube.generalPlaylistId`).
- TASK-003 — Web: página «Cola de publicación», botón «Agregar a la cola» en el diálogo de publicar (con aviso de ya publicado) y listas por categoría en Configuración › YouTube.
- TASK-004 — Migración de la cola actual (pausada) y verificación en el studio real.

## Decisiones técnicas
- Un solo publicador a la vez (la cola no arranca un ítem mientras haya un job `publish` corriendo); el límite cuenta las publicaciones `published|scheduled` de las últimas 24 h.
- La cola no toca `media/display-ads-manifiesto.json`: su shape lo consume display-ads; el manifiesto se actualiza al publicar (punto 13) como hasta ahora.
