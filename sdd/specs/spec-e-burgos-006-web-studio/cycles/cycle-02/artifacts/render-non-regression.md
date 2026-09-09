# No-regresión del render — spec-e-burgos-006 cycle-02 (TASK-002)

> Ejecutado el 2026-09-09, **después** de que `ArollScene` y `BrollMedia` pasaran a `TimelineVideo`.
> No es un procedimiento documentado: los hashes de abajo salieron de esta corrida.

## Por qué un hash y no una inspección

El pipeline de `apps/render-api` sobre `media/smoke-ingest` es **byte-determinista**: las cuatro
corridas anteriores al cambio (jobs `8a51f3cb`, `ac9647bb`, `2339e642`, `e01ba880`, del 2026-09-08)
dejaron el mismo `sha256` en `work/renders/<job>/video-muted.mp4`, y tres de ellas el mismo en
`out/<job>.mp4`. Con esa propiedad, la evidencia fuerte de que la salida no cambió es reproducir el
hash, no comparar `nb_frames`. El `ffprobe` se reporta igual, contra el **stream de video** y nunca
contra `format.duration` (lección vigente del repo).

## Guion (copiable)

```bash
# 0. gate de memoria: ningún proceso pesado vivo y ≥35 % libre
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'   # sin salida
memory_pressure | tail -2                        # System-wide memory free percentage: 58%
npx remotion browser ensure                      # Has browser at node_modules/.remotion/...

# 1. el servicio contra el media root real (4310 lo ocupa `pnpm sdd:docs` en esta máquina)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. un job real (EP-012) y su seguimiento (EP-014)
curl -s -X POST http://127.0.0.1:4399/projects/smoke-ingest/jobs -H 'content-type: application/json' -d '{}'
curl -s http://127.0.0.1:4399/jobs/<jobId>

# 3. la comparación
shasum -a 256 media/smoke-ingest/work/renders/<jobId>/video-muted.mp4 media/smoke-ingest/out/<jobId>.mp4
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt \
  -of default=noprint_wrappers=1 media/smoke-ingest/out/<jobId>.mp4
```

`composition-remotion:smoke` **no** sirve como evidencia en esta máquina: sus assets viven en
`libs/composition-remotion/public/example/`, gitignoreado y hoy con sólo un `.gitignore` adentro.

## Resultado — job `ebf1b38d-4f32-435a-88c7-c632240d9459`

| Comprobación | Línea base (pre-cambio) | Medido (post-cambio) | |
| --- | --- | --- | --- |
| `sha256` de `work/renders/<job>/video-muted.mp4` | `c1b9fd9f33ba6926…4c8527cb` | `c1b9fd9f33ba6926…4c8527cb` | **idéntico** |
| `sha256` de `out/<job>.mp4` | `4bfe9f7bc07d10dd…60383225` | `4bfe9f7bc07d10dd…60383225` | **idéntico** |
| `state` del job (EP-014) | — | `succeeded`, etapas `prepare → render → mix → verify` | |
| Frames renderizados | 538 | 538 (`renderedFrames 446/538` visto a mitad de corrida) | |

`ffprobe` del entregable, stream de video: `codec_name=h264`, `1080×1920`, `r_frame_rate=30/1`,
`nb_frames=538`, `pix_fmt=yuvj420p`. Duración derivada del stream de video: **538 / 30 = 17,933 s**
(`format.duration` marca 17,984 s, inflado por el padding AAC — no es la duración del video).
Stream de audio: `aac`, `48000 Hz`, `2` canales, `duration=17.933333`.

`loudness.withinTolerance: false` (`integratedLufs -17.59`, delta `-3.59 LU`) es **idéntico** al de
las corridas previas y no es un fallo del ciclo: es el comportamiento declarado por D-7 de
`spec-e-burgos-005` (se publica el entregable y se reporta el delta). Este ciclo no lo toca.

## Conclusión

El componente conmutable con default `'render'` deja la salida del render **byte-equivalente**: no
sólo la misma cantidad de frames, los mismos bytes. El árbol que se bundlea para el render es el
mismo de antes (`<OffthreadVideo>` con `src`, `trimBefore`, `muted` y `style`), y ningún contrato
público de la lib cambió.
