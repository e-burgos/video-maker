# SPEC-e-burgos-004: Multi-Track Audio Mix & Mastering

> Estado: **in-progress** — detallada por el sdd-orchestrator al abrir `cycle-01` (2026-09-08).

## Resumen Ejecutivo

Mezcla y mastering multi-pista del entregable final: normalización de la locución a **-14 LUFS /
-1 dBTP**, aplicación de la automatización de ducking del `AudioMixPlan` sobre la música
(**-24 dB** bajo la voz), construcción de filtergraphs FFmpeg tipados y testeables sin ejecutar el
binario, medición de verificación post-mix y mux final de la pista masterizada dentro del MP4 que
renderiza Remotion.

El contrato de datos ya existe y está cerrado: `AudioMixPlan` (`voice`, `music`, `automation`) vive
en `timeline.audioMix` desde `spec-e-burgos-001`, y `planDucking` ya produce los keyframes. Esta
spec **no diseña el plan: lo ejecuta**.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

El video sale hoy con audio "crudo": Remotion mezcla voz y música aplicando ganancia por frame
(`AudioTrack` + `volumeAtFrame`), pero **nadie mide nada**. Un Reel que no llega a -14 LUFS suena
notoriamente más bajo que el resto del feed —las plataformas normalizan hacia ese entorno— y un
true peak por encima de -1 dBTP clippea al recodificar. Sin esta spec el motor produce video
publicable y audio no publicable.

**Alcance previsto (del desglose inicial 2026-09-07):** filtergraph builder tipado y testeable sin
ffmpeg, medición post-mix (loudness de verificación), integración con `renderTimeline` para producir
el entregable final.

## Evidencia y decisiones

> No existe `harness.idea.md` en este repo (verificado 2026-09-08): la evidencia disponible es la
> cadena de specs, el código ya entregado y el contexto de las libs. Lo que sigue son **decisiones
> tomadas por el orquestador** al detallar esta spec, por delegación explícita del dev — no fueron
> aprobadas una por una.

- **Evidencia:** `libs/timeline-core/src/schemas/audio-mix-plan.schema.ts` — `VoiceTarget`
  (`integratedLufs: -14`, `truePeakDbtp: -1`, `loudnessRange: 11`), `MusicMixSettings`
  (`baseGainDb: -12`, `duckedGainDb: -24`, `attackMs: 150`, `releaseMs: 400`, `holdMs: 250`) y
  `GainKeyframe { frame, gainDb }` **ya están definidos y cerrados**. Los números del alcance
  previsto (-14 LUFS, -24 dB) son exactamente los defaults del schema.
- **Evidencia:** `libs/timeline-core/src/ducking/plan-ducking.ts` — `planDucking` ya devuelve
  `automation: GainKeyframe[]` determinista a partir de los rangos de voz. La curva de ducking
  **no se recalcula** en esta spec.
- **Evidencia:** `libs/media-local` ya entrega `measureLoudness` (loudnorm `print_format=json`),
  `buildLoudnormFilter` y `normalizeVoice` (dos pasadas, `-ar 48000`), con `DEFAULT_VOICE_TARGET`
  idéntico al del schema. La normalización de voz **existe**: esta spec la usa, no la reescribe.
- **Evidencia:** `libs/composition-remotion/src/helpers/audio-gain.ts` — `volumeAtFrame` interpola
  los keyframes **linealmente en dB** y `gainDbToVolume` clampea a `[0,1]`. Es la curva que ve el
  preview; el master tiene que coincidir con ella.
- **Evidencia:** `sdd/context/libs/media-local/updates/2026-09-07-*-cycle-02.md` — todo I/O entra
  por puerto inyectable (`CommandRunner`, `Clock`, `ReadTextFile`, `BinaryLookup`), ESLint prohíbe
  `child_process`/`execa`/`node:fs` fuera de sus directorios, y la suite corre **sin un solo
  binario**. Cobertura heredada: 98.03 % stmts / 94.77 % ramas.
- **Evidencia:** `eslint.config.mjs` raíz (protegido por hook) fija boundaries Nx:
  `type:util` (media-local) y `type:ui` (composition-remotion) solo pueden depender de
  `type:domain`. **Ninguna de las dos libs puede importar a la otra.** Es la restricción que más
  condiciona el diseño de esta spec (ver D-G).
- **Evidencia:** `FIX-e-burgos-001-001` (2026-09-08) dejó operativo
  `nx run composition-remotion:smoke` — el único camino a un render real. Antes de este fix la
  verificación end-to-end de audio no era posible.

### Decisiones del orquestador (inventadas — 2026-09-08)

- **D-A — El contrato `Timeline` no se toca.** `timeline-core` pertenece a una spec `completed` y
  su `AudioMixPlan` ya cubre todo lo que esta spec necesita. Cualquier parámetro nuevo entra como
  opción de función con default, nunca como campo del schema.
- **D-B — El master lo hace FFmpeg, no Remotion; el video se renderiza sin audio.** Remotion aplica
  ganancia por frame pero no mide ni corrige LUFS/true-peak (no hay `loudnorm` en el browser). El
  entregable final es un pipeline de tres pasos: (1) Remotion renderiza **video mudo**, (2) FFmpeg
  construye la pista masterizada desde los assets originales aplicando el `AudioMixPlan`,
  (3) mux con `-c:v copy`. Beneficio adicional: re-masterizar no obliga a re-renderizar frames.
  `AudioTrack` de Remotion **se conserva** — es el preview del `Player`/`studio`, no el entregable.
- **D-C — Ducking por automatización de volumen, NO por `sidechaincompress`.** El alcance previsto
  admitía las dos. Se elige la automatización porque `planDucking` ya produce los keyframes de forma
  determinista: el master queda reproducible desde el plan, testeable sin ejecutar ffmpeg y
  **frame-idéntico al preview de Remotion**, que usa esos mismos keyframes vía `volumeAtFrame`.
  `sidechaincompress` es adaptativo: su resultado no se deriva del plan, divergiría del preview y
  solo se podría verificar ejecutando el binario. Queda documentado como alternativa descartada.
- **D-D — El filtergraph es un dato tipado, no un string suelto.** El builder devuelve una
  estructura (`FilterGraph { inputs, chains, outputLabel }`) y un serializador aparte produce el
  `-filter_complex`. Permite testear la estructura con `toEqual` y el string exacto por separado,
  igual que el par wrapper/parser que ya usa la lib.
- **D-E — Paridad de curva verificada por test, no por comentario.** La expresión `volume` generada
  debe evaluar, en cada keyframe y en puntos intermedios, el **mismo** valor que `volumeAtFrame` de
  `composition-remotion` (interpolación lineal en dB, clamp a `[0,1]`, extensión plana antes del
  primer y después del último keyframe). Como las libs no pueden importarse entre sí (D-G), la
  paridad se fija con una tabla de valores esperados replicada en el spec de `media-local` y una
  nota cruzada en ambos READMEs.
- **D-F — La verificación de loudness es parte del entregable, no un extra.** "Normalizado a -14
  LUFS" sin medición posterior no es verificable. Tolerancias declaradas: **integrated -14 ±1.0 LU**,
  **true peak ≤ -1.0 dBTP** (sin tolerancia hacia arriba), LRA informativo. Fuera de tolerancia no
  lanza: devuelve un resultado tipado con los deltas y quien lo consuma decide.
- **D-G — El cableado end-to-end NO vive en ninguna de las dos libs.** Los boundaries Nx impiden que
  `media-local` (`type:util`) y `composition-remotion` (`type:ui`) se importen, y
  `eslint.config.mjs` raíz está protegido por hook: relajar la regla sería un cambio de arquitectura
  fuera del alcance de esta spec. Por lo tanto esta spec entrega **los bloques** — mix + verificación
  + mux en `media-local`, render mudo en `composition-remotion` — más un smoke real y
  autocontenido en `media-local`. El pegado `render → mix → mux` se documenta como procedimiento en
  ambos READMEs y lo implementa **`spec-e-burgos-005` (render-service)**, que sí puede depender de
  las dos libs. Esta spec deja el pendiente escrito.
- **D-H — Formato del master:** WAV `pcm_s16le` 48 kHz estéreo como intermedio (sin pérdida, así la
  medición de verificación mide el mix y no el codec) y **AAC 192 kbps** en el mux final. `-ar 48000`
  ya es el default de `normalizeVoice`.
- **D-J — Correcciones al detalle de la spec, verificadas contra el código (2026-09-08).** El
  arquitecto de `cycle-01` contrastó los RF con `plan-ducking.ts`, `build-timeline.ts` y
  `audio-track.tsx` y encontró cinco puntos donde el borrador de esta spec no describía el sistema
  real. Se corrigen acá; la spec manda sobre el borrador:
  1. **Los keyframes de `planDucking` son ganancias ABSOLUTAS, no un delta.** En reposo valen
     exactamente `baseGainDb` y `audio-track.tsx` usa la curva **en lugar de** `clip.volume`, no
     encima. Aplicar `baseGainDb` y después la automatización dejaría el master 12 dB por debajo
     del preview — exactamente lo que D-E prohíbe. Un solo nodo de ganancia.
  2. `framesToMs` no sirve para la expresión (redondea a ms enteros); se usa `frame / fps` exacto.
  3. `audioMixFfmpegArgs` recibe `(graph, outputPath)`: las entradas ya viven en el grafo.
  4. La ganancia estática de la música sale de `clip.gainDb` (`buildTimeline` ya resuelve
     `music.gainDb ?? baseGainDb`), no de `plan.music.baseGainDb`.
  5. El filtro `volume` de FFmpeg no tiene modo "por muestra": solo `eval=once|frame`. Se usa
     `eval=frame`.
  6. **La paridad de D-E se promete para la curva de ducking de la música, no para el nivel
     absoluto de la voz.** `buildTimeline` crea los clips de voz con `gainDb: 0` y el master los
     normaliza con `loudnorm`; el preview de Remotion no tiene `loudnorm`, así que su nivel de voz
     nunca fue el del master. Se documenta en los READMEs (RF-11).
- **D-I — Dos ciclos.** `cycle-01` = builders puros (filtergraph, automatización, argumentos), cero
  ejecución. `cycle-02` = ejecución con `CommandRunner`, verificación post-mix, mux, opción de render
  mudo y smoke real. Razón: la lib mide cobertura sobre todo `src/**` con piso alto (98 %/94.8 %);
  concentrar la lógica en funciones puras en `cycle-01` mantiene ese piso y deja a `cycle-02` como
  wrappers finos, que es el patrón ya establecido en la lib.

## Requisitos Funcionales (RF)

### Ciclo 01 — Filtergraph builder y argumentos (libs/media-local, sin ejecutar ffmpeg)

- **RF-1:** `buildGainAutomationExpression(automation, fps)` traduce `GainKeyframe[]` a una expresión
  FFmpeg de `volume` con `eval=frame`, interpolación **lineal en dB** entre keyframes, valor plano
  antes del primero y después del último, y clamp del factor lineal a `[0,1]`. Con `automation`
  vacío devuelve la identidad (`volume=1`). Los frames se convierten a segundos como `frame / fps`
  **exacto**: `framesToMs` redondea a milisegundos enteros y ese redondeo introduce un error de
  ~4e-3 en el factor lineal sobre la rampa de ataque, 3.700× la tolerancia de CA-002 (corrección
  D-J.2). `framesToMs` sigue usándose para el `adelay`, donde la unidad es el milisegundo.
- **RF-2:** `buildMusicBedChain(plan, opts)` arma la cadena de la música con **un único nodo de
  ganancia**: la automatización de ducking (RF-1) cuando `plan.automation` no está vacío, o una
  ganancia constante derivada de `clip.gainDb` cuando sí lo está — **nunca las dos** (corrección
  D-J.1). Después, `afade` in/out según `fadeInFrames`/`fadeOutFrames` del `AudioClip` y
  `atrim`/`apad` al largo exacto del video en frames.
- **RF-3:** `buildVoiceChain(target, measured?)` arma la cadena de la voz: `loudnorm` reusando
  `buildLoudnormFilter` (primera pasada sin `measured`, segunda con las mediciones) +
  `aresample=48000`. No duplica la lógica de `normalizeVoice`.
- **RF-4:** `buildAudioMixGraph(spec)` compone el `FilterGraph` completo: una entrada por
  `AudioClip` de `tracks.voice` y `tracks.music`, `atrim` por `trimStartMs`, `adelay` por `from`,
  las cadenas de RF-2/RF-3, `amix` con `normalize=0` y etiqueta de salida única. Valida su entrada
  con Zod y lanza un error tipado si un `assetId` no resuelve a un asset.
- **RF-5:** `serializeFilterGraph(graph)` produce el string `-filter_complex` exacto, y
  `audioMixFfmpegArgs(graph, outputPath)` el arreglo completo de argumentos ffmpeg. Las entradas
  viajan dentro del `FilterGraph` y no se pasan por separado: duplicarlas permitiría desordenarlas
  en silencio, y el formato de salida lo fija D-H, así que no hay `opts` (corrección D-J.3). Ambas
  puras. Nada de este ciclo ejecuta un binario.

### Ciclo 02 — Ejecución, verificación, mux y render mudo

- **RF-6:** `mixTimelineAudio(timeline, out, runner, opts?)` (media-local) ejecuta el mix: mide la
  voz por **asset distinto** (no por clip), arma el grafo con esas mediciones (RF-4), le **agrega la
  etapa de master bus** de D-K y produce el WAV masterizado. Devuelve
  `{ outputPath, filterComplex, voiceMeasured, args }`. No recibe `assets` por separado:
  `Timeline.assets` ya los lleva y `buildAudioMixGraph` resuelve solo contra ellos — un canal
  paralelo permitiría desincronizarlos (misma razón que D-J.3).
- **RF-7:** `verifyMixLoudness(path, target, runner, opts)` mide el resultado con `measureLoudness`
  y devuelve `{ measured, withinTolerance, integratedDeltaLu, truePeakDeltaDb }` según las
  tolerancias de D-F. No lanza por estar fuera de tolerancia; sí por fallo del binario.
- **RF-8:** `muxAudioIntoVideo(videoPath, audioPath, out, runner, opts)` produce el MP4 final con
  `-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest`. Error tipado si el video de
  entrada no tiene stream de video.
- **RF-9:** `renderTimeline` (composition-remotion) acepta `audio?: 'mix' | 'muted'` con default
  `'mix'` (comportamiento actual intacto). Con `'muted'`, `TimelineComposition` no monta
  `AudioTrack`. Cambio **aditivo**: ningún consumidor existente se rompe.
- **RF-10:** Target manual `media-local:smoke-audio`, autocontenido: genera con ffmpeg sus propias
  señales de prueba (voz sintética + música), corre RF-6/RF-7/RF-8 y **imprime los LUFS medidos**
  del entregable. Fuera de CI, igual que el resto de los smokes del repo.
- **RF-11:** Ambos READMEs documentan el procedimiento `render mudo → mix → mux → verificación`
  como pasos manuales encadenados, señalando explícitamente que el cableado programático es de
  `spec-e-burgos-005` (D-G).

## Requisitos No-Funcionales (RNF)

- **RNF-1 — Cero binarios en la suite.** Ningún `*.spec.ts` de ninguna de las dos libs ejecuta
  ffmpeg, ffprobe ni Chrome. Toda ejecución se prueba con `FixtureCommandRunner` y dobles, igual que
  el resto de `media-local`. Los binarios reales solo corren en los targets `smoke*`, manuales.
- **RNF-2 — Cobertura sin regresión.** `media-local` ≥ **98.03 % statements / 94.77 % ramas**;
  `composition-remotion` ≥ **96.77 % statements / 93.16 % ramas**. Un ciclo que baje cualquiera de
  los cuatro números no cierra.
- **RNF-3 — Puertos inyectables.** Nada instancia I/O por dentro: `CommandRunner` sigue siendo
  argumento obligatorio de todo wrapper nuevo; las rutas de binarios se resuelven con
  `resolveBinary`/`resolveBinaries`.
- **RNF-4 — Determinismo.** Dado el mismo `AudioMixPlan` y los mismos assets, el filtergraph
  generado es byte-idéntico. Sin `Date`, sin `Math.random`, sin `process` en producción.
- **RNF-5 — Sin comentarios en el código** (regla ✍️ del repo); identificadores y docs técnicos en
  inglés; API pública solo por el barrel de cada lib.
- **RNF-6 — No se toca `eslint.config.mjs` raíz** ni ninguna config protegida por hook. Si un
  requisito pareciera exigirlo, se replantea el diseño (es lo que motiva D-G).

## Dependencias

- Subproyectos: `libs/media-local`, `libs/composition-remotion`
- `spec-e-burgos-001-core-composition-media-pipeline` (`completed`) — `AudioMixPlan`, `planDucking`,
  `measureLoudness`, `normalizeVoice`, `buildLoudnormFilter`, `renderTimeline`
- Binario externo: `ffmpeg` ≥ 6.0 (solo en los targets `smoke*`)
- Sin dependencias npm nuevas previstas

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** `buildGainAutomationExpression` con `automation: []` devuelve la identidad y no
  aparece ningún `volume` redundante en el grafo.
- **CA-002:** Para la automatización que produce `planDucking` con `DEFAULT_AUDIO_MIX_PLAN`, la
  expresión generada evalúa —en cada keyframe y en dos puntos intermedios por tramo— el mismo factor
  lineal que `volumeAtFrame` de `composition-remotion`, con tolerancia `1e-6` (tabla fijada en el
  spec, D-E).
- **CA-003:** `buildMusicBedChain` emite **un solo** nodo de ganancia — la automatización cuando
  `plan.automation` no está vacío, la constante de `clip.gainDb` cuando sí — y nunca los dos
  encadenados; respeta `fadeInFrames`/`fadeOutFrames` del clip y con ambos ausentes no emite
  `afade`.
- **CA-004:** `buildVoiceChain` sin `measured` produce el filtro de primera pasada y con `measured`
  el de segunda, delegando en `buildLoudnormFilter` (verificado por igualdad con su salida directa).
- **CA-005:** `buildAudioMixGraph` sobre una `Timeline` real construida con `buildTimeline` produce
  un grafo con una entrada por clip de voz y música, `adelay` igual al `from` en ms, y una única
  etiqueta de salida; un `assetId` inexistente lanza el error tipado con el id en el mensaje.
- **CA-006:** `serializeFilterGraph` produce un `-filter_complex` que `toEqual` una cadena esperada
  fijada en el spec, y `audioMixFfmpegArgs` el arreglo completo de argumentos, sin ejecutar ffmpeg.
- **CA-007:** `pnpm nx run-many -t lint test build --projects=media-local` en verde con cobertura
  ≥ 98.03 % / 94.77 % (RNF-2).

### Ciclo 02

- **CA-008:** `mixTimelineAudio` con `FixtureCommandRunner` ejecuta **N+1** invocaciones de ffmpeg
  —una medición por asset de voz distinto, más el mix— con los argumentos que produce
  `audioMixFfmpegArgs`, y propaga `CommandFailedError` con el `stderr` truncado si el binario falla.
  **En toda `Timeline` construida con `buildTimeline`, `N` es 1 por construcción** (un EDL tiene un
  solo `sourceAssetId` y `buildVoiceTrack` lo copia a todos los clips de voz), así que en el
  pipeline real son exactamente dos; el test cubre igual el caso general con dos assets de voz.
- **CA-009:** `verifyMixLoudness` devuelve `withinTolerance: true` para una medición dentro de
  -14 ±1.0 LU con true peak ≤ -1.0 dBTP, y `false` con los deltas correctos fuera de ese rango, en
  los cuatro casos borde. No lanza en ninguno.
- **CA-010:** `muxAudioIntoVideo` arma los argumentos exactos de D-H y no reencodea el video
  (`-c:v copy` presente, verificado sobre los args).
- **CA-011:** `renderTimeline(timeline, { audio: 'muted' })` pasa la prop a la composición y
  `TimelineComposition` no monta `AudioTrack`; sin la opción, el comportamiento actual queda
  idéntico (test de no-regresión).
- **CA-012:** `pnpm nx run media-local:smoke-audio` produce el MP4 final e imprime una medición
  integrada dentro de -14 ±1.0 LU y true peak ≤ -1.0 dBTP sobre las señales de prueba generadas.
  Manual, fuera de CI.
- **CA-013:** Ambos READMEs documentan el procedimiento encadenado y el pendiente de `spec-005`
  (RF-11, D-G).
- **CA-014:** `pnpm nx run-many -t lint test build --projects=media-local,composition-remotion` en
  verde con cobertura ≥ los cuatro pisos de RNF-2.

- **D-K — Etapa de master bus: limitador de true peak (2026-09-08).** El arquitecto de `cycle-02`
  detectó que el grafo de `cycle-01` **no tiene nada después del `amix`**: `loudnorm` se aplica por
  clip de voz y la música se suma en paralelo con `normalize=0`, así que el true peak del master
  puede superar `-1 dBTP` aunque cada clip esté limitado — escenario realista con voz real (crest
  factor 12–18 dB), no con las sinusoides del smoke. Sin corregirlo, `-1 dBTP` sería un objetivo
  medido y no una garantía, y el entregable clippearía al recodificar: justo el problema que esta
  spec existe para resolver.
  **Corrección:** `mixTimelineAudio` **agrega** al `FilterGraph` una cadena de master bus —un
  limitador al `truePeakDbtp` del `AudioMixPlan`— entre el `outputLabel` de `buildAudioMixGraph` y
  la salida real. Es **aditivo sobre el dato**: `buildAudioMixGraph`, `serializeFilterGraph` y sus
  fixtures exactas de `cycle-01` **no se tocan** (esa capa está cerrada y sus contratos son fijos);
  el grafo es una estructura y `cycle-02` le apendea una cadena antes de serializarlo.
  **Lo que sigue sin garantizarse:** el **integrado** del master es voz+música y no se re-normaliza
  (+0,2 LU con los defaults, más con cama fuerte). Queda dentro de la tolerancia de D-F y
  `verifyMixLoudness` lo mide y lo reporta. Un re-master de dos pasadas sobre el bus completo, si
  hiciera falta, pertenece a `spec-e-burgos-005`, que es la dueña de la orquestación.

## Fuera de alcance

- Cableado programático `render → mix → mux` en una sola llamada. **`spec-e-burgos-004` entrega los
  filtergraphs, el mix, la verificación de loudness y el mux como funciones de `libs/media-local`, y
  la integración de audio (render mudo) en `libs/composition-remotion`; la orquestación
  `render → mix → mux` en una sola llamada es entrada OBLIGATORIA de `spec-e-burgos-005`
  (`apps/render-api`, `type:app`), que es el único subproyecto que puede depender de ambas libs
  sin tocar los boundaries Nx del `eslint.config.mjs` raíz** (ver D-G).
- `sidechaincompress` y cualquier ducking adaptativo (D-C).
- Cambios al `AudioMixPlan`, a `planDucking` o a cualquier schema de `timeline-core` (D-A).
- Efectos de audio más allá de ganancia, fades y loudnorm: EQ, de-esser, compresión de voz,
  reducción de ruido.
- Música generada o licenciada, y cualquier búsqueda de assets de audio.
- Mezcla de más de dos pistas lógicas (voz + música). SFX es material de una spec futura.
