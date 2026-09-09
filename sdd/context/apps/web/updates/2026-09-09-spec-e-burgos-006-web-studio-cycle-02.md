# spec-e-burgos-006-web-studio cycle-02 — 2026-09-09

## Estado

- `resuelve: context_prompt.md § Estado ("Alcance todavía no cubierto: `<Player>` de Remotion")`.
  La app **ya monta la composición real en un `<Player>`**: `/projects/:slug/preview` lee la
  `Timeline` persistida por `EP-007`, la valida contra `TimelineSchema` y la reproduce con
  `TimelineComposition` de `@video-maker/composition-remotion`. Sigue sin cubrir: edición del
  timeline (`EP-008`..`EP-010`) y jobs de render (`EP-012`..`EP-015`) — `cycle-03`.
- **Medido en el navegador** contra `render-api` vivo (capturas y guion en
  `cycles/cycle-02/artifacts/visual-verification.md`): el `<video>` del Player llega a
  `readyState: 4` con `paused: false` y `currentTime` avanzando `2.499 s → 4.661 s` en 1,5 s; los
  captions de spec-003 aparecen en el DOM; la música suena a `volume 0.0631`, que es exactamente el
  `gainDb: -24` de `audioMix.automation` (10^(-24/20)).
- Suite: **21 archivos / 95 tests**, cobertura **98,56 % stmts · 96,29 % branch · 97,02 % funcs ·
  99,25 % lines**, piso 80 %, `coverage.include` `src/**/*.{ts,tsx}` sin recortar.
- **Hallazgo abierto:** el encuadre del preview **no** es el del render (browser: `object-fit:
  contain`, letterbox; render: llena el cuadro). No lo causa el conmutador — forzar el backend
  `render` dentro del Player da el mismo letterbox. Alinearlo cambia la salida del render
  (probado: `sha256` de `video-muted.mp4` pasó de `c1b9fd9f…` a `2ed415d8…`), así que es decisión
  de spec para `cycle-03`.

## Estructura

```
src/
  api/          + parse-timeline (TimelineSchema → RESPONSE_SHAPE_UNEXPECTED),
                + player-timeline (assets → URL absoluta de EP-011),
                + preview-format (override 9:16 / 16:9 con su safeZone),
                + __fixtures__/timeline (Timeline válida para los tests)
  components/   + timeline-player (Player de Remotion bajo VideoBackendProvider backend="player")
  pages/        + project-preview-page
  app/app.tsx   + ruta /projects/:slug/preview, cargada con React.lazy
```

- **La composición se envuelve en `<VideoBackendProvider backend="player">`**, que es lo único que
  hace que el árbol monte `<Video>` en vez de `<OffthreadVideo>`. El render nunca monta ese
  proveedor: su default es `'render'` y la salida quedó byte-idéntica.
- **Los assets se reescriben antes de montar** (`playerTimeline`): cada `MediaAsset.path` pasa a
  `new URL(artifactUrl(slug, path), window.location.origin).toString()`. Sin eso, `assetSrc` de la
  lib llamaría `staticFile()` para una ruta relativa —resolviendo contra el `public/` vacío de esta
  app— o armaría un `file://` que el navegador no puede cargar. Same-origin gracias al proxy `/api`
  (D-4) es lo que permite `Range` sin CORS.
- **El selector de formato es override de preview, nunca escritura**: `previewFormat` cambia
  `format` **y** `safeZone` juntos (el `safeZone` persistido de 9:16 —`top 220 / bottom 400`— sobre
  un lienzo 16:9 dejaría los captions fuera de cuadro) y no emite ningún request.
- **La validación profunda vive en `src/api/parse-timeline.ts`, no en el cliente.** El cliente
  mantiene el patrón de los otros seis endpoints (guard estructural liviano + cast) y
  `parseTimelineDocument` convierte un documento que no valida en `RESPONSE_SHAPE_UNEXPECTED` en
  vez de un error crudo de Zod. Está donde está por una razón de bundle, no de estilo: importar
  `TimelineSchema` desde el cliente (que carga toda pantalla) metía Zod + `timeline-core` en el
  chunk inicial. La regla `@nx/enforce-module-boundaries` **prohíbe mezclar import estático y
  `await import()` de la misma lib**, así que la salida no era un import dinámico sino mover el
  único consumidor al chunk perezoso.
- **La ruta de preview es code-split** (`React.lazy` + `Suspense`): 441 kB (Player + Remotion +
  composición + Zod) que sólo carga esa ruta; el chunk inicial quedó en 450 kB, sin el aviso de
  Vite de "chunks larger than 500 kB" que apareció al importar el Player estáticamente.
- **`data-*` de diagnóstico en `timeline-player.tsx`** (`data-duration-in-frames`, `data-fps`,
  `data-composition-width/height`): son el contrato que lee la verificación visual de Playwright.
  Si se renombran, hay que actualizar el guion del artefacto.

## Dependencias

- **`@remotion/player@4.0.522`, versión exacta de `remotion`** — única dependencia npm de esta app
  y la única prevista por D-2 para toda la spec. Comparte el contexto interno de Remotion: una
  versión distinta rompe en runtime sin error de tipos.
- **Primeras dependencias de workspace:** `@video-maker/composition-remotion` y
  `@video-maker/timeline-core`. `tsconfig.base.json` ya declaraba los `paths` (archivo protegido,
  no se tocó); se agregó `resolve.alias` en `apps/web/vite.config.ts` con `resolve(projectRoot, …)`
  —no `import.meta.url`, porque el config se carga como CJS y `__dirname` es lo que ya funcionaba
  ahí—. Ese único alias cubre Vitest y el bundle del navegador; `webpackOverride` no aplica (es del
  render). Verificado que `web:build` bundlea **y** que el Player carga en Chrome.
- Nx boundaries: `apps/web` es `type:app`, cae en el fallback `*` → `*`; importar las dos libs no
  necesita ninguna regla nueva.

## Qué sigue

- **`cycle-03` se abre `[FULL]`, no `lite`**: el hallazgo del encuadre cambia el entregable
  (decisión de spec), y el ciclo trae edición del timeline (`EP-008`/`EP-010`, escrituras) y jobs.
- **Para reproducir el encuadre hace falta un clip de prueba con contenido no uniforme**:
  `media/smoke-ingest/raw/aroll/clip01.mp4` es azul casi plano y no distingue `cover` de `fill`.
- **El `<Player>` no aplica `loudnorm`.** Lo que se escucha es la curva de ducking de la Timeline,
  no el master a -14 LUFS. Está escrito en pantalla y en el README de la lib; no volver a
  "arreglarlo" en el navegador.
- **`asset-media-kind.ts` y `content-type-for.ts` del servicio siguen siendo un par sin test.**
- El upload sigue sin progreso y no hay polling en ninguna pantalla (decisiones de `cycle-03`).
- Los dos `404` de consola de la corrida de Playwright quedaron **confirmados** como
  `/favicon.ico`: `index.html` no declara icono. No es un defecto de la aplicación.
