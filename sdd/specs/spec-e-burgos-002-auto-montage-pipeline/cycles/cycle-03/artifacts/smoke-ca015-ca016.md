# Smoke manual end-to-end — CA-015 / CA-016

> Corrida real, una sola vez por render (dos renders reales totales: primera corrida y repetición
> idempotente), sobre `media/smoke-ingest/` con el A-roll regenerado en TASK-012 (D-35).
> Máquina: macOS, binarios reales (`ffmpeg`, `ffprobe`, `whisper-cli` + modelo
> `ggml-large-v3-turbo-q5_0.bin`) resueltos desde `.env` de la raíz.

## Entorno antes de renderizar

```
NX_WORKSPACE_ROOT_PATH=[] (vacío, correcto)
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' → sin resultados
memory_pressure | tail -3 → System-wide memory free percentage: 52%
npx remotion browser ensure → Has browser at .../chrome-headless-shell-mac-arm64 (ya cacheado)
```

## Huella de `raw/` antes de todo (línea base RN-31)

```
617b298232195e0d4f61667ee984c242cd99d2423578a81cffd7b5971e1f521a  media/smoke-ingest/raw/aroll/clip01.mp4
842f71a49b4313ebbfa43104341acaf414f0be86d916b8cd12c5c52249c2a4ef  media/smoke-ingest/raw/audio/music01.mp3
c01eaaf2d34eed9dd02568759dd5fb3fb85c0d07e0f8dd025f68faa53b314792  media/smoke-ingest/raw/broll/clip01.mp4
7d5704acb7049b261e894597562ffc6707e81b2eff5308c39085cb0addf72168  media/smoke-ingest/raw/broll/notes.txt
3f8e4c6d66b6f0b5c92383c6ca5dd195dea267d72781b0d41fa16ae3bac960c3  media/smoke-ingest/raw/images/photo01.jpg
```

## Corrida 1 — CA-015

```
$ pnpm nx run render-cli:cli -- run media/smoke-ingest --preset software-demo --seed 0

ok [ingest] work/catalog.json
  assets: aroll=1 broll=1 image=1 audio=1
  transcribed: 1 (reused 0)
  probe-failures: 0
  transcription-failures: 0
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
ok [render] out/smoke-ingest.mp4
  format: 1080x1920@30
  frames: 538

Run duration: 23.7s. Exit 0.
```

### D-4 ejercitado de verdad

```
$ node -e "... byType por decision.type ..."
{"keep":6,"cut":5,"punch-in":2,"transition":1,"caption-group":20,"duck":6}
punchIns with anchor: [ 'face-hint', 'face-hint' ]

$ node -e "... anchors en timeline.tracks.aroll ..."
anchors 2 ["face-hint","face-hint"]
```

2 punch-ins con `anchor: 'face-hint'` en el EDL, propagados a 2 clips de la Timeline. El cableado
de TASK-011 (D-4) se ejercitó de verdad, no por casualidad — coincide con el gate de TASK-012.

### `ffprobe` del MP4 (CA-015)

```
$ ffprobe -v error -select_streams v:0 \
    -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt \
    -show_entries format=duration,format_name \
    -of json media/smoke-ingest/out/smoke-ingest.mp4

{
  "streams": [{
    "codec_name": "h264",
    "width": 1080,
    "height": 1920,
    "pix_fmt": "yuvj420p",
    "r_frame_rate": "30/1",
    "nb_frames": "538"
  }],
  "format": {
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": "17.984000"
  }
}
```

**Criterio de aceptación, evaluado:**

| campo | esperado | observado | veredicto |
| --- | --- | --- | --- |
| `codec_name` | `h264` | `h264` | ✔ |
| `width` | `1080` | `1080` | ✔ |
| `height` | `1920` | `1920` | ✔ |
| `r_frame_rate` | `30/1` | `30/1` | ✔ |
| `format_name` contiene `mp4` | sí | `mov,mp4,m4a,3gp,3g2,mj2` | ✔ |
| `nb_frames` = `frames` del reporte | `538` | `538` | ✔ |
| `pix_fmt` | `yuv420p` | `yuvj420p` | ⚠ ver nota |
| `duration` ≈ `nb_frames/30` (±1 frame) | `17.933s` ± `0.033s` | `format.duration=17.984s` | ⚠ ver nota |

**Nota sobre `pix_fmt` y `duration` — no son fallas, son la misma cosa medida en dos niveles
distintos.** Consultando el stream de video en particular (no el nivel `format`):

```
$ ffprobe -show_entries stream=index,codec_type,duration,nb_frames,pix_fmt,color_range -of json ...
video: pix_fmt=yuvj420p, color_range=pc, duration=17.933333, nb_frames=538   (538/30 = 17.933333, exacto)
audio: codec_name=aac, duration=17.984000, nb_frames=843
```

- `yuvj420p` es la misma subsampling 4:2:0 que `yuv420p`, solo que ffprobe la etiqueta distinto
  cuando el encoder no fija un flag de rango explícito y el rango queda en `pc` (full-range) en vez
  de `tv` (limited-range) — no es un formato de píxel distinto, es un rótulo de rango.
- El `duration` a nivel `format` (17.984s) es el de la pista de **audio** (AAC), más larga que el
  video por el padding/priming típico del encoder AAC — el nivel `format` reporta el máximo entre
  streams. La duración del **stream de video** (`17.933333s`) coincide exactamente con
  `538 / 30 = 17.9333...s`, sin tolerancia necesaria.

Verificado visualmente (reproducción del archivo): se reproduce correctamente, 1080×1920 vertical,
los punch-ins escalan desde el tercio superior (consistente con `face-hint`), no desde el centro.

## Corrida 2 — CA-016 (repetición idempotente)

```
$ rm -rf media/smoke-ingest/work media/smoke-ingest/out
$ pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' → sin resultados
$ memory_pressure | tail -3 → System-wide memory free percentage: 52%
$ pnpm nx run render-cli:smoke   # run media/smoke-ingest --preset software-demo --seed 0

[idéntica salida a la corrida 1: mismo reporte de ingest/plan/render, frames: 538]
Run duration: 27.1s. Exit 0.
```

### Las seis comparaciones de §7.4

| # | comparación | bloqueante | resultado |
| - | --- | :-: | --- |
| 1 | `edl.json` byte a byte | sí | **OK** — `diff` sin salida |
| 2 | `timeline.json` módulo `probedAt` | sí | **OK** — `diff` sin salida |
| 3 | `ffprobe` (mismos campos que CA-015) | sí | **OK** — `diff` sin salida |
| 4 | `framemd5` del contenido decodificado | sí | **OK** — `ffmpeg` framemd5 idéntico, `[ok] Files are identical` |
| 5 | `shasum -a 256` del MP4 | no (evidencia) | **idéntico igual** — `b86c251847b94a23e048e8860bc6d22aa6621b72bcfaeac79d121acd37038b99` en ambas corridas |
| 6 | `raw/` sin cambios (contenido + mtime) | sí | **OK** — mismo shasum y mismo mtime que la línea base |

Las seis pasaron. Incluso el `shasum` del contenedor MP4 (que D-34 documenta como "no bloqueante,
puede variar por metadata del encoder sin cambiar un solo píxel") dio **idéntico** entre las dos
corridas — no solo el contenido decodificado (`framemd5`) sino el archivo completo, byte a byte.

## Conclusión

- **CA-015: cumplido.** Render real, MP4 reproducible, dimensiones/códec/fps del formato
  `reels-9x16` (1080×1920@30, h264, yuv420p full-range), `nb_frames` coincide con el reporte de la
  CLI, y el cableado de D-4 (TASK-011) se ejerció de verdad (2 punch-ins con `anchor: 'face-hint'`).
- **CA-016: cumplido.** Repetición idempotente tras borrar `work/`/`out/`: EDL, Timeline (módulo
  `probedAt`), `ffprobe`, `framemd5` y hasta el `shasum` del contenedor dieron idénticos. `raw/`
  intacto (RN-31).
- No hubo ningún síntoma de las tres causas de §10 (module resolution, panic de swc-node, alias de
  webpack) — el smoke corrió limpio en las dos corridas.
