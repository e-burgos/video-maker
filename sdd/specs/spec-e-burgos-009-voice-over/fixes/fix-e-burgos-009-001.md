# FIX-e-burgos-009-001 — El job `voice` exige un storyboard: un guion suelto no se puede sintetizar desde el studio

| Campo         | Valor                                                       |
| ------------- | ----------------------------------------------------------- |
| **ID**        | FIX-e-burgos-009-001                                        |
| **Tipo**      | IMPROVEMENT                                                 |
| **Severidad** | medium                                                      |
| **Keyword**   | [IMPROVEMENT]                                               |
| **Fecha**     | 2026-09-11                                                  |
| **Autor**     | e-burgos                                                    |
| **Estado**    | implemented                                                 |
| **Spec**      | spec-e-burgos-009-voice-over                                |
| **Origen**    | Caso real `media/display-ads`: el guion vivía en `work/producer/script.txt` y no había forma de convertirlo en voz desde la app. |

## Problema

El job `voice` lee `work/storyboard.json`, selecciona sus escenas y escribe una pista por escena. Un
proyecto cuyo guion es un `script.txt` plano no tiene camino: el productor tenía que caer en la receta
Piper de la skill, que su lista blanca de herramientas **no autoriza** (`Bash(piper *)` no está
permitido). Resultado: voz imposible desde el chat del studio.

## Solución

El mismo job gana una entrada alternativa:

- `scriptText` (inline) **XOR** `scriptPath` (relativo al proyecto), una frase por línea, más
  `gapMs` (default `900`, el mismo silencio sobre el que corta `plan`).
- Una pasada de Piper por frase → `work/voice/sources/line-NN.wav`; concatenación con `gapMs` de
  silencio entre frases → **`work/voice/voice.wav`** a 48 kHz mono; Whisper sobre esa pista →
  `work/voice/voice.words.json`; y `work/voice/script-manifest.json` con `source: 'script'`, voz,
  idioma, gap, duración medida y una entrada por línea con su `startMs`.
- El manifest del storyboard **no se toca**. El reporte del job distingue los dos modos con `source`,
  `storyboardId` (nulo en modo guion) y `track` (nulo en modo storyboard).

### Por qué un documento propio y no `VoiceTrackSource: 'script'`

Ensanchar `VoiceTrackSourceSchema` es un cambio **global**: el `VoiceManifest` está atado a un
`storyboardId` y a una pista por `sceneId`, con invariantes (`superRefine`) que ligan `source` a
`voiceId`, y lo consumen el mezclador, la web y `spec-012`. El artefacto del modo guion es otra cosa
—una sola pista y N líneas sin escena— así que se serializa en su propio documento, aditivo y sin
tocar a ningún consumidor existente.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada, a partir de un caso real. No crea endpoints ni
módulos: el mismo job de EP-012 gana una entrada alternativa. Cambia el reporte del job `voice`
(gana `source` y `track`, `storyboardId` pasa a nullable), y por eso el fix incluye `apps/web`, el
único consumidor de ese contrato. Perfil `solo`, sin ciclo abierto.

## Archivos

`voice-script-manifest.schema` e `index` en `libs/timeline-core`; `concat-speech-segments` e `index`
en `libs/media-local`; `voice-paths`, `voice-language`, `voice-store`, `voice-synthesis-steps`,
`voice-script-preconditions`, `voice-job-params`, `run-voice-script-pipeline`, `run-voice-pipeline`,
`render-job`, `render-job-queue`, `jobs-handler`, los puertos y el README en `apps/render-api`; tipos,
parser y panel de voz en `apps/web`; más `sdd/api.json`. Lista completa en `affected_files` de
`sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
