# spec-e-burgos-022-youtube-publishing — cycle-01 · plan (lite)

> Módulo: youtube-publishing | Subproyectos: apps/render-api, libs/local-store, apps/web | Fecha: 2026-10-08
> Objetivo: conectar YouTube y publicar un video de un proyecto con metadatos del productor, registrado en el proyecto.
> Fuera de alcance: cola de varios videos (cycle-02), tool del productor y app de escritorio (cycle-03).

## Historias
- US-022-101 — Como dev quiero conectar mi cuenta de YouTube una vez. CA: Configuración guarda ID/secreto del cliente OAuth, "Conectar YouTube" abre el login de Google, vuelve al estudio y muestra el canal; "Desconectar" revoca y borra el token.
- US-022-102 — Como dev quiero publicar un video de un proyecto. CA: desde vista previa/Entregas elijo el MP4, edito título/descripción/etiquetas/visibilidad/fecha/lista/miniatura y un job lo sube (reanudable, con progreso); al terminar el proyecto muestra el enlace.
- US-022-103 — Como dev quiero que el productor proponga los metadatos. CA: "Proponer con el productor" devuelve título (≤100), descripción (con tagline, web y créditos de música) y etiquetas desde el guion y la marca.
- US-022-104 — Como dev quiero ver qué está publicado. CA: tabla `publications` en SQLite; la lista de videos marca los publicados y el proyecto lista sus publicaciones.

## Tasks (detalle en tasks.json)
- TASK-001 — OAuth: settings del cliente (secretStore), `POST /integrations/youtube/connect` (URL de consentimiento con PKCE + listener de redirect local), callback, refresh automático, `GET /integrations/youtube` (canal conectado), `DELETE` (revocar). Tests con fakes; sin token en logs.
- TASK-002 — Subida: puerto `youtubeClient` (resumable `videos.insert`, `thumbnails.set`, `playlistItems.insert`, `channels.list`, `playlists.list`), job `publish` en la cola con progreso por bytes, cancelación y reintento que retoma la subida; créditos de música agregados a la descripción.
- TASK-003 — Metadatos: `POST /projects/:slug/publish/youtube/draft` usa el motor del productor (Claude CLI aislado u OpenRouter) con guion, marca y duración → `{title, description, tags}` validado.
- TASK-004 — Registro: migración `publications`, endpoints `GET /projects/:slug/publications` y estado en la lista de proyectos.
- TASK-005 — Web: Configuración › YouTube (cliente + conectar) y diálogo "Publicar en YouTube" en el proyecto; estado de publicación en tarjetas.
- TASK-006 — Verificación: conexión real con la cuenta del dev y subida real de un video corto (privado para la prueba).

## Decisiones técnicas
- Endpoints nuevos en render-api: `/integrations/youtube*`, `/projects/:slug/publish/youtube*`, `/projects/:slug/publications` → api.json.
- Tabla nueva `publications` (local-store) → schema.json.
- HTTP saliente sólo a `accounts.google.com`, `oauth2.googleapis.com` y `www.googleapis.com` por `deps.fetchRemote`.
