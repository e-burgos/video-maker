# spec-e-burgos-006-web-studio cycle-02 — 2026-09-09

## Estado

- `resuelve: context_prompt.md § Qué sigue ("OffthreadVideo (usado en el render) vs Video
  (necesario en un <Player> de browser): resolver al construir el Player de spec-006 con un
  componente de video conmutable")`. **Resuelto**: `TimelineVideo` + contexto `VideoBackendProvider`.
- **La salida del render no cambió, byte a byte.** Job real de `apps/render-api` sobre
  `media/smoke-ingest` después del cambio: `work/renders/<job>/video-muted.mp4` con
  `sha256 c1b9fd9f33ba…4c8527cb` y `out/<job>.mp4` con `4bfe9f7bc07d…60383225`, los mismos de las
  cuatro corridas previas al cambio. `ffprobe` del stream de video: `h264 1080×1920 30/1`,
  `nb_frames 538` (17,933 s derivados del stream, no de `format.duration`).
- **Ningún contrato público cambió**: `renderTimeline`, `RenderTimelineOptions`,
  `RenderTimelineError`, `TimelineAudioMode` y `TimelineCompositionProps` son los de antes, y
  `renderTimeline` sigue armando `inputProps: { timeline, ...(audio === 'muted' ? { audio } : {}) }`.
  `apps/render-api` y `tools/render-cli` no se tocaron.
- Suite: **24 archivos / 256 tests**, cobertura **93,61 % stmts · 92,3 % branch · 90,9 % funcs ·
  93,47 % lines** con el piso global de 80 % intacto.

## Estructura

- `src/components/video-backend.tsx` — `VideoBackend` (`'render' | 'player'`),
  `DEFAULT_VIDEO_BACKEND = 'render'`, `VideoBackendProvider` y `useVideoBackend`. No importa
  `remotion`: es sólo contexto de React.
- `src/components/timeline-video.tsx` — `TimelineVideo`: `'player'` → `<Video>`, cualquier otro
  caso (incluido *sin proveedor*) → `<OffthreadVideo>`, con los mismos props de siempre
  (`src`, `trimBefore`, `muted`, `style`).
- `ArollScene` (`aroll-series.tsx`) y `BrollMedia` (`broll-track.tsx`) montan `TimelineVideo` en
  lugar de `OffthreadVideo`. Es el **único** cambio en componentes existentes.
- Barrel: exports **aditivos** `TimelineVideo`, `VideoBackendProvider`, `useVideoBackend`,
  `DEFAULT_VIDEO_BACKEND` y los tipos `TimelineVideoProps`, `VideoBackend`,
  `VideoBackendProviderProps`.
- `vite.config.ts` → `coverage.include` suma `src/components/timeline-video.tsx` y
  `src/components/video-backend.tsx`; los dos quedan al 100 %. El resto de `src/components/**`
  sigue descopado (FIX-e-burgos-001-002).
- Los tests usan `renderToStaticMarkup` de `react-dom/server` y `vi.mock('remotion')` con el
  factory en `async () => { const { createElement } = await import('react'); … }` — el factory de
  `vi.mock` está hoisteado y no puede cerrar sobre imports del módulo.

## Dependencias

- **Ninguna dependencia npm nueva en esta lib.** `@remotion/player@4.0.522` se instaló en el
  manifiesto raíz para `apps/web`; esta lib no lo importa.
- Consumidor nuevo: `apps/web` importa el barrel (`TimelineComposition`, `VideoBackendProvider`,
  `computeTimelineMetadata`) por `resolve.alias` de su propio `vite.config.ts`.

## Qué sigue

- **`getRemotionEnvironment()` quedó descartado con fundamento medido**, no por gusto: se apoya en
  `window.process.env.NODE_ENV` y `window.remotion_puppeteerTimeout`, globals internos que no son
  contrato y no se simulan en jsdom sin falsificarlos; y `OffthreadVideo` de 4.0.522 **ya hace ese
  branch por dentro** (`environment.isRendering ? OffthreadVideoForRendering : VideoForPreview`).
  Si alguien propone volver a esa vía, esta es la razón por la que no.
- **El encuadre del preview no es el del render, y no lo causa el conmutador.** En el navegador el
  `<video>` computa `width 1080px · height 1920px · object-fit: contain` (letterbox) con **los dos**
  backends; el render llena el cuadro. Dar a `ArollScene` un estilo explícito
  `{ width: '100%', height: '100%', objectFit: 'cover' }` —espejo del `COVER_MEDIA_STYLE` que
  `BrollTrack` ya usa— **cambia la salida del render**: probado, `video-muted.mp4` pasó a
  `sha256 2ed415d8…`. Revertido. Es decisión de spec para `spec-006` cycle-03 (`[FULL]`), y exige
  un clip de prueba con contenido no uniforme.
- **`ArollScene` es el único punto de la lib donde el estilo del clip sale sólo de `punchInStyle`**
  (sin `width`/`height`/`objectFit`), a diferencia de `BrollTrack`, que los declara explícitos. Esa
  asimetría es la raíz del hallazgo anterior.
- El resto de `src/components/**` (`AudioTrack`, `KineticCaptions`, `ArollSeries`, `BrollTrack`)
  sigue sin tests propios y fuera de la cobertura; la evidencia de que funcionan es el render real.
- La rama `file://` de `assetSrc` sigue sin verificarse con un render real. El Player la **evita**
  a propósito: `apps/web` reescribe los assets a URLs `http://` antes de montar.
