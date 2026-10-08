# SPEC-e-burgos-022: Publicar videos en YouTube desde el estudio

> Estado: **draft** — registrada el 2026-10-08.
> Pedido del dev: publicar los videos de forma sistemática en YouTube (primera fase); el dev inicia sesión con su
> cuenta de Gmail y el estudio se encarga del resto.

## Situación actual

Los videos terminan en `out/` (MP4 + `.credits.txt` en motion) y se suben a mano. No hay integración con ninguna
plataforma.

## Datos de la API (documentación oficial, 2026-10-08)

- `videos.insert`: cupo propio de **100 subidas por día** (1 unidad por llamada); el resto de los métodos comparte
  10 000 unidades diarias (`thumbnails.set` y `playlistItems.insert`: 50 cada uno).
- Los videos subidos desde proyectos de API sin verificar **no** quedan forzados a privados.
- Subida reanudable soportada; alcance mínimo `https://www.googleapis.com/auth/youtube.upload` (+ `youtube.readonly`
  para listar canales y listas).

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Conectar una cuenta de YouTube (OAuth de escritorio con redirect local), guardar la autorización de forma segura y publicar un video de un proyecto con título, descripción, etiquetas, visibilidad, programación, lista y miniatura opcionales; los créditos de música entran solos en la descripción | cycle-01 |
| O-2 | Metadatos propuestos por el productor (guion + marca) y editables; publicación registrada en el proyecto (estado, enlace, fecha) | cycle-01 |
| O-3 | Cola de publicación: varios videos de una carpeta con fechas escalonadas, revisión previa y jobs con progreso y reintento | cycle-02 |
| O-4 | El productor prepara publicaciones (nunca publica sin confirmación explícita) y todo funciona en la app de escritorio | cycle-03 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | Cliente OAuth de tipo **escritorio** con redirect `http://127.0.0.1:<puerto>` + PKCE; el ID y el secreto los carga el dueño en Configuración | Sirve igual para la web local y la app; Google exige que el dueño cree el cliente |
| D-02 | El refresh token se guarda en el `secretStore` (llavero en la app), nunca en `media/` ni en SQLite | Es una credencial de la cuenta de Google |
| D-03 | Visibilidad por defecto **pública** (decisión del dev), editable por video y por cola; la programación usa `status.publishAt` (sube privado y YouTube lo publica a la hora) | Publicación sistemática sin intervención |
| D-04 | La subida es un job `publish` de la cola de render-api (reanudable, con progreso, cancelación y reintento) | Mismo modelo que render/montaje; sobrevive a cortes |
| D-05 | Las publicaciones se registran en SQLite (`publications`: proyecto, plataforma, archivo, videoId, url, estado, programada, publicada) | La lista de videos y el productor saben qué ya se publicó; evita duplicados |
| D-06 | El productor nunca publica sin una confirmación explícita del usuario en el chat | Publicar es una acción pública e irreversible en la práctica |
| D-07 | Ciclos `lite`, verificados con una subida real a la cuenta del dev | Igual que spec-021 |
