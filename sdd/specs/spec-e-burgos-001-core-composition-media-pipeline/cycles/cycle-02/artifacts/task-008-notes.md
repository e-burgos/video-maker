# TASK-008 — notas del implementador

## 1. Auditoría de `src/index.ts` contra §3 del `architect.md`

`architect.md` §3 es explícito: "Todo lo de esta sección se exporta desde `src/index.ts`, y nada
más". Las tasks anteriores (TASK-003/004/005/007) habían agregado al barrel varios símbolos que no
están en ningún listado de §3 y que los propios specs de esas tasks ya importaban por **ruta
relativa**, nunca desde el barrel (mismo patrón que documenta el README de `timeline-core`). Se
quitaron de `src/index.ts`:

- `FFPROBE_ARGS` (`probe-media.ts`) — usado internamente y en `ffprobe.spec.ts` por ruta relativa.
- `truncateStderr` (`command-failed-error.ts`) — ídem, usado por `errors.spec.ts`.
- `groupTokensIntoWords` (`parse-whisper-cpp-json.ts`) — ídem, usado por `whisper-parsers.spec.ts`.
- `DEFAULT_WHISPER_LANGUAGE` (`transcribe-with-whisper-cpp.ts`) — sentinel interno de la task 007.
- `extractTrailingJsonObject` (`parse-loudnorm-json.ts`) — ídem, usado por `loudnorm.spec.ts`.
- `DEFAULT_EXTRACT_AUDIO_CHANNELS` / `DEFAULT_EXTRACT_AUDIO_SAMPLE_RATE` (`extract-audio.ts`) —
  ídem, usados por `extract-audio.spec.ts`.

Se **agregó** el bloque de re-exports de tipos de `timeline-core` que pide §3.8
(`AssetId, Ms, MediaAsset, MediaKind, SilenceRange, Transcription, TranscriptionEngine,
VoiceTarget, Word`) — ninguna task anterior lo había creado, y sin él un consumidor de
`media-local` no podía tipar una firma sin importar además `@video-maker/timeline-core` a mano,
que es justo lo que §3 dice que este re-export evita.

Se reordenó el archivo para seguir la numeración de §3 (runner/errores → binarios/reloj/fs →
ffprobe → silencios → loudness → extracción de audio → whisper → re-exports de tipos), en vez del
orden de llegada task-by-task que tenía antes.

Ningún spec de la lib importaba estos símbolos desde el barrel (`@video-maker/media-local` o
`../index`), así que el recorte no rompió ningún test: `pnpm nx run-many -t lint test build
-p media-local` sigue en verde con los mismos 155 tests (124 preexistentes + 31 agregados en esta
task) después del cambio.

## 2. Cobertura: de 80.13% de ramas a 94.77%

La suite heredada de TASK-003..007 cerraba en el borde del umbral (branches 80.13%, ver
`task-004-notes.md`). Se agregaron tests puntuales sobre ramas de producción no cubiertas,
sin tocar ningún umbral de `vite.config.ts`:

- `parse-ffprobe-json.ts`: casos de `parseRational`/`resolveRotation`/`classifyKind` llamados en
  forma directa (funciones ya exportadas del módulo) y variantes de JSON sin `fps`/`width`/
  `height`/`codec_name`/`channels`/`duration` para video, audio e imagen.
- `probe-media.ts`: `assetId` explícito + `systemClock` por default (ningún test previo dejaba los
  dos sin definir a la vez).
- `resolve-binaries.ts`: `env.PATH` ausente y `opts` completamente omitido (usa `nodeBinaryLookup`
  por default) — antes todos los tests siempre inyectaban `{ lookup }` y un `PATH` definido.
- `normalize-voice.ts`: `runOptions` reenviado a las dos pasadas de `ffmpeg`.
- `whisper-parsers.spec.ts`: casos borde de `parseFasterWhisperJson` (falla de schema con JSON
  válido pero mal formado, palabra vacía tras `trim`, segmento sin palabras válidas, `start`/`end`/
  `text` de segmento ausentes, `probability` ausente, override de `language`/`model`, y el caso sin
  ninguno de los dos en el JSON); `parseWhisperCppJson` con transcripción reducida a tokens
  especiales (cero palabras, cero segmentos) y con `result.language`/`params.language` ausentes en
  distintas combinaciones.
- `build-transcription.ts`: llamada directa con un `language` inválido para forzar el rechazo de
  `TranscriptionSchema` (única forma de llegar a esa rama sin pasar por un parser).
- `transcribe-with-whisper-cpp.ts`: corrida con `readTextFile` **omitido** (usa `nodeReadTextFile`
  por default) contra un archivo temporal real (`node:fs/promises` + `os.tmpdir()`), sin ejecutar
  ningún proceso — solo agrega I/O de filesystem, permitido por D-13/regla 7.

Quedan sin cubrir, a propósito, ramas que las reglas del ciclo prohíben ejercitar o que son
defensivas y no alcanzables desde la API pública:

- `execa-command-runner.ts` (constructor y método `run` de `ExecaCommandRunner`, 40% de ramas):
  regla 7 de `architect.md` prohíbe instanciar `ExecaCommandRunner` en cualquier `*.spec.ts`. Ya
  estaba así desde TASK-002 (ver `task-004-notes.md`); esta task no lo toca porque cubrirlo violaría
  esa regla, no por omisión.
- `parse-ffprobe-json.ts` líneas 174/205 (`buildVideoAsset`/`buildAudioAsset` lanzando si
  `videoStream`/`audioStream` es `undefined`): son guardas defensivas de funciones privadas del
  módulo; `classifyKind` garantiza que ese `undefined` nunca llega ahí a través de
  `parseFfprobeJson`, así que solo son alcanzables llamando a funciones no exportadas.
- `parse-whisper-cpp-json.ts` línea 46 (`lastWord === undefined` dentro de `groupTokensIntoWords`):
  inalcanzable por construcción — `startsWord` fuerza que la primera palabra siempre abra cuando
  `words.length === 0`, así que `lastWord` nunca es `undefined` cuando se llega a esa rama.
- `parse-faster-whisper-json.ts` línea 71 (`firstWord === undefined || lastWord === undefined`
  dentro del `if (words.length > first)`): mismo tipo de guarda defensiva, inalcanzable dado que
  `words.length > first` ya garantiza que ambos existen.

Cobertura final de `media-local` (`pnpm nx test media-local`): **98.03% líneas / 94.77% ramas /
97.67% funciones / 98.03% statements**, con 155 tests (todos deterministas, sin binarios).

## 3. README

Reescrito por completo siguiendo el estilo de `libs/timeline-core/README.md`: propósito y límites,
matriz de binarios con instalación en macOS, las cuatro variables de entorno con su precedencia,
tabla de la API pública (wrapper → comando → contrato), cómo inyectar cada puerto en tests, los
tres comandos de Nx, procedencia de las fixtures con los comandos exactos para regrabar cada una
contra binarios reales, y una sección de smoke manual con un script de 5 líneas usando
`ExecaCommandRunner`. No repite contenido de la spec (RF/RNF/CA): solo referencia lo que ya
documentan `architect.md` y las notas de tasks anteriores.
