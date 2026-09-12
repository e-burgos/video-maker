# FIX-e-burgos-009-003 — Voz y Storyboard son un callejón sin salida cuando el productor trabajó desde un guion

| Campo         | Valor                       |
| ------------- | --------------------------- |
| **ID**        | FIX-e-burgos-009-003        |
| **Tipo**      | IMPROVEMENT                 |
| **Severidad** | medium                      |
| **Keyword**   | [IMPROVEMENT]               |
| **Fecha**     | 2026-09-11                  |
| **Autor**     | e-burgos                    |
| **Estado**    | implemented                 |
| **Spec**      | spec-e-burgos-009-voice-over |
| **Origen**    | Feedback del dev sobre `media/display-ads` (punto 4): Storyboard vacío y Voz con `STORYBOARD_NOT_FOUND`. |

## Problema

El productor narró desde un guion con marcas de tiempo, así que el proyecto no tiene
`work/storyboard.json`. La página de Voz pide el storyboard y muestra `STORYBOARD_NOT_FOUND` aunque
`work/voice/voice.wav` y `work/voice/script-manifest.json` existan; la de Storyboard queda vacía
aunque `work/producer/script.txt` esté en disco.

## Solución

### Página Voz — modo guion

Cuando no hay storyboard pero sí `work/voice/script-manifest.json` (leído por EP-011):

- Lista de líneas con `startMs`, `endMs` y `overflowMs` cuando lo hay. `requestedStartMs` se muestra
  como "pedía m:ss" sólo si la línea traía marca — y una marca en `0` **es** una marca, así que el
  chequeo es contra `null`, no contra un valor falsy.
- Reproductor de `work/voice/voice.wav` y la voz usada (`voiceId` del manifest).
- Botón "Regenerate with the selected voice": POST del job `voice` con
  `scriptPath: 'work/producer/script.txt'` y la voz elegida en el selector. `model` no aplica.
- Aviso de que después hay que volver a montar y renderizar.

Sin storyboard **y** sin manifest, el estado vacío ofrece dos caminos: pedirle la narración al
productor y proponer un storyboard.

### Página Storyboard — guion del productor

Sin storyboard pero con `work/producer/script.txt`, la página muestra el guion en sólo lectura bajo
el título "Producer script", con las marcas de tiempo tal cual están en el archivo, y conserva el
botón de proponer storyboard como alternativa. El guion se sirve por EP-011.

> El `script.txt` real de `media/display-ads` **no tiene marcas de tiempo** (las diez líneas van
> encadenadas con el `gapMs` por defecto), al contrario de lo que decía el pedido. El modo guion no
> depende de eso: muestra la ventana de cada línea igual, y la columna "pedía m:ss" simplemente no
> aparece. El guion con marcas se ejercita en `apps/web/e2e/timed-narration-captions-smoke.mjs`.

## Justificación del bypass del SPEC GATE

No crea endpoints ni entidades: ambas pantallas leen documentos que el motor ya escribe, por EP-011,
y el botón de regenerar postea el job `voice` con el mismo body que usa el productor. Perfil `solo`,
sin ciclo abierto sobre spec-009.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
