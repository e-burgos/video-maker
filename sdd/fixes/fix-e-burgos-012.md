# FIX-e-burgos-012 — Permiso de listas de YouTube y endpoints para crearlas y llenarlas

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-012 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-09 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- La conexión con YouTube pedía solo `youtube.upload` y `youtube.readonly`. Según la documentación de la API,
  `playlistItems.insert` y `playlists.insert` exigen `youtube`, `youtube.force-ssl` o `youtubepartner`: el paso
  "playlist" de la publicación fallaba con 403 y no había forma de crear las listas que espejan las categorías del
  studio.

## Solución
- `YOUTUBE_SCOPES` suma `youtube.force-ssl`; un canal conectado antes tiene que reconectarse una vez. Un 403
  `insufficientPermissions` se informa como `YOUTUBE_NOT_CONNECTED` con la pista de reconectar.
- `YoutubeClient.createPlaylist` y tres rutas: `GET /integrations/youtube/playlists`,
  `POST /integrations/youtube/playlists` (`title`, `description`, `privacy`, privada por defecto) y
  `POST /integrations/youtube/playlists/:playlistId/items` (`videoId`) para sumar videos ya publicados.
