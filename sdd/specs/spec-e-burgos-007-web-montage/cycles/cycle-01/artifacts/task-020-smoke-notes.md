# TASK-020 — smoke real end-to-end (evidencia literal)

Corrida 2026-09-09, contra tres copias de `media/smoke-ingest/raw/` (nunca el `media/` del dev):

- `.../scratchpad/smoke/cli/smoke-ingest` — oráculo CLI, seed 0.
- `.../scratchpad/smoke/seed1/smoke-ingest` — oráculo CLI, seed 1 (CA-014).
- `.../scratchpad/smoke/api/smoke-ingest` — servida por `render-api` real, `RENDER_API_MEDIA_ROOT`
  apuntando a `.../scratchpad/smoke/api`.

Las tres son copias `raw/`-only, byte a byte idénticas entre sí al arrancar (verificado antes de
correr nada). Ninguna corrida de este documento tocó `media/` del dev: `git status --porcelain
media/` dio vacío antes y después de todo el smoke.

## Gate de memoria — antes de cada corrida pesada

| Momento | `pgrep -fl 'ffmpeg\|whisper-cli\|chrome-headless'` | memoria libre |
| --- | --- | --- |
| antes de 2a (ingest+plan CLI seed 0) | vacío (exit 1) | 36 % |
| antes de 2b (ingest+plan CLI seed 1) | vacío (exit 1) | 44 % |
| antes de 2c (levantar el server real) | vacío (exit 1) | 42 % |
| antes del job montage fresco (segunda corrida, con `rm -rf work/`) | vacío (exit 1) | 46 % |
| antes de `npx remotion browser ensure` | vacío (exit 1) | 42 % |
| antes del job `render` encadenado | vacío (exit 1) | 43 % |

Nunca hubo transcripción y render corriendo a la vez — cada gate se corrió inmediatamente antes de
la siguiente corrida pesada, en orden.

## 2a — Oráculo CLI, `seed 0`

```
$ pnpm nx run render-cli:cli -- ingest <.../smoke/cli/smoke-ingest>
ok [ingest] work/catalog.json
  assets: aroll=1 broll=1 image=1 audio=1
  transcribed: 1 (reused 0)
  probe-failures: 0
  transcription-failures: 0

$ pnpm nx run render-cli:cli -- plan <.../smoke/cli/smoke-ingest> --preset software-demo --seed 0
ok [plan] work/timeline.json
  edl: work/edl.json
  edited-duration-ms: 18206
  transcription-source: catalog
  concepts: 4
    commando
    deploy
    script
    terminal
  broll-overlays: 0
  broll-rejections: 9
    terminal@590ms no-candidate
    commando@2270ms no-candidate
    commando@3860ms no-candidate
    script@8200ms no-candidate
    deploy@8910ms no-candidate
    deploy@10900ms no-candidate
    terminal@14290ms no-candidate
    commando@15870ms no-candidate
    deploy@17920ms no-candidate
```

Hashes obtenidos:

```
catalog.json:  5958adbd8fe55757a6b6f491e4dd7dc0e917631850273b6b2ce1e5728cb1926a
timeline.json: efd9cb9c4f6a0ffd6a12653572485521e929eb84a43e83fdb9505812a8c47161
edl.json:      f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf
```

Hashes de referencia entregados por el orquestador (`media/smoke-ingest/work`, pipeline vigente):

```
catalog.json   0a7dcf53116341d8a56e8072c4e60011cc8e8a2f6ee2bf931d31cdca0efb2bb6
timeline.json  f50ba97cc2c491873efffa039782e07d44908c71e17c19c865b2e20b8dcc30b5
edl.json       f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf
```

`edl.json` coincide exacto. `catalog.json`/`timeline.json` NO coinciden como hash crudo — se
investigó antes de declarar no-determinismo (la instrucción explícita era parar todo si esto
pasaba). Causa encontrada: cada `asset` embebe `probedAt` (timestamp real del momento del sondeo,
`ISO` de pared) y cada `fingerprint` embebe `modifiedAtMs` (mtime del archivo fuente, que una copia
`cp -R` no preserva igual que el original). Ninguno de los dos campos participa de ninguna decisión
del algoritmo de montaje. Verificación (script Python, comparando los JSON con `probedAt` y
`modifiedAtMs` eliminados recursivamente antes de comparar):

```
catalog.json equal after stripping probedAt/modifiedAtMs: True
timeline.json equal after stripping probedAt/modifiedAtMs: True
```

Verificado también leyendo directamente `media/smoke-ingest/work/*.json` del dev (solo lectura, sin
tocar nada): sus hashes coinciden exacto con los "hashes de referencia" de arriba, confirmando que
la comparación es correcta. **El pipeline es determinista** — RF-4/RNF-1 se sostienen; el oráculo
del ciclo es válido.

## 2b — Sensibilidad del oráculo a `seed` (CA-014)

```
$ pnpm nx run render-cli:cli -- ingest <.../smoke/seed1/smoke-ingest>
ok [ingest] work/catalog.json
  assets: aroll=1 broll=1 image=1 audio=1
  transcribed: 1 (reused 0)

$ pnpm nx run render-cli:cli -- plan <.../smoke/seed1/smoke-ingest> --preset software-demo --seed 1
ok [plan] work/timeline.json
  edl: work/edl.json
  edited-duration-ms: 18206
  concepts: 4 (commando, deploy, script, terminal)
  broll-overlays: 0
  broll-rejections: 9 (idénticas a seed 0 — no hay candidatos de broll en este fixture)
```

```
seed1 timeline hash: 1315f059360aded4ec0ca5fe51c947ce1b2e0ec21cef61af857edf196ae191fe
seed0 timeline hash: efd9cb9c4f6a0ffd6a12653572485521e929eb84a43e83fdb9505812a8c47161
seed1 edl hash:      30f68fda3ae8137fc50dcb68c50ba647523e26f586f75fe89431b16b9c78d5bc
seed0 edl hash:      f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf
seed1 vs seed0 timeline equal after stripping probedAt/modifiedAtMs: False
```

`seed:1` produce un `timeline.json`/`edl.json` distinto de `seed:0`, incluso después de descartar
los dos campos no deterministas. **El oráculo es sensible a `seed` — CA-014 sostenido.**

## 2c — El job `montage` por HTTP contra el binario real

Entorno cargado con `set -a && source .env && set +a` (valores nunca impresos ni pegados acá —
solo resultados observables). Server levantado con:

```
RENDER_API_MEDIA_ROOT=<.../scratchpad/smoke/api> RENDER_API_PORT=4319 SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts
```

**`GET /health`** (cuerpo completo):

```json
{
  "status": "ok",
  "service": "render-api",
  "cycle": 3,
  "time": "2026-09-09T19:43:56.176Z",
  "engine": [
    {"name": "media-local", "loaded": true},
    {"name": "composition-remotion/render", "loaded": true}
  ],
  "binaries": [
    {"name": "ffmpeg", "envVar": "FFMPEG_PATH", "resolved": true},
    {"name": "ffprobe", "envVar": "FFPROBE_PATH", "resolved": true},
    {"name": "whisperCli", "envVar": "WHISPER_CPP_PATH", "resolved": true},
    {"name": "whisperModel", "envVar": "WHISPER_MODEL_PATH", "resolved": true}
  ],
  "capabilities": {"renderPipeline": true, "assetStore": true, "jobQueue": true, "montageQueue": true},
  "jobs": {"running": 0, "queued": 0}
}
```

(`"cycle": 3` es un literal fijo en `health-handler.ts` heredado de `spec-e-burgos-005-render-service`
`cycle-03` — no distingue el ciclo de `spec-007`; no es parte de esta task, se documenta tal cual se
observó.)

### Primera corrida — `{"kind":"montage"}`, sin `overwrite`, proyecto recién copiado (sin `work/`)

```
$ curl -s -X POST http://127.0.0.1:4319/projects/smoke-ingest/jobs -H 'content-type: application/json' -d '{"kind":"montage"}'
{"id":"0233cc00-05a9-49ee-9d0d-feaa7101b7e2","slug":"smoke-ingest","kind":"montage","state":"running","createdAt":"2026-09-09T19:44:05.038Z","startedAt":"2026-09-09T19:44:05.038Z","finishedAt":null,"progress":null,"report":null,"error":null}
HTTP_STATUS=202
```

El primer poll (unos 10 s después, por el tiempo consumido en los `curl` previos) ya encontró
`succeeded` — esta corrida no dejó ver la secuencia de etapas por el timing de mi propio polling,
no por el servicio (ver la segunda corrida más abajo, con polling inmediato y sin espera, que sí
captura las cuatro etapas).

Hashes resultantes (`.../scratchpad/smoke/api/smoke-ingest/work/`) contra el oráculo CLI de 2a:

```
catalog.json api:  8c2a867f181445a7785817fcee8a9092411ddfe7ef728c4542374365d7e34a16
catalog.json cli:  5958adbd8fe55757a6b6f491e4dd7dc0e917631850273b6b2ce1e5728cb1926a
timeline.json api: cfcc26551e6768bd50115248f0da2b5ccc5fd63a06a9a85532cdad67c5fdc29d
timeline.json cli: efd9cb9c4f6a0ffd6a12653572485521e929eb84a43e83fdb9505812a8c47161
edl.json api:      f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf
edl.json cli:      f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf   → IDENTICAL

catalog.json (api vs cli) equal after stripping probedAt/modifiedAtMs: True
timeline.json (api vs cli) equal after stripping probedAt/modifiedAtMs: True
```

Mismo patrón que 2a: `edl.json` exacto, `catalog`/`timeline` idénticos salvo los dos campos de
timestamp/mtime. El job `montage` vía HTTP produce el mismo resultado que el CLI.

### Verificación del 409 (CA-009/CA-010)

```
$ curl -s http://127.0.0.1:4319/projects/smoke-ingest/jobs   →  1 job (el de la corrida anterior)

$ curl -s -w '\nHTTP_STATUS=%{http_code}\n' -X POST http://127.0.0.1:4319/projects/smoke-ingest/jobs \
    -H 'content-type: application/json' -d '{"kind":"montage"}'
{"error":{"code":"TIMELINE_ALREADY_EXISTS","stage":null,"message":"A timeline already exists for this project.","resource":"work/timeline.json"}}
HTTP_STATUS=409

$ curl -s http://127.0.0.1:4319/projects/smoke-ingest/jobs   →  1 job (sin cambios: ningún job nuevo)
```

`409 TIMELINE_ALREADY_EXISTS`, sin job nuevo registrado. `overwrite:true` sobre el mismo proyecto
respondió `202` y completó en 11 ms (`startedAt` `19:45:00.972Z` → `finishedAt` `19:45:00.983Z`) —
reuso completo del catálogo existente (todos los fingerprints coincidían), no un bug: cuando no hay
ningún asset que re-sondear ni re-transcribir, el job no tiene trabajo real que hacer.

### Segunda corrida — proyecto realmente fresco (`rm -rf work/` antes de disparar), polling inmediato sin espera

Secuencia de etapas observada, deduplicada (mismo `state`/`stage`/contador → una sola línea):

```
2026-09-09T19:45:40.6Z  state=running    stage=probe       processedAssets=None totalAssets=None percent=None
2026-09-09T19:45:40.6Z  state=running    stage=probe       processedAssets=1    totalAssets=4    percent=25
2026-09-09T19:45:41.6Z  state=running    stage=probe       processedAssets=2    totalAssets=4    percent=50
2026-09-09T19:45:41.6Z  state=running    stage=probe       processedAssets=3    totalAssets=4    percent=75
2026-09-09T19:45:41.6Z  state=running    stage=transcribe  processedAssets=None totalAssets=None percent=None
2026-09-09T19:45:44.6Z  state=running    stage=plan        processedAssets=None totalAssets=None percent=None
2026-09-09T19:45:44.6Z  state=succeeded  stage=plan         processedAssets=None totalAssets=None percent=None
```

Job total: 4.9 s (`createdAt` `19:45:40.899Z` → `finishedAt` observado en el snapshot `succeeded`
a las `19:45:44.6xx`). `discover` nunca apareció en ningún snapshot: se fija sincrónicamente antes
de `ingestProject`, y el decorador ya mueve a `probe` en la primera invocación de `ffprobe`, más
rápido que un round-trip HTTP — consistente con §5.1 del architect. `processedAssets` nunca llegó a
`4/4` (100 %) en ningún snapshot capturado: la cuarta invocación de `ffprobe` cayó entre dos polls
consecutivos del loop (polling cada iteración de un bucle bash + `curl`, sin dormir, igual tuvo
huecos). El progreso es monótono en todo momento (nunca bajó de un valor ya reportado) — CA-014 del
spec-005 (D-5 en este spec) se sostiene.

Hashes de esta segunda corrida, contra el mismo oráculo CLI de 2a:

```
catalog.json api:  73871f78aef034714ef80d69fc2dd1a718c54a5b8f4da412629d980d21394d66
timeline.json api: 2e839670934b49099d8c23b04d39c7f9ac3b8098fee45f083604b6c349cf7f7e
edl.json api:      f96256aaddbaafc8daaff6fda4e258d384571503b762802c3c0f0830f0dc39bf  → IDENTICAL (vs cli)
catalog equal (stripped): True
timeline equal (stripped): True
```

## 2d — Job `render` encadenado

```
$ npx remotion browser ensure
Has browser at .../node_modules/.remotion/chrome-headless-shell/mac-arm64/.../chrome-headless-shell
```

```
$ curl -s -X POST http://127.0.0.1:4319/projects/smoke-ingest/jobs -H 'content-type: application/json' -d '{"kind":"render"}'
{"id":"c072671e-0d3f-432e-9152-b874456e87a8","slug":"smoke-ingest","kind":"render","state":"running","createdAt":"2026-09-09T19:46:53.027Z","startedAt":"2026-09-09T19:46:53.027Z","finishedAt":null,"progress":{"stage":"prepare","renderedFrames":null,"totalFrames":null,"percent":null},"report":null,"error":null}
HTTP_STATUS=202
```

Secuencia de etapas, deduplicada:

```
2026-09-09T19:47:06.3Z  running  render  327/538  60%
2026-09-09T19:47:07.3Z  running  render  367/538  68%
2026-09-09T19:47:08.3Z  running  render  404/538  75%
2026-09-09T19:47:09.3Z  running  render  442/538  82%
2026-09-09T19:47:10.3Z  running  render  470/538  87%
2026-09-09T19:47:11.3Z  running  render  505/538  93%
2026-09-09T19:47:12.3Z  running  render  538/538  100%
2026-09-09T19:47:15.3Z  running  mix
2026-09-09T19:47:18.3Z  running  mux
2026-09-09T19:47:19.3Z  succeeded  verify
```

`report` final:

```json
{
  "renderId": "c072671e-0d3f-432e-9152-b874456e87a8",
  "startedAt": "2026-09-09T19:46:53.027Z",
  "finishedAt": "2026-09-09T19:47:19.833Z",
  "deliverable": {"resource": "out/c072671e-0d3f-432e-9152-b874456e87a8.mp4", "width": 1080, "height": 1920, "fps": 30, "durationInFrames": 538},
  "intermediates": {
    "mutedVideoResource": "work/renders/c072671e-0d3f-432e-9152-b874456e87a8/video-muted.mp4",
    "masterAudioResource": "work/renders/c072671e-0d3f-432e-9152-b874456e87a8/master.wav"
  },
  "loudness": {"withinTolerance": false, "integratedLufs": -17.59, "truePeakDbtp": -4.03, "integratedDeltaLu": -3.59, "truePeakDeltaDb": -3.0300000000000002}
}
```

`loudness.withinTolerance: false` no es una falla del smoke (D-7, ya documentado en la sección
CA-033 del README): el deliverable se publica igual y el delta se informa, nunca se re-masteriza.

**`ffprobe` sobre el deliverable descargado** (`GET /projects/smoke-ingest/files/out/<jobId>.mp4`,
2.0 MB):

```
$ ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 out.mp4
codec_name=h264
width=1080
height=1920
r_frame_rate=30/1
nb_frames=538

$ ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of default=noprint_wrappers=1 out.mp4
codec_name=aac
sample_rate=48000
channels=2
```

`nb_frames=538`, `r_frame_rate=30/1` — leído del stream de video, nunca de `format.duration` (RF-27).

## Cierre del proceso

```
$ kill -TERM <API_PID>
$ ps -p <API_PID>   → vacío (proceso confirmado muerto)
```

El código de salida exacto **no se pudo capturar en esta corrida**: el proceso se levantó en un
tool-call de shell y la señal se envió desde otro — el arnés resetea el estado de shell entre
comandos, así que `wait "$PID"` no tenía un hijo del que colgar (`wait` devolvió `127`, que es un
artefacto de esa desconexión, no el exit code real del server). Se confirmó la muerte del proceso
vía `ps` inmediatamente después. El comportamiento ya documentado y verificado en el README (sección
CA-033, heredada de `spec-e-burgos-005-render-service` `cycle-03`) es que, una vez que un job corrió
en el proceso, `SIGTERM` responde `exit=143` — no se reafirma ese número acá porque esta corrida
puntual no lo pudo medir, pero tampoco se observó ninguna evidencia en contra (el proceso terminó,
sin colgarse).

## Verificación de cierre

```
$ git status --porcelain media/          → vacío
$ git diff --stat apps/web               → vacío
```
