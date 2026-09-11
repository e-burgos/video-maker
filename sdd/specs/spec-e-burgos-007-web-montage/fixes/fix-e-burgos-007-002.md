# FIX-e-burgos-007-002 — El montaje sólo toma el habla del A-roll: una voz generada nunca se usa

| Campo         | Valor                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-007-002                                                                          |
| **Tipo**      | IMPROVEMENT                                                                                   |
| **Severidad** | medium                                                                                        |
| **Keyword**   | [IMPROVEMENT]                                                                                 |
| **Fecha**     | 2026-09-11                                                                                    |
| **Autor**     | e-burgos                                                                                      |
| **Estado**    | implemented                                                                                   |
| **Spec**      | spec-e-burgos-007-web-montage                                                                 |
| **Origen**    | Caso real `media/display-ads`: pantalla grabada 16:9 de 96,5 s **sin audio** + guion en `work/producer/script.txt`. |

## Problema

`autoMontage` lee el habla de una sola fuente: la transcripción del A-roll que dejó el `ingest` en el
catálogo (`resolveMontageInputs → readTranscription`). La voz que produce el job `voice` de
`FIX-e-burgos-009-001` (`work/voice/voice.wav` 48 kHz mono + `work/voice/voice.words.json` +
`work/voice/script-manifest.json`) no tiene ningún camino hacia el montaje.

Con una grabación muda el resultado es un timeline inútil: la pista `voice` apunta al A-roll sin
audio (`buildVoiceTrack` copiaba el `assetId` del A-roll), `captions 0`, sin conceptos ni B-roll, y
el render muere o entrega un MP4 mudo (`MissingMediaStreamError` en cuanto la mezcla busca la pista
de audio del A-roll). Para el caso más común de un tutorial —pantalla grabada + narración
generada— no había camino.

## Solución

1. **`voice: 'aroll' | 'script'`** en `AutoMontageOptions` (default `aroll`, comportamiento actual
   intacto), como `--voice <aroll|script>` en `plan`/`run` de la CLI y como `voice` en el body del
   job `montage` (`422 MONTAGE_VOICE_INVALID` para cualquier otro valor; `409
   VOICE_TRACK_NOT_FOUND` si se pide `script` y `work/voice/voice.wav` no existe, antes de
   registrar el job).
2. Con `script` la **fuente de habla** es `work/voice/script-manifest.json` → `work/voice/voice.wav`
   + `work/voice/voice.words.json`. De esas palabras salen conceptos, B-roll y captions; `--script`
   / `scriptText` siguen alineando los textos contra el guion. El A-roll no se transcribe para el
   habla y su audio **se ignora por completo** (ver decisión). La pista `voice` del timeline apunta
   al wav como asset propio (`kind: 'audio'`, id `work/voice/voice.wav`) y `transcription-source`
   pasa a `voice-script`.
3. **Poda de silencios apagada por defecto en modo `script`** (`--prune-silences` la fuerza): la
   grabación es continua y la narración va encima, así que el EDL trae un único `keep` y el timeline
   un solo tramo de A-roll.
4. Render y player no necesitaron cambios: `assetSrc` ya resuelve un path relativo del proyecto con
   `staticFile` (el `publicDir` del render es la raíz del proyecto, que incluye `work/`), y
   `mixTimelineAudio` ya acepta un asset `kind: 'audio'` como fuente de la pista `voice`
   (`hasAudioStream` lo contempla) — lo que faltaba era que el clip apuntara a él.
5. Skill `video-producer` y system prompt del productor: preguntar la plataforma y producir **un
   solo formato**, y receta de grabación muda + narración (`voice` → `montage` con `voice: 'script'`
   y `format` → `render`).

## Decisión: en modo `script` el audio del A-roll se descarta (mute), no se mezcla por debajo

La pista `aroll` del timeline ya nace `muted: true` desde `buildTimeline`; el audio del A-roll
entraba a la mezcla sólo porque la pista `voice` copiaba su `assetId`. En modo `script` esa pista
apunta al wav de la voz, así que el A-roll queda mudo sin ninguna otra rama de código.

Se descartó mezclarlo bajo (`-18 dB`, tipo cama): el caso es narración sobre una pantalla grabada,
donde el audio del A-roll es o silencio o ruido de sistema, y mezclarlo obligaría a un tercer bus
con su propio ducking y su propia normalización. Si alguna vez hace falta, el lugar es
`audioMix` con una entrada nueva, no un flag del montaje.

## Decisión: la duración del montaje es `min(voz, A-roll)`; si la voz sobra, se corta

`pruneSilencesWithFrameMargin` recibe ahora `sourceDurationMs = min(A-roll, voz)` en modo `script`
(menos un frame de margen, como siempre). Consecuencias:

- **Voz más corta que el A-roll** → el video termina cuando termina la narración y la cola de la
  grabación se descarta. Es lo deseable en un tutorial.
- **Voz más larga que el A-roll** → la narración se corta al final del A-roll. `AutoMontageResult`
  reporta `voiceTrack.truncatedMs` y el job y la CLI lo publican, así que el productor puede avisar
  y acortar el guion o alargar la grabación.

Se evaluó **congelar el último frame del A-roll** para que el video terminara con la voz y se
descartó: un `VideoClip` que dura más que su asset es exactamente lo que `validateTimeline` rechaza
con `CLIP_EXCEEDS_ASSET`, y el `OffthreadVideo` de la composición no expresa un freeze. Soportarlo
es un tipo de clip nuevo (`freeze`/`still`) en `timeline-core`, en el validador y en la composición
—un ciclo, no un fix—, y quedó como follow-up.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada. No crea endpoints, módulos ni entidades: una opción
opcional de la librería, un flag opcional de la CLI y un campo opcional en el body de EP-012 sobre
un artefacto (`work/voice/voice.wav`) que el job `voice` ya producía. Perfil `solo`, sin ciclo
abierto.

## Pendiente para el próximo ciclo de UI (`apps/web`)

Las sugerencias iniciales del chat del productor viven en `apps/web/src/components/producer-welcome.tsx`
(`STARTER_SUGGESTIONS_WITH_MATERIAL` / `STARTER_SUGGESTIONS_WITHOUT_MATERIAL`), fuera del alcance de
este fix. Texto exacto propuesto, para aplicar tal cual:

```ts
export const STARTER_SUGGESTIONS_WITH_MATERIAL = [
  'Contame qué video querés y para qué plataforma',
  'Proponeme un guion con el material que subí',
  'Narrá esta grabación con una voz generada',
  'Hacé un video de 30 s sobre ',
] as const;

export const STARTER_SUGGESTIONS_WITHOUT_MATERIAL = [
  'Contame qué video querés y para qué plataforma',
  'Buscá material libre sobre ',
] as const;
```

## Archivos

`build-timeline` e `index` en `libs/timeline-core`; `auto-montage`, `voice/voice-script-paths`,
`voice/read-voice-script-track`, `montage/prune-silences-with-frame-margin`,
`errors/montage-input-error` e `index` en `libs/auto-montage`; `preset-names`, `parse-cli-args`,
`stage-for-argument`, `plan-command`, `cli-report`, `to-reports`, `format-report` y el README en
`tools/render-cli`; `montage-job-params`, `jobs-handler`, `render-job`, `render-job-queue`,
`run-montage-pipeline`, `voice/voice-paths`, `voice/voice-script-preconditions`,
`errors/render-api-error`, `producer/build-producer-system-prompt` y el README en `apps/render-api`;
más `sdd/api.json` y `sdd/skills/video-producer/SKILL.md`. Lista completa en `affected_files` de
`sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
