# SPEC-e-burgos-014: Production Quality: Música Audible, Captions Fieles y Logo

> Estado: **in-progress** — registrada el 2026-09-10 a partir del feedback del dev sobre el
> primer video real producido con la skill `video-producer` (`media/demo-01`, publicidad de una
> óptica). Un solo ciclo, flow `lite`.

## Resumen Ejecutivo

El motor ya produce un MP4 de punta a punta, pero el primer video **entregado a un cliente real**
mostró tres defectos de calidad de producción que ninguna suite verde detectaba: la música es
inaudible, las captions dicen palabras que la voz no dice, y no hay forma de poner el logo de la
marca. Los tres son de terminación —no de arquitectura— y los tres se arreglan en el motor, no en
el proyecto de medios.

Esta spec cierra esa brecha: **cama musical normalizada** a una referencia de loudness antes de
aplicar las ganancias del preset, **captions alineadas al guion** que el productor ya escribió, y
**capa de logo** en la Timeline con default en el margen inferior derecho.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

El consumidor de estas tres mejoras es la skill `sdd/skills/video-producer/SKILL.md`: el productor
conversacional que arma el video con las herramientas del repo. Cada mejora se expone en la CLI y
en el job `montage` de `render-api` para que el productor pueda usarla sin tocar código.

## Evidencia y decisiones

### Evidencia — feedback literal del dev (2026-09-10) sobre `media/demo-01`

1. > "La música no se escucha."
2. > "Hay palabras que dice la voz y en el subtítulo se muestran otras."
3. > "La ubicación del logo por defecto tiene que ser en el margen inferior derecho."

### Evidencia medida (antes del ciclo)

- **Música inaudible.** `ffmpeg -af ebur128` sobre `media/demo-01/raw/audio/music01.mp3` mide
  **-22,3 LUFS** integrados (true peak -0,8 dBFS); la ventana de 25,9 s que usa el edit mide
  **-23,5 LUFS**. El mix (`libs/media-local`: `mixTimelineAudio` → `build-audio-mix-graph` →
  `build-music-bed-chain`) **no normaliza la pista antes** de aplicar `baseGainDb`/`duckedGainDb`.
  Con la voz continua tras la poda de silencios, la automation de `media/demo-01/work/timeline.json`
  tiene 4 keyframes y queda en `duckedGainDb` (-24 dB) desde el frame 2 hasta el final: la música
  suena a ≈ **-46 LUFS** bajo una voz de **-15,5 LUFS**. 30 dB de diferencia: inaudible.
- **Captions infieles.** El guion real está en `media/demo-01/work/producer/script.txt`. Whisper
  oyó mal 4 de las 74 palabras que llegan a las captions: `dice→hice`, `calma→kanma`,
  `necesitás→necesitas`, `Vení→Ven y` (además de un `de` insertado en "formas y estilo"). El motor
  no tiene ninguna forma de usar el guion que el productor ya escribió.
- **Sin logo.** El logo del cliente está en `media/demo-01/raw/logo/Logo-ancho-transparente.png`
  (PNG RGBA 1200×240) y el ingest lo ignora con `unknown-directory`: no hay rol `logo`, no hay
  capa de logo en la `Timeline` ni componente que la dibuje.

### Decisiones tomadas al abrir

- **D-1 — La medición de la música vive en el catálogo, no en el mix.** El campo
  `MediaAsset.audio.integratedLufs` ya existe en el schema y estaba sin usar. El ingest lo llena
  para los assets de rol `audio`, y **los dos renderers** (el grafo FFmpeg y el `<Audio>` de
  Remotion) derivan de él la misma ganancia de normalización. Medir en el mix habría arreglado
  sólo el camino de `render-api`: el MP4 que entregó la CLI (`render-cli run`) lleva el audio que
  Remotion renderiza, no el mix de FFmpeg.
- **D-2 — Referencia -16 LUFS, aplicada como `volume=NdB`,** no como una segunda pasada de
  `loudnorm`: es una ganancia lineal invariante en el tiempo, determinista, testeable como string
  puro y sin el resampleo a 192 kHz que introduce `loudnorm`.
- **D-3 — El logo es un campo opcional en la raíz de la `Timeline`** (`timeline.logo`), no una
  sexta pista: la web lo prende y lo apaga con un check, y presencia/ausencia de un único campo es
  el contrato más simple para eso.
- **D-4 — `apps/web` no se toca en este ciclo.** El check del logo y el selector de guion llegan
  con la pantalla del chat.

## Plan de ciclos

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `production-quality` | `lite` | Las tres mejoras completas, con la publicidad de `media/demo-01` como aceptación medida. |

## Requisitos Funcionales (RF)

- **RF-1:** El ingest mide el loudness integrado de cada asset de rol `audio` y lo persiste en el
  catálogo.
- **RF-2:** La cama musical se lleva a una referencia de loudness **antes** de aplicar las
  ganancias del preset, tanto en el grafo del mix de FFmpeg como en la composición Remotion.
- **RF-3:** Los presets fijan niveles de publicidad: `hardware` -4 / -12 dB;
  `software-demo`, `educational` y `recipe` -8 / -18 dB. Los niveles del preset llegan a la
  `Timeline` (hoy `buildTimeline` los ignoraba y usaba `DEFAULT_MUSIC_MIX`).
- **RF-4:** `alignTranscriptToScript(words, scriptText)` reemplaza el texto de las palabras mal
  oídas por el del guion conservando los tiempos de Whisper, elimina las que Whisper inventó y
  reparte las que omitió.
- **RF-5:** El guion se pasa por `--script <ruta>` en `render-cli` (`plan` y `run`) y por
  `scriptPath` / `scriptText` en el job `montage` de `render-api`. La CLI reporta cuántas palabras
  corrigió.
- **RF-6:** La `Timeline` acepta una capa de logo opcional con `assetId`, `position`
  (default `bottom-right`), `widthRatio`, `marginRatio` y `opacity`, validada y con su JSON Schema.
- **RF-7:** El ingest reconoce el rol `logo` en `raw/logo/` (png/jpg/webp) y `autoMontage` lo
  incorpora a la Timeline si el proyecto tiene uno (`logo: 'auto' | 'off'`, CLI `--no-logo`).
- **RF-8:** La composición Remotion dibuja el logo en el `<Player>` y en el render.

## Requisitos No-Funcionales (RNF)

- **RNF-1:** Cero dependencias npm nuevas.
- **RNF-2:** La suite corre sin binarios reales.
- **RNF-3:** `lint test build` en verde; coberturas por encima del piso sin recortar
  `coverage.include`.
- **RNF-4:** Sin comentarios en el código; identificadores, payloads y README en inglés.
- **RNF-5:** El render de un proyecto sin logo no cambia un byte del video mudo.

## Dependencias

- Subproyectos: `libs/media-local`, `libs/auto-montage`, `libs/timeline-core`,
  `libs/composition-remotion`, `tools/render-cli`, `apps/render-api`.
- `spec-e-burgos-002-auto-montage-pipeline` — completed (ingest, presets, `autoMontage`).
- `spec-e-burgos-003-kinetic-captions` — completed (las captions que se corrigen).
- `spec-e-burgos-004-audio-mix-mastering` — completed (el grafo del mix que se normaliza).
- `spec-e-burgos-007-web-montage` — completed (el job `montage` que gana los parámetros).

## Criterios de Aceptación (CA)

- **CA-001:** Re-render de `media/demo-01` con el preset `hardware`: el bed de música aislado,
  medido con `ebur128` a través del mismo grafo del mix con la pista de voz vacía, cae entre
  **-26 y -30 LUFS** integrados, con la voz en **-15 ± 1 LUFS**.
- **CA-002:** La voz del mix completo sigue dentro de la tolerancia de `verifyMixLoudness`.
- **CA-003:** Re-plan de `media/demo-01` con `--script media/demo-01/work/producer/script.txt`:
  **todas** las palabras de las captions pertenecen al guion (`dice`, `calma`, `necesitás`,
  `Vení`), **0** palabras ajenas, y los conceptos se siguen detectando.
- **CA-004:** Re-render de `media/demo-01`: los frames a 5 s y 20 s muestran el logo abajo a la
  derecha, dentro del cuadro y sin pisar las captions.
- **CA-005:** El render de `media/smoke-ingest` (sin logo) produce un `video-muted.mp4`
  byte-idéntico al oráculo `sha256 c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb`.
- **CA-006:** Tests unitarios cubren la ganancia de normalización, la paridad de los niveles del
  preset, el alineador contra el guion (sustitución, inserción, omisión) y la capa de logo.
