# FIX-e-burgos-006-001 — La biblioteca esconde lo generado, el estilo de subtítulos no se elige y el logo ocupa un tercio del cuadro

| Campo         | Valor                     |
| ------------- | ------------------------- |
| **ID**        | FIX-e-burgos-006-001      |
| **Tipo**      | IMPROVEMENT               |
| **Severidad** | medium                    |
| **Keyword**   | [IMPROVEMENT]             |
| **Fecha**     | 2026-09-11                |
| **Autor**     | e-burgos                  |
| **Estado**    | implemented               |
| **Spec**      | spec-e-burgos-006-web-studio |
| **Origen**    | Feedback del dev tras ver el video de `media/display-ads` (puntos 3, 1 y 6). |

## Problema

1. La voz generada no aparece en ninguna pantalla: vive en `work/voice/voice.wav` y la biblioteca
   lista únicamente `raw/`. Lo mismo con el guion del productor y con el `.mp4` entregado.
2. `timeline.captionStyle` existe desde FIX-003-003 pero **nada en la web lo escribe**: el estilo
   sólo se podía fijar al planificar el montaje.
3. El logo se dibuja con `widthRatio` 0.32 en todo formato — en 16:9 es un tercio del ancho — y un
   PNG sin canal alfa se ve como un recuadro blanco sin que nada lo avise.

## Solución

### 1. Biblioteca: sección "Generated"

- `GET /projects/:slug/generated` (EP-028, `render-api`) devuelve los archivos de **tres** raíces y
  ninguna otra: `work/voice`, `work/producer` y `out`. Por archivo: `path` (relativo al proyecto),
  `sizeBytes` y `modifiedAtMs`. Es de sólo lectura y no recorre nada más de `work/`.
- La web agrupa esa lista en tres bloques: la narración (`work/voice/voice.wav`, con reproductor,
  duración y `generated with <voiceId>` leído del manifest de `GET /projects/:slug/voice` o del
  `script-manifest.json`), el guion del productor (`work/producer/script.txt`, ver y descargar) y
  los entregables (`out/*.mp4`, reproductor y descarga). El contenido se sirve por EP-011.
- Sin botón de borrar en generados (follow-up).

### 2. Preview: selector de estilo de subtítulos

`CaptionStyleSelector` escribe `timeline.captionStyle` en el borrador; se guarda con el PUT completo
existente y el Player lo refleja porque `TimelineComposition` ya resuelve el estilo del documento.
Etiquetas exactamente las del doc de FIX-003-003 (`captionStyleLabel`, `captionStyleHint`,
`captionStyleBoldImpact`, `captionStyleCleanSans`, `captionStyleOutlinePop`,
`captionStyleSubtleLower`, `captionStyleOff`), en `en` y `es`.

### 3. Logo

- `defaultLogoWidthRatio(format)` en `timeline-core`: **0.18** cuando el cuadro es apaisado y
  **0.28** cuando es vertical. `buildTimeline` lo usa como default de `LogoInput.widthRatio`, y la
  web lo usa al prender el logo. El default del schema sigue en 0.32, así que ninguna timeline ya
  guardada cambia.
- El panel de logo gana tamaño (chico / medio / grande → 0.12 / 0.18 / 0.28) y opacidad.
- `MediaAsset` gana `hasAlpha?: boolean`, que `parseFfprobeJson` deriva del `pix_fmt` del stream de
  video (`a` en el nombre del formato, o `pal8`, que en PNG lleva `tRNS`). Con `hasAlpha: false` la
  biblioteca y el panel avisan: "This logo has no transparency; it will show as a box".

## Justificación del bypass del SPEC GATE

Agrega un único endpoint de lectura sobre directorios que el endpoint de artefactos ya sirve archivo
por archivo, y todo lo demás es aditivo sobre documentos existentes (un campo opcional de
`MediaAsset`, un default derivado del formato, tres controles de web). No crea entidades. Perfil
`solo`, sin ciclo abierto sobre spec-006.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
