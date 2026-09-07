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
  `public/example/.gitignore`. Se generan sintéticamente con `ffmpeg` (comandos más abajo).
- `src/__fixtures__/**`, `src/helpers/timeline-types.ts` (salvo `CaptionBox` y `TransitionDirection`),
  `src/remotion-entry.ts`, `src/Root.tsx` y `src/smoke.ts` son detalle de implementación: no se
  exportan desde `src/index.ts`.

## API pública

Todo lo exportado vive en `src/index.ts` (firmas completas en `architect.md` §3/§4), más
`src/render.ts` como segundo entry point Node-only (`@video-maker/composition-remotion/render`).

| Área | Exports principales |
| --- | --- |
| Assets | `assetSrc` |
| Plan de secuencia | `timelineToSequenceProps`, tipos `SequencePropsPlan`, `VideoSequenceProps`, `AudioSequenceProps`, `CaptionSequenceProps`, `ArollTransitionPlan` |
| Timing y estilo | `transitionTiming`, `punchInStyle`, `captionLayout` |
| Audio | `gainDbToVolume`, `volumeAtFrame` |
| Transiciones | `whipPanStyle`, `whipPan`, `presentationFor`, tipos `WhipPanProps`, `ArollPresentation`, `PresentationDirection` |
| Componentes | `ArollSeries`, `BrollTrack`, `AudioTrack`, `CaptionTrack`, `TimelineComposition` |
| Metadata / composición raíz | `computeTimelineMetadata`, `calculateTimelineMetadata`, `TIMELINE_COMPOSITION_ID` |
| Tipos derivados públicos | `CaptionBox`, `TransitionDirection` (el resto de `timeline-types.ts` es interno) |
| Kinetic captions — presets | `CAPTION_PRESETS`, `CAPTION_PRESET_IDS`, `DEFAULT_CAPTION_PRESET_ID`, `captionPreset`, tipos `CaptionPreset`, `CaptionPresetId`, `CaptionStroke`, `CaptionPill`, `CaptionTextTransform` |
| Kinetic captions — safe zone | `CAPTION_PLATFORMS`, `captionChromeInsets`, `captionSafeZone`, tipos `CaptionPlatform`, `CaptionChromeInsets`, `CaptionChromeReference` |
| Kinetic captions — layout y tipografía | `captionBoxFor` (tipo `CaptionAnchor`), `fitCaptionFontSize`, `captionWordStyle` (tipo `CaptionWordState`) |
| Kinetic captions — fuente propia | `captionFontFaceCss`, tipos `CaptionFontFace`, `CaptionFontFormat`, `CaptionFontDisplay` |
| Render (Node, `.../render`) | `renderTimeline`, `RenderTimelineError`, `remotionRenderDeps`, `DEFAULT_RENDER_CONCURRENCY`, tipos `RenderTimelineOptions`, `RenderTimelineResult`, `RenderTimelineDeps`, `RenderTimelineErrorCode` |

Los tests nunca importan desde el barrel: cada uno prueba su módulo por ruta relativa, mismo
criterio que `timeline-core` y `media-local`.

## Kinetic captions: presets y safe zones (cycle-01)

`captionPreset(id)` resuelve uno de cuatro looks ya calibrados. Ninguno declara un píxel: todo está
en `em` (tipografía) o en fracción del formato (layout) — ver `architect.md` §3 de
`spec-e-burgos-003-kinetic-captions/cycles/cycle-01` para el detalle campo por campo.

| Preset | Caso de uso | Rasgo distintivo |
| --- | --- | --- |
| `bold-impact` | Hook / gancho, texto grande al centro | Mayúsculas, 800/900, contorno fino, ámbar en el impacto |
| `clean-sans` | Explicativo, subtítulo legible sin ruido visual | Sin contorno, caja mixta, anclado abajo, verde en el impacto |
| `outline-pop` | Máximo contraste sobre metraje ruidoso | Contorno grueso + `paintOrder`, tres colores saturados |
| `subtle-lower` | Discreto abajo, subtítulo tipo documental | Serif, píldora semitransparente, el rango de tamaño más chico del registro |

`captionSafeZone(format, platform?, baseSafeZone?)` suma, nunca resta, el margen de chrome de una
red social sobre el safe zone base del formato. Sin `platform` es la identidad de `safeZoneFor(format)`.

| Plataforma | Por qué reserva ese margen |
| --- | --- |
| `instagram-reels` | Barra de acciones + bloque de usuario/caption/audio de Reels |
| `tiktok` | Columna de acciones (la más ancha del catálogo) + barra de navegación de la app |
| `youtube-shorts` | Título de hasta dos líneas + fila de sonido + barra de navegación |
| `youtube-landscape` | Overlay superior del reproductor + barra de progreso/controles |

`captionBoxFor(safeZone, format, preset, anchor?)` calcula la caja anclada (`top`/`center`/`bottom`,
default `preset.anchor`) contenida en el safe zone, y `fitCaptionFontSize(words, box, preset, format)`
ajusta el tamaño de letra sin medir el DOM, con clamp a `[minFontSize, maxFontSize]` del preset.
`captionWordStyle(preset, { isEmphasis, isActive })` da el `CSSProperties` de una palabra — sin
`fontSize`: lo pone el contenedor del clip una sola vez por frase (`cycle-02`).

## Fuente propia en `public/fonts/`

Los cuatro presets funcionan de fábrica con el stack de respaldo del sistema operativo (termina en
`sans-serif` o `serif`): si no se hace nada, no hace falta ningún paso de esta sección. Para usar una
fuente propia:

1. Copiar el archivo (`.woff2` recomendado) a `libs/composition-remotion/public/fonts/`. El
   directorio existe con un `.gitignore` (`*` + `!.gitignore`, igual que `public/example/`): el
   binario **nunca** se commitea.
2. Generar el bloque CSS con `captionFontFaceCss` e inyectarlo en un `<style>` de la composición:

   ```ts
   captionFontFaceCss([
     {
       family: 'Mi Fuente',
       src: staticFile('fonts/MiFuente-Bold.woff2'),
       weight: 800,
       style: 'normal',
       format: 'woff2',
       display: 'block',
     },
   ]);
   ```

   `captionFontFaceCss` no importa `remotion` ni resuelve rutas: `src` llega ya resuelto por
   `staticFile()`, que lo llama el consumidor (`cycle-02`), no el helper.
3. Anteponer `'Mi Fuente'` al `fontFamily` del preset elegido antes de usarlo (`cycle-02` acepta el
   preset por props).
4. `display: 'block'` es la opción recomendada: el archivo es local (sin red), y un FOUT cambiaría el
   ancho del texto a mitad de render, invalidando el ajuste de `fitCaptionFontSize`.

## Comandos

```bash
pnpm nx lint composition-remotion
pnpm nx test composition-remotion    # --coverage, umbral 80% sobre src/helpers/** y src/transitions/**
pnpm nx build composition-remotion   # tsc -p tsconfig.lib.json — typecheck + .d.ts, sin bundler
```

## `remotion studio` (manual, local)

```bash
pnpm exec remotion studio libs/composition-remotion/src/remotion-entry.ts
```

o, equivalentemente, `pnpm nx run composition-remotion:studio` desde la raíz del repo. Lista
`TimelineComposition` (9:16, 1080×1920@30) y `TimelineCompositionLandscape` (16:9, 1920×1080@30)
sobre la Timeline de ejemplo. Abrir el studio no genera ningún MP4 ni descarga nada además de lo ya
instalado — sí puede descargar Chrome Headless Shell la primera vez que Remotion necesita
previsualizar un frame, igual que el smoke de abajo.

## Generar los assets de ejemplo (requiere `ffmpeg`)

`public/example/` no se commitea. Desde `libs/composition-remotion/`:

```bash
mkdir -p public/example

ffmpeg -y \
  -f lavfi -i "testsrc2=size=1080x1920:rate=30:duration=10" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=10" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 2 \
  public/example/aroll.mp4

ffmpeg -y \
  -f lavfi -i "color=c=0x2244aa:size=1080x1920" \
  -frames:v 1 \
  public/example/broll.jpg

ffmpeg -y \
  -f lavfi -i "sine=frequency=220:sample_rate=44100:duration=120" \
  -c:a libmp3lame -ac 2 \
  public/example/music.mp3
```

Las duraciones (10 s de A-roll, 120 s de música) coinciden con las que declara
`src/__fixtures__/example-edl.ts`; la Timeline de ejemplo solo usa 8 833 ms (265 frames) de ese
material, así que sobra de sobra en ambos casos.

## Smoke manual — CA-027 (fuera de CI)

`renderTimeline` (el `renderMedia` real de `@remotion/renderer`) **nunca** corre en CI: ningún
`*.spec.ts` de esta lib llega a `bundle`/`selectComposition`/`renderMedia` — los specs de
`render.spec.ts` inyectan dobles de `RenderTimelineDeps` y verifican los argumentos, sin renderizar
un solo frame (CA-18, RNF-3). El único camino a un render real es este procedimiento, manual:

1. Generar los tres assets de `public/example/` con los comandos de arriba.
2. **Terminar cualquier transcripción antes de renderizar, nunca en paralelo** (RN-14, CA-15): en
   una M2 de 16 GB, Chrome Headless Shell + ffmpeg + el modelo Whisper cargados a la vez agotan la
   memoria compartida.
3. Correr el smoke:
   ```bash
   pnpm nx run composition-remotion:smoke
   ```
   La primera corrida descarga Chrome Headless Shell (nunca pasa en CI: ningún target
   automatizado llama a `renderMedia`). Si el binario no puede descargarse, el error de Remotion lo
   nombra tal cual (CE-7); la lib no intenta instalarlo por su cuenta.
4. Verificar el resultado impreso por consola y el archivo generado:
   - `out/example-9x16.mp4` existe.
   - `renderTimeline` devuelve `{ width: 1080, height: 1920, fps: 30, durationInFrames: 265 }`.
   - `ffprobe -show_streams out/example-9x16.mp4` confirma 1080×1920 @ 30 fps y ~8,83 s (265 frames).
5. Límite de concurrencia del ejemplo: **4** (`DEFAULT_RENDER_CONCURRENCY`, CA-16) — nunca "lo que
   la CPU permita".

## `OffthreadVideo` vs `Video` (nota para `spec-006`)

Esta lib usa `OffthreadVideo` en `ArollSeries` y `BrollTrack` porque extrae frames vía el renderer
de Remotion y eso es lo que optimiza el render a MP4 (RF-12, el objetivo de este ciclo). Ese mismo
componente **no es equivalente** dentro de un `<Player>` embebido en el navegador (cae a un
`<video>` en preview, sin garantía de comportamiento idéntico). `spec-006`, que monta esta
composición en un `<Player>` de `apps/web`, va a necesitar un componente de video conmutable
(`<Video>` para el Player, `<OffthreadVideo>` para el render) — no resuelto en este ciclo para no
diseñar a ciegas contra un consumidor que todavía no existe (R-2 de `architect.md`).

## `file://` para assets absolutos (no verificado en este ciclo)

El camino soportado y ejercitado por el smoke es **relativo + `staticFile()`** (assets dentro de
`public/example/`). `assetSrc` también resuelve rutas absolutas a `file://`, para que
`spec-005`/`tools/render-cli` puedan renderizar el metraje real del creador sin copiar gigabytes a
`public/` — esa rama no está verificada acá: si Chrome bloqueara sub-recursos `file://` durante el
render, el fallback es pasar `publicDir` (opción de `RenderTimelineOptions`) apuntando al directorio
real de assets y usar rutas relativas en la `Timeline`.
