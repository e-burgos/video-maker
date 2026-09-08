# spec-e-burgos-004 cycle-02 — 2026-09-08

## Estado

Cierra `spec-e-burgos-004`. `cycle-01` dejó la capa pura (`src/mix/`: `AudioMixPlan` → `FilterGraph`
→ `-filter_complex`); **este ciclo la ejecuta** y entrega la pista masterizada muxeada.
`resuelve: pendiente de cycle-01 "ejecutar el filtergraph con CommandRunner"`.

Cuatro funciones nuevas, todas en `src/ffmpeg/` (nunca en `src/mix/`, que quedó **intacto**:
`git diff` vacío):

- `mixTimelineAudio(timeline, out, runner, opts?)` — mide la voz **por asset distinto** (no por
  clip, dedup por `assetId`), arma el grafo de **segunda** pasada con esas mediciones
  (`measured_*`, `linear=true`), le apenda el master bus y ejecuta el mix. **N+1 invocaciones** de
  ffmpeg; en toda `Timeline` de `buildTimeline` `N` es 1 por construcción, o sea 2 invocaciones.
  Devuelve `{ outputPath, filterComplex, voiceMeasured, args }`.
- `verifyMixLoudness(path, target, runner, opts?)` — medición post-mix. **No lanza** por estar fuera
  de tolerancia; sí propaga `CommandFailedError` del binario.
- `muxAudioIntoVideo(videoPath, audioPath, out, runner, opts?)` — `-map 0:v:0 -map 1:a:0 -c:v copy
  -c:a aac -b:a 192k -shortest`. Verifica el stream de video con `probeMedia` **antes** de invocar
  ffmpeg.
- `withMasterBusLimiter` / `buildTruePeakLimiterFilter` (internas, fuera del barrel) — el master bus
  de D-K/D-21.

Cobertura: **98.63 % stmts / 95.77 % ramas / 98.56 % funcs** sobre 280 tests, sin ejecutar un solo
binario en la suite (RNF-1).

## Estructura

- **`src/ffmpeg/` es ahora también la capa de ejecución del mix.** La dirección es
  `ffmpeg → mix` (`master-bus-limiter` consume `filter-graph`, `gain-db-to-volume` y
  `format-filter-number`, los tres hojas sin imports relativos) y `ffmpeg → ffprobe`
  (`mux-audio-into-video` → `probe-media`). Existe la contra-arista **heredada de `cycle-01`**
  `mix → ffmpeg` (`build-voice-chain` → `build-loudnorm-filter`, `parse-loudnorm-json`): este ciclo
  **no agregó ninguna**. Análisis DFS sobre los 48 archivos no-spec de `src/`: **cero ciclos a nivel
  archivo**.
- **Master bus (D-21), siempre aplicado y no deshabilitable.** `alimiter` con `level=disabled`
  (con el default `enabled` el filtro aplica *makeup gain* y **sube** el master hasta el techo,
  rompiendo D-E y D-F a la vez) y techo en
  `gainDbToVolume(truePeakDbtp − MASTER_BUS_TRUE_PEAK_MARGIN_DB)`, es decir **1 dB de margen de
  inter-sample**. Con `DEFAULT_VOICE_TARGET`:
  `alimiter=limit=0.794328235:attack=5:release=50:level=disabled`. No hay opción ni rama que lo
  desactive: `MixTimelineAudioOptions` sólo expone `ffmpegPath` y `runOptions`.
  `withMasterBusLimiter` es **pura**: devuelve un `FilterGraph` nuevo, no muta el recibido.
- **`MissingMediaStreamError`** (`code: 'MISSING_MEDIA_STREAM'`) — un solo error tipado para las dos
  direcciones, con `stream: 'audio' | 'video'` y mensaje distinto por cada una.
- **`measureLoudness` ganó `audioStreamSpecifier?`** (aditivo) y la constante interna
  `FIRST_AUDIO_STREAM = '0:a:0'`: la medición apunta explícitamente al primer stream de audio, así
  sirve igual para un WAV que para el contenedor de video que en el pipeline real trae la voz.
- **`smoke/` es un directorio nuevo, fuera de `src/`** (`smoke-audio.ts`, `smoke-register.cjs`), sin
  spec hermano porque ejecuta binarios. Target manual `media-local:smoke-audio`, autocontenido
  (genera sus propias señales con ffmpeg), **fuera de CI**. Sus salidas van a
  `libs/media-local/tmp/`.
- **`tsconfig.smoke.json` lleva `ignoreDeprecations: "6.0"`** junto a `baseUrl`: TS 6.0.3 deprecó
  `baseUrl` y este target sí invoca `tsc -p tsconfig.smoke.json --noEmit`. Es el fix mínimo.
- Cinco fixtures nuevas en `src/__fixtures__/ffmpeg/` (`loudnorm-mix-*.stderr.txt`) para los cinco
  casos de tolerancia.

## Dependencias

Ninguna nueva en el manifiesto. `ffmpeg` ≥ 6.0 y `ffprobe` siguen siendo requisito **sólo** de los
targets `smoke*`, manuales.

## Qué sigue

**API pública que `spec-e-burgos-005` consume de esta lib** — el orden de llamadas y la tabla de
errores están en `architect.md` §15 de este ciclo (`sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-02/architect.md`):

- `mixTimelineAudio` (+ `MixTimelineAudioOptions`, `MixTimelineAudioResult`)
- `verifyMixLoudness` (+ `MixLoudnessVerification`, `VerifyMixLoudnessOptions`) con
  `MIX_INTEGRATED_TOLERANCE_LU` (1 LU) y `MIX_TRUE_PEAK_TOLERANCE_DB` (0 dB)
- `muxAudioIntoVideo` (+ `MuxAudioIntoVideoOptions`, `MuxAudioIntoVideoResult`) con
  `MUX_AUDIO_CODEC` (`aac`) y `MUX_AUDIO_BITRATE` (`192k`)
- `MissingMediaStreamError` (+ `MissingStreamKind`)
- `MASTER_BUS_TRUE_PEAK_MARGIN_DB` — **único** símbolo del master bus en el barrel; está ahí porque
  es contrato observable: quien pida -1 dBTP y mida -2.1 tiene que poder entender por qué sin abrir
  el código.

De `libs/composition-remotion`, el paso 1 del pipeline: `renderTimeline` con `audio: 'muted'` y el
tipo `TimelineAudioMode`.

**Límite explícito:** `render → mix → mux` **en una sola llamada NO vive en esta lib** y no puede
vivir acá. Los boundaries Nx de `eslint.config.mjs` raíz (`type:util` → sólo `type:domain`) impiden
que `media-local` y `composition-remotion` se importen entre sí. Esa orquestación es de
**`spec-e-burgos-005`**, en `apps/render-api` (`type:app`), el único subproyecto que puede depender
de las dos.

**Master bus — lo que NO queda garantizado.** El limitador garantiza el **true peak** (`alimiter`,
`level=disabled`, 1 dB de margen de inter-sample). El **integrado del master** es voz+música y **no
se re-normaliza** (+0,2 LU con los defaults, más con cama fuerte): queda dentro de la tolerancia de
D-F y `verifyMixLoudness` lo mide y lo reporta, pero no está garantizado. Un **re-master de dos
pasadas sobre el bus completo**, si hiciera falta, es de `spec-005`, que es la dueña de la
orquestación. Nota fina: `alimiter` limita **sample peak**, y el true peak (dBTP, BS.1770, 4×
oversampling) siempre es ≥ — de ahí el margen de 1 dB.

**`gainDbToVolume` está duplicada a propósito** entre `src/mix/gain-db-to-volume.ts` y
`libs/composition-remotion/src/helpers/audio-gain.ts`: los mismos boundaries Nx impiden compartirla.
**La tabla de §7.2 de `cycle-01` es su contrato de paridad** — cualquier cambio en una obliga a
replicarlo en la otra, o el master deja de coincidir con el preview de Remotion (D-E).
