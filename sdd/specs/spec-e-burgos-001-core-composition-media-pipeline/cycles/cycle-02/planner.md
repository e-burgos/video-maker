# Sprint Plan — Cycle 2: Core Composition & Media Pipeline Engine (media-local)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo                | Valor                                                          |
| --------------------- | --------------------------------------------------------------- |
| Ciclo                 | 2                                                               |
| Módulo                | core-composition-media-pipeline (`libs/media-local`)           |
| Duración estimada     | ~1 semana                                                       |
| Story points totales  | 30                                                               |
| Horas totales         | 26 h                                                             |
| Tasks                 | 8 (todas backend — lib Node sin UI ni endpoints en este ciclo) |

No hay tasks de frontend en este ciclo: `libs/media-local` es una lib de wrappers Node sin UI ni
endpoints (ver `brief.yaml` → `out_of_scope`).

---

## Tasks backend

### TASK-001: Scaffold de libs/media-local con scaffold-nx

- **Historias:** infraestructura común a US-2-001..US-2-009
- **CA que cierra:** ninguno directamente (prerequisito de todos)
- **Descripción:** Usar la skill `scaffold-nx` para generar `libs/media-local` con `@nx/js:lib`
  (vitest), tags `scope:engine`/`type:util`, dependiendo solo de `@video-maker/timeline-core`.
  Agregar alias `@video-maker/media-local` en `tsconfig.base.json` (mismo patrón que
  `@video-maker/timeline-core` de `cycle-01`). Dejar targets explícitos en `project.json` —
  `lint` (`@nx/eslint:lint`), `test` (`vitest run --coverage --passWithNoTests`), `build`
  (`tsc -p tsconfig.lib.json`) — sin depender de plugins inferidos en `nx.json`, replicando el
  ajuste que dejó `cycle-01` (ver `cycle-01/artifacts/task-001-scaffold-notes.md`). Agregar
  `execa` como dependencia de esta lib en el `package.json` raíz (o el de la lib, según decida
  `architect.md`), pinneando el patch vigente de `^10`. `src/index.ts` vacío como única
  superficie pública inicial y README mínimo con propósito y comandos.
- **Archivos a crear/modificar:**
  - `libs/media-local/project.json`
  - `libs/media-local/package.json`
  - `libs/media-local/tsconfig.json`
  - `libs/media-local/tsconfig.lib.json`
  - `libs/media-local/src/index.ts`
  - `libs/media-local/README.md`
  - `tsconfig.base.json` (alias `@video-maker/media-local`)
  - `package.json` raíz (dependencia `execa`)
- **Criterio de done:**
  - [ ] `pnpm nx test media-local` y `pnpm nx lint media-local` corren en verde sin tests aún
  - [ ] Tags Nx `scope:engine, type:util` aplicados; `@nx/enforce-module-boundaries` permite
        depender de `timeline-core` (tag `type:domain`) y de nada más del repo
  - [ ] `nx.json` no gana plugins inferidos nuevos por este scaffold (mismo criterio que dejó
        cycle-01: targets `lint`/`test`/`build` explícitos en `project.json`)
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** ninguna

### TASK-002: CommandRunner, ExecaCommandRunner, FixtureCommandRunner, errores tipados y resolveBinaries

- **Historias:** US-2-008, US-2-009
- **CA que cierra:** CA-021, CA-022
- **Descripción:** Definir la interfaz `CommandRunner` (`run(bin, args, opts): Promise<{ stdout,
  stderr, exitCode }>`), su implementación real `ExecaCommandRunner` sobre `execa`, y
  `FixtureCommandRunner` para tests (devuelve stdout/stderr/exitCode pregrabados según el bin/args
  invocado). Errores tipados: `BinaryNotFoundError` (nombre del binario faltante),
  `CommandFailedError` (comando, args y `stderr` truncado a 2 KB) y `UnparseableOutputError`.
  Implementar `resolveBinaries(env)`: lee `FFMPEG_PATH`/`FFPROBE_PATH`/`WHISPER_CPP_PATH`/
  `WHISPER_MODEL_PATH` de `env`, con fallback a buscar el binario en el `PATH`; si ninguna de las
  dos ubicaciones resuelve el binario, lanza `BinaryNotFoundError` con su nombre. Nunca descarga
  ni instala nada (RN-8).
- **Archivos a crear/modificar:**
  - `libs/media-local/src/runner/command-runner.ts`
  - `libs/media-local/src/runner/execa-command-runner.ts`
  - `libs/media-local/src/runner/fixture-command-runner.ts`
  - `libs/media-local/src/runner/errors.ts`
  - `libs/media-local/src/runner/runner.spec.ts`
  - `libs/media-local/src/binaries/resolve-binaries.ts`
  - `libs/media-local/src/binaries/binaries.spec.ts`
- **Criterio de done:**
  - [ ] CA-021: `resolveBinaries` prioriza las variables de entorno dedicadas sobre el `PATH`, y
        lanza `BinaryNotFoundError` con el nombre exacto del binario faltante cuando no aparece
        en ninguna de las dos ubicaciones
  - [ ] CA-022: `CommandFailedError` expone comando, args y `stderr` truncado a 2 KB (probado con
        un stderr más largo que el límite)
  - [ ] `FixtureCommandRunner` nunca ejecuta un proceso real (ni siquiera `execa` importado desde
        ese módulo)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-001

### TASK-003: probeMedia + parseFfprobeJson con fixtures de video rotado, imagen y audio

- **Historias:** US-2-001, US-2-002
- **CA que cierra:** CA-017
- **Descripción:** `probeMedia(path, runner)` arma y ejecuta `ffprobe -v quiet -print_format json
  -show_format -show_streams` vía el `CommandRunner` inyectado; `parseFfprobeJson(json)` es un
  parser puro que interpreta esa salida hacia `MediaAsset` (RN-1): de un video informa
  `durationMs`, `fps`, `width`/`height` y `hasAudio`; de una imagen, solo su `kind` (sin
  `durationMs` ni `fps`, RN-1); de un audio, `durationMs` y sus datos de sonido (`sampleRate`,
  `channels`). RN-2: si el stream de video trae metadata de rotación (90°/180°/270°), `width` y
  `height` reportados son los de la imagen ya rotada como se ve en pantalla, nunca los crudos del
  sensor. Grabar (o reconstruir fielmente desde la documentación oficial de `ffprobe
  -print_format json`, si no hay binario disponible) tres fixtures: mp4 1080×1920 con `rotate:
  90` en sus tags, jpg, y wav.
- **Archivos a crear/modificar:**
  - `libs/media-local/src/ffprobe/probe-media.ts`
  - `libs/media-local/src/ffprobe/parse-ffprobe-json.ts`
  - `libs/media-local/src/ffprobe/ffprobe.spec.ts`
  - `libs/media-local/src/__fixtures__/ffprobe-video-rotated.fixture.json`
  - `libs/media-local/src/__fixtures__/ffprobe-image.fixture.json`
  - `libs/media-local/src/__fixtures__/ffprobe-audio.fixture.json`
- **Criterio de done:**
  - [ ] CA-017: las tres fixtures (video con rotación, imagen, audio) parsean a un `MediaAsset`
        correcto — la del video con `width`/`height` ya intercambiados por la rotación de 90°
  - [ ] `parseFfprobeJson` rechaza con `UnparseableOutputError` un JSON que no tiene la forma
        esperada de ffprobe
- **Nota para el implementador:** si no hay `ffprobe` real disponible, reconstruir el JSON de
  fixture fielmente desde la documentación oficial de `ffprobe -print_format json
  -show_format -show_streams` (estructura `format`/`streams`, `tags.rotate` o
  `side_data_list` según la versión) y dejarlo anotado en el PR.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002

### TASK-004: detectSilencesWithFfmpeg + parseSilenceDetect con fixture de 3 silencios

- **Historias:** US-2-003
- **CA que cierra:** CA-018
- **Descripción:** `detectSilencesWithFfmpeg(path, opts, runner)` arma y ejecuta `ffmpeg -af
  silencedetect=noise=-35dB:d=0.5 -f null -` (umbral y duración de RN-3) vía el `CommandRunner`;
  `parseSilenceDetect(stderr, durationMs)` es un parser puro del stderr de `silencedetect` que
  devuelve `SilenceRange[]`. RN-3: un tramo de silencio que sigue abierto hasta el final del
  archivo (sin `silence_end` en el stderr) se cierra exactamente en `durationMs`, nunca queda
  abierto. Grabar (o reconstruir fielmente el formato de líneas `[silencedetect @ ...] silence_start:
  X` / `silence_end: Y | silence_duration: Z`) una fixture de stderr con 3 tramos, el último sin
  `silence_end`.
- **Archivos a crear/modificar:**
  - `libs/media-local/src/ffmpeg/detect-silences-with-ffmpeg.ts`
  - `libs/media-local/src/ffmpeg/parse-silence-detect.ts`
  - `libs/media-local/src/ffmpeg/silencedetect.spec.ts`
  - `libs/media-local/src/__fixtures__/silencedetect-stderr.fixture.txt`
- **Criterio de done:**
  - [ ] CA-018: la fixture de 3 silencios produce 3 `SilenceRange`, el último cerrado
        exactamente en `durationMs` del asset de prueba
- **Nota para el implementador:** si no hay `ffmpeg` real disponible, reconstruir el stderr de
  fixture desde el formato documentado del filtro `silencedetect` y dejarlo anotado en el PR.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-002

### TASK-005: measureLoudness + normalizeVoice en dos pasadas con fixture de loudnorm

- **Historias:** US-2-004
- **CA que cierra:** CA-020
- **Descripción:** `measureLoudness(path, runner)` ejecuta `ffmpeg -af
  loudnorm=print_format=json -f null -` y su parser puro devuelve `{ integratedLufs,
  truePeakDbtp, loudnessRange }` (más `measured_thresh` para reuso interno). `normalizeVoice(path,
  out, target, runner)` implementa la normalización en dos pasadas de RN-4: la primera pasada mide
  con `measureLoudness`; la segunda pasada aplica `loudnorm` pasando siempre los `measured_I`,
  `measured_TP`, `measured_LRA`, `measured_thresh` de la primera medición (nunca un valor
  genérico) junto al `target` (`AudioMixPlan.voice`, por defecto `I=-14:TP=-1:LRA=11`). Grabar (o
  reconstruir desde la documentación de `loudnorm print_format=json`) una fixture de la salida
  JSON de la primera pasada.
- **Archivos a crear/modificar:**
  - `libs/media-local/src/ffmpeg/measure-loudness.ts`
  - `libs/media-local/src/ffmpeg/normalize-voice.ts`
  - `libs/media-local/src/ffmpeg/loudnorm.spec.ts`
  - `libs/media-local/src/__fixtures__/loudnorm-measure.fixture.json`
- **Criterio de done:**
  - [ ] CA-020: con `FixtureCommandRunner`, la segunda pasada de `normalizeVoice` recibe en sus
        argumentos `measured_I`, `measured_TP`, `measured_LRA` y `measured_thresh` provenientes
        exactamente de la primera pasada, y apunta a `I=-14:TP=-1:LRA=11`
- **Nota para el implementador:** si no hay `ffmpeg` real disponible, reconstruir el JSON de
  fixture desde el formato documentado de `loudnorm print_format=json` y dejarlo anotado en el PR.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002

### TASK-006: extractAudioForTranscription (wav mono 16 kHz)

- **Historias:** US-2-005
- **CA que cierra:** ninguno numerado — prerrequisito de CA-019 (documentado en `functional.md` →
  Trazabilidad, US-2-005 sin CA propio)
- **Descripción:** `extractAudioForTranscription(path, out, runner)` arma y ejecuta `ffmpeg -vn
  -ac 1 -ar 16000 -c:a pcm_s16le` (RN-5) vía el `CommandRunner`, sin importar el formato o
  cantidad de canales del audio de entrada. Es la función que produce el `.wav` que consumen las
  tasks de transcripción de este mismo ciclo (TASK-007).
- **Archivos a crear/modificar:**
  - `libs/media-local/src/ffmpeg/extract-audio-for-transcription.ts`
  - `libs/media-local/src/ffmpeg/extract-audio.spec.ts`
- **Criterio de done:**
  - [ ] Los argumentos armados hacia el `CommandRunner` son exactamente `-vn -ac 1 -ar 16000 -c:a
        pcm_s16le` más los paths de entrada/salida, sin flags adicionales
  - [ ] El wav de salida declarado es el mismo que documentan los fixtures de whisper de TASK-007
        como "audio de origen"
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** TASK-002

### TASK-007: transcribeWithWhisperCpp + parseWhisperCppJson + parseFasterWhisperJson

- **Historias:** US-2-006, US-2-007
- **CA que cierra:** CA-019
- **Descripción:** `transcribeWithWhisperCpp(wavPath, opts, runner)` arma y ejecuta `whisper-cli -m
  <model> -f <wav> -oj -ml 1` (una palabra por token, RN-6) vía el `CommandRunner`.
  `parseWhisperCppJson(json, assetId)` y `parseFasterWhisperJson(json, assetId)` son parsers puros
  que normalizan cada formato hacia `Transcription` (aplicando `normalizeTranscriptionWords` de
  `@video-maker/timeline-core` antes de validar contra el schema, según dejó documentado
  `cycle-01`). RN-6: cada palabra es una entrada propia, nunca agrupa ni fragmenta. RN-7: para el
  mismo audio, ambos parsers deben producir igual cantidad de palabras y una diferencia de tiempo
  por palabra ≤ 20 ms (CA-019). Grabar (o reconstruir desde la documentación de `whisper.cpp -oj`
  y del JSON de `faster-whisper` con `word_timestamps=True`) dos fixtures del **mismo audio de
  referencia**, una por motor.
- **Archivos a crear/modificar:**
  - `libs/media-local/src/whisper/transcribe-with-whisper-cpp.ts`
  - `libs/media-local/src/whisper/parse-whisper-cpp-json.ts`
  - `libs/media-local/src/whisper/parse-faster-whisper-json.ts`
  - `libs/media-local/src/whisper/whisper-parsers.spec.ts`
  - `libs/media-local/src/__fixtures__/whisper-cpp.fixture.json`
  - `libs/media-local/src/__fixtures__/faster-whisper.fixture.json`
- **Criterio de done:**
  - [ ] CA-019: sobre las dos fixtures del mismo audio, ambos parsers devuelven igual cantidad de
        palabras y cada palabra equivalente difiere en `startMs`/`endMs` en ≤ 20 ms
  - [ ] Ninguna palabra de ninguno de los dos resultados agrupa más de una palabra dicha ni
        representa un fragmento parcial (RN-6)
- **Nota para el implementador:** si no hay `whisper-cli` ni Faster-Whisper reales disponibles,
  reconstruir ambas fixtures fielmente desde la documentación oficial de sus formatos JSON
  (`whisper.cpp -oj`, `faster-whisper` con `word_timestamps=True`), manteniendo el mismo audio de
  referencia y transcripción entre ambas, y dejarlo anotado en el PR.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002, TASK-006

### TASK-008: README con matriz de binarios/env vars, export público final y cobertura ≥ 80 %

- **Historias:** US-2-001, US-2-002, US-2-003, US-2-004, US-2-005, US-2-006, US-2-007, US-2-008,
  US-2-009
- **CA que cierra:** ninguno numerado directamente — verifica en conjunto CA-017 a CA-022
- **Descripción:** Consolidar `src/index.ts` como única superficie pública de `libs/media-local`
  (todas las funciones de la tabla "Wrappers locales" de la spec: `resolveBinaries`,
  `probeMedia`, `detectSilencesWithFfmpeg`, `measureLoudness`, `normalizeVoice`,
  `extractAudioForTranscription`, `transcribeWithWhisperCpp`, `parseFasterWhisperJson`, parsers
  puros y errores tipados). Escribir el README con: matriz de binarios (`ffmpeg`/`ffprobe` ≥ 6.0,
  `whisper-cli` ≥ 1.7) y sus variables de entorno (`FFMPEG_PATH`, `FFPROBE_PATH`,
  `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`) con su fallback al `PATH`; aclarar que ningún test de
  la suite ejecuta un binario real (RN-9). Cerrar con `pnpm nx test media-local --coverage` ≥
  80 % y `pnpm nx lint media-local` / `pnpm nx build media-local` en verde.
- **Archivos a crear/modificar:**
  - `libs/media-local/src/index.ts`
  - `libs/media-local/README.md`
- **Criterio de done:**
  - [ ] `pnpm nx test media-local --coverage` reporta ≥ 80 % de cobertura de líneas
  - [ ] `pnpm nx lint media-local` y `pnpm nx build media-local` en verde
  - [ ] El README documenta la matriz completa de binarios/versión mínima/variable de entorno y
        deja explícito que la suite no ejecuta binarios reales
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-003, TASK-004, TASK-005, TASK-006, TASK-007

## Tasks frontend

Ninguna — `libs/media-local` no tiene UI ni endpoints en este ciclo.

## Orden de ejecución

```
TASK-001 → TASK-002 ─┬─→ TASK-003 ──────────────────────┐
                      ├─→ TASK-004 ──────────────────────┤
                      ├─→ TASK-005 ──────────────────────┼─→ TASK-008
                      └─→ TASK-006 ─┬─────────────────────┤
                                    └─→ TASK-007 ──────────┘
```

TASK-003, TASK-004, TASK-005 y TASK-006 solo requieren TASK-002 y pueden avanzar en paralelo entre
sí. TASK-007 requiere además TASK-006 (el wav de `extractAudioForTranscription` es el audio de
referencia de sus fixtures). El camino crítico es
TASK-001 → TASK-002 → TASK-006 → TASK-007 → TASK-008.

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.
