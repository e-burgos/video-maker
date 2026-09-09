# E2E `montage-smoke` — de `raw/` al MP4 por la web (spec-007 cycle-02, TASK-007)

> Ejecutado el 2026-09-09 sobre `apps/web` + `apps/render-api` en esta máquina.
> Salida literal completa: `montage-smoke-run.log` (sólo se filtraron las líneas repetidas
> `GET /jobs/<id> returned ok`). Capturas: `montage-smoke-0{1..5}-*.png`.

## Guion copiable

```bash
# gate de memoria (obligatorio antes de montar o renderizar)
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || echo "no heavy"
memory_pressure | tail -1          # ≥ 35 % libre

# el script carga por su cuenta las cuatro variables de media del .env raíz
node apps/web/e2e/montage-smoke.mjs
```

Nunca lanzar dos E2E a la vez (la cola del servicio garantiza que no coincidan transcripción y
render dentro de un proceso, no entre dos procesos). El script **nunca** toca `media/` del dev:
copia sólo `media/smoke-ingest/raw/` a un `RENDER_API_MEDIA_ROOT` temporal y lo borra al salir.

## Qué recorre (y qué verifica en cada paso)

| Paso | Acción por la web | Verificación |
| --- | --- | --- |
| 1 | copia de `media/smoke-ingest/raw/` a un media root temporal | sin `work/`, sin `out/` |
| 2 | levanta `apps/render-api` | `capabilities.montageQueue: true` y los **4** binarios resueltos |
| 3 | levanta `apps/web` con el proxy `/api` | `GET /api/projects` responde |
| 4 | abre la lista de proyectos → biblioteca | `asset-source = raw-scan`, tarjetas de a-roll/b-roll/imagen/audio visibles |
| 5 | "Generate montage" habilitado | el servicio puede montar |
| 6 | click en "Generate montage" | `202`, `kind: "montage"`, progreso por etapa en la **UI** y en `EP-014` |
| 7 | la app salta sola al preview | `timeline-player` montado, URL `/projects/smoke-ingest/preview` |
| 7 | artefactos en disco | `edl.json` **byte-idéntico** a la CLI; `timeline.json`/`catalog.json` idénticos al normalizar |
| 8 | segundo "Generate montage" | `409 TIMELINE_ALREADY_EXISTS`, confirmación en pantalla, disco intacto al descartar |
| 9 | edición de los 6 clips de a-roll + Save | `data-timeline-dirty="false"`, `durationFrames` en disco |
| 10 | "Render" | `kind: "render"`, progreso por frame, `succeeded` |
| 11 | descarga del MP4 + `ffprobe` | `nb_frames` del **stream de video** == `timeline.durationFrames` |

## Medidas de esta corrida

- **Montaje: 4,7 s.** Etapas por API: `probe → transcribe → plan` (`discover` es instantáneo y no
  llega a observarse en un muestreo de 200 ms). Etapas capturadas en la **UI**:
  `stage: probe | stage: transcribe`.
- **Render: 11,7 s.** Etapas: `render → mix → mux → verify`, con progreso por frame observado.
- **MP4 descargado:** 626.568 bytes.

```
video stream: {"codec_name":"h264","width":1080,"height":1920,"pix_fmt":"yuvj420p",
               "r_frame_rate":"30/1","nb_frames":"133"}
audio stream: {"codec_name":"aac","sample_rate":"48000","channels":2,"duration":"4.433333"}
derivado del stream de video (nunca de format.duration): 133 frames @ 30 fps = 4,433 s
```

`nb_frames = 133 == timeline.durationFrames = 133` tras acortar los seis clips de a-roll
(89→30, 94→25, 66→20, 75→20, 83→20, 138→25).

## Corrección del oráculo de byte-identidad (medida, no razonada)

La primera corrida **falló** afirmando `sha256(work/timeline.json) == sha256(CLI)`. El fallo es del
oráculo, no del producto: `catalog.json` y `timeline.json` embeben `probedAt` y `modifiedAtMs`, que
son marcas de la ingesta y cambian entre corridas — exactamente lo que `cycle-01` ya había medido.
El invariante real de la spec (RNF-1) se verifica en tres asserts:

1. `work/edl.json` **byte-idéntico** al de la CLI (`f96256aaddba…` en las dos corridas) — es el
   artefacto sin timestamps, y es el que decide el render.
2. `timeline.json` y `catalog.json` idénticos **tras remover recursivamente `probedAt` y
   `modifiedAtMs`**.
3. El `sha256` crudo de `timeline.json` puede diferir, y se deja escrito que puede.

El oráculo del punto 2 se probó sensible sin querer: la corrida 1 lo hizo fallar con el
`sha256` crudo, y las dos corridas dieron `catalog` distintos (`fb88e6b24d41…` vs `7202b9a23bdc…`)
y `edl` idéntico — es decir, distingue lo volátil de lo semántico.

## Hallazgos abiertos

- **`processedAssets`/`totalAssets` llegan siempre en `null` en este proyecto.** Las etapas se
  reportan bien, pero el contador de assets nunca se pobló durante `probe`/`transcribe`
  (`assets=—/— percent=—` en las dos corridas). `apps/web` lo muestra en cuanto el servicio lo
  mande (test unitario `MontageJobPanel > shows the asset counter during transcribe`); el que no lo
  emite es el decorador del `CommandRunner` de `apps/render-api` (D-5 de `cycle-01`), con este
  proyecto de un asset por rol. Candidato a `[FIX]` contra `apps/render-api`, fuera del alcance de
  este ciclo: ningún CA de la spec exige el contador poblado.
- **Un `404` de `/favicon.ico` en consola** en cada corrida: conocido desde `spec-006`, no es un
  defecto.
