# Smoke real — job `voice` con Piper y Whisper (spec-e-burgos-009 cycle-01)

Corrida del 2026-09-09 contra el binario de `apps/render-api`, con Piper y whisper-cli reales.
Ningún paso tocó `media/` del dev: la raíz fue una copia temporal de `media/smoke-ingest/raw`
sembrada con el storyboard real de `spec-008 cycle-02`
(`artifacts/smoke-storyboard-from-web.json`, 5 escenas en `es-AR`).

## Precondiciones

- `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|piper'` → sin salida.
- `memory_pressure` → `System-wide memory free percentage: 46%` (piso 35 %).
- Puerto: **4411**. El 4399 está tomado por un `render-api` de `spec-007` todavía vivo en esta
  máquina — la trampa que documenta el journal de `spec-008`. El guion arranca comprobando
  `capabilities.voiceQueue` en `/health`, que sólo existe en el build de este ciclo.

```
own build OK
```

`GET /health` → `status: ok`, seis binarios resueltos:

```
ffmpeg/FFMPEG_PATH  ffprobe/FFPROBE_PATH  whisperCli/WHISPER_CPP_PATH
whisperModel/WHISPER_MODEL_PATH  piperCli/PIPER_PATH  piperModel/PIPER_MODEL_PATH
capabilities: renderPipeline, assetStore, jobQueue, montageQueue, storyboardQueue, voiceQueue
```

## 1. `GET /voices`

```json
{"voices":[{"id":"es_AR-daniela-high","fileName":"es_AR-daniela-high.onnx","isDefault":true}]}
```

## 2. Job de voz sobre las cinco escenas — CA-001, CA-002

`POST /projects/voice-smoke/jobs {"kind":"voice"}` → `202`, y **`succeeded` en 22 s**
(`createdAt 02:33:47.787` → `finishedAt 02:34:09.824`). Reporte completo en
`smoke-voice-job.json`.

`ffprobe` de los cinco entregables — todos `pcm_s16le`, **48 000 Hz**, mono, duración > 0:

```
scene-01.wav pcm_s16le,48000,1 3.099875
scene-02.wav pcm_s16le,48000,1 5.561188
scene-03.wav pcm_s16le,48000,1 3.134708
scene-04.wav pcm_s16le,48000,1 5.665688
scene-05.wav pcm_s16le,48000,1 3.459792
```

**CA-002 — la duración sale del audio, no del modelo.** La estimación del storyboard y la medición
real no coinciden en ninguna escena, y la diferencia llega a casi dos segundos:

| Escena | `estimatedDurationMs` | `durationMs` real |
| --- | --- | --- |
| scene-01 | 5000 | 3042 |
| scene-02 | 6000 | 5654 |
| scene-03 | 6500 | 5294 |
| scene-04 | 7000 | 5805 |
| scene-05 | 4500 | 3437 |

El `manifest.json` final coincide con `ffprobe` **al milisegundo** en las cinco pistas.

## 3. Palabras con timing — CA para las captions de spec-012

Cinco `scene-NN.words.json`, formato `Transcription` idéntico al de la ingesta
(`engine: whisper.cpp`, `language: es`):

```
scene-01.words.json | 10 palabras | primera {'text': 'Narración', 'startMs': 40, 'endMs': 450} | última {'text': 'PUT.', 'startMs': 2410, 'endMs': 2780}
scene-02.words.json | 15 palabras | primera {'text': 'Primero',  'startMs': 60, 'endMs': 510} | última {'text': 'líneas.', 'startMs': 5250, 'endMs': 5660}
scene-03.words.json | 17 palabras | primera {'text': 'Según',    'startMs': 100,'endMs': 330} | última {'text': 'toque.',  'startMs': 4840, 'endMs': 5100}
scene-04.words.json | 17 palabras | primera {'text': '3-0',      'startMs': 70, 'endMs': 580} | última {'text': 'carpetas.','startMs': 5250, 'endMs': 5800}
scene-05.words.json | 11 palabras | primera {'text': 'Tres',     'startMs': 60, 'endMs': 290} | última {'text': 'más.',    'startMs': 3160, 'endMs': 3440}
```

## 4. Regeneración parcial — CA-001 (rama `sceneIds`)

`POST … {"kind":"voice","sceneIds":["scene-02"],"overwrite":true}` → `succeeded`,
`report.scenes = ['scene-02']`. El `sha256` de los cinco wav antes y después: **sólo scene-02
cambió**, las otras cuatro son byte-idénticas.

El oráculo es sensible por construcción: Piper introduce ruido por corrida, así que un hash
idéntico prueba que el archivo **no se reescribió**, no que se reescribió igual (scene-02 pasó de
`06f6377c…` a `591e4239…` con la misma narración y la misma voz).

## 5. Locución subida — CA-003

1. `PUT /projects/voice-smoke/assets/voice/take-03.wav` → **`201`**, `role: "voice"`, el catálogo la
   sondeó como `audio` 22 050 Hz. El rol nuevo funciona de punta a punta.
2. `PUT /projects/voice-smoke/voice/scenes/scene-03 {"fileName":"take-03.wav"}` → `200` con
   `source: "uploaded"`, `voiceId: null`, `durationMs: 3135` (la toma real) y `sampleRate: 48000`
   (normalizada). Su `words.json` transcribe la toma, no la narración del storyboard:
   `"Esta es mi locución grabada con micrófono para la escena 3."`
3. `POST … {"kind":"voice"}` sin `overwrite` → **`409 VOICE_ALREADY_EXISTS`**.
4. `POST … {"kind":"voice","overwrite":true}` → `succeeded` con
   `report.scenes = ['scene-01','scene-02','scene-04','scene-05']`: **scene-03 no aparece** y su
   `sha256` es idéntico antes y después (`e994d8db…`). La locución subida gana, incluso con
   `overwrite` (RF-7).

## 6. `GET /projects/:slug/voice` y detección de cambios

```
scene-01 generated stale=False   scene-02 generated stale=False   scene-03 uploaded stale=False
scene-04 generated stale=False   scene-05 generated stale=False
```

Tras editar la narración de scene-01 con `PUT /storyboard` (200), la misma llamada devuelve
`scene-01 stale=True` y las otras cuatro en `False`: el `narrationHash` detecta la edición sin
volver a sintetizar nada.

## Desviación encontrada durante el smoke

La **primera** corrida falló con `VOICE_TRANSCRIPTION_FAILED` en `scene-01` con las cinco pistas ya
sintetizadas. Causa: el pipeline pasaba paths **relativos** a los puertos de media. El binario los
resuelve bien porque corre con `cwd` = raíz del proyecto, pero `transcribeWithWhisperCpp` lee su
JSON de salida con `readTextFile`, que resuelve contra el `cwd` **del proceso de la API** — o sea el
repo. El JSON estaba en el proyecto y el wrapper lo buscaba en el repo. `auto-montage` ya pasa
`toAbsolutePath(project, whisperOutBase(mirror))` por exactamente esta razón (D-30).

Los 15 tests del pipeline estaban en verde porque el doble del puerto no resuelve ningún path.
Corregido pasando paths absolutos en las tres llamadas a puertos de media, con un test de regresión
que recorre el `call-log` y exige que **todo** path que cruza a un binario empiece por la raíz del
proyecto.
