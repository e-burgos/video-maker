# FIX-e-burgos-001-003 — El video no puede abrir ni cerrar con una placa del logo sobre un fondo de color

| Campo         | Valor                                                  |
| ------------- | ------------------------------------------------------ |
| **ID**        | FIX-e-burgos-001-003                                   |
| **Tipo**      | IMPROVEMENT                                            |
| **Severidad** | medium                                                 |
| **Keyword**   | [IMPROVEMENT]                                          |
| **Fecha**     | 2026-09-20                                             |
| **Autor**     | e-burgos                                               |
| **Estado**    | implemented                                            |
| **Spec**      | spec-e-burgos-001-core-composition-media-pipeline      |
| **Origen**    | Pedido del dev: "al iniciar y/o finalizar un video, una pantalla con un fondo de color y una transición del logo". |

## Problema

`timeline.logo` sólo dibuja el overlay en una esquina sobre el contenido. No hay forma de que el
video abra o cierre con una placa de marca a pantalla completa: ni el documento la puede expresar,
ni la composición la sabe dibujar, ni la mezcla de audio sabe correr la voz y la música para dejarle
lugar.

## Solución

### 1. Documento (`timeline-core`)

`timeline.bumpers?: { intro?: LogoBumper; outro?: LogoBumper }`, con
`LogoBumper = { enabled: boolean (default false); durationMs: number (500–6000, default 2000);
backgroundColor: hex #rrggbb (default '#ffffff'); animation: 'fade' | 'zoom' | 'slide-up'
(default 'zoom'); logoWidthRatio: number (0–1, default 0.4) }`. Usa `timeline.logo.assetId`: si no
hay logo el bumper es sólo el fondo de color, y `timelineWarnings` lo avisa con el código
`BUMPER_WITHOUT_LOGO` — **warning, no error**: `validateTimeline` no lo devuelve y ni el guardado ni
el render se bloquean.

`timelineTotalFrames(timeline) = introFrames + durationFrames + outroFrames` (pura, con
`introBumperFrames`/`outroBumperFrames`, `round(durationMs / 1000 * fps)`). **`durationFrames` sigue
significando el contenido**; el total lo calcula siempre esa función.

### 2. Composición (`composition-remotion`)

`LogoBumperScene` pinta el fondo de color a pantalla completa y el logo centrado: entra con la
animación elegida en los primeros 600 ms y sale con fade en los últimos 300 ms
(`logoBumperLogoStyle`, pura). Con bumpers activos, todo lo que había (A-roll, B-roll, voz, música,
captions y overlay de logo) queda dentro de una `<Sequence from={introFrames}>`, así que el overlay
y los captions no se dibujan sobre los bumpers. Sin bumpers el árbol es idéntico al de antes.
`computeTimelineMetadata` devuelve `timelineTotalFrames`, con lo que render y `<Player>` comparten
la duración total.

### 3. Audio (`media-local`)

`buildAudioMixGraph` corre voz, música y la automation de ducking `introFrames` hacia adelante
(`adelay` ya existente, fades y curva de automation incluidos) y lleva la duración de referencia al
total: el bed de música pad-ea con `apad=whole_dur=<total>` y la salida de `amix` gana
`apad=whole_dur=<total>` + `atrim=end=<total>` para que la mezcla dure lo mismo que el video mudo.
Sin bumpers el grafo emitido es el de antes, carácter por carácter.

### 4. Montaje (`auto-montage`)

Cuando `autoMontage` regenera `work/timeline.json` y ya había uno con `logo`/`bumpers` editados,
`preserveBrandDecisions` los conserva (el logo sólo si su asset sigue en la timeline nueva): las
decisiones de marca sobreviven al re-montaje. El job `montage` y la CLI no ganan parámetros.

## Justificación del bypass del SPEC GATE

Un único campo opcional y aditivo sobre un documento que ya existe, un componente de composición y
un offset en el grafo de mezcla. No crea endpoints ni entidades. Perfil `solo`, sin ciclo abierto
sobre spec-001.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`; frames y mediciones en `fixes/artifacts/`.
