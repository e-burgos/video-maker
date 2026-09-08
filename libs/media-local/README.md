# media-local

Lib Node de I/O acotada: envuelve `ffprobe`, `ffmpeg` y `whisper-cli` (whisper.cpp) detrás de un
`CommandRunner` inyectable y convierte su salida a los contratos de `@video-maker/timeline-core`.
Sin base de datos, sin endpoints HTTP, sin UI.

Se importa por source vía el alias `@video-maker/media-local`.

## Límites de la lib

- **Es la única puerta a binarios locales del repo.** Ningún otro módulo debe spawnear `ffmpeg`,
  `ffprobe` ni `whisper-cli` por su cuenta: todo pasa por los wrappers de acá.
- **Cero binarios en CI.** Nada de lo que corre en `pnpm nx test media-local` ejecuta un proceso
  real: `ExecaCommandRunner` no se instancia en ningún `*.spec.ts` y toda la suite corre contra
  `FixtureCommandRunner` con las fixtures de `src/__fixtures__/`.
- **Nada se descarga automáticamente.** Ni los binarios ni el modelo de whisper.cpp: el usuario los
  instala a mano (ver matriz abajo) y los apunta con variables de entorno o los deja resolver por
  `PATH`.
- Los schemas Zod de las salidas externas y las fixtures son detalle de implementación: no se
  exportan desde `src/index.ts`.

## Matriz de binarios

| Binario | Versión mínima | Variable de entorno | Cómo instalarlo en macOS |
| --- | --- | --- | --- |
| `ffmpeg` | 6.0 | `FFMPEG_PATH` | `brew install ffmpeg` |
| `ffprobe` | 6.0 | `FFPROBE_PATH` | viene con el paquete de `ffmpeg` de Homebrew |
| `whisper-cli` (whisper.cpp) | 1.7 | `WHISPER_CPP_PATH` | `brew install whisper-cpp`, o compilar con `WHISPER_METAL=1 make` para usar la GPU en Apple Silicon |
| Modelo whisper (`ggml-*.bin`) | — | `WHISPER_MODEL_PATH` | descargar a mano; recomendado `ggml-large-v3-turbo-q5_0` (~550 MB, entra holgado en 16 GB unificados de un M2), fallback `ggml-small` en equipos con menos RAM |

**Faster-Whisper** no es un binario que este módulo invoque: `parseFasterWhisperJson` solo consume
el **formato JSON** que ese motor produce (para comparar equivalencia con whisper.cpp, CA-019). No
hay variable de entorno ni resolución de binario para Faster-Whisper.

## Variables de entorno

Las cuatro que resuelve `resolveBinaries`/`resolveBinary`, con **precedencia `env` > `PATH`**:

| Variable | Binario que resuelve |
| --- | --- |
| `FFMPEG_PATH` | `ffmpeg` |
| `FFPROBE_PATH` | `ffprobe` |
| `WHISPER_CPP_PATH` | `whisper-cli` |
| `WHISPER_MODEL_PATH` | modelo `ggml-*.bin` (sin fallback a `PATH`: un modelo no es ejecutable) |

Si la variable está fijada pero apunta a una ruta inexistente o no ejecutable, **no cae a `PATH`**:
lanza `BinaryNotFoundError` de una (evita ejecutar por error un binario distinto al que el usuario
pidió explícitamente). Sin la variable, busca en cada directorio de `PATH`, en orden, el nombre de
comando correspondiente (`ffmpeg`, `ffprobe`, `whisper-cli`; el modelo no tiene nombre de comando).

La resolución es un lookup **puro sobre el filesystem** (`fs.access` + `stat`), nunca
`<binario> --version`: por eso no valida la versión mínima de la tabla de arriba, solo que el
archivo exista y sea ejecutable (o legible, para el modelo). Verificar `ffmpeg -version` y
`whisper-cli --help` ≥ las versiones mínimas es responsabilidad del smoke manual, más abajo.

**Alcance POSIX (macOS/Linux):** no se implementa `PATHEXT` ni resolución de `.exe`. En Windows hay
que fijar las cuatro variables de entorno explícitamente.

## API pública

Todo lo exportado vive en `src/index.ts` (firmas completas en `architect.md` §3). Resumen por
wrapper — comando externo que ejecuta y contrato que devuelve:

| Wrapper | Comando | Devuelve |
| --- | --- | --- |
| `probeMedia` | `ffprobe -show_format -show_streams` | `MediaAsset` |
| `detectSilencesWithFfmpeg` | `ffmpeg` + filtro `silencedetect` | `SilenceRange[]` |
| `measureLoudness` | `ffmpeg` + filtro `loudnorm` (1ª pasada, medición) | `LoudnessMeasurement` |
| `normalizeVoice` | `ffmpeg` + `loudnorm` en dos pasadas (medición + aplicación) | `NormalizeVoiceResult` |
| `extractAudioForTranscription` | `ffmpeg` (mono, 16 kHz, `pcm_s16le`) | ruta de salida (`string`) |
| `transcribeWithWhisperCpp` | `whisper-cli -oj -ml 1` | `Transcription` |

Los parsers puros (`parseFfprobeJson`, `parseSilenceDetect`, `parseLoudnormJson`,
`parseWhisperCppJson`, `parseFasterWhisperJson`) no ejecutan nada: reciben el texto que ya produjo
el binario (o la fixture que lo simula) y devuelven el mismo contrato de dominio que su wrapper.
`resolveBinary`/`resolveBinaries` resuelven rutas de binarios; `systemClock`/`nodeReadTextFile` son
los ports de reloj y filesystem que los wrappers usan por default.

Los tests nunca importan desde este barrel: cada uno prueba su módulo por ruta relativa (mismo
criterio que `timeline-core`).

## Mezcla de audio (`src/mix/`)

`cycle-01` de `spec-e-burgos-004-audio-mix-mastering` agrega la traducción pura de un
`AudioMixPlan` (más la `Timeline`) a un `FilterGraph` de ffmpeg — `buildAudioMixGraph` →
`serializeFilterGraph`/`audioMixFfmpegArgs`. Es solo composición de argumentos: **no ejecuta
ffmpeg**, no usa `CommandRunner`; el wrapper que sí lo ejecuta (`mixTimelineAudio`) es de
`cycle-02`.

- **Un solo nodo de ganancia en la música (D-05).** Los keyframes de `planDucking` son ganancias
  **absolutas** (en reposo valen `baseGainDb`, no un delta), y `audio-track.tsx` de Remotion usa la
  curva en lugar de `clip.volume`. Encadenar `baseGainDb` y después la automatización deja el
  master 12 dB por debajo del preview. Por eso `buildMusicBedChain` emite la automatización cuando
  existe o la ganancia estática del clip cuando no — nunca las dos.
- **`gainDbToVolume` está duplicada a propósito** entre esta lib y
  `libs/composition-remotion/src/helpers/audio-gain.ts`: los boundaries Nx (`type:util` → solo
  `type:domain`) impiden que `media-local` importe `composition-remotion`. La tabla de paridad de
  `architect.md` §7.2 es el contrato entre ambas copias y `gain-automation-curve.parity.spec.ts` la
  verifica contra `planDucking` real. Tocar una sin la otra rompe CA-002.
- **La paridad con el preview se promete para la curva de ducking de la música, no para el nivel
  absoluto de la voz**: la voz pasa por `loudnorm` en el master y el preview no tiene `loudnorm`.

## Inyección en tests

Todo I/O externo entra por parámetro, nunca se instancia adentro de un wrapper:

- **`CommandRunner`** — en producción, `new ExecaCommandRunner()`; en tests, `FixtureCommandRunner`
  con `routes: FixtureRoute[]` (match por `bin` y `argsPattern` laxo, aserción de `calls[i].args`
  exacta con `toEqual`).
- **`Clock`** — `probeMedia` recibe `opts.clock` (con `nowIso()`) o `opts.probedAt` ya resuelto; en
  producción el default es `systemClock`, en tests se inyecta un objeto literal
  `{ nowIso: () => '2026-...' }`.
- **`ReadTextFile`** — `transcribeWithWhisperCpp` recibe `opts.readTextFile`; en producción el
  default es `nodeReadTextFile`, en tests se inyecta un stub (`vi.fn(async () => raw)`) para no
  tocar el filesystem real con la salida de whisper-cli.
- **`BinaryLookup`** — `resolveBinary`/`resolveBinaries` reciben `opts.lookup`; en producción el
  default es `nodeBinaryLookup` (`fs.access`), en tests se inyecta un fake en memoria
  (`{ isExecutableFile, isReadableFile }`) para no depender de qué binarios tenga instalados la
  máquina que corre la suite.

## Comandos

```bash
pnpm nx lint media-local
pnpm nx test media-local
pnpm nx build media-local   # tsc -p tsconfig.lib.json — typecheck + .d.ts, sin bundler
```

## Fixtures: procedencia y cómo regrabarlas

Todas viven en `src/__fixtures__/` y se leen con `readFixture()` (`src/__fixtures__/load-fixture.ts`),
que devuelve el texto tal cual está en disco.

En el entorno donde se implementó este ciclo no había `ffmpeg`, `ffprobe` ni `whisper-cli`
instalados (ver `cycles/cycle-02/artifacts/task-00{5,7}-notes.md`): las fixtures de `ffmpeg/` y
`whisper/` se reconstruyeron a mano siguiendo al pie de la letra el formato documentado en
`architect.md` §6. Las de `ffprobe/` sí describen exactamente la salida real del comando (mismo
`-show_format -show_streams`, solo que curada a mano en vez de capturada). Si en algún momento se
graban corridas reales, reemplazar el archivo manteniendo los mismos valores numéricos — son los
que ya arrastran los `toEqual` exactos de los tests de cada CA.

Comandos exactos para regrabar cada una con los binarios reales:

```bash
# ffprobe/*.json — mismos argumentos que FFPROBE_ARGS
ffprobe -v quiet -print_format json -show_format -show_streams clip-vertical.mp4 \
  > src/__fixtures__/ffprobe/video-rotated.json
ffprobe -v quiet -print_format json -show_format -show_streams foto.jpg \
  > src/__fixtures__/ffprobe/image.json
ffprobe -v quiet -print_format json -show_format -show_streams locucion.wav \
  > src/__fixtures__/ffprobe/audio.json

# ffmpeg/silencedetect.stderr.txt — mismo filtro que detectSilencesWithFfmpeg con los defaults
ffmpeg -hide_banner -nostats -i clip-vertical.mp4 \
  -af silencedetect=noise=-35dB:d=0.5 -f null - 2> src/__fixtures__/ffmpeg/silencedetect.stderr.txt

# ffmpeg/loudnorm.stderr.txt — primera pasada de measureLoudness/normalizeVoice
ffmpeg -hide_banner -nostats -i locucion.wav \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - \
  2> src/__fixtures__/ffmpeg/loudnorm.stderr.txt
# loudnorm.json es el objeto JSON final de ese mismo stderr, copiado sin las líneas alrededor.

# whisper/whisper-cpp.json — mismos argumentos que transcribeWithWhisperCpp
whisper-cli -m "$WHISPER_MODEL_PATH" -f locucion-16k-mono.wav \
  -oj -ml 1 -l auto -of src/__fixtures__/whisper/whisper-cpp
```

`whisper/faster-whisper.json` no sale de un binario que esta lib invoque: es la salida JSON de
correr Faster-Whisper (`word_timestamps=True`) sobre el **mismo audio** que generó
`whisper-cpp.json`, para que CA-019 compare de verdad dos motores sobre la misma locución.

## Smoke manual (fuera de CI)

Es el único lugar donde se verifica `ffmpeg -version` ≥ 6.0 y `whisper-cli --help` ≥ 1.7 — la
resolución de binarios (D-09) deliberadamente no lo hace. Con los binarios instalados y las
variables de entorno fijadas:

```ts
import { ExecaCommandRunner, probeMedia, detectSilencesWithFfmpeg } from '@video-maker/media-local';

const runner = new ExecaCommandRunner();
const asset = await probeMedia('/ruta/a/un/clip.mp4', runner);
const silences = await detectSilencesWithFfmpeg('/ruta/a/un/clip.mp4', { durationMs: asset.durationMs }, runner);
console.log(asset, silences);
```

Confirmar a mano que `asset.kind`/`width`/`height`/`rotation` coinciden con lo que dice
`ffprobe -show_streams` sobre el mismo archivo, y que los rangos de `silences` caen donde
efectivamente hay silencio al reproducir el clip.
