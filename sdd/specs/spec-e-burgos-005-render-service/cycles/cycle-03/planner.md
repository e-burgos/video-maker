# Sprint Plan — Ciclo 3 — `render-service` (`apps/render-api`)

> **Input:** `brief.yaml`, `functional.md` (RF-18..RF-29, CA-021..CA-036, RN-1..RN-8), `architect.md`
> (contrato cerrado — este documento no rediseña nada)
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/planner.md`
> **Generado por:** sdd-planner (claude/sonnet, effort medium)
> **Tasks canónicas:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/tasks.json`

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 3 |
| Módulo | `render-service` |
| App | `apps/render-api` |
| Flow | `full` |
| Tasks | 21 (`TASK-001`..`TASK-021`) |
| Story points totales | 68 SP |
| Horas estimadas totales | 62 h |
| Duración estimada | ~2 semanas (implementador único, ~4-5h/día efectivas) |

**Por qué 21 tasks.** El contrato cierra 4 endpoints nuevos, 1 endpoint ampliado (`GET /health`),
18 archivos nuevos y 23 modificados (§11 del architect), y una tabla de **54 filas de test
obligatorias** repartidas en 24 archivos de `*.spec.ts` distintos (§12.1 + §12.2). Respetando el
tope de 5 story points por task (≤ 1 día), la pieza más grande y riesgosa del ciclo —
`createRenderJobQueue`, que sola concentra 11 de esas 54 filas— no entra en una sola task sin
violar el tope; se partió en dos (`TASK-009`/`TASK-010`), igual que `jobs-handler.ts`
(`TASK-017`/`TASK-018`), siguiendo el mismo patrón que `cycle-02` usó para `assets-handler.ts`.

**Fuera del alcance de este planner (recordatorio del brief).** El smoke real E2E (§13 del
architect, CA-033) **no es una task**: lo ejecuta el reviewer al cerrar el ciclo, como evidencia
independiente, contra un `apps/render-api` ya buildeado con las 21 tasks completas — igual que
`cycle-02` dejó la verificación de proceso real fuera de sus tasks. Tampoco son tasks: `CA-035`
(lint/test/build/validate en verde, sin dependencias npm nuevas) y `CA-036` (cobertura ≥ 80 %
sostenida) — son criterios de cierre del ciclo completo que el reviewer evalúa sobre el output
final, y **criterio de done implícito en todas las tasks** de este documento (`pnpm nx run-many -t
lint test build` en verde con `render-api` en la corrida).

---

## Orden de ejecución y por qué

Un solo implementador, reanudado task tras task; el orden de los IDs **es** el orden de ejecución.
`depends_on` documenta dependencias de código reales (un símbolo importado de otra task), no sólo
orden recomendado.

```
Bloque A — dominio puro del job (sin HTTP, sin fixtures de I/O)
  TASK-001 (RenderJob, estados, toRenderJob/toRenderJobSummary)
    → TASK-002 (applyRenderJobEvent, la maquina de estados)
    → TASK-003 (mergeRenderProgress, progressPercent, startRenderJobStage)

Bloque B — puertos y observador del pipeline
  TASK-004 (puerto randomId + onProgress en RenderMutedVideoInput)
    → TASK-005 (fixtures: controllable-render, recording-logger, randomId determinista)
    → TASK-006 (RenderPipelineObserver, RenderPipelineCanceledError)
    → TASK-007 (checkpoints de cancelacion + observer en runRenderPipeline)
    → TASK-008 (adaptador de produccion: reenvio de onProgress, randomId=randomUUID)

Bloque C — la cola (consume A + B completos)
  TASK-009 (createRenderJobQueue: creacion, despacho FIFO, listado)
    → TASK-010 (createRenderJobQueue: progreso, cancelacion, liquidacion con error)

Bloque D — superficie de errores y store compartido (independientes de la cola)
  TASK-011 (2 codigos de error nuevos de la cola)
  TASK-012 (project-scope.ts + migracion de montage/artifact-handler)

Bloque E — runtime y ruteo (consumen C y D)
  TASK-013 (RenderApiRuntime: cola + uploadSerializer por servidor)
    → TASK-014 (assets-handler usa runtime.uploadSerializer, fin del singleton)
  TASK-015 (routes.ts: 4 rutas nuevas + disyuncion)
  TASK-016 (health-handler: capabilities.jobQueue, cycle 3, bloque jobs)

Bloque F — handlers de jobs (consumen D + E)
  TASK-017 (handleCreateRenderJob, handleListRenderJobs)
    → TASK-018 (handleGetRenderJob, handleCancelRenderJob)

Bloque G — integracion final
  TASK-019 (handle-request: dispatch de las 4 rutas nuevas, runtime como 4to parametro)
    → TASK-020 (create-render-api-server crea el runtime y se lo pasa a handleRequest)
      → TASK-021 (README: endpoints, cancelacion, limites conocidos)
```

**Por qué el Bloque A va antes que el Bloque B.** `render-pipeline-observer.ts` (`TASK-006`) sólo
necesita el tipo `RenderProgressListener` de `render-api-dependencies.ts` (`TASK-004`), no nada del
Bloque A. Pero `createRenderJobQueue` (Bloque C) necesita **los tres** (`RenderJob`,
`applyRenderJobEvent`, `mergeRenderProgress`) además de `runRenderPipeline` con su observer ya
wireado — de ahí que A y B corran en paralelo lógico (ninguno depende del otro) pero los dos
tienen que estar completos antes de `TASK-009`.

**Por qué `createRenderJobQueue` depende de `TASK-007` y no sólo de `TASK-005`.** El paso 2 de
`runJob` en §5.3 del architect invoca `runRenderPipeline({ ... }, deps, observer)` con el
**tercer parámetro ya existente**: si `TASK-007` no cerró antes, `createRenderJobQueue` no compila
contra la firma real de `runRenderPipeline` (el `tsc` lo rechazaría con un argumento de más).

**Por qué `TASK-011` (errores) y `TASK-012` (project-scope) no dependen de nada del Bloque A/B/C.**
Los dos códigos de error nuevos (`RENDER_JOB_NOT_FOUND`, `RENDER_JOB_NOT_CANCELABLE`) son filas de
tabla puras — no importan un solo símbolo de la cola. `project-scope.ts` reusa exclusivamente
código y errores **ya existentes** desde `cycle-02` (`assertValidProjectSlug`,
`resolveExistingProject`, `PROJECT_NOT_FOUND`, `TIMELINE_NOT_FOUND`, `TIMELINE_INVALID`): nada de
la cola nueva le hace falta. Podrían ejecutarse en cualquier momento antes de `TASK-017`; se
ubicaron acá para que el implementador no tenga que volver atrás a mitad del Bloque E/F.

**Por qué `TASK-014` (assets-handler + runtime) depende de `TASK-012` y no sólo de `TASK-013`.**
`assets-handler.ts` migra a `project-scope.ts` **en la misma task** que recibe `runtime` como
parámetro (D-28 + D-23 se resuelven juntos en el mismo archivo): sin `project-scope.ts` ya
existente, el import no resuelve.

**Por qué `handle-request.ts` (`TASK-019`) va después de TODOS los handlers y del router.** Igual
que en `cycle-02` (§5.4 del architect: `switch (match.id)` exhaustivo con `satisfies never`), el
archivo **no compila** hasta que las cuatro rutas de `ROUTES` (`TASK-015`) tengan sus cuatro
handlers (`TASK-017`/`TASK-018`) y hasta que `health-handler` (`TASK-016`) y `assets-handler`
(`TASK-014`) ya acepten `runtime` en su firma — `handleRequest` les pasa el mismo objeto a los seis.
Por la misma razón `TASK-020` (`create-render-api-server`) va después: su test de socket real
(§12.2, "creates a job and reads it back over a real loopback socket") necesita una ruta de
creación de job ya wireada de punta a punta para tener algo que invocar.

**Por qué `render-job-queue.ts` se parte en dos tasks (`TASK-009` + `TASK-010`) sobre el mismo
archivo.** El contrato (§5 del architect) describe un único módulo con estado (`records`,
`pending`, `activeId`, `idleResolvers`) y una única función pública `createRenderJobQueue`, pero
sus 11 filas de test (§12.1: CA-022 ×2, CA-023, CA-025, CA-026, CA-027 ×3, CA-029, CA-030 ×2) no
entran en una sola task de ≤ 5 SP. Se partió por responsabilidad — creación/despacho/listado
(`TASK-009`) vs. progreso/cancelación/liquidación con error (`TASK-010`) — no por mitad de archivo.
**Nota de trazabilidad sobre `files[]`:** las dos tasks listan `render-job-queue.ts` y
`render-job-queue.spec.ts`; el archivo alcanza su forma definitiva recién al cerrar `TASK-010`,
igual que `cycle-02` documentó para `assets-handler.ts` (`TASK-013`/`TASK-014`). Lo mismo aplica a
`jobs-handler.ts` (`TASK-017`/`TASK-018`): la creación/listado se escribe primero, la
consulta/cancelación completa el archivo.

---

## Tasks — detalle, HU/CA cubiertas y criterio de done

Convención: `pnpm nx run-many -t lint test build` en verde con `render-api` en la corrida es
criterio de done implícito en **todas** las tasks; sólo se listan los criterios específicos.

### Bloque A — dominio puro del job

**TASK-001 — Tipo del job, estados y proyecciones puras**
HU-03-02, HU-03-03 · CA-025, CA-032.
Archivos: `src/jobs/render-job.ts(+spec)`.
Contenido: `RENDER_JOB_STATES`, `RenderJobState`, `TERMINAL_RENDER_JOB_STATES`, `RenderJobProgress`,
`RenderJob`, `RenderJobSummary`, `RenderJobBody`, `RenderJobListBody`, `toRenderJob`,
`toRenderJobSummary` (§3.1, §3.2, §5.2, §6.2 del architect). `isTerminalRenderJobState` se exporta
acá pero su test vive en `render-job-state.spec.ts` (`TASK-002`) — así lo fija la tabla §12.1 del
architect, no es un archivo faltante.
Done: `toRenderJobSummary` nunca proyecta `report`/`error` completos, sólo `errorCode`;
`toRenderJob` nunca proyecta `projectRoot` ni `timeline` (CA-032, RNF-6/RNF-8).

**TASK-002 — Máquina de estados del job (`applyRenderJobEvent`)**
HU-03-01, HU-03-04 · CA-022 (parcial: la función pura).
Archivos: `src/jobs/render-job-state.ts(+spec)`.
Depende de: `TASK-001` (`RenderJobState`, `isTerminalRenderJobState`).
Done: las seis transiciones legales de §3.3 más la auto-transición idempotente
(`canceling`+`cancel`→`canceling`) en verde; las siete filas de transiciones ilegales de §3.3
recorridas una por una (`it.each`); `isTerminalRenderJobState` reporta exactamente los tres
estados terminales.

**TASK-003 — Progreso del render**
HU-03-02 · CA-023 (parcial: las funciones puras).
Archivos: `src/jobs/render-job-progress.ts(+spec)`.
Depende de: `TASK-001` (`RenderJobProgress`).
Done: `mergeRenderProgress` descarta un `renderedFrames` menor y cualquier progreso fuera de
`render`; `progressPercent` usa piso (no redondeo) y devuelve `null` con `totalFrames <= 0`;
`startRenderJobStage` borra los contadores de frame al cambiar de etapa.

### Bloque B — puertos y observador del pipeline

**TASK-004 — Puerto `randomId` y extensión de `onProgress` en `RenderMutedVideoInput`**
HU-03-02 · sin CA propio (prerequisito de CA-024).
Archivos: `src/deps/render-api-dependencies.ts`.
Done: `RenderMutedVideoInput` gana `onProgress?: RenderProgressListener` opcional;
`RenderApiDependencies` gana el puerto `randomId: () => string` (D-24). Sin spec propio (archivo de
sólo interfaces, sin runtime) — su efecto se verifica en `TASK-007`/`TASK-008`.

**TASK-005 — Fixtures de test: doble controlable de render, logger que graba, `randomId`
determinista**
HU-03-02, HU-03-04 · soporte de CA-022, CA-023, CA-026, CA-027, CA-029 (§12.4 del architect).
Archivos: `src/__fixtures__/fake-render-api-dependencies.ts` (M),
`src/__fixtures__/controllable-render.ts` (N), `src/__fixtures__/recording-logger.ts` (N).
Depende de: `TASK-004` (el puerto `randomId` tiene que existir para agregarlo al fixture).
Done: `createControllableRenderMutedVideo()` devuelve `{ port, started, emitProgress, resolve,
reject }` sobre un `createDeferred<T>()` propio, sin timers; `createRecordingLogger()` acumula
`LogEvent`s consultables; `createFakeRenderApiDependencies` suma `randomId` con contador
determinista (`render-0001`, `render-0002`, …) sin cambiar la forma de ningún otro campo. Ninguno
de los tres archivos lleva `.spec.ts` (excluidos de `coverage.include` desde `cycle-01`).

**TASK-006 — Observador del pipeline (`RenderPipelineObserver`, `RenderPipelineCanceledError`)**
HU-03-04 · CA-027 (parcial: el tipo y la clase de error).
Archivos: `src/pipeline/render-pipeline-observer.ts(+spec)`.
Depende de: `TASK-004` (`RenderProgressListener`).
Done: `isRenderPipelineCanceled` reconoce su propia clase y rechaza cualquier otro valor;
`RenderPipelineCanceledError` carga la etapa que no llegó a empezar.

**TASK-007 — Checkpoints de cancelación y propagación del observer en `runRenderPipeline`**
HU-03-02, HU-03-04 · CA-024 (parcial), CA-027 (parcial).
Archivos: `src/pipeline/run-render-pipeline.ts(+spec)`.
Depende de: `TASK-005` (fixture controlable para sostener el pipeline en una etapa de forma
determinista), `TASK-006` (observer, error de cancelación).
Done: tercer parámetro `observer?` opcional, firma pública y `RenderPipelineReport` sin cambios;
cinco `stageStarted` en orden; cuatro checkpoints (`render`, `mix`, `mux`, `verify`) **fuera** de
`runStage`; `it.each` sobre los cuatro checkpoints verifica que lanzan `RenderPipelineCanceledError`
**antes** de invocar el puerto de esa etapa; la clave `onProgress` se omite (no `undefined`) cuando
no hay observer; los tests vigentes de `cycle-01` **no se tocan** y siguen en verde.

**TASK-008 — Adaptador de producción: reenvío de `onProgress`, `randomId=randomUUID`**
HU-03-02 · CA-024 (parcial).
Archivos: `src/deps/node-render-api-dependencies.ts(+spec)`.
Depende de: `TASK-004`.
Done: `renderMutedVideo` reenvía la referencia de `onProgress` tal cual, sin envolverla; la
aserción vigente de `node-render-api-dependencies.spec.ts:80` (omite la clave sin listener) sigue
pasando intacta; `randomId` del adaptador de producción es `randomUUID()` de `node:crypto`,
confinado a este archivo (invariante del §15 del architect).

### Bloque C — la cola

**TASK-009 — Cola de render: creación, despacho FIFO y listado (parte 1)**
HU-03-01, HU-03-03 · CA-022 (parcial), CA-025 (parcial).
Archivos: `src/jobs/render-job-queue.ts(+spec)` (creación del archivo; ver nota de partición).
Depende de: `TASK-001`, `TASK-002`, `TASK-003`, `TASK-005`, `TASK-007`.
Done: `create` es síncrona y no toca el filesystem; nunca hay dos jobs `running` a la vez
(verificado sobre `size()` y sobre las transiciones grabadas por `createRecordingLogger`); el
segundo job de dos concurrentes despacha recién cuando el primero alcanza cualquiera de los tres
finales (`succeeded`/`failed`/`canceled`, `it.each`); `listBySlug` devuelve sólo los jobs de ese
slug, en orden de creación.

**TASK-010 — Cola de render: progreso, cancelación y liquidación con error (parte 2, completa el
archivo)**
HU-03-01, HU-03-02, HU-03-04 · CA-023 (parcial), CA-026, CA-027 (parcial), CA-029, CA-030.
Archivos: `src/jobs/render-job-queue.ts`, `src/jobs/render-job-queue.spec.ts` (completa el
checklist de §12.1 para este archivo).
Depende de: `TASK-009`.
Done: `stage: "render"` con `percent` que nunca decrece entre dos `get()` sucesivos aunque el doble
emita un `renderedFrames` menor; cancelar un job `queued` no invoca ningún puerto del pipeline
(`callLog.ports()` verificado); un job `running` cancelado se mueve a `canceling` y liquida
`canceled` en el próximo checkpoint; cancelar durante `verify` liquida `canceled` y **descarta**
el `report` aunque el pipeline haya completado; cancelar dos veces un `canceling` responde el mismo
resultado sin cambiar nada; `it.each` sobre las cinco etapas liquida `failed` con el error tipado
completo; el entregable reporta `out/<id>.mp4` y ambos intermedios bajo `work/renders/<id>/`;
ningún resultado invoca un puerto de borrado.

### Bloque D — superficie de errores y store compartido

**TASK-011 — Superficie de errores: dos códigos nuevos de la cola**
HU-03-06 · CA-032 (parcial).
Archivos: `src/errors/render-api-error.ts`, `src/errors/http-status-for.ts(+spec)`,
`src/errors/to-error-payload.ts(+spec)`.
Done: `RENDER_API_ERROR_CODES` pasa de 35 a 37; `http-status-for.spec.ts` cubre las 37 filas
(`RENDER_JOB_NOT_FOUND`→404, `RENDER_JOB_NOT_CANCELABLE`→409); `to-error-payload.spec.ts` emite un
mensaje ASCII en inglés para las 37 y nunca una ruta absoluta del host (lista ampliada con los dos
códigos nuevos); los dos mensajes coinciden literalmente con §9 del architect.

**TASK-012 — `project-scope.ts` y migración de `montage-handler`/`artifact-handler`**
HU-03-01 · CA-021 (parcial: los símbolos puros).
Archivos: `src/store/project-scope.ts(+spec)`, `src/http/handlers/montage-handler.ts`,
`src/http/handlers/artifact-handler.ts`.
Done: `readStoredTimeline` invoca el store con exactamente `['stat', 'readTextFile']` (un solo
`readTextFile` de `work/timeline.json`); lanza `TIMELINE_NOT_FOUND`/`TIMELINE_INVALID` según
corresponda; `resolveExistingProject` lanza `PROJECT_NOT_FOUND` si la raíz falta o no es
directorio; `assertValidProjectSlug` migra desde su duplicado inline; **ninguna aserción de
`montage-handler.spec.ts` ni `artifact-handler.spec.ts` cambia** (migración sin efecto
observable, D-28).

**TASK-013 — `RenderApiRuntime`: cola y `uploadSerializer` por servidor**
HU-03-01 · sin CA propio (soporte de §12.2).
Archivos: `src/http/render-api-runtime.ts(+spec)`.
Depende de: `TASK-010` (`createRenderJobQueue` ya completo).
Done: `createRenderApiRuntime(deps)` crea una `RenderJobQueue` y un `KeyedSerializer` nuevos por
invocación; dos runtimes son independientes (un job creado en uno no aparece en el otro).

**TASK-014 — Cableado del runtime en `assets-handler` (fin del singleton `uploadSerializer`)**
HU-03-01 · sin CA propio (D-23, deuda saldada).
Archivos: `src/http/handlers/assets-handler.ts(+spec)`.
Depende de: `TASK-012` (importa `project-scope`), `TASK-013` (`RenderApiRuntime`).
Done: `handleUploadAsset` gana el quinto parámetro `runtime` y usa `runtime.uploadSerializer.run(...)`
en vez del singleton de módulo; `createKeyedSerializer` no se toca; **ninguna aserción vigente de
`assets-handler.spec.ts` cambia**, sólo se les pasa el `runtime` a las llamadas.

**TASK-015 — Rutas nuevas de jobs y verificación de disyunción**
HU-03-01, HU-03-02, HU-03-03, HU-03-04 · soporte de §12.2 (sin CA propio: la gramática del router).
Archivos: `src/http/routes.ts`, `src/http/router.spec.ts`.
Done: las cuatro filas nuevas de `ROUTES` (§6.5 del architect: `projects.jobs.create`,
`projects.jobs.list`, `jobs.detail`, `jobs.cancel`); `router.spec.ts` matchea los cuatro patrones
con sus params; el test vigente "no two ROUTES patterns match the same concrete path" **no se
toca** y pasa a recorrer 15 patrones; `PATCH /jobs/x` responde `method-not-allowed` con
`allow: ['GET', 'DELETE']`.

**TASK-016 — `GET /health` declara `capabilities.jobQueue`, `cycle: 3` y el bloque `jobs`**
HU-03-05 · CA-031.
Archivos: `src/http/health-handler.ts(+spec)`.
Depende de: `TASK-013` (`runtime.jobs.size()`).
Done: `capabilities.jobQueue: true` y `cycle: 3`; `jobs: { running, queued }` refleja
`runtime.jobs.size()`; `status` sigue en 200 en `ok` y en `degraded`, sin relación con `jobs`
(CA-018 de `cycle-02` aplicada de nuevo).

### Bloque F — handlers de jobs

**TASK-017 — Handlers de creación y listado de jobs**
HU-03-01, HU-03-03 · CA-021 (parcial: el handler), CA-025 (parcial: el handler).
Archivos: `src/http/handlers/jobs-handler.ts(+spec)` (creación del archivo; ver nota de partición).
Depende de: `TASK-011` (códigos reusados), `TASK-012` (`project-scope`), `TASK-013` (`runtime`).
Done: `handleCreateRenderJob` responde `202` con `location: /jobs/<id>` y un `id` generado por el
servicio, encolando exactamente un job (`queue.listBySlug(slug)` de longitud 1); `it.each` sobre
los cuatro rechazos (`PROJECT_SLUG_INVALID`, `PROJECT_NOT_FOUND`, `TIMELINE_NOT_FOUND`,
`TIMELINE_INVALID`) no registra ningún job; `handleListRenderJobs` responde `200` con `jobs: []`
para un slug sin jobs.

**TASK-018 — Handlers de consulta y cancelación de jobs (completa el archivo)**
HU-03-02, HU-03-04 · CA-026 (parcial), CA-027 (parcial), CA-028, CA-029 (parcial), CA-032
(parcial).
Archivos: `src/http/handlers/jobs-handler.ts`, `src/http/handlers/jobs-handler.spec.ts` (completa
el checklist de §12.1 para este archivo).
Depende de: `TASK-011`, `TASK-017`.
Done: `handleCancelRenderJob` responde `200`/`canceled` sobre un job `queued`, `202`/`canceling`
sobre uno `running`, `409 RENDER_JOB_NOT_CANCELABLE` (`it.each` sobre `succeeded`/`failed`/
`canceled`) sin cambiar el estado, `404 RENDER_JOB_NOT_FOUND` sobre un id inexistente; el payload
de los dos errores de la cola no tiene `.stack`, castellano ni ruta absoluta; `handleGetRenderJob`
responde `404` sobre un id inexistente y `200` con el error tipado embebido para un job `failed`
(la consulta en sí no falla).

### Bloque G — integración final

**TASK-019 — Dispatch de las cuatro rutas nuevas en `handle-request`**
HU-03-01, HU-03-02, HU-03-03, HU-03-04, HU-03-05 · soporte de §12.2 (sin CA propio).
Archivos: `src/http/handle-request.ts(+spec)`.
Depende de: `TASK-014` (assets-handler ya acepta runtime), `TASK-015` (rutas), `TASK-016`
(health-handler con runtime), `TASK-018` (jobs-handler completo).
Done: `handleRequest` gana el cuarto parámetro obligatorio `runtime`; cuatro `case` nuevos en el
`switch` exhaustivo (`satisfies never` obliga a cubrirlos); `handle-request.spec.ts` recorre las 15
rutas y ninguna cae en 404; `handleListRenderJobs`/`handleGetRenderJob`/`handleCancelRenderJob` no
reciben `deps` ni `store` (verificable por el compilador, CA-026).

**TASK-020 — `RenderApiRuntime` cableado en `create-render-api-server`**
HU-03-01 · soporte de §12.2 (sin CA propio).
Archivos: `src/http/create-render-api-server.ts(+spec)`.
Depende de: `TASK-019`.
Done: `createRenderApiServer(deps, config, store)` crea un `RenderApiRuntime` y se lo pasa a
`handleRequest`; `main.ts` **no cambia** (sigue llamando con la misma firma de tres argumentos); el
test de socket real ("creates a job and reads it back over a real loopback socket") crea un job por
HTTP y lo relee sobre un socket loopback real.

**TASK-021 — README del subproyecto**
HU-03-08 · CA-034 (parcial: lo verificable de forma estática).
Archivos: `apps/render-api/README.md`.
Depende de: `TASK-020` (documenta el ciclo ya implementado).
Done: documenta los cuatro endpoints nuevos (método, path, propósito); la tabla de cancelación por
estado previo (§6.4 del architect); los límites conocidos (concurrencia 1, cola en memoria sin
persistencia entre reinicios, sin cap de historial); cómo componer la URL de descarga con `EP-011`.
**Nota de cierre:** el resultado literal del smoke real E2E (CA-033) y la mención a
`FIX-e-burgos-001-001` como evidencia sólo pueden documentarse **después** de que el reviewer lo
ejecute (no es una task de implementación) — el reviewer completa esa sección del README al cerrar
el ciclo, no esta task.

---

## Riesgos de secuencia detectados

1. **`render-job-queue.ts` no compila hasta que `run-render-pipeline.ts` acepta el tercer parámetro
   `observer`** (`TASK-007` antes que `TASK-009`). Es el mismo tipo de riesgo que `cycle-02`
   documentó para `handle-request.ts`: un `switch`/una llamada con más argumentos de los que la
   firma vigente acepta no compila, así que el orden no es negociable.
2. **`handle-request.ts` no compila hasta que las cuatro rutas tengan handler Y hasta que
   `health-handler`/`assets-handler` acepten `runtime`.** Reflejado en `depends_on` de `TASK-019`;
   es el riesgo de secuencia más fácil de romper si alguien reordena tasks manualmente (igual que
   `cycle-02` §"Riesgos de secuencia" punto 1).
3. **`render-job-queue.spec.ts` y `jobs-handler.spec.ts` compartidos entre dos tasks cada uno.** Ver
   nota de trazabilidad de la sección "Orden de ejecución" — no son archivos faltantes, son
   decisiones deliberadas de a qué task se le atribuye el cierre del checklist de §12.1.
4. **`create-render-api-server.spec.ts` (test de socket real) depende de `TASK-019`, no sólo de
   `TASK-013`.** Antes de que las cuatro rutas de jobs estén wireadas en `handle-request`, ese test
   no tiene una ruta real de creación de job que ejercitar sobre el socket loopback.
5. **Ningún hueco de contrato detectado.** El architect.md cierra explícitamente el modelo del job,
   la máquina de estados, la firma de la cola, los cuatro endpoints con sus payloads y errores, la
   propagación del progreso, la cancelación por estado, los dos códigos nuevos, la ampliación de
   `/health` y el árbol completo de archivos. Los seis riesgos que el propio architect deja abiertos
   (§17: la cola no sobrevive al reinicio, la cancelación puede tardar una etapa entera, un job
   `canceled` puede dejar un entregable completo, la concurrencia 1 es intra-proceso, `totalFrames`
   viene de Remotion y no de la `Timeline`, `jobs-handler.ts` concentra los cuatro endpoints) no
   generan tasks nuevas — son limitaciones conocidas del diseño, declaradas para el README
   (`TASK-021`), no trabajo pendiente de este ciclo.

## Fuera del alcance de este planner (recordatorio)

El smoke real E2E (§13 del architect, CA-033) **no es una task**: lo ejecuta el reviewer al cerrar
el ciclo, como evidencia independiente, contra el `apps/render-api` ya buildeado con las 21 tasks
completas — y es la evidencia que permite marcar `FIX-e-burgos-001-001` como `validated` (RF-28).
Tampoco son tasks: `apps/render-api/eslint.config.mjs` (D-9, sigue sin crearse), MinIO/URLs
firmadas (D-11), concurrencia > 1 o workers en procesos separados, persistencia de jobs entre
reinicios, cualquier UI (`spec-006`), ni ninguna dependencia npm nueva (D-2/RNF-11).
