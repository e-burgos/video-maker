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
- **La cama musical se normaliza antes de la ganancia (spec-014 D-2).** `buildMusicBedChain`
  antepone `volume=<g>dB` con `g = musicNormalizationGainDb(asset.audio.integratedLufs,
  audioMix.music.referenceLufs)` (referencia por defecto -16 LUFS, clamp ±18 dB). La medición sale
  del catálogo (la escribe el ingest de `auto-montage`), no de una pasada extra de ffmpeg en el
  mix: así el grafo y el `<Audio>` de Remotion derivan **la misma** ganancia de la misma función
  pura. Se eligió `volume=NdB` y no un segundo `loudnorm` porque es una ganancia lineal invariante
  en el tiempo, determinista y sin el resampleo a 192 kHz. Sin `integratedLufs` en el asset no se
  emite ningún nodo.
- **`apad` siempre lleva `whole_dur`** (`apad=whole_dur=<duración del video en s>`): sin él el
  stream es infinito y sólo lo acota el `atrim` siguiente. El `atrim=end` se conserva porque
  también recorta una música más larga que el edit.
- **`gainDbToVolume` está duplicada a propósito** entre esta lib y
  `libs/composition-remotion/src/helpers/audio-gain.ts`: los boundaries Nx (`type:util` → solo
  `type:domain`) impiden que `media-local` importe `composition-remotion`. La tabla de paridad de
  `architect.md` §7.2 es el contrato entre ambas copias y `gain-automation-curve.parity.spec.ts` la
  verifica contra `planDucking` real. Tocar una sin la otra rompe CA-002.
- **La paridad con el preview se promete para la curva de ducking de la música, no para el nivel
  absoluto de la voz**: la voz pasa por `loudnorm` en el master y el preview no tiene `loudnorm`.

## Ejecución de la mezcla (`cycle-02`): `mixTimelineAudio`, `verifyMixLoudness`, `muxAudioIntoVideo`

Los tres wrappers que sí ejecutan `ffmpeg`/`ffprobe` sobre el `FilterGraph` de `src/mix/`. Viven en
`src/ffmpeg/`, junto a `measureLoudness`.

| Wrapper | Qué hace | Invocaciones |
| --- | --- | --- |
| `mixTimelineAudio` | Mide una vez cada asset de voz **distinto** (`measureLoudness` con `-map 0:a:0`, sirve igual para un WAV que para el contenedor de video que en el pipeline real trae la voz), arma el `FilterGraph` de segunda pasada (`measured_*`, `linear=true`), le apenda el master bus y ejecuta el mix | N (mediciones) + 1 (mix); `N = 1` en toda `Timeline` de `buildTimeline` |
| `verifyMixLoudness` | Mide un archivo ya mezclado (WAV intermedio o MP4 final) y calcula si queda dentro de tolerancia | 1 |
| `muxAudioIntoVideo` | Verifica con `probeMedia` que el video de entrada tiene stream de video, copia el video sin reencodear (`-c:v copy`) y muxea el audio como AAC | 1 `ffprobe` + 1 `ffmpeg` |

**Master bus (`withMasterBusLimiter`, detalle interno, no exportado):** después del `amix`,
`mixTimelineAudio` apenda siempre un `alimiter` con `level=disabled` (solo atenúa, nunca sube el
volumen) al techo `target.truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB`. El margen existe porque
`alimiter` limita **sample peak**, y el true peak (dBTP, BS.1770, 4× oversampling) siempre es ≥
sample peak: limitar exactamente a `truePeakDbtp` no garantizaría el techo real. Por eso
`MASTER_BUS_TRUE_PEAK_MARGIN_DB` es el único símbolo del master bus que sí se exporta — un
consumidor que mida por debajo del objetivo tiene que poder entender por qué sin leer el código.

**`verifyMixLoudness` nunca lanza por estar fuera de tolerancia** (sí propaga `CommandFailedError`
si el binario falla): devuelve `{ measured, withinTolerance, integratedDeltaLu, truePeakDeltaDb }`
y quien la llama decide qué hacer con el resultado. Tolerancias, constantes nombradas y
exportadas, no configurables: `MIX_INTEGRATED_TOLERANCE_LU = 1` (banda simétrica e inclusiva
alrededor del integrado objetivo) y `MIX_TRUE_PEAK_TOLERANCE_DB = 0` (techo, no banda: por encima
de `truePeakDbtp` siempre es fuera, por debajo nunca es un fallo).

**`render → mix → mux` en una sola llamada no vive en esta lib.** Los boundaries Nx
(`media-local` es `type:util`, `composition-remotion` es `type:ui`; ninguna puede depender de la
otra) y `eslint.config.mjs` raíz protegido lo impiden. Es entrada obligatoria de
`spec-e-burgos-005`, en `apps/render-api` (`type:app`, que sí puede depender de las dos).

## Procedimiento encadenado: render mudo → mix → verify → mux → verify

No hay una función única que lo encadene (ver nota de boundaries arriba); son cinco pasos, el
primero manual y ajeno a esta lib, el resto con las funciones de más arriba:

1. Renderizar el video **sin audio** con `renderTimeline(timeline, { audio: 'muted' })` de
   `@video-maker/composition-remotion/render` (manual, fuera de esta lib).
2. `mixTimelineAudio(timeline, masterPath, runner)` → WAV intermedio.
3. `verifyMixLoudness(masterPath, timeline.audioMix.voice, runner)` sobre el WAV — control temprano
   antes de tocar el mux.
4. `muxAudioIntoVideo(renderMudoPath, masterPath, finalPath, runner)` → entregable final.
5. `verifyMixLoudness(finalPath, timeline.audioMix.voice, runner)` sobre el **entregable** —la
   medición que importa, después del AAC.

`smoke-audio` (más abajo) ejercita los cinco pasos con un `render-muted.mp4` fabricado a mano en
vez del paso 1 real, porque esta lib no puede importar `composition-remotion` (boundaries).

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

# ffmpeg/loudnorm-mix-*.stderr.txt — la medición que hace verifyMixLoudness
# (el -map 0:a:0 es lo que la distingue de loudnorm.stderr.txt: sirve igual para un WAV y para el MP4 final)
ffmpeg -hide_banner -nostats -i master.wav -map 0:a:0 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - \
  2> src/__fixtures__/ffmpeg/loudnorm-mix-in-tolerance.stderr.txt
```

`whisper/faster-whisper.json` no sale de un binario que esta lib invoque: es la salida JSON de
correr Faster-Whisper (`word_timestamps=True`) sobre el **mismo audio** que generó
`whisper-cpp.json`, para que CA-019 compare de verdad dos motores sobre la misma locución.

**Las 5 `ffmpeg/loudnorm-mix-*.stderr.txt` de `cycle-02` (CA-009) están reconstruidas a mano, no
son capturas** — mismo criterio que el resto de `ffmpeg/` y `whisper/`: mismo formato y misma
indentación con tabs que `loudnorm.stderr.txt`, cambiando únicamente los valores numéricos por los
de la tabla de casos de `architect.md` §7.3 (`in-tolerance`, `at-boundary`, `integrated-out`,
`true-peak-out`, `both-out`). El comando de arriba regrabaría `in-tolerance`; los otros cuatro son
el mismo comando sobre un master con niveles distintos. **Si algún día se graban corridas reales,
los valores numéricos no se pueden cambiar sin actualizar el spec**: los `toEqual` de
`verify-mix-loudness.spec.ts` dependen de ellos, y el caso `at-boundary` en particular solo prueba
lo que tiene que probar si vale exactamente `-15.00`/`-1.00` (restas exactas en IEEE-754).

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

## Smoke manual: `smoke-audio` (`cycle-02`, fuera de CI)

```bash
pnpm nx run media-local:smoke-audio
```

Target manual, **no** en `nx run-many -t lint test build` ni en CI (igual que
`composition-remotion:smoke`/`:studio`). Vive fuera de `src/` en `smoke/` (no lo typechequea
`nx build`; el propio target corre `tsc -p tsconfig.smoke.json --noEmit` antes de ejecutar, así no
queda en deriva silenciosa respecto de las firmas de la lib) y solo importa desde el barrel
público (`@video-maker/media-local`), nunca de un módulo interno.

Es **autocontenido**: genera con `ffmpeg` real sus propias señales de prueba en
`libs/media-local/tmp/smoke-audio/` (ya cubierto por el `tmp/` del `.gitignore` raíz, sin líneas
nuevas) — un `aroll.mp4` con video y audio (el caso real: `buildVoiceTrack` le da a la voz el
`assetId` del aroll), una `music.wav`, y un `render-muted.mp4` que funciona de stand-in del render
mudo de Remotion (esta lib no puede importar `composition-remotion`, ver nota de boundaries más
arriba) — arma una `Timeline` real con `buildTimeline` y corre los cinco pasos del procedimiento
encadenado de arriba. Imprime las mediciones de voz, master y entregable, y **sale con código 1**
si `verifyMixLoudness` del entregable da `withinTolerance: false` o si el chequeo de CE-3
(`muxAudioIntoVideo` contra un archivo sin stream de video) no lanza `MissingMediaStreamError`.

Requiere Node ≥ 22.12: `ExecaCommandRunner` importa `execa` v10 (ESM puro) y el smoke corre bajo
`@swc-node/register` en contexto CJS (`require(esm)`).
