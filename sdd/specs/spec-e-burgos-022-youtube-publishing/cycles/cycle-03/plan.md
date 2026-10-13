# spec-e-burgos-022-youtube-publishing — cycle-03 · plan (lite)

> Módulo: youtube-publishing | Subproyectos: libs/producer-tools, apps/render-api, apps/desktop | Fecha: 2026-10-13
> Objetivo: el productor prepara publicaciones y las encola con confirmación explícita (D-06); la app de escritorio abre el login de Google en el navegador del sistema.
> Fuera de alcance: publicar sin cola (el productor nunca sube directo).

## Historias
- US-022-301 — Como dev quiero pedirle al productor «publicalo» y que lo deje listo. CA: el productor propone título/descripción/etiquetas (borrador existente), dice qué lista y visibilidad usará, avisa si el archivo ya está publicado, y recién con mi confirmación explícita en el chat lo agrega a la cola (`queue_publication` exige la cita textual de esa confirmación); informa si la cola está pausada y cuándo saldría.
- US-022-302 — Como dev en la app de escritorio quiero conectar YouTube. CA: «Conectar YouTube» abre el consentimiento de Google en el navegador del sistema (`shell.openExternal`), nunca dentro de la ventana de la app; cualquier enlace externo (http/https fuera del origen de la app) también se abre afuera.

## Tasks (detalle en tasks.json)
- TASK-001 — Tools `draft_publication` (usa `POST /projects/:slug/publish/youtube/draft`), `list_publications` (publicaciones del proyecto + sus ítems en la cola + estado de la cola) y `queue_publication` (`POST /publish-queue/items`, input con `userConfirmation` no vacío); prompt del productor.
- TASK-002 — `setWindowOpenHandler` y `will-navigate` de la ventana principal: URL externa → `shell.openExternal` y se cancela la navegación interna (función pura testeada).
- TASK-003 — Verificación con un turno real del productor (cola pausada; el ítem de prueba se quita) y build de desktop.
