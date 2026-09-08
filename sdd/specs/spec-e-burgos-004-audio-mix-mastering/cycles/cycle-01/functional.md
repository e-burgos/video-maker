# Functional — Cycle 1: Filtergraph builder y argumentos (media-local)

> **Input:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El video que produce hoy el motor sale publicable; el audio no. Remotion mezcla voz y música
aplicando ganancia por frame (`AudioTrack` + `volumeAtFrame`), pero nadie mide loudness ni true
peak: un Reel que no llega a -14 LUFS suena notoriamente más bajo que el resto del feed, y un true
peak por encima de -1 dBTP clippea al recodificar. El plan de mezcla que resuelve esto —
`AudioMixPlan`, con la automatización de ducking ya calculada por `planDucking`— **ya existe** y
está cerrado desde `spec-e-burgos-001`. Lo que falta es traducir ese plan a algo que un binario de
audio pueda ejecutar.

**Este ciclo NO produce un solo sample de audio publicable.** No ejecuta `ffmpeg`, no mide LUFS, no
mezcla nada de verdad. Entrega cinco funciones puras que traducen un `AudioMixPlan` ya resuelto a
un `FilterGraph` FFmpeg tipado y a los argumentos de invocación exactos. El valor de negocio para el
creador de contenido —el audio a -14 LUFS / -1 dBTP que finalmente suena bien en el feed— recién se
materializa en `cycle-02`, cuando ese `FilterGraph` se ejecuta contra un `CommandRunner` real y su
resultado se mide con `verifyMixLoudness`.

Cortar el trabajo exactamente acá, antes de tocar un binario, tiene una razón concreta y no es
burocracia de proceso: **la lógica de traducción del plan a filtergraph es donde vive el riesgo real
de error**, y es la única parte de todo el pipeline que se puede testear al 100% sin depender de
`ffmpeg` instalado, sin fixtures reconstruidas a mano y sin flakiness de proceso externo. Un error de
signo en la interpolación de ganancia, un `adelay` calculado con el `from` equivocado o un `amix` sin
`normalize=0` no se descubren corriendo el binario una vez: se descubren con un test unitario que
compara una estructura de datos contra un valor esperado. Concentrar ese riesgo aquí, en funciones
puras y deterministas, es lo que permite que `cycle-02` sea un wrapper fino —el patrón que ya usa
toda la lib— en vez de otra pieza de lógica compleja mezclada con ejecución de proceso.

**El consumidor real de esta capa no es el creador de contenido: es código.** Quien invoca
`buildGainAutomationExpression`, `buildMusicBedChain`, `buildVoiceChain`, `buildAudioMixGraph`,
`serializeFilterGraph` y `audioMixFfmpegArgs` es la función `mixTimelineAudio` que `cycle-02` va a
escribir en esta misma lib, y más adelante el código de orquestación `render → mix → mux` que
`spec-e-burgos-005` (`apps/render-api`) tiene como entrada obligatoria. Las historias de este
documento están redactadas desde ese consumidor, no desde el creador: el valor para el creador ya
está descripto en `spec-e-burgos-001` y en el resumen ejecutivo de esta spec, y no se repite acá.

Un requisito de negocio que atraviesa todo el ciclo, y que no es un detalle técnico aunque se
verifique con un test numérico: **el master tiene que sonar igual que el preview.** El creador ya
escuchó su ducking de música funcionando en el `Player` de Remotion, porque `volumeAtFrame` interpola
esos mismos keyframes ahí. Si la expresión FFmpeg que arma este ciclo evaluara una curva distinta, el
entregable final sonaría distinto de lo que el creador aprobó al editar — el preview le habría
mentido. Por eso la paridad numérica con `volumeAtFrame` (CA-002) es una historia de usuario propia
en este documento (HU-1-06), no un CA subordinado a la expresión de ganancia.

---

## Historias de usuario

### HU-1-01: Traducir la automatización de ducking a una expresión de ganancia que FFmpeg pueda evaluar

**Como** código que en `cycle-02` va a ejecutar el mix de audio (`mixTimelineAudio`)
**Quiero** convertir la lista de keyframes de ganancia del `AudioMixPlan` en una expresión FFmpeg de
`volume` evaluada por muestra
**Para** poder automatizar el ducking de la música sin recalcular la curva ni depender de que
`ffmpeg` la interpole por su cuenta

**Criterios de aceptación:**

- [ ] CA-1: Con `automation` vacío obtengo la expresión identidad (`volume=1`) y ningún nodo `volume`
      redundante aparece en ningún filtergraph que use esta función (referencia técnica: CA-001)
- [ ] CA-2: Entre dos keyframes, la ganancia intermedia que evalúa la expresión es el resultado de
      interpolar linealmente en dB (no en amplitud) y convertir recién al final a factor lineal,
      clampeado a `[0,1]`; antes del primer keyframe y después del último, el valor es plano (igual
      al del keyframe extremo correspondiente) (referencia técnica: RF-1, sin CA numerado propio más
      allá de CA-001; el comportamiento en rango se verifica junto con la paridad de HU-1-06)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-02: Armar la cadena completa de la música con ducking, fades y largo exacto

**Como** código que en `cycle-02` va a ejecutar el mix de audio
**Quiero** que la cadena de filtros de la música aplique primero `baseGainDb`, después la
automatización de ducking, después los fades de entrada/salida del clip y por último lo recorte o
rellene al largo exacto del video
**Para** no tener que repetir ese orden de operaciones cada vez que arme el filtergraph completo, y
para que el resultado sea siempre el mismo dado el mismo `AudioClip` y el mismo `AudioMixPlan`

**Criterios de aceptación:**

- [ ] CA-3: La cadena generada aplica `baseGainDb` antes que la automatización de ducking (el orden
      importa: ganancia base primero, ducking encima), y solo incluye `afade` de entrada/salida
      cuando el clip trae `fadeInFrames`/`fadeOutFrames`; con ambos ausentes, la cadena no tiene
      ningún `afade` (referencia técnica: CA-003)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-03: Armar la cadena de voz reusando el cálculo de loudnorm que ya existe

**Como** código que en `cycle-02` va a ejecutar el mix de audio
**Quiero** que la cadena de filtros de la voz arme el `loudnorm` de primera y de segunda pasada
delegando en `buildLoudnormFilter` (ya existente en la lib) y agregue el resampleo a 48 kHz
**Para** no duplicar la lógica de normalización de voz que `normalizeVoice` ya usa, y que ambas
piezas de la lib se mantengan consistentes entre sí sin código repetido

**Criterios de aceptación:**

- [ ] CA-4: Sin medición previa, el segmento `loudnorm` de la cadena es igual —comparado por
      igualdad de string, no reimplementado— al que devuelve `buildLoudnormFilter` llamado
      directamente sin `measured`; con medición, es igual al que devuelve `buildLoudnormFilter`
      llamado con esos mismos `measured` (referencia técnica: CA-004)

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-04: Componer el filtergraph completo de la mezcla a partir de la Timeline

**Como** código que en `cycle-02` va a ejecutar el mix de audio
**Quiero** componer, a partir de una `Timeline` real, un `FilterGraph` con una entrada por cada
`AudioClip` de voz y de música, cada una recortada y retrasada en el tiempo que le corresponde, las
cadenas de voz y música ya resueltas, y una mezcla final con una única salida
**Para** tener una sola función que arme el grafo completo del mix sin tener que orquestar a mano el
orden de `atrim`, `adelay`, las cadenas de voz/música y el `amix` final

**Criterios de aceptación:**

- [ ] CA-5: Construyendo una `Timeline` real con `buildTimeline` (de `timeline-core`), el grafo
      resultante tiene una entrada por cada clip de voz y de música, el `adelay` de cada entrada es
      exactamente el `from` de su clip convertido a milisegundos, y hay una única etiqueta de salida
      para todo el grafo; si algún `assetId` de un clip de audio no resuelve a un asset declarado en
      la `Timeline`, la función lanza un error tipado que incluye ese id en el mensaje, en vez de
      producir un grafo incompleto o silenciosamente incorrecto (referencia técnica: CA-005)

**Prioridad:** Alta
**Estimación:** L

---

### HU-1-05: Convertir el filtergraph tipado en el string y los argumentos exactos que espera FFmpeg

**Como** código que en `cycle-02` va a ejecutar el mix de audio
**Quiero** convertir el `FilterGraph` tipado en el string `-filter_complex` exacto y en el arreglo
completo de argumentos de invocación de `ffmpeg`
**Para** que la única responsabilidad de `cycle-02` sea pasarle ese arreglo a un `CommandRunner` real,
sin tener que construir ni un carácter de esos argumentos a mano

**Criterios de aceptación:**

- [ ] CA-6: Para un `FilterGraph` fijo, `serializeFilterGraph` produce un string `-filter_complex`
      igual —por igualdad exacta— a uno esperado documentado en la spec, y `audioMixFfmpegArgs`
      produce el arreglo completo de argumentos ffmpeg correspondiente, sin que ninguna de las dos
      funciones ejecute el binario (referencia técnica: CA-006)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-06: Que el master suene exactamente igual que lo que el creador ya escuchó en el preview

**Como** código que en `cycle-02` va a ejecutar el mix de audio, y por extensión el creador que
confía en lo que escuchó en el `Player` de Remotion antes de exportar
**Quiero** que la expresión de ganancia que arma `buildGainAutomationExpression` evalúe, en cada
keyframe y en los puntos intermedios de la curva, exactamente el mismo factor de volumen que
`volumeAtFrame` de `composition-remotion` calcula para ese mismo frame
**Para** que el entregable final no sea una mezcla distinta de la que el creador ya aprobó al editar:
si el master sonara distinto del preview, el preview le habría mentido, y esto no es un detalle de
implementación sino la promesa de negocio de "lo que escuchás es lo que se publica"

**Criterios de aceptación:**

- [ ] CA-7 (CA-002 de la spec): Para la automatización que produce `planDucking` con
      `DEFAULT_AUDIO_MIX_PLAN`, la expresión generada evalúa —en cada keyframe y en dos puntos
      intermedios por tramo— el mismo factor lineal que `volumeAtFrame` de `composition-remotion`,
      con tolerancia `1e-6` sobre una tabla de valores esperados fijada en la spec (referencia
      técnica: CA-002, D-E)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-07: Confiar en que toda esta traducción se verifica sin instalar ni ejecutar ffmpeg

**Como** desarrollador que integra `libs/media-local` en `cycle-02` y, más adelante, en
`spec-e-burgos-005`
**Quiero** que las cinco funciones de este ciclo, y la paridad de curva con el preview, se verifiquen
con pruebas automatizadas comunes que no ejecutan ningún binario, y que la cobertura heredada de la
lib no baje
**Para** poder confiar en esta capa en cualquier entorno —incluida la integración continua del
repositorio— sin depender de que `ffmpeg` esté instalado ni de que un proceso externo responda a
tiempo

**Criterios de aceptación:**

- [ ] CA-8 (CA-007 de la spec): `pnpm nx run-many -t lint test build --projects=media-local` termina
      en verde con cobertura ≥ 98.03% statements / 94.77% ramas, sin que ningún `*.spec.ts` nuevo de
      este ciclo invoque un binario real (referencia técnica: CA-007, RNF-1, RNF-2)

**Prioridad:** Alta
**Estimación:** S

---

## Requisitos funcionales

### RF-1-01: Expresión FFmpeg de automatización de ganancia (RF-1 de la spec)

**Descripción:** `buildGainAutomationExpression` traduce una lista de `GainKeyframe` (cada uno con
`frame` y `gainDb`) a una expresión FFmpeg de `volume` evaluada por muestra, usando el `fps` de la
`Timeline` para convertir frames a segundos (vía `framesToMs` de `timeline-core`).

**Reglas de negocio:**

- RN-1: la interpolación entre dos keyframes consecutivos se calcula **en dB**, nunca en amplitud
  lineal; la conversión de dB a factor lineal ocurre después de interpolar, no antes.
- RN-2: el factor lineal resultante de esa conversión se clampea a `[0,1]` (nunca amplifica por
  encima de 1, nunca es negativo).
- RN-3: antes del primer keyframe y después del último, el valor de ganancia es plano: igual al del
  keyframe extremo correspondiente, sin extrapolar la pendiente del tramo más cercano.
- RN-4: con `automation` vacío, la expresión resultante es la identidad (`volume=1`): un
  `AudioMixPlan` sin ducking no debe insertar ningún nodo de automatización en el grafo.

**Casos de error:**

- CE-1: no aplica un caso de error de negocio propio; el dominio de entrada (frames enteros no
  negativos y ganancias en dB) no tiene estados que ameriten lanzar — un `automation` mal ordenado o
  con frames repetidos es responsabilidad de quien produce el `AudioMixPlan` (`planDucking`,
  `timeline-core`, fuera de alcance de este ciclo, ver D-A).

---

### RF-1-02: Cadena de filtros de la música (RF-2 de la spec)

**Descripción:** `buildMusicBedChain` arma, para un `AudioClip` de música y su `AudioMixPlan`, la
cadena completa: ganancia base → automatización de ducking (RF-1-01) → fades de entrada/salida →
ajuste de largo al video.

**Reglas de negocio:**

- RN-5: `baseGainDb` se aplica **antes** que la automatización de ducking (RF-1-01); el orden es
  fijo y no se invierte según los valores del plan.
- RN-6: `afade` de entrada se emite solo si el clip trae `fadeInFrames`, y `afade` de salida solo si
  trae `fadeOutFrames`; con ambos ausentes, la cadena no emite ningún `afade`.
- RN-7: la cadena recorta o rellena (`atrim`/`apad`) la música al largo exacto del video en frames,
  sin dejar la música más corta ni más larga que el video.

**Casos de error:**

- CE-2: no aplica un caso de error de negocio propio; opera sobre un `AudioClip` y un `AudioMixPlan`
  ya validados por quien los produce (RF-1-04 es quien valida la entrada completa con Zod).

---

### RF-1-03: Cadena de filtros de la voz (RF-3 de la spec)

**Descripción:** `buildVoiceChain` arma, para un `VoiceTarget` y una medición opcional, la cadena de
`loudnorm` (primera pasada sin medición, segunda pasada con medición) más `aresample=48000`,
delegando el segmento `loudnorm` en `buildLoudnormFilter` ya existente en la lib.

**Reglas de negocio:**

- RN-8: sin `measured`, la cadena usa el `loudnorm` de primera pasada; con `measured`, usa el de
  segunda pasada — la elección de pasada depende únicamente de si se recibió medición, no de otro
  parámetro.
- RN-9: el segmento `loudnorm` de la cadena nunca reimplementa el cálculo de `buildLoudnormFilter`:
  siempre delega en esa función existente, para las dos pasadas.

**Casos de error:**

- CE-3: no aplica un caso de error de negocio propio; `buildLoudnormFilter` ya es una función pura
  sin estados de error y esta cadena no le agrega ninguno.

---

### RF-1-04: Filtergraph completo de la mezcla (RF-4 de la spec)

**Descripción:** `buildAudioMixGraph` compone el `FilterGraph` completo a partir de una `Timeline`:
una entrada por cada `AudioClip` de `tracks.voice` y `tracks.music`, recorte (`atrim` por
`trimStartMs`) y retraso (`adelay` por `from`) de cada entrada, las cadenas de RF-1-02/RF-1-03, y un
`amix` final con `normalize=0` (para no perder el balance de ganancia ya calculado) con una única
etiqueta de salida.

**Reglas de negocio:**

- RN-10: la entrada valida su forma con Zod antes de componer el grafo.
- RN-11: cada `AudioClip` de voz y de música produce exactamente una entrada del grafo; el `adelay`
  de esa entrada es el `from` del clip convertido a milisegundos.
- RN-12: el `amix` final usa `normalize=0`: la función no debe dejar que `ffmpeg` renormalice
  automáticamente las ganancias que ya resolvieron RF-1-02/RF-1-03.

**Casos de error:**

- CE-4: si el `assetId` de algún `AudioClip` de voz o música no resuelve a un asset declarado en
  `Timeline.assets`, la función lanza un **error tipado nuevo**, que debe sumarse a la jerarquía
  existente de `MediaLocalError` (junto a `BinaryNotFoundError`, `CommandFailedError`,
  `UnparseableOutputError`), con el `assetId` no resuelto incluido en el mensaje. Es la única
  condición de error de negocio de todo el ciclo 01; su nombre y ubicación exacta en el árbol de
  clases quedan a criterio del Arquitecto.

---

### RF-1-05: Serialización a string y argumentos de FFmpeg (RF-5 de la spec)

**Descripción:** `serializeFilterGraph` convierte el `FilterGraph` tipado en el string
`-filter_complex` exacto que espera `ffmpeg`; `audioMixFfmpegArgs` arma el arreglo completo de
argumentos de invocación (inputs, `-filter_complex`, mapeo de salida, ruta de salida). Ninguna de
las dos ejecuta el binario.

**Reglas de negocio:**

- RN-13: dado el mismo `FilterGraph`, `serializeFilterGraph` produce siempre el mismo string —
  determinismo byte a byte, sin depender de orden de iteración no determinista de ningún tipo de
  dato interno.
- RN-14: `audioMixFfmpegArgs` reusa el string de `serializeFilterGraph` tal cual, sin volver a
  construir el `-filter_complex` por su cuenta.

**Casos de error:**

- CE-5: no aplica un caso de error de negocio propio; serializar un `FilterGraph` ya válido (por
  construcción, producto de RF-1-04) es una transformación de datos sin estados inválidos.

---

## Cómo se verifica cada CA-001..CA-007 de la spec

| CA de la spec | Qué se compara | Contra qué |
| --- | --- | --- |
| **CA-001** | Salida de `buildGainAutomationExpression([])`, y ausencia de nodo `volume` en un `FilterGraph` armado con `automation: []` | La expresión identidad (`volume=1`) fija; inspección del `FilterGraph` producido por `buildMusicBedChain`/`buildAudioMixGraph` en ese caso |
| **CA-002** | Factor lineal evaluado por la expresión de `buildGainAutomationExpression` para la automatización de `planDucking(…, DEFAULT_AUDIO_MIX_PLAN.music, fps)`, en cada `frame` de keyframe y en dos puntos intermedios por tramo | El mismo factor calculado por `volumeAtFrame` de `composition-remotion` para esos mismos frames — como las libs no pueden importarse entre sí (D-G), ambos valores salen de la **misma tabla de valores esperados fijada en el spec** (arquitecto la deja explícita), con tolerancia `1e-6` |
| **CA-003** | Orden de los filtros de `buildMusicBedChain` (ganancia base antes que ducking) y presencia/ausencia de `afade` | El `AudioClip` de entrada: con `fadeInFrames`/`fadeOutFrames` presentes debe aparecer `afade`; con ambos ausentes, no debe aparecer ninguno |
| **CA-004** | Segmento `loudnorm` de `buildVoiceChain` (con y sin `measured`) | El resultado de llamar `buildLoudnormFilter` directamente con los mismos argumentos — igualdad de string, no de comportamiento aproximado |
| **CA-005** | `FilterGraph` de `buildAudioMixGraph` sobre una `Timeline` real construida con `buildTimeline`: cantidad de entradas, `adelay` por entrada, unicidad de la etiqueta de salida; y el error lanzado ante un `assetId` inexistente | Una entrada por `AudioClip` de voz/música, `adelay` == `from` del clip en ms, una única etiqueta de salida; el error tipado nuevo con el `assetId` en el mensaje |
| **CA-006** | String producido por `serializeFilterGraph` y arreglo producido por `audioMixFfmpegArgs` para un `FilterGraph` fijo | Un string `-filter_complex` esperado y un arreglo de argumentos esperado, ambos fijados en el spec (`toEqual`/igualdad exacta), sin ejecutar `ffmpeg` |
| **CA-007** | Resultado de `pnpm nx run-many -t lint test build --projects=media-local` | Exit code en verde y reporte de cobertura de Vitest ≥ 98.03% statements / 94.77% ramas (RNF-2) — el ciclo no cierra si baja cualquiera de los dos pisos |

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| **`AudioMixPlan`** | Contrato de datos ya cerrado (`timeline-core`) con `voice` (target de loudnorm), `music` (ganancias y tiempos de ducking) y `automation` (`GainKeyframe[]` ya calculado por `planDucking`). Esta spec lo ejecuta; no lo diseña. |
| **`GainKeyframe`** | Par `{ frame, gainDb }` que marca un punto de la curva de ganancia de la música a lo largo del video. |
| **Ducking** | Bajar la ganancia de la música mientras hay voz, siguiendo la curva de `automation`, para que la voz se escuche por encima. |
| **`FilterGraph` tipado** | Estructura de datos (`{ inputs, chains, outputLabel }`, definida por el Arquitecto) que representa el filtergraph de `ffmpeg` antes de convertirlo a string — permite testear la estructura y el string serializado por separado. |
| **Paridad de curva** | Que la expresión de ganancia que arma este ciclo evalúe el mismo valor, frame a frame, que `volumeAtFrame` de `composition-remotion` — la garantía de que el master suena igual que el preview del `Player`. |
| **Capa pura** | Código sin efectos: no ejecuta binarios, no lee el filesystem, no depende del reloj ni de números aleatorios. Todo el ciclo 01 de esta spec es capa pura. |
| **`loudnorm` de dos pasadas** | Técnica de normalización de `ffmpeg`: una primera pasada mide loudness sin corregir, una segunda pasada corrige usando esa medición (`measured_I`, `measured_TP`, etc.). `buildVoiceChain` arma ambas pasadas sin recalcular la lógica que ya tiene `buildLoudnormFilter`. |

---

## Trazabilidad

| Historia | Requisito(s) funcional(es) | Criterios de aceptación de la spec |
| --- | --- | --- |
| HU-1-01 | RF-1-01 (RF-1 de la spec) | CA-001 |
| HU-1-02 | RF-1-02 (RF-2 de la spec) | CA-003 |
| HU-1-03 | RF-1-03 (RF-3 de la spec) | CA-004 |
| HU-1-04 | RF-1-04 (RF-4 de la spec) | CA-005 |
| HU-1-05 | RF-1-05 (RF-5 de la spec) | CA-006 |
| HU-1-06 | transversal a RF-1-01 (D-E) | CA-002 |
| HU-1-07 | transversal a RF-1-01 a RF-1-05 (RNF-1, RNF-2) | CA-007 |

Este ciclo no cubre RF-6 a RF-11 de la spec (ejecución con `CommandRunner`, verificación de loudness,
mux final, `renderTimeline` con `audio: 'muted'`, target `smoke-audio` ni la documentación de ambos
READMEs), que corresponden a `cycle-02` (D-I). Tampoco toca `AudioMixPlan`, `planDucking` ni ningún
schema de `timeline-core` (D-A), ni introduce `sidechaincompress` (D-C).

---

## Nota para el Arquitecto y el Planner

No se detectó contradicción entre esta spec y el código real de `timeline-core`/`composition-remotion`
revisado para este documento: `AudioMixPlanSchema`, `GainKeyframeSchema`, `planDucking` y
`volumeAtFrame` coinciden con lo que la spec describe. Un punto que sí conviene que el Arquitecto deje
explícito en su documento, porque este documento no diseña soluciones técnicas: `volumeAtFrame`
interpola en el dominio de **frames** (ratio `(frame - previous.frame) / span`), mientras que RF-1
pide una expresión FFmpeg evaluada por **muestra/tiempo** (`framesToMs` para convertir a segundos).
Ambos dominios dan el mismo factor normalizado porque el `fps` es constante dentro de una `Timeline`,
pero es la clase de detalle que CA-002 verifica numéricamente en vez de asumir — por eso HU-1-06 es
una historia propia y no una nota al pie de RF-1-01.
