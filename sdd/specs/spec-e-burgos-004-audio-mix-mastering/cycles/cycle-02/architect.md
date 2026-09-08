# Architect — Cycle 2: Ejecución, verificación, mux y render mudo

> **Input:** `cycles/cycle-02/brief.yaml`, `cycles/cycle-02/functional.md`,
> `cycles/cycle-01/architect.md` §2/§3/§4.3/§11, spec D-B/D-F/D-G/D-H/D-J
> **Output:** este archivo
> **Generado por:** sdd-architect · **Modelo/effort declarados antes de diseñar:** `claude/opus` `high`
> **Subproyectos:** `libs/media-local` (RF-2-01..RF-2-03, RF-2-05), `libs/composition-remotion` (RF-2-04),
> ambos READMEs (RF-2-06)

---

## 0. Alcance de este documento

Este ciclo no agrega tablas de base de datos ni endpoints HTTP: `sdd/schema.json` y `sdd/api.json`
no cambian. El "contrato" de este ciclo son **tres funciones públicas de `libs/media-local`**, **una
opción aditiva de `renderTimeline`** y **un target manual de Nx**. Lo que sigue es, en ese orden:
decisiones, árbol, firmas exactas, el flujo literal de las dos pasadas, la resolución del `assetId`
de la voz, el error tipado nuevo, tolerancias, mux, la opción `audio`, fixtures, `smoke-audio`,
superficie pública, divergencias reportadas y reglas para el implementador.

**Lo que este documento NO hace:** no reescribe nada de `src/mix/` (cycle-01 cerrado, contratos
fijos), no toca `libs/timeline-core` (D-A) ni `eslint.config.mjs` raíz (RNF-6), y no implementa el
cableado `render → mix → mux` (D-G).

---

## 1. Decisiones técnicas

Numeradas continuando `cycle-01` (que llegó hasta D-10).

### D-11 · Los tres wrappers viven en `src/ffmpeg/`, un archivo por función pública

Confirmado §11.1 de `cycle-01`. `mixTimelineAudio`, `verifyMixLoudness` y `muxAudioIntoVideo` son
**wrappers** (arman argumentos, ejecutan vía `CommandRunner`, traducen el fallo a un error tipado):
el patrón de la lib los pone en `src/ffmpeg/`, junto a `measureLoudness`, `normalizeVoice`,
`detectSilencesWithFfmpeg` y `extractAudioForTranscription`.

La dirección de imports sigue siendo de un solo sentido, ahora con una arista más:

```
ffmpeg/mix-timeline-audio  ->  mix/build-audio-mix-graph, mix/serialize-filter-graph, mix/audio-mix-ffmpeg-args
ffmpeg/mix-timeline-audio  ->  ffmpeg/measure-loudness, ffmpeg/master-bus-limiter
ffmpeg/master-bus-limiter  ->  mix/filter-graph (tipos), mix/gain-db-to-volume, mix/format-filter-number
ffmpeg/verify-mix-loudness ->  ffmpeg/measure-loudness
ffmpeg/mux-audio-into-video->  ffprobe/probe-media
```

`src/mix/**` sigue **sin importar** `src/runner/**`, `src/ffprobe/**` ni ningún wrapper (R-20, R-22
de cycle-01). El invariante que importa se refina así, y es el que el reviewer debe verificar:

> **`src/mix/**` es puro y no conoce a nadie que ejecute. `src/ffmpeg/**` puede consumir `src/mix/**`
> y `src/ffprobe/**`. Nunca al revés.**

`mix/build-voice-chain.ts → ffmpeg/build-loudnorm-filter.ts` (arista preexistente de cycle-01) no
crea ciclo: son archivos distintos de los tres nuevos y `build-loudnorm-filter.ts` no importa nada.

### D-12 · Una sola invocación de medición por **asset distinto de voz**, no una por clip ni una por grafo

Es la lectura literal de `cycle-01` §3.4 ("la medición se indexa por `assetId`, no por `clipId`…
indexar por clip obligaría a `cycle-02` a medir N veces el mismo WAV") y de §11.2 ("un
`measureLoudness` por **asset distinto de voz**, no por clip").

La alternativa —ejecutar el grafo de primera pasada y leer las mediciones de su `stderr`— **se
descarta con evidencia**, no por gusto:

1. El grafo tiene **una instancia de `loudnorm` por clip de voz**, no una por asset. Con la
   Timeline canónica (`buildTimeline` produce un clip de voz por clip de aroll) eso son N bloques
   JSON en el mismo `stderr`, y `parseLoudnormJson` sólo extrae **el último objeto**
   (`extractTrailingJsonObject`): los N-1 anteriores se pierden en silencio.
2. Aunque se parsearan todos, cada instancia mide su clip **después de `atrim`+`adelay`** (cycle-01
   §4.4), es decir con el silencio de cabecera que introduce el `adelay`. La medición no
   correspondería al asset sino a un segmento desplazado.
3. Dos clips del mismo asset producirían dos mediciones distintas para la **misma** clave del mapa
   `voiceMeasuredByAssetId`: el contrato de §3.4 no admite desempate.

Medir el archivo completo del asset una vez y aplicar **el mismo offset a todos sus clips** además
es lo correcto de audio: preserva la dinámica relativa entre segmentos de la misma toma, que es
justo lo que una normalización por clip destruiría.

### D-13 · `buildAudioMixGraph` se llama dos veces, pero **sólo el segundo grafo se ejecuta**

`cycle-01` §11.2 dice "dos veces". Se cumple, con el rol de cada llamada explícito:

| Llamada | Argumento | Para qué | ¿Se ejecuta? |
| --- | --- | --- | --- |
| 1 | `{ timeline }` | **Gate pre-I/O**: valida con Zod, exige ≥1 clip de audio (`refine`) y resuelve **todos** los assets (voz y música). Si algo falla, `mixTimelineAudio` rechaza **sin haber invocado un solo binario**. | **No** (ver D-12) |
| 2 | `{ timeline, voiceMeasuredByAssetId }` | El grafo real: `loudnorm` de la voz ya con `measured_*` y `linear=true`. | Sí, 1 invocación |

El grafo de la llamada 1 se **descarta a propósito**: ejecutarlo sería una tercera invocación de
ffmpeg (rompe CA-008) y sus mediciones serían inutilizables (D-12). Se encapsula en una función con
nombre declarativo, `assertMixableTimeline`, para que la intención no dependa de un comentario
(RNF-5).

### D-14 · Un error tipado nuevo, no dos: `MissingMediaStreamError`

Este ciclo tiene dos condiciones de "el archivo no trae el stream que esta operación necesita":

- el asset de voz no tiene stream de audio (§11.4 de `cycle-01` lo dejó como decisión de este ciclo);
- el video de entrada del mux no tiene stream de video (RF-8 / CE-3).

Son **el mismo defecto** con distinto discriminante. Un solo error tipado con
`stream: 'audio' | 'video'` agrega **un solo miembro** a `MediaLocalErrorCode`
(`'MISSING_MEDIA_STREAM'`), mantiene chica la jerarquía y le da a `spec-005` un único `catch` para
"el input no sirve para esta operación".

### D-15 · La medición apunta explícitamente al primer stream de audio (`-map 0:a:0`)

`buildVoiceTrack` le asigna al clip de voz el `assetId` **del clip de aroll**, así que el archivo a
medir es, en el caso real, un **contenedor de video** (§5 de este documento lo desarrolla). Sin
`-map`, la selección de streams por default de ffmpeg toma también el video y lo decodifica/recodifica
contra el muxer `null` — trabajo inútil proporcional a la duración del aroll — y, si el archivo no
tiene audio, `-af` no se aplica a nada, ffmpeg **sale con código 0** y `parseLoudnormJson` explota
con un `UnparseableOutputError` que no dice nada del problema real.

Se agrega por lo tanto una opción **aditiva** a `MeasureLoudnessOptions`:
`audioStreamSpecifier?: string`. Cuando está presente, y sólo entonces, los args llevan
`-map <specifier>` entre `-i <path>` y `-af <filtro>`. Omitida, la lista de argumentos es
**byte-idéntica** a la actual: `normalizeVoice` y los specs existentes de `loudnorm.spec.ts`
(que asertan `calls[0].args[5]` posicionalmente) no cambian.

Los dos consumidores nuevos la pasan **siempre** con la constante `FIRST_AUDIO_STREAM = '0:a:0'`:
`mixTimelineAudio` porque el asset de voz puede ser un contenedor de video, y `verifyMixLoudness`
porque el archivo a verificar es o el WAV intermedio (donde `0:a:0` es un no-op) o el MP4 final
(donde no lo es). Uniforme, sin rama.

### D-16 · El mux verifica el stream de video con `probeMedia`, no traduciendo el `stderr` de ffmpeg

CE-3 exige un **error tipado**, es decir una garantía. Las dos alternativas:

| Alternativa | Por qué no / por qué sí |
| --- | --- |
| Traducir el fallo de ffmpeg (`Stream map '0:v:0' matches no streams.`) | Depende de **string-matching sobre el `stderr`** de un binario externo: cambia entre versiones y con el locale. No es una garantía, es una heurística. Además ffmpeg ya habría creado/truncado el archivo de salida. |
| **`probeMedia` antes de ejecutar (elegida)** | `MediaAsset.kind === 'video'` es exactamente "tiene stream de video no-`attached_pic`" (`findVideoStream` + `classifyKind` de `parse-ffprobe-json.ts`). Es el contrato que la lib ya tiene para preguntar qué streams trae un archivo, es estable entre versiones y **falla antes de escribir nada**. |

Costo: `muxAudioIntoVideo` hace **2 invocaciones** (1 `ffprobe` + 1 `ffmpeg`). CA-010 restringe
argumentos, no cantidad de invocaciones, así que no hay conflicto. `ffprobePath` entra por `opts`
con default `'ffprobe'`, igual que el resto de la lib (RNF-3).

El predicado es `asset.kind !== 'video'`: un JPEG probea como `kind: 'image'` y, aunque técnicamente
tiene un stream de video, muxearlo con `-c:v copy` no produce un entregable válido. Una sola rama.

### D-17 · La opción `audio` viaja por `inputProps` y **sólo cuando vale `'muted'`**

`render.spec.ts` aserta hoy `inputProps: { timeline }` con igualdad estructural exacta
(`toHaveBeenCalledWith`). Si el default `'mix'` se materializara en `inputProps`, ese test —y
cualquier consumidor que compare props— se rompería, violando RN-10/RN-12 y CA-8 del functional.

Por lo tanto el default es **estructural, no un valor**: `renderTimeline` agrega la propiedad al
`inputProps` únicamente si vale `'muted'`, con el mismo patrón de spread condicional que ya usa el
repo (`options.onProgress`, `optionalField` de `build-timeline.ts`), y `TimelineComposition` trata
`undefined` y `'mix'` de forma idéntica (`audio === 'muted'` es la única condición). No hay
`?? 'mix'` en ningún lado: un solo punto de decisión, una sola rama, cero riesgo de que dos defaults
se desincronicen.

### D-18 · `smoke-audio` vive **fuera de `src/`**, en `libs/media-local/smoke/`

El target necesita `process.env` (para `resolveBinaries`) y `node:fs` (para crear el directorio de
salida). El ESLint de la lib prohíbe ambos en `src/**/*.ts`. Las opciones eran exceptuar un archivo
dentro de `src/` (como hace `composition-remotion` con `render.ts`/`smoke.ts`) o sacarlo de `src/`.

Se elige **sacarlo**: `src/**` de esta lib es la librería y su barrel es su API pública; un script de
verificación manual no es ninguna de las dos cosas. Además evita tener que editar el `include` de
cobertura de `vite.config.ts` para que un archivo sin tests no hunda el piso de RNF-2 — fuera de
`src/`, la config de cobertura (`include: ['src/**/*.ts']`) ya lo ignora sin tocar nada.

Contrapartida: `tsconfig.lib.json` incluye sólo `src/**/*.ts`, así que `nx build` no lo typechequea.
Se compensa haciendo que el propio target corra `tsc -p tsconfig.smoke.json --noEmit` **antes** de
ejecutar (§11): el smoke no puede quedar en deriva silenciosa respecto de las firmas de la lib.

El `eslint.config.mjs` **de la lib** no necesita cambio alguno: sus bloques restrictivos están
scopeados a `src/**`. `smoke/**` sólo recibe el config raíz (que no restringe `process` ni
`node:fs`), y `@nx/enforce-module-boundaries` no aplica a un import relativo dentro del mismo
proyecto. **El `eslint.config.mjs` raíz no se toca** (RNF-6).

### D-19 · Las salidas del smoke van a `libs/media-local/tmp/`, ya ignorado por git

`.gitignore` raíz tiene `tmp/` (patrón sin slash inicial → matchea a cualquier profundidad).
Escribiendo en `libs/media-local/tmp/smoke-audio/`, **el ciclo no necesita agregar ninguna línea a
ningún `.gitignore`**. Ver §13.6 para la observación sobre `out/` de `composition-remotion`.

### D-20 · Las tolerancias son constantes nombradas y exportadas; el **target** sale del parámetro

RN-4 exige que las tolerancias no sean configurables. Se declaran como dos constantes
(`MIX_INTEGRATED_TOLERANCE_LU = 1`, `MIX_TRUE_PEAK_TOLERANCE_DB = 0`) y **no** hay opción que las
mueva. Los valores objetivo (-14 LUFS, -1 dBTP) **no** se duplican como constantes nuevas: salen del
`VoiceTarget` que la función recibe, que en el pipeline real es `timeline.audioMix.voice` y por
default vale exactamente `DEFAULT_VOICE_TARGET` (`{-14, -1, 11}`). Un solo lugar define el target.

`MIX_TRUE_PEAK_TOLERANCE_DB = 0` existe —en vez de un `<= 0` pelado— para que "sin tolerancia hacia
arriba" (D-F) sea greppable y esté nombrado, no inferido de un literal.

### D-21 · Master bus: `alimiter` apendeado al `FilterGraph`, con margen de inter-sample explícito

Implementa **D-K** de la spec. El grafo de `cycle-01` no tiene nada después del `amix` (§13.5), así
que el techo de true peak era un objetivo medido y no una garantía. `mixTimelineAudio` **apendea**
una cadena de master bus al `FilterGraph` antes de serializarlo.

**Es aditivo sobre el dato, no sobre el código de `cycle-01`.** `buildAudioMixGraph`,
`serializeFilterGraph`, `audioMixFfmpegArgs` y las fixtures exactas de §9.2/§9.3 de `cycle-01` (el
string de 855 caracteres) **no se tocan**: el grafo es una estructura inmutable y este ciclo
construye una **nueva** con una cadena más. `withMasterBusLimiter(graph, target)` es pura y devuelve
un `FilterGraph` nuevo por spread — no muta el que recibe.

#### El filtro: `alimiter`, y por qué

| Candidato | Veredicto |
| --- | --- |
| **`alimiter` (elegido)** | Es el único limitador con *lookahead* de ffmpeg. Determinista (mismo input → mismo output, sin estado externo), sólo atenúa, y su techo se parametriza. |
| `acompressor` con ratio alto | Un compresor no es un brickwall: sin lookahead, con `ratio=20` y `attack` mínimo (0.01 ms) igual deja pasar el transitorio. No garantiza techo. |
| `volume` con ganancia negativa fija | Bajaría **todo** el master, no sólo los picos: destruye el integrado que `loudnorm` acaba de fijar. Descartado de plano. |
| `loudnorm` de bus en una pasada | Sí limita true peak de verdad (libebur128), pero en modo dinámico de una pasada aplica compresión de rango que **altera la curva de ducking** y rompe la paridad con el preview de D-E. Además re-normaliza el integrado, que es exactamente el re-master de dos pasadas que D-G/D-K dejan para `spec-005`. Descartado. |
| `aresample=192000 → alimiter → aresample=48000` | Sería el limitador de true peak "de verdad" (limitar sobre la señal 4× sobremuestreada ≈ definición de dBTP de BS.1770). Descartado: 4× de CPU en el bus, dos etapas de resampler más cuyo *ringing* en la bajada reintroduce un overshoot menor —así que tampoco es una garantía absoluta—, y triplica la superficie de cosas que pueden divergir entre builds de ffmpeg. El margen explícito (abajo) compra lo mismo con una fracción del riesgo. |

#### El margen de inter-sample: por qué no alcanza con poner el techo en `truePeakDbtp`

`alimiter` de ffmpeg es un limitador de **sample peak**: `af_alimiter.c` compara `fabs(sample)`
contra el umbral, sin sobremuestreo. **dBTP no es sample peak**: es el pico de la señal
reconstruida (4× oversampling, ITU-R BS.1770), y siempre es ≥ el sample peak. Limitar el sample
peak a -1 dBFS **no** garantiza `true peak ≤ -1 dBTP`.

Por eso el techo del limitador es `target.truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB`, con
`MASTER_BUS_TRUE_PEAK_MARGIN_DB = 1`. Es la convención de entrega broadcast cuando un limitador de
sample peak hace las veces de uno de true peak: el overshoot inter-sample de material de programa a
48 kHz se mantiene por debajo de ~1 dB salvo en contenido ya clippeado, que no es el caso acá (la
voz sale de un `loudnorm` en modo `linear`, que es suave por definición). Resultado: el master pica
~2 dB por debajo del objetivo en vez de rozarlo — inaudible y estrictamente más seguro —, y
`verifyMixLoudness` sigue siendo la verificación real, no una formalidad.

El margen es una **constante nombrada y exportada** (§12): un consumidor que mida -2.1 dBTP y
espere -1.0 tiene que poder entender por qué sin leer el código.

#### `level=disabled` es el parámetro más peligroso del ciclo

`alimiter` trae `level` en **`enabled` por default**: *"auto level output signal… normalizes audio
back to 0 dB"*. Con el default, el limitador **sube** el master hasta rozar el techo: un master de
-13.8 LUFS con picos en -11 dBFS se iría ~9 dB para arriba, destruyendo de una sola vez el objetivo
de loudness de D-F **y** la paridad de curva de D-E. Con `level=disabled` el filtro sólo puede
atenuar y nunca aplica *makeup gain*.

**Por eso el limitador no altera materialmente el integrado:** la única ganancia que aplica es
descendente, sólo sobre las muestras que superan el umbral y sólo durante las ventanas de
`attack`/`release`. Sobre un integrado —que es un promedio energético en bloques de 400 ms con
gating— reducir picos aislados unos pocos dB mueve menos de 0.1 LU. No es una estimación que haya
que creer: `verifyMixLoudness` la mide y el smoke la imprime.

#### Latencia: el efecto conocido que sí introduce

`alimiter` mira `attack` ms hacia adelante. Con `latency` en su default (`disabled`) esa latencia
**no** se compensa y el buffer de lookahead **no** se vacía en EOF: el audio del entregable arranca
5 ms tarde y pierde los últimos 5 ms. Se acepta y se documenta en vez de emitir `latency=enabled`,
porque la disponibilidad de esa opción en ffmpeg 6.0 —el mínimo declarado en el README de la lib—
no está verificada, y emitirla sin confirmar cambiaría un efecto inaudible por un
`Option 'latency' not found` que rompe el mix entero. Magnitud real: 5 ms es 0.15 frames a 30 fps y
está un orden de magnitud por debajo del umbral de detección de desincronía A/V (BT.1359); el
desplazamiento es **uniforme sobre el bus**, así que voz y música no se desincronizan entre sí, y
`-shortest` en el mux no descarta ni un frame de video. Candidato a refinamiento en `spec-005`, una
vez pinneada la versión mínima de ffmpeg.

---

## 2. Árbol de archivos y grafo de imports

```
libs/media-local/
  src/
    errors/
      media-local-error.ts              (MODIFICADO: +'MISSING_MEDIA_STREAM' en MediaLocalErrorCode)
      missing-media-stream-error.ts     (NUEVO)  MissingMediaStreamError | MissingStreamKind
    ffmpeg/
      measure-loudness.ts               (MODIFICADO: +audioStreamSpecifier?, +FIRST_AUDIO_STREAM)
      master-bus-limiter.ts             (NUEVO)  withMasterBusLimiter | buildTruePeakLimiterFilter
                                                 MASTER_BUS_TRUE_PEAK_MARGIN_DB | MASTER_BUS_OUTPUT_LABEL
                                                 MASTER_BUS_LIMITER_ATTACK_MS | MASTER_BUS_LIMITER_RELEASE_MS
      mix-timeline-audio.ts             (NUEVO)  mixTimelineAudio | MixTimelineAudioOptions | MixTimelineAudioResult
      verify-mix-loudness.ts            (NUEVO)  verifyMixLoudness | MixLoudnessVerification
                                                 VerifyMixLoudnessOptions
                                                 MIX_INTEGRATED_TOLERANCE_LU | MIX_TRUE_PEAK_TOLERANCE_DB
      mux-audio-into-video.ts           (NUEVO)  muxAudioIntoVideo | MuxAudioIntoVideoOptions
                                                 MuxAudioIntoVideoResult
                                                 MUX_AUDIO_CODEC | MUX_AUDIO_BITRATE
    __fixtures__/ffmpeg/
      loudnorm-mix-in-tolerance.stderr.txt      (NUEVO)
      loudnorm-mix-at-boundary.stderr.txt       (NUEVO)
      loudnorm-mix-integrated-out.stderr.txt    (NUEVO)
      loudnorm-mix-true-peak-out.stderr.txt     (NUEVO)
      loudnorm-mix-both-out.stderr.txt          (NUEVO)
    index.ts                            (MODIFICADO: §12)
  smoke/
    smoke-audio.ts                      (NUEVO, fuera de src/ — D-18)
    smoke-register.cjs                  (NUEVO, copia del de composition-remotion)
  tsconfig.smoke.json                   (NUEVO)
  project.json                          (MODIFICADO: +target smoke-audio)
  README.md                             (MODIFICADO: RF-2-06 + procedencia de fixtures nuevas)

libs/composition-remotion/
  src/
    components/timeline-composition.tsx (MODIFICADO: +audio?: TimelineAudioMode, +TimelineAudioMode)
    render.ts                           (MODIFICADO: +options.audio, +TimelineInputProps.audio)
    index.ts                            (MODIFICADO: +export type TimelineAudioMode)
  README.md                             (MODIFICADO: RF-2-06 + D-J.6)
```

Cada archivo nuevo de `src/**` lleva su hermano `*.spec.ts` en el mismo directorio (convención de la
lib). `smoke/smoke-audio.ts` **no** lleva spec: ejecuta binarios (RNF-1).

Grafo de imports de lo nuevo (acíclico):

```
errors/missing-media-stream-error   -> errors/media-local-error

ffmpeg/measure-loudness             -> errors/command-failed-error, runner/command-runner (tipos),
                                       ffmpeg/build-loudnorm-filter, ffmpeg/parse-loudnorm-json

ffmpeg/master-bus-limiter           -> mix/filter-graph (tipos), mix/gain-db-to-volume,
                                       mix/format-filter-number,
                                       @video-maker/timeline-core (tipos)

ffmpeg/mix-timeline-audio           -> mix/build-audio-mix-graph, mix/serialize-filter-graph,
                                       mix/audio-mix-ffmpeg-args, ffmpeg/master-bus-limiter,
                                       ffmpeg/measure-loudness, ffmpeg/parse-loudnorm-json (tipo),
                                       errors/command-failed-error, errors/unresolved-audio-asset-error,
                                       errors/missing-media-stream-error,
                                       runner/command-runner (tipos), @video-maker/timeline-core (tipos)

ffmpeg/verify-mix-loudness          -> ffmpeg/measure-loudness, ffmpeg/parse-loudnorm-json (tipo),
                                       runner/command-runner (tipos), @video-maker/timeline-core (tipos)

ffmpeg/mux-audio-into-video         -> ffprobe/probe-media, errors/command-failed-error,
                                       errors/missing-media-stream-error, runner/command-runner (tipos)

smoke/smoke-audio                   -> ../src/index (barrel), @video-maker/timeline-core, node:fs, node:path
```

---

## 3. Firmas exactas

Tipos importados de `@video-maker/timeline-core` (`AssetId`, `AudioClip`, `MediaAsset`, `Timeline`,
`VoiceTarget`) y de la propia lib (`CommandOptions`, `CommandRunner`, `LoudnessMeasurement`).

### 3.1 `mixTimelineAudio` — RF-2-01 / CA-008

```ts
export interface MixTimelineAudioOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export interface MixTimelineAudioResult {
  readonly outputPath: string;
  readonly filterComplex: string;
  readonly voiceMeasured: ReadonlyMap<AssetId, LoudnessMeasurement>;
  readonly args: readonly string[];
}

export async function mixTimelineAudio(
  timeline: Timeline,
  out: string,
  runner: CommandRunner,
  opts?: MixTimelineAudioOptions,
): Promise<MixTimelineAudioResult>;
```

- **`assets` no es parámetro.** RF-6 de la spec escribe
  `mixTimelineAudio(timeline, assets, out, runner, opts)`, pero `Timeline.assets` ya los contiene y
  `buildAudioMixGraph` resuelve exclusivamente contra `timeline.assets`. Un segundo canal para los
  mismos assets sólo permite desincronizarlos en silencio — el mismo argumento que motivó D-J.3 en
  `cycle-01` para `audioMixFfmpegArgs`. Divergencia reportada en §13.1.
- **`target` tampoco es parámetro:** sale de `timeline.audioMix.voice`, que es exactamente el
  `VoiceTarget` que `buildVoiceChain` usa dentro del grafo. Pasarlo aparte permitiría medir contra un
  target y normalizar contra otro.
- `voiceMeasured` es un `ReadonlyMap` con **la misma forma** que consume
  `AudioMixGraphSpec.voiceMeasuredByAssetId`: `spec-005` puede auditarlo, loguearlo o reinyectarlo
  para rehacer el mix sin volver a medir.
- `args` son los argumentos de la **pasada de mix** (la que produjo `outputPath`). Los de la pasada
  de medición son derivables: `measureLoudness` los construye de forma determinista a partir del
  path del asset y del target (§4).
- `filterComplex` **incluye la cadena de master bus** (D-21): es el `-filter_complex` realmente
  ejecutado, no el que devolvería `serializeFilterGraph(buildAudioMixGraph(...))` a secas. Si
  `spec-005` quiere reproducir el comando, ése es el string, y termina en `[master]`.

### 3.2 `verifyMixLoudness` — RF-2-02 / CA-009

```ts
export const MIX_INTEGRATED_TOLERANCE_LU = 1;
export const MIX_TRUE_PEAK_TOLERANCE_DB = 0;

export interface MixLoudnessVerification {
  readonly measured: LoudnessMeasurement;
  readonly withinTolerance: boolean;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export interface VerifyMixLoudnessOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function verifyMixLoudness(
  path: string,
  target: VoiceTarget,
  runner: CommandRunner,
  opts?: VerifyMixLoudnessOptions,
): Promise<MixLoudnessVerification>;
```

Sin `target?` en `opts`: el target es parámetro posicional obligatorio (RF-7). Detalle completo de
tolerancias y casos borde en §7.

### 3.3 `muxAudioIntoVideo` — RF-2-03 / CA-010

```ts
export const MUX_AUDIO_CODEC = 'aac';
export const MUX_AUDIO_BITRATE = '192k';

export interface MuxAudioIntoVideoOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
  runOptions?: CommandOptions;
}

export interface MuxAudioIntoVideoResult {
  readonly outputPath: string;
  readonly args: readonly string[];
}

export async function muxAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  out: string,
  runner: CommandRunner,
  opts?: MuxAudioIntoVideoOptions,
): Promise<MuxAudioIntoVideoResult>;
```

Devuelve un objeto y no un `string` (como hace `extractAudioForTranscription`) por consistencia con
`mixTimelineAudio` dentro de este ciclo: `spec-005` va a loguear la cadena completa de tres pasos y
necesita los argumentos de cada uno sin re-derivarlos.

### 3.4 `MeasureLoudnessOptions` — MODIFICADO (aditivo)

```ts
export const FIRST_AUDIO_STREAM = '0:a:0';

export interface MeasureLoudnessOptions {
  target?: VoiceTarget;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
  audioStreamSpecifier?: string;
}
```

`FIRST_AUDIO_STREAM` se exporta desde `measure-loudness.ts` para sus dos consumidores internos pero
**no** entra al barrel (detalle de implementación, mismo criterio que `FFPROBE_ARGS`).

### 3.5 `MissingMediaStreamError` — RF-2-01 / RF-2-03 (CE-3)

```ts
export type MissingStreamKind = 'audio' | 'video';

export class MissingMediaStreamError extends MediaLocalError {
  readonly code = 'MISSING_MEDIA_STREAM';
  readonly path: string;
  readonly stream: MissingStreamKind;
  readonly assetId: string | undefined;

  constructor(init: { path: string; stream: MissingStreamKind; assetId?: string });
}
```

`assetId: string | undefined` (propiedad siempre presente, valor opcional) replica el patrón de
`BinaryNotFoundError.envVar`: con `exactOptionalPropertyTypes: true` es lo único que compila sin
spreads condicionales en cada construcción.

Mensajes (español, como el resto de la jerarquía):

- `audio` → `` `El archivo "${path}" no tiene stream de audio: no se puede medir ni mezclar.` ``
- `video` → `` `El archivo "${path}" no tiene stream de video: no se puede muxear con -c:v copy.` ``

### 3.6 `renderTimeline` y `TimelineComposition` — RF-2-04 / CA-011

```ts
export type TimelineAudioMode = 'mix' | 'muted';

export type TimelineCompositionProps = {
  timeline: Timeline;
  audio?: TimelineAudioMode | undefined;
  captionPreset?: CaptionPresetId | undefined;
  captionPlatform?: CaptionPlatform | undefined;
  captionAnchor?: CaptionAnchor | undefined;
};

export type TimelineInputProps = { timeline: Timeline; audio?: TimelineAudioMode };

export interface RenderTimelineOptions {
  outPath: string;
  audio?: TimelineAudioMode;
  codec?: 'h264';
  concurrency?: number;
  compositionId?: string;
  entryPoint?: string;
  publicDir?: string | null;
  onProgress?: (renderedFrames: number, totalFrames: number) => void;
}
```

`renderTimeline(timeline, options, deps?)` **no cambia de aridad ni de orden de parámetros**: sólo
gana una propiedad opcional en `options`. `RenderTimelineResult`, `RenderTimelineDeps`,
`RenderTimelineError` y sus códigos quedan idénticos. Detalle del recorrido de la opción en §9.

### 3.7 Master bus — D-21 / D-K

```ts
export const MASTER_BUS_OUTPUT_LABEL = 'master';
export const MASTER_BUS_TRUE_PEAK_MARGIN_DB = 1;
export const MASTER_BUS_LIMITER_ATTACK_MS = 5;
export const MASTER_BUS_LIMITER_RELEASE_MS = 50;

export function buildTruePeakLimiterFilter(target: VoiceTarget): string;

export function withMasterBusLimiter(graph: FilterGraph, target: VoiceTarget): FilterGraph;
```

Archivo: `src/ffmpeg/master-bus-limiter.ts`. Va en `src/ffmpeg/` y no en `src/mix/` por dos razones,
y la segunda es la que manda: (a) `src/mix/` está cerrado (D-A, brief); (b) hay precedente exacto —
`src/ffmpeg/build-loudnorm-filter.ts` es también un constructor **puro** de string de filtro que
vive en `src/ffmpeg/` justamente para que el directorio que lo consume no genere un ciclo. Ambas
funciones son puras, deterministas y no tocan `CommandRunner`.

`buildTruePeakLimiterFilter` produce exactamente:

```
alimiter=limit=<formatFilterNumber(gainDbToVolume(target.truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB))>:attack=<attack>:release=<release>:level=disabled
```

Con `target = DEFAULT_VOICE_TARGET` (`truePeakDbtp: -1`) el techo es -2 dB,
`gainDbToVolume(-2) = 0.7943282347242815` y `formatFilterNumber` lo emite con 9 decimales:

```
alimiter=limit=0.794328235:attack=5:release=50:level=disabled
```

- El techo va en **lineal**, no como `-2dB`: `gainDbToVolume` (`src/mix/`) y `formatFilterNumber`
  (`src/mix/`) son las mismas dos funciones que ya formatean todos los números del filtergraph
  (R-15 de `cycle-01`), así que el master bus no estrena un formateador propio ni depende de cómo
  parsea `av_strtod` el sufijo `dB`. Bonus: el clamp a `[0,1]` de `gainDbToVolume` coincide con el
  rango que `alimiter` acepta en `limit`.
- `attack` y `release` se emiten **explícitos** aunque coincidan con los defaults de ffmpeg: si un
  release futuro cambia un default, el master cambiaría en silencio y las fixtures exactas del spec
  seguirían pasando.
- `level=disabled` es obligatorio (D-21): con el default `enabled` el filtro aplica *makeup gain* y
  sube el master hasta el techo.

`withMasterBusLimiter` es **pura y no muta**: devuelve un `FilterGraph` nuevo cuya última cadena
toma el `outputLabel` del grafo recibido como entrada y expone `MASTER_BUS_OUTPUT_LABEL`.

```ts
export function withMasterBusLimiter(graph: FilterGraph, target: VoiceTarget): FilterGraph {
  return {
    inputs: graph.inputs,
    chains: [
      ...graph.chains,
      {
        inputLabels: [graph.outputLabel],
        filters: [buildTruePeakLimiterFilter(target)],
        outputLabels: [MASTER_BUS_OUTPUT_LABEL],
      },
    ],
    outputLabel: MASTER_BUS_OUTPUT_LABEL,
  };
}
```

Cero ramas: no hay condición que decida si el limitador se aplica o no — se aplica **siempre**, y
por eso no hay opción para desactivarlo. Un master bus opcional sería una rama que nadie ejercita en
producción y un camino por el que el entregable puede clippear.

**Límite conocido, sin rama de validación:** `alimiter` acepta `limit` en `[0.0625, 1]`, es decir un
techo entre -24 dB y 0 dB. Con el margen de 1 dB, eso exige `target.truePeakDbtp >= -23`. Cualquier
target razonable (-1, -2) está lejísimos del borde; agregar un guard sería una rama muerta que baja
la cobertura sin proteger de nada real. Se documenta acá y en el README.

### 3.8 Auxiliares internos (NO van al barrel)

```ts
// src/ffmpeg/mix-timeline-audio.ts
function assertMixableTimeline(timeline: Timeline): void;
function assetCarriesAudio(asset: MediaAsset): boolean;
function voiceAssetPath(timeline: Timeline, clip: AudioClip): string;
function resolveVoiceMeasurementInputs(timeline: Timeline): ReadonlyMap<AssetId, string>;
function measureVoiceAssets(
  inputs: ReadonlyMap<AssetId, string>,
  target: VoiceTarget,
  runner: CommandRunner,
  opts: MixTimelineAudioOptions | undefined,
): Promise<ReadonlyMap<AssetId, LoudnessMeasurement>>;

// src/ffmpeg/mux-audio-into-video.ts
function assertVideoStreamPresent(
  videoPath: string,
  runner: CommandRunner,
  opts: MuxAudioIntoVideoOptions | undefined,
): Promise<void>;
```

---

## 4. Las dos pasadas de `loudnorm`: flujo exacto

### 4.1 Secuencia

```
mixTimelineAudio(timeline, out, runner, opts)
│
├─ 1. resolveVoiceMeasurementInputs(timeline)                       [sin I/O]
│     recorre timeline.tracks.voice en orden, deduplica por assetId,
│     y para cada assetId nuevo resuelve su path:
│       · asset inexistente        -> UnresolvedAudioAssetError { assetId, clipId, track: 'voice' }
│       · asset sin stream de audio-> MissingMediaStreamError   { path, stream: 'audio', assetId }
│     => ReadonlyMap<AssetId, string>   (N entradas; N = 1 en toda Timeline de buildTimeline)
│
├─ 2. assertMixableTimeline(timeline)                               [sin I/O]
│     buildAudioMixGraph({ timeline }) y descarta el grafo (D-13):
│     ZodError | 'no hay clips de audio' | UnresolvedAudioAssetError de la MÚSICA
│
├─ 3. measureVoiceAssets(...)                                       [N invocaciones de ffmpeg]
│     for..of secuencial sobre el Map (orden de inserción = orden de tracks.voice)
│     measureLoudness(path, runner, {
│       target: timeline.audioMix.voice,
│       ffmpegPath,
│       audioStreamSpecifier: FIRST_AUDIO_STREAM,
│       ...(runOptions)
│     })
│     => ReadonlyMap<AssetId, LoudnessMeasurement>
│
├─ 4. const mixGraph = buildAudioMixGraph({ timeline, voiceMeasuredByAssetId })   [sin I/O]
│     const graph    = withMasterBusLimiter(mixGraph, timeline.audioMix.voice)   [D-21, puro]
│     const args     = audioMixFfmpegArgs(graph, out)
│
├─ 5. runner.run(ffmpegPath, args, runOptions)                      [1 invocación de ffmpeg]
│     exitCode !== 0 -> CommandFailedError { command, args, exitCode, stderr }
│
└─ 6. { outputPath: out, filterComplex: serializeFilterGraph(graph), voiceMeasured, args }
```

**Total de invocaciones = N + 1.** Ver §4.4 para la relación con CA-008.

### 4.2 Args literales de la pasada 1 (medición)

Con `timeline.audioMix.voice = DEFAULT_AUDIO_MIX_PLAN.voice` y el asset de voz en
`/assets/aroll.mp4`, `measureLoudness` produce **exactamente**:

```ts
[
  '-hide_banner',
  '-nostats',
  '-i', '/assets/aroll.mp4',
  '-map', '0:a:0',
  '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
  '-f', 'null',
  '-',
]
```

Es la salida literal de `buildLoudnormFilter(target)` **sin `measured`** — la forma de primera
pasada (R-09 de cycle-01). El `-map` es lo único que agrega este ciclo, y sólo porque
`audioStreamSpecifier` está presente (D-15).

### 4.3 Args literales de la pasada 2 (mix)

`audioMixFfmpegArgs(graph, out)` se usa **tal cual** lo dejó `cycle-01` §4.3, sin una sola
modificación; lo único que cambia es que el `graph` que recibe ya trae la cadena de master bus, así
que su `outputLabel` es `master` y no `mix`:

```ts
[
  '-hide_banner', '-nostats', '-y',
  ...graph.inputs.flatMap((path) => ['-i', path]),
  '-filter_complex', serializeFilterGraph(graph),
  '-map', '[master]',
  '-c:a', 'pcm_s16le',
  '-ar', '48000',
  '-ac', '2',
  out,
]
```

#### La cadena que se apendea, literal (D-21)

`withMasterBusLimiter` agrega **una sola** `FilterChain` al final de `chains` y cambia el
`outputLabel`. Sobre la fixture de `cycle-01` §9.1/§9.2 (un clip de voz, uno de música,
`DEFAULT_VOICE_TARGET`):

```ts
{
  inputLabels: ['mix'],
  filters: ['alimiter=limit=0.794328235:attack=5:release=50:level=disabled'],
  outputLabels: ['master'],
}
```

El `FilterGraph` resultante es el de §9.2 de `cycle-01` con `chains` de longitud 4 en vez de 3 y
`outputLabel: 'master'` en vez de `'mix'`. `inputs` no cambia: el limitador no agrega entradas.

#### `-filter_complex` final, literal

Es **el string de 855 caracteres de `cycle-01` §9.3, sin tocar una coma**, más el sufijo de la
cadena nueva (75 caracteres; total **930**, verificado carácter por carácter contra §9.3):

```
[0:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,loudnorm=I=-14:TP=-1:LRA=11:print_format=json,aresample=48000[voice0];[1:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame,afade=t=in:st=0:d=0.5,afade=t=out:st=6:d=1,apad,atrim=end=7[music0];[voice0][music0]amix=inputs=2:duration=longest:normalize=0[mix];[mix]alimiter=limit=0.794328235:attack=5:release=50:level=disabled[master]
```

Sufijo agregado, aislado para que el implementador lo pueda comparar carácter por carácter:

```
;[mix]alimiter=limit=0.794328235:attack=5:release=50:level=disabled[master]
```

**El prefijo de 855 caracteres tiene que quedar byte-idéntico al de `cycle-01` §9.3.** Si difiere,
algo de `src/mix/` se tocó y este ciclo lo prohíbe (R-41).

#### Cómo se testea sin ejecutar ffmpeg

`mix-timeline-audio.spec.ts`, sobre la Timeline de la fixture de `cycle-01` §9.1 y con
`FixtureCommandRunner`:

1. `expect(runner.calls).toHaveLength(2)`.
2. `expect(runner.calls[1]?.args).toEqual([...])` con el array completo de arriba — eso fija en un
   solo `toEqual` el `-filter_complex` con limitador **y** el `-map [master]`.
3. `expect(result.filterComplex).toBe('<los 930 caracteres>')` y
   `expect(result.filterComplex.startsWith('<los 855 de cycle-01 §9.3>')).toBe(true)` — la segunda
   aserción es la que detecta una regresión en `src/mix/` sin depender de leer el diff.
4. `expect(result.filterComplex).toContain('level=disabled')` como aserción propia: es el parámetro
   cuya pérdida no rompería ningún otro test pero arruinaría el master (D-21).
5. `master-bus-limiter.spec.ts` prueba `withMasterBusLimiter` en aislamiento: que **no muta** el
   grafo de entrada (`expect(original).toEqual(snapshotPrevio)`), que `outputLabel` pasa a
   `'master'`, que la cadena nueva toma el `outputLabel` anterior como `inputLabels`, y que
   `buildTruePeakLimiterFilter` devuelve el string exacto para `truePeakDbtp: -1` y para
   `truePeakDbtp: -2` (`limit=0.707945784`), que es lo que prueba que el techo sale del target y no
   de un literal.

Cada cadena de voz del grafo lleva ahora
`loudnorm=I=-14:TP=-1:LRA=11:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:offset=…:linear=true:print_format=json`
— la salida literal de `buildLoudnormFilter(target, measured)`. Esa es la **segunda pasada**: la
misma semántica de dos pasadas que `normalizeVoice` ya implementa, aplicada al grafo completo.

El `stderr` de esta invocación también trae bloques JSON de `loudnorm` (el filtro siempre lleva
`print_format=json`): **se ignora**. No se parsea, no se expone. Quien quiera la medición del
resultado usa `verifyMixLoudness` sobre el archivo producido — que es el punto entero de RF-2-02.

### 4.4 Cantidad de invocaciones vs. CA-008 — declaración honesta

**CA-008 exige exactamente dos invocaciones. Este diseño hace `N + 1`, donde `N` = cantidad de
`assetId` distintos en `timeline.tracks.voice`.**

`N === 1` **por construcción** para toda Timeline que produzca `buildTimeline`:
`buildArollTrack(keeps, punches, transitions, edl.sourceAssetId, fps)` asigna **el mismo
`edl.sourceAssetId` a todos los clips de aroll**
(`libs/timeline-core/src/timeline/build-timeline.ts`), y `buildVoiceTrack(arollClips)` copia ese
`assetId` a cada clip de voz. Un EDL tiene un solo `sourceAssetId`. Por lo tanto, en el pipeline
real, **las invocaciones son exactamente dos y CA-008 se cumple**.

`N > 1` sólo es alcanzable con una `Timeline` armada a mano cuyos clips de voz referencien assets
distintos — algo que el `TimelineSchema` permite y que sería incorrecto medir una sola vez. El
diseño lo soporta genéricamente en lugar de asumir `N === 1` y romperse en silencio.

`N === 0` (Timeline sólo con música, válida según el `refine` de `AudioMixTimelineSchema`) da **una**
invocación: no hay voz que medir. Correcto, y también fuera del enunciado literal de CA-008.

**Cómo se verifica CA-008 en el spec:** el caso canónico usa una Timeline de `buildTimeline` y
aserta `runner.calls` con longitud **2**, `calls[0].args` igual al array de §4.2 y `calls[1].args`
igual a `audioMixFfmpegArgs(expectedGraph, out)`. Se agrega un segundo caso con una Timeline de dos
assets de voz distintos que aserta longitud 3, para que la regla general quede fijada por test y no
por prosa.

---

## 5. El `assetId` de la voz: resolución completa

**El hecho:** `buildVoiceTrack` copia el `assetId` del clip de aroll (§4.4). La voz **no tiene
asset propio**. En el pipeline real ese asset es el archivo de cámara del creador: un **contenedor
de video** (`kind: 'video'`, con `hasAudio: true` y un sub-objeto `audio`). En los fixtures de
`cycle-01` es un WAV (`kind: 'audio'`), porque el EDL de prueba usa `sourceAssetId: 'voice-1'`.
**Los dos casos son legítimos y los dos tienen que funcionar.**

Decisiones, una por pregunta abierta:

| Pregunta | Decisión |
| --- | --- |
| ¿Qué path entra a `measureLoudness`? | `asset.path` del `MediaAsset` cuyo `id === clip.assetId`, tomado de `timeline.assets` — **el mismo path que `buildAudioMixGraph` pone en `graph.inputs`** para ese clip (`resolveAssetPath`). No se extrae, no se convierte, no se copia a un intermedio: eso sería una tercera invocación. |
| ¿Hace falta `-map`? | **Sí, siempre** (D-15): `-map 0:a:0`. Selecciona el primer stream de audio del único input, sea el archivo un WAV o un MP4. Sin él, ffmpeg decodifica también el video contra el muxer `null` y, si no hay audio, sale con código 0 sin imprimir el JSON. |
| ¿Qué pasa si el asset no tiene audio? (§11.4 de cycle-01) | **`MissingMediaStreamError { path, stream: 'audio', assetId }`, lanzado antes de cualquier invocación.** Se decide con el dato que la Timeline ya tiene, sin `ffprobe` extra. |
| ¿Cuál es el predicado de "tiene audio"? | `asset.kind === 'audio' \|\| asset.hasAudio === true`. **No** `asset.hasAudio !== false`: `MediaAssetSchema` declara `hasAudio` como opcional y sólo lo **exige** para `kind: 'video'`, así que un asset `kind: 'audio'` construido a mano puede no traerlo (los fixtures de `cycle-01` son exactamente ese caso). Un `kind: 'image'` cae por los dos lados del `\|\|` y falla, que es lo correcto. |
| ¿Se deduplica por `assetId` o por `clipId`? | Por `assetId` (D-12), respetando el orden de `timeline.tracks.voice` para que `runner.calls` sea determinista (RNF-4). |

**Efecto secundario deseado:** con la Timeline canónica, el `loudnorm` de los N clips de voz recibe
**la misma** medición —la del archivo completo de la toma— y por lo tanto **el mismo offset**. La
dinámica relativa entre segmentos de la toma se preserva; una medición por clip la aplanaría.

---

## 6. Error tipado nuevo

```ts
// src/errors/media-local-error.ts   (MODIFICADO)
export type MediaLocalErrorCode =
  | 'BINARY_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'UNPARSEABLE_OUTPUT'
  | 'UNRESOLVED_AUDIO_ASSET'
  | 'MISSING_MEDIA_STREAM';
```

Es el **único** miembro que agrega el ciclo. `isMediaLocalError` lo reconoce sin cambios
(`instanceof MediaLocalError`). Firma completa en §3.5.

Quién lo lanza:

| Origen | `stream` | Cuándo |
| --- | --- | --- |
| `mixTimelineAudio` → `voiceAssetPath` | `'audio'` | El asset de un clip de voz existe pero no lleva audio. Antes de invocar nada. |
| `muxAudioIntoVideo` → `assertVideoStreamPresent` | `'video'` | `probeMedia(videoPath).kind !== 'video'`. Después del `ffprobe`, antes del `ffmpeg`. |

---

## 7. `verifyMixLoudness`: tolerancias y casos

### 7.1 Cálculo

```
measured            = measureLoudness(path, runner, { target, ffmpegPath, audioStreamSpecifier: '0:a:0', ... })
integratedDeltaLu   = measured.integratedLufs - target.integratedLufs
truePeakDeltaDb     = measured.truePeakDbtp   - target.truePeakDbtp
withinTolerance     = Math.abs(integratedDeltaLu) <= MIX_INTEGRATED_TOLERANCE_LU
                      && truePeakDeltaDb <= MIX_TRUE_PEAK_TOLERANCE_DB
```

Signo de los deltas: **positivo = por encima del objetivo**. `integratedDeltaLu > 0` es "más fuerte
que -14"; `truePeakDeltaDb > 0` es "por encima del techo de -1 dBTP", el único lado que importa.

### 7.2 Reglas

| # | Regla | De dónde sale |
| --- | --- | --- |
| 1 | Integrado: banda **simétrica e inclusiva**, `\|delta\| <= 1.0 LU`. Exactamente -15.00 o -13.00 están **dentro**. | D-F, RN-4 |
| 2 | True peak: **techo, no banda**. `delta <= 0`. -1.00 dBTP está dentro; -0.99 está **fuera**. No hay tolerancia hacia arriba. Estar muy por debajo (-11 dBTP) **no** es un fallo. | D-F, RN-4 |
| 3 | `measured.loudnessRange` se reporta dentro de `measured` y **no participa** de `withinTolerance`. | RN-5 |
| 4 | **Nunca lanza por estar fuera de tolerancia.** Devuelve el resultado con sus deltas; la decisión (rehacer el mix, avisar, publicar) es de quien consume. | RN-6, D-F |
| 5 | **Sí propaga el fallo del binario:** `measureLoudness` ya lanza `CommandFailedError` con el `stderr` truncado si el exit code no es 0, y `UnparseableOutputError` si el `stderr` no trae un JSON de `loudnorm`. `verifyMixLoudness` **no los atrapa**: no lleva `try/catch`. | RN-6/CE-2 |

La regla 5 es también una decisión de implementación: la ausencia de `try/catch` es lo que garantiza
que "fuera de tolerancia" y "no se pudo medir" nunca se confundan.

### 7.3 Los cinco casos del spec (CA-009)

Con `target = DEFAULT_VOICE_TARGET` (`I=-14`, `TP=-1`):

| Caso | Fixture | `integratedLufs` | `truePeakDbtp` | `integratedDeltaLu` | `truePeakDeltaDb` | `withinTolerance` |
| --- | --- | ---: | ---: | ---: | ---: | :--: |
| Dentro de tolerancia | `loudnorm-mix-in-tolerance.stderr.txt` | -13.62 | -1.42 | +0.38 | -0.42 | **true** |
| Borde exacto (inclusivo, regla 1 y 2) | `loudnorm-mix-at-boundary.stderr.txt` | -15.00 | -1.00 | -1.00 | 0.00 | **true** |
| Fuera por integrado | `loudnorm-mix-integrated-out.stderr.txt` | -11.80 | -1.30 | +2.20 | -0.30 | **false** |
| Fuera por true peak | `loudnorm-mix-true-peak-out.stderr.txt` | -14.10 | -0.40 | -0.10 | +0.60 | **false** |
| Fuera por ambos | `loudnorm-mix-both-out.stderr.txt` | -16.30 | -0.10 | -2.30 | +0.90 | **false** |

Los cinco valores están elegidos para que las restas sean **exactas en IEEE-754** o con error muy
por debajo de cualquier comparación relevante; el caso "borde exacto" usa -15.00 y -1.00 justamente
porque `-15 - (-14) === -1` y `-1 - (-1) === 0` sin residuo binario. Ninguno de los cinco lanza
(CA-4 del functional). El sexto caso del spec es el fallo del binario (regla 5), con
`exitCode: 1` y `stderr` propio, que aserta `CommandFailedError`.

---

## 8. `muxAudioIntoVideo`

### 8.1 Secuencia

```
muxAudioIntoVideo(videoPath, audioPath, out, runner, opts)
│
├─ 1. assertVideoStreamPresent(videoPath, runner, opts)      [1 invocación de ffprobe]
│     probeMedia(videoPath, runner, { ffprobePath })
│       · exit != 0            -> CommandFailedError  (lo lanza probeMedia)
│       · asset.kind !== 'video'-> MissingMediaStreamError { path: videoPath, stream: 'video' }
│
├─ 2. runner.run(ffmpegPath, args, runOptions)               [1 invocación de ffmpeg]
│     exitCode !== 0 -> CommandFailedError { command, args, exitCode, stderr }
│
└─ 3. { outputPath: out, args }
```

`probeMedia` recibe sólo `ffprobePath` (y `runOptions` si vino): el `MediaAsset` que devuelve se usa
para leer `kind` y se descarta, así que su `probedAt` —resuelto por `systemClock`— no es observable y
no compromete RNF-4.

### 8.2 Argumentos exactos (D-H, CA-010)

```ts
[
  '-hide_banner', '-nostats', '-y',
  '-i', videoPath,
  '-i', audioPath,
  '-map', '0:v:0',
  '-map', '1:a:0',
  '-c:v', 'copy',
  '-c:a', MUX_AUDIO_CODEC,   // 'aac'
  '-b:a', MUX_AUDIO_BITRATE, // '192k'
  '-shortest',
  out,
]
```

- El prefijo `-hide_banner -nostats -y` replica el de `normalizeVoice`, `extractAudioForTranscription`
  y `audioMixFfmpegArgs`: es la convención de la lib, y `-y` va **antes** de los inputs.
- **`-c:v copy` es innegociable** (RN-7): el spec lo aserta dos veces — una en el `toEqual` del array
  completo y otra con un `expect(args).toContain('copy')` explícito, para que un reordenamiento
  futuro que mantenga el array pero cambie el codec no pase.
- `MUX_AUDIO_CODEC` / `MUX_AUDIO_BITRATE` son constantes **propias del mux** y **no reusan**
  `AUDIO_MIX_CODEC` / `AUDIO_MIX_SAMPLE_RATE` / `AUDIO_MIX_CHANNELS`, que describen el WAV
  intermedio (§11.5 de cycle-01, RN-8).
- Sin `-ar`/`-ac`: el AAC hereda el sample rate y el layout del WAV intermedio (48 kHz estéreo por
  D-H). Agregarlos sería reafirmar en dos lugares lo que ya fija `audio-mix-format.ts`.

---

## 9. `composition-remotion`: por dónde viaja la opción `audio`

### 9.1 El recorrido, paso a paso

```
renderTimeline(timeline, { outPath, audio: 'muted' }, deps)
│
├─ inputProps: TimelineInputProps = { timeline, ...(options.audio === 'muted' ? { audio: 'muted' } : {}) }
│
├─ deps.selectTimelineComposition({ serveUrl, id, inputProps })
│     -> Remotion invoca calculateTimelineMetadata({ props: inputProps, ... })
│        return { ..., props: { ...props, timeline: metadata.timeline } }
│                              ^^^^^^^^ el spread ya existente propaga `audio` sin tocar nada
│
├─ deps.renderTimelineMedia({ composition, ..., inputProps })
│
└─ Remotion monta <TimelineComposition {...props} />
      audio === 'muted' ? no monta <AudioTrack/> : lo monta
```

**El spread de `calculateTimelineMetadata` es el punto crítico y ya está bien en el código actual**
(`props: { ...props, timeline: metadata.timeline }`). Sin él, `audio` —igual que hoy
`captionPreset`/`captionPlatform`/`captionAnchor`— desaparecería **en silencio**: el render saldría
con audio y el entregable tendría la mezcla duplicada, sin ningún error. Este ciclo **no lo
modifica**; el spec de no-regresión de `timeline-composition.spec.tsx` que ya cubre las props de
caption se extiende con `audio` para que quede blindado.

### 9.2 Los tres cambios, literales

```tsx
// src/components/timeline-composition.tsx
export type TimelineAudioMode = 'mix' | 'muted';

export type TimelineCompositionProps = {
  timeline: Timeline;
  audio?: TimelineAudioMode | undefined;
  captionPreset?: CaptionPresetId | undefined;
  captionPlatform?: CaptionPlatform | undefined;
  captionAnchor?: CaptionAnchor | undefined;
};

export const TimelineComposition: FC<TimelineCompositionProps> = ({
  timeline, audio, captionPreset, captionPlatform, captionAnchor,
}) => {
  ...
  <BrollTrack clips={plan.broll} />
  {audio === 'muted' ? null : (
    <AudioTrack voice={plan.voice} music={plan.music} automation={timeline.audioMix.automation} />
  )}
  <KineticCaptions ... />
```

```ts
// src/render.ts
import type { TimelineAudioMode } from './components/timeline-composition';

export type TimelineInputProps = { timeline: Timeline; audio?: TimelineAudioMode };

// dentro de renderTimeline, reemplazando `const inputProps: TimelineInputProps = { timeline };`
const inputProps: TimelineInputProps = {
  timeline,
  ...(options.audio === 'muted' ? { audio: options.audio } : {}),
};
```

```ts
// src/index.ts
export type { TimelineAudioMode, TimelineCompositionProps } from './components/timeline-composition';
```

`render.ts` importa `TimelineAudioMode` con `import type` — se borra en emisión y no agrega ninguna
carga de React/Remotion a la entrada Node (el módulo ya se importa por `TIMELINE_COMPOSITION_ID`).

### 9.3 Por qué esto no rompe nada (CA-8 del functional, RN-10/RN-12)

| Llamada | `inputProps` resultante | ¿Cambia respecto de hoy? |
| --- | --- | --- |
| `renderTimeline(t, { outPath })` | `{ timeline }` | **No.** Idéntico byte a byte. |
| `renderTimeline(t, { outPath, audio: 'mix' })` | `{ timeline }` | **No.** El default explícito es indistinguible de omitirlo. |
| `renderTimeline(t, { outPath, audio: 'muted' })` | `{ timeline, audio: 'muted' }` | Sí, y sólo acá. |

Los siete tests de `render.spec.ts` pasan **sin una sola modificación**, incluido el
`toHaveBeenCalledWith({ serveUrl, id, inputProps: { timeline } })` que compara estructuralmente.

`Root.tsx` no cambia: sus `defaultProps` no traen `audio`, así que `remotion studio` y el `Player`
siguen mostrando el preview **con** audio, que es lo que D-B pide conservar.

### 9.4 Tests de CA-011

1. `render.spec.ts`: `audio: 'muted'` ⇒ `selectTimelineComposition` y `renderTimelineMedia`
   reciben `inputProps: { timeline, audio: 'muted' }`.
2. `render.spec.ts`: `audio: 'mix'` ⇒ `inputProps: { timeline }` con `toEqual` estricto (no
   `objectContaining`), que es lo que prueba la no-regresión de RN-10.
3. `timeline-composition.spec.tsx`: `calculateTimelineMetadata` preserva `audio` (extensión del test
   de props de caption ya existente).
4. `timeline-composition.spec.tsx`: montando `TimelineComposition` con `audio: 'muted'` **no aparece
   ningún `<Audio>`** en el árbol, y sin la prop sí aparece. El archivo hoy sólo prueba
   `calculateTimelineMetadata`; el render del componente se hace con `@testing-library/react`
   (ya es dependencia y `kinetic-captions.spec.tsx` lo usa) o inspeccionando el árbol de elementos
   como hace `Root.spec.tsx` — a criterio del implementador, sin montar Remotion de verdad.

**Cobertura:** `vite.config.ts` de la lib mide sólo `src/helpers/**` y `src/transitions/**`. Ninguno
de estos tres archivos entra al reporte, así que los pisos de RNF-2 para `composition-remotion` no
se mueven por este cambio. Los tests siguen siendo obligatorios por CA-011: son contrato, no
cobertura.

---

## 10. Fixtures nuevas

### 10.1 Qué hace falta y qué no

| Spec | Fixture | Origen |
| --- | --- | --- |
| `mix-timeline-audio.spec.ts` (pasada de medición) | `ffmpeg/loudnorm.stderr.txt` | **Reusa la existente.** Es exactamente un `stderr` de primera pasada de `loudnorm`; nada la hace específica de `normalizeVoice`. |
| `mix-timeline-audio.spec.ts` (pasada de mix) | — | No hace falta: la respuesta del runner es `{ exitCode: 0 }` con `stderr: ''`. El `stderr` de esa pasada **no se parsea** (§4.3). |
| `mix-timeline-audio.spec.ts` (fallo del binario) | — | `{ exitCode: 1, stderr: 'ffmpeg: …' }` inline, como ya hace `loudnorm.spec.ts`. |
| `verify-mix-loudness.spec.ts` | **5 archivos nuevos** (tabla de §7.3) | Reconstruidos a mano. |
| `mux-audio-into-video.spec.ts` (camino feliz) | `ffprobe/video-rotated.json` | **Reusa la existente.** Probea como `kind: 'video'`. |
| `mux-audio-into-video.spec.ts` (CE-3) | `ffprobe/audio.json` | **Reusa la existente.** Probea como `kind: 'audio'` ⇒ sin stream de video. |

Total: **5 fixtures nuevas**, todas en `src/__fixtures__/ffmpeg/`, todas cargadas con `readFixture`.

### 10.2 Procedencia — declaración explícita

**Las cinco son reconstruidas a mano, no capturas reales.** Se construyen con el mismo formato y la
misma indentación con tabs que `ffmpeg/loudnorm.stderr.txt` y `ffmpeg/loudnorm.json` (que también
están reconstruidas, según la constitución §3 y el README de la lib), cambiando únicamente los
valores numéricos por los de la tabla de §7.3. Son el `stderr` de una **primera pasada** de
`loudnorm` sobre el archivo que se está verificando: el bloque de líneas humanas de ffmpeg más el
objeto JSON final, que es lo único que `extractTrailingJsonObject` mira.

Campos del JSON de cada fixture: `input_i` e `input_tp` según la tabla; `input_lra` un valor
plausible distinto en cada una (para que se vea que se reporta y que **no** afecta
`withinTolerance`, RN-5); `input_thresh`, `output_i`, `output_tp`, `output_lra`, `output_thresh`,
`normalization_type` y `target_offset` coherentes.

El README de la lib gana estos comandos exactos para re-grabarlas con binarios reales, en la sección
"Fixtures: procedencia y cómo regrabarlas":

```bash
# ffmpeg/loudnorm-mix-*.stderr.txt — la medición que hace verifyMixLoudness
# (el -map 0:a:0 es lo que la distingue de loudnorm.stderr.txt: sirve igual para un WAV y para el MP4 final)
ffmpeg -hide_banner -nostats -i master.wav -map 0:a:0 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - \
  2> src/__fixtures__/ffmpeg/loudnorm-mix-in-tolerance.stderr.txt
```

**Si alguna vez se graban corridas reales, los valores numéricos de la tabla de §7.3 no se pueden
cambiar sin actualizar el spec:** los cinco `toEqual` de `verify-mix-loudness.spec.ts` dependen de
ellos, y el caso "borde exacto" en particular sólo prueba lo que tiene que probar si vale exactamente
-15.00 / -1.00.

---

## 11. El target `media-local:smoke-audio` (RF-2-05, CA-012)

### 11.1 Definición en `project.json`

```json
"smoke-audio": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "libs/media-local",
    "parallel": false,
    "commands": [
      "tsc -p tsconfig.smoke.json --noEmit",
      "node -r ./smoke/smoke-register.cjs ./smoke/smoke-audio.ts"
    ],
    "env": { "SWC_NODE_PROJECT": "./tsconfig.smoke.json" }
  }
}
```

`smoke/smoke-register.cjs` es copia literal del de `composition-remotion` (el shim de
`@swc-node/register` que preserva el loader de `.js`). `tsconfig.smoke.json`:

```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": { "baseUrl": "../.." },
  "include": ["src/**/*.ts", "smoke/**/*.ts"]
}
```

**Fuera de CI sin hacer nada:** `.github/workflows/ci.yml` corre
`nx run-many -t lint test build`; `smoke-audio` no está en esa lista, igual que
`composition-remotion:smoke` y `:studio` (RN-15, CA-10 del functional).

**Requisito de entorno:** `ExecaCommandRunner` importa `execa` v10, que es ESM puro; el smoke corre
bajo `@swc-node/register` en contexto CJS, así que necesita **Node ≥ 22.12** (`require(esm)`). Se
documenta en el README junto a la matriz de binarios.

### 11.2 Señales de prueba que genera (RN-13)

Tres archivos, con `ffmpeg` real vía `ExecaCommandRunner`, en
`libs/media-local/tmp/smoke-audio/`. Duración 12 s a 30 fps (360 frames), resolución chica a
propósito: lo que se verifica es audio, y el mux copia el stream de video sin mirarlo.

```bash
# 1) aroll.mp4 — contenedor de VIDEO con la "voz" adentro, que es el caso real (§5):
#    buildVoiceTrack le da al clip de voz el assetId del aroll.
ffmpeg -hide_banner -nostats -y \
  -f lavfi -i testsrc2=size=540x960:rate=30:duration=12 \
  -f lavfi -i sine=frequency=220:sample_rate=48000:duration=12 \
  -filter:a volume=-20dB \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest \
  tmp/smoke-audio/aroll.mp4

# 2) music.wav — cama musical, 15 dB por encima de donde va a quedar después del baseGainDb
ffmpeg -hide_banner -nostats -y \
  -f lavfi -i sine=frequency=440:sample_rate=48000:duration=12 \
  -filter:a volume=-12dB -c:a pcm_s16le -ar 48000 -ac 2 \
  tmp/smoke-audio/music.wav

# 3) render-muted.mp4 — el stand-in del render mudo de Remotion (D-B / RF-2-04).
#    media-local NO puede importar composition-remotion (D-G): el smoke fabrica un video sin audio.
ffmpeg -hide_banner -nostats -y \
  -f lavfi -i testsrc2=size=540x960:rate=30:duration=12 \
  -c:v libx264 -pix_fmt yuv420p -an \
  tmp/smoke-audio/render-muted.mp4
```

Niveles y por qué caen dentro de tolerancia: un `sine` a `-20 dB` mide ≈ -23 LUFS, así que la voz
obliga a `loudnorm` a subir ~9 dB (prueba que la normalización hizo algo). La música a `-12 dB`
(≈ -15 LUFS) recibe además el `clip.gainDb = -12` de `DEFAULT_MUSIC_MIX` ⇒ ≈ -27 LUFS, y baja a
≈ -39 LUFS en los tramos duckeados. La suma de -14 y -27 da ≈ **-13.8 LUFS**, holgadamente dentro de
-14 ±1.0. El true peak queda ≈ -11 dBTP: una sinusoide tiene factor de cresta ~3 dB, así que la
señal normalizada a -14 LUFS pica muy por debajo del techo y **el `alimiter` del master bus (D-21)
no llega a engancharse** con estas señales.

Eso es deliberado y a la vez una limitación del smoke que hay que decir: con sinusoides el
limitador queda transparente, así que el smoke verifica que **está en el grafo y que no altera el
integrado**, no que recorta de verdad. Lo segundo se verifica en el spec, sobre los argumentos
(§4.3), que es donde RNF-1 permite verificarlo. Quien quiera ver el limitador trabajar puede subir
la generación de la voz a `volume=-6dB`: el master pasa a picar por encima de -2 dBFS y la medición
impresa muestra el true peak clavado bajo el techo.

### 11.3 Qué corre, en qué orden

1. `resolveBinaries(process.env)` → rutas de `ffmpeg` y `ffprobe` (`BinaryNotFoundError` si faltan,
   CE-5). Se ignoran `whisperCli`/`whisperModel` usando `resolveBinary('ffmpeg' | 'ffprobe', …)` en
   vez de `resolveBinaries`, para no exigir whisper a quien sólo quiere probar audio.
2. `mkdirSync(tmp/smoke-audio, { recursive: true })`.
3. Genera las tres señales (§11.2) con `runner.run(ffmpegPath, [...])`.
4. `probeMedia` de `aroll.mp4` y `music.wav` → dos `MediaAsset` **reales** (con `hasAudio`, `fps`,
   `width`/`height` y `probedAt` de verdad).
5. Arma el EDL mínimo y la Timeline con `buildTimeline` (de `@video-maker/timeline-core`), para que
   el smoke ejercite el camino real —incluido el `assetId` compartido entre aroll y voz—:

   ```ts
   const edl: EditDecisionList = {
     schemaVersion: 1,
     sourceAssetId: 'aroll',
     format: defaultFormat('reels-9x16'),
     generatedBy: { tool: 'smoke-audio', params: {} },
     decisions: [
       { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 12000 },
       { id: 'duck-0001', type: 'duck', startMs: 2000, endMs: 5000, gainDb: -24 },
       { id: 'duck-0002', type: 'duck', startMs: 7000, endMs: 9000, gainDb: -24 },
     ],
   };
   const timeline = buildTimeline(edl, [arollAsset, musicAsset], { assetId: 'music' });
   ```

   (La forma exacta del EDL es la de
   `libs/timeline-core/src/timeline/build-timeline.spec.ts` / `__fixtures__/edl.ts`.)
6. `mixTimelineAudio(timeline, 'tmp/smoke-audio/master.wav', runner, { ffmpegPath })`.
7. `verifyMixLoudness('tmp/smoke-audio/master.wav', timeline.audioMix.voice, runner, { ffmpegPath })`.
8. `muxAudioIntoVideo('tmp/smoke-audio/render-muted.mp4', 'tmp/smoke-audio/master.wav',
   'tmp/smoke-audio/final.mp4', runner, { ffmpegPath, ffprobePath })`.
9. `verifyMixLoudness('tmp/smoke-audio/final.mp4', timeline.audioMix.voice, runner, { ffmpegPath })`
   — **ésta es la medición que CA-012 exige imprimir**: la del entregable, después del AAC, no la del
   intermedio.
10. Chequeo negativo de CE-3: `muxAudioIntoVideo('…/master.wav', '…/master.wav', '…/should-not-exist.mp4', …)`
    dentro de un `try/catch`, esperando `MissingMediaStreamError` con `stream: 'video'`. Verifica el
    error tipado contra un archivo real, sin necesitar un asset especial.

### 11.4 Qué imprime y con qué exit code

```
smoke-audio · libs/media-local
  ffmpeg  : /opt/homebrew/bin/ffmpeg
  ffprobe : /opt/homebrew/bin/ffprobe

  señales  : tmp/smoke-audio/aroll.mp4  tmp/smoke-audio/music.wav  tmp/smoke-audio/render-muted.mp4
  master   : tmp/smoke-audio/master.wav
  entregable: tmp/smoke-audio/final.mp4

  voz medida (pasada 1)  I=-23.4 LUFS  TP=-20.0 dBTP  LRA=0.2 LU  offset=+9.4 dB
  master bus             alimiter=limit=0.794328235:attack=5:release=50:level=disabled  (techo -2 dBFS)
  master (WAV)           I=-13.8 LUFS  TP=-10.9 dBTP  LRA=1.1 LU  Δ=+0.2 LU / -9.9 dB  -> dentro
  entregable (MP4/AAC)   I=-13.8 LUFS  TP=-10.8 dBTP  LRA=1.1 LU  Δ=+0.2 LU / -9.8 dB  -> dentro

  invocaciones de ffmpeg del mix: 2   (medición + mix)
  CE-3 (mux sin stream de video): MissingMediaStreamError  -> OK

  RESULTADO: PASS
```

`process.exitCode = 1` si el `verifyMixLoudness` del **entregable** devuelve
`withinTolerance: false`, o si el chequeo de CE-3 no lanza el error esperado. Sin eso el target sería
un `console.log` decorativo y CA-9 ("imprime una medición dentro de…") no sería verificable de forma
automática. Los números de arriba son ilustrativos del formato, no valores esperados exactos.

---

## 12. Superficie pública: qué entra a `src/index.ts`

Se agregan **exactamente** estos símbolos a `libs/media-local/src/index.ts`, ni uno más:

```ts
export { mixTimelineAudio } from './ffmpeg/mix-timeline-audio';
export type { MixTimelineAudioOptions, MixTimelineAudioResult } from './ffmpeg/mix-timeline-audio';

export {
  MIX_INTEGRATED_TOLERANCE_LU,
  MIX_TRUE_PEAK_TOLERANCE_DB,
  verifyMixLoudness,
} from './ffmpeg/verify-mix-loudness';
export type { MixLoudnessVerification, VerifyMixLoudnessOptions } from './ffmpeg/verify-mix-loudness';

export { MUX_AUDIO_BITRATE, MUX_AUDIO_CODEC, muxAudioIntoVideo } from './ffmpeg/mux-audio-into-video';
export type { MuxAudioIntoVideoOptions, MuxAudioIntoVideoResult } from './ffmpeg/mux-audio-into-video';

export { MissingMediaStreamError } from './errors/missing-media-stream-error';
export type { MissingStreamKind } from './errors/missing-media-stream-error';

export { MASTER_BUS_TRUE_PEAK_MARGIN_DB } from './ffmpeg/master-bus-limiter';
```

`MASTER_BUS_TRUE_PEAK_MARGIN_DB` es el **único** símbolo del master bus que entra al barrel, y entra
porque es parte del contrato observable: un consumidor que pida -1 dBTP y mida -2.1 tiene que poder
entender por qué sin abrir el código (D-21). `withMasterBusLimiter` y el resto quedan afuera: son el
cómo, y `mixTimelineAudio` ya los aplica siempre.

`MeasureLoudnessOptions` ya está exportado y sólo gana un campo. **Fuera del barrel** a propósito:
`FIRST_AUDIO_STREAM`, `withMasterBusLimiter`, `buildTruePeakLimiterFilter`,
`MASTER_BUS_OUTPUT_LABEL`, `MASTER_BUS_LIMITER_ATTACK_MS`, `MASTER_BUS_LIMITER_RELEASE_MS` y todos
los auxiliares de §3.8.

En `libs/composition-remotion/src/index.ts`, un solo símbolo nuevo: `TimelineAudioMode` (tipo).
`RenderTimelineOptions` vive en `src/render.ts`, que es la **otra** entrada
(`@video-maker/composition-remotion/render`) y ya la exporta.

---

## 13. Divergencias y hallazgos — para el orquestador y el reviewer

> **Estado tras la revisión del orquestador (2026-09-08).** Los cinco puntos fueron respondidos:
> §13.1 y §13.3 se **incorporaron a la spec** (RF-6 y CA-008 corregidos); §13.2 se aceptó tal cual;
> §13.5 dejó de ser una limitación documentada y se convirtió en **D-K de la spec / D-21 de este
> documento** (master bus con limitador); la observación sobre `out/` de `composition-remotion` era
> incorrecta de mi parte y se retiró. Las secciones se conservan porque son la traza de por qué el
> diseño quedó así.

### 13.1 RF-6: `mixTimelineAudio(timeline, assets, out, …)` → `mixTimelineAudio(timeline, out, …)` — ACEPTADA, spec corregida

`Timeline.assets` ya lleva los assets y `buildAudioMixGraph` resuelve exclusivamente contra ellos
(`resolveAssetPath`). Un parámetro `assets` paralelo permitiría pasar un set distinto del que ya
está en la Timeline y desincronizar el grafo de la medición sin que nada lo note. Es literalmente el
razonamiento de D-J.3 aplicado un nivel más arriba. **La spec manda sobre el borrador; esta línea
corrige la spec.**

### 13.2 §11.2 de `cycle-01`: "dos llamadas a `buildAudioMixGraph`" ≠ "dos grafos ejecutados"

La frase admite leerse como que el **grafo** de primera pasada se ejecuta para obtener las
mediciones. No se puede: una instancia de `loudnorm` por clip (no por asset), `parseLoudnormJson`
sólo lee el último bloque JSON, y cada bloque mide un segmento post-`adelay`. Se hacen las dos
llamadas (D-13) pero sólo el segundo grafo se ejecuta; la medición la hace `measureLoudness` por
asset, que es lo que la propia §11.2 dice en su segunda mitad y lo que §3.4 fija como contrato.

### 13.3 CA-008 "exactamente dos invocaciones" es `N + 1` — ACEPTADA, spec corregida

Desarrollado en §4.4. `N === 1` por construcción en toda Timeline de `buildTimeline` ⇒ **CA-008 se
cumple en el pipeline real**. No se esconde: se testea el caso canónico (2 invocaciones) y el caso
general (3 con dos assets de voz). CA-008 de la spec ya dice `N + 1`.

### 13.4 `verifyMixLoudness` y `mixTimelineAudio` obligan a tocar `measureLoudness`

No es una reescritura: es una opción nueva que, omitida, deja los argumentos **idénticos** (D-15).
`src/mix/` no se toca. Se declara acá porque el brief lista sólo tres funciones nuevas y el
implementador va a modificar un cuarto archivo de producción.

### 13.5 Hallazgo de audio: el grafo de `cycle-01` **no tiene limitador después del `amix`**

`loudnorm` se aplica **por clip de voz**; la música entra en paralelo y `amix` suma con
`normalize=0`. Nada normaliza ni limita la **salida** del mix. Consecuencias:

- El integrado del master es la suma de voz + música, no -14 exacto. Con la música 13 dB por debajo
  (el default `baseGainDb: -12` sobre una cama ya suave) la desviación es de ~+0.2 LU: dentro de
  tolerancia. Con una cama fuerte, no.
- El true peak del master **puede superar -1 dBTP** aunque cada clip de voz esté limitado a -1: el
  `loudnorm` de la voz garantiza -1 en **su** salida, y sumarle música empuja el pico por encima.
  Con voz real (factor de cresta 12–18 dB) es un escenario realista; con las sinusoides del smoke,
  no (§11.2).

**Esto no es un bug de nadie**: `verifyMixLoudness` existe justamente para detectarlo y D-F decide
explícitamente que no se lanza. Pero significa que **-14 LUFS / -1 dBTP es un objetivo medido, no
garantizado**. La corrección —un `alimiter=limit=-1dB` o un `loudnorm` de salida después del `amix`—
toca `buildAudioMixGraph`, que es de `cycle-01` y está cerrado: **se reporta, no se rediseña**.
Candidato natural a `spec-005` o a un fix posterior. Debe quedar escrito en los READMEs (RF-2-06).

### 13.6 Dos observaciones menores, sin acción en este ciclo

- `libs/composition-remotion/out/` (donde escribe el smoke existente) **no está en ningún
  `.gitignore`**. Este ciclo lo evita escribiendo en `tmp/` (D-19), pero el directorio `out/` sigue
  siendo basura potencialmente commiteable. Fix de una línea, fuera de alcance.
- Deuda de test heredada que este ciclo **no** puede saldar (implicaría tocar `src/mix/`): todos los
  fixtures de `src/mix/` usan `from: 0` / `trimStartMs: 0`, así que el `adelay` sólo está verificado
  en su valor degenerado (ver el fragmento de contexto de `cycle-01`). El fixture de
  `mix-timeline-audio.spec.ts` **sí** puede usar un EDL con dos `keep` (que produce clips con
  `from > 0` y `trimStartMs > 0`) y así cubrirlo de rebote, sin modificar ningún archivo de
  `src/mix/`. Recomendado, no obligatorio.

### 13.7 Lo que sí cierra sin observaciones

RF-2-02, RF-2-03, RF-2-04, RF-2-05 y RF-2-06 se implementan tal cual los describe el functional. Las
tolerancias de D-F, los argumentos de D-H, el default `'mix'` de RF-9 y el alcance de D-G están
verificados contra el código real y no requieren corrección.

---

## 14. Reglas de decisión para el implementador

Numeradas y en este orden de precedencia si alguna vez chocan. Continúan la numeración de
`cycle-01` (que llegó a R-24) y **no la derogan**: R-01..R-24 siguen vigentes para `src/mix/`.

| # | Regla | Verifica |
| ---: | --- | --- |
| R-25 | `CommandRunner` es **parámetro posicional obligatorio** de las tres funciones nuevas. Nada instancia `ExecaCommandRunner` dentro de `src/**`. Las rutas de binarios entran por `opts.ffmpegPath` / `opts.ffprobePath` con default `'ffmpeg'` / `'ffprobe'`. | RNF-3 |
| R-26 | Ningún `*.spec.ts` de ninguna de las dos libs ejecuta un binario. Todo con `FixtureCommandRunner` y dobles. `smoke-audio` es el **único** lugar con ffmpeg real. | RNF-1, CA-014 |
| R-27 | `mixTimelineAudio` hace **N + 1** invocaciones y en ese orden: N mediciones (una por `assetId` distinto de `tracks.voice`, en orden de aparición) y después el mix. Nunca `Promise.all`: el orden de `runner.calls` es parte del contrato. | CA-008, RNF-4 |
| R-28 | Toda validación y toda resolución de assets ocurre **antes** de la primera invocación: `resolveVoiceMeasurementInputs` y después `assertMixableTimeline`. Una Timeline inválida rechaza con `runner.calls.length === 0`. | CA-008 |
| R-29 | El grafo de primera pasada (`buildAudioMixGraph({ timeline })`) **no se ejecuta jamás**. Si aparece una tercera invocación de ffmpeg en `mixTimelineAudio`, el diseño se rompió. | §13.2, CA-008 |
| R-30 | La medición usa `timeline.audioMix.voice` como target, el mismo `VoiceTarget` que `buildVoiceChain` mete en el grafo. Nunca `DEFAULT_VOICE_TARGET` hardcodeado ni un target por `opts`. | RF-2-01 |
| R-31 | Toda medición de este ciclo pasa `audioStreamSpecifier: FIRST_AUDIO_STREAM`. Omitida la opción, los args de `measureLoudness` quedan **byte-idénticos** a los de hoy: `loudnorm.spec.ts` no se modifica. | D-15, §5 |
| R-32 | "Tiene audio" es `asset.kind === 'audio' \|\| asset.hasAudio === true`. **Nunca** `hasAudio !== false`: el schema lo declara opcional y sólo lo exige para `kind: 'video'`. | §5 |
| R-33 | `verifyMixLoudness` **no lleva `try/catch`**. Fuera de tolerancia devuelve; fallo del binario propaga `CommandFailedError`/`UnparseableOutputError` tal cual. | RN-6, CE-2 |
| R-34 | Tolerancias por constante nombrada (`MIX_INTEGRATED_TOLERANCE_LU`, `MIX_TRUE_PEAK_TOLERANCE_DB`), sin opción que las mueva. Integrado inclusivo simétrico; true peak es **techo**, `delta <= 0`. | RN-4, D-F, D-20 |
| R-35 | Los valores objetivo (-14 / -1) salen del `VoiceTarget` recibido, nunca de constantes nuevas de este ciclo. | D-20 |
| R-36 | `muxAudioIntoVideo` valida el stream de video con `probeMedia` **antes** de invocar ffmpeg. Prohibido inferir CE-3 leyendo el `stderr`. | D-16, CE-3 |
| R-37 | `-c:v copy` está siempre en los args del mux, y el spec lo aserta **dos veces**: el array completo con `toEqual` y un `toContain('copy')` aparte. | RN-7, CA-010 |
| R-38 | El mux **no reusa** `AUDIO_MIX_CODEC`/`AUDIO_MIX_SAMPLE_RATE`/`AUDIO_MIX_CHANNELS`: esas describen el WAV intermedio. Usa `MUX_AUDIO_CODEC`/`MUX_AUDIO_BITRATE`. | RN-8, §11.5 de cycle-01 |
| R-39 | `renderTimeline` agrega `audio` a `inputProps` **sólo** cuando vale `'muted'`. Con `undefined` o `'mix'`, `inputProps` es exactamente `{ timeline }`. Ningún `?? 'mix'`. | RN-10/RN-12, CA-011, D-17 |
| R-40 | El spread de `calculateTimelineMetadata` (`props: { ...props, timeline }`) **no se toca**. Sin él, `audio` se pierde en silencio y el entregable sale con audio duplicado. | §9.1 |
| R-41 | `src/mix/**` no se modifica, ni un archivo ni un test. Si algo de ahí parece mal, se reporta al reviewer. | brief, D-A |
| R-42 | `smoke-audio` vive fuera de `src/**` y escribe en `libs/media-local/tmp/`. Ni `eslint.config.mjs` raíz ni el de la lib se modifican. | RNF-6, D-18, D-19 |
| R-43 | Cero comentarios en el código. `exactOptionalPropertyTypes: true`: nunca un `undefined` explícito a una propiedad opcional — spread condicional, como ya hace `normalizeVoice` con `runOptions`. | RNF-5, R-24 |
| R-44 | El barrel exporta **exactamente** lo listado en §12. Los specs importan lo interno por ruta relativa. | constitución §3 |

### 14.1 Cobertura: dónde están las ramas y cómo cubrirlas sin código muerto

| Módulo | Ramas | Casos mínimos del spec |
| --- | --- | --- |
| `errors/missing-media-stream-error` | `stream` en el mensaje; `assetId` presente/ausente | uno con `assetId`, uno sin |
| `ffmpeg/measure-loudness` (modificado) | `audioStreamSpecifier` presente / ausente | los tests existentes cubren "ausente"; uno nuevo cubre "presente" y aserta el array completo |
| `ffmpeg/mix-timeline-audio` | asset de voz inexistente; asset sin audio; `hasAudio` ausente en `kind: 'audio'`; Zod ko; `exitCode !== 0` en la medición; `exitCode !== 0` en el mix; N=1; N=2; N=0 (sólo música) | nueve casos; el camino feliz reusa la Timeline de `buildTimeline` |
| `ffmpeg/verify-mix-loudness` | integrado dentro/fuera; true peak dentro/fuera; borde exacto | los cinco de §7.3 + el fallo del binario |
| `ffmpeg/mux-audio-into-video` | `kind === 'video'` / `!== 'video'`; `exitCode !== 0`; `ffprobe` con `exitCode !== 0` | cuatro casos |
| `components/timeline-composition` | `audio === 'muted'` / no | dos casos (no entra al reporte de cobertura de la lib, ver §9.4) |
| `render.ts` | `options.audio === 'muted'` / no | dos casos (ídem) |

Ninguna de estas ramas es inalcanzable: la de `asset === undefined` en `voiceAssetPath` lo es
**porque `resolveVoiceMeasurementInputs` corre antes de `assertMixableTimeline`** (§4.1). Si el orden
se invierte, esa rama pasa a ser código muerto y la cobertura de ramas baja: es el motivo del orden,
y R-28 lo fija.

---

## 15. Qué le dejo a `spec-e-burgos-005`

La API pública final que `apps/render-api` (`type:app`, el único subproyecto que puede depender de
las dos libs sin tocar los boundaries) va a consumir para hacer `render → mix → mux`:

### 15.1 Las cuatro llamadas, en orden

```ts
import { renderTimeline } from '@video-maker/composition-remotion/render';
import {
  ExecaCommandRunner,
  mixTimelineAudio,
  muxAudioIntoVideo,
  resolveBinary,
  verifyMixLoudness,
} from '@video-maker/media-local';

const runner = new ExecaCommandRunner();
const ffmpegPath = await resolveBinary('ffmpeg', process.env);
const ffprobePath = await resolveBinary('ffprobe', process.env);

// 1. video mudo (Remotion) — sin esto el entregable suena con la mezcla duplicada
const render = await renderTimeline(timeline, { outPath: 'work/video-muted.mp4', audio: 'muted' });

// 2. master de audio (ffmpeg, dos pasadas de loudnorm)
const mix = await mixTimelineAudio(timeline, 'work/master.wav', runner, { ffmpegPath });

// 3. entregable (mux sin reencodear el video)
const final = await muxAudioIntoVideo(render.outPath, mix.outputPath, 'out/final.mp4', runner, {
  ffmpegPath,
  ffprobePath,
});

// 4. verificación del entregable — no lanza si está fuera de tolerancia: decide el llamador
const check = await verifyMixLoudness(final.outputPath, timeline.audioMix.voice, runner, { ffmpegPath });
if (!check.withinTolerance) {
  // integratedDeltaLu / truePeakDeltaDb dicen por cuánto y para qué lado
}
```

### 15.2 Contrato de errores que `spec-005` tiene que manejar

| Error | Cuándo | Recuperable |
| --- | --- | --- |
| `RenderTimelineError` (`INVALID_TIMELINE` / `BUNDLE_FAILED` / `COMPOSITION_NOT_FOUND` / `RENDER_FAILED`) | paso 1 | según el código |
| `UnresolvedAudioAssetError` | paso 2, sin haber invocado nada | no: la Timeline está mal armada |
| `MissingMediaStreamError` (`stream: 'audio'`) | paso 2, sin haber invocado nada | no: el asset de voz no tiene audio |
| `MissingMediaStreamError` (`stream: 'video'`) | paso 3, después del `ffprobe` y antes del `ffmpeg` | no: el render no produjo video |
| `CommandFailedError` | pasos 2, 3 y 4 | trae `command`, `args`, `exitCode` y `stderr` truncado a 2 KB |
| `UnparseableOutputError` | pasos 2 y 4 | el binario corrió pero su salida no se pudo parsear |
| `BinaryNotFoundError` | resolución de binarios | falta ffmpeg/ffprobe en el entorno |

Todos derivan de `MediaLocalError` salvo `RenderTimelineError`: `isMediaLocalError(e)` los distingue.

### 15.3 Lo que `spec-005` debe saber antes de diseñar

1. **El orden importa y no es conmutable.** El render tiene que ser `audio: 'muted'`; si no, el
   entregable trae la mezcla de Remotion **encima** de la masterizada. Es el defecto que RF-2-04
   existe para evitar.
2. **`mixTimelineAudio` no depende del render.** Trabaja sobre los assets originales, así que
   re-masterizar no obliga a re-renderizar frames (D-B), y los pasos 2 y 1 pueden correr en
   paralelo. El paso 3 los junta.
3. **-14 LUFS / -1 dBTP es medido, no garantizado** (§13.5): el grafo no lleva limitador de salida.
   `spec-005` decide la política ante `withinTolerance: false` — reintentar con la cama musical más
   baja, avisar al usuario o publicar igual. Esta spec deliberadamente no la decide (D-F).
4. **La paridad con el preview es de la curva de ducking de la música, no del nivel absoluto de la
   voz** (D-J.6): el preview no aplica `loudnorm` y el master sí. No es un bug.
5. **`gainDbToVolume` está duplicada a propósito** entre las dos libs (boundaries Nx). Tocar una sin
   la otra rompe CA-002 de `cycle-01`.
6. **Los intermedios los limpia el llamador.** Ninguna de las tres funciones borra `master.wav` ni
   `video-muted.mp4`, ni crea directorios: ffmpeg no crea el directorio de salida, así que
   `spec-005` tiene que hacer el `mkdir` antes del paso 1.
7. **`mix.voiceMeasured` es reinyectable**: el mismo `ReadonlyMap<AssetId, LoudnessMeasurement>` que
   consume `buildAudioMixGraph`. Guardándolo, un re-mix con otra cama musical se puede hacer con
   **una sola** invocación de ffmpeg en vez de dos.
