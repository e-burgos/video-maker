# Sprint Plan — Ciclo 1 — audio-mix-mastering (libs/media-local)

**Duración estimada:** < 1 semana (29h ≈ 3.6 días de trabajo)
**Story points totales:** 31

---

## Realineado contra `architect.md`

Esta versión reemplaza una anterior escrita antes de que `architect.md` existiera. El arquitecto
fija tres cosas que cambian el plan de raíz:

1. **Directorio `src/mix/` (nuevo), no `src/ffmpeg/`** (D-01). `src/ffmpeg/` no se toca —
   `buildLoudnormFilter` se importa desde ahí, no se mueve.
2. **Diez archivos, no cinco.** El arquitecto descompone las cinco funciones públicas de la spec en
   piezas más chicas y reusables (modelo de curva, serializador de curva, formato numérico,
   conversión dB→lineal, tipos de grafo) porque eso es lo que hace verificable CA-002 sin ejecutar
   ffmpeg (D-02) y sin ramas de más (D-03, D-08). Este plan agrupa esas diez piezas en 8 tasks de
   implementación (más la de error tipado y la de cierre) siguiendo el grafo de imports real de §2
   del architect.md — no el orden narrativo del brief.
3. **RF-2/CA-003 corregidos.** El arquitecto encontró que aplicar `baseGainDb` y después la
   automatización de ducking (la letra original de CA-003) deja el master 12 dB por debajo del
   preview, porque los keyframes de `planDucking` ya son ganancias absolutas y `audio-track.tsx` usa
   la curva **en lugar de** `clip.volume`, no encima (D-05). `buildMusicBedChain` emite un único nodo
   de ganancia: la automatización cuando `plan.automation` no está vacío, la constante de
   `clip.gainDb` cuando sí — nunca los dos. TASK-006 lo describe así, no como la letra original.

---

## Orden de ejecución — grafo de imports real (§2 del architect.md), no narrativa

El brief pedía el orden narrativo "expresión → paridad → música → voz → grafo+error →
serializador+args". El grafo de imports que fija el arquitecto en §2 es más fino y en dos puntos
**diverge de esa narrativa en la dependencia real** (lo marco explícitamente en vez de forzar una
dependencia que no existe):

- **TASK-004 (paridad CA-002)** no depende de TASK-003 (`buildGainAutomationExpression`). El
  arquitecto es explícito en D-02/§8: CA-002 compara `evaluateGainAutomationCurve` contra la tabla
  de §7, **no** parsea la expresión FFmpeg. Su única dependencia real es TASK-002 (el modelo de
  curva). Puede hacerse en paralelo con TASK-003 si hay capacidad.
- **TASK-009 (`serializeFilterGraph` + `audioMixFfmpegArgs`)** no depende de TASK-008
  (`buildAudioMixGraph`). El grafo de imports de §2 lista sus dependencias como `filter-graph`
  (tipos) y `audio-mix-format` — nunca `build-audio-mix-graph`. El fixture de §9 del architect.md se
  transcribe como literal en el spec de TASK-009, no se obtiene llamando a `buildAudioMixGraph`. Es
  el mismo caso que TASK-004: dependencia narrativa sin dependencia de archivo real.

Camino crítico real: **TASK-001 → TASK-002 → TASK-006 → TASK-008 → TASK-010**, con TASK-003,
TASK-004, TASK-005, TASK-007 y TASK-009 insertables sin bloquearlo (ver tabla de dependencias al
final).

**Nombre del error tipado** (antes provisorio en la versión anterior de este documento): el
arquitecto lo fija en §6 como `UnresolvedAudioAssetError`, code `'UNRESOLVED_AUDIO_ASSET'`, en
`src/errors/unresolved-audio-asset-error.ts`, con campos `assetId`/`clipId`/`track`.

---

## Tasks Backend

### TASK-001: Piezas leaf sin dependencias (`gainDbToVolume`, `formatFilterNumber`, tipos `FilterGraph`, constantes de formato)

**Historia:** HU-1-01, HU-1-04, HU-1-05 (infraestructura compartida de las tres)
**App:** libs/media-local
**Descripción:** Los cuatro archivos que el árbol de §2 marca como `(leaf)` — sin dependencias entre
sí ni de ningún otro archivo del ciclo:

- `gainDbToVolume(db: Db): number` — `Math.min(1, Math.max(0, 10 ** (db / 20)))` (§3.7). Mismo nombre
  y misma fórmula que `libs/composition-remotion/src/helpers/audio-gain.ts` — la duplicación es
  intencional (greppable entre libs, ver §3.7).
- `formatFilterNumber(value: number): string` — `value.toFixed(9).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')`
  (D-08, copiar la expresión **tal cual**, incluido el regex `(\.\d*?)0+$` y no `0+$` — la variante
  ingenua rompe `"100.000000000"` a `"1"`). 9 decimales, no 6 (D-08 explica por qué 6 rompe CA-002).
- `FilterGraph`/`FilterChain` — solo tipos, sin runtime (§4.1): `{ inputs, chains, outputLabel }` y
  `{ inputLabels, filters, outputLabels }`, labels siempre **sin corchetes** (D-04).
- `AUDIO_MIX_SAMPLE_RATE = 48000`, `AUDIO_MIX_CHANNELS = 2`, `AUDIO_MIX_CODEC = 'pcm_s16le'` (D-10).

**Archivos:**

- `libs/media-local/src/mix/gain-db-to-volume.ts`
- `libs/media-local/src/mix/gain-db-to-volume.spec.ts`
- `libs/media-local/src/mix/format-filter-number.ts`
- `libs/media-local/src/mix/format-filter-number.spec.ts`
- `libs/media-local/src/mix/filter-graph.ts` (solo tipos — sin spec propio, cero runtime, cero ramas)
- `libs/media-local/src/mix/audio-mix-format.ts` (solo constantes — sin spec propio, se cubre vía
  los consumidores de TASK-005/TASK-009, mismo patrón que `loudnorm-output.schema.ts` en `ffmpeg/`)

**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `gainDbToVolume(-6)` ≈ `0.501187234`, `gainDbToVolume(20)` clampea a `1`, `gainDbToVolume` de un
      valor muy negativo clampea a `0`
- [ ] `formatFilterNumber` cubre exactamente los casos de D-08: `100` → `"100"`, `10.5` → `"10.5"`,
      `0` → `"0"`, `-12` → `"-12"`, `1e-7` → sin notación exponencial, `26/30` → 9 decimales exactos
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura heredado

---

### TASK-002: Modelo tipado de la curva de automatización (`buildGainAutomationCurve`, `evaluateGainAutomationCurve`, `serializeGainAutomationCurve`)

**Historia:** HU-1-01
**App:** libs/media-local
**Descripción:** El corazón de D-02/D-03: dos tipos (`constant` | `piecewise`) y las funciones que
los producen, evalúan y serializan.

- `buildGainAutomationCurve(automation, fps)` — `automation: []` o un solo keyframe → `{ kind:
  'constant', volume: gainDbToVolume(...) }` (D-03: identidad y caso de un solo keyframe son el mismo
  kind, sin `eval=frame` inútil); dos o más keyframes → `{ kind: 'piecewise', firstSeconds,
  firstGainDb, lastSeconds, lastGainDb, segments }` con `Tᵢ = frameᵢ / fps` **exacto**, nunca
  `framesToMs` (D-07 — `framesToMs` redondea a ms enteros y eso rompe CA-002 por ~3.700× la
  tolerancia). El guard de pendiente `span === 0 ? 0 : (Gᵢ₊₁ − Gᵢ) / span` es obligatorio, no
  defensivo (§5.2 — sin él la pendiente da `Infinity`/`NaN` y envenena la suma entera).
- `evaluateGainAutomationCurve(curve, seconds)` — la semántica de referencia: interpola en dB entre
  segmentos, plano antes del primero/después del último (RN-1, RN-2, RN-3).
- `isIdentityGainCurve(curve)` (interno) — `curve.kind === 'constant' && curve.volume === 1`.
- `serializeGainAutomationCurve(curve)` (interno, archivo propio — §2 explica por qué no vive dentro
  del modelo: lo consumen dos serializadores/llamadores distintos y meterlo adentro le rompería la
  responsabilidad única) — produce el nodo `volume=...` con la suma compuertada de §5.1
  (`lt`/`gte`/`min`/`pow`), comillas simples, sin escapes extra (§5.4).

**Archivos:**

- `libs/media-local/src/mix/gain-automation-curve.ts`
- `libs/media-local/src/mix/gain-automation-curve.spec.ts`
- `libs/media-local/src/mix/serialize-gain-automation-curve.ts`
- `libs/media-local/src/mix/serialize-gain-automation-curve.spec.ts`

**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001 (`gainDbToVolume`, `formatFilterNumber`)
**Criterio de done:**

- [ ] `automation: []` y un solo keyframe producen `{ kind: 'constant', ... }`; 2+ keyframes producen
      `{ kind: 'piecewise', ... }` con `segments` cuyo `slopeDbPerSecond` usa `Tᵢ = frameᵢ / fps`
      exacto (no `framesToMs`)
- [ ] Dos keyframes con el mismo `frame` producen un segmento con `slopeDbPerSecond: 0` (nunca
      `Infinity`/`NaN`)
- [ ] `serializeGainAutomationCurve` del caso `constant` con volumen 1 da `volume=1`; del ejemplo de
      3 keyframes de §5.3 del architect.md da el string exacto de 148 caracteres documentado ahí
      (comparación literal)
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-003: `buildGainAutomationExpression` (RF-1 / CA-001)

**Historia:** HU-1-01
**App:** libs/media-local
**Descripción:** Composición pública de las dos piezas de TASK-002 (§3.1): `buildGainAutomationCurve`
seguido de `serializeGainAutomationCurve`. Firma exacta:

```ts
export function buildGainAutomationExpression(automation: readonly GainKeyframe[], fps: Fps): string;
```

Devuelve el **nodo de filtro completo** (`volume=1`, no solo el número).

**Archivos:**

- `libs/media-local/src/mix/build-gain-automation-expression.ts`
- `libs/media-local/src/mix/build-gain-automation-expression.spec.ts`

**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] `buildGainAutomationExpression([], fps)` devuelve exactamente `volume=1` (CA-001)
- [ ] Para el ejemplo de 3 keyframes de §5.3 del architect.md, devuelve el string exacto documentado
      ahí (148 caracteres, comparación literal)
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-004: Paridad numérica de la curva contra `volumeAtFrame` (CA-002)

**Historia:** HU-1-06
**App:** libs/media-local
**Descripción:** Task de test puro, sin nuevo archivo de implementación. El arquitecto ya fijó en §7
del architect.md la tabla completa: `fps=30`, `voiceRanges = [{1000,3000},{5000,6000}]`,
`DEFAULT_AUDIO_MIX_PLAN.music`, `planDucking(...)` produce los 9 keyframes de §7.1 (el test debe
generarlos llamando a `planDucking` de verdad, no pegando el literal, y comparar el array resultante
contra el literal de §7.1 como primera aserción). Después, para cada una de las **26 filas** de §7.2
(frame, t, factor esperado), comparar `evaluateGainAutomationCurve(buildGainAutomationCurve(automation,
30), t)` contra el factor esperado con tolerancia `1e-6`. **No se parsea ni se evalúa la expresión
FFmpeg** — el arquitecto es explícito en que eso duplicaría lógica de evaluación de expresiones
dentro del test (D-02).
**Archivos:**

- `libs/media-local/src/mix/gain-automation-curve.parity.spec.ts`

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002 (no depende de TASK-003 — ver "Orden de ejecución" arriba)
**Criterio de done:**

- [ ] El test genera `automation` con `planDucking` real y verifica que da los 9 keyframes de §7.1
      antes de evaluar la curva
- [ ] Cubre las 26 filas de §7.2 con tolerancia `1e-6` (`toBeCloseTo` con precisión equivalente)
- [ ] Incluye la aserción negativa que discrimina RN-1: en frame 102 el factor da exactamente `0.1`
      (interpolación en dB), no `≈0.125793` (lo que daría interpolar en amplitud)
- [ ] Cubre explícitamente frame 0 y frame 210 (extensión plana en los dos extremos, RN-3)
- [ ] `pnpm nx test media-local` en verde

---

### TASK-005: `buildVoiceChain` (RF-3 / CA-004)

**Historia:** HU-1-03
**App:** libs/media-local
**Descripción:** Firma exacta (§3.3):

```ts
export function buildVoiceChain(target: VoiceTarget, measured?: LoudnessMeasurement): string[];
```

Devuelve exactamente `[buildLoudnormFilter(target, measured), 'aresample=48000']` (usa
`AUDIO_MIX_SAMPLE_RATE` de TASK-001, no el literal `48000`). El primer elemento es la salida literal
de `buildLoudnormFilter` (ya existente en `src/ffmpeg/build-loudnorm-filter.ts`), nunca reconstruida
(RN-9). `measured` es un parámetro posicional opcional — pasar `undefined` explícito es válido y da
la primera pasada (`exactOptionalPropertyTypes` no aplica a parámetros de función).
**Archivos:**

- `libs/media-local/src/mix/build-voice-chain.ts`
- `libs/media-local/src/mix/build-voice-chain.spec.ts`

**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001 (`AUDIO_MIX_SAMPLE_RATE`); no depende de ninguna otra task del ciclo —
`buildLoudnormFilter` ya existe en la lib desde `spec-e-burgos-001`
**Criterio de done:**

- [ ] Sin `measured`, el primer elemento es igual —por igualdad de string— al que devuelve
      `buildLoudnormFilter(target)` llamado directamente (CA-004)
- [ ] Con `measured`, el primer elemento es igual al que devuelve `buildLoudnormFilter(target,
      measured)` (CA-004)
- [ ] El segundo elemento es siempre `'aresample=48000'`
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-006: `buildMusicBedChain` (RF-2 / CA-003 — versión corregida por el arquitecto, D-05)

**Historia:** HU-1-02
**App:** libs/media-local
**Descripción:** Firma exacta (§3.2):

```ts
export interface MusicBedChainOptions {
  readonly clip: AudioClip;
  readonly fps: Fps;
  readonly videoDurationFrames: Frame;
}

export function buildMusicBedChain(plan: AudioMixPlan, opts: MusicBedChainOptions): string[];
```

Devuelve **solo** los filtros propios de la música, en este orden fijo:
`[ganancia?] [afade in?] [afade out?] apad atrim=end`. **El prefijo `atrim`/`asetpts`/`adelay` NO va
acá** — lo agrega `buildAudioMixGraph` (TASK-008), es responsabilidad del grafo (D-06).

**Regla de ganancia corregida (D-05, diverge de la letra original de CA-003— no aplicar
`baseGainDb` y después la automatización, eso deja el master 12 dB por debajo del preview):**

| `plan.automation` | nodo de ganancia emitido |
| --- | --- |
| no vacío | **solo** el nodo de automatización (`buildGainAutomationCurve` + `serializeGainAutomationCurve` de TASK-002 — ya contiene la ganancia base en reposo) |
| vacío, `clip.gainDb !== 0` | **solo** un nodo constante con `gainDbToVolume(clip.gainDb)` (TASK-001) |
| vacío, `clip.gainDb === 0` | **ningún nodo** (`isIdentityGainCurve`, CA-001) |

La ganancia estática sale de **`clip.gainDb`**, no de `plan.music.baseGainDb` (son iguales por
default en `buildTimeline`, pero divergen si `MusicInput.gainDb` es explícito — el preview usa el
del clip).

`afade` de entrada solo si `clip.fadeInFrames` está presente, de salida solo si
`clip.fadeOutFrames` está presente; con ambos ausentes, cero `afade` (RN-6). `st`/`d` de los `afade`
son tiempos absolutos de timeline (`clip.from / fps`, `fadeInFrames / fps`), no offsets de clip
(D-06). Al final, `apad` + `atrim=end=<videoDurationFrames/fps>` para ajustar al largo exacto del
video (RN-7). Todo número pasa por `formatFilterNumber` (TASK-001).
**Archivos:**

- `libs/media-local/src/mix/build-music-bed-chain.ts`
- `libs/media-local/src/mix/build-music-bed-chain.spec.ts`

**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001 (`gainDbToVolume`, `formatFilterNumber`), TASK-002 (`buildGainAutomationCurve`, `serializeGainAutomationCurve`)
**Criterio de done:**

- [ ] Con `plan.automation` no vacío, la cadena tiene exactamente un nodo de ganancia y es el de la
      automatización (CA-003 corregido, D-05)
- [ ] Con `plan.automation` vacío y `clip.gainDb !== 0`, la cadena tiene exactamente un nodo de
      ganancia constante con `gainDbToVolume(clip.gainDb)`
- [ ] Con `plan.automation` vacío y `clip.gainDb === 0`, la cadena no tiene ningún nodo de ganancia
      (CA-001)
- [ ] Con `fadeInFrames`/`fadeOutFrames` presentes aparece el `afade` correspondiente con `st`/`d`
      absolutos de timeline; con ambos ausentes, cero `afade` (CA-003)
- [ ] La cadena siempre termina en `apad`, `atrim=end=<largo del video>`
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-007: Error tipado nuevo `UnresolvedAudioAssetError`

**Historia:** HU-1-04 (CE-4)
**App:** libs/media-local
**Descripción:** Calcado del patrón de `BinaryNotFoundError`/`UnparseableOutputError` (§6 del
architect.md, código a copiar tal cual):

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

Modificar `MediaLocalErrorCode` en `src/errors/media-local-error.ts` sumando el miembro
`'UNRESOLVED_AUDIO_ASSET'` a la unión existente (`BINARY_NOT_FOUND` | `COMMAND_FAILED` |
`UNPARSEABLE_OUTPUT` | `UNRESOLVED_AUDIO_ASSET`). `isMediaLocalError` no se toca — ya es un
`instanceof MediaLocalError`. Agregar el caso al `describe` de `errors.spec.ts` siguiendo el patrón
de los otros tres.
**Archivos:**

- `libs/media-local/src/errors/unresolved-audio-asset-error.ts` (nuevo)
- `libs/media-local/src/errors/media-local-error.ts` (modificado: +1 miembro en `MediaLocalErrorCode`)
- `libs/media-local/src/errors/errors.spec.ts` (modificado: describe de `UnresolvedAudioAssetError`)

**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna — no importa nada de `src/mix/**`, es una pieza autónoma de `src/errors/`
**Criterio de done:**

- [ ] `new UnresolvedAudioAssetError({ assetId, clipId, track })` incluye `assetId` en el mensaje
- [ ] `isMediaLocalError` reconoce la instancia nueva junto a los tres errores existentes
- [ ] `pnpm nx test media-local` en verde

---

### TASK-008: `buildAudioMixGraph` — filtergraph completo (RF-4 / CA-005)

**Historia:** HU-1-04
**App:** libs/media-local
**Descripción:** Firma exacta (§3.4):

```ts
export interface AudioMixGraphSpec {
  readonly timeline: Timeline;
  readonly voiceMeasuredByAssetId?: ReadonlyMap<AssetId, LoudnessMeasurement>;
}

export function buildAudioMixGraph(spec: AudioMixGraphSpec): FilterGraph;
```

Valida `spec.timeline` con un schema Zod local (`AudioMixTimelineSchema = TimelineSchema.refine(...)`
exigiendo `tracks.voice.length + tracks.music.length > 0`, D-09 — una `Timeline` sin clips de audio es
un `ZodError` de entrada, no una segunda clase de error). Para cada clip de `tracks.voice` y después
`tracks.music` (§4.4): resolver `assetId` contra `timeline.assets` por búsqueda lineal — si no
resuelve, lanzar `UnresolvedAudioAssetError` (TASK-007) con `assetId`/`clipId`/`track`; armar la
cadena fija `atrim=start=<trimStartMs/1000>:end=<...+durationFrames/fps> → asetpts=PTS-STARTPTS →
adelay=<framesToMs(clip.from,fps)>:all=1 → [buildVoiceChain (TASK-005) o buildMusicBedChain
(TASK-006)]`, con label de salida `` `${track}${índice}` ``. La medición de voz se indexa **por
`assetId`, no por `clipId`** (un asset puede repartirse en muchos clips; medir una vez por asset).
Omitir el mapa o no tener entrada para un asset ⇒ primera pasada de `loudnorm`. Cadena final única:
`amix=inputs=<N>:duration=longest:normalize=0` (RN-12, `normalize=1` prohibido) con
`outputLabel: 'mix'`. `exactOptionalPropertyTypes: true` — nunca `{ ..., voiceMeasuredByAssetId:
undefined }`, omitir la propiedad en su lugar (nx build lo detecta, Vitest no).
**Archivos:**

- `libs/media-local/src/mix/build-audio-mix-graph.ts`
- `libs/media-local/src/mix/build-audio-mix-graph.spec.ts`

**Estimación:** 5h · **Story points:** 5
**Dependencias:** TASK-001 (`FilterGraph`/`FilterChain`, `formatFilterNumber`), TASK-005
(`buildVoiceChain`), TASK-006 (`buildMusicBedChain`), TASK-007 (`UnresolvedAudioAssetError`)
**Criterio de done:**

- [ ] Con la `Timeline` de §9.1 del architect.md (construible con `buildTimeline`), el `FilterGraph`
      producido es exactamente (`toEqual`) el de §9.2 — dos chains de clip más el `amix` final
- [ ] Un `assetId` que no resuelve en voz o en música lanza `UnresolvedAudioAssetError` con ese
      `assetId` en el mensaje, nunca un grafo parcial (CA-005, R-19)
- [ ] Una `Timeline` sin ningún clip de audio (`tracks.voice` y `tracks.music` vacíos) lanza
      `ZodError` (D-09), no el error tipado nuevo
- [ ] El `amix` final siempre lleva `normalize=0`
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-009: `serializeFilterGraph` + `audioMixFfmpegArgs` (RF-5 / CA-006)

**Historia:** HU-1-05
**App:** libs/media-local
**Descripción:** Firmas exactas (§3.5, §3.6):

```ts
export function serializeFilterGraph(graph: FilterGraph): string;
export function audioMixFfmpegArgs(graph: FilterGraph, outputPath: string): string[];
```

`serializeFilterGraph` implementa la gramática de §4.2 (`chain := labels + filters + labels`, `graph
:= chains.join(';')`), sin espacios ni saltos de línea, determinismo byte a byte (RN-13). Los
corchetes los agrega **solo** esta función (D-04) — el modelo interno nunca los lleva.
`audioMixFfmpegArgs` arma el arreglo de §4.3: `-hide_banner -nostats -y`, un `-i` por cada
`graph.inputs` en orden, `-filter_complex <serializeFilterGraph(graph)>` (reusado tal cual, RN-14),
`-map [outputLabel]`, `-c:a <AUDIO_MIX_CODEC>`, `-ar <AUDIO_MIX_SAMPLE_RATE>`, `-ac
<AUDIO_MIX_CHANNELS>`, `outputPath`. Sin objeto de opciones (D-10). Ninguna de las dos ejecuta el
binario.
**Archivos:**

- `libs/media-local/src/mix/serialize-filter-graph.ts`
- `libs/media-local/src/mix/serialize-filter-graph.spec.ts`
- `libs/media-local/src/mix/audio-mix-ffmpeg-args.ts`
- `libs/media-local/src/mix/audio-mix-ffmpeg-args.spec.ts`

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001 (`FilterGraph`/`FilterChain`, `AUDIO_MIX_*`); no depende de TASK-008 — ver
"Orden de ejecución" arriba. El `FilterGraph` de entrada para los tests se transcribe como literal
desde §9.2 del architect.md, no se obtiene llamando a `buildAudioMixGraph`.
**Criterio de done:**

- [ ] Para el `FilterGraph` literal de §9.2, `serializeFilterGraph` produce el string exacto de §9.3
      (855 caracteres, igualdad exacta)
- [ ] `audioMixFfmpegArgs(graph, '/out/master.wav')` produce exactamente el arreglo de §9.4
- [ ] Ningún test de esta task instancia `CommandRunner` ni ejecuta un binario real
- [ ] `pnpm nx test media-local` en verde, sin bajar el piso de cobertura

---

### TASK-010: Barrel público, README y verificación de cierre del ciclo

**Historia:** HU-1-07
**App:** libs/media-local
**Descripción:** Agregar a `src/index.ts` el bloque exacto de §8 del architect.md (después del
bloque de `ffmpeg/`, antes del de `whisper/`) — exports explícitos, nunca wildcard:
`gainDbToVolume`; `buildGainAutomationCurve`/`evaluateGainAutomationCurve` + tipos
`GainAutomationCurve`/`GainAutomationSegment`; `buildGainAutomationExpression`; `buildVoiceChain`;
`buildMusicBedChain` + tipo `MusicBedChainOptions`; `buildAudioMixGraph` + tipo `AudioMixGraphSpec`;
`serializeFilterGraph` + tipos `FilterChain`/`FilterGraph`; `audioMixFfmpegArgs`;
`AUDIO_MIX_CHANNELS`/`AUDIO_MIX_CODEC`/`AUDIO_MIX_SAMPLE_RATE`; `UnresolvedAudioAssetError`.
**Explícitamente no se exporta** (§8): `formatFilterNumber`, `FILTER_NUMBER_DECIMALS`,
`serializeGainAutomationCurve`, `isIdentityGainCurve`, `audioStreamLabel`,
`AudioMixTimelineSchema`. Actualizar `README.md` con una sección para los nuevos builders de
`src/mix/`: qué hace cada uno, que toda la capa es pura (sin `ffmpeg`, sin `CommandRunner`), y que
`cycle-02` es quien los invoca de verdad.
**Archivos:**

- `libs/media-local/src/index.ts`
- `libs/media-local/README.md`

**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009
**Criterio de done:**

- [ ] `src/index.ts` exporta exactamente la superficie de §8, ni un símbolo interno de más
- [ ] `README.md` documenta la nueva sección de `src/mix/`, dejando explícito que este ciclo no
      ejecuta ffmpeg
- [ ] `pnpm nx run-many -t lint test build --projects=media-local` termina en verde
- [ ] Cobertura ≥ 98.03% statements / 94.77% ramas (CA-007/CA-008), sin que ningún `*.spec.ts` de
      este ciclo invoque un binario real

---

## Resumen

| Task | HU | CA (spec) | Horas | SP | Depende de |
| --- | --- | --- | --- | --- | --- |
| TASK-001 | HU-1-01, HU-1-04, HU-1-05 | — (infra) | 3 | 3 | — |
| TASK-002 | HU-1-01 | — (modelo) | 4 | 5 | TASK-001 |
| TASK-003 | HU-1-01 | CA-001 | 2 | 2 | TASK-002 |
| TASK-004 | HU-1-06 | CA-002 | 3 | 3 | TASK-002 |
| TASK-005 | HU-1-03 | CA-004 | 2 | 2 | TASK-001 |
| TASK-006 | HU-1-02 | CA-003 (corregido) | 4 | 5 | TASK-001, TASK-002 |
| TASK-007 | HU-1-04 | (CE-4) | 1 | 1 | — |
| TASK-008 | HU-1-04 | CA-005 | 5 | 5 | TASK-001, TASK-005, TASK-006, TASK-007 |
| TASK-009 | HU-1-05 | CA-006 | 3 | 3 | TASK-001 |
| TASK-010 | HU-1-07 | CA-007 | 2 | 2 | TASK-001..TASK-009 |

**Total: 29h / 31 SP** (dentro del tope de 1 semana).
