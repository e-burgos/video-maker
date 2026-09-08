# SPEC-e-burgos-003: Kinetic Captions & Safe Zones

> Estado: **in-progress** — el sdd-orchestrator la pasó a `in-progress` al abrir `cycle-01` (2026-09-07).

## Resumen Ejecutivo

Componente de kinetic typography para Remotion sobre `libs/composition-remotion`: 1 a 3 palabras por
pantalla con resaltado de la palabra de impacto y de la palabra activa, animaciones de entrada/salida
con `spring`, presets tipográficos y de color, y posicionamiento dentro de safe zones específicas por
plataforma (Instagram Reels, TikTok, YouTube Shorts, YouTube landscape). Reemplaza el `CaptionTrack`
mínimo que dejó `spec-e-burgos-001` en `cycle-03`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

El agrupado de palabras (1-3 por pantalla, elección de la palabra de impacto) ya lo entrega
`timeline-core` vía `groupWordsForCaptions` / `pickEmphasisIndex`, y viaja en la `Timeline` como
`tracks.captions[]` (`CaptionClip`: `words[{text, fromFrame, durationFrames}]`, `emphasisIndex?`,
`box?`). **Esta spec entrega exclusivamente la capa visual**: cómo se ven, dónde se ubican y cómo se
animan esas palabras.

**Alcance previsto (del desglose inicial):** `<KineticCaptions />` sobre `tracks.captions`, estilos de
énfasis (escala, color, fondo), presets por caso de uso, fuentes locales empaquetadas,
previsualización en `remotion studio`.

## Evidencia y decisiones

> No existe `harness.idea.md` en este repo (verificado 2026-09-07): la evidencia disponible es la
> cadena de specs y el contexto de la lib. Lo que sigue son **decisiones tomadas por el orquestador**
> al detallar esta spec, por delegación explícita del dev — no fueron aprobadas una por una.

- **Evidencia:** `spec-e-burgos-001` §"Fuera de alcance" (línea 91) delimita que aquella spec entrega
  el _agrupado_ de palabras y esta el _componente visual_.
- **Evidencia:** `libs/timeline-core/src/schemas/timeline.schema.ts` — `CaptionClipSchema` ya acota
  `words` a `min(1).max(3)` y transporta `emphasisIndex` y `box` opcionales. El contrato de datos que
  esta spec necesita **ya existe y está cerrado**.
- **Evidencia:** `libs/timeline-core/src/format/format.ts` — `DEFAULT_SAFE_ZONES` asigna la **misma**
  zona portrait `{top:220,bottom:400,left:60,right:140}` a `reels-9x16`, `tiktok-9x16` y
  `shorts-9x16`. El chrome real de las tres apps no es el mismo.
- **Evidencia:** `sdd/context/libs/composition-remotion/updates/2026-09-07-*-cycle-03.md` — la lib
  corre su suite sin Chrome ni ffmpeg y su `eslint.config.mjs` prohíbe `Date`, `process` y
  `Math.random` en el barrel; cobertura heredada 94% stmts / 87.87% ramas sobre `helpers/**` +
  `transitions/**` con umbral 80%.

### Decisiones del orquestador (inventadas — 2026-09-07)

- **D-A — El contrato `Timeline` no se toca.** Todo lo tipográfico y de animación entra como **props
  de componente con defaults**, nunca como campos nuevos de la `Timeline`. Razón doble: el `apps` de
  esta spec es solo `libs/composition-remotion` y `timeline-core` pertenece a una spec `completed`;
  y un preset visual no es una decisión de edición — meterlo en la `Timeline` acoplaría el motor a un
  look concreto y obligaría a versionar el schema por cada estilo nuevo.
- **D-B — Safe zones por plataforma, aditivas sobre las de la `Timeline`.** La lib expone
  `captionSafeZone(format, platform?)`, que parte del `safeZone` de la `Timeline` (o de `safeZoneFor`)
  y le **suma** insets de chrome por plataforma; nunca los reduce. Sin plataforma es la identidad.
  Razón: no duplica ni contradice el contrato de `timeline-core` y degrada a lo actual.
- **D-C — Fuentes: stacks del sistema + opt-in local, cero binarios en el repo.** Se descarta
  `@remotion/google-fonts` (descarga en build → rompe el "cero red" de la suite y del CI) y se
  descarta commitear `.ttf`/`.woff2` (peso del repo y licencias). Cada preset declara `fontFamily`
  como stack CSS terminado en genérico; el README documenta cómo colgar una fuente propia en
  `public/fonts/` (directorio ya gitignoreado) inyectándola con `captionFontFaceCss()`.
  Esto **reinterpreta** "fuentes locales empaquetadas" del alcance previsto: se entrega el mecanismo
  para fuentes locales, no las fuentes.
- **D-D — `KineticCaptions` reemplaza a `CaptionTrack`, sin alias deprecado.** No hay consumidores
  externos (`apps/web` todavía no existe). Se elimina `CaptionTrack` del barrel y
  `TimelineComposition` monta el componente nuevo.
- **D-E — Dos ciclos.** `cycle-01` = helpers puros, presets y safe zones; `cycle-02` = componente,
  animación, studio y smoke. Razón: el umbral de cobertura de la lib mide `helpers/**` y
  `transitions/**`; concentrar la lógica en helpers puros mantiene la cobertura alta y deja al
  componente como cableado fino y verificable por sus helpers.
- **D-F — Animación pura y determinista.** La lógica de animación vive en `helpers/` como funciones
  `(frame, …) → CSSProperties`, apoyadas en `spring()` e `interpolate()` de `remotion` (funciones
  puras, no hooks). El componente solo llama `useCurrentFrame()` / `useVideoConfig()` y delega.

## Requisitos Funcionales (RF)

### Ciclo 01 — Safe zones, presets y layout tipográfico

- **RF-1 — Registro de presets tipográficos.** `CAPTION_PRESETS` expone al menos cuatro presets
  nombrados por caso de uso (`bold-impact`, `clean-sans`, `outline-pop`, `subtle-lower`). Cada preset
  declara: stack `fontFamily`, pesos normal y de énfasis, colores de texto/énfasis, contorno
  (`stroke`), fondo tipo píldora opcional, `textTransform`, `letterSpacing`, anclaje vertical,
  fracción de alto de caja y límites `minFontSize`/`maxFontSize` relativos al alto del formato.
- **RF-2 — Safe zones por plataforma.** `captionSafeZone(format, platform?)` con
  `platform ∈ {instagram-reels, tiktok, youtube-shorts, youtube-landscape}` suma insets de chrome de
  cada app al safe zone base, y sin `platform` devuelve el safe zone base sin tocar.
- **RF-3 — Caja de captions con anclaje.** `captionBoxFor(safeZone, format, anchor)` con
  `anchor ∈ {top, center, bottom}` devuelve la caja donde se dibujan las palabras, siempre contenida
  en el safe zone.
- **RF-4 — Ajuste de tamaño de fuente.** `fitCaptionFontSize(words, box, preset, format)` calcula un
  tamaño que hace entrar 1-3 palabras en el ancho de la caja mediante una estimación determinista de
  ancho por carácter (sin medir el DOM), acotado por `minFontSize`/`maxFontSize` del preset.
- **RF-5 — Estilos por palabra.** `captionWordStyle(preset, { isEmphasis, isActive })` devuelve los
  `CSSProperties` de una palabra distinguiendo palabra normal, palabra de impacto (`emphasisIndex`) y
  palabra activa en el frame.

### Ciclo 02 — Componente animado y previsualización

- **RF-6 — Animación de entrada/salida por clip.** `captionClipAnimation({ frame, durationInFrames,
fps, preset })` devuelve opacidad y transform del bloque de palabras: entrada con `spring`
  (`pop` = escala + opacidad, `rise` = desplazamiento vertical + opacidad, `fade` = solo opacidad,
  según el preset) y salida simétrica en los últimos frames del clip.
- **RF-7 — Resaltado progresivo por palabra.** `activeWordIndex(frame, words)` resuelve qué palabra
  está sonando según `word.fromFrame` / `word.durationFrames`, y esa palabra recibe el estilo activo.
  La palabra de `emphasisIndex` mantiene su estilo de impacto durante todo el clip.
- **RF-8 — `<KineticCaptions />`.** Componente que consume `readonly CaptionSequenceProps[]` más
  `preset`, `platform` y `anchor` opcionales, monta una `Sequence` por clip con el `from` /
  `durationInFrames` exactos del plan, y reemplaza a `CaptionTrack` dentro de `TimelineComposition`.
- **RF-9 — Previsualización.** `Root.tsx` expone una composición de galería que recorre los presets
  para inspección visual en `remotion studio`, y `TimelineComposition` acepta el preset por props de
  entrada. `studio` y `smoke` siguen fuera de `lint test build`.

## Requisitos No-Funcionales (RNF)

- **RNF-1 — Cero red y cero render en la suite.** Ningún test descarga Chrome Headless Shell, ejecuta
  ffmpeg ni monta un render de video. Los helpers se prueban como funciones puras.
- **RNF-2 — Cobertura.** Se mantiene el umbral 80% de `vite.config.ts` sobre `src/helpers/**` +
  `src/transitions/**` y **no se baja el piso heredado**: ≥ 90% statements y ≥ 85% branches al cerrar
  cada ciclo (partida: 94% / 87.87%, 69 tests).
- **RNF-3 — Estilo de código.** Cero comentarios narrativos, cero `any`, cero `Date` / `process` /
  `Math.random` en el barrel; identificadores en inglés; componentes sin estado ni efectos.
- **RNF-4 — Frontera de specs.** No se modifica `libs/timeline-core` ni ningún otro subproyecto: el
  cambio queda confinado a `libs/composition-remotion` (+ su fila en las tablas globales de SDD).
- **RNF-5 — Sin binarios.** No se commitea ningún archivo de fuente tipográfica.

## Dependencias

- Subproyectos: `libs/composition-remotion`
- `spec-e-burgos-001-core-composition-media-pipeline` (**completed**) — contrato `Timeline`,
  `CaptionClip`, `safeZoneFor`, `timelineToSequenceProps`, `CaptionSequenceProps`.

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** `captionSafeZone(defaultFormat('tiktok-9x16'), 'tiktok')` devuelve márgenes mayores o
  iguales a `safeZoneFor(format)` en los cuatro lados, y `captionSafeZone(format)` sin plataforma es
  exactamente `safeZoneFor(format)`.
- **CA-002:** para los tres presets 9:16 la caja resultante queda dentro de 1080×1920
  (`x ≥ 0`, `y ≥ 0`, `x + width ≤ 1080`, `y + height ≤ 1920`) y el inset derecho de `tiktok` reserva
  al menos 150 px para su columna de acciones.
- **CA-003:** `captionBoxFor` con `anchor` `top`, `center` y `bottom` produce tres cajas distintas,
  todas contenidas en el safe zone, con el alto que declara el preset.
- **CA-004:** `CAPTION_PRESETS` tiene al menos cuatro entradas; toda `fontFamily` termina en un
  genérico CSS (`sans-serif` o `serif`); ningún preset produce estilos idénticos para palabra normal
  y palabra de impacto.
- **CA-005:** `fitCaptionFontSize` con tres palabras largas devuelve un tamaño estrictamente menor que
  con una palabra corta, nunca sale de `[minFontSize, maxFontSize]` del preset y devuelve el mismo
  valor ante la misma entrada.

### Ciclo 02

- **CA-006:** `captionClipAnimation` en el frame 0 del clip da `opacity < 1` (y, para `pop`,
  `scale < 1`), pasada la duración de entrada da `opacity === 1` y `scale === 1`, y vuelve a bajar en
  los últimos frames. Dos llamadas con el mismo frame dan el mismo resultado.
- **CA-007:** `activeWordIndex(frame, words)` devuelve el índice de la palabra cuyo rango
  `[fromFrame, fromFrame + durationFrames)` contiene el frame, y `-1` si ninguno lo contiene.
- **CA-008:** la palabra en `emphasisIndex` recibe los estilos de impacto del preset en **todo** el
  clip, sea o no la palabra activa en ese frame.
- **CA-009:** `<KineticCaptions />` monta una `Sequence` por clip con el `from` y el
  `durationInFrames` exactos del `CaptionSequenceProps`, y `TimelineComposition` ya no referencia
  `CaptionTrack` (que deja de existir en el barrel).
- **CA-010:** `Root.tsx` registra una composición de galería de presets; los targets `studio` y
  `smoke` siguen fuera de `lint`, `test` y `build`.
- **CA-011:** `nx run-many -t lint test build` en verde sobre los cinco proyectos, `pnpm sdd:validate`
  OK, y la cobertura de `composition-remotion` cumple el piso de RNF-2.
