# composition-remotion

Lib React 19 + Remotion 4 que convierte una `Timeline` de `@video-maker/timeline-core` en frames
(preview/Player) y, por una entrada Node separada, en un archivo MP4. Sin base de datos, sin
endpoints HTTP.

Se importa por source vía los alias `@video-maker/composition-remotion` (barrel browser-safe:
componentes, helpers puros y tipos) y `@video-maker/composition-remotion/render` (`renderTimeline`,
Node puro).

## Límites de la lib

- `src/index.ts` no importa, ni transitivamente, `@remotion/bundler`, `@remotion/renderer` ni
  módulos de Node (`fs`, `path`, `child_process`, `os`, `node:*`): tiene que poder montarse en un
  `<Player>` de browser.
- Ningún test monta Remotion, renderiza un frame ni descarga Chrome Headless Shell. El único camino
  a un render real es el target `smoke`, manual y fuera de `lint test build`.
- Los assets de `public/example/` (`aroll.mp4`, `broll.jpg`, `music.mp3`) no se commitean — ver
  `public/example/.gitignore`. Se generan sintéticamente con `ffmpeg` (comandos documentados aquí
  cuando el target `smoke` quede implementado).

## Running unit tests

Run `nx test composition-remotion` to execute the unit tests via [Vitest](https://vitest.dev/).
