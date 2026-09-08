# Constitución — libs/media-local

> Versión 1.0 | Última actualización: cycle-02 (spec-e-burgos-004) | Fecha: 2026-09-08
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib Node (TypeScript, solo servidor)
- **Rol en el sistema:** única puerta del motor hacia los binarios locales (ffprobe, ffmpeg,
  whisper-cli). Ejecuta comandos a través de un runner inyectable y convierte su salida a los
  contratos de `@video-maker/timeline-core`. Ninguna otra lib invoca binarios. Incluye la capa
  pura de mezcla de audio (`AudioMixPlan` + `Timeline` → `FilterGraph` de ffmpeg) y su ejecución
  (medición de loudness en dos pasadas, master bus limiter, mux final con el video). **La
  orquestación `render → mix → mux` en una sola llamada no vive acá** (ver §3 y §4): los
  boundaries Nx impiden que esta lib (`type:util`) y `libs/composition-remotion` (`type:ui`) se
  importen entre sí, así que esa orquestación es de `apps/render-api` (`spec-e-burgos-005`).

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `execa` ^10.0.1 para el runner real (única dependencia runtime nueva); `zod` para validar salidas externas
- Vitest 4 con fixtures grabadas/reconstruidas; cero binarios en CI

## 3. Estructura y patrones

- `src/index.ts` única superficie pública, exportando exactamente los schemas Zod de las salidas
  externas, las fixtures y los helpers públicos — nada de detalle de implementación
  (`FFPROBE_ARGS`, `truncateStderr`, `groupTokensIntoWords`, etc. no se exportan). Superficie de
  mezcla/mastering agregada por `spec-e-burgos-004`:
  - Capa pura (`src/mix/`): `gainDbToVolume`, `buildGainAutomationCurve`,
    `evaluateGainAutomationCurve`, `buildGainAutomationExpression`, `buildVoiceChain`,
    `buildMusicBedChain`, `buildAudioMixGraph`, `serializeFilterGraph`, `audioMixFfmpegArgs`,
    `AUDIO_MIX_SAMPLE_RATE`/`_CHANNELS`/`_CODEC`, `UnresolvedAudioAssetError`, y los tipos
    `GainAutomationCurve`, `GainAutomationSegment`, `MusicBedChainOptions`, `AudioMixGraphSpec`,
    `FilterChain`, `FilterGraph`. Fuera del barrel (detalle de implementación):
    `formatFilterNumber`, `FILTER_NUMBER_DECIMALS`, `serializeGainAutomationCurve`,
    `isIdentityGainCurve`, `audioStreamLabel`, `AudioMixTimelineSchema`.
  - Capa de ejecución (`src/ffmpeg/`): `mixTimelineAudio` (+ `MixTimelineAudioOptions`,
    `MixTimelineAudioResult`), `verifyMixLoudness` (+ `MixLoudnessVerification`,
    `VerifyMixLoudnessOptions`, `MIX_INTEGRATED_TOLERANCE_LU`, `MIX_TRUE_PEAK_TOLERANCE_DB`),
    `muxAudioIntoVideo` (+ `MuxAudioIntoVideoOptions`, `MuxAudioIntoVideoResult`,
    `MUX_AUDIO_CODEC`, `MUX_AUDIO_BITRATE`), `MissingMediaStreamError` (+ `MissingStreamKind`),
    `MASTER_BUS_TRUE_PEAK_MARGIN_DB` (único símbolo del master bus en el barrel: contrato
    observable de cuánto margen de inter-sample deja el limitador). `withMasterBusLimiter` /
    `buildTruePeakLimiterFilter` quedan fuera del barrel (internas).
- `src/runner/` — `CommandRunner`, `ExecaCommandRunner`, `FixtureCommandRunner`, errores tipados
- `src/errors/` — `MediaLocalError` → `BinaryNotFoundError`, `CommandFailedError`, `UnparseableOutputError`
- `src/binaries/` — resolución de rutas por variables de entorno y `PATH`
- `src/fs/` — `binary-lookup.ts`, `read-text-file.ts` (los ports de filesystem)
- `src/clock.ts` — el reloj inyectable (`Clock`)
- `src/ffprobe/`, `src/ffmpeg/`, `src/whisper/` — un wrapper (I/O vía runner) + un parser puro por
  comando. `buildLoudnormFilter` vive en `src/ffmpeg/build-loudnorm-filter.ts` (no en
  `normalize-voice.ts`: ubicarlo ahí crea el único ciclo de imports de la lib,
  `measure-loudness ↔ normalize-voice`). `src/ffmpeg/` es también la capa de ejecución del mix
  (`mixTimelineAudio`, `verifyMixLoudness`, `muxAudioIntoVideo`, el master bus limiter)
- `src/mix/` — capa **pura** de mezcla: traduce un `AudioMixPlan` + `Timeline` a un `FilterGraph`
  tipado y a los argumentos de invocación de ffmpeg. No ejecuta ffmpeg, no usa `CommandRunner`, no
  toca el filesystem — solo composición de strings y aritmética. Import unidireccional
  `mix → ffmpeg` (`buildLoudnormFilter`, `LoudnessMeasurement`) y `mix → errors`
  (`UnresolvedAudioAssetError`); `ffmpeg → mix` para la ejecución (`master-bus-limiter` consume
  `filter-graph`, `gain-db-to-volume`, `format-filter-number`) y `ffmpeg → ffprobe`
  (`mux-audio-into-video` → `probe-media`). Ninguna otra combinación de aristas existe: DFS sobre
  los archivos no-spec de `src/` confirma **cero ciclos** a nivel archivo.
- `smoke/` — directorio nuevo, fuera de `src/` (`smoke-audio.ts`, `smoke-register.cjs`), sin spec
  hermano porque ejecuta binarios reales. Target manual `media-local:smoke-audio`, autocontenido
  (genera sus propias señales con ffmpeg), **fuera de CI**; salidas en `libs/media-local/tmp/`.
  `tsconfig.smoke.json` usa `ignoreDeprecations: "6.0"` junto a `baseUrl` (TS 6.0.3 deprecó
  `baseUrl` y este target invoca `tsc -p tsconfig.smoke.json --noEmit`).
- `src/__fixtures__/` — `load-fixture.ts` + `ffprobe/`, `ffmpeg/`, `whisper/`. Las de `ffprobe/` son
  capturas reales; las de `ffmpeg/` y `whisper/` están **reconstruidas a mano** contra el formato
  documentado (el entorno de implementación no tenía los binarios instalados). Incluye cinco
  fixtures `loudnorm-mix-*.stderr.txt` para los casos de tolerancia del mix en dos pasadas.

## 4. Convenciones propias

- **Parser puro separado del wrapper**: el wrapper arma argumentos y ejecuta; el parser recibe texto y
  devuelve un contrato validado. Los tests cubren el parser con fixtures y el wrapper con
  `FixtureCommandRunner`
- **Errores tipados** con comando, args y `stderr` truncado a 2 KB
- **Todo I/O externo entra por parámetro, nunca se instancia dentro de un wrapper.** Cuatro puertos
  inyectables: `CommandRunner` (sin default, obligatorio), `Clock` → `systemClock`, `ReadTextFile` →
  `nodeReadTextFile`, `BinaryLookup` → `nodeBinaryLookup`
- **Binarios**: `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`. La variable de
  entorno gana sobre `PATH` y, si apunta a una ruta inválida, **no** cae al `PATH`
  (`BinaryNotFoundError` directo). `WHISPER_MODEL_PATH` no tiene fallback a `PATH` (un modelo no es
  ejecutable). Lookup puro de filesystem (`access`+`stat`), nunca `<binario> --version`. Alcance
  POSIX: sin `PATHEXT` ni `.exe`
- **Faster-Whisper no es un binario que la lib ejecute**: solo se interpreta su formato JSON
  (`parseFasterWhisperJson`), para comparar equivalencia con whisper.cpp. No tiene variable de entorno
- **La automatización de ducking del mix es un modelo tipado, no un string**: `buildGainAutomationCurve`
  produce una `GainAutomationCurve` (`constant` | `piecewise`), `evaluateGainAutomationCurve` la evalúa
  en TS y `serializeGainAutomationCurve` la emite como expresión `volume`. La expresión serializada
  nunca es la fuente de verdad semántica: el modelo lo es, y por eso la paridad con el preview de
  Remotion se testea sin ejecutar ffmpeg
- **Un solo nodo de ganancia por clip de música**: `buildMusicBedChain` emite la automatización cuando
  `plan.automation` no está vacío, la constante de `clip.gainDb` cuando sí lo está, y ninguno si además
  `gainDb === 0` (identidad). Nunca los dos encadenados. La fuente de la ganancia estática es
  `clip.gainDb`, no `plan.music.baseGainDb` (coinciden por default, los separa un `MusicInput.gainDb`
  explícito)
- **Orden fijo de la cadena de un clip de música**: `atrim → asetpts=PTS-STARTPTS → adelay → [volume] →
  [afade in] → [afade out] → apad → atrim`. La automatización y los `st` de los `afade` van después
  del `adelay` porque su `t` es tiempo absoluto de timeline, no offset dentro del clip
- **Dos unidades de tiempo conviven sin contradicción**: segundos exactos `frame / fps` en la expresión
  de automatización y en los `afade`; `framesToMs` solo en `adelay`, donde la unidad del filtro es el
  milisegundo (mezclarlas desplaza la curva fuera de tolerancia)
- **`formatFilterNumber`** es el único formateador numérico del filtergraph: 9 decimales, cero ramas,
  byte-determinista, nunca notación exponencial. Regex `(\.\d*?)0+$` (no `0+$`: con `0+$`,
  `"100.000000000"` colapsa a `"1"`)
- **Validación Zod solo de la `Timeline` de entrada al mix**: `AudioMixTimelineSchema` =
  `TimelineSchema` + `refine` que exige al menos un clip de audio. Una timeline sin audio es
  `ZodError`, no un error tipado — un `amix=inputs=0` nunca se construye
- **`audioMixFfmpegArgs(graph, outputPath)` sin objeto de opciones**: el formato del master vive en las
  tres constantes de `src/mix/audio-mix-format.ts` (también consumidas por `buildVoiceChain` para su
  `aresample`). Un solo lugar tiene el número 48000
- **`mixTimelineAudio` mide la voz por asset distinto (no por clip), dedup por `assetId`**, arma el
  grafo de segunda pasada con esas mediciones (`measured_*`, `linear=true`) y ejecuta N+1 invocaciones
  de ffmpeg (N = cantidad de assets de voz distintos; 2 invocaciones en toda `Timeline` de
  `buildTimeline`, donde N=1 por construcción). `measureLoudness` acepta `audioStreamSpecifier?`
  (constante interna `FIRST_AUDIO_STREAM = '0:a:0'`): mide siempre el primer stream de audio, así
  sirve igual para un WAV aislado que para el contenedor de video que trae la voz — necesario porque
  `buildVoiceTrack` (`libs/timeline-core`) asigna al clip de voz el `assetId` del clip de aroll, así
  que la voz nunca tiene un `assetId` propio
- **Master bus siempre aplicado y no deshabilitable**: `alimiter` con `level=disabled` (el default
  `enabled` aplica *makeup gain* y sube el master hasta el techo) y techo en
  `gainDbToVolume(truePeakDbtp − MASTER_BUS_TRUE_PEAK_MARGIN_DB)`, 1 dB de margen de inter-sample.
  `MixTimelineAudioOptions` solo expone `ffmpegPath` y `runOptions`, ninguna opción lo desactiva.
  `withMasterBusLimiter` es pura (devuelve un `FilterGraph` nuevo, no muta el recibido). El limitador
  garantiza el **true peak** del master; el **integrado** (voz + música) no se re-normaliza —
  `verifyMixLoudness` lo mide y lo reporta, pero un re-master de dos pasadas sobre el bus completo,
  si hiciera falta, es responsabilidad de quien orquesta (`spec-e-burgos-005`)
- **`MissingMediaStreamError`** (`code: 'MISSING_MEDIA_STREAM'`) es un solo error tipado para las dos
  direcciones de `muxAudioIntoVideo` (`stream: 'audio' | 'video'`, mensaje distinto por cada una);
  `muxAudioIntoVideo` verifica el stream de video con `probeMedia` antes de invocar ffmpeg
- **`gainDbToVolume` está duplicada a propósito** entre `libs/media-local/src/mix/gain-db-to-volume.ts`
  y `libs/composition-remotion/src/helpers/audio-gain.ts` por los mismos boundaries Nx que impiden que
  ambas libs se importen entre sí. El contrato entre las dos copias es la tabla de paridad de
  `sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/architect.md` §7.2 (26 filas,
  tolerancia `1e-6`), verificada por `gain-automation-curve.parity.spec.ts` contra `planDucking` real.
  Tocar una copia sin la otra rompe la paridad y el master deja de sonar como el preview
- **`vite.config.ts` necesita `resolve.alias` de `@video-maker/timeline-core`** apuntando a
  `../timeline-core/src/index.ts`: `tsc` resuelve el alias por `tsconfig.base.json → paths`, pero
  Vitest/Vite no leen esa sección — sin el alias, cualquier spec que importe un valor real falla con
  `ERR_MODULE_NOT_FOUND` aunque `lint`/`build` estén verdes
- ESLint de la lib confina el I/O por directorio: `execa` solo en
  `src/runner/execa-command-runner.ts`; `node:fs`/`node:fs/promises` solo en `src/fs/**`,
  `src/__fixtures__/**` y `*.spec.ts`; `child_process` prohibido en todos lados; `Date` solo en
  `src/clock.ts`; `process`/`Math.random` prohibidos en producción
- **Sin comentarios** en el código; nombres declarativos, funciones cortas
- Tags Nx: `scope:engine`, `type:util` → `onlyDependOnLibsWithTags: ['type:domain']`. Depende solo de
  `libs/timeline-core`
- Targets: `lint`, `test` (`vitest run --coverage --passWithNoTests`, umbral 80 %, real 98.63 %
  statements / 95.77 % ramas / 98.56 % funcs sobre 280 tests), `build` (`tsc -p tsconfig.lib.json`);
  sin plugins inferidos en `nx.json`. Target manual adicional `smoke-audio` (ver §3), fuera de CI
- **`ExecaCommandRunner.run()` es la única ruta sin test por diseño** (ejecutar un proceso real está
  prohibido por RNF-3); `mapExecaResult`, que concentra la lógica de traducción, sí está cubierto al
  100 % con dobles. La verificación del wrapper real es el smoke manual del README
