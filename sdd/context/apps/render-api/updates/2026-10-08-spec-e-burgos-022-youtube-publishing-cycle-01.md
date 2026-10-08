# spec-e-burgos-022-youtube-publishing cycle-01 — 2026-10-08

## Estado
Publicación en YouTube: OAuth de escritorio con PKCE y redirect local de un solo uso (puerto `startOAuthLoopback`,
página de éxito que se cierra sola), cliente y refresh token en `secretStore`, canal en settings. Job `publish`
(subida reanudable en trozos de 8 MiB con `Content-Range`, sesión guardada para reintentos, miniatura y lista,
créditos de música agregados una vez a la descripción, `publishAt` → privado programado). Borrador de metadatos por el
motor del productor con los nombres escritos de la marca (`writtenNames`: "Isi Pro" → "Easy Pro"). Tabla
`publications` y `lastPublication` en `GET /projects`. Errores `YOUTUBE_CLIENT_MISSING`, `YOUTUBE_NOT_CONNECTED` (409),
`YOUTUBE_UPLOAD_FAILED` (502), `YOUTUBE_QUOTA_EXCEEDED` (429), `PUBLISH_FILE_INVALID` (422). `fetchRemote` acepta
método, cuerpo y `redirect: 'manual'`.

## Estructura
Nuevos `src/youtube/*`, `src/jobs/run-publish-pipeline.ts`, `publish-job-*.ts`, `src/deps/oauth-loopback.ts`,
`http/handlers/youtube-integration-handler.ts`, `youtube-publish-handler.ts`.

## Dependencias
Sin cambios (HTTP saliente sólo a accounts.google.com, oauth2.googleapis.com y www.googleapis.com).

## Qué sigue
cycle-02: cola de publicación escalonada; aviso de video ya publicado.
