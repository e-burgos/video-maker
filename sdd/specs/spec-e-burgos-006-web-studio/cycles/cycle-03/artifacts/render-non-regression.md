# No-regresión del render — spec-e-burgos-006 cycle-03 (TASK-028, CA-239)

> Ejecutado el 2026-09-09, **después** de D-12 (`libs/composition-remotion/src/components/timeline-video.tsx`
> gana `PLAYER_MEDIA_STYLE = { objectFit: 'fill' }` en la rama `player`, la rama `render` sin tocar). No es un
> procedimiento documentado: los hashes de abajo salieron de esta corrida real, con `media/smoke-ingest`
> **sin editar**, contra el criterio de aceptación de CA-239: reproducir el `sha256`
> `c1b9fd9f33ba6926…4c8527cb` de `cycles/cycle-02/artifacts/render-non-regression.md`.

## Gate de memoria (antes de arrancar)

```
$ pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'
(sin salida)
$ memory_pressure | tail -2
System-wide memory free percentage: 59%
$ npx remotion browser ensure
Has browser at .../node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

## Guion (copiable)

```bash
# 0. gate de memoria: ningún proceso pesado vivo y ≥35 % libre (ver arriba)

# 1. el servicio contra media/ real (4310 lo puede ocupar `pnpm sdd:docs` en esta máquina)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. un job real (EP-012) sobre smoke-ingest sin editar
curl -s -X POST http://127.0.0.1:4399/projects/smoke-ingest/jobs -H 'content-type: application/json' -d '{}'

# 3. seguimiento (EP-014) hasta terminal
curl -s http://127.0.0.1:4399/jobs/<jobId>

# 4. la comparación
shasum -a 256 media/smoke-ingest/work/renders/<jobId>/video-muted.mp4 media/smoke-ingest/out/<jobId>.mp4

# 5. ffprobe contra el STREAM DE VIDEO, nunca format.duration (lección vigente: format.duration
#    infla por el padding AAC del stream de audio)
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt \
  -of default=noprint_wrappers=1 media/smoke-ingest/out/<jobId>.mp4
```

## Resultado — job `7077461d-b887-4fc7-b130-57f51e8858b9`

| Comprobación | Línea base (cycle-02, pre-D-12) | Medido (post-D-12) | |
| --- | --- | --- | --- |
| `sha256` de `work/renders/<job>/video-muted.mp4` | `c1b9fd9f33ba6926…4c8527cb` | `c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb` | **idéntico** |
| `sha256` de `out/<job>.mp4` | `4bfe9f7bc07d10dd…60383225` | `4bfe9f7bc07d10dd6aa1fa6e65c1054dcd0178fe4865f4ae6f34784b60383225` | **idéntico** |
| `state` del job (EP-014) | — | `succeeded`, etapas `prepare → render → mix → verify` | |
| Progreso observado en vivo | `renderedFrames 446/538` (cycle-02) | `renderedFrames 535/538` (esta corrida, tick de 5 s) | ambos con `stage: 'render'` |
| Duración total del job | — | `startedAt` 07:52:53.921 → `finishedAt` 07:53:15.872 → **~22 s** | |

`ffprobe` del entregable, **stream de video** (nunca `format.duration`): `codec_name=h264`,
`1080×1920`, `r_frame_rate=30/1`, `nb_frames=538`, `pix_fmt=yuvj420p`. Duración derivada del stream
de video: `538 / 30 = 17,933 s`.

`ffprobe` del entregable, stream de audio: `codec_name=aac`, `sample_rate=48000`, `channels=2`,
`duration=17.933333`.

`loudness.withinTolerance: false` (`integratedLufs -17.59`, `truePeakDbtp -4.03`, delta `-3.59 LU`) es
**idéntico** al de `cycle-02` y no es un fallo de este ciclo: es el comportamiento declarado por D-7 de
`spec-e-burgos-005` (se publica el entregable y se reporta el delta). Este ciclo no lo toca.

## Conclusión

El cambio de D-12 en `libs/composition-remotion/src/components/timeline-video.tsx` (constante
`PLAYER_MEDIA_STYLE` + spread en la rama `player`) deja la salida del render **byte-equivalente**:
mismo `sha256` en `video-muted.mp4` y en `out/<job>.mp4` que la línea base de `cycle-02`, misma
cantidad de frames, mismo codec, mismo pixel format. La rama `render`
(`<OffthreadVideo src={src} trimBefore={trimBefore} muted style={style} />`) quedó carácter por
carácter igual, como confirma `git diff` sobre el archivo (revisado en TASK-023), y esta corrida es
la confirmación empírica de ese invariante: **CA-239 cumplido**.

## Notas de bisección de bundle (TASK-026/TASK-027) — para que no se re-investiguen

Durante el cableado de `apps/web` (fuera del alcance de este archivo, pero registrado acá porque el
architect pidió dejar constancia en la evidencia del ciclo):

- **TASK-026:** el chunk inicial de `apps/web` creció 453.22 → 453.24 kB (+21 bytes) al cablear
  `TimelineSaveBar`. Aislado con `git stash` + bisección por import; diff de bytes normalizado
  (ignorando los nombres de archivo con hash) mostró que el único delta es un **reordenamiento de
  alias minificados de 1-2 letras** sobre el mismo conjunto de símbolos exportados de un chunk
  compartido (`export{$n as a,...}` vs `export{nr as a,...}`) — cero módulos nuevos, no es Zod ni
  `timeline-edit`.
- **TASK-027:** el chunk inicial creció 453.24 → 453.38 kB (+143 bytes) al cablear `RenderJobPanel`
  específicamente (aislado igual, por bisección). El diff normalizado mostró un cambio en **código
  interno de React** (una función factory de Fiber, patrón `function kr(e,t,n,r){return
  e=g(7,e,r,t),...}` vs una variante con menos funciones separadas): Terser decide inlinear o no un
  helper según cuántos call-sites totales lo usan en **todo** el bundle, y el nuevo patrón de uso de
  React en `RenderJobPanel` (lazy) desplaza esa cuenta, afectando el tamaño del código compartido de
  `react-dom` que vive en el chunk inicial.
- **Verificación independiente en ambos casos:** `grep` sobre el chunk inicial real de los símbolos
  `ZodError`, `_zod`, `timelineEditReducer`, `canonicalTimelineJson`, `rescaleMusicAutomation`,
  `renderJobDeliverableUrl`, `showsFrameProgress`, `isTerminalRenderJobState`, `useRenderJobPoll` y
  `RenderJobPanel` — los diez dan `not found`. `timeline-edit/**` y Zod siguen entrando **sólo** por
  la ruta perezosa; los bytes de más son enteramente entropía de minificación, no código de producto.
