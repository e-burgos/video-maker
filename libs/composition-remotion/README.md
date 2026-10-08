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
| Plan de secuencia | `timelineToSequenceProps`, tipos `SequencePropsPlan`, `VideoSequenceProps`, `AudioSequenceProps`, `CaptionSequenceProps`, `LogoSequenceProps`, `ArollTransitionPlan` |
| Timing y estilo | `transitionTiming`, `punchInStyle` |
| Audio | `gainDbToVolume`, `volumeAtFrame` |
| Transiciones | `whipPanStyle`, `whipPan`, `presentationFor`, tipos `WhipPanProps`, `ArollPresentation`, `PresentationDirection` |
| Componentes | `ArollSeries`, `BrollTrack`, `AudioTrack`, `LogoOverlay`, `KineticCaptions`, `TimelineComposition` |
| Logo | `logoOverlayBox`, `logoOverlayStyle`, tipos `LogoOverlayBox`, `LogoOverlayProps` |
| Bumpers de logo | `LogoBumperScene`, `logoBumperLogoStyle`, `logoBumperEnterFrames`, `logoBumperExitFrames`, `LOGO_BUMPER_ENTER_MS`, `LOGO_BUMPER_EXIT_MS` |
| Backend de video (Player vs render) | `TimelineVideo`, `VideoBackendProvider`, `useVideoBackend`, `DEFAULT_VIDEO_BACKEND`, tipos `TimelineVideoProps`, `VideoBackend`, `VideoBackendProviderProps` |
| Metadata / composición raíz | `computeTimelineMetadata`, `calculateTimelineMetadata`, `TIMELINE_COMPOSITION_ID` |
| Tipos derivados públicos | `CaptionBox`, `TransitionDirection` (el resto de `timeline-types.ts` es interno) |
| Kinetic captions — presets | `CAPTION_PRESETS`, `CAPTION_PRESET_IDS`, `DEFAULT_CAPTION_PRESET_ID`, `captionPreset`, tipos `CaptionPreset` (incluye `maxLines`), `CaptionPresetId`, `CaptionStroke`, `CaptionPill`, `CaptionTextTransform` |
| Kinetic captions — safe zone | `CAPTION_PLATFORMS`, `captionChromeInsets`, `captionSafeZone`, tipos `CaptionPlatform`, `CaptionChromeInsets`, `CaptionChromeReference` |
| Kinetic captions — layout y tipografía | `captionBoxFor` (tipo `CaptionAnchor`), `fitCaptionFontSize`, `captionWordStyle` (tipo `CaptionWordState`) |
| Kinetic captions — fuente propia | `captionFontFaceCss`, tipos `CaptionFontFace`, `CaptionFontFormat`, `CaptionFontDisplay` |
| Kinetic captions — animación de entrada/salida | `captionClipAnimation`, `captionBlockStyle`, tipos `CaptionAnimation`, `CaptionAnimationMode`, `CaptionClipAnimation`, `CaptionSpring` |
| Kinetic captions — palabra activa | `activeWordIndex`, `captionWordRenders`, tipo `CaptionWordRender` |
| Kinetic captions — plan de clip (caja + fontSize + `boxSource`) | `captionBoxStyle`, `captionClipPlan`, tipos `CaptionBoxSource`, `CaptionClipPlan` |
| Kinetic captions — componente | `KineticCaptions`, tipo `KineticCaptionsProps` |
| Render (Node, `.../render`) | `renderTimeline`, `RenderTimelineError`, `remotionRenderDeps`, `DEFAULT_RENDER_CONCURRENCY`, tipos `RenderTimelineOptions`, `RenderTimelineResult`, `RenderTimelineDeps`, `RenderTimelineErrorCode` |

Los tests nunca importan desde el barrel: cada uno prueba su módulo por ruta relativa, mismo
criterio que `timeline-core` y `media-local`.

## Audio: `mix` | `muted` (`cycle-02` de `spec-e-burgos-004-audio-mix-mastering`)

`renderTimeline(timeline, { outPath, audio: 'muted' })` y `TimelineComposition` aceptan una opción
`audio?: TimelineAudioMode` (`'mix' | 'muted'`, tipo exportado del barrel). Omitida o en `'mix'` el
comportamiento es **idéntico byte a byte** al de antes de este ciclo (incluida la Timeline de
`inputProps`, ver `render.spec.ts`): sigue montando `<AudioTrack>` y aplicando la mezcla en vivo
que hace Remotion para el preview. Solo con `audio: 'muted'` la composición **no monta
`<AudioTrack>`** y el render sale mudo.

## Capa de logo (spec-014)

`TimelineComposition` monta `LogoOverlay` cuando la `Timeline` trae `logo`, **entre el B-roll y las
captions**: el logo nunca puede tapar texto. La geometría es pura y vive en `logoOverlayBox` —
ancho `widthRatio × format.width` recortado al espacio entre márgenes, margen `marginRatio ×
format.width` **igual en los dos ejes**, y la esquina que dicta `position` (default
`bottom-right`). El logo se dibuja también con `audio: 'muted'`, porque el video mudo es el que
después se muxea.

## Bumpers de logo (FIX-e-burgos-001-003)

Con `timeline.bumpers.intro.enabled`, `TimelineComposition` mete **todo** el contenido (A-roll,
B-roll, audio, overlay de logo y captions) en una `<Sequence from={introFrames}>` y dibuja
`LogoBumperScene` en los primeros `introFrames`; el `outro` agrega otra placa después del
contenido. Ni el overlay de logo ni las captions se dibujan durante los bumpers. La duración de la
composición pasa a ser `timelineTotalFrames` — misma función para el render y para el `<Player>`.
Sin bumpers el árbol montado es exactamente el de antes.

La animación es pura y vive en `logoBumperLogoStyle`: el logo entra en los primeros 600 ms con
`fade`, `zoom` (escala desde 0.8) o `slide-up` (12 % de alto), y sale con fade en los últimos
300 ms; en un bumper corto la entrada se recorta para que la salida siempre entre.

## Normalización de la cama musical (spec-014)

`timelineToSequenceProps` deriva `normalizationGainDb` de `asset.audio.integratedLufs` y de
`audioMix.music.referenceLufs` con `musicNormalizationGainDb` de `timeline-core` — la **misma**
función que usa el grafo de ffmpeg de `media-local`, así que el preview y el master parten del
mismo número. `volumeAtFrame(automation, frame, offsetDb)` lo suma en dB antes de convertir a
volumen; el clamp a 1 de `gainDbToVolume` sigue aplicando, así que en el preview la cama nunca
pasa de fondo de escala (en el master ese techo lo pone el `alimiter` del bus).

**Por qué existe:** el pipeline real necesita un video **sin** audio para muxearle después la
mezcla masterizada de `mixTimelineAudio`/`muxAudioIntoVideo` (`libs/media-local`). Si Remotion
renderizara su propia mezcla en vivo y encima se le muxeara la masterizada, el entregable saldría
con el audio **duplicado** — la voz y la música sonando dos veces, una sin `loudnorm` y otra con.
`audio: 'muted'` es lo que usa ese pipeline; el `<Player>`/`remotion studio` siguen usando el
default (`'mix'`) porque ahí no hay masterización que muxear después.

## Procedimiento encadenado: render mudo → mix → verify → mux → verify

Visto desde esta lib, el primer paso de la cadena que documenta `libs/media-local/README.md`:

1. **Esta lib**, manual: `renderTimeline(timeline, { outPath, audio: 'muted' })` → video sin audio.
2. `mixTimelineAudio` (`media-local`) → WAV intermedio masterizado.
3. `verifyMixLoudness` (`media-local`) sobre el WAV — control temprano.
4. `muxAudioIntoVideo` (`media-local`) → entregable final (el video mudo del paso 1 + el WAV
   masterizado, `-c:v copy`).
5. `verifyMixLoudness` (`media-local`) sobre el **entregable**.

**`render → mix → mux` en una sola llamada no vive en ninguna de las dos libs.** Los boundaries Nx
(`composition-remotion` es `type:ui`, `media-local` es `type:util`; ninguna puede depender de la
otra) y `eslint.config.mjs` raíz protegido lo impiden. Es entrada obligatoria de
`spec-e-burgos-005`, en `apps/render-api` (`type:app`, que sí puede depender de las dos).

**`gainDbToVolume` está duplicada a propósito** entre `src/helpers/audio-gain.ts` (esta lib) y
`libs/media-local/src/mix/gain-db-to-volume.ts`, por el mismo motivo de boundaries. La tabla de
`architect.md` §7.2 de `cycle-01` de esta spec es el contrato entre las dos copias y
`gain-automation-curve.parity.spec.ts` la verifica contra `planDucking` real. **Tocar una de las
dos copias sin la otra rompe CA-002** y hace que el master deje de sonar como el preview.

**La paridad con el preview es de la curva de ducking de la música, no del nivel absoluto de la
voz.** El `<Player>`/preview no aplica `loudnorm` (solo la automatización de ganancia de la
música); el master de `mixTimelineAudio` sí. Lo que tiene que sonar igual entre preview y master es
cómo sube y baja la música alrededor de la voz, no el nivel LUFS final de la voz.

## Kinetic captions: presets y safe zones (cycle-01)

`captionPreset(id)` resuelve uno de cuatro looks ya calibrados. Ninguno declara un píxel: todo está
en `em` (tipografía) o en fracción del formato (layout) — ver `architect.md` §3 de
`spec-e-burgos-003-kinetic-captions/cycles/cycle-01` para el detalle campo por campo.

| Preset | Caso de uso | Rasgo distintivo |
| --- | --- | --- |
| `bold-impact` | Hook / gancho, texto grande al centro | Mayúsculas, 800/900, contorno fino, ámbar en el impacto |
| `clean-sans` | Explicativo, subtítulo legible sin ruido visual | Sin contorno, caja mixta, anclado abajo, verde en el impacto |
| `outline-pop` | Máximo contraste sobre metraje ruidoso | Contorno grueso + `paintOrder`, tres colores saturados |
| `subtle-lower` | Subtítulo clásico de cine: tutorial, explicación, manual | Sans-serif blanco con contorno fino oscuro y sombra suave, **sin píldora, sin realce y sin animación por palabra**, caja inferior de hasta dos líneas |
| `brand` | Video de un proyecto con marca | Tipografía y colores de `timeline.captionTheme` (texto, acento en el impacto, píldora con el fondo de la marca); `BrandCaptionFonts` carga los archivos de fuente con `delayRender` desde `work/brand/fonts/` y el estilo exige `captionTheme` en el documento |

`subtle-lower` es el único preset que no es cinético (FIX-e-burgos-003-004): `emphasisColor` y
`activeColor` valen lo mismo que `color`, `emphasisFontWeight` lo mismo que `fontWeight` y ambas
escalas valen `1`, así que `captionWordStyle` devuelve el mismo estilo para los cuatro estados de
palabra. Los invariantes de realce de los tests aplican a los tres presets cinéticos.

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
`CaptionPreset.maxLines` dice en cuántas líneas puede envolver la frase: el ajuste reparte el ancho
disponible entre esas líneas y limita el alto a `maxLines * lineHeightEm`. Los tres presets cinéticos
declaran `maxLines: 1` —con ese valor la fórmula es la de siempre, término a término— y
`subtle-lower` declara `2`.
`captionWordStyle(preset, { isEmphasis, isActive })` da el `CSSProperties` de una palabra — sin
`fontSize`: lo pone el contenedor del clip una sola vez por frase (`cycle-02`).

## Kinetic captions: animación, palabra activa y `boxSource` (cycle-02)

`<KineticCaptions />` reemplaza a `CaptionTrack` (dado de baja, ver más abajo) dentro de
`TimelineComposition`. Monta una `<Sequence>` por clip con el `from`/`durationInFrames` exactos del
plan; toda la lógica vive en tres helpers nuevos, el componente es cableado sin decisiones:

- **`captionClipAnimation({ frame, durationInFrames, fps, preset })`** anima la entrada y la salida
  del bloque completo con `spring()`/`interpolate()` de Remotion, según el campo `animation` que
  cada preset declara ahora (`CaptionPreset.animation`, requerido). Tres modos:
  - `pop` (`bold-impact`, `outline-pop`): entra con rebote de escala.
  - `rise` (`clean-sans`): entra subiendo desde abajo (`translateY` en `em`).
  - `fade` (`subtle-lower`): solo anima opacidad, sin rebote (sobreamortiguado).
  La curva de presencia es simétrica en entrada y salida; un clip de 1-3 frames degrada a
  opacidad casi nula de forma determinista (no es un bug).
- **`activeWordIndex(frame, words)`** / **`captionWordRenders(frame, words, emphasisIndex)`**
  resuelven qué palabra suena en cada frame (rango semiabierto `[fromFrame, fromFrame +
  durationFrames)`, `-1` si ninguna) y arman el estado de cada palabra para `captionWordStyle`. La
  palabra de `emphasisIndex` mantiene el estilo de impacto durante **todo** el clip, sea o no la
  activa en ese frame.
- **`captionClipPlan({ clips, format, preset, safeZone?, platform?, anchor?, boxSource? })`**
  resuelve la caja y el `fontSize` de cada clip. `boxSource` decide la precedencia entre el preset y
  `clip.box`:
  - `'preset'` (**default**): siempre la caja calculada por `captionBoxFor` + `captionSafeZone` +
    el preset; `clip.box` se ignora. Es lo que usa `TimelineComposition`.
  - `'clip'`: `clip.box ?? presetBox` — el comportamiento histórico, para una `Timeline` con cajas
    puestas a mano. **Importante:** `buildTimeline` de `timeline-core` siempre rellena
    `CaptionClip.box` con un rectángulo genérico (el mismo para todos los clips); si `boxSource` se
    dejara en `'clip'` por error, el safe zone de plataforma, el `anchor` y el alto del preset
    quedarían sin efecto visual aunque sus tests pasen.

`TimelineComposition` acepta `captionPreset?`, `captionPlatform?` y `captionAnchor?` (los tres
opcionales, reenviados tal cual a `KineticCaptions`) y usa siempre `boxSource: 'preset'` — no lo
expone como prop.

### Galería de presets en `remotion studio`

`CaptionPresetGallery` (no exportada del barrel: es una herramienta de inspección visual, no
superficie de producción) registra una tercera composición, `CaptionPresetGallery`, con los cuatro
presets lado a lado sobre la misma frase de ejemplo — ver la sección de `remotion studio` más abajo
para cómo abrirla. `nx build`/`nx lint` sí la typechequean y lintean; no tiene spec propio ni cuenta
para cobertura (la lógica que usa ya está cubierta por los helpers).

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

o, equivalentemente, `pnpm nx run composition-remotion:studio` desde la raíz del repo. Lista tres
composiciones:

- `TimelineComposition` (9:16, 1080×1920@30) y `TimelineCompositionLandscape` (16:9, 1920×1080@30),
  ambas sobre la Timeline de ejemplo.
- `CaptionPresetGallery` (4320×1920@30, cuatro paneles de 1080×1920 lado a lado — Remotion hace
  zoom-to-fit solo): compara los cuatro presets de kinetic captions animando la misma frase de
  ejemplo, sin renderizar ningún video. Es la forma de mirar `bold-impact`/`clean-sans`/
  `outline-pop`/`subtle-lower` uno al lado del otro antes de elegir cuál usar.

Abrir el studio no genera ningún MP4 ni descarga nada además de lo ya instalado — sí puede
descargar Chrome Headless Shell la primera vez que Remotion necesita previsualizar un frame, igual
que el smoke de abajo.

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
   El target resuelve tres causas encadenadas (FIX-e-burgos-001-001):
   - `SWC_NODE_PROJECT=./tsconfig.smoke.json` (ver `project.json`): ese tsconfig extiende
     `tsconfig.lib.json` con `baseUrl` apuntando a la raíz del workspace, para que
     `@swc-node/register` resuelva los alias `@video-maker/*` igual que `tsc` — sin esto,
     `@swc-node/register` toma `libs/composition-remotion` como `baseUrl` y reescribe cada
     `@video-maker/*` a una ruta que no existe.
   - `-r ./src/smoke-register.cjs` en vez de `-r @swc-node/register` directo: `@swc-node/register`
     registra un loader para `.js` además de `.ts`/`.tsx`, y ese loader intercepta *cualquier*
     `require()` del proceso — incluido el build hook que la extensión Console Ninja de VSCode
     inyecta en `Module._extensions['.js']`. Compilar ese `.js` de terceros con swc lo hace
     panicar (`miette`, "Formatting argument out of range") apenas arranca el bundler de Remotion.
     `smoke-register.cjs` carga `@swc-node/register` y de inmediato le devuelve a Node su loader
     nativo de `.js`, dejando swc acotado a TypeScript — que es todo lo que esta lib tiene. Lección
     general: cualquier target `nx:run-commands` que combine `@swc-node/register` con un bundler
     debe acotar el registro a `.ts`/`.tsx`, nunca dejarlo interceptar `.js`.
   - `src/render.ts` aplica `withWorkspaceAliases` en el `webpackOverride` de `bundleProject`: el
     webpack que arma `@remotion/bundler` no conoce los `paths` del workspace por sí solo (su
     `getResolveConfig()` solo remapea React/Remotion), así que sin este alias explícito
     `@video-maker/timeline-core` no resuelve dentro del bundle. Lección general: un alias de
     workspace hay que declararlo en **cada** resolvedor del stack (`tsconfig`, Vite, y acá el
     webpack de Remotion) — no alcanza con `tsconfig.base.json`.
   La primera corrida descarga Chrome Headless Shell (nunca pasa en CI: ningún target
   automatizado llama a `renderMedia`). Si el binario no puede descargarse, el error de Remotion lo
   nombra tal cual (CE-7); la lib no intenta instalarlo por su cuenta.
4. Verificar el resultado impreso por consola y el archivo generado:
   - `out/example-9x16.mp4` existe.
   - `renderTimeline` devuelve `{ width: 1080, height: 1920, fps: 30, durationInFrames: 265 }`.
   - `ffprobe -show_streams out/example-9x16.mp4` confirma 1080×1920 @ 30 fps y ~8,83 s (265 frames).
5. Límite de concurrencia del ejemplo: **4** (`DEFAULT_RENDER_CONCURRENCY`, CA-16) — nunca "lo que
   la CPU permita".

## `OffthreadVideo` vs `Video` — componente conmutable (resuelto en `spec-006` cycle-02)

`ArollSeries` y `BrollTrack` ya no montan `<OffthreadVideo>` directamente: montan `TimelineVideo`,
que elige el componente según el **backend de video** declarado por contexto.

```tsx
import { TimelineComposition, VideoBackendProvider } from '@video-maker/composition-remotion';

// en un <Player> del navegador
<VideoBackendProvider backend="player">
  <TimelineComposition timeline={timeline} />
</VideoBackendProvider>
```

- **El default es `'render'` y no hay que declararlo nunca en el camino del render.** Sin proveedor,
  `TimelineVideo` monta `<OffthreadVideo>` con exactamente los props de antes
  (`src`, `trimBefore`, `muted`, `style`). Verificado byte a byte: un job real de `render-api` sobre
  `media/smoke-ingest` después del cambio reprodujo el `sha256` de la línea base
  (`video-muted.mp4` `c1b9fd9f…`, `out/<job>.mp4` `4bfe9f7b…`).
- **Se eligió un contexto explícito y no `getRemotionEnvironment().isRendering`.** Esa función se
  apoya en globals internos (`window.process.env.NODE_ENV`, `window.remotion_puppeteerTimeout`) que
  no son contrato y no se pueden simular en jsdom sin falsificarlos; además `OffthreadVideo` ya hace
  ese branch por dentro. Declarar el backend deja el árbol del render idéntico por construcción y
  testeable sin globals.
- **Ningún contrato público cambió**: `renderTimeline`, `RenderTimelineOptions`,
  `RenderTimelineError`, `TimelineAudioMode` y `TimelineCompositionProps` son los de antes. Los
  exports nuevos del barrel (`TimelineVideo`, `VideoBackendProvider`, `useVideoBackend`,
  `DEFAULT_VIDEO_BACKEND`, tipos `VideoBackend` / `VideoBackendProviderProps`) son aditivos.

### El audio del Player no es el del entregable

Dentro de un `<Player>`, `TimelineComposition` monta `AudioTrack` (modo `mix`, el default): se
escucha la voz al `gainDb` de cada clip y la música por la curva de `audioMix.automation`. **El
`loudnorm` a -14 LUFS no existe en el navegador** — vive en `libs/media-local` y sólo corre en el
pipeline del entregable. La paridad prometida es la curva de ducking, no el nivel absoluto de voz.

### Framing — D-12 (`spec-006` cycle-03): the Player now matches the render, it does not fix it

*(Note: this subsection is in English per the cycle-03 orchestrator's explicit instruction — every
other section of this README stays in Spanish, its established language; do not take this as
license to translate the rest of the file.)*

Measured in `spec-006` cycle-02: in the browser the `<video>` stayed `object-fit: contain` on the
canvas (letterboxed when a clip's aspect ratio didn't match the composition), while **the render
fills the frame**. The switchable component wasn't the cause — forcing the `render` backend inside
the same Player produced the same letterbox.

`cycle-03` (D-12) closed that discrepancy **on the Player side only**:

```diff
+const PLAYER_MEDIA_STYLE: CSSProperties = { objectFit: 'fill' };
+
 export const TimelineVideo: FC<TimelineVideoProps> = ({ src, trimBefore, style }) => {
   const backend = useVideoBackend();
   if (backend === 'player') {
-    return <Video src={src} trimBefore={trimBefore} muted style={style} />;
+    return <Video src={src} trimBefore={trimBefore} muted style={{ ...PLAYER_MEDIA_STYLE, ...style }} />;
   }
   return <OffthreadVideo src={src} trimBefore={trimBefore} muted style={style} />;
 };
```

`PLAYER_MEDIA_STYLE` is the default and the caller's `style` overrides it (`cover`/`contain` are
still available per clip); **the `render` branch is untouched, byte for byte** — verified with
`git diff` (+3/-1, the single `render`-branch line unchanged) and by reproducing the `sha256` from
`render-non-regression.md` against unedited `media/smoke-ingest` (`c1b9fd9f…`, identical to the
cycle-02 baseline, TASK-028 of cycle-03).

**This is NOT "fixing the framing" — it is making the Player stop lying about what the render is
going to do.** The render **fills the frame by stretching** a clip whose aspect ratio doesn't match
the output (`object-fit: fill`, anamorphic: the image is distorted, never cropped or letterboxed).
That stretch is, strictly speaking, **the behavior that is wrong** — a `cover` with centered
cropping would be correct for most assets — but fixing it changes the render's output (measured in
cycle-02: `video-muted.mp4` went from `c1b9fd9f…` to `2ed415d8…` when the Player was aligned to its
own `cover`), and is a spec decision, not a tweak to this component. **It was deliberately left out
of `cycle-03`'s scope** — D-12 only asked for the Player to stop hiding the problem behind a
letterbox the render never had, so whoever edits the timeline sees in the preview exactly what
they're going to get. The real fix (`cover` with cropping? a real letterbox in the render, changing
the `format` contract?) is a pending `[FIX]` — **do not "fix" it after reading only the diff above
without reading this paragraph first**: the `fill` default is intentional and documented, not an
oversight.

## `file://` para assets absolutos (no verificado en este ciclo)

El camino soportado y ejercitado por el smoke es **relativo + `staticFile()`** (assets dentro de
`public/example/`). `assetSrc` también resuelve rutas absolutas a `file://`, para que
`spec-005`/`tools/render-cli` puedan renderizar el metraje real del creador sin copiar gigabytes a
`public/` — esa rama no está verificada acá: si Chrome bloqueara sub-recursos `file://` durante el
render, el fallback es pasar `publicDir` (opción de `RenderTimelineOptions`) apuntando al directorio
real de assets y usar rutas relativas en la `Timeline`.
