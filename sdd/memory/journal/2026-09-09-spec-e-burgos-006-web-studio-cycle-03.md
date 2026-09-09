# spec-e-burgos-006-web-studio cycle-03 — 2026-09-09

Ciclo `full` de cierre de la spec y del backlog: edición de la Timeline persistida desde la UI,
jobs de render con polling/cancelación/descarga, D-12 (paridad de encuadre) y smoke E2E real.
31 tasks, 46 CA, 52 tests obligatorios.

---

## 1. Editar el campo que describe la intención, no el que el consumidor lee

**Qué pasó.** El alcance funcional pedía "ajustar volumen y ducking de música", y el documento
tiene exactamente esos dos campos: `audioMix.music.baseGainDb` y `duckedGainDb`. Editarlos habría
sido la lectura literal del requisito y habría pasado tipos, schema, lint y el `200` del servidor.
Medido antes de implementar: **ni el `<Player>` (`AudioTrack`) ni el render (`buildAudioMixGraph`/
`gain-automation-curve`) leen esos campos** para la curva real de ganancia — los dos leen
`audioMix.automation`. Un cambio que sólo tocara los dos niveles habría sido **inaudible en el
preview y en el MP4**, con la UI, el guardado y el disco confirmando el cambio. La solución fue
reescribir los keyframes de `automation` que coincidían con el valor anterior, preservando su
`frame`, y **fijar la reescala por paridad contra el productor real** (`planDucking` de
`timeline-core`) en vez de contra una expectativa escrita a mano.

**Lección.** Antes de implementar la edición de un campo, `grep` sus lectores: si el consumidor real
lee otro campo derivado, editar el campo declarativo es un no-op que ninguna suite detecta.

**Costo evitable.** Un ciclo entero de UI de mezcla verde y aceptada, con el defecto observable
sólo escuchando el MP4 — es decir, después de un render de minutos, o directamente en producción.
Detectarlo tarde habría costado además re-abrir la spec ya cerrada.

---

## 2. Un booleano de montaje a nivel de hook se latchea con el doble-invoke de StrictMode

**Qué pasó.** `useApiAction` nació en TASK-003 con `const mountedRef = useRef(true)` y un efecto
cuyo cleanup lo pone en `false`, **sin volver a ponerlo en `true` en el cuerpo del efecto**. Con
StrictMode activo (lo está en `apps/web/src/main.tsx`), React monta → desmonta → remonta: el
inicializador del `useRef` corre **una** vez y el cleanup corre **dos**, así que el ref queda en
`false` para siempre y todos los `setStatus` posteriores se descartan. Efecto observable: el botón
Save se traba en "Saving..." tras el primer guardado exitoso. La suite estaba verde (jsdom sin
StrictMode en los tests) y el guion E2E lo enmascaraba con un `page.reload()` que parecía una
espera razonable. Se descubrió recién al cerrar TASK-030, corriendo el producto de verdad. Los dos
hooks hermanos —`useAsyncResource` y `useRenderJobPoll`— eran inmunes porque no usan un booleano:
usan un **contador de secuencia monótono** bumpeado en el cuerpo del efecto y otra vez en el
cleanup.

**Lección.** Para descartar respuestas obsoletas en un hook usar un contador de secuencia
monótono, nunca un booleano de montaje: bajo StrictMode el cleanup corre más veces que el
inicializador y el booleano queda latcheado.

**Costo evitable.** Un defecto de producto que la suite verde no ve, más un `page.reload()`
metido en el guion de evidencia para rodearlo — es decir, evidencia que documentaba el bug como si
fuera el comportamiento normal. Corregir el hook eliminó el workaround y limpió la evidencia.

---

## 3. El architect no puede nombrar un código de error que el union cerrado de otra lib no tiene

**Qué pasó.** El contrato del architect describía un issue `VOICE_TRACK_NOT_MIRRORED` viajando en
`TimelineEditState.issues`. Al implementar, `TimelineIssue.code` de `libs/timeline-core` resultó ser
un union **cerrado** de los diez códigos de `validateTimeline`, y ese código no es uno de ellos: no
había forma de cumplir el contrato sin ensanchar el tipo de la lib (fuera de alcance) o castear
(mentirle al tipo). Se resolvió con un sensor separado de tipo propio (`VoiceMirrorIssue` en
`aroll-layout.ts`) y un union más ancho en la frontera de la UI, y costó una aprobación del
orquestador a mitad de ciclo (APR-04) más retoques en tres tasks ya planificadas
(issue-severity, reducer, timeline-issue-list).

**Lección.** El repo ya sabía "nunca copiar el union de códigos de otra lib"; lo nuevo es que la
regla aplica **al architect al escribir el contrato**: antes de nombrar un `code` de un tipo ajeno,
abrir el union y verificar que exista.

**Costo evitable.** Una aprobación de mitad de ciclo y el re-alcance de tres tasks ya estimadas,
por una verificación de treinta segundos en el momento de escribir la firma.

---

## 4. El guion que produce una evidencia es parte de la evidencia

**Qué pasó.** La captura de paridad de encuadre (CA-238) se produjo con un script
`capture-frame-240.mjs` que **quedó en un scratchpad y nunca se committeó**; el artefacto
`frame-parity-8s.md` lo invoca como `node <scratchpad>/capture-frame-240.mjs`. Los números y las
tres PNG están y son válidos, pero reproducir la medición hoy exige reescribir el script desde el
bloque de comandos del artefacto. El smoke E2E, en cambio, sí se committeó
(`apps/web/e2e/studio-smoke.mjs`) y es reproducible con un comando.

**Lección.** Todo guion que produce una evidencia de cierre se committea junto al artefacto: un
artefacto cuyo productor vive en un scratchpad documenta un número, no una medición repetible.

**Costo evitable.** Re-derivar el guion de captura (navegación, `?frame=`, espera del
`readyState`, reescala a 1080×1920, invocación de `psnr`) la próxima vez que haya que medir la
paridad — que es exactamente cuando se toque el `[FIX]` del encuadre del render, donde la medición
hay que repetirla por definición.
