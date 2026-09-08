# Planner — Cycle 2: Ejecución, verificación, mux y render mudo (`spec-e-burgos-004`)

> **Nota de procedencia.** El `sdd-planner` alcanzó a emitir `tasks.json` —el registro de máquina,
> que es la fuente de verdad del ciclo— y murió por un 429 antes de escribir este narrativo. Lo
> escribió el orquestador **derivándolo de ese `tasks.json`**, sin agregar ni quitar tasks ni
> cambiar estimaciones. El consumo del planner queda registrado como `declared-estimate`.

## Resumen

10 tasks, **26 h / 29 story points**. Cierra `spec-e-burgos-004`: la capa pura de `cycle-01`
(`src/mix/`) pasa a ejecutarse contra ffmpeg, el resultado se mide, se muxea en el MP4 de Remotion
y el render gana la opción de salir mudo.

`src/mix/` **está cerrado**: ninguna task lo modifica. El master bus de D-21/D-K se apendea al
`FilterGraph` desde `src/ffmpeg/`, sin tocar `buildAudioMixGraph` ni `serializeFilterGraph` ni sus
fixtures exactas.

## Tabla de tasks

| Task | Título | HU / CA | Archivos | h | SP | Depende de |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | [BE] `MissingMediaStreamError` + extensión de `MediaLocalErrorCode` | HU-2-01, HU-2-03 / CE-3 | `errors/missing-media-stream-error.ts`, `errors/media-local-error.ts`, `errors/errors.spec.ts` | 2 | 2 | — |
| TASK-002 | [BE] `measureLoudness` aditivo: `audioStreamSpecifier` + `FIRST_AUDIO_STREAM` | HU-2-01, HU-2-02 / D-15 | `ffmpeg/measure-loudness.ts`, `ffmpeg/loudnorm.spec.ts` | 1 | 1 | — |
| TASK-003 | [BE] Master bus: `withMasterBusLimiter` + `buildTruePeakLimiterFilter` | HU-2-01 / D-21, D-K | `ffmpeg/master-bus-limiter.ts` + spec | 2 | 2 | — |
| TASK-004 | [BE] `mixTimelineAudio` — dos pasadas de `loudnorm` + master bus | HU-2-01 / **CA-008** | `ffmpeg/mix-timeline-audio.ts` + spec | 6 | 8 | 001, 002, 003 |
| TASK-005 | [BE] `verifyMixLoudness` + las 5 fixtures nuevas | HU-2-02 / **CA-009** | `ffmpeg/verify-mix-loudness.ts` + spec, 5 `__fixtures__/ffmpeg/loudnorm-mix-*.stderr.txt` | 3 | 3 | 002 |
| TASK-006 | [BE] `muxAudioIntoVideo` — verificación del stream de video vía `probeMedia` | HU-2-03 / **CA-010** | `ffmpeg/mux-audio-into-video.ts` + spec | 2,5 | 3 | 001 |
| TASK-007 | [BE] Barrel público de `media-local` | HU-2-01..03 | `src/index.ts` | 1 | 1 | 001, 004, 005, 006 |
| TASK-008 | **[FE]** Opción `audio: 'mix' \| 'muted'` en `renderTimeline` y `TimelineComposition` | HU-2-04 / **CA-011** | `composition-remotion`: `src/render.ts`, `src/components/timeline-composition.tsx`, specs | 3 | 3 | — |
| TASK-009 | [BE] Target manual `media-local:smoke-audio`, autocontenido con ffmpeg real | HU-2-05 / **CA-012** | `smoke/smoke-audio.ts`, `smoke/smoke-register.cjs`, `tsconfig.smoke.json`, `project.json` | 3 | 3 | 007 |
| TASK-010 | [BE] Los dos READMEs y la verificación de cierre | HU-2-06, HU-2-07 / **CA-013, CA-014** | ambos `README.md` | 2,5 | 3 | 007, 008, 009 |

## Orden de ejecución y camino crítico

Las tres tasks sin dependencias (001, 002, 003) son las piezas leaf. El **camino crítico** es
`001/002/003 → 004 → 007 → 009 → 010`; TASK-005 y TASK-006 cuelgan de leaf distintas y no bloquean
a 004.

**Falsas dependencias descartadas** (leyendo el grafo de imports de §2 del `architect.md`, no la
narrativa):

- **TASK-005 no depende de TASK-004.** `verifyMixLoudness` mide un archivo ya existente: su entrada
  es un path, no la salida de `mixTimelineAudio`. Su único vínculo real es con TASK-002, por
  `MeasureLoudnessOptions`.
- **TASK-008 no depende de nada de `media-local`.** Es la única task de frontend del ciclo y vive
  entera en `libs/composition-remotion`; los boundaries Nx garantizan que no puede importar la otra
  lib. Puede ejecutarse en cualquier momento.
- **TASK-003 no depende de TASK-002.** El master bus opera sobre el `FilterGraph`, no sobre la
  medición.

## Riesgos y notas de ejecución

- **TASK-004 es la más grande (8 SP)** y la que concentra el riesgo: encadena las dos llamadas a
  `buildAudioMixGraph`, el `-map 0:a:0` de D-15, el conteo de invocaciones de CA-008 y el apéndice
  del master bus. Si algo se pone rojo dos veces, corresponde parar y reportar.
- **CA-008 son N+1 invocaciones**, no dos fijas: `N` = assets de voz distintos, que es 1 por
  construcción en toda `Timeline` de `buildTimeline`. El test cubre igual el caso general.
- **TASK-009 es la única que ejecuta binarios**, y solo fuera de CI. Vive en `libs/media-local/smoke/`,
  fuera de `src/`, para no quedar bajo el ESLint de la lib ni bajo su reporte de cobertura — así no
  hay que tocar ninguna config protegida.
- Las 5 fixtures de TASK-005 son **reconstruidas a mano**, no capturas: el README de la lib
  documenta la procedencia de cada una y el comando de regrabación.
- Pisos de cobertura a respetar en TASK-010: `media-local` ≥ 98,03 % stmts / 94,77 % ramas;
  `composition-remotion` ≥ 96,77 % / 93,16 %.
