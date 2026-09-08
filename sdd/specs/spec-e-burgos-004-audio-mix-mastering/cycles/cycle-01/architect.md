# Architect — Cycle 1: Filtergraph builder y argumentos (`libs/media-local`)

> **Input:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/brief.yaml
> **Input:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect

---

## 0. Alcance de este documento

`cycle-01` agrega a `libs/media-local` la **capa de traducción `AudioMixPlan` → filtergraph FFmpeg**,
entera como funciones puras. No ejecuta binarios, no usa `CommandRunner`, no toca
`libs/timeline-core` ni `libs/composition-remotion`.

- **Cambios en `sdd/schema.json`: NO APLICA.** No hay base de datos en el motor. El único contrato de
  datos involucrado es la `Timeline` de `@video-maker/timeline-core`, que este ciclo **consume sin
  modificar** (D-A).
- **Cambios en `sdd/api.json`: NO APLICA.** El ciclo no expone ni consume endpoints HTTP. Su
  superficie es una API de módulo TypeScript (§3 a §7).

`existing_tables: []` y `existing_endpoints: []` del brief son literales: ambos registros quedan sin
tocar.

**Contexto técnico vinculante leído:** `sdd/context/libs/media-local/constitution.md` +
`context_prompt.md` (`updates/` vacío). De ahí salen cinco restricciones con precedencia sobre
cualquier preferencia propia:

1. `src/index.ts` exporta **exactamente** la superficie pública listada; nada de detalle de
   implementación.
2. Un archivo por función pública; **modelo puro separado del serializador**, igual que el par
   `parser`/`wrapper`. `buildLoudnormFilter` tuvo que mudarse a archivo propio en `cycle-02` de
   spec-001 por el ciclo `measure-loudness ↔ normalize-voice`: **ningún módulo nuevo puede
   introducir un ciclo de imports**.
3. El ESLint de la lib prohíbe en `src/**` (no-spec): `execa`, `child_process`, `node:fs`, `Date`,
   `process`, `Math.random`. Todo lo de este ciclo es puro, así que ninguna de esas puertas se abre.
4. `tsconfig.lib.json` tiene `noUncheckedIndexedAccess: true` **y** `exactOptionalPropertyTypes:
   true`, y **Vitest no typechequea**: un error por cualquiera de las dos aparece recién en
   `nx build`, nunca en `nx test`.
5. Cobertura medida sobre `src/**/*.ts` excluyendo `src/index.ts` y `src/__fixtures__/**`. Piso
   heredado: **98.03 % stmts / 94.77 % ramas** (RNF-2). Todo el diseño de abajo minimiza ramas.

**Mapeo a tasks:** el planner corre en paralelo. Acá cada unidad se identifica por su archivo y su
CA; el `TASK-[NNN]` lo asigna `planner.md` / `tasks.json`.

> **§10 contiene cuatro divergencias explícitas contra la letra de la spec** (RF-1, RF-2, RF-5 y
> CA-003). Todas están justificadas contra el código real y ninguna se resolvió en silencio: si el
> orquestador prefiere la letra de la spec, el que cambia es este documento.

---

## 1. Decisiones técnicas

### D-01 · Directorio nuevo `src/mix/`, no `src/ffmpeg/`

Los diez archivos nuevos van a `libs/media-local/src/mix/`. `src/ffmpeg/` **no se toca**
(`build-loudnorm-filter.ts` se importa, no se modifica).

Razones, en orden de peso:

1. **`src/ffmpeg/` tiene una regla de organización explícita y este ciclo no la cumple:** "un
   wrapper (I/O vía runner) + un parser puro **por comando**". Sus ocho archivos son pares
   `detect-silences`/`parse-silence-detect`, `measure-loudness`/`parse-loudnorm-json`,
   `extract-audio`, y `build-loudnorm-filter` como el argumento compartido de dos de esos wrappers.
   `cycle-01` no agrega ningún comando: agrega una **capa de composición** (modelo tipado +
   serializador) que produce los argumentos que un wrapper futuro va a ejecutar. Meterla en
   `src/ffmpeg/` haría ilegible la regla del directorio y lo duplicaría en tamaño de golpe.
2. **La lib ya separa por concern-directory** (`runner/`, `errors/`, `binaries/`, `fs/`, `ffprobe/`,
   `ffmpeg/`, `whisper/`). Un concern nuevo → un directorio nuevo. Hay precedente y no hay
   convención en contra.
3. **Dirección de imports de un solo sentido, que es exactamente la lección del ciclo
   `measure-loudness ↔ normalize-voice`:** `src/mix/**` → `src/ffmpeg/build-loudnorm-filter.ts` y
   `src/errors/**`, y **nunca al revés**. En `cycle-02`, `mixTimelineAudio` (un wrapper, con
   `CommandRunner`) importará de `src/mix/**` conservando la misma dirección. Queda como invariante
   del subproyecto: **`src/mix/**` no importa ningún wrapper y no importa `src/runner/**`.**

### D-02 · La automatización de ducking es un **modelo tipado** (`GainAutomationCurve`) y el string es su serialización

Es D-D aplicado un nivel más abajo, y es lo que hace verificable CA-002 sin ejecutar ffmpeg y sin
importar `composition-remotion`.

- `buildGainAutomationCurve(automation, fps)` produce el modelo numérico exacto (segmentos con
  tiempo en segundos y pendiente en dB/s).
- `evaluateGainAutomationCurve(curve, seconds)` es **la semántica de referencia de la expresión**:
  el número que la expresión emitida evalúa en ese instante.
- `serializeGainAutomationCurve(curve)` (interno) produce el nodo `volume` de FFmpeg.
- `buildGainAutomationExpression(automation, fps)` es la composición de las dos primeras.

**Por qué no un evaluador de expresiones FFmpeg en el test:** escribir un parser del subset
`lt/gte/min/pow/+/*/-` dentro de un `*.spec.ts` sería código de test más complejo que el código de
producción, no cubierto por cobertura, y su bug se leería como bug del builder. Con el modelo
tipado, CA-002 compara `evaluateGainAutomationCurve` contra la tabla de §7, y la correspondencia
modelo↔string se verifica aparte con `toEqual` exacto (§5.3, CA-006). Son dos aserciones simples en
vez de una compleja.

**No es reimplementación de `volumeAtFrame`:** es el mismo cálculo del otro lado de un boundary Nx
que la spec prohíbe cruzar (D-G). La duplicación es deliberada y su contrato es la tabla de §7.

### D-03 · Dos tipos de curva y nada más: `constant` | `piecewise`

```ts
type GainAutomationCurve =
  | { readonly kind: 'constant'; readonly volume: number }
  | { readonly kind: 'piecewise'; ... }
```

`automation: []` → `{ kind: 'constant', volume: 1 }` → serializa a **`volume=1`**, que es la
identidad literal que pide RF-1: la identidad **no necesita un caso propio**, es el caso constante
con volumen 1. Un solo keyframe también cae en `constant` (todo es plano, RN-3) y evita un
`eval=frame` inútil. Menos kinds = menos ramas = menos superficie contra el piso de cobertura.

### D-04 · Las entradas del grafo son **archivos de input de ffmpeg (`-i`), en orden**, no labels

```ts
interface FilterGraph {
  readonly inputs: readonly string[];   // rutas, en el orden exacto de los -i
  readonly chains: readonly FilterChain[];
  readonly outputLabel: string;
}
```

La pregunta real es dónde vive la correspondencia índice ↔ label `N:a`. Decisión: **la posición en
`inputs` ES el índice de input de ffmpeg**, y el label `${index}:a` lo escribe `buildAudioMixGraph`
dentro de `chains[].inputLabels`.

- Si el grafo solo llevara labels, `audioMixFfmpegArgs` necesitaría recibir las rutas por separado y
  **el llamador podría pasarlas en otro orden**: el mix saldría silenciosamente mal (la voz filtrada
  como música), sin error de tipos ni de ffmpeg. Con las rutas adentro, el orden es un invariante de
  construcción y `audioMixFfmpegArgs(graph, outputPath)` no necesita un segundo parámetro.
- `inputs` no es una lista de objetos `{ path, label }` a propósito: guardar el label además del
  índice crea dos fuentes de verdad que pueden divergir. El label es **derivado**, no almacenado
  (`audioStreamLabel(index)`, función local de `build-audio-mix-graph.ts`).
- **Los labels se guardan siempre sin corchetes.** Los corchetes los pone `serializeFilterGraph`, una
  sola vez y en un solo lugar; así `outputLabel: 'mix'` y `-map '[mix]'` no pueden desincronizarse.

Esto cumple D-D al pie de la letra (`FilterGraph { inputs, chains, outputLabel }`) y diverge del
sketch `audioMixFfmpegArgs(graph, inputs, out, opts)` de RF-5 (ver §10.3).

### D-05 · La música: la automatización **reemplaza** la ganancia base; nunca se aplican las dos

Esta es la decisión de mayor riesgo del ciclo y sale del código real, no de la spec. En
`libs/composition-remotion/src/components/audio-track.tsx`:

```ts
function musicVolume(clip, automation) {
  if (automation.length === 0) return clip.volume;              // clip.volume = gainDbToVolume(clip.gainDb)
  return (frameInClip) => volumeAtFrame(automation, frameInClip + clip.from);
}
```

Los keyframes de `planDucking` son **ganancias absolutas**: en reposo valen exactamente
`baseGainDb` (−12 dB) y durante la voz `duckedGainDb` (−24 dB). El preview aplica la curva **en
lugar de** `clip.volume`, no encima. Emitir `volume=-12dB` y después la automatización daría −24 dB
en reposo: el master sonaría 12 dB por debajo del preview, que es exactamente lo que HU-1-06 y
CA-002 prohíben.

Regla, que es `musicVolume` traducida:

| `plan.automation` | nodo de ganancia emitido |
| --- | --- |
| no vacío | **solo** el nodo de automatización (que ya contiene la ganancia base en reposo) |
| vacío | **solo** un nodo constante con `gainDbToVolume(clip.gainDb)` |
| vacío y `clip.gainDb === 0` | **ningún nodo** (`curve` es la identidad → CA-001) |

**Fuente de la ganancia estática: `clip.gainDb`, no `plan.music.baseGainDb`.** `buildTimeline` hace
`gainDb: music.gainDb ?? audioMix.music.baseGainDb` — coinciden por default, pero un
`MusicInput.gainDb` explícito los separa, y el preview usa el del clip. Ver §10.2 y §10.4.

**Alternativa evaluada y descartada — automatización relativa** (emitir `baseGainDb` y después una
curva desplazada `kf − baseGainDb`): da los mismos números para todo lo que produce `planDucking`
(porque sus keyframes siempre cumplen `duckedGainDb ≤ kf ≤ baseGainDb ≤ 0`), honra la letra de
CA-003 y **diverge del preview en cuanto exista un keyframe por encima de `baseGainDb`**, porque los
dos clamps a `[0,1]` se componen distinto que un único clamp sobre el valor absoluto. Introduce un
concepto —"dB relativo"— que no existe en ninguna otra parte del sistema para ganar solo
literalidad. Descartada.

### D-06 · La automatización se aplica **después** del `adelay`, y su `t` es tiempo de timeline

Los keyframes están en frames de **timeline**, no de clip. La variable `t` del filtro `volume` es el
timestamp del frame de audio en segundos. Por lo tanto el nodo `volume` debe ir después de
`adelay`, cuando el stream ya está posicionado en el timeline. Lo mismo vale para los `st` de los
`afade`: son tiempos absolutos de timeline (`clip.from / fps`), no offsets dentro del clip.

Consecuencia sobre el orden de la cadena de un clip de música, que es fijo:

```
atrim (recorte de la fuente) → asetpts → adelay → [volume] → [afade in] → [afade out] → apad → atrim (largo del video)
```

`asetpts=PTS-STARTPTS` después de `atrim` no es decorativo: sin él los PTS conservan el offset de la
fuente y `adelay` retrasa sobre una base equivocada.

### D-07 · Tiempos en segundos exactos (`frame / fps`), **no** `framesToMs`

RF-1 dice convertir con `framesToMs`. **No se puede**, y el motivo es numérico, no estético:
`framesToMs` redondea a milisegundos enteros. A 30 fps, el frame 26 vale 866.67 ms → 867 ms
(0.4 % de error de posición). Sobre la rampa de ataque del ducking (12 dB en 150 ms, es decir
90 dB/s) ese redondeo desplaza la curva ~0.03 dB, o sea **~4·10⁻³ en factor lineal: 3.700 veces la
tolerancia `1e-6` de CA-002**. Con `frame / fps` exacto, el ratio en segundos es idénticamente el
ratio en frames que usa `volumeAtFrame` y la diferencia medida cae a **1.2·10⁻¹⁵** (§7).

`framesToMs` **sí** se usa donde la unidad del filtro es el milisegundo: `adelay` (CA-005). Los dos
criterios conviven sin contradicción porque `adelay` posiciona el stream y la expresión describe una
curva.

### D-08 · Formato numérico único y determinista para todo el filtergraph

```ts
const FILTER_NUMBER_DECIMALS = 9;

export function formatFilterNumber(value: number): string {
  return value.toFixed(FILTER_NUMBER_DECIMALS).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
```

- **Cero ramas** → no cuesta nada contra el piso de cobertura y es byte-determinista (RNF-4).
- **Nunca emite notación exponencial.** `String(1e-7)` da `"1e-7"`; `toFixed` no. Un `1e-7` suelto
  dentro de un `-filter_complex` es un riesgo innecesario de parseo.
- **9 decimales, no 6.** Con 6 el instante `26/30 s` se emite como `0.866667` (error 3.3·10⁻⁷ s), que
  sobre la rampa de 90 dB/s vale ~3.4·10⁻⁶ de factor lineal: **por encima de la tolerancia de
  CA-002**. Con 9 el error de cuantización cae a ~3.4·10⁻⁹ y la expresión serializada respeta la
  tolerancia por sí misma, no solo el modelo.
- El regex es `(\.\d*?)0+$` y no `0+$` a propósito: `"100.000000000".replace(/0+$/, '')` devuelve
  `"1"`. Es un bug real y silencioso; el implementador debe copiar la expresión tal cual y cubrir
  `100`, `10.5`, `0`, `-12` y `1e-7` en el spec.

### D-09 · `buildAudioMixGraph` valida con Zod y exige al menos un clip de audio

RN-10 pide validar con Zod. Se valida **solo la `Timeline`**, con un schema interno:

```ts
const AudioMixTimelineSchema = TimelineSchema.refine(
  (timeline) => timeline.tracks.voice.length + timeline.tracks.music.length > 0,
  { message: 'La Timeline no tiene clips de audio: no hay nada que mezclar.' },
);
```

Un `amix=inputs=0` es un filtergraph inválido; con el `refine` ese estado es un `ZodError` de
entrada y **no hace falta una segunda clase de error** (el ciclo agrega exactamente una, §6).
`voiceMeasuredByAssetId` no se parsea: es un dato producido por `parseLoudnormJson`, que ya validó.

### D-10 · Sin opciones en `audioMixFfmpegArgs`: el formato del master lo fija D-H

D-H fija WAV `pcm_s16le` 48 kHz estéreo como intermedio. Exponerlo como `opts` (el sketch de RF-5)
agrega ramas de default que no cubren ningún caso de uso de `cycle-02` y abre la puerta a que
`aresample=48000` de la cadena de voz y el `-ar` de los args se desincronicen. En su lugar, tres
constantes exportadas y un solo lugar donde vive el número:

```ts
export const AUDIO_MIX_SAMPLE_RATE = 48000;
export const AUDIO_MIX_CHANNELS = 2;
export const AUDIO_MIX_CODEC = 'pcm_s16le';
```

`buildVoiceChain` y `audioMixFfmpegArgs` importan `AUDIO_MIX_SAMPLE_RATE` del mismo módulo leaf
(`src/mix/audio-mix-format.ts`). Ver §10.3.

---

## 2. Árbol de archivos y grafo de imports

```
libs/media-local/src/
  errors/
    media-local-error.ts                    (MODIFICADO: +1 miembro en MediaLocalErrorCode)
    unresolved-audio-asset-error.ts         (NUEVO)
  mix/                                       (NUEVO)
    audio-mix-format.ts                     AUDIO_MIX_SAMPLE_RATE | AUDIO_MIX_CHANNELS | AUDIO_MIX_CODEC
    format-filter-number.ts                 formatFilterNumber                          [interno]
    gain-db-to-volume.ts                    gainDbToVolume
    filter-graph.ts                         FilterGraph | FilterChain                   [solo tipos]
    gain-automation-curve.ts                GainAutomationCurve | GainAutomationSegment
                                            buildGainAutomationCurve | evaluateGainAutomationCurve
                                            isIdentityGainCurve                         [interno]
    serialize-gain-automation-curve.ts      serializeGainAutomationCurve                [interno]
    build-gain-automation-expression.ts     buildGainAutomationExpression
    build-voice-chain.ts                    buildVoiceChain
    build-music-bed-chain.ts                buildMusicBedChain | MusicBedChainOptions
    build-audio-mix-graph.ts                buildAudioMixGraph | AudioMixGraphSpec
    serialize-filter-graph.ts               serializeFilterGraph
    audio-mix-ffmpeg-args.ts                audioMixFfmpegArgs
  index.ts                                  (MODIFICADO: §8)
```

Cada archivo lleva su hermano `*.spec.ts` en el mismo directorio (convención de la lib). Grafo de
imports, **acíclico y de un solo sentido**:

```
audio-mix-format          (leaf)
format-filter-number      (leaf)
gain-db-to-volume         (leaf)
filter-graph              (leaf, solo tipos)

gain-automation-curve            -> gain-db-to-volume
serialize-gain-automation-curve  -> gain-automation-curve (tipos), format-filter-number
build-gain-automation-expression -> gain-automation-curve, serialize-gain-automation-curve
build-voice-chain                -> ffmpeg/build-loudnorm-filter, ffmpeg/parse-loudnorm-json (tipo), audio-mix-format
build-music-bed-chain            -> gain-automation-curve, serialize-gain-automation-curve,
                                    gain-db-to-volume, format-filter-number
build-audio-mix-graph            -> filter-graph, build-voice-chain, build-music-bed-chain,
                                    format-filter-number, errors/unresolved-audio-asset-error
serialize-filter-graph           -> filter-graph (tipos)
audio-mix-ffmpeg-args            -> filter-graph (tipos), serialize-filter-graph, audio-mix-format
```

Ningún módulo de `src/mix/**` importa `src/runner/**` ni un wrapper. `src/ffmpeg/**` no importa nada
de `src/mix/**`.

**Por qué `serializeGainAutomationCurve` va en archivo propio y no dentro de
`gain-automation-curve.ts`:** el modelo lo consumen dos serializadores potenciales y dos llamadores
(`build-gain-automation-expression` y `build-music-bed-chain`). Con el serializador adentro del
modelo, `build-music-bed-chain` importaría el modelo para usar el serializador y el archivo dejaría
de tener una sola responsabilidad — el mismo olor que motivó extraer `buildLoudnormFilter`.

---

## 3. Firmas exactas

Todas las firmas usan tipos importados de `@video-maker/timeline-core`
(`AudioClip`, `AudioMixPlan`, `AssetId`, `Db`, `Fps`, `Frame`, `GainKeyframe`, `Timeline`,
`VoiceTarget`) y de la propia lib (`LoudnessMeasurement`).

### 3.1 `buildGainAutomationExpression` — RF-1 / CA-001 / CA-002

```ts
export function buildGainAutomationExpression(
  automation: readonly GainKeyframe[],
  fps: Fps,
): string;
```

Devuelve un **nodo de filtro completo**, no solo la expresión: `volume=1`,
`volume=0.501187234` o `volume=volume='…':eval=frame`. Es lo que exige la letra de RF-1
(`automation: []` → `volume=1`) y lo que necesita el que arma la cadena. El nombre lo hereda de la
spec; ver §10.1.

### 3.2 `buildMusicBedChain` — RF-2 / CA-003

```ts
export interface MusicBedChainOptions {
  readonly clip: AudioClip;
  readonly fps: Fps;
  readonly videoDurationFrames: Frame;
}

export function buildMusicBedChain(plan: AudioMixPlan, opts: MusicBedChainOptions): string[];
```

Devuelve **solo** los filtros propios de la música, en este orden:
`[ganancia?] [afade in?] [afade out?] apad atrim=end`. El prefijo `atrim`/`asetpts`/`adelay` lo pone
`buildAudioMixGraph` (D-06): son responsabilidad del grafo, no de la cama musical.

### 3.3 `buildVoiceChain` — RF-3 / CA-004

```ts
export function buildVoiceChain(target: VoiceTarget, measured?: LoudnessMeasurement): string[];
```

Devuelve exactamente `[buildLoudnormFilter(target, measured), 'aresample=48000']`. El primer
elemento es **la salida literal** de `buildLoudnormFilter`, sin reconstruirla (RN-9, CA-004).
`measured` es un parámetro posicional opcional: `exactOptionalPropertyTypes` no aplica a parámetros,
así que pasar `undefined` explícito es válido y da la primera pasada.

### 3.4 `buildAudioMixGraph` — RF-4 / CA-005

```ts
export interface AudioMixGraphSpec {
  readonly timeline: Timeline;
  readonly voiceMeasuredByAssetId?: ReadonlyMap<AssetId, LoudnessMeasurement>;
}

export function buildAudioMixGraph(spec: AudioMixGraphSpec): FilterGraph;
```

- La medición se indexa **por `assetId`, no por `clipId`**: `buildTimeline` corta la voz en muchos
  `AudioClip` que comparten el mismo asset de origen, y `measureLoudness` mide un archivo. Indexar
  por clip obligaría a `cycle-02` a medir N veces el mismo WAV.
- Omitir el mapa (o no tener entrada para un asset) ⇒ primera pasada de `loudnorm` para ese clip.
- `exactOptionalPropertyTypes: true`: `{ timeline, voiceMeasuredByAssetId: undefined }` **no
  compila**; hay que omitir la propiedad. Usar el patrón `optionalField` que ya usa `buildTimeline`
  si se construye el spec condicionalmente.

### 3.5 `serializeFilterGraph` — RF-5 / CA-006

```ts
export function serializeFilterGraph(graph: FilterGraph): string;
```

Devuelve el **valor** de `-filter_complex` (sin el flag).

### 3.6 `audioMixFfmpegArgs` — RF-5 / CA-006

```ts
export function audioMixFfmpegArgs(graph: FilterGraph, outputPath: string): string[];
```

Sin objeto de opciones (D-10). Reusa `serializeFilterGraph(graph)` tal cual (RN-14).

### 3.7 Auxiliares públicos

```ts
export function gainDbToVolume(db: Db): number;

export interface GainAutomationSegment {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly startGainDb: Db;
  readonly slopeDbPerSecond: number;
}

export type GainAutomationCurve =
  | { readonly kind: 'constant'; readonly volume: number }
  | {
      readonly kind: 'piecewise';
      readonly firstSeconds: number;
      readonly firstGainDb: Db;
      readonly lastSeconds: number;
      readonly lastGainDb: Db;
      readonly segments: readonly GainAutomationSegment[];
    };

export function buildGainAutomationCurve(
  automation: readonly GainKeyframe[],
  fps: Fps,
): GainAutomationCurve;

export function evaluateGainAutomationCurve(curve: GainAutomationCurve, seconds: number): number;
```

`gainDbToVolume` es **la misma fórmula y el mismo nombre** que
`libs/composition-remotion/src/helpers/audio-gain.ts`. El nombre repetido es intencional: hace la
duplicación greppable desde las dos libs y deja obvio, en cualquier revisión futura, que tocar una
sin la otra rompe CA-002.

```ts
export function gainDbToVolume(db: Db): number {
  return Math.min(1, Math.max(0, 10 ** (db / 20)));
}
```

### 3.8 Auxiliares internos (NO van al barrel)

```ts
function formatFilterNumber(value: number): string;                    // src/mix/format-filter-number.ts
function serializeGainAutomationCurve(curve: GainAutomationCurve): string;
function isIdentityGainCurve(curve: GainAutomationCurve): boolean;     // curve.kind === 'constant' && curve.volume === 1
function audioStreamLabel(index: number): string;                      // local de build-audio-mix-graph.ts
const AudioMixTimelineSchema;                                          // local de build-audio-mix-graph.ts
```

---

## 4. `FilterGraph`: tipo y serialización

### 4.1 Tipos (`src/mix/filter-graph.ts`, solo tipos, sin runtime)

```ts
export interface FilterChain {
  readonly inputLabels: readonly string[];
  readonly filters: readonly string[];
  readonly outputLabels: readonly string[];
}

export interface FilterGraph {
  readonly inputs: readonly string[];
  readonly chains: readonly FilterChain[];
  readonly outputLabel: string;
}
```

- `inputs[i]` es la ruta del i-ésimo `-i`; su stream de audio se referencia como `` `${i}:a` ``.
- Los labels van **sin corchetes** en todo el modelo (D-04).
- `outputLabel` es el label de salida único del grafo; siempre `'mix'` para lo que produce
  `buildAudioMixGraph`, pero el tipo no lo fija: el serializador y `audioMixFfmpegArgs` lo leen del
  grafo.

### 4.2 Serialización

```
chain    := inputLabels.map(l => `[${l}]`).join('') + filters.join(',') + outputLabels.map(l => `[${l}]`).join('')
graph    := chains.map(chain).join(';')
```

Sin espacios, sin saltos de línea, sin ordenamientos: el orden de `chains` y `filters` es el orden de
salida (RN-13, determinismo byte a byte).

### 4.3 Argumentos de ffmpeg

```ts
[
  '-hide_banner', '-nostats', '-y',
  ...graph.inputs.flatMap((path) => ['-i', path]),
  '-filter_complex', serializeFilterGraph(graph),
  '-map', `[${graph.outputLabel}]`,
  '-c:a', AUDIO_MIX_CODEC,
  '-ar', String(AUDIO_MIX_SAMPLE_RATE),
  '-ac', String(AUDIO_MIX_CHANNELS),
  outputPath,
]
```

`-hide_banner -nostats` al frente y `-y` antes de los inputs replican exactamente el orden de
`normalizeVoice`. El binario **no** es parte de los args: lo elige `cycle-02` con
`resolveBinary`/`ffmpegPath`.

### 4.4 Composición de la cadena de cada clip (lo que arma `buildAudioMixGraph`)

Para cada clip, en el orden `tracks.voice` y después `tracks.music`, con
`startSeconds = clip.trimStartMs / 1000` y `endSeconds = startSeconds + clip.durationFrames / fps`:

| # | Filtro | Voz | Música | Nota |
| --- | --- | --- | --- | --- |
| 1 | `atrim=start=<startSeconds>:end=<endSeconds>` | ✅ | ✅ | siempre, aunque `trimStartMs` sea 0 |
| 2 | `asetpts=PTS-STARTPTS` | ✅ | ✅ | obligatorio tras `atrim` (D-06) |
| 3 | `adelay=<framesToMs(clip.from, fps)>:all=1` | ✅ | ✅ | siempre, aunque valga 0 (CA-005) |
| 4 | `buildVoiceChain(...)` → `loudnorm…`, `aresample=48000` | ✅ | — | RF-3 |
| 5 | `buildMusicBedChain(...)` | — | ✅ | RF-2, después del `adelay` (D-06) |

Label de salida: `` `${track}${indexDentroDeLaPista}` `` → `voice0`, `voice1`, `music0`.

Cadena final, una sola:

```
inputLabels: [...todos los labels de clip]
filters:     ['amix=inputs=<N>:duration=longest:normalize=0']
outputLabels: ['mix']
```

`normalize=0` es obligatorio (RN-12): con `normalize=1` ffmpeg divide por el número de entradas y se
pierde el balance que ya resolvieron RF-2/RF-3. `dropout_transition` se deja en su default a
propósito: solo aplica a la renormalización, que con `normalize=0` no ocurre.

---

## 5. La expresión `volume`

### 5.1 Forma elegida

```
volume=volume='min(1,pow(10,(<sumaDeTerminosEnDb>)/20))':eval=frame
```

Donde `<sumaDeTerminosEnDb>` es una **suma de términos compuertados que particionan la recta real**,
con exactamente uno distinto de cero en cada instante:

| término | condición | emitido |
| --- | --- | --- |
| cabecera (plano antes del primer keyframe) | `t < T₀` | `lt(t,T₀)*(G₀)` |
| segmento i | `Tᵢ ≤ t < Tᵢ₊₁` | `gte(t,Tᵢ)*lt(t,Tᵢ₊₁)*((Gᵢ)+(Sᵢ)*(t-Tᵢ))` |
| cola (plano después del último) | `t ≥ T_N` | `gte(t,T_N)*(G_N)` |

`Sᵢ = (Gᵢ₊₁ − Gᵢ) / (Tᵢ₊₁ − Tᵢ)` en dB por segundo, y `Tᵢ = frameᵢ / fps`.

**Por qué no `between(t,a,b)`:** `between` es **inclusivo en los dos extremos**, así que en cada
frontera dos términos valdrían 1 y la suma daría el doble del dB correcto — un pico audible en cada
keyframe. `gte(t,a)*lt(t,b)` es semiabierto y particiona sin solaparse. Es la razón concreta por la
que se descarta la variante `between` que planteaba el brief.

**Por qué no un `if()` anidado:** es correcto pero anida tan profundo como keyframes haya (la
automatización de §7 daría 9 niveles), y una expresión de 500 keyframes se vuelve ilegible y
frágil de generar. La suma compuertada es plana, se genera con un `map` y se lee segmento a
segmento.

**Por qué un solo `min(1,…)` afuera y no uno por término:** solo un término es distinto de cero, así
que `min(1, Σ)` = `min(1, término activo)`. Un clamp por término multiplicaría el largo sin cambiar
el resultado.

**Por qué no hay `max(0,…)`:** `pow(10, x/20) > 0` para todo `x` finito, así que el `Math.max(0, …)`
de `gainDbToVolume` es un no-op del lado FFmpeg. Se documenta acá para que nadie lo lea como una
omisión: la equivalencia con `gainDbToVolume` es exacta, no aproximada.

**Por qué `eval=frame`:** sin él, `volume` evalúa la expresión **una sola vez** al inicializar el
filtro y la curva se congela en su valor en `t=0`. Nota de exactitud terminológica: RF-1 dice
"evaluada por muestra" — el filtro `volume` de FFmpeg **no tiene modo por muestra**; `eval=frame`
(una evaluación por frame de audio, ~1024 muestras) es la granularidad más fina disponible. Es
suficiente de sobra para una rampa de ducking de 150 ms y no cambia ninguna decisión, pero conviene
que la letra de la spec no prometa algo que el filtro no ofrece (§10.5).

### 5.2 Casos degenerados

| Entrada | Curva | String emitido |
| --- | --- | --- |
| `automation: []` | `{ kind: 'constant', volume: 1 }` | `volume=1` |
| 1 keyframe, `gainDb: -6` | `{ kind: 'constant', volume: 0.501187234 }` | `volume=0.501187234` |
| 1 keyframe, `gainDb: 0` | `{ kind: 'constant', volume: 1 }` | `volume=1` |
| dos keyframes con el mismo `frame` | segmento con `slopeDbPerSecond: 0` | el término queda compuertado por un intervalo vacío y aporta 0; **la partición sigue completa** |

El guard `span === 0 ? 0 : (Gᵢ₊₁ − Gᵢ) / span` **no es defensivo, es obligatorio**: sin él la
pendiente sería `Infinity` o `NaN`, se serializaría dentro del string y, como en FFmpeg
`0 * NaN = NaN`, envenenaría la suma entera aunque el término esté compuertado en 0. Es además el
mismo criterio que `volumeAtFrame` (`span === 0 ? 0 : …`).

### 5.3 Ejemplo literal — 3 keyframes, fps 30

Entrada:

```ts
buildGainAutomationExpression(
  [
    { frame: 0, gainDb: -12 },
    { frame: 30, gainDb: -24 },
    { frame: 60, gainDb: -12 },
  ],
  30,
);
```

Curva intermedia (`buildGainAutomationCurve`):

```ts
{
  kind: 'piecewise',
  firstSeconds: 0,
  firstGainDb: -12,
  lastSeconds: 2,
  lastGainDb: -12,
  segments: [
    { startSeconds: 0, endSeconds: 1, startGainDb: -12, slopeDbPerSecond: -12 },
    { startSeconds: 1, endSeconds: 2, startGainDb: -24, slopeDbPerSecond: 12 },
  ],
}
```

Salida, **carácter por carácter** (148 caracteres):

```
volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,1)*((-12)+(-12)*(t-0))+gte(t,1)*lt(t,2)*((-24)+(12)*(t-1))+gte(t,2)*(-12))/20))':eval=frame
```

Verificación manual rápida: en `t=0.5` el término activo es el primer segmento →
`-12 + (-12)(0.5) = -18 dB` → `min(1, 10^(-18/20)) = 0.125892541`. En `t=3` (después del último) →
`-12 dB` → `0.251188643`.

### 5.4 Escapado dentro de `-filter_complex`

- La expresión **se encierra en comillas simples**: `volume=volume='…':eval=frame`. Sin comillas, la
  primera `,` de `min(1,…)` cortaría la cadena de filtros y el primer `:` se leería como separador de
  opciones. Dentro de comillas simples, `, ; : [ ]` son literales.
- La expresión generada **no contiene ninguna comilla simple**, así que nunca hace falta el escape
  `'\''`. El implementador no debe agregar escapes adicionales: el string se pasa como **un
  argumento del `argv`** vía `CommandRunner`/`execa`, sin shell, así que **no hay un segundo nivel de
  escapado**. Agregar `\` "por las dudas" rompe el filtergraph.
- Caracteres emitidos, conjunto cerrado: `[a-z0-9]`, `( ) * + - . , = ' _ / :` y `t`.

### 5.5 Límites conocidos

| Límite | Valor | Qué hacer |
| --- | --- | --- |
| Largo de la expresión | ~53 caracteres por keyframe. 9 keyframes → 531 chars; 100 → ~5,4 KB; 1.000 → ~53 KB | Sin acción en `cycle-01`. Por encima de ~2.000 keyframes conviene `-filter_complex_script <archivo>` en lugar de pasar el grafo por `argv` (límite práctico de `ARG_MAX`). Es material de `cycle-02` (§11). |
| Precisión temporal | 1 ns por `FILTER_NUMBER_DECIMALS = 9` | Error de factor ≤ ~3,4·10⁻⁹ sobre la rampa más empinada que produce `planDucking` (90 dB/s). Tres órdenes por debajo de la tolerancia de CA-002. |
| Precisión de pendiente | 1e-9 dB/s | Despreciable. |
| Granularidad de evaluación | un frame de audio (`eval=frame`), no una muestra | Ver §5.1. |
| Rango del clamp | `[0, 1]` — la expresión **nunca amplifica** | Un `gainDb > 0` en el plan se satura en 1, igual que `gainDbToVolume`. |

---

## 6. Error tipado nuevo

`src/errors/media-local-error.ts` — **única modificación** a un archivo existente de `src/errors/`:

```ts
export type MediaLocalErrorCode =
  | 'BINARY_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'UNPARSEABLE_OUTPUT'
  | 'UNRESOLVED_AUDIO_ASSET';
```

`src/errors/unresolved-audio-asset-error.ts` (nuevo), calcado del patrón de
`BinaryNotFoundError`/`UnparseableOutputError` — `code` como campo `readonly` inicializado en la
declaración, `name` asignado en el constructor, `init` como objeto único, mensaje en español:

```ts
import { MediaLocalError } from './media-local-error';

export class UnresolvedAudioAssetError extends MediaLocalError {
  readonly code = 'UNRESOLVED_AUDIO_ASSET';
  readonly assetId: string;
  readonly clipId: string;
  readonly track: 'voice' | 'music';

  constructor(init: { assetId: string; clipId: string; track: 'voice' | 'music' }) {
    super(
      `El clip de audio "${init.clipId}" (pista ${init.track}) referencia un assetId que no existe en la Timeline: "${init.assetId}".`,
    );
    this.name = 'UnresolvedAudioAssetError';
    this.assetId = init.assetId;
    this.clipId = init.clipId;
    this.track = init.track;
  }
}
```

- **`assetId` en el mensaje** — lo pide CA-005 explícitamente. `clipId` y `track` van además como
  campos porque son lo que hace accionable el error: con 30 clips de voz, saber cuál falló es la
  diferencia entre un fix de un minuto y una búsqueda a mano.
- `isMediaLocalError` **no se toca**: es un `instanceof MediaLocalError` y la clase nueva ya hereda.
- Se agrega al `describe` de `src/errors/errors.spec.ts` siguiendo el patrón de los otros tres.
- **No hay un segundo error nuevo.** El caso "la Timeline no tiene ningún clip de audio" es un
  `ZodError` de entrada (D-09) y el caso "el asset existe pero no tiene audio" queda para `cycle-02`
  (§11).

---

## 7. Tabla de paridad con `volumeAtFrame` (CA-002, D-E)

Es el **contrato** entre las dos libs: `media-local` (`type:util`) no puede importar
`composition-remotion` (`type:ui`), así que estos números —y no un import— son lo que garantiza que
el master suene igual que el preview.

### 7.1 Cómo se generó (reproducible)

```
fps          = 30
voiceRanges  = [ { startMs: 1000, endMs: 3000 }, { startMs: 5000, endMs: 6000 } ]
settings     = DEFAULT_AUDIO_MIX_PLAN.music   // === DEFAULT_MUSIC_MIX
               { baseGainDb: -12, duckedGainDb: -24, attackMs: 150, releaseMs: 400, holdMs: 250 }
automation   = planDucking(voiceRanges, settings, 30).automation
```

`planDucking` produce **9 keyframes / 8 tramos**, y el spec de CA-002 debe construirlos llamando a
`planDucking` de verdad (no pegando el literal), y después comparar el array contra este literal
como primera aserción:

```ts
[
  { frame: 0,   gainDb: -12 }, { frame: 26,  gainDb: -12 }, { frame: 30,  gainDb: -24 },
  { frame: 98,  gainDb: -24 }, { frame: 110, gainDb: -12 }, { frame: 146, gainDb: -12 },
  { frame: 150, gainDb: -24 }, { frame: 188, gainDb: -24 }, { frame: 200, gainDb: -12 },
]
```

La `Timeline` de ejemplo que envuelve esa automatización es la de §9.1 (7 s / 210 frames, un clip de
voz y uno de música). Para CA-002 alcanza con la automatización: la curva no depende de los clips.

### 7.2 Valores esperados — tolerancia `1e-6`

`t = frame / 30` exacto (D-07). Columna **Factor esperado** = lo que devuelve
`evaluateGainAutomationCurve(buildGainAutomationCurve(automation, 30), t)` **y** lo que devuelve
`volumeAtFrame(automation, frame)` en `composition-remotion`. Cada tramo aporta su keyframe inicial
más dos puntos interiores (a 1/3 y 2/3 del tramo, redondeados a frame entero).

| Frame | t (s) | Factor esperado | Punto |
| ---: | ---: | ---: | --- |
| 0 | 0 | 0.251188643151 | keyframe 1 |
| 9 | 0.3 | 0.251188643151 | tramo 0→26, 1/3 |
| 17 | 0.566666666667 | 0.251188643151 | tramo 0→26, 2/3 |
| 26 | 0.866666666667 | 0.251188643151 | keyframe 2 |
| 27 | 0.9 | 0.177827941004 | tramo 26→30, 1/3 |
| 29 | 0.966666666667 | 0.089125093813 | tramo 26→30, 2/3 |
| 30 | 1 | 0.063095734448 | keyframe 3 |
| 53 | 1.766666666667 | 0.063095734448 | tramo 30→98, 1/3 |
| 75 | 2.5 | 0.063095734448 | tramo 30→98, 2/3 |
| 98 | 3.266666666667 | 0.063095734448 | keyframe 4 |
| 102 | 3.4 | 0.100000000000 | tramo 98→110, 1/3 |
| 106 | 3.533333333333 | 0.158489319246 | tramo 98→110, 2/3 |
| 110 | 3.666666666667 | 0.251188643151 | keyframe 5 |
| 122 | 4.066666666667 | 0.251188643151 | tramo 110→146, 1/3 |
| 134 | 4.466666666667 | 0.251188643151 | tramo 110→146, 2/3 |
| 146 | 4.866666666667 | 0.251188643151 | keyframe 6 |
| 147 | 4.9 | 0.177827941004 | tramo 146→150, 1/3 |
| 149 | 4.966666666667 | 0.089125093813 | tramo 146→150, 2/3 |
| 150 | 5 | 0.063095734448 | keyframe 7 |
| 163 | 5.433333333333 | 0.063095734448 | tramo 150→188, 1/3 |
| 175 | 5.833333333333 | 0.063095734448 | tramo 150→188, 2/3 |
| 188 | 6.266666666667 | 0.063095734448 | keyframe 8 |
| 192 | 6.4 | 0.100000000000 | tramo 188→200, 1/3 |
| 196 | 6.533333333333 | 0.158489319246 | tramo 188→200, 2/3 |
| 200 | 6.666666666667 | 0.251188643151 | keyframe 9 |
| 210 | 7 | 0.251188643151 | después del último keyframe (plano, RN-3) |

**Diferencia máxima medida entre los dos cálculos: 1.22·10⁻¹⁵** — trece órdenes de magnitud por
debajo de la tolerancia `1e-6`. Si el implementador ve una diferencia de ~10⁻³ es que usó
`framesToMs` en vez de `frame / fps` (D-07); si ve ~10⁻⁶ es que bajó `FILTER_NUMBER_DECIMALS` a 6
(D-08).

Puntos de la tabla que valen doble como test de regla:

- **frame 0 y frame 210** cubren RN-3 (extensión plana en los dos extremos, sin extrapolar la
  pendiente vecina).
- **frames 102 y 192** dan exactamente `0.1` (−20 dB): la interpolación es **en dB**. Interpolando
  en amplitud, el punto a 1/3 entre 0.063095734448 y 0.251188643151 daría **0.125793**, no `0.1`. Es
  el discriminador limpio de RN-1 y el spec debería incluir esa aserción negativa.
- **frames 27/29 y 147/149** cubren las dos rampas de ataque (−90 dB/s), las más empinadas.

---

## 8. Superficie pública: qué entra a `src/index.ts`

Bloque a agregar (después del bloque de `ffmpeg/`, antes del de `whisper/`):

```ts
export { gainDbToVolume } from './mix/gain-db-to-volume';
export {
  buildGainAutomationCurve,
  evaluateGainAutomationCurve,
} from './mix/gain-automation-curve';
export type { GainAutomationCurve, GainAutomationSegment } from './mix/gain-automation-curve';
export { buildGainAutomationExpression } from './mix/build-gain-automation-expression';
export { buildVoiceChain } from './mix/build-voice-chain';
export { buildMusicBedChain } from './mix/build-music-bed-chain';
export type { MusicBedChainOptions } from './mix/build-music-bed-chain';
export { buildAudioMixGraph } from './mix/build-audio-mix-graph';
export type { AudioMixGraphSpec } from './mix/build-audio-mix-graph';
export { serializeFilterGraph } from './mix/serialize-filter-graph';
export type { FilterChain, FilterGraph } from './mix/filter-graph';
export { audioMixFfmpegArgs } from './mix/audio-mix-ffmpeg-args';
export {
  AUDIO_MIX_CHANNELS,
  AUDIO_MIX_CODEC,
  AUDIO_MIX_SAMPLE_RATE,
} from './mix/audio-mix-format';
export { UnresolvedAudioAssetError } from './errors/unresolved-audio-asset-error';
```

**Explícitamente NO se exporta** (detalle de implementación; los specs los importan por ruta
relativa, igual que `truncateStderr`): `formatFilterNumber`, `FILTER_NUMBER_DECIMALS`,
`serializeGainAutomationCurve`, `isIdentityGainCurve`, `audioStreamLabel`, `AudioMixTimelineSchema`.

`export type { AssetId, … }` desde `@video-maker/timeline-core` al final del barrel ya incluye
`AssetId`; no hace falta agregar nada ahí.

**Justificación de los dos exports menos obvios:**

- `gainDbToVolume` — es la fórmula que `spec-e-burgos-005` va a necesitar para razonar sobre el mix
  sin depender de `composition-remotion`, y es el símbolo que hace visible el contrato de CA-002.
- `buildGainAutomationCurve` / `evaluateGainAutomationCurve` — son **la semántica declarada** de la
  expresión (D-02). Sin ellos, el único modo de saber qué evalúa el string es ejecutar ffmpeg, que
  es justo lo que RNF-1 prohíbe en la suite.

---

## 9. Fixture de CA-006: grafo, string y args exactos

### 9.1 `Timeline` de ejemplo

```
format:          { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 }
durationFrames:  210            // 7 s
assets:          voice-1 → /assets/voice.wav   (kind: 'audio')
                 music-1 → /assets/music.mp3   (kind: 'audio')
                 (+ los assets de video que exija la Timeline; no participan del grafo)
tracks.voice:    [ { id: 'voice-0', assetId: 'voice-1', from: 0, durationFrames: 210,
                     trimStartMs: 0, gainDb: 0 } ]
tracks.music:    [ { id: 'music-0', assetId: 'music-1', from: 0, durationFrames: 210,
                     trimStartMs: 0, gainDb: -12, fadeInFrames: 15, fadeOutFrames: 30 } ]
audioMix:        { voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
                   music: DEFAULT_MUSIC_MIX,
                   automation: <los 9 keyframes de §7.1> }
voiceMeasuredByAssetId: omitido  → loudnorm de primera pasada
```

### 9.2 `FilterGraph` esperado (`toEqual`)

```ts
{
  inputs: ['/assets/voice.wav', '/assets/music.mp3'],
  chains: [
    {
      inputLabels: ['0:a'],
      filters: [
        'atrim=start=0:end=7',
        'asetpts=PTS-STARTPTS',
        'adelay=0:all=1',
        'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
        'aresample=48000',
      ],
      outputLabels: ['voice0'],
    },
    {
      inputLabels: ['1:a'],
      filters: [
        'atrim=start=0:end=7',
        'asetpts=PTS-STARTPTS',
        'adelay=0:all=1',
        "volume=volume='min(1,pow(10,(…)/20))':eval=frame",   // expresión completa en §9.3
        'afade=t=in:st=0:d=0.5',
        'afade=t=out:st=6:d=1',
        'apad',
        'atrim=end=7',
      ],
      outputLabels: ['music0'],
    },
    {
      inputLabels: ['voice0', 'music0'],
      filters: ['amix=inputs=2:duration=longest:normalize=0'],
      outputLabels: ['mix'],
    },
  ],
  outputLabel: 'mix',
}
```

`afade in`: `st = clip.from / fps = 0`, `d = fadeInFrames / fps = 0.5`.
`afade out`: `d = fadeOutFrames / fps = 1`, `st = (clip.from + clip.durationFrames) / fps − d = 6`.

### 9.3 `serializeFilterGraph(graph)` — string exacto (855 caracteres)

```
[0:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,loudnorm=I=-14:TP=-1:LRA=11:print_format=json,aresample=48000[voice0];[1:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame,afade=t=in:st=0:d=0.5,afade=t=out:st=6:d=1,apad,atrim=end=7[music0];[voice0][music0]amix=inputs=2:duration=longest:normalize=0[mix]
```

### 9.4 `audioMixFfmpegArgs(graph, '/out/master.wav')` — array exacto

```ts
[
  '-hide_banner',
  '-nostats',
  '-y',
  '-i', '/assets/voice.wav',
  '-i', '/assets/music.mp3',
  '-filter_complex', '<el string de §9.3>',
  '-map', '[mix]',
  '-c:a', 'pcm_s16le',
  '-ar', '48000',
  '-ac', '2',
  '/out/master.wav',
]
```

---

## 10. Divergencias contra la letra de la spec (para el orquestador)

Ninguna se aplicó en silencio. Si el orquestador prefiere la letra de la spec, lo que cambia es este
documento.

### 10.1 RF-1 — `framesToMs` no sirve para la expresión

RF-1 dice que los frames se convierten a segundos "con `framesToMs` de `timeline-core`".
`framesToMs` redondea a ms enteros y eso rompe CA-002 por ~3.700× la tolerancia (D-07). **Se usa
`frame / fps` exacto.** `framesToMs` se conserva donde corresponde: el `adelay`. Sugerencia de
reescritura de RF-1: *"los frames se convierten a segundos exactos (`frame / fps`); `framesToMs` se
usa solo para el `adelay`, cuya unidad es el milisegundo"*.

### 10.2 RF-2 / CA-003 — "baseGainDb antes de la automatización" produce un master 12 dB por debajo del preview

Es la divergencia importante. Ver D-05: los keyframes de `planDucking` **ya contienen**
`baseGainDb`, y `audio-track.tsx` usa la curva **en lugar de** `clip.volume`. Aplicar los dos duplica
la atenuación y contradice CA-002/HU-1-06, que es la promesa de negocio explícita del ciclo. El
diseño emite un solo nodo de ganancia y toma la ganancia estática de **`clip.gainDb`** (lo que usa el
preview), no de `plan.music.baseGainDb`. Sugerencia de reescritura de CA-003: *"`buildMusicBedChain`
emite exactamente un nodo de ganancia —la automatización cuando existe, la ganancia estática del clip
cuando no— y ninguno cuando la ganancia resultante es la identidad; los `afade` respetan
`fadeInFrames`/`fadeOutFrames` y con ambos ausentes no se emite ninguno"*.
**Alternativa si se prefiere la letra:** automatización relativa (D-05, párrafo final) — da los
mismos números para todo lo que hoy produce `planDucking` y diverge del preview solo si alguna vez
aparece un keyframe por encima de `baseGainDb`.

### 10.3 RF-5 — `audioMixFfmpegArgs(graph, inputs, out, opts)` → `audioMixFfmpegArgs(graph, outputPath)`

`inputs` se elimina porque el grafo ya lo tiene y tenerlo dos veces permite desordenarlos en
silencio (D-04). `opts` se elimina porque D-H fija el formato del master y las opciones solo
agregarían ramas de default sin caso de uso (D-10). El shape `FilterGraph { inputs, chains,
outputLabel }` que se conserva es el de D-D, que es la decisión más específica de las dos.

### 10.4 `clip.gainDb` de la voz no se aplica

`buildTimeline` crea los clips de voz con `gainDb: 0` y el master normaliza la voz con `loudnorm` al
target de `AudioMixPlan.voice`. Aplicar además una ganancia previa sería ruido: `loudnorm` la
anula por definición. Consecuencia declarada: **la paridad con el preview se promete para la curva
de ducking de la música, no para el nivel absoluto de la voz** — el preview no tiene `loudnorm`, así
que su nivel de voz nunca fue el del master. Conviene que esto quede escrito en el README de
`cycle-02` (RF-11).

### 10.5 "expresión evaluada por muestra" (RF-1, glosario del functional)

El filtro `volume` de FFmpeg solo ofrece `eval=once` y `eval=frame`; **no hay modo por muestra**.
Se usa `eval=frame`, la granularidad más fina disponible. No cambia ninguna decisión ni ningún CA;
es solo la letra de la spec prometiendo algo que el filtro no tiene.

### 10.6 Sin contradicciones en el resto

`AudioMixPlanSchema`, `GainKeyframeSchema`, `AudioClipSchema`, `planDucking`, `buildLoudnormFilter` y
`volumeAtFrame` coinciden con lo que describen la spec y el functional. La nota del functional para
el Arquitecto (dominio frames vs. dominio tiempo) está resuelta en D-07 y verificada
numéricamente en §7.

---

## 11. Qué le dejo a `cycle-02`

No se implementa ni se especifica de más; queda anotado porque este diseño lo condiciona:

1. **`mixTimelineAudio` es un wrapper y va en `src/ffmpeg/`, no en `src/mix/`.** La dirección de
   imports `ffmpeg → mix` tiene que seguir siendo de un solo sentido (D-01).
2. **Las dos pasadas de `loudnorm`** salen de llamar `buildAudioMixGraph` dos veces: la primera sin
   `voiceMeasuredByAssetId` (medición) y la segunda con el mapa `assetId → LoudnessMeasurement`
   armado a partir de un `measureLoudness` por **asset distinto de voz**, no por clip (§3.4).
3. **Grafos muy grandes.** Por encima de ~2.000 keyframes conviene `-filter_complex_script` en vez de
   pasar el grafo por `argv` (§5.5). Hoy no hace falta.
4. **Asset resuelto pero sin audio** (`MediaAsset.hasAudio === false`, o `kind !== 'audio'`): este
   ciclo no lo valida. Si `cycle-02` lo necesita, es un `refine` más del schema de entrada o un
   error tipado nuevo — decisión de `cycle-02`.
5. **`AUDIO_MIX_CODEC`/`-ar`/`-ac`** describen el **WAV intermedio**. El AAC 192 kbps de D-H es del
   mux (`muxAudioIntoVideo`, RF-8) y no debe reusar estas constantes.
6. **Nota cruzada en ambos READMEs** (RF-11, D-E): `gainDbToVolume` está duplicada a propósito en las
   dos libs y la tabla de §7 es su contrato; tocar una sin la otra rompe CA-002.

---

## 12. Reglas de decisión para el implementador

Numeradas, verificables, y en este orden de precedencia si alguna vez chocan.

| # | Regla | Verifica |
| ---: | --- | --- |
| R-01 | La interpolación entre keyframes es **en dB**; la conversión a factor lineal ocurre **después**. Nunca interpolar amplitudes. | CA-002 (frames 102/192 dan exactamente `0.1`) |
| R-02 | El factor lineal se clampea a `[0,1]` con `min(1, pow(10, dB/20))`. El `max(0, …)` es un no-op y no se emite. | CA-002 |
| R-03 | Antes del primer keyframe y después del último el valor es **plano**, igual al keyframe extremo. Jamás extrapolar la pendiente vecina. | CA-002 (frames 0 y 210) |
| R-04 | `automation: []` ⇒ `buildGainAutomationExpression` devuelve exactamente `volume=1`, y `buildMusicBedChain` **no emite el nodo** (`isIdentityGainCurve`). | CA-001 |
| R-05 | Un solo nodo de ganancia en la música: la automatización cuando `plan.automation.length > 0`, si no la constante de `clip.gainDb`. **Nunca los dos.** | CA-002, D-05 |
| R-06 | El nodo de ganancia va **después** del `adelay`: `t` es tiempo de timeline, no de clip. Los `st` de los `afade` también son absolutos. | D-06 |
| R-07 | Orden fijo de la cadena de música: `atrim → asetpts → adelay → [volume] → [afade in] → [afade out] → apad → atrim=end`. | CA-003 |
| R-08 | `afade=t=in` solo si el clip trae `fadeInFrames`; `afade=t=out` solo si trae `fadeOutFrames`. Con los dos ausentes, **cero `afade`**. | CA-003 |
| R-09 | El segmento `loudnorm` de la voz es **la salida literal** de `buildLoudnormFilter(target, measured)`. Prohibido reconstruir el string. | CA-004 |
| R-10 | Todo clip de audio produce **exactamente una** entrada y una cadena; su `adelay` es `framesToMs(clip.from, fps)` con `:all=1`, y se emite **siempre**, incluso cuando vale 0. | CA-005 |
| R-11 | Todo clip lleva `atrim=start=<trimStartMs/1000>:end=<start + durationFrames/fps>` seguido de `asetpts=PTS-STARTPTS`, siempre. | CA-005 |
| R-12 | La cadena final es `amix=inputs=<N>:duration=longest:**normalize=0**` con un único `outputLabel`. `normalize=1` (el default) está prohibido. | CA-005 |
| R-13 | Los labels se guardan **sin corchetes**; los corchetes los agrega solo `serializeFilterGraph` / `audioMixFfmpegArgs`. | CA-006 |
| R-14 | Tiempos en segundos = `frame / fps` **exacto**. `framesToMs` se usa **solo** en el `adelay`. | CA-002 |
| R-15 | Todo número del filtergraph pasa por `formatFilterNumber` (9 decimales, sin exponencial, sin ceros de cola). Nunca `String(n)` ni `toFixed` sueltos. | CA-006, RNF-4 |
| R-16 | La expresión de `volume` va entre **comillas simples** y **no lleva ningún escape extra**: el argumento viaja por `argv`, sin shell. | CA-006 |
| R-17 | La pendiente de un segmento de largo 0 es `0`, nunca `Infinity`/`NaN`: un `NaN` en el string envenena la suma entera. | §5.2 |
| R-18 | `buildAudioMixGraph` valida la `Timeline` con Zod y exige ≥ 1 clip de audio antes de componer nada. | RN-10 |
| R-19 | `assetId` no resuelto ⇒ `UnresolvedAudioAssetError` con el `assetId` en el mensaje. Nunca un grafo parcial. | CA-005 |
| R-20 | Nada de `CommandRunner`, `execa`, `child_process`, `node:fs`, `Date`, `process`, `Math.random` en `src/mix/**`. Todo determinista. | RNF-3, RNF-4 |
| R-21 | Cero comentarios en el código. Si una línea pide explicación, el nombre de la función es la explicación. | RNF-5 |
| R-22 | `src/mix/**` no importa `src/runner/**` ni ningún wrapper; `src/ffmpeg/**` no importa `src/mix/**`. | D-01 |
| R-23 | El barrel exporta **exactamente** lo listado en §8, ni un símbolo más. Los specs importan lo interno por ruta relativa. | constitution §3 |
| R-24 | `exactOptionalPropertyTypes: true`: nunca pasar `undefined` explícito a una propiedad opcional (`voiceMeasuredByAssetId`). Vitest no lo detecta; `nx build` sí. | CA-007 |

### Cobertura: dónde están las ramas y cómo cubrirlas sin código muerto

| Módulo | Ramas | Casos mínimos del spec |
| --- | --- | --- |
| `gain-automation-curve` | `constant` vs `piecewise`; guard `span === 0` | `[]`, 1 keyframe, N keyframes, dos keyframes con el mismo `frame` |
| `serialize-gain-automation-curve` | `kind` | los mismos tres primeros |
| `format-filter-number` | **ninguna** | `100`, `10.5`, `0`, `-12`, `1e-7`, `26/30` |
| `build-music-bed-chain` | identidad / automatización / constante; `fadeIn?`; `fadeOut?` | automatización presente; automatización vacía con `gainDb: -12`; automatización vacía con `gainDb: 0`; con los dos fades; sin ninguno |
| `build-voice-chain` | `measured?` | con y sin medición |
| `build-audio-mix-graph` | Zod ok/ko; asset resuelto/no; voz con y sin medición | Timeline real de `buildTimeline`; Timeline sin audio; `assetId` inexistente en voz y en música |
| `serialize-filter-graph` / `audio-mix-ffmpeg-args` | **ninguna** | el fixture de §9 |
