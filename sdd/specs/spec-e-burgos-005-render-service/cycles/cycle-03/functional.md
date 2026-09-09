# Functional — Cycle 03: Cola de jobs de render y entrega (`render-service`)

> **Input:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/brief.yaml`
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/functional.md`
> **Generado por:** sdd-functional

---

## Contexto de negocio

`runRenderPipeline` existe desde `cycle-01` (`prepare → render → mix → mux → verify`, orquestando
`renderTimeline`, `mixTimelineAudio`, `muxAudioIntoVideo` y `verifyMixLoudness`) y sigue, al cerrar
`cycle-02`, sin una sola ruta HTTP que lo dispare. Este ciclo es el que lo convierte en un servicio
real: una cola en proceso con concurrencia 1 que crea, consulta, lista y cancela jobs de render
sobre un proyecto que ya vive en `media/<slug>/` (`work/timeline.json` escrito por `cycle-02` o por
`tools/render-cli`).

Un render de 1080×1920 dura minutos. El progreso no es un adorno: es lo único que distingue "está
trabajando" de "se colgó" para el dev que lo dispara y espera. Por eso este ciclo también extiende
`RenderMutedVideoPort` — hoy no propaga el callback `onProgress(renderedFrames, totalFrames)` que
`renderTimeline` ya expone — para que el estado del job lo refleje etapa por etapa y, durante el
render en sí, frame por frame.

Concurrencia 1 es una decisión de producto ya tomada por el dev (la máquina no soporta dos renders
simultáneos), no una limitación técnica a discutir en este documento. Este ciclo **cierra la spec**:
además de la cola, incluye el **smoke real E2E obligatorio** que dispara un job por HTTP sobre un
proyecto real y verifica el MP4 resultante con `ffprobe` — la primera vez que se ejercita el bundle
webpack de Remotion de punta a punta (D-10, declarado no verificado desde `cycle-01`) y la evidencia
que permite cerrar `FIX-e-burgos-001-001`.

**Nota sobre rutas HTTP:** a diferencia de `cycle-02`, este documento **no fija verbos ni paths**
de los endpoints nuevos — el brief se lo deja explícitamente al architect (`EP-012..EP-0NN`). Las
historias describen el comportamiento observable en términos de la acción de dominio (crear /
consultar / listar / cancelar un job), no de una ruta concreta.

Fuera de este ciclo (ver `brief.yaml → out_of_scope`): MinIO/URLs firmadas (D-11, ya descopado),
concurrencia > 1 o workers en procesos separados, persistencia de jobs entre reinicios de proceso,
`apps/render-api/eslint.config.mjs` (D-9), cualquier UI (`spec-006`), y re-master o reintento ante
`withinTolerance: false` (D-7 sigue vigente).

## Actores

| Actor | Rol en las historias |
| --- | --- |
| **Dev-operador** | Persona física que dispara un render, consulta su progreso, lo cancela si hace falta, y es quien ejecuta y evidencia el smoke real E2E al cerrar el ciclo. |
| **Cliente de máquina (`apps/web`, futuro)** | Consumidor programático que crea jobs, hace polling de su estado/progreso y descarga el entregable con el endpoint de artefactos ya existente (`EP-011`). Mismo actor que en `cycle-02`. |

---

## Historias de usuario

### HU-03-01: Crear un job de render sobre un proyecto

**Como** dev que opera el servicio / cliente de máquina
**Quiero** encolar un render para un proyecto que ya tiene su `Timeline` persistida
**Para** disparar el pipeline completo sin tener que pasarle el documento de edición en el body ni
esperar a que termine para recibir una respuesta

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: creación válida sobre un proyecto con Timeline persistida
  Given el proyecto "smoke-ingest" existe y work/timeline.json valida contra TimelineSchema
  When el cliente crea un job de render para "smoke-ingest"
  Then la respuesta confirma la creación con un identificador de job generado por el servicio
    (nunca provisto por el cliente)
  And el job queda en estado queued si ya hay otro job running, o pasa a running de inmediato
    si la cola estaba vacía (RN-2)
  And el job, al ejecutarse, lee la Timeline desde work/timeline.json por el store — nunca desde
    un body de la creación (RN-3)

Scenario: el proyecto no existe
  Given no hay ningún proyecto con slug "no-existe" bajo la raíz de medios
  When el cliente intenta crear un job para "no-existe"
  Then la respuesta es un error tipado 404 PROJECT_NOT_FOUND (camino de error #2, reusa el código
    de cycle-02)
  And ningún job queda registrado

Scenario: el proyecto existe pero no tiene Timeline
  Given "proyecto-vacio" existe pero work/timeline.json no existe
  When el cliente intenta crear un job para "proyecto-vacio"
  Then la respuesta es un error tipado 404 TIMELINE_NOT_FOUND (camino de error #3, reusa el
    código de HU-02-07)
  And ningún job queda registrado

Scenario: el proyecto tiene una Timeline que no valida
  Given work/timeline.json existe pero no valida contra TimelineSchema
  When el cliente intenta crear un job para ese proyecto
  Then la respuesta es un error tipado 422 TIMELINE_INVALID (camino de error #4)
  And ningún job queda registrado

Scenario: el job termina con éxito
  Given un job creado sobre "smoke-ingest" corrió sin errores
  When se inspecciona el filesystem del proyecto
  Then el entregable está en out/<renderId>.mp4
  And work/renders/<renderId>/video-muted.mp4 y master.wav siguen existiendo (D-8, RF-24) — el
    job no borra ningún intermedio, igual que la llamada directa a runRenderPipeline
```

**Trazabilidad:** RF-19, RF-24 · CA-021, CA-030
**Prioridad:** Alta · **Estimación:** L

---

### HU-03-02: Consultar el estado y el progreso de un job

**Como** dev que opera el servicio / cliente de máquina
**Quiero** consultar un job por su identificador y ver en qué etapa va y qué porcentaje del render
lleva
**Para** distinguir "está trabajando" de "se colgó" sin quedarme mirando un proceso mudo

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: job en cola, todavía no arrancó
  Given un job fue creado pero hay otro job running por delante
  When el cliente lo consulta
  Then el estado reportado es queued
  And no hay etapa vigente ni progreso por frame

Scenario: job corriendo, etapa distinta de render
  Given un job está en prepare, mix, mux o verify
  When el cliente lo consulta
  Then el estado reportado es running
  And la etapa vigente (stage) es exactamente una de prepare | render | mix | mux | verify
    (RenderPipelineStage), sin progreso por frame en esas etapas (RN-5)

Scenario: job corriendo, etapa render, con progreso
  Given un job está en la etapa render
  And renderTimeline invocó su callback onProgress con (renderedFrames: 120, totalFrames: 480)
  When el cliente lo consulta
  Then el estado reportado es running, stage: "render"
  And el progreso reportado refleja esos mismos renderedFrames/totalFrames (RF-23, RN-5)
  And una consulta posterior, tras un segundo avance de onProgress con renderedFrames mayor,
    reporta un progreso mayor o igual, nunca menor (CA-023)

Scenario: job terminado con éxito
  Given un job terminó todas las etapas sin error
  When el cliente lo consulta
  Then el estado reportado es succeeded
  And el payload incluye el reporte del pipeline (RenderPipelineReport: deliverable, intermediates,
    loudness) igual que devolvería runRenderPipeline invocado directamente

Scenario: job terminado con error
  Given una etapa cualquiera del pipeline lanzó durante la ejecución del job (p. ej. RENDER_FAILED
    en render, o MEDIA_COMMAND_FAILED en mix)
  When el cliente lo consulta
  Then el estado reportado es failed
  And el payload embebe el error tipado completo (code, stage, resource) de esa falla, el mismo
    que produciría la llamada directa al pipeline (RN-6)
  And la consulta en sí sigue respondiendo 200 — el fallo es del job, no del transporte
    (camino de error #6)

Scenario: id de job inexistente
  When el cliente consulta un identificador de job que nunca existió
  Then la respuesta es un error tipado 404 RENDER_JOB_NOT_FOUND (camino de error #1)
```

**Trazabilidad:** RF-20, RF-23 · CA-023, CA-024, CA-028, CA-029
**Prioridad:** Alta · **Estimación:** L

---

### HU-03-03: Listar los jobs de un proyecto

**Como** dev que opera el servicio / cliente de máquina
**Quiero** ver todos los jobs creados para un proyecto puntual, en el orden en que se crearon
**Para** saber qué se disparó sobre ese proyecto sin tener que recordar cada identificador de job

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el proyecto tiene jobs de distintos estados
  Given "smoke-ingest" tiene tres jobs creados en este orden: uno succeeded, uno failed y uno
    queued
  When el cliente lista los jobs de "smoke-ingest"
  Then la respuesta incluye exactamente esos tres jobs, en el mismo orden en que se crearon
  And cada elemento trae al menos: el identificador del job y su estado

Scenario: el listado es por proyecto, no global
  Given existen jobs de "smoke-ingest" y de "otro-proyecto"
  When el cliente lista los jobs de "smoke-ingest"
  Then el resultado no incluye ningún job de "otro-proyecto" (RN-8)

Scenario: el proyecto no tiene jobs todavía
  Given "proyecto-nuevo" nunca tuvo un job creado
  When el cliente lista sus jobs
  Then la respuesta es una lista vacía, no un error
```

**Trazabilidad:** RF-21 · CA-025
**Prioridad:** Media · **Estimación:** S

---

### HU-03-04: Cancelar un job según su estado

**Como** dev que opera el servicio / cliente de máquina
**Quiero** cancelar un job, con un resultado distinto según si todavía no arrancó o ya está
corriendo
**Para** poder liberar la cola de un render que ya no necesito, entendiendo qué garantiza la
cancelación en cada caso

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: cancelar un job en cola
  Given un job está en estado queued (nunca llegó a running)
  When el cliente lo cancela
  Then el job pasa a canceled de inmediato
  And ese job jamás invoca ningún puerto del pipeline (renderMutedVideo, mixTimelineAudio,
    muxAudioIntoVideo, verifyMixLoudness) — verificado sobre el registro de llamadas (CA-026)

Scenario: cancelar un job en ejecución
  Given un job está en estado running, en cualquier etapa
  When el cliente lo cancela
  Then el job termina en un estado observable y distinto de succeeded y de failed (el nombre
    exacto y si existe un estado transitorio los fija el architect; RN-2)
  And un binario en curso (ffmpeg/ffprobe/Chrome) nunca se interrumpe a mitad de su propia
    invocación — la cancelación de un job running no implica matar el proceso hijo activo

Scenario: cancelar un job ya finalizado
  Given un job está en estado succeeded, failed o canceled
  When el cliente intenta cancelarlo de nuevo
  Then la respuesta es un error tipado 409 RENDER_JOB_NOT_CANCELABLE (camino de error #5)
  And el estado final del job no cambia

Scenario: id de job inexistente
  When el cliente intenta cancelar un identificador de job que nunca existió
  Then la respuesta es un error tipado 404 RENDER_JOB_NOT_FOUND (camino de error #1)
```

**Trazabilidad:** RF-22 · CA-026, CA-027, CA-028
**Prioridad:** Alta · **Estimación:** M

---

### HU-03-05: Ver la capacidad de la cola en `/health`

**Como** dev que opera el servicio / cliente de máquina que arranca
**Quiero** que `GET /health` declare la capacidad de la cola de jobs
**Para** saber, antes de crear un job, si esta instancia del servicio ya la soporta

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el servicio incluye la cola de jobs
  When el cliente hace GET /health
  Then la respuesta es 200
  And body.capabilities declara la capacidad de la cola (p. ej. jobQueue: true)
  And body.status sigue reflejando "ok" o "degraded" según motores y binarios, sin relación con
    la cola de jobs — igual que capabilities.assetStore en cycle-02 (CA-018)
```

**Trazabilidad:** RF-26 · CA-031
**Prioridad:** Media · **Estimación:** XS

---

### HU-03-06: Recibir errores de la cola en un formato consistente y traducible

**Como** cliente de máquina (`apps/web`) / dev haciendo debugging
**Quiero** que todo error nuevo de la cola tenga un `code` en inglés, un status HTTP correcto, y
ningún `.stack` ni ruta absoluta del host
**Para** mostrar el error sin traducir texto en castellano ni filtrar información del filesystem
del dev, igual que ya garantiza `cycle-01`/`cycle-02` (D-4)

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: cualquiera de los seis caminos de error de la cola
  Given cualquiera de los caminos listados en "Caminos de error observables"
  When ese error ocurre
  Then el payload de la respuesta tiene un code en mayúsculas y en inglés
  And el status HTTP coincide con la tabla de esta sección
  And el payload no contiene texto en castellano, ni .stack, ni una ruta absoluta del host
    (CA-032)
```

**Trazabilidad:** RF-25 · CA-032
**Prioridad:** Alta · **Estimación:** S

---

### HU-03-07: Verificar con un smoke real E2E que un job produce un entregable correcto

**Como** dev que cierra el ciclo (y, por extensión, el reviewer que audita el cierre)
**Quiero** disparar un job por HTTP sobre un proyecto real de `media/` y verificar el MP4
resultante con `ffprobe` contra el stream de video
**Para** tener evidencia real — no un test con puertos doblados — de que la cola bundlea y ejecuta
Remotion de punta a punta, y de que `FIX-e-burgos-001-001` (el fix que hizo posible cualquier
render real en este repo) queda validado

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: smoke E2E completo, ejecución real del proceso (no un test)
  Given el servidor arranca contra un proyecto real de "media/" con Timeline y assets ya
    presentes (ffmpeg, ffprobe, whisper-cli y Chrome disponibles en la máquina)
  When se crea un job de render por HTTP para ese proyecto
  And se hace polling del estado del job hasta observar succeeded (o se agota un timeout, que en
    ese caso es una falla del smoke)
  Then el MP4 resultante se descarga por el endpoint de artefactos ya existente (EP-011)
  And se ejecuta ffprobe sobre el archivo descargado
  And la duración esperada se calcula y se compara contra el stream de video — nb_frames dividido
    por r_frame_rate parseado como fracción (p. ej. "30000/1001") — nunca contra format.duration,
    que en un contenedor mp4 con audio remuxeado puede diferir de la duración real de frames
    (RF-27)
  And la comparación pasa dentro de la tolerancia que fije el architect
  And la salida literal de ffprobe (y del resto del smoke) queda guardada en
    cycles/cycle-03/artifacts/, no sólo relatada en el reporte del reviewer
  And este smoke es la evidencia que permite marcar FIX-e-burgos-001-001 como validated en
    sdd/fixes.json al cerrar el ciclo (RF-28)
```

**Trazabilidad:** RF-27, RF-28 · CA-033
**Prioridad:** Alta · **Estimación:** L

---

### HU-03-08: Documentar la cola en el README

**Como** dev que opera el servicio (incluido un dev nuevo en el equipo)
**Quiero** encontrar en el README los endpoints de la cola, la semántica de cancelación y sus
límites conocidos
**Para** operar el servicio sin tener que leer el código fuente para saber qué existe y qué no

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: README actualizado al cerrar el ciclo
  When se abre apps/render-api/README.md
  Then documenta cada endpoint nuevo de la cola (método, path, propósito)
  And documenta la semántica de cancelación por estado (queued vs running vs ya finalizado)
  And documenta las limitaciones conocidas: concurrencia 1, cola en memoria sin persistencia
    entre reinicios del proceso
  And documenta el resultado del smoke E2E (HU-03-07) y qué evidencia respecto de
    FIX-e-burgos-001-001
```

**Trazabilidad:** RF-29 · CA-034
**Prioridad:** Media · **Estimación:** XS

---

## Requisitos funcionales

> Texto idéntico al agregado en `spec-e-burgos-005-render-service.spec.md` § "Requisitos
> Funcionales → Ciclo 03".

- **RF-18:** Existe una cola de jobs de render en proceso, en memoria, con concurrencia 1: un único
  job en estado `running` a la vez en todo el proceso, sin importar de qué proyecto sea; el resto
  queda `queued` en orden de llegada (FIFO).
- **RF-19:** Se puede crear un job de render sobre un proyecto identificándolo sólo por su slug. El
  job lee la `Timeline` del proyecto desde `work/timeline.json` a través del store existente
  (D-13) en el momento en que la necesita; nunca la acepta por body. Si el proyecto no existe, o su
  `Timeline` no existe o no valida, la respuesta es un error tipado y ningún job queda registrado.
- **RF-20:** Se puede consultar un job por su identificador: expone su estado (`queued` | `running`
  | `succeeded` | `failed` | `canceled`), la etapa vigente del pipeline (`prepare` | `render` |
  `mix` | `mux` | `verify`) cuando está `running`, y — durante la etapa `render` — el progreso por
  frame. Un job `failed` embebe el error tipado completo (código, etapa, recurso) de la falla, y la
  consulta en sí sigue respondiendo con éxito de transporte.
- **RF-21:** Se pueden listar los jobs de un proyecto puntual, en el orden en que se crearon; el
  listado nunca incluye jobs de otro proyecto.
- **RF-22:** Se puede cancelar un job, con semántica explícita y distinta según su estado: un job
  `queued` se cancela de verdad (nunca llega a ejecutarse); un job `running` no se interrumpe a
  mitad de la invocación de un binario, pero termina en un estado observable y distinguible de
  `succeeded`/`failed`; cancelar un job ya finalizado es un error tipado que no cambia su estado
  final.
- **RF-23:** El puerto `RenderMutedVideoPort` se extiende para aceptar y propagar, sin alterarlo, el
  callback `onProgress(renderedFrames, totalFrames)` que `renderTimeline` ya expone, de modo que el
  progreso por frame de la etapa `render` llegue al estado del job.
- **RF-24:** El entregable de un job se publica en `out/<renderId>.mp4` y sus intermedios se
  conservan en `work/renders/<renderId>/` (D-8), con la misma política de conservación que la
  llamada directa a `runRenderPipeline` (`cycle-01`): ningún resultado del job borra un intermedio.
- **RF-25:** La superficie de errores se amplía con los códigos propios de la cola (job inexistente,
  cancelación no permitida por estado, etc.), cada uno con su etapa (`null` si no aplica) y su
  status HTTP, en inglés y sin `.stack` ni rutas absolutas del host (D-4).
- **RF-26:** `GET /health` refleja la capacidad de la cola de jobs en `capabilities`, sin alterar el
  cálculo de `status` (`ok`/`degraded`), que sigue dependiendo únicamente de motores y binarios.
- **RF-27:** Existe un smoke real E2E obligatorio: un job disparado por HTTP sobre un proyecto real
  de `media/` produce un MP4 cuya duración se verifica con `ffprobe` contra el **stream de video**
  (`nb_frames` dividido por `r_frame_rate` parseado como fracción), nunca contra `format.duration`;
  la salida literal del smoke queda guardada como artefacto del ciclo.
- **RF-28:** El smoke real E2E de RF-27 es la evidencia que permite marcar
  `FIX-e-burgos-001-001` como `validated` en `sdd/fixes.json` al cerrar el ciclo.
- **RF-29:** El README del subproyecto documenta los endpoints nuevos de la cola, la semántica de
  cancelación por estado, las limitaciones conocidas (concurrencia 1, cola en memoria sin
  persistencia entre reinicios) y el resultado del smoke E2E.

## Criterios de aceptación

> Texto idéntico al agregado en `spec-e-burgos-005-render-service.spec.md` § "Criterios de
> Aceptación → Ciclo 03".

- **CA-021:** Un test verifica que crear un job invoca el store para leer `work/timeline.json` del
  proyecto exactamente una vez antes de encolar, y que un `Timeline` ausente o inválida responde con
  el error tipado correspondiente (`TIMELINE_NOT_FOUND` / `TIMELINE_INVALID`) sin crear ningún job,
  verificado sobre el registro de jobs (no por el título del test).
- **CA-022:** Un test verifica que nunca hay dos jobs `running` a la vez: un job creado mientras
  otro está `running` queda `queued`, y pasa a `running` recién cuando el anterior alcanza un
  estado terminal (`succeeded`, `failed` o `canceled`) — verificado sobre el registro de
  transiciones de estado de la cola.
- **CA-023:** Un test verifica que consultar un job en la etapa `render` expone `stage: "render"` y
  un progreso que crece conforme el doble de `renderMutedVideo` invoca su callback `onProgress` con
  valores crecientes de `renderedFrames`, nunca decreciente entre dos consultas sucesivas.
- **CA-024:** Un test verifica que el tipo `RenderMutedVideoPort` acepta un `onProgress` opcional y
  que el adaptador de producción se lo reenvía a `renderTimeline` sin alterar los valores recibidos.
- **CA-025:** Un test verifica que listar los jobs de un proyecto devuelve únicamente los jobs de
  ese slug, en el mismo orden en que fueron creados, y que un proyecto sin jobs devuelve una lista
  vacía.
- **CA-026:** Un test verifica que cancelar un job `queued` lo deja en estado `canceled` sin que se
  haya invocado ningún puerto del pipeline (`renderMutedVideo`, `mixTimelineAudio`,
  `muxAudioIntoVideo`, `verifyMixLoudness`), comprobado sobre el registro de llamadas.
- **CA-027:** Un test verifica que cancelar un job `running` produce un estado terminal distinto de
  `succeeded` y de `failed`, y que cancelar un job ya `succeeded`/`failed`/`canceled` responde 409
  `RENDER_JOB_NOT_CANCELABLE` sin cambiar su estado final.
- **CA-028:** Un test verifica que consultar o cancelar un identificador de job que nunca existió
  responde 404 `RENDER_JOB_NOT_FOUND`.
- **CA-029:** Un test verifica que un job cuyo pipeline lanza en cualquier etapa
  (`prepare`/`render`/`mix`/`mux`/`verify`) queda en estado `failed` con el error tipado completo
  (código, etapa, recurso) embebido en su estado, y que la consulta de ese job sigue respondiendo
  con éxito de transporte.
- **CA-030:** Un test verifica que, tras un job exitoso, el entregable queda en
  `out/<renderId>.mp4` y que `work/renders/<renderId>/video-muted.mp4` y `master.wav` siguen
  existiendo (los intermedios no se borran), igual que D-8 para la llamada directa al pipeline.
- **CA-031:** `GET /health` responde `capabilities.jobQueue` con la capacidad habilitada y sigue
  respondiendo 200 en los dos estados de `status` conocidos (`ok`/`degraded`), sin relación con la
  cola de jobs.
- **CA-032:** Cada código de error nuevo de la cola tiene un test que lo mapea a su status HTTP y
  verifica que su payload no contiene castellano, `.stack`, ni ninguna ruta absoluta del host.
- **CA-033:** Una **ejecución real del proceso** (no un test) arranca el servidor, dispara un job de
  render por HTTP sobre un proyecto real de `media/` con `Timeline` y assets ya presentes, hace
  polling del estado del job hasta observar `succeeded`, descarga el MP4 resultante por el endpoint
  de artefactos existente (`EP-011`), y ejecuta `ffprobe` sobre el archivo descargado comparando la
  duración esperada contra el **stream de video** (`nb_frames` dividido por `r_frame_rate` parseado
  como fracción), **nunca** contra `format.duration`, dentro de la tolerancia que fije el
  architect; el resultado y la salida literal de `ffprobe` quedan guardados en
  `cycles/cycle-03/artifacts/`.
- **CA-034:** `apps/render-api/README.md` documenta los endpoints nuevos de la cola (método, path,
  propósito), la semántica de cancelación por estado, las limitaciones conocidas (concurrencia 1,
  cola en memoria sin persistencia entre reinicios) y referencia el resultado del smoke E2E
  (CA-033).
- **CA-035:** `pnpm nx run-many -t lint test build` termina en verde con `render-api` incluido, y
  `pnpm sdd:validate` en verde, sin dependencias npm nuevas (`package.json` y `pnpm-lock.yaml` sin
  cambios en todo el ciclo).
- **CA-036:** Cobertura de `apps/render-api` ≥ 80 % de statements sobre su `src/**` sostenida,
  incluyendo los archivos nuevos de la cola, con el `coverage.include` vigente **sin recortar**
  respecto de `cycle-02`.

---

## Reglas de negocio y decisiones funcionales

> Numeradas de forma local a este documento (no continúan la numeración de `cycle-02`), donde el
> brief o la spec dejaban una elección abierta.

**RN-1 — El identificador del job lo genera el servicio, nunca el cliente.**
El `renderId` se asigna al crear el job y es el mismo identificador que `runRenderPipeline` usa
internamente para nombrar `work/renders/<renderId>/` y `out/<renderId>.mp4` (`resolveRenderPipelinePaths`,
vigente desde `cycle-01`). *Fundamento:* dejar que el cliente lo elija abre colisión de nombres
entre dos creaciones concurrentes y acopla al cliente a un detalle de layout que ya es interno.

**RN-2 — Concurrencia de la cola es global, no por proyecto, y la cancelación es explícita por
estado.**
Un único job en estado `running` a la vez en todo el proceso, sin importar de qué proyecto sea; el
resto queda `queued` en orden de llegada (FIFO). Cancelar un job `queued` lo saca de la cola sin
que jamás llegue a ejecutarse. Cancelar un job `running` **no** interrumpe un binario a mitad de su
propia invocación (no se puede matar `ffmpeg`/Chrome a mitad de un paso sin arriesgar un artefacto
corrupto a medio escribir) — el estado resultante tiene que ser observable y distinguible de
`succeeded`/`failed`, nunca silencioso ni indistinguible de un job que simplemente terminó. El
mecanismo exacto (p. ej. un flag que el propio pipeline consulta entre etapas, o dejar terminar la
etapa vigente y no arrancar la siguiente) es decisión del architect; esta regla sólo fija el
contrato observable. *Fundamento:* concurrencia 1 es decisión de producto ya tomada (la máquina no
soporta dos renders simultáneos); la cancelación asimétrica es la única honesta frente a un proceso
hijo real.

**RN-3 — El job nunca acepta una `Timeline` por body: siempre la lee del store.**
La creación de un job sólo identifica el proyecto (por su slug); la `Timeline` se lee de
`work/timeline.json` a través del store ya existente (D-13), en el momento en que el job la
necesita. Si el documento no existe o no valida, el error es el mismo que ya usa `cycle-02`
(`TIMELINE_NOT_FOUND` / `TIMELINE_INVALID`) y **ningún job queda registrado**. *Fundamento:*
mantiene una única fuente de verdad para la `Timeline` (la que ya edita/editará `apps/web`,
`spec-e-burgos-006`, futuro, o la CLI) — aceptarla por body crearía una segunda vía de entrada que
puede divergir de lo persistido.

**RN-4 — El progreso por frame sólo existe durante la etapa `render`.**
`prepare`, `mix`, `mux` y `verify` reportan la etapa vigente pero no un porcentaje de avance
granular — no exponen un callback de progreso equivalente al de `renderTimeline`. El progreso de
`render` proviene exclusivamente del callback `onProgress(renderedFrames, totalFrames)` que
`renderTimeline` ya expone (`libs/composition-remotion/src/render.ts`) y que `RenderMutedVideoPort`
extiende para propagar (RF-23). *Fundamento:* inventar un progreso sintético para las otras etapas
sería un número que no mide nada real; es preferible declarar la ausencia de progreso granular que
simularlo.

**RN-5 — Un job `failed` conserva el error tipado completo, nunca deja el job en un estado
ambiguo.**
Cuando cualquier etapa del pipeline lanza durante la ejecución de un job, el job pasa a `failed` y
su estado embebe el mismo error tipado (`code`, `stage`, `resource`) que produciría la llamada
directa a `runRenderPipeline` (`cycle-01`). La consulta de ese job sigue respondiendo con éxito de
transporte (200): el fallo es del job, no de la petición que lo consulta. *Fundamento:* separa dos
preguntas distintas — "¿la consulta funcionó?" de "¿el render funcionó?" — que un status HTTP de
error mezclaría.

**RN-6 — El listado de jobs es por proyecto, no global.**
Consultar los jobs de un proyecto sólo devuelve los jobs creados para ese slug; no existe (en este
ciclo) un listado global de todos los jobs de todos los proyectos. *Fundamento:* sigue la misma
convención que ya usan los recursos de `cycle-02` (assets, timeline, edl: todos scoped a
`:slug`) y es lo que necesita el consumidor previsto (`apps/web` operando sobre un proyecto a la
vez). *Alternativa descartada:* un listado global — no tiene consumidor concreto en esta spec y
complica innecesariamente la semántica de paginación/orden.

**RN-7 — Consultar o cancelar un identificador de job inexistente es siempre un error tipado.**
No hay distinción entre "nunca existió" y "existió pero fue purgado del historial" — ambos casos
responden `404 RENDER_JOB_NOT_FOUND` (si el architect decide un límite de historial de jobs
retenidos, purgar un job viejo cae en este mismo camino).

**RN-8 — El entregable y los intermedios de un job siguen las mismas rutas y la misma política de
conservación que la llamada directa al pipeline.**
`out/<renderId>.mp4` es el entregable; `work/renders/<renderId>/video-muted.mp4` y `master.wav` son
los intermedios y **no se borran** al terminar el job, sea cual sea su resultado final (D-8, ya
vigente desde `cycle-01` para la llamada directa — este ciclo sólo confirma que dispararla desde la
cola no cambia esa garantía).

---

## Caminos de error observables

> Numeración local a este documento. El `code` es una propuesta (D-4: inglés, mayúsculas) — el
> architect fija la enumeración definitiva y la tabla completa código → etapa → status en
> `architect.md` (RF-25), reusando los códigos de `cycle-02` donde aplica (filas #2 y #3).

| # | Escenario | Cuándo ocurre | Status HTTP | Código propuesto | Comportamiento observable |
| - | --- | --- | --- | --- | --- |
| 1 | Job inexistente | Consultar o cancelar un identificador de job que nunca existió | 404 | `RENDER_JOB_NOT_FOUND` | `resource` = id de job pedido; sin efectos secundarios |
| 2 | Proyecto inexistente al crear un job | Crear un job para un slug que no existe bajo la raíz de medios | 404 | `PROJECT_NOT_FOUND` (reusado de `cycle-02`) | Ningún job queda registrado |
| 3 | Timeline ausente al crear un job | Crear un job para un proyecto sin `work/timeline.json` | 404 | `TIMELINE_NOT_FOUND` (reusado de `cycle-02`) | Ningún job queda registrado |
| 4 | Timeline inválida al crear un job | `work/timeline.json` existe pero no valida contra `TimelineSchema` | 422 | `TIMELINE_INVALID` (reusado de `cycle-02`) | Ningún job queda registrado |
| 5 | Cancelación de un job ya finalizado | Cancelar un job `succeeded`, `failed` o `canceled` | 409 | `RENDER_JOB_NOT_CANCELABLE` | El estado final del job no cambia |
| 6 | Falla del pipeline dentro de un job | Cualquier etapa (`prepare`\|`render`\|`mix`\|`mux`\|`verify`) lanza mientras el job está `running` | 200 en la consulta del job (no es un error de transporte) | Código heredado de `cycle-01`, embebido en el estado del job | El job pasa a `failed` con el error tipado completo; la consulta en sí no falla por esto |

---

## Glosario del dominio

> Extiende el glosario de `cycle-02` — no lo repite.

| Término | Definición |
| --- | --- |
| Job de render | Una ejecución encolada de `runRenderPipeline` sobre un proyecto, identificada por un `renderId` generado por el servicio. |
| Cola de jobs | Registro en memoria (sin persistencia entre reinicios) que ordena los jobs FIFO y garantiza un único `running` a la vez (concurrencia 1). |
| Estado del job | Uno de `queued`, `running`, `succeeded`, `failed`, `canceled` (los nombres exactos y un eventual estado transitorio de cancelación los fija el architect). |
| Etapa vigente (`stage`) | Una de `prepare`, `render`, `mix`, `mux`, `verify` (`RenderPipelineStage`, vigente desde `cycle-01`) — sólo tiene sentido mientras el job está `running`. |
| Progreso | Par `(renderedFrames, totalFrames)` que `renderTimeline` reporta durante la etapa `render`, propagado por `RenderMutedVideoPort` (RF-23) hasta el estado del job. |
| Smoke real E2E | Ejecución real del proceso (no un test con puertos doblados) que dispara un job por HTTP y verifica el entregable con `ffprobe` contra binarios reales. |

---

## Trazabilidad (RF ↔ HU ↔ CA)

| RF | Historias | CAs |
| --- | --- | --- |
| RF-18 | HU-03-01 (implícito: concurrencia 1 es la base de HU-03-01/03-03) | CA-022 |
| RF-19 | HU-03-01 | CA-021 |
| RF-20 | HU-03-02 | CA-023, CA-028, CA-029 |
| RF-21 | HU-03-03 | CA-025 |
| RF-22 | HU-03-04 | CA-026, CA-027, CA-028 |
| RF-23 | HU-03-02 | CA-023, CA-024 |
| RF-24 | HU-03-01 | CA-030 |
| RF-25 | HU-03-06 | CA-032 |
| RF-26 | HU-03-05 | CA-031 |
| RF-27 | HU-03-07 | CA-033 |
| RF-28 | HU-03-07 | CA-033 |
| RF-29 | HU-03-08 | CA-034 |

CA-022 (concurrencia 1 verificada sobre el registro de transiciones de estado, nunca dos jobs
`running` simultáneos) es el criterio que amarra RF-18 a un comportamiento observable propio,
ejercitado tanto por HU-03-01 (creación) como por HU-03-03 (listado que expone las transiciones).

CA-035 (lint/test/build/validate en verde, sin dependencias npm nuevas) y CA-036 (cobertura ≥ 80 %
sostenida sobre `src/**` de `apps/render-api`, `coverage.include` sin recortar respecto de
`cycle-02`) son criterios de cierre del ciclo completo, no de una historia puntual — los evalúa el
reviewer sobre el output final, igual que `CA-009`/`CA-019` en `cycle-02`.

---

## Contradicciones detectadas

Ninguna bloqueante.

- El brief no precisa si el listado de jobs (HU-03-03) es por proyecto o global. Este documento
  decide explícitamente **por proyecto** (RN-6), siguiendo la convención ya establecida por todos
  los recursos de `cycle-02` (`assets`, `timeline`, `edl`: todos scoped a `:slug`). No es una
  contradicción de la spec, sino una precisión que este documento agrega donde el brief dejaba una
  elección abierta — igual que hizo RN-2 de `cycle-02` con la validez del slug.
- La "Nota sobre rutas HTTP" de este documento es una diferencia de estilo deliberada respecto de
  `cycle-02` (que sí fijaba paths), no una omisión: el `brief.yaml` de este ciclo delega
  explícitamente los verbos y paths al architect (`EP-012..EP-0NN`), a diferencia del de `cycle-02`.
