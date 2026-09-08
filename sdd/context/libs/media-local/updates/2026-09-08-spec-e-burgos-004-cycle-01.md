# spec-e-burgos-004 cycle-01 — 2026-09-08

## Estado

Queda implementada la capa **pura** de mezcla de audio en `src/mix/`: la traducción completa de un
`AudioMixPlan` + `Timeline` a un `FilterGraph` de ffmpeg tipado y a los argumentos de invocación.
**No ejecuta ffmpeg**, no usa `CommandRunner` y no toca el filesystem — es composición de strings y
aritmética. 10/10 tasks `done`, CA-001..CA-007 PASS.

Superficie pública nueva en `src/index.ts` (exactamente `architect.md` §8, ni un símbolo más):
`gainDbToVolume`, `buildGainAutomationCurve`, `evaluateGainAutomationCurve`,
`buildGainAutomationExpression`, `buildVoiceChain`, `buildMusicBedChain`, `buildAudioMixGraph`,
`serializeFilterGraph`, `audioMixFfmpegArgs`, `AUDIO_MIX_SAMPLE_RATE`/`_CHANNELS`/`_CODEC`,
`UnresolvedAudioAssetError`, más los tipos `GainAutomationCurve`, `GainAutomationSegment`,
`MusicBedChainOptions`, `AudioMixGraphSpec`, `FilterChain`, `FilterGraph`.
Quedan deliberadamente **fuera** del barrel (detalle de implementación, los specs los importan por
ruta relativa): `formatFilterNumber`, `FILTER_NUMBER_DECIMALS`, `serializeGainAutomationCurve`,
`isIdentityGainCurve`, `audioStreamLabel`, `AudioMixTimelineSchema`.

Cobertura de la lib: **98.44 % stmts / 95.35 % branches / 98.38 % funcs / 98.41 % lines**
(234 tests en 22 archivos). `src/mix/` no aparece en el reporte de faltantes: está al 100 %.

## Estructura

- **Directorio nuevo `src/mix/`** (no `src/ffmpeg/`, D-01). 12 módulos de implementación + 10
  archivos de spec hermanos. Grafo de imports estrictamente unidireccional: `mix → ffmpeg`
  (`buildLoudnormFilter`, tipo `LoudnessMeasurement`) y `mix → errors`
  (`UnresolvedAudioAssetError`). **Ningún import inverso, sin ciclos.**
- **La automatización de ducking es un modelo tipado, no un string** (D-02/D-03):
  `buildGainAutomationCurve` → `GainAutomationCurve` (`constant` | `piecewise`),
  `evaluateGainAutomationCurve` la evalúa en TS y `serializeGainAutomationCurve` la emite como
  expresión `volume`. La expresión serializada nunca es la fuente de verdad semántica: el modelo lo
  es, y por eso la paridad con el preview se puede testear sin ejecutar ffmpeg.
- **Un solo nodo de ganancia en la música (D-05, la corrección de mayor riesgo del ciclo).**
  `buildMusicBedChain` emite la automatización cuando `plan.automation` no está vacío, la constante
  de `clip.gainDb` cuando sí lo está, y **ninguno** si además `gainDb === 0` (identidad → CA-001).
  Nunca los dos encadenados. La fuente de la ganancia estática es `clip.gainDb`, **no**
  `plan.music.baseGainDb` (coinciden por default, los separa un `MusicInput.gainDb` explícito).
  Estructuralmente `buildGainFilters` construye UNA curva y devuelve un array de longitud ≤ 1, así
  que la degradación a dos nodos no es alcanzable sin reescribir la función.
- **Orden fijo de la cadena de un clip de música** (D-06):
  `atrim → asetpts=PTS-STARTPTS → adelay → [volume] → [afade in] → [afade out] → apad → atrim`.
  La automatización y los `st` de los `afade` van **después** del `adelay` porque su `t` es tiempo
  absoluto de timeline, no offset dentro del clip.
- **Dos unidades de tiempo que conviven sin contradicción** (D-07): segundos exactos `frame / fps`
  en la expresión y en los `afade` (usar `framesToMs` ahí desplazaría la curva ~4·10⁻³ en factor
  lineal, 3.700× la tolerancia de CA-002); `framesToMs` **solo** en `adelay`, donde la unidad del
  filtro es el milisegundo.
- **`formatFilterNumber` con 9 decimales** (D-08), único formateador numérico del filtergraph: cero
  ramas, byte-determinista, nunca notación exponencial. El regex es `(\.\d*?)0+$` y no `0+$` a
  propósito — con `0+$`, `"100.000000000"` colapsa a `"1"`.
- **Validación Zod solo de la `Timeline`** (D-09): `AudioMixTimelineSchema` = `TimelineSchema` +
  `refine` que exige al menos un clip de audio. Una timeline sin audio es `ZodError`, no el error
  tipado nuevo — un `amix=inputs=0` nunca se construye.
- **`audioMixFfmpegArgs(graph, outputPath)` sin objeto de opciones** (D-10): el formato del master
  vive en las tres constantes de `src/mix/audio-mix-format.ts`, que también consume
  `buildVoiceChain` para su `aresample`. Un solo lugar tiene el número 48000.
- Error tipado nuevo `UnresolvedAudioAssetError` (código `UNRESOLVED_AUDIO_ASSET`) en la jerarquía
  `MediaLocalError` existente; expone `assetId`, `clipId` y `track`, y `isMediaLocalError` lo
  reconoce. Es el único error que agrega el ciclo.

## Dependencias

**Ninguna nueva.** No se agregó ni actualizó nada en `package.json`: `src/mix/` usa solo
`@video-maker/timeline-core` (tipos, `TimelineSchema`, `framesToMs`, `planDucking`/
`DEFAULT_MUSIC_MIX` en los specs) y `zod`, ya presentes. Sigue sin ejecutarse ningún binario en la
suite.

## Qué sigue

- **La orquestación `render → mix → mux` en una sola llamada NO vive en ninguna de las dos libs.**
  Los boundaries Nx lo impiden (`media-local` es `type:util` y `composition-remotion` es `type:ui`;
  ninguna puede importar a la otra) y `eslint.config.mjs` raíz está protegido por hook, así que
  relajar el boundary no es una opción dentro de un ciclo. Es **entrada obligatoria de
  `spec-e-burgos-005`**, en `apps/render-api` (`type:app`), que sí puede depender de las dos.
- **`gainDbToVolume` está duplicada a propósito** entre `libs/media-local/src/mix/gain-db-to-volume.ts`
  y `libs/composition-remotion/src/helpers/audio-gain.ts` — misma razón de boundaries. El contrato
  entre las dos copias es la **tabla de `architect.md` §7.2** (26 filas, tolerancia `1e-6`) y
  `gain-automation-curve.parity.spec.ts` la verifica contra `planDucking` real. **Tocar una de las
  dos copias sin la otra rompe CA-002 y hace que el master deje de sonar como el preview.**
- **Hallazgo del implementador en TASK-008, relevante para `measureLoudness` en cycle-02:**
  `buildVoiceTrack` de `libs/timeline-core/src/.../build-timeline.ts` le asigna al clip de voz el
  `assetId` del clip de aroll (el `sourceAssetId` del EDL), así que **la voz nunca tiene un
  `assetId` propio**. No genera colisión —es el mismo id por construcción y el índice
  `voiceMeasuredByAssetId` de §3.4 se indexa por `assetId`—, pero implica que en `cycle-02`
  `measureLoudness` puede tener que leer el **stream de audio de un contenedor de video**, no un WAV
  aislado. Verificarlo antes de asumir que la medición recibe un archivo de audio puro.
- **Lo que `architect.md` §11 le deja explícitamente a `cycle-02`:** `mixTimelineAudio` (el wrapper
  que ejecuta los dos pases de ffmpeg con `CommandRunner`, CA-008), `verifyMixLoudness` (CA-009),
  `muxAudioIntoVideo` con `-c:v copy` (CA-010), `renderTimeline(timeline, { audio: 'muted' })` y el
  cambio en `TimelineComposition` para no montar `AudioTrack` (CA-011), el target manual
  `smoke-audio` fuera de CI (CA-012) y la documentación del procedimiento encadenado en los dos
  READMEs (CA-013).
- **Deuda de test conocida (no bloqueante, ver `follow_ups` del ciclo):** todos los fixtures de
  `src/mix/` usan clips con `from: 0` y `trimStartMs: 0`, así que `adelay` solo está verificado en
  el valor degenerado `0` y la cláusula de CA-005 «`adelay` igual al `from` en ms» no está probada
  numéricamente. La implementación (`framesToMs(clip.from, fps)`) es correcta por inspección, pero
  una regresión ahí —o en los `st` absolutos de los `afade` de D-06— pasaría la suite. `cycle-02`
  debería agregar un fixture con `from > 0`.
