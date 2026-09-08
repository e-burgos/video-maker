# Functional — Cycle 2: Ejecución, verificación, mux y render mudo (media-local + composition-remotion)

> **Input:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

`cycle-01` dejó cinco funciones puras que traducen un `AudioMixPlan` ya resuelto a un `FilterGraph`
de FFmpeg tipado y a sus argumentos de invocación exactos. Ninguna de esas funciones ejecuta un
binario, mide loudness o produce un solo sample de audio: es traducción, no ejecución. **Este ciclo
es donde ese trabajo se convierte en valor real para el creador de contenido.**

Hoy el video que produce el motor sale publicable; el audio no. Remotion mezcla voz y música
aplicando ganancia por frame (`AudioTrack` + `volumeAtFrame`), pero eso es un preview: nadie mide
loudness ni true peak sobre él, y no tiene `loudnorm`. Sin este ciclo, un creador que exporta su
Reel se lleva un archivo con audio que puede sonar notoriamente más bajo que el resto del feed, o
clippear al recodificarse en la plataforma de destino — y no tiene forma de saberlo antes de
publicar.

Este ciclo cierra esa brecha con tres piezas que se encadenan:

1. **`mixTimelineAudio`** ejecuta el filtergraph de `cycle-01` contra `ffmpeg` real y produce la
   pista masterizada.
2. **`verifyMixLoudness`** mide esa pista y dice, con números, si cumple el estándar de publicación
   (-14 LUFS ±1.0 LU, true peak ≤ -1.0 dBTP) — **sin esto, "normalizado a -14 LUFS" es una promesa
   de marketing, no un hecho verificable.** Un mix que no se mide es un mix del que nadie puede
   responder si realmente suena bien.
3. **`muxAudioIntoVideo`** combina esa pista con el video que Remotion ya renderizó, sin
   recodificarlo, en el único MP4 que el creador finalmente sube.

Hay una razón de producto, no solo técnica, por la que `renderTimeline` necesita una opción de
salir mudo (RF-9): Remotion ya mezcla voz y música para el preview del `Player`. Si el render que se
muxea con la pista masterizada **también** trajera su propia mezcla, el entregable final tendría
dos mezclas sonando al mismo tiempo — la de Remotion y la masterizada — audio duplicado, no el
audio limpio que promete esta spec. Por eso el render tiene que poder pedirse sin ninguna pista de
audio propia: el único audio del entregable es el que aporta el mux.

**Límite explícito de esta spec (D-G):** encadenar `render → mix → mux` en una sola llamada de
código no es parte de este ciclo ni de ningún ciclo de `spec-e-burgos-004`. Los boundaries de Nx
impiden que `libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`) se importen
entre sí, y `eslint.config.mjs` raíz está protegido por hook — relajar esa regla es un cambio de
arquitectura fuera de alcance. Esta spec entrega los tres bloques (mix, verificación, mux) más el
render mudo y deja el cableado como **entrada obligatoria** de `spec-e-burgos-005`
(`apps/render-api`, el único subproyecto que puede depender de ambas libs sin tocar ese boundary).
Documentar ese límite (RF-11) no es "deuda técnica difusa": es un requisito de este ciclo, con su
propio criterio de aceptación (CA-013).

**Alcance real de la paridad con el preview (D-J.6):** la promesa de "el master suena igual que lo
que escuchaste en el editor" (`cycle-01`, HU-1-06) aplica a la curva de ducking de la música, no al
nivel absoluto de la voz. `buildTimeline` crea los clips de voz con `gainDb: 0` y es el master el
que los normaliza con `loudnorm`; el preview de Remotion no aplica `loudnorm`. Es decir: el nivel de
la música baja y sube igual en el preview y en el master, pero el nivel de la voz en el preview
nunca fue el nivel final — eso lo corrige recién el master. Esto se documenta explícitamente
(RF-11) para que nadie lo asuma como un bug.

---

## Historias de usuario

### HU-2-01: Publicar un video con el audio finalmente a -14 LUFS

**Como** creador de contenido
**Quiero** que mi plan de mezcla (voz con ducking automático de música) se ejecute contra los
archivos de audio reales y produzca una pista masterizada
**Para** poder publicar un video que suene al nivel esperado del feed, sin tener que ajustar niveles
a mano en un editor externo

**Criterios de aceptación:**

- [ ] CA-1: Con `FixtureCommandRunner`, `mixTimelineAudio` ejecuta exactamente dos invocaciones de
      `ffmpeg` — la de medición de voz y la del mix final — con los argumentos que produce
      `audioMixFfmpegArgs` (referencia técnica: CA-008)
- [ ] CA-2: Si el binario falla en cualquiera de las dos invocaciones, el error se propaga como
      `CommandFailedError` con el `stderr` truncado, en vez de devolver un resultado parcial o
      fallar en silencio (referencia técnica: CA-008)

**Prioridad:** Alta
**Estimación:** M

---

### HU-2-02: Saber si mi video realmente cumple el estándar de loudness antes de publicarlo

**Como** creador de contenido
**Quiero** que el sistema mida el loudness integrado y el true peak de mi pista masterizada y me
diga si está dentro de -14 ±1.0 LU y ≤ -1.0 dBTP
**Para** no publicar un video que suene más bajo que el resto del feed o que clippee al
recodificarse en la plataforma de destino, sin haberlo sabido de antemano

**Criterios de aceptación:**

- [ ] CA-3: `verifyMixLoudness` devuelve `withinTolerance: true` para una medición dentro de
      -14 ±1.0 LU con true peak ≤ -1.0 dBTP, y `false` con los deltas correctos fuera de ese rango,
      en los cuatro casos borde declarados en la spec (referencia técnica: CA-009)
- [ ] CA-4: `verifyMixLoudness` no lanza por estar fuera de tolerancia en ninguno de esos casos —
      devuelve el resultado con sus deltas y deja la decisión de qué hacer (relanzar el mix, avisar,
      publicar de todos modos) a quien la consume, nunca la toma por su cuenta (referencia técnica:
      CA-009, D-F)

**Prioridad:** Alta
**Estimación:** S

---

### HU-2-03: Recibir un solo archivo entregable, no dos piezas para sincronizar a mano

**Como** creador de contenido
**Quiero** un único MP4 que combine mi video —sin recomprimirlo— con la pista de audio masterizada
**Para** tener un archivo listo para subir a cualquier plataforma, sin perder la calidad de imagen
del render original ni tener que sincronizar audio y video por mi cuenta

**Criterios de aceptación:**

- [ ] CA-5: `muxAudioIntoVideo` arma los argumentos exactos de D-H
      (`-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest`) y `-c:v copy` está presente,
      verificado sobre los argumentos — el video nunca se reencodea (referencia técnica: CA-010)
- [ ] CA-6: si el video de entrada no tiene stream de video, la función lanza un error tipado en vez
      de producir un archivo corrupto o silenciosamente inválido (referencia técnica: RF-8)

**Prioridad:** Alta
**Estimación:** S

---

### HU-2-04: Que el entregable no suene con el audio duplicado

**Como** creador de contenido
**Quiero** poder pedir que el render de mi video salga sin ninguna pista de audio propia
**Para** que, al muxearlo con la pista masterizada, el resultado final tenga un solo audio —el
masterizado— en vez de dos mezclas sonando al mismo tiempo (la de Remotion encima de la
masterizada), que es lo que pasaría si el render trajera su propia pista

**Criterios de aceptación:**

- [ ] CA-7: `renderTimeline(timeline, { audio: 'muted' })` hace que `TimelineComposition` no monte
      `AudioTrack` (referencia técnica: CA-011)
- [ ] CA-8: sin la opción `audio` (o con `audio: 'mix'`), el comportamiento actual no cambia —
      ningún consumidor existente de `renderTimeline` se rompe por este cambio, que es aditivo
      (referencia técnica: CA-011, RF-9)

**Prioridad:** Alta
**Estimación:** S

---

### HU-2-05: Verificar de punta a punta, con `ffmpeg` real, que el pipeline masteriza al estándar prometido

**Como** desarrollador que mantiene `libs/media-local`
**Quiero** un comando manual que genere sus propias señales de prueba (voz sintética + música),
corra el mix, la verificación y el mux en cadena, e imprima los LUFS medidos del resultado
**Para** poder confirmar —antes de integrar con `spec-e-burgos-005`— que las tres funciones
encadenadas realmente producen un entregable dentro de -14 ±1.0 LU / ≤ -1.0 dBTP contra un binario
real, sin depender de que alguien lo verifique a mano ni de que CI lo corra (CI no tiene los
binarios)

**Criterios de aceptación:**

- [ ] CA-9: `pnpm nx run media-local:smoke-audio` produce el MP4 final e imprime una medición
      integrada dentro de -14 ±1.0 LU y true peak ≤ -1.0 dBTP sobre las señales de prueba generadas
      (referencia técnica: CA-012)
- [ ] CA-10: el target es manual y queda fuera de CI, igual que el resto de los smokes del repo
      (referencia técnica: CA-012, RNF-1)

**Prioridad:** Media
**Estimación:** M

---

### HU-2-06: Saber cómo encadenar los bloques sin tener que leer el código fuente de las dos libs

**Como** desarrollador que va a implementar `spec-e-burgos-005` (render-service)
**Quiero** que los README de `libs/media-local` y `libs/composition-remotion` documenten el
procedimiento `render mudo → mix → mux → verificación` como pasos manuales encadenados, y señalen
explícitamente qué queda pendiente de cablear
**Para** integrar las dos libs en `apps/render-api` sin adivinar el orden de las llamadas ni tener
que reabrir esta spec para entender dónde termina su alcance

**Criterios de aceptación:**

- [ ] CA-11: ambos READMEs documentan el procedimiento encadenado completo, con los cuatro pasos en
      orden (referencia técnica: CA-013)
- [ ] CA-12: ambos READMEs señalan explícitamente que la orquestación en una sola llamada es entrada
      obligatoria de `spec-e-burgos-005`, y explican por qué (los boundaries Nx impiden que
      `media-local` y `composition-remotion` se importen entre sí) — no un pendiente genérico tipo
      "falta integrar" (referencia técnica: CA-013, D-G)

**Prioridad:** Media
**Estimación:** XS

---

### HU-2-07: Confiar en que todo esto se verifica sin depender de un binario en cada corrida de CI

**Como** desarrollador que integra `libs/media-local` y `libs/composition-remotion`
**Quiero** que las funciones de este ciclo se verifiquen con pruebas automatizadas que no ejecutan
ningún binario, y que la cobertura heredada de ambas libs no baje
**Para** poder confiar en el pipeline en cualquier entorno —incluida la integración continua del
repositorio— sin que un `ffmpeg` ausente, lento o distinto por versión rompa el build

**Criterios de aceptación:**

- [ ] CA-13: `pnpm nx run-many -t lint test build --projects=media-local,composition-remotion`
      termina en verde con cobertura ≥ los cuatro pisos de RNF-2 (98.03 % stmts / 94.77 % ramas en
      `media-local`; 96.77 % stmts / 93.16 % ramas en `composition-remotion`) (referencia técnica:
      CA-014)
- [ ] CA-14: ningún `*.spec.ts` de ninguna de las dos libs ejecuta `ffmpeg`, `ffprobe` ni Chrome —
      toda ejecución de este ciclo se prueba con `FixtureCommandRunner` y dobles (referencia
      técnica: CA-014, RNF-1)

**Prioridad:** Alta
**Estimación:** S

---

## Requisitos funcionales

### RF-2-01: Ejecución del mix contra `ffmpeg` real (RF-6 de la spec)

**Descripción:** `mixTimelineAudio(timeline, assets, out, runner, opts)` arma el grafo (RF-4 de
`cycle-01`), corre una primera pasada de `ffmpeg` que mide la voz, arma con esa medición una segunda
pasada y produce el WAV masterizado. Devuelve `{ outputPath, filterComplex, voiceMeasured, args }`.

**Reglas de negocio:**

- RN-1: siempre corre dos pasadas de `ffmpeg` — la primera mide la voz, la segunda usa esa medición
  para producir el archivo final — nunca una sola pasada, aunque el resultado de la primera ya
  pareciera suficiente.
- RN-2: el archivo que produce es un WAV intermedio `pcm_s16le`, 48 kHz, estéreo (D-H) — no es
  todavía el formato publicable; eso es responsabilidad exclusiva del mux (RF-2-03).
- RN-3: el resultado expone la medición de voz usada y los argumentos ejecutados, no solo la ruta
  del archivo — quien la invoca (`spec-e-burgos-005` incluido) puede auditar qué se hizo sin tener
  que volver a ejecutar nada.

**Casos de error:**

- CE-1: si `ffmpeg` falla en cualquiera de las dos pasadas, se propaga `CommandFailedError` con el
  `stderr` truncado; no hay reintento automático ni degradación silenciosa a un resultado parcial.

---

### RF-2-02: Verificación post-mix contra el target de loudness (RF-7 de la spec)

**Descripción:** `verifyMixLoudness(path, target, runner, opts)` mide el resultado con
`measureLoudness` y devuelve `{ measured, withinTolerance, integratedDeltaLu, truePeakDeltaDb }`
según las tolerancias declaradas.

**Reglas de negocio:**

- RN-4: tolerancias fijas y no configurables por este requisito: integrado -14 ±1.0 LU, true peak
  ≤ -1.0 dBTP **sin tolerancia hacia arriba** (D-F) — un true peak de -0.9 dBTP está fuera de
  tolerancia aunque el integrado sea perfecto.
- RN-5: el LRA medido se reporta pero es informativo — no participa del cálculo de
  `withinTolerance`.
- RN-6: nunca lanza por estar fuera de tolerancia: devuelve el resultado tipado con sus deltas
  (`integratedDeltaLu`, `truePeakDeltaDb`) y dejar la decisión de qué hacer con eso —relanzar el
  mix, alertar, publicar igual— a quien la consume.

**Casos de error:**

- CE-2: sí lanza si el binario de medición falla (no puede completar la medición) — eso no es lo
  mismo que "la medición dio fuera de rango" (RN-6).

---

### RF-2-03: Mux final sin reencodear el video (RF-8 de la spec)

**Descripción:** `muxAudioIntoVideo(videoPath, audioPath, out, runner, opts)` produce el MP4 final
con `-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest`.

**Reglas de negocio:**

- RN-7: el video **nunca** se reencodea: `-c:v copy` está siempre presente en los argumentos — regla
  de negocio no negociable de este ciclo, no un detalle de optimización.
- RN-8: el audio del entregable final es AAC 192 kbps (D-H), distinto del WAV intermedio de
  RF-2-01 — el mux no reusa el formato del intermedio, produce el formato publicable.
- RN-9: usa `-shortest` para no dejar el entregable con silencio de más o video congelado si las
  duraciones de audio y video difieren en algunos frames.

**Casos de error:**

- CE-3: si el video de entrada no tiene stream de video, error tipado (nombre y ubicación exacta en
  la jerarquía de errores, a criterio del Arquitecto).

---

### RF-2-04: Render de video sin pista de audio propia (RF-9 de la spec)

**Descripción:** `renderTimeline` (de `composition-remotion`) acepta `audio?: 'mix' | 'muted'` con
default `'mix'` (comportamiento actual intacto). Con `'muted'`, `TimelineComposition` no monta
`AudioTrack`.

**Reglas de negocio:**

- RN-10: el default `'mix'` preserva el comportamiento actual sin excepción — ningún consumidor
  existente cambia de comportamiento sin pedir la opción explícitamente.
- RN-11: con `'muted'`, el render no tiene **ninguna** pista de audio propia — el objetivo de negocio
  es que el único audio del entregable final sea el masterizado que aporta el mux (RF-2-03); dos
  mezclas sonando a la vez es exactamente el defecto que esta opción existe para evitar.
- RN-12: el cambio es aditivo: la firma pública de `renderTimeline` no rompe compatibilidad con quien
  la llama hoy sin pasar la opción.

**Casos de error:**

- CE-4: no aplica un caso de error de negocio propio — es una opción de configuración con dos
  valores válidos, no una operación que pueda fallar por datos inválidos propios de esta feature.

---

### RF-2-05: Target manual `smoke-audio`, autocontenido (RF-10 de la spec)

**Descripción:** Target manual `media-local:smoke-audio` que genera con `ffmpeg` sus propias señales
de prueba (voz sintética + música), corre RF-2-01/RF-2-02/RF-2-03 en cadena y **imprime los LUFS
medidos** del entregable final.

**Reglas de negocio:**

- RN-13: genera sus propias señales de prueba — no depende de assets del creador ni de fixtures
  externas, así es reproducible en cualquier máquina que tenga los binarios instalados.
- RN-14: corre la cadena completa (mix → verificación → mux) sobre esas señales e imprime la
  medición integrada del entregable final — no es un smoke parcial de una sola función.
- RN-15: fuera de CI, igual que el resto de los smokes del repo (RNF-1) — un ambiente sin `ffmpeg`
  instalado no bloquea ningún pipeline automatizado, porque este target no corre ahí.

**Casos de error:**

- CE-5: si `ffmpeg` no está instalado o la generación de señales falla, el target falla con el error
  tipado ya existente de la lib (`BinaryNotFoundError`/`CommandFailedError`) — no introduce una
  clase de error de negocio nueva.

---

### RF-2-06: Documentación del procedimiento encadenado y su límite de alcance (RF-11 de la spec)

**Descripción:** Ambos READMEs (`libs/media-local`, `libs/composition-remotion`) documentan el
procedimiento `render mudo → mix → mux → verificación` como pasos manuales encadenados, señalando
explícitamente que el cableado programático es entrada obligatoria de `spec-e-burgos-005`.

**Reglas de negocio:**

- RN-16: el procedimiento se documenta como pasos manuales concretos (comando por comando), no como
  código de ejemplo de una función de orquestación que no existe todavía.
- RN-17: ambos READMEs explican **por qué** el cableado no vive en ninguna de las dos libs (los
  boundaries Nx impiden que `media-local`, `type:util`, y `composition-remotion`, `type:ui`, se
  importen entre sí, y `eslint.config.mjs` raíz está protegido por hook, D-G) — no un pendiente
  genérico sin justificación.
- RN-18: el README de `composition-remotion` documenta también el alcance real de la paridad con el
  preview (D-J.6): se promete para la curva de ducking de la música, no para el nivel absoluto de la
  voz, porque el preview no aplica `loudnorm` y el master sí.

**Casos de error:**

- CE-6: no aplica caso de error — es documentación, no código ejecutable.

---

## Cómo se verifica cada CA-008..CA-014 de la spec

| CA de la spec | Qué se comprueba | Contra qué |
| --- | --- | --- |
| **CA-008** | Con `FixtureCommandRunner`, cantidad e identidad de las invocaciones de `ffmpeg` que ejecuta `mixTimelineAudio`, y el error propagado si el runner responde con un fallo | Exactamente dos invocaciones (medición + mix) con los argumentos de `audioMixFfmpegArgs`; `CommandFailedError` con `stderr` truncado ante un fallo del runner |
| **CA-009** | Resultado de `verifyMixLoudness` en los cuatro casos borde declarados (dentro de tolerancia, fuera por integrado, fuera por true peak, fuera por ambos) | `withinTolerance` y los deltas (`integratedDeltaLu`, `truePeakDeltaDb`) esperados en cada caso; ninguno de los cuatro casos lanza |
| **CA-010** | Argumentos exactos que arma `muxAudioIntoVideo` | La lista de D-H (`-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest`), con `-c:v copy` verificado presente |
| **CA-011** | Props que recibe `TimelineComposition` con `renderTimeline(timeline, { audio: 'muted' })`, y sin la opción | Con `'muted'`, ausencia de `AudioTrack` montado; sin la opción, comportamiento idéntico al actual (test de no-regresión) |
| **CA-012** | Salida de `pnpm nx run media-local:smoke-audio` | MP4 final generado y medición integrada impresa dentro de -14 ±1.0 LU / true peak ≤ -1.0 dBTP sobre señales de prueba generadas por el propio target; corrida manual, no en CI |
| **CA-013** | Contenido de los README de `media-local` y `composition-remotion` | Procedimiento encadenado completo documentado en ambos, con el pendiente de `spec-e-burgos-005` y su justificación (D-G) explícitos |
| **CA-014** | Resultado de `pnpm nx run-many -t lint test build --projects=media-local,composition-remotion` | Exit code en verde y cobertura ≥ 98.03 %/94.77 % (`media-local`) y ≥ 96.77 %/93.16 % (`composition-remotion`); ningún `*.spec.ts` nuevo invoca un binario real |

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| **Master / pista masterizada** | El WAV intermedio (`pcm_s16le`, 48 kHz, estéreo) que produce `mixTimelineAudio` a partir del `FilterGraph` de `cycle-01` — el resultado de aplicar el plan de mezcla contra `ffmpeg` real. |
| **True peak / dBTP** | Pico real de la señal reconstruida (no el pico de las muestras discretas) — el que importa para saber si un codec posterior va a clippear al recodificar. |
| **LRA** | Loudness Range: variación de loudness a lo largo del audio. Informativo en este ciclo, no participa de `withinTolerance`. |
| **Render mudo** | `renderTimeline(timeline, { audio: 'muted' })`: el video que Remotion produce sin ninguna pista de audio propia, pensado para muxearse después con la pista masterizada. |
| **Mux** | Combinar un stream de video y un stream de audio en un único contenedor sin recodificar ninguno de los dos (`-c:v copy` en este ciclo). |
| **Audio duplicado** | El defecto que evita el render mudo: si el render trajera su propia mezcla y además se muxeara la pista masterizada, el entregable sonaría con las dos mezclas superpuestas. |
| **Entrada obligatoria de `spec-e-burgos-005`** | El cableado programático `render → mix → mux` en una sola llamada — no lo entrega esta spec (D-G); queda documentado como procedimiento manual y como requisito de la spec siguiente. |

---

## Trazabilidad

| Historia | Requisito(s) funcional(es) | Criterios de aceptación de la spec |
| --- | --- | --- |
| HU-2-01 | RF-2-01 (RF-6 de la spec) | CA-008 |
| HU-2-02 | RF-2-02 (RF-7 de la spec) | CA-009 |
| HU-2-03 | RF-2-03 (RF-8 de la spec) | CA-010 |
| HU-2-04 | RF-2-04 (RF-9 de la spec) | CA-011 |
| HU-2-05 | RF-2-05 (RF-10 de la spec) | CA-012 |
| HU-2-06 | RF-2-06 (RF-11 de la spec) | CA-013 |
| HU-2-07 | transversal a RF-2-01..RF-2-06 (RNF-1, RNF-2) | CA-014 |

Este ciclo no cubre ni reabre `AudioMixPlan`, `planDucking`, `sidechaincompress`, EQ/de-esser/
compresión de voz/reducción de ruido/SFX, mezcla de más de dos pistas lógicas, ni el cableado
`render → mix → mux` en una sola llamada (D-A, D-C, "Fuera de alcance" de la spec, D-G). Tampoco
toca `src/mix/` de `cycle-01`, cuyos contratos quedan fijos.

---

## Nota para el Arquitecto y el Planner

No se detectó una contradicción entre la spec y lo que `cycle-01` realmente entregó. Sí hay un punto
que `cycle-01` ya dejó anotado (`architect.md` §11.2, y el fragmento de contexto de
`libs/media-local`) y que conviene que el Arquitecto resuelva explícitamente al diseñar RF-2-01,
porque cambia qué archivo recibe la primera pasada de `ffmpeg`: `buildVoiceTrack` de
`timeline-core` le asigna al clip de voz el `assetId` del clip de aroll (el `sourceAssetId` del
EDL), así que **la voz nunca tiene un `assetId` propio**. Esto implica que la medición de voz de
RF-2-01 puede tener que leer el **stream de audio de un contenedor de video** (el aroll), no un WAV
de voz aislado. RN-1 de este documento asume que "la primera pasada mide la voz" sin prejuzgar de
qué tipo de archivo sale ese stream — es información de negocio (qué se mide y con qué tolerancia),
no de qué contenedor lee `ffmpeg`; esa decisión de entrada exacta a `measureLoudness`/`ffprobe` le
corresponde al Arquitecto, tal como `cycle-01` ya lo dejó escrito para que no se asuma sin
verificar.
