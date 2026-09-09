# Architect — Cycle 03: `render-job-queue-and-delivery` (`render-service`)

> **Input:** `cycles/cycle-03/brief.yaml` · `cycles/cycle-03/functional.md` (RF-18..RF-29,
> RNF-11..RNF-13, CA-021..CA-036, RN-1..RN-8) · `spec-e-burgos-005-render-service.spec.md`
> (D-1..D-17) · `sdd/context/apps/render-api/updates/*.md` (estado real) ·
> `cycles/cycle-02/architect.md` (formato: §4 endpoints, §6.1 errores, §9 árbol, §11 tests, §14 configs)
> **Output:** `cycles/cycle-03/architect.md`
> **Generado por:** sdd-architect · **Corre antes que el planner**: las tasks nacen sobre estas firmas.

Este documento cierra la spec. Todo lo que quede abierto acá se decide mal después.

---

## 1. Alcance del contrato

### 1.1 Qué cierra este documento

1. El modelo del job (`RenderJob`), su enum de estados y la **máquina de estados completa** —
   transiciones legales y las ilegales, explícitas (§3).
2. El progreso: etapa vigente + `renderedFrames`/`totalFrames` + porcentaje, y su regla de
   monotonía (§4).
3. La cola: firma, despacho FIFO con concurrencia 1, dónde vive la instancia y por qué (§5),
   incluida la resolución de la deuda heredada `uploadSerializer` (§5.4).
4. Los cuatro endpoints nuevos `EP-012`..`EP-015` con request, payload literal de éxito y todos
   sus errores con status (§6).
5. La propagación de `onProgress` por `RenderMutedVideoPort` hasta `renderTimeline` (§7).
6. La cancelación: semántica exacta por estado, estado transitorio, y qué **no** se le promete al
   consumidor (§8).
7. Los dos códigos de error nuevos con etapa, status y caso de emisión (§9).
8. `GET /health`: el campo nuevo de la cola y por qué no entra en `ok`/`degraded` (§10).
9. La lista cerrada de archivos nuevos y modificados (§11).
10. La tabla de tests obligatorios por CA, **por símbolo invocado** (§12).
11. El guion del smoke real E2E, copiable y correcto (§13).
12. Las decisiones `D-18`..`D-29` con fundamento (§14).

### 1.2 Qué NO cierra (y no se implementa)

- **Concurrencia > 1, workers en procesos separados, locks entre procesos.** El riesgo entre
  procesos ya está documentado (README § "Known risk", `cycle-02` §16.2); subirlo es otra spec.
- **Persistencia de los jobs entre reinicios** (RNF-12): la cola es en memoria y el README lo declara.
- **MinIO / URLs firmadas** (D-11): el puerto `ObjectStorage` conserva su único adaptador `fs`.
- **`apps/render-api/eslint.config.mjs`** (D-9): no se crea. El bloque propuesto se actualiza en §15.
- **Re-master o reintento ante `withinTolerance: false`** (D-7): se publica el entregable y se
  reporta el delta. Vale también dentro del smoke real (§13).
- **Fuera de mi alcance, con dueño en otro FIX GATE del orquestador:** `coverage.include` de
  `libs/composition-remotion/vite.config.ts` (D-6) y los follow-ups de `tools/render-cli`
  (D-5: token genérico `[uso]`, salida bilingüe). Este documento no los diseña ni los referencia
  como dependencia.
- **Cualquier UI**: `apps/web` es `spec-e-burgos-006`.

### 1.3 Schema de datos

`apps/render-api` **no tiene base de datos** (igual que en `cycle-01` y `cycle-02`). El "schema"
de este ciclo es un registro en memoria del proceso (`Map<string, RenderJobRecord>`), sin
persistencia (RNF-12). `sdd/schema.json` no cambia.

### 1.4 Restricciones que este diseño respeta por construcción

| Restricción | Cómo la cumple este diseño |
| --- | --- |
| **Cero dependencias npm nuevas** (D-2, RNF-11) | La cola es un `Map` + un array FIFO + un `async` sin `await` de despacho. Sin timers, sin `AbortController`, sin librería de colas. Los ids salen de un **puerto** (`randomId`), no de un import (§14 D-24). |
| **Suite sin ffmpeg/ffprobe/whisper/Chrome** (RNF-3/RNF-9) | La cola sólo habla con `RenderApiDependencies`. El único doble nuevo es un `renderMutedVideo` controlable (§12.4). Ningún `*.spec.ts` nuevo importa `execa`, `node:child_process` ni las libs pesadas por su entrada real. |
| **`coverage.include` sin recortar** (RNF-10, CA-036) | `apps/render-api/vite.config.ts` **no se toca** en este ciclo. Cada archivo nuevo con runtime tiene su `*.spec.ts` hermano; los únicos sin spec son `__fixtures__/**` (ya excluidos) — no hay ningún archivo de sólo tipos nuevo. |
| **`eslint.config.mjs` no se crea** (D-9) | §15: el bloque propuesto se actualiza en este documento; este ciclo **no suma** ningún import restringido nuevo. |
| **Sin comentarios, identificadores y payloads en inglés** (D-4, RNF-4) | Todos los símbolos, `code`, `state`, `stage` y campos de payload de este documento están en inglés. |
| **Sin rutas absolutas del host en ningún payload** (RNF-6/RNF-8) | El job expone `report.deliverable.resource` e `intermediates.*Resource`, que `resolveRenderPipelinePaths` ya produce relativos al proyecto. El `projectRoot` absoluto vive en el registro interno del job y **nunca** se proyecta al body (§2.3). |

---

## 2. Punto de partida literal

### 2.1 Estado real de `apps/render-api` al abrir el ciclo

Leído del código, no de los archivos base de contexto (que están desactualizados a propósito):

| Hecho | Evidencia |
| --- | --- |
| `runRenderPipeline(request, deps)` existe desde `cycle-01` y **no tiene un solo llamador de producción** | `src/pipeline/run-render-pipeline.ts`; `handle-request.ts` no lo menciona |
| `RenderMutedVideoPort` **no** propaga progreso | `src/deps/render-api-dependencies.ts:22` — `RenderMutedVideoInput` tiene sólo `timeline`, `outPath`, `publicDir` |
| `renderTimeline` **sí** expone `onProgress(renderedFrames, totalFrames)` | `libs/composition-remotion/src/render.ts:39` y `:171`; el adaptador de la lib lo cablea a `renderMedia` en `:121` |
| `health-handler.ts` ya declara `capabilities.jobQueue: false` y `SERVICE_CYCLE = 2` | `src/http/health-handler.ts:8`, `:43` |
| `handleRequest(request, deps, store)` tiene tres parámetros y un `switch` exhaustivo sobre `RouteId` | `src/http/handle-request.ts:20` y `:71` (`match.id satisfies never`) |
| `ROUTES` tiene 11 entradas; el router soporta `:param` y `*path` (uno solo, al final) | `src/http/routes.ts`, `src/http/router.ts:16-29` |
| Un test recorre `ROUTES` y verifica que **ningún patrón matchee el path canónico de otro** | `src/http/router.spec.ts:95` (`canonicalPathFor` reemplaza `:x`→`example`, `*x`→`a/b/c`) |
| `uploadSerializer = createKeyedSerializer()` es un **singleton de módulo** | `src/http/handlers/assets-handler.ts:21` — deuda declarada en el fragmento de contexto de `cycle-02` |
| `assertValidProjectSlug` y `resolveExistingProject` están **duplicados** en `montage-handler.ts` y `artifact-handler.ts`, e inlineados en `assets-handler.ts` | los tres archivos de `src/http/handlers/` |
| `RENDER_API_ERROR_CODES` tiene 35 entradas; `STATUS_BY_CODE` y `MESSAGE_BY_CODE` son `Readonly<Record<RenderApiErrorCode, …>>` | `src/errors/render-api-error.ts:5-41`, `http-status-for.ts:3`, `to-error-payload.ts:4` |
| `node:crypto` y `node:fs` están confinados a `src/deps/node-render-api-dependencies.ts` y `src/main.ts` | invariante verificado por grep al cerrar `cycle-02` (§15) |
| `verifyMixLoudness` tolera `±1 LU` de integrado y `≤ 0 dB` de true peak | `libs/media-local/src/ffmpeg/verify-mix-loudness.ts:7-8`, `:37-38` |

### 2.2 Qué se reusa sin tocar

- `resolveRenderPipelinePaths(projectRoot, renderId)` (`src/pipeline/render-pipeline-paths.ts`):
  el `renderId` del job **es** el `renderId` del pipeline (RN-1), así que `out/<renderId>.mp4` y
  `work/renders/<renderId>/` salen de ahí sin una sola línea nueva.
- `resolveMediaProject`, `timelinePath`, `toAbsolutePath` de `@video-maker/auto-montage` (D-13).
- `TimelineSchema` de `@video-maker/timeline-core`.
- `PipelineStageError`, `toErrorPayload`, `httpStatusFor`, `translateEngineError` (`src/errors/`).
- `createKeyedSerializer` (`src/store/serialize-by-key.ts`): la función es correcta; lo que cambia
  es **dónde vive su instancia** (§5.4).
- `EP-011` `GET /projects/:slug/files/*path`: es el endpoint de descarga del entregable. **No se
  crea ningún endpoint de descarga nuevo.**

### 2.3 Qué nunca sale al payload

`RenderJobRecord` (el registro interno de la cola) guarda `projectRoot` (ruta **absoluta**) y la
`Timeline` completa. Ninguno de los dos se proyecta a `RenderJobBody` ni a `RenderJobSummary`
(RNF-6/RNF-8). La proyección es una función pura con su test (§12, CA-032).

---

## 3. Modelo del job y máquina de estados

### 3.1 Estados

```ts
export const RENDER_JOB_STATES = [
  'queued',
  'running',
  'canceling',
  'succeeded',
  'failed',
  'canceled',
] as const;

export type RenderJobState = (typeof RENDER_JOB_STATES)[number];

export const TERMINAL_RENDER_JOB_STATES = ['succeeded', 'failed', 'canceled'] as const;

export function isTerminalRenderJobState(state: RenderJobState): boolean;
```

`canceling` es el **único** estado que el `functional.md` no nombra: RN-2 y HU-03-04 dejan
explícitamente al architect decidir "si existe un estado transitorio". Existe, y es observable
(D-21, §14).

### 3.2 El tipo del job

```ts
import type { RenderPipelineStage } from '../errors/render-api-error';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';

export interface RenderJobProgress {
  readonly stage: RenderPipelineStage;
  readonly renderedFrames: number | null;
  readonly totalFrames: number | null;
  readonly percent: number | null;
}

export interface RenderJob {
  readonly id: string;
  readonly slug: string;
  readonly state: RenderJobState;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly progress: RenderJobProgress | null;
  readonly report: RenderPipelineReport | null;
  readonly error: RenderApiErrorPayload | null;
}
```

Reglas de los campos, todas verificables:

| Campo | Regla |
| --- | --- |
| `id` | Lo genera el servicio (RN-1) por el puerto `randomId` (§14 D-24). Es el `renderId` del pipeline y el stem de `out/<id>.mp4`. El cliente nunca lo propone. |
| `slug` | El del proyecto sobre el que se creó. Es el único eje del listado (RN-6). |
| `state` | Uno de los seis de §3.1. |
| `createdAt` | `deps.clock.nowIso()` en la creación. Nunca cambia. |
| `startedAt` | `deps.clock.nowIso()` en la transición `queued → running`. `null` mientras el job esté `queued` y para siempre si se cancela en cola. |
| `finishedAt` | `deps.clock.nowIso()` en la transición a un estado terminal. `null` en `queued`, `running` y `canceling`. |
| `progress` | `null` **sólo** mientras el job está `queued`. Se llena en `stageStarted('prepare')` y **se congela** en su último valor al llegar a un estado terminal (D-25). |
| `report` | `RenderPipelineReport` **sólo** en `succeeded`. `null` en todo otro estado, incluido `canceled` (aunque el entregable exista en disco, §8.4). |
| `error` | `RenderApiErrorPayload` **sólo** en `failed`. `null` en todo otro estado. |

`report` y `error` son mutuamente excluyentes por construcción: la única transición que escribe
`report` es `running → succeeded` y la única que escribe `error` es `running → failed`.

### 3.3 La máquina de estados

Eventos (lo único que puede mover un job):

```ts
export type RenderJobEvent =
  | { readonly kind: 'dispatch' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'settle'; readonly failed: boolean };

export type RenderJobTransition =
  | { readonly kind: 'moved'; readonly state: RenderJobState }
  | { readonly kind: 'rejected' };

export function applyRenderJobEvent(state: RenderJobState, event: RenderJobEvent): RenderJobTransition;
```

**Transiciones legales (las seis, y no hay más):**

| Desde | Evento | Hacia | Quién lo dispara |
| --- | --- | --- | --- |
| `queued` | `dispatch` | `running` | el despachador de la cola, sólo si no hay job ocupando el slot |
| `queued` | `cancel` | `canceled` | `DELETE /jobs/:jobId` (EP-015). Terminal inmediato |
| `running` | `cancel` | `canceling` | `DELETE /jobs/:jobId`. **No** terminal |
| `running` | `settle{failed:false}` | `succeeded` | el worker, cuando `runRenderPipeline` resolvió |
| `running` | `settle{failed:true}` | `failed` | el worker, cuando `runRenderPipeline` lanzó |
| `canceling` | `settle{failed:*}` | `canceled` | el worker, **cualquiera sea el resultado del pipeline** |

**Auto-transición idempotente (una):** `canceling` + `cancel` → `canceling` (`moved`, mismo
estado). Cancelar dos veces un job que ya está cancelándose es la misma petición repetida, no un
conflicto: por eso **no** es 409 (§8.2).

**Transiciones ilegales (`rejected`), explícitas.** Toda combinación que no esté en las dos tablas
de arriba devuelve `{ kind: 'rejected' }`. Enumeradas para que el test las recorra una por una:

| Desde | Evento ilegal | Por qué |
| --- | --- | --- |
| `queued` | `settle{*}` | un job que nunca corrió no tiene resultado que liquidar |
| `running` | `dispatch` | violaría concurrencia 1 (RF-18) |
| `canceling` | `dispatch` | ídem; además el slot sigue ocupado por el binario en curso |
| `canceling` | *(ninguna otra)* | `cancel` es la auto-transición idempotente; `settle` es legal |
| `succeeded` | `dispatch`, `cancel`, `settle{*}` | terminal: `cancel` es el 409 de RF-22 |
| `failed` | `dispatch`, `cancel`, `settle{*}` | ídem |
| `canceled` | `dispatch`, `cancel`, `settle{*}` | ídem |

**Consecuencia deliberada:** no existe `running → canceled` directa. Un job en ejecución **siempre**
pasa por `canceling`, porque siempre hay un binario que termina su invocación (§8).

### 3.4 Diagrama

```
                  cancel
        ┌───────────────────────────────────────────► canceled ◄──────────┐
        │                                                                 │
     queued ──dispatch──► running ──settle{failed:false}──► succeeded     │ settle{*}
                             │                                            │
                             ├────settle{failed:true}────► failed         │
                             │                                            │
                             └────────cancel────────► canceling ──────────┘
                                                          ▲   │
                                                          └───┘ cancel (idempotente)
```

---

## 4. Progreso

### 4.1 Origen de cada dato

| Dato | Origen real | Etapas en las que existe |
| --- | --- | --- |
| `stage` | `observer.stageStarted(stage)` que `runRenderPipeline` invoca al empezar cada una de sus cinco etapas (§7.2) | las cinco: `prepare`, `render`, `mix`, `mux`, `verify` |
| `renderedFrames` / `totalFrames` | `onProgress(renderedFrames, totalFrames)` de `renderTimeline`, propagado por `RenderMutedVideoPort` (§7.1) | **sólo** `render` (RN-4) |
| `percent` | derivado de los dos anteriores | **sólo** `render`, y sólo después del primer `onProgress` |

`prepare`, `mix`, `mux` y `verify` reportan `renderedFrames: null`, `totalFrames: null`,
`percent: null`. **No se inventa** un progreso sintético para ellas (RN-4).

### 4.2 Firmas

```ts
export function startRenderJobStage(
  previous: RenderJobProgress | null,
  stage: RenderPipelineStage,
): RenderJobProgress;

export function mergeRenderProgress(
  previous: RenderJobProgress | null,
  renderedFrames: number,
  totalFrames: number,
): RenderJobProgress;

export function progressPercent(renderedFrames: number, totalFrames: number): number | null;
```

Reglas:

- **`startRenderJobStage`** devuelve `{ stage, renderedFrames: null, totalFrames: null, percent: null }`.
  Cambiar de etapa **borra** los contadores de frame: son de `render` y de ninguna otra (RN-4).
  Ignora `previous` por completo; el parámetro existe para que la firma sea la misma que la de
  `mergeRenderProgress` y el llamador no tenga que ramificar.
- **`mergeRenderProgress`** es **monotónica por construcción** (CA-023): si
  `previous.stage !== 'render'` devuelve `previous` sin tocar; si
  `renderedFrames < previous.renderedFrames` devuelve `previous` sin tocar; en el resto devuelve
  `{ stage: 'render', renderedFrames, totalFrames, percent: progressPercent(...) }`.
  *Fundamento:* la garantía "nunca menor entre dos consultas sucesivas" no puede depender de que el
  productor sea monotónico. `renderMedia` lo es hoy; el contrato del puerto no lo exige.
- **`progressPercent`** devuelve `null` si `totalFrames <= 0`; en el resto,
  `Math.min(100, Math.max(0, Math.floor((renderedFrames / totalFrames) * 100)))`.
  Piso, no redondeo: un job al 99,6 % no dice 100 antes de terminar.

### 4.3 Ejemplo con el proyecto real del smoke

`media/smoke-ingest/work/timeline.json` tiene `format: { preset: 'reels-9x16', width: 1080,
height: 1920, fps: 30 }` y `durationFrames: 538`. `renderTimeline` invoca
`onProgress(renderedFrames, composition.durationInFrames)`, así que `totalFrames` es `538`:

| `onProgress` recibido | `progress` publicado |
| --- | --- |
| — (todavía en `prepare`) | `{ "stage": "prepare", "renderedFrames": null, "totalFrames": null, "percent": null }` |
| `(0, 538)` | `{ "stage": "render", "renderedFrames": 0, "totalFrames": 538, "percent": 0 }` |
| `(120, 538)` | `{ "stage": "render", "renderedFrames": 120, "totalFrames": 538, "percent": 22 }` |
| `(119, 538)` (regresión del productor) | sin cambio: sigue `120` / `22` |
| `(538, 538)` | `{ "stage": "render", "renderedFrames": 538, "totalFrames": 538, "percent": 100 }` |
| etapa `mix` | `{ "stage": "mix", "renderedFrames": null, "totalFrames": null, "percent": null }` |

---

## 5. La cola

### 5.1 Firma

```ts
import type { Timeline } from '@video-maker/timeline-core';

export interface CreateRenderJobInput {
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
}

export type CancelRenderJobResult =
  | { readonly kind: 'canceled'; readonly job: RenderJob }
  | { readonly kind: 'canceling'; readonly job: RenderJob }
  | { readonly kind: 'not-cancelable'; readonly job: RenderJob }
  | { readonly kind: 'not-found' };

export interface RenderJobQueueSize {
  readonly running: number;
  readonly queued: number;
}

export interface RenderJobQueue {
  readonly create: (input: CreateRenderJobInput) => RenderJob;
  readonly get: (jobId: string) => RenderJob | null;
  readonly listBySlug: (slug: string) => readonly RenderJob[];
  readonly cancel: (jobId: string) => CancelRenderJobResult;
  readonly size: () => RenderJobQueueSize;
  readonly whenIdle: () => Promise<void>;
}

export function createRenderJobQueue(deps: RenderApiDependencies): RenderJobQueue;
```

- **`create` es síncrona.** No toca el filesystem: la `Timeline` ya viene leída y validada por el
  handler (D-19). Devuelve el snapshot inmediato del job, que es `running` si la cola estaba
  vacía y `queued` si no (HU-03-01).
- **`get`, `listBySlug` y `cancel` devuelven snapshots inmutables**, nunca el registro interno.
  Dos llamadas sucesivas devuelven dos objetos distintos: eso es lo que hace verificable
  "el progreso nunca decrece entre dos consultas".
- **`cancel` no lanza.** Devuelve el resultado tipado y el handler lo traduce a status (§6.4).
  *Fundamento:* la cola es lógica pura de dominio; la superficie HTTP es del handler. Lanzar desde
  la cola obligaría a importar `PipelineStageError` desde el dominio y a testear el status en el
  archivo equivocado.
- **`whenIdle`** resuelve cuando no hay job ocupando el slot ni jobs en `queued`. Es contrato
  público, no un atajo de test: lo consume el test determinista de la cola **y** lo va a consumir
  el apagado ordenado cuando alguien lo pida. Sin él, el único modo de esperar a la cola sería
  hacer polling con timers, que es exactamente lo que D-2 no permite traer de una librería.

### 5.2 El registro interno

```ts
interface RenderJobRecord {
  readonly id: string;
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
  readonly createdAt: string;
  state: RenderJobState;
  startedAt: string | null;
  finishedAt: string | null;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
  error: RenderApiErrorPayload | null;
}
```

`RenderJobRecord` es **privado del módulo de la cola**: no se exporta y no aparece en ninguna firma
pública. La proyección al tipo público es una función pura exportada:

```ts
export function toRenderJob(record: RenderJobRecord): RenderJob;   // en render-job.ts, sobre un tipo estructural
export function toRenderJobSummary(job: RenderJob): RenderJobSummary;
```

Estado del módulo:

- `records: Map<string, RenderJobRecord>` — el `Map` preserva el orden de inserción, que **es** el
  orden de creación que pide RN-6/CA-025. No hace falta ordenar nada.
- `pending: string[]` — FIFO de ids en `queued`.
- `activeId: string | null` — el id del job que ocupa el slot (`running` **o** `canceling`).
- `idleResolvers: (() => void)[]` — los resolvers pendientes de `whenIdle`.

### 5.3 Despacho con concurrencia 1

```
create(input):
  1. id = deps.randomId()
  2. record = { …input, id, state: 'queued', createdAt: deps.clock.nowIso(),
                startedAt: null, finishedAt: null, progress: null, report: null, error: null }
  3. records.set(id, record); pending.push(id)
  4. dispatchNext()
  5. return toRenderJob(record)

dispatchNext():
  1. si activeId !== null -> return                       (el slot está ocupado: RF-18)
  2. id = pending.shift(); si undefined -> resolveIdle(); return
  3. transition = applyRenderJobEvent(record.state, { kind: 'dispatch' })
     si rejected -> volver a 2                            (nunca pasa desde pending; ver nota)
  4. record.state = 'running'; record.startedAt = deps.clock.nowIso(); activeId = id
  5. logTransition(record, 'queued', 'running')
  6. void runJob(record)                                  (sin await: create no bloquea)

runJob(record):
  1. observer = {
       stageStarted: (stage) => { record.progress = startRenderJobStage(record.progress, stage) },
       renderProgressed: (r, t) => { record.progress = mergeRenderProgress(record.progress, r, t) },
       cancellationRequested: () => record.state === 'canceling',
     }
  2. try  { report = await runRenderPipeline({ renderId: record.id,
                                               projectRoot: record.projectRoot,
                                               timeline: record.timeline }, deps, observer) }
     catch (cause) { failure = isRenderPipelineCanceled(cause) ? null : toErrorPayload(cause) }
  3. settle(record, report, failure)
  4. activeId = null; dispatchNext()

settle(record, report, failure):
  1. from = record.state
  2. transition = applyRenderJobEvent(from, { kind: 'settle', failed: failure !== null })
  3. si rejected -> no se escribe nada                   (imposible desde runJob; el guard vive en el test puro)
  4. record.state = transition.state
  5. record.report = transition.state === 'succeeded' ? report : null
     record.error  = transition.state === 'failed'    ? failure : null
  6. record.finishedAt = deps.clock.nowIso()
  7. logTransition(record, from, record.state)
```

Cuatro propiedades que este despacho garantiza y que la §12 exige testear:

1. **Nunca hay dos jobs `running`** (CA-022): `dispatchNext` sale en el paso 1 si `activeId` no es
   `null`, y `activeId` sólo vuelve a `null` en `runJob` paso 4, después de `settle`.
2. **`create` no bloquea la request**: `runJob` se invoca sin `await`. Una función `async` corre
   sincrónicamente hasta su primer `await`, que es `runRenderPipeline` → `deps.ensureDirectory`.
   Por eso el body del `202` del primer job ya dice `state: "running"`, y el del segundo `"queued"`.
3. **`canceling` sigue ocupando el slot**: el binario en curso todavía corre. El siguiente job se
   despacha recién en `runJob` paso 4 (RF-18 + §8).
4. **`canceling` gana al liquidar**: el paso 2 de `settle` consulta el estado **vigente**, no el
   que tenía al arrancar. Un cancel que llega durante `verify` (última etapa, sin checkpoint
   posterior) igual termina en `canceled` (§8.3).

*Nota sobre el paso 3 de `dispatchNext`:* un id sale de `pending` sólo si sigue `queued`, porque
`cancel` lo remueve de `pending` en el mismo movimiento en que lo marca `canceled` (§8.1). El
`rejected` de ese paso no se ejerce desde la cola; se ejerce **directamente sobre la función pura**
en `render-job-state.spec.ts` (§12, CA-022), que es donde la tabla de transiciones ilegales de §3.3
se vuelve un test.

`logTransition(record, from, to)` es `deps.logger.info({ event: 'render-job-transition', detail: {
jobId, slug, from, to } })`. Es el **registro de transiciones** que CA-022 y CA-027 piden como
evidencia; el adaptador de producción lo tira (su `logger` es no-op desde `cycle-01`), y los tests
inyectan un logger que graba (§12.4).

### 5.4 Dónde vive la instancia — y la deuda del `uploadSerializer`

**Decisión: una instancia por servidor, en un objeto `RenderApiRuntime` nuevo, que también absorbe
el `uploadSerializer`. La deuda se salda en este ciclo (D-23).**

```ts
export interface RenderApiRuntime {
  readonly jobs: RenderJobQueue;
  readonly uploadSerializer: KeyedSerializer;
}

export function createRenderApiRuntime(deps: RenderApiDependencies): RenderApiRuntime;
```

`createRenderApiServer(deps, config, store)` lo crea y se lo pasa a `handleRequest`, que gana un
cuarto parámetro **obligatorio**:

```ts
export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
): Promise<HttpResponse>;
```

`main.ts` **no cambia**: sigue llamando `createRenderApiServer(deps, config, store)`.

**Por qué no en `RenderApiDependencies`.** La cola necesita `RenderApiDependencies` para correr el
pipeline. Meterla dentro del mismo objeto es una dependencia circular que sólo se rompe con un
setter posterior o con un `let` mutable — dos formas de que el objeto de dependencias deje de ser
lo que es hoy: un contrato de puertos puro, sin estado, que cada test construye entero de una vez.
`RenderApiRuntime` separa exactamente eso: **puertos** (`deps`) vs **estado vivo del proceso**
(`runtime`). Un doble de puerto es un valor; una cola es una máquina.

**Por qué no un singleton de módulo** (como el `uploadSerializer` de hoy): dos servidores en el
mismo proceso —que es literalmente lo que hace `create-render-api-server.spec.ts`— compartirían la
cola y el serializador; y en la suite el estado sobrevive entre tests, así que el orden de los
tests pasa a ser parte del resultado. Es la deuda que `cycle-02` dejó anotada.

**Por qué saldarla ahora y no declararla otra vez.** Este ciclo **ya** obliga a que
`handleRequest` reciba estado vivo por parámetro: el objeto `RenderApiRuntime` existe con o sin el
serializador. Sumarle un campo cuesta una línea en la interfaz, una línea en el factory y cambiar
`handleUploadAsset` de `uploadSerializer.run(...)` a `runtime.uploadSerializer.run(...)`. El costo
real es tocar `assets-handler.spec.ts` para pasar el runtime a las llamadas — mecánico, lo señala
el compilador, y **ninguna aserción de ese spec cambia** (el serializador se comporta igual). Dejar
la deuda un ciclo más significaría convivir con dos modelos de estado vivo a la vez (uno por
parámetro, uno por módulo) en el mismo archivo de handlers, que es peor que cualquiera de los dos
puro. `createKeyedSerializer` en sí **no se toca**: la función ya era correcta; el defecto era el
lugar de su instancia.

**Consecuencia sobre la firma de `handleUploadAsset`:**

```ts
export async function handleUploadAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse>;
```

### 5.5 Sin cap de historial

Los jobs terminales **no se purgan** en este ciclo: `records` crece hasta el reinicio del proceso
(D-26). RN-7 ya dejó previsto que un job purgado caería en `404 RENDER_JOB_NOT_FOUND`, así que
agregar un cap después no cambia ningún contrato observable. Un `RenderJob` sin la `Timeline` pesa
unos cientos de bytes; la `Timeline` de un job terminal sí pesa (15 KB en `smoke-ingest`) — se
libera igual al reiniciar, y el README lo declara como límite conocido junto con RNF-12.

---

## 6. Contrato de los endpoints (`EP-012`..`EP-015`)

Convenciones comunes, heredadas de `cycle-02` §4 y no repetidas por endpoint:

- **Sobre de error**: `{ "error": { "code", "stage", "message", "resource"?, "expected"?, "hint"? } }`
  con `content-type: application/json; charset=utf-8`. `stage` es `null` en los dos códigos nuevos (§9).
- **`404 ROUTE_NOT_FOUND` / `405 METHOD_NOT_ALLOWED`** siguen siendo del router y aplican a las
  cuatro rutas nuevas; no se repiten en cada tabla.
- **`500 INTERNAL_ERROR`** es el fallback del manejador central; aplica a los cuatro.
- Todo endpoint con `:slug` valida el slug (`isValidProjectSlug`) **antes** de tocar el filesystem.
- Ningún `resource` de estos endpoints es una ruta absoluta: es un slug, un id de job o una ruta
  relativa al proyecto (RNF-6/RNF-8).

### 6.1 `POST /projects/:slug/jobs` — crear un job de render (EP-012)

**Request:** path param `:slug`. **Sin body** — el cuerpo, si viene, se ignora y no se lee
(D-19). Sin headers obligatorios.

**Secuencia del handler** (el orden importa: CA-021 exige *una sola* lectura del store antes de encolar):

1. `assertValidProjectSlug(slug)` — puro, antes de todo puerto.
2. `resolveExistingProject(deps, store, slug)` — un `stat` de la raíz del proyecto.
3. `readStoredTimeline(deps, project)` — un `stat` + un `readTextFile` de `work/timeline.json`,
   `JSON.parse` y `TimelineSchema.safeParse`.
4. `runtime.jobs.create({ slug, projectRoot: project.root, timeline })`.

Si cualquiera de 1..3 lanza, **ningún job queda registrado**: `create` es el paso 4 y no hay
compensación que deshacer (RN-3, CA-021).

**202 Accepted** — headers: `content-type: application/json; charset=utf-8`,
`location: /jobs/<id>`. Body: el `RenderJobBody` completo (§6.3).

```json
{
  "id": "render-0001",
  "slug": "smoke-ingest",
  "state": "running",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "startedAt": "2026-09-08T00:00:00.000Z",
  "finishedAt": null,
  "progress": { "stage": "prepare", "renderedFrames": null, "totalFrames": null, "percent": null },
  "report": null,
  "error": null
}
```

Con otro job ocupando el slot, el mismo endpoint responde el mismo `202` con
`"state": "queued"`, `"startedAt": null` y `"progress": null`.

**Errores:** `422 PROJECT_SLUG_INVALID` · `404 PROJECT_NOT_FOUND` · `404 TIMELINE_NOT_FOUND` ·
`422 TIMELINE_INVALID`. Los cuatro son códigos **ya existentes** desde `cycle-02` (caminos de
error #2, #3 y #4 del `functional.md`): este endpoint no inventa ninguno.

### 6.2 `GET /projects/:slug/jobs` — listar los jobs del proyecto (EP-013)

**Request:** path param `:slug`. Sin query params (sin paginación: RN-6, y la cola es de una
máquina de un dev).

**200:**

```json
{
  "slug": "smoke-ingest",
  "jobs": [
    { "id": "render-0001", "state": "succeeded", "stage": "verify", "errorCode": null,
      "createdAt": "2026-09-08T00:00:00.000Z", "startedAt": "2026-09-08T00:00:00.000Z",
      "finishedAt": "2026-09-08T00:04:11.000Z" },
    { "id": "render-0002", "state": "failed", "stage": "mix", "errorCode": "MEDIA_COMMAND_FAILED",
      "createdAt": "2026-09-08T00:05:00.000Z", "startedAt": "2026-09-08T00:05:00.000Z",
      "finishedAt": "2026-09-08T00:05:09.000Z" },
    { "id": "render-0003", "state": "queued", "stage": null, "errorCode": null,
      "createdAt": "2026-09-08T00:06:00.000Z", "startedAt": null, "finishedAt": null }
  ]
}
```

```ts
export interface RenderJobSummary {
  readonly id: string;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface RenderJobListBody {
  readonly slug: string;
  readonly jobs: readonly RenderJobSummary[];
}
```

Reglas:

- El orden es el de creación (§5.2: orden de inserción del `Map`), **no** por estado ni por fecha
  de fin (CA-025).
- Sólo los jobs de ese `slug` (RN-6). Un proyecto sin jobs devuelve `{ "slug": …, "jobs": [] }`,
  nunca un error.
- `stage` es `job.progress?.stage ?? null`; `errorCode` es `job.error?.code ?? null`.
- **El listado no lleva `report` ni `error` completos.** *Fundamento:* un `RenderPipelineReport`
  son ~15 campos y un `RenderApiErrorPayload` hasta 6; con veinte jobs el listado sería kilobytes
  de detalle que el consumidor sólo mira de a uno. `errorCode` alcanza para pintar la fila, y
  `GET /jobs/:id` (EP-014) tiene el resto. Es la misma división que `cycle-02` hizo entre
  `GET /projects` (flags de layout) y `GET /projects/:slug` (detalle).
- El listado **no** valida que el proyecto exista: un slug sin jobs devuelve lista vacía tanto si
  el proyecto existe como si no. *Fundamento:* la cola es memoria del proceso, no filesystem;
  pedir un `stat` acá agregaría un camino de error (`404 PROJECT_NOT_FOUND`) que no distingue nada
  útil para el consumidor —"no hay jobs" es la misma respuesta— y haría que el listado dependiera
  del disco. Es la misma decisión que `GET /projects` de `cycle-02`, que responde `200 []` sobre
  una raíz de medios inexistente (RN-1 de `cycle-02`).

**Errores:** `422 PROJECT_SLUG_INVALID`. Y nada más.

### 6.3 `GET /jobs/:jobId` — consultar un job (EP-014)

**Request:** path param `:jobId`. Sin body.

**200** en los seis estados. El `jobId` **no se valida** contra un patrón: la búsqueda es una
consulta a un `Map` en memoria y jamás construye una ruta de filesystem (los paths salen de
`resolveRenderPipelinePaths` con el id que el propio servicio generó). Un id arbitrario cae en
`404 RENDER_JOB_NOT_FOUND` por no estar en el `Map`, que es la respuesta correcta — un validador
extra sería un guard sobre una condición que ya está cubierta.

Body (`RenderJobBody` = el `RenderJob` de §3.2 tal cual, sin campos extra):

**`state: "running"`, etapa `render`:**

```json
{
  "id": "render-0001",
  "slug": "smoke-ingest",
  "state": "running",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "startedAt": "2026-09-08T00:00:00.000Z",
  "finishedAt": null,
  "progress": { "stage": "render", "renderedFrames": 120, "totalFrames": 538, "percent": 22 },
  "report": null,
  "error": null
}
```

**`state: "succeeded"`** — `report` es el `RenderPipelineReport` que `runRenderPipeline` devuelve
(campos derivados de `src/pipeline/run-render-pipeline.ts:35-42` y de
`resolveRenderPipelinePaths('…','render-0001')`; los valores del ejemplo son los de
`media/smoke-ingest` — 1080×1920@30, `durationFrames: 538`, `audioMix.voice` = `-14 LUFS` /
`-1 dBTP` — no una copia de otro ciclo):

```json
{
  "id": "render-0001",
  "slug": "smoke-ingest",
  "state": "succeeded",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "startedAt": "2026-09-08T00:00:00.000Z",
  "finishedAt": "2026-09-08T00:04:11.000Z",
  "progress": { "stage": "verify", "renderedFrames": null, "totalFrames": null, "percent": null },
  "report": {
    "renderId": "render-0001",
    "startedAt": "2026-09-08T00:00:00.000Z",
    "finishedAt": "2026-09-08T00:04:11.000Z",
    "deliverable": {
      "resource": "out/render-0001.mp4",
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "durationInFrames": 538
    },
    "intermediates": {
      "mutedVideoResource": "work/renders/render-0001/video-muted.mp4",
      "masterAudioResource": "work/renders/render-0001/master.wav"
    },
    "loudness": {
      "withinTolerance": true,
      "integratedLufs": -14.1,
      "truePeakDbtp": -1.4,
      "integratedDeltaLu": -0.1,
      "truePeakDeltaDb": -0.4
    }
  },
  "error": null
}
```

El entregable se descarga con **EP-011** (ya existente), componiendo
`GET /projects/{slug}/files/{report.deliverable.resource}` →
`GET /projects/smoke-ingest/files/out/render-0001.mp4`. **No se agrega un campo `href` al job:**
duplicaría un dato que el payload ya tiene y crearía una segunda fuente de verdad para la ruta de
descarga. El README documenta la composición (CA-034).

**`state: "failed"`** — la consulta sigue respondiendo **200**: el fallo es del job, no del
transporte (RN-5, camino de error #6). El `error` es el mismo `RenderApiErrorPayload` que
produciría la llamada directa al pipeline:

```json
{
  "id": "render-0002",
  "slug": "smoke-ingest",
  "state": "failed",
  "createdAt": "2026-09-08T00:05:00.000Z",
  "startedAt": "2026-09-08T00:05:00.000Z",
  "finishedAt": "2026-09-08T00:05:09.000Z",
  "progress": { "stage": "mix", "renderedFrames": null, "totalFrames": null, "percent": null },
  "report": null,
  "error": {
    "code": "MEDIA_COMMAND_FAILED",
    "stage": "mix",
    "message": "A media command exited with a non-zero status.",
    "resource": "work/renders/render-0002/master.wav"
  }
}
```

**`state: "canceled"`** — `report` y `error` en `null`, `progress` congelado en la etapa donde se
cortó, `finishedAt` puesto:

```json
{
  "id": "render-0003",
  "slug": "smoke-ingest",
  "state": "canceled",
  "createdAt": "2026-09-08T00:06:00.000Z",
  "startedAt": "2026-09-08T00:06:00.000Z",
  "finishedAt": "2026-09-08T00:07:30.000Z",
  "progress": { "stage": "render", "renderedFrames": 300, "totalFrames": 538, "percent": 55 },
  "report": null,
  "error": null
}
```

**Errores:** `404 RENDER_JOB_NOT_FOUND`.

### 6.4 `DELETE /jobs/:jobId` — cancelar un job (EP-015)

**Request:** path param `:jobId`. Sin body.

**Dos status de éxito, uno por semántica** (RF-22: la cancelación es asimétrica y el status lo
tiene que decir, no sólo el body):

| Estado previo | `CancelRenderJobResult` | Status | `state` del body |
| --- | --- | --- | --- |
| `queued` | `canceled` | **200** | `"canceled"` — terminal, el job **nunca** se ejecuta |
| `running` | `canceling` | **202** | `"canceling"` — aceptada; el binario en curso termina su invocación |
| `canceling` | `canceling` | **202** | `"canceling"` — idempotente, sin efecto ni error |
| `succeeded` / `failed` / `canceled` | `not-cancelable` | **409** | error `RENDER_JOB_NOT_CANCELABLE`; el estado final **no cambia** |
| id desconocido | `not-found` | **404** | error `RENDER_JOB_NOT_FOUND` |

**200** (cancelación de un job en cola):

```json
{
  "id": "render-0004",
  "slug": "smoke-ingest",
  "state": "canceled",
  "createdAt": "2026-09-08T00:08:00.000Z",
  "startedAt": null,
  "finishedAt": "2026-09-08T00:08:04.000Z",
  "progress": null,
  "report": null,
  "error": null
}
```

**202** (cancelación de un job en ejecución):

```json
{
  "id": "render-0003",
  "slug": "smoke-ingest",
  "state": "canceling",
  "createdAt": "2026-09-08T00:06:00.000Z",
  "startedAt": "2026-09-08T00:06:00.000Z",
  "finishedAt": null,
  "progress": { "stage": "render", "renderedFrames": 300, "totalFrames": 538, "percent": 55 },
  "report": null,
  "error": null
}
```

**409:**

```json
{
  "error": {
    "code": "RENDER_JOB_NOT_CANCELABLE",
    "stage": null,
    "message": "The render job has already finished and cannot be canceled.",
    "resource": "render-0001",
    "expected": "a job in the queued, running or canceling state"
  }
}
```

### 6.5 Resumen de rutas

| RouteId | Método | Patrón | EP |
| --- | --- | --- | --- |
| `health` | GET | `/health` | EP-001 (actualizado) |
| `projects.list` | GET | `/projects` | EP-002 |
| `projects.create` | POST | `/projects` | EP-003 |
| `projects.detail` | GET | `/projects/:slug` | EP-004 |
| `projects.assets.list` | GET | `/projects/:slug/assets` | EP-005 |
| `projects.assets.upload` | PUT | `/projects/:slug/assets/:role/:filename` | EP-006 |
| `projects.timeline.get` | GET | `/projects/:slug/timeline` | EP-007 |
| `projects.timeline.put` | PUT | `/projects/:slug/timeline` | EP-008 |
| `projects.edl.get` | GET | `/projects/:slug/edl` | EP-009 |
| `projects.edl.put` | PUT | `/projects/:slug/edl` | EP-010 |
| `projects.files.get` | GET | `/projects/:slug/files/*path` | EP-011 |
| **`projects.jobs.create`** | **POST** | **`/projects/:slug/jobs`** | **EP-012** |
| **`projects.jobs.list`** | **GET** | **`/projects/:slug/jobs`** | **EP-013** |
| **`jobs.detail`** | **GET** | **`/jobs/:jobId`** | **EP-014** |
| **`jobs.cancel`** | **DELETE** | **`/jobs/:jobId`** | **EP-015** |

**Los cuatro patrones nuevos son disjuntos de los once vigentes** — verificación contra la
gramática real de `src/http/router.ts:16-29` y contra el test `no two ROUTES patterns match the
same concrete path` (`router.spec.ts:95`, que prueba el path canónico de cada patrón con
`:x`→`example`, `*x`→`a/b/c`):

- `/projects/:slug/jobs` tiene **3 segmentos** con el literal `jobs` en la posición 2. Los otros
  patrones de 3 segmentos llevan `assets`, `timeline` o `edl` en esa posición: literales distintos,
  no matchean. El de 5 segmentos (`assets/:role/:filename`) falla por longitud. El comodín
  `/projects/:slug/files/*path` tiene 4 segmentos de patrón y exige `pathSegments.length >= 4`,
  así que `/projects/example/jobs` (3) no lo alcanza.
- `/jobs/:jobId` tiene **2 segmentos** con el literal `jobs` en la posición 0. El único otro patrón
  de 2 segmentos es `/projects/:slug`, con literal `projects` en esa posición. `/health` tiene 1.
- Los pares `GET`/`POST` sobre `/projects/:slug/jobs` y `GET`/`DELETE` sobre `/jobs/:jobId` son
  **dos entradas de `ROUTES` con el mismo patrón y distinto método**, exactamente como ya ocurre
  con `projects.list`/`projects.create` y `projects.timeline.get`/`.put`. `routeRequest` junta
  todos los patrones que matchean y después filtra por método (`router.ts:126`), así que responde
  `method-not-allowed` con la lista completa (`PATCH /jobs/x` → `allow: ['GET','DELETE']`).

### 6.6 Dispatch

`handle-request.ts` suma cuatro `case` al `switch` exhaustivo sobre `RouteId` (el
`satisfies never` del `default` obliga a cubrirlos; no hay forma de olvidarse de uno):

```ts
case 'projects.jobs.create':
  return await handleCreateRenderJob(deps, store, params, runtime);
case 'projects.jobs.list':
  return await handleListRenderJobs(params, runtime);
case 'jobs.detail':
  return await handleGetRenderJob(params, runtime);
case 'jobs.cancel':
  return await handleCancelRenderJob(params, runtime);
```

`handleListRenderJobs`, `handleGetRenderJob` y `handleCancelRenderJob` **no reciben `deps` ni
`store`**: no tocan ningún puerto. Es la forma de que el compilador garantice lo que CA-026 pide
verificar (cancelar un job en cola no invoca ningún puerto del pipeline): esas tres funciones ni
siquiera tienen acceso a los puertos. Son `async` de todos modos, por uniformidad con el `await`
del dispatch.

---

## 7. Propagación del progreso

### 7.1 El puerto

`src/deps/render-api-dependencies.ts`:

```ts
export type RenderProgressListener = (renderedFrames: number, totalFrames: number) => void;

export interface RenderMutedVideoInput {
  readonly timeline: Timeline;
  readonly outPath: string;
  readonly publicDir: string;
  readonly onProgress?: RenderProgressListener;
}
```

`RenderMutedVideoOutput` y `RenderMutedVideoPort` **no cambian**. La firma del listener es
**idéntica** a la de `RenderTimelineOptions.onProgress`
(`libs/composition-remotion/src/render.ts:39`): el puerto no reinterpreta nada, sólo transporta.

**Compatibilidad, verificada contra el código real:**

- `runRenderPipeline` es el único llamador de producción del puerto y hoy pasa tres campos; el
  cuarto es opcional, así que su llamada actual **compila sin cambios**.
- `createFakeRenderApiDependencies` (`src/__fixtures__/fake-render-api-dependencies.ts:25-31`)
  hace `callLog.record('renderMutedVideo', input)` y `return { outPath: input.outPath, …}`, y
  delega en `overrides.renderMutedVideo(input)`. Nada de eso depende de la forma exacta de
  `input`: **el doble no cambia** por este ciclo. Lo único que se le agrega al fixture es el puerto
  `randomId` (§14 D-24).
- `node-render-api-dependencies.spec.ts:80` asserta
  `expect(renderTimelineMock).toHaveBeenCalledWith(timeline, { outPath, publicDir, audio: 'muted' })`.
  Como el adaptador **omite** la clave cuando no hay listener (§7.3), esa aserción sigue pasando
  intacta.

### 7.2 El observador del pipeline

`src/pipeline/render-pipeline-observer.ts` (archivo nuevo):

```ts
import type { RenderPipelineStage } from '../errors/render-api-error';
import type { RenderProgressListener } from '../deps/render-api-dependencies';

export interface RenderPipelineObserver {
  readonly stageStarted: (stage: RenderPipelineStage) => void;
  readonly renderProgressed: RenderProgressListener;
  readonly cancellationRequested: () => boolean;
}

export class RenderPipelineCanceledError extends Error {
  readonly stage: RenderPipelineStage;
  constructor(stage: RenderPipelineStage);
}

export function isRenderPipelineCanceled(value: unknown): value is RenderPipelineCanceledError;
```

`src/pipeline/run-render-pipeline.ts` gana un **tercer parámetro opcional** y cinco invocaciones
del observador; su firma pública, su tipo de retorno y `RenderPipelineReport` **no cambian**:

```ts
export async function runRenderPipeline(
  request: RenderPipelineRequest,
  deps: RenderApiDependencies,
  observer?: RenderPipelineObserver,
): Promise<RenderPipelineReport>;
```

Cuerpo, en orden exacto (`✓` = checkpoint de cancelación):

```
  observer?.stageStarted('prepare')
  runStage('prepare', …)      ensureDirectory(workDir) + ensureDirectory(outDir)
✓ checkpoint('render')
  observer?.stageStarted('render')
  runStage('render', …)       deps.renderMutedVideo({ …, …onProgress })
✓ checkpoint('mix')
  observer?.stageStarted('mix')
  runStage('mix', …)          deps.mixTimelineAudio(…)
✓ checkpoint('mux')
  observer?.stageStarted('mux')
  runStage('mux', …)          deps.muxAudioIntoVideo(…)
✓ checkpoint('verify')
  observer?.stageStarted('verify')
  runStage('verify', …)       deps.verifyMixLoudness(…)
  return report
```

donde `checkpoint(stage)` es: si `observer?.cancellationRequested() === true`, lanzar
`new RenderPipelineCanceledError(stage)` (el `stage` es **la etapa que no llegó a empezar**).

Tres detalles que el implementador no puede improvisar:

1. **Los checkpoints van FUERA de `runStage`.** `runStage` envuelve todo lo que lanza con
   `translateEngineError`, que convertiría el centinela en un `RenderApiError` con un código de
   motor equivocado. Fuera de `runStage` el centinela sube limpio hasta la cola.
2. **No hay checkpoint antes de `prepare` ni después de `verify`.** Antes de `prepare` no hay
   ningún `await` desde que la cola pone `running`, así que un cancel no puede interleavearse:
   sería un guard sobre una condición imposible. Después de `verify` no hace falta porque el paso
   `settle` de la cola ya consulta el estado vigente y `canceling` gana (§5.3, §8.3) — poner un
   quinto checkpoint ahí volvería **muerta** la rama `canceling` del `settle` exitoso.
3. **La clave `onProgress` se omite, no se pasa `undefined`** (`exactOptionalPropertyTypes`):
   `...(observer === undefined ? {} : { onProgress: observer.renderProgressed })`.

### 7.3 El adaptador de producción

`src/deps/node-render-api-dependencies.ts`, único cambio en `renderMutedVideo`:

```ts
renderMutedVideo: async ({ timeline, outPath, publicDir, onProgress }) => {
  const { renderTimeline } = await loadRender();
  const result = await renderTimeline(timeline, {
    outPath,
    publicDir,
    audio: 'muted',
    ...(onProgress === undefined ? {} : { onProgress }),
  });
  return { outPath: result.outPath, width: result.width, height: result.height,
           fps: result.fps, durationInFrames: result.durationInFrames };
},
```

**Se reenvía la referencia tal cual**, sin envolverla ni transformar sus argumentos (CA-024). La
traducción `progress.renderedFrames → (renderedFrames, totalFrames)` ya la hace
`remotionRenderDeps.renderTimelineMedia` dentro de la lib (`render.ts:121`), y ahí `totalFrames`
es `composition.durationInFrames`. `render-api` no re-deriva ese número: si lo calculara de la
`Timeline` divergiría del que Remotion realmente va a renderizar.

### 7.4 Cadena completa

```
renderMedia (Remotion)
  → remotionRenderDeps.renderTimelineMedia: onProgress(p.renderedFrames, composition.durationInFrames)
    → renderTimeline options.onProgress                       [libs/composition-remotion]
      → RenderMutedVideoInput.onProgress                      [puerto de render-api, nuevo]
        → observer.renderProgressed                           [runRenderPipeline, nuevo]
          → mergeRenderProgress(record.progress, r, t)        [cola, monotónico]
            → GET /jobs/:jobId → progress.renderedFrames/totalFrames/percent
```

---

## 8. Cancelación

### 8.1 `queued` — cancelación real

`cancel(jobId)` sobre un job `queued`:

1. `applyRenderJobEvent('queued', { kind: 'cancel' })` → `moved: 'canceled'`.
2. Se **remueve el id de `pending`** en el mismo movimiento (por eso `dispatchNext` nunca saca de
   `pending` un id que no esté `queued`).
3. `state = 'canceled'`, `finishedAt = deps.clock.nowIso()`, `progress` sigue `null`.
4. `logTransition(record, 'queued', 'canceled')`.

**Garantía observable:** ese job **jamás invoca ningún puerto del pipeline**. Es verificable sobre
`callLog.ports()`, que no contiene `renderMutedVideo`, `mixTimelineAudio`, `muxAudioIntoVideo`,
`verifyMixLoudness` ni `ensureDirectory` para ese job (CA-026). No es una promesa de comportamiento:
`runJob` nunca se invoca para él.

Status: **200**, `state: "canceled"`. Terminal en la misma respuesta.

### 8.2 `running` — cancelación cooperativa, entre etapas

`cancel(jobId)` sobre un job `running`: `running → canceling`, y **la respuesta vuelve de
inmediato con 202**, sin esperar a que el binario termine.

Lo que pasa después, sin intervención del cliente:

1. El binario en curso (`ffmpeg`, `ffprobe` o Chrome headless vía Remotion) **termina su propia
   invocación**. Nadie lo mata.
2. Al llegar al próximo checkpoint, `observer.cancellationRequested()` devuelve `true` (lee
   `record.state === 'canceling'`) y `runRenderPipeline` lanza `RenderPipelineCanceledError`.
3. `runJob` lo reconoce con `isRenderPipelineCanceled` y **no** produce un `RenderApiErrorPayload`:
   una cancelación no es un fallo.
4. `settle` ve `state === 'canceling'` → `canceled`, `finishedAt` puesto, `report` y `error` en
   `null`, `progress` congelado en la última etapa observada.
5. `activeId = null` y `dispatchNext()` arranca el siguiente job de la cola.

**Qué se le promete al consumidor:** que el job va a terminar en `canceled` (estado terminal,
distinguible de `succeeded` y de `failed`), que ningún trabajo posterior al checkpoint se va a
hacer, y que el slot de la cola se libera al llegar ahí.

**Qué NO se le promete, y está escrito para que nadie lo asuma:**

- **No hay corte inmediato.** Entre el `202` y el estado `canceled` puede pasar el tiempo entero de
  una etapa. En `render` de `media/smoke-ingest` (1080×1920, 538 frames) eso son minutos.
- **No se mata ningún proceso hijo.** Ni `SIGTERM` ni `SIGKILL` a `ffmpeg`/Chrome. Matar un
  `ffmpeg` a mitad de escritura deja un `.mp4` o un `.wav` truncado en `work/` o en `out/` que
  nada distingue de uno bueno.
- **No se borra nada.** Los intermedios y, si `mux` ya corrió, el propio `out/<id>.mp4` quedan en
  disco tal como los dejó la última etapa completada. Es D-8 aplicado a la cancelación: conservar
  es la política, y no hay puerto de borrado en `RenderApiDependencies` para hacer otra cosa.
- **No hay reanudación.** Un job `canceled` es terminal; para volver a intentar se crea otro job,
  con otro `renderId` y otro `out/<id>.mp4`.

### 8.3 El caso borde: cancelar durante `verify`

`verify` es la última etapa y no tiene checkpoint después. Si el `cancel` llega mientras
`verifyMixLoudness` corre:

- `runRenderPipeline` **completa** y devuelve un `RenderPipelineReport` válido.
- `settle` lee `record.state === 'canceling'` y aplica `settle` sobre `canceling` → **`canceled`**.
- El `report` se **descarta**: `record.report` queda `null` (§3.2).

**El estado vigente al liquidar es la autoridad, no el resultado del pipeline** (D-22). Sin esta
regla, cancelar en la última etapa devolvería `succeeded` y CA-027 ("un estado terminal distinto de
`succeeded` y de `failed`") sería falso en un caso real y alcanzable. Con ella, las dos ramas del
`settle` son alcanzables y testeables: la de `canceling` con un cancel en `verify`, la de `running`
con un job sin cancel.

El `out/<id>.mp4` existe en disco aunque el job diga `canceled`. Está declarado acá y en el README:
un job cancelado **puede** haber dejado un entregable completo; lo que la cancelación garantiza es
el estado, no la ausencia de archivos.

### 8.4 Cancelar dos veces, y cancelar lo terminal

- `canceling` + `cancel` → `202`, mismo body. Idempotente. *Fundamento:* RF-22 pide 409 para un job
  **ya finalizado**; `canceling` no lo está. Devolver 409 acá castigaría un reintento de red con un
  error que no describe nada real.
- `succeeded` / `failed` / `canceled` + `cancel` → **409 `RENDER_JOB_NOT_CANCELABLE`**, y el estado
  final **no cambia** (CA-027). El handler no escribe nada: `applyRenderJobEvent` devolvió
  `rejected` y la cola no tocó el registro.

---

## 9. Códigos de error nuevos

`RENDER_API_ERROR_CODES` pasa de **35 a 37**. `STATUS_BY_CODE` y `MESSAGE_BY_CODE` son
`Readonly<Record<RenderApiErrorCode, …>>`: el compilador obliga a completar las dos filas nuevas en
los dos archivos.

| Código | Etapa | Status | Cuándo se emite | Campos del payload |
| --- | --- | --- | --- | --- |
| `RENDER_JOB_NOT_FOUND` | `null` | **404** | `GET /jobs/:jobId` o `DELETE /jobs/:jobId` con un id que no está en el registro de la cola — nunca existió, o el proceso se reinició y la cola se perdió (RNF-12), o (si un ciclo futuro agrega purga) fue purgado. RN-7 los unifica en un solo camino | `resource: <jobId recibido>` |
| `RENDER_JOB_NOT_CANCELABLE` | `null` | **409** | `DELETE /jobs/:jobId` sobre un job en `succeeded`, `failed` o `canceled`. El estado final no cambia | `resource: <jobId>`, `expected: 'a job in the queued, running or canceling state'` |

Mensajes en inglés, ASCII, estáticos por código (`MESSAGE_BY_CODE`):

| Código | `message` |
| --- | --- |
| `RENDER_JOB_NOT_FOUND` | `The requested render job does not exist.` |
| `RENDER_JOB_NOT_CANCELABLE` | `The render job has already finished and cannot be canceled.` |

**Por qué `stage: null` en los dos.** `RENDER_PIPELINE_STAGES` son las etapas del pipeline de
render. "Este id no existe" y "este job ya terminó" son afirmaciones sobre el **registro** de la
cola, no sobre una etapa; y los dos se pueden emitir sobre un job que nunca entró al pipeline. Es
la misma regla que `cycle-02` §6.2 aplicó a sus 20 códigos.

**Por qué no hay un tercer código.** Cuatro candidatos evaluados y descartados:

| Candidato | Por qué no |
| --- | --- |
| `RENDER_JOB_CANCELED` (para el centinela del pipeline) | Nunca sale por HTTP: el corte se observa como `state: "canceled"` con status 200. Un código en `STATUS_BY_CODE` que ningún status devuelve es una fila que miente. El centinela es `RenderPipelineCanceledError`, **fuera** de la jerarquía `RenderApiError` (§7.2, D-22). |
| `RENDER_QUEUE_FULL` | No hay cap (D-26). Un código para una condición que el código no puede alcanzar es un guard muerto con nombre de validación. |
| `RENDER_JOB_ID_INVALID` | El `:jobId` no construye ninguna ruta de filesystem y la búsqueda es en un `Map`: un id arbitrario ya cae en `404 RENDER_JOB_NOT_FOUND` (§6.3). |
| `TIMELINE_NOT_FOUND` / `TIMELINE_INVALID` propios de jobs | Ya existen desde `cycle-02` con exactamente esa semántica y ese `resource` (`work/timeline.json`). Duplicarlos por endpoint es lo que el `functional.md` explícitamente pide reusar (caminos #3 y #4). |

**Higiene del payload (CA-032, RNF-6/RNF-8), heredada sin cambios de `cycle-01`/`cycle-02`:**
`toErrorPayload` nunca lee `.stack`, omite los campos nulos en vez de emitir `null`, y el `message`
sale de `MESSAGE_BY_CODE` — nunca de `error.message` de una lib. Los dos `resource` nuevos son ids
de job (UUID en producción), no rutas. El `error` embebido en un job `failed` es el mismo
`RenderApiErrorPayload` producido por `toErrorPayload` sobre el error del pipeline, así que hereda
las tres garantías sin código nuevo.

---

## 10. `GET /health` (EP-001) — ampliación

Tres cambios sobre el body de `cycle-02`:

```ts
export interface HealthBody {
  readonly status: 'ok' | 'degraded';
  readonly service: 'render-api';
  readonly cycle: number;
  readonly time: string;
  readonly engine: readonly EngineModuleStatus[];
  readonly binaries: readonly BinaryStatus[];
  readonly capabilities: {
    readonly renderPipeline: boolean;
    readonly assetStore: boolean;
    readonly jobQueue: boolean;
  };
  readonly jobs: RenderJobQueueSize;
}
```

1. `capabilities.jobQueue: true` (hoy es `false`, `health-handler.ts:43`) — RF-26, CA-031.
2. `cycle: 3` (la constante `SERVICE_CYCLE`, hoy `2`).
3. **Campo nuevo `jobs`**: `{ "running": 0 | 1, "queued": <n> }`, tomado de `runtime.jobs.size()`.

Firma: `handleHealth(deps, runtime)`.

```json
{
  "status": "ok",
  "service": "render-api",
  "cycle": 3,
  "time": "2026-09-08T00:00:00.000Z",
  "engine": [
    { "name": "media-local", "loaded": true },
    { "name": "composition-remotion/render", "loaded": true }
  ],
  "binaries": [
    { "name": "ffmpeg", "envVar": "FFMPEG_PATH", "resolved": true },
    { "name": "ffprobe", "envVar": "FFPROBE_PATH", "resolved": true }
  ],
  "capabilities": { "renderPipeline": true, "assetStore": true, "jobQueue": true },
  "jobs": { "running": 1, "queued": 2 }
}
```

**Por qué `jobs` NO entra en el cálculo `ok`/`degraded`.** `status` sigue siendo `'ok'` sólo si
todos los `engine[].loaded` y todos los `binaries[].resolved` son `true`, y sigue respondiendo
**200 en los dos estados**:

- Una cola ocupada es **operación normal**, no degradación: con concurrencia 1 (RF-18), `running: 1`
  es exactamente lo que se espera mientras hay trabajo. Marcar `degraded` ahí le diría a un
  supervisor que reinicie el proceso justo mientras rinde un video.
- Una cola vacía tampoco es salud: `running: 0` es indistinguible entre "no hay trabajo" y "la cola
  se colgó". `jobs` es un **contador de carga**, no un indicador de salud.
- La cola no tiene ningún recurso externo que pueda fallar: es un `Map` en memoria. No hay estado
  degradado posible que reportar.
- Es la misma decisión que `capabilities.assetStore` de `cycle-02` (CA-018), y por la misma razón:
  `capabilities` declara **qué sabe hacer** esta instancia; `status` declara **si puede hacerlo**.

`jobs` sí es el dato que hace útil el health para un operador: antes de disparar un render, saber si
la máquina ya está ocupada evita el escenario que la memoria del repo registra ("nunca correr render
y transcripción a la vez", "≥ 35 % de memoria libre").

---

## 11. Árbol de `apps/render-api/src/` al cerrar el ciclo

`N` = archivo nuevo, `M` = modificado, el resto queda intacto.

```
src/
  main.ts                                       (sin cambios)
  server-register.cjs                           (sin cambios)
  config/
    server-config.ts                            (sin cambios)
    server-config.spec.ts                       (sin cambios)
    store-config.ts                             (sin cambios)
    store-config.spec.ts                        (sin cambios)
  deps/
    render-api-dependencies.ts               M  + onProgress en RenderMutedVideoInput,
                                                + RenderProgressListener, + puerto randomId
    object-storage.ts                           (sin cambios)
    node-render-api-dependencies.ts          M  reenvía onProgress a renderTimeline; randomId = randomUUID
    node-render-api-dependencies.spec.ts     M  + forwarding de onProgress, + randomId
  engine/
    engine-modules.ts                           (sin cambios)
    media-binaries.ts                           (sin cambios)
  errors/
    render-api-error.ts                      M  37 códigos (35 + los 2 de §9)
    render-api-error.spec.ts                    (sin cambios)
    pipeline-stage-error.ts                     (sin cambios)
    http-status-for.ts                       M  37 filas
    http-status-for.spec.ts                  M  it.each sobre las 37
    to-error-payload.ts                      M  37 mensajes
    to-error-payload.spec.ts                 M  37 mensajes + recursos nuevos
    translate-engine-error.ts                   (sin cambios)
    translate-engine-error.spec.ts              (sin cambios)
    translate-store-error.ts                    (sin cambios)
    translate-store-error.spec.ts               (sin cambios)
  jobs/
    render-job.ts                            N  RENDER_JOB_STATES, RenderJob, RenderJobProgress,
                                                RenderJobBody/Summary, toRenderJob, toRenderJobSummary,
                                                isTerminalRenderJobState
    render-job.spec.ts                       N
    render-job-state.ts                      N  applyRenderJobEvent (la máquina de §3.3)
    render-job-state.spec.ts                 N
    render-job-progress.ts                   N  startRenderJobStage, mergeRenderProgress, progressPercent
    render-job-progress.spec.ts              N
    render-job-queue.ts                      N  createRenderJobQueue (§5)
    render-job-queue.spec.ts                 N
  pipeline/
    render-pipeline-paths.ts                    (sin cambios)
    render-pipeline-paths.spec.ts               (sin cambios)
    render-pipeline-observer.ts              N  RenderPipelineObserver, RenderPipelineCanceledError,
                                                isRenderPipelineCanceled
    render-pipeline-observer.spec.ts         N
    run-render-pipeline.ts                   M  3er parámetro observer, 5 stageStarted, 4 checkpoints,
                                                onProgress al puerto de render
    run-render-pipeline.spec.ts              M  (los tests vigentes NO se tocan; se agregan casos)
  store/
    project-slug.ts                             (sin cambios)
    project-slug.spec.ts                        (sin cambios)
    asset-path.ts                               (sin cambios)
    asset-path.spec.ts                          (sin cambios)
    project-layout.ts                           (sin cambios)
    project-layout.spec.ts                      (sin cambios)
    catalog-merge.ts                            (sin cambios)
    catalog-merge.spec.ts                       (sin cambios)
    project-assets.ts                           (sin cambios)
    project-assets.spec.ts                      (sin cambios)
    project-scope.ts                         N  assertValidProjectSlug, resolveExistingProject,
                                                readStoredTimeline (§14 D-28)
    project-scope.spec.ts                    N
    serialize-by-key.ts                         (sin cambios — cambia dónde vive su instancia, no la función)
    serialize-by-key.spec.ts                    (sin cambios)
  http/
    http-message.ts                             (sin cambios)
    routes.ts                                M  15 rutas (11 + EP-012..EP-015)
    router.ts                                   (sin cambios — la gramática ya soporta los 4 patrones)
    router.spec.ts                           M  (los tests vigentes NO se tocan; se agregan casos)
    handle-request.ts                        M  4º parámetro runtime, 4 case nuevos
    handle-request.spec.ts                   M  pasa el runtime; recorre las 15 rutas
    health-handler.ts                        M  cycle 3, jobQueue true, campo jobs, 2º parámetro runtime
    health-handler.spec.ts                   M
    create-render-api-server.ts              M  crea el RenderApiRuntime y se lo pasa a handleRequest
    create-render-api-server.spec.ts         M
    render-api-runtime.ts                    N  RenderApiRuntime, createRenderApiRuntime (§5.4)
    render-api-runtime.spec.ts               N
    byte-range.ts / .spec.ts                    (sin cambios)
    content-type-for.ts / .spec.ts              (sin cambios)
    read-json-body.ts / .spec.ts                (sin cambios)
    handlers/
      projects-handler.ts                       (sin cambios)
      projects-handler.spec.ts                  (sin cambios)
      assets-handler.ts                      M  runtime.uploadSerializer (fin del singleton de módulo),
                                                importa project-scope
      assets-handler.spec.ts                 M  pasa el runtime (ninguna aserción cambia)
      montage-handler.ts                     M  importa project-scope, usa readStoredTimeline
      montage-handler.spec.ts                   (sin cambios — comportamiento idéntico)
      artifact-handler.ts                    M  importa project-scope
      artifact-handler.spec.ts                  (sin cambios — comportamiento idéntico)
      jobs-handler.ts                        N  handleCreateRenderJob, handleListRenderJobs,
                                                handleGetRenderJob, handleCancelRenderJob
      jobs-handler.spec.ts                   N
  __fixtures__/
    call-log.ts                                 (sin cambios)
    fake-object-storage.ts                      (sin cambios)
    fake-render-api-dependencies.ts          M  + randomId determinista
    http-request.ts                             (sin cambios)
    catalog-fixtures.ts                         (sin cambios)
    minimal-timeline.ts                         (sin cambios)
    minimal-edit-decision-list.ts               (sin cambios)
    controllable-render.ts                   N  createDeferred, createControllableRenderMutedVideo
    recording-logger.ts                      N  createRecordingLogger (graba render-job-transition)
```

**Fuera de `src/`:**

```
apps/render-api/README.md                    M  endpoints de la cola, semántica de cancelación,
                                                límites conocidos, guion y resultado del smoke (CA-034)
apps/render-api/vite.config.ts                  (sin cambios — coverage.include NO se recorta, CA-036)
apps/render-api/project.json                    (sin cambios)
apps/render-api/tsconfig.*.json                 (sin cambios)
package.json / pnpm-lock.yaml                   (sin cambios — CA-035, D-2, RNF-11)
sdd/specs/…/cycle-03/artifacts/                 N  salida literal del smoke (§13.4)
```

**Totales: 18 archivos nuevos en `src/`** (más el directorio `artifacts/` del ciclo) y
**24 modificados** (23 en `src/` + `apps/render-api/README.md`). Ninguna config se toca. Desglose
exacto para el planner:

| | Nuevos | Modificados |
| --- | --- | --- |
| `src/jobs/` | 8 (`render-job`, `render-job-state`, `render-job-progress`, `render-job-queue`, cada uno con su spec) | 0 |
| `src/pipeline/` | 2 (`render-pipeline-observer` + spec) | 2 (`run-render-pipeline` + spec) |
| `src/http/` | 4 (`render-api-runtime` + spec, `handlers/jobs-handler` + spec) | 12 (`routes`, `router.spec`, `handle-request` + spec, `health-handler` + spec, `create-render-api-server` + spec, `handlers/assets-handler` + spec, `handlers/montage-handler`, `handlers/artifact-handler`) |
| `src/store/` | 2 (`project-scope` + spec) | 0 |
| `src/deps/` | 0 | 3 (`render-api-dependencies`, `node-render-api-dependencies` + spec) |
| `src/errors/` | 0 | 5 (`render-api-error`, `http-status-for` + spec, `to-error-payload` + spec) |
| `src/__fixtures__/` | 2 (`controllable-render`, `recording-logger`) | 1 (`fake-render-api-dependencies`) |
| **`src/` total** | **18** | **23** |
| fuera de `src/` | `cycles/cycle-03/artifacts/` | `apps/render-api/README.md` |

`router.ts`, `serialize-by-key.ts`, `main.ts`, `vite.config.ts`, `project.json`, los `tsconfig.*` y
los specs de `montage-handler` y `artifact-handler` **no** están en ninguna de las dos columnas: el
diseño no los toca.

Invariantes que este árbol respeta:

- **Una sola frontera de proceso**: `main.ts` sigue siendo el único archivo que toca `process`, y
  **no se modifica** en este ciclo.
- **Todo I/O y toda aleatoriedad por puertos**: sólo `deps/node-render-api-dependencies.ts` importa
  `node:fs`, `node:crypto` y las libs pesadas. La cola no importa un solo módulo `node:`.
- **Cada archivo nuevo con runtime tiene su `*.spec.ts` hermano.** Los únicos sin spec son los dos
  de `__fixtures__/**`, ya excluidos del `coverage.include` desde `cycle-01`. `render-pipeline-observer.ts`
  **sí** tiene runtime (la clase y el type guard), por eso lleva spec.
- **Sin comentarios** en ninguno de los archivos nuevos ni en las líneas nuevas de los modificados.
- **`coverage.include` sin recortar** (CA-036): ningún archivo nuevo se agrega a `exclude`.

---

## 12. Lista cerrada de tests obligatorios

Contrato que el orquestador contrasta **fila por fila** contra los `files[]` de las tasks, y que el
reviewer vuelve a contrastar al cerrar. Un archivo o un símbolo que no coincide es un hallazgo, no
una variante aceptable. **Todo CA se verifica por el símbolo que el test invoca, nunca por el título
del `it`.**

### 12.1 Filas cubiertas por un test

| CA | Archivo | Nombre del test | Símbolo que ejercita |
| --- | --- | --- | --- |
| CA-021 | `src/store/project-scope.spec.ts` | `reads and parses work/timeline.json with a single readTextFile` (asserta `callLog.ports()` = `['stat','readTextFile']`) | `readStoredTimeline` |
| CA-021 | `src/store/project-scope.spec.ts` | `throws TIMELINE_NOT_FOUND when the document is absent and TIMELINE_INVALID when it does not validate` | `readStoredTimeline` |
| CA-021 | `src/store/project-scope.spec.ts` | `throws PROJECT_NOT_FOUND when the project root is missing or is not a directory` | `resolveExistingProject` |
| CA-021 | `src/http/handlers/jobs-handler.spec.ts` | `answers 202 with a service-generated id and enqueues exactly one job` (asserta `queue.listBySlug(slug)` con longitud 1 y `location: /jobs/<id>`) | `handleCreateRenderJob` |
| CA-021 | `src/http/handlers/jobs-handler.spec.ts` | `it.each` sobre los cuatro rechazos: `answers <status> <code> and registers no job` (`PROJECT_SLUG_INVALID`, `PROJECT_NOT_FOUND`, `TIMELINE_NOT_FOUND`, `TIMELINE_INVALID`; asserta `queue.listBySlug(slug)` vacío) | `handleCreateRenderJob` |
| CA-022 | `src/jobs/render-job-state.spec.ts` | `it.each` sobre las seis transiciones legales de §3.3 más la auto-transición idempotente de `canceling` | `applyRenderJobEvent` |
| CA-022 | `src/jobs/render-job-state.spec.ts` | `it.each` sobre las transiciones ilegales de §3.3: `rejects <event> from <state>` | `applyRenderJobEvent` |
| CA-022 | `src/jobs/render-job-state.spec.ts` | `reports the three terminal states and only those` | `isTerminalRenderJobState` |
| CA-022 | `src/jobs/render-job-queue.spec.ts` | `keeps the second job queued while the first is running` (asserta `size()` = `{running:1,queued:1}` y las transiciones grabadas por `createRecordingLogger`) | `createRenderJobQueue` |
| CA-022 | `src/jobs/render-job-queue.spec.ts` | `it.each` sobre los tres finales del primer job (`succeeded`, `failed`, `canceled`): `dispatches the queued job only after the running one reaches <state>` | `createRenderJobQueue` |
| CA-023 | `src/jobs/render-job-progress.spec.ts` | `keeps the highest renderedFrames seen and ignores a lower one` | `mergeRenderProgress` |
| CA-023 | `src/jobs/render-job-progress.spec.ts` | `ignores progress reported outside the render stage` | `mergeRenderProgress` |
| CA-023 | `src/jobs/render-job-progress.spec.ts` | `floors the percent and clamps it to 0..100, answering null for a non-positive total` | `progressPercent` |
| CA-023 | `src/jobs/render-job-progress.spec.ts` | `drops the frame counters when a new stage starts` | `startRenderJobStage` |
| CA-023 | `src/jobs/render-job-queue.spec.ts` | `exposes stage render and a percent that never decreases between two snapshots` (el doble emite `(120,538)` y después `(119,538)`; dos `get()` sucesivos) | `createRenderJobQueue` |
| CA-024 | `src/pipeline/run-render-pipeline.spec.ts` | `passes the observer progress listener to renderMutedVideo and omits the key when there is no observer` (compara la identidad de la función recibida en el `callLog`) | `runRenderPipeline` |
| CA-024 | `src/deps/node-render-api-dependencies.spec.ts` | `forwards onProgress to renderTimeline without altering renderedFrames or totalFrames` (invoca el `onProgress` capturado del mock con `(120, 538)` y asserta el par recibido) | `createNodeRenderApiDependencies` |
| CA-024 | `src/deps/node-render-api-dependencies.spec.ts` | `omits the onProgress key when renderMutedVideo is called without a listener` (la aserción vigente de la línea 80 sigue pasando) | `createNodeRenderApiDependencies` |
| CA-025 | `src/jobs/render-job-queue.spec.ts` | `lists only the jobs of the given slug in creation order` (tres jobs de dos slugs intercalados) | `createRenderJobQueue` |
| CA-025 | `src/jobs/render-job.spec.ts` | `projects a job to a summary with id, state, stage and errorCode and without report, timeline or projectRoot` | `toRenderJobSummary` |
| CA-025 | `src/http/handlers/jobs-handler.spec.ts` | `answers 200 with an empty jobs array for a slug without jobs` | `handleListRenderJobs` |
| CA-026 | `src/jobs/render-job-queue.spec.ts` | `cancels a queued job without invoking any pipeline port` (asserta que `callLog.ports()` no contiene `renderMutedVideo`, `mixTimelineAudio`, `muxAudioIntoVideo`, `verifyMixLoudness` ni `ensureDirectory` del job cancelado) | `createRenderJobQueue` |
| CA-026 | `src/http/handlers/jobs-handler.spec.ts` | `answers 200 with state canceled for a queued job` | `handleCancelRenderJob` |
| CA-027 | `src/jobs/render-job-queue.spec.ts` | `moves a running job to canceling and settles it as canceled at the next stage checkpoint` | `createRenderJobQueue` |
| CA-027 | `src/jobs/render-job-queue.spec.ts` | `settles a canceling job as canceled and discards the report when the pipeline completed` (cancel durante `verify`) | `createRenderJobQueue` |
| CA-027 | `src/jobs/render-job-queue.spec.ts` | `answers canceling again without changing anything when the job is already canceling` | `createRenderJobQueue` |
| CA-027 | `src/http/handlers/jobs-handler.spec.ts` | `answers 202 with state canceling for a running job` | `handleCancelRenderJob` |
| CA-027 | `src/http/handlers/jobs-handler.spec.ts` | `it.each` sobre `succeeded`, `failed` y `canceled`: `answers 409 RENDER_JOB_NOT_CANCELABLE and leaves the state untouched` | `handleCancelRenderJob` |
| CA-027 | `src/pipeline/run-render-pipeline.spec.ts` | `it.each` sobre los cuatro checkpoints (`render`, `mix`, `mux`, `verify`): `throws RenderPipelineCanceledError before <stage> and never invokes its port` | `runRenderPipeline` |
| CA-027 | `src/pipeline/render-pipeline-observer.spec.ts` | `recognises its own cancellation error and rejects any other value` | `isRenderPipelineCanceled` |
| CA-027 | `src/pipeline/render-pipeline-observer.spec.ts` | `carries the stage that was about to start` | `RenderPipelineCanceledError` |
| CA-028 | `src/http/handlers/jobs-handler.spec.ts` | `answers 404 RENDER_JOB_NOT_FOUND for an id that was never created` | `handleGetRenderJob` |
| CA-028 | `src/http/handlers/jobs-handler.spec.ts` | `answers 404 RENDER_JOB_NOT_FOUND when cancelling an id that was never created` | `handleCancelRenderJob` |
| CA-029 | `src/jobs/render-job-queue.spec.ts` | `it.each` sobre las cinco etapas: `settles the job as failed with the typed error of the <stage> stage` (asserta `job.error.code` y `job.error.stage`) | `createRenderJobQueue` |
| CA-029 | `src/http/handlers/jobs-handler.spec.ts` | `answers 200 with state failed and the embedded typed error` (status 200, no el status del código embebido) | `handleGetRenderJob` |
| CA-030 | `src/jobs/render-job-queue.spec.ts` | `reports out/<id>.mp4 as the deliverable and both intermediates under work/renders/<id>/` | `createRenderJobQueue` |
| CA-030 | `src/jobs/render-job-queue.spec.ts` | `never invokes a removal port for a finished job` (`callLog.ports()` sin `removeTemporary`, en los tres finales) | `createRenderJobQueue` |
| CA-031 | `src/http/health-handler.spec.ts` | `answers capabilities.jobQueue true and cycle 3` | `handleHealth` |
| CA-031 | `src/http/health-handler.spec.ts` | `reports the running and queued counters of the runtime queue` | `handleHealth` |
| CA-031 | `src/http/health-handler.spec.ts` | `keeps answering 200 with jobQueue true and the same jobs block in the degraded state` | `handleHealth` |
| CA-032 | `src/errors/http-status-for.spec.ts` | `it.each` sobre `RENDER_API_ERROR_CODES` (37 filas): `maps <code> to HTTP <status>` | `httpStatusFor` |
| CA-032 | `src/errors/to-error-payload.spec.ts` | `emits an ASCII English message for every code in RENDER_API_ERROR_CODES` (37 códigos) | `toErrorPayload` |
| CA-032 | `src/errors/to-error-payload.spec.ts` | `never emits an absolute host path in resource` (amplía la lista con `RENDER_JOB_NOT_FOUND` y `RENDER_JOB_NOT_CANCELABLE`) | `toErrorPayload` |
| CA-032 | `src/http/handlers/jobs-handler.spec.ts` | `answers the two queue errors with a payload free of stack, of Spanish text and of absolute paths` | `handleCancelRenderJob` |
| CA-032 | `src/jobs/render-job.spec.ts` | `never projects projectRoot or timeline into the job body` | `toRenderJob` |

### 12.2 Filas de soporte, sin CA propio

El planner las incluye en los `files[]` igual que las de §12.1: sin ellas el contrato de §6 no
queda verificado.

| Qué asegura | Archivo | Nombre del test | Símbolo que ejercita |
| --- | --- | --- | --- |
| Los cuatro patrones nuevos matchean y no colisionan | `src/http/router.spec.ts` | `routes the four job patterns with their params` | `routeRequest` |
| El invariante de disyunción sigue valiendo con 15 rutas | `src/http/router.spec.ts` | `no two ROUTES patterns match the same concrete path` (**el test vigente, sin tocar**; pasa a recorrer 15 patrones) | `ROUTES`, `routeRequest` |
| `allow` completo en un patrón con dos métodos | `src/http/router.spec.ts` | `answers method-not-allowed with GET and DELETE for a job path` | `routeRequest` |
| Las 15 rutas llegan a un handler | `src/http/handle-request.spec.ts` | `dispatches every RouteId to its handler` (**test vigente**, ampliado con el 4º parámetro `runtime`) | `handleRequest` |
| Un runtime por servidor, sin estado de módulo | `src/http/render-api-runtime.spec.ts` | `creates an independent queue and upload serializer per runtime` (dos runtimes; un job creado en uno no aparece en el otro) | `createRenderApiRuntime` |
| El ciclo completo sobre un socket real | `src/http/create-render-api-server.spec.ts` | `creates a job and reads it back over a real loopback socket` | `createRenderApiServer` |
| El pipeline reporta las cinco etapas en orden | `src/pipeline/run-render-pipeline.spec.ts` | `reports the five stages in order through the observer` | `runRenderPipeline` |
| Los tests vigentes del pipeline siguen valiendo sin observador | `src/pipeline/run-render-pipeline.spec.ts` | los `it` vigentes de `cycle-01` (**sin tocar**) | `runRenderPipeline` |
| El upload sigue serializado por slug, ahora por runtime | `src/http/handlers/assets-handler.spec.ts` | los `it` vigentes de `cycle-02` (**ninguna aserción cambia**; sólo se les pasa el `runtime`) | `handleUploadAsset` |

### 12.3 Filas cuya evidencia es una compuerta, no un test

| CA | Instrumento | Evidencia exacta |
| --- | --- | --- |
| CA-033 | ejecución real del proceso | §13 — el guion completo contra `media/smoke-ingest`, con la salida literal guardada en `cycles/cycle-03/artifacts/` (§13.4). No es un test: la suite sigue corriendo sin binarios (RNF-3/RNF-9/RNF-13) |
| CA-034 | inspección del entregable | `apps/render-api/README.md` documenta los cuatro endpoints nuevos (método, path, propósito), la tabla de cancelación por estado de §6.4, los límites conocidos (concurrencia 1, cola en memoria sin persistencia, sin cap de historial), cómo componer la URL de descarga con EP-011, y el resultado del smoke con su referencia a `FIX-e-burgos-001-001` |
| CA-035 | corrida del workspace | `pnpm nx run-many -t lint test build` verde con `render-api` en la corrida · `pnpm sdd:validate` verde · `git diff --stat package.json pnpm-lock.yaml` **vacío en todo el ciclo** |
| CA-036 | umbral de cobertura | `pnpm nx run render-api:test` — v8 sobre `src/**/*.ts` con el `coverage.include` de `cycle-01`/`cycle-02` **sin recortar**; el umbral de 80 % vive en `apps/render-api/vite.config.ts` y falla solo |

### 12.4 Dobles de test

- **`createControllableRenderMutedVideo()`** (`src/__fixtures__/controllable-render.ts`): devuelve
  `{ port, started, emitProgress, resolve, reject }`. `port` es un `RenderMutedVideoPort` que
  guarda el `onProgress` recibido y devuelve una promesa que **no** se resuelve hasta que el test
  llama `resolve()` o `reject(cause)`; `started` es una promesa que resuelve cuando el puerto fue
  invocado; `emitProgress(renderedFrames, totalFrames)` invoca el `onProgress` capturado. Es lo que
  permite sostener un job en `running` de forma determinista y sin timers — sin él, CA-022, CA-023,
  CA-026, CA-027 y CA-029 dependerían de carreras. Incluye `createDeferred<T>()`, que es el único
  primitivo que hace falta.
- **`createRecordingLogger()`** (`src/__fixtures__/recording-logger.ts`): un `Logger` que acumula
  los `LogEvent` en un array consultable. Es el **registro de transiciones** que CA-022 y CA-027
  piden como evidencia. Se inyecta por `overrides.logger`; **no** se cambia el logger por defecto
  de `createFakeRenderApiDependencies` (hoy no-op), porque varios specs de `cycle-02` assertan
  `callLog.ports()` con arrays exactos y cablearlo al `callLog` los rompería a todos.
- **`createFakeRenderApiDependencies(callLog, overrides?)`** suma un único puerto: `randomId`, con
  un contador determinista que devuelve `render-0001`, `render-0002`, … Ids legibles hacen legibles
  las aserciones sobre `out/<id>.mp4`. Ningún otro campo del fixture cambia de forma.
- **Ningún spec nuevo** importa `execa`, `node:child_process`, `@video-maker/media-local` ni
  `@video-maker/composition-remotion` por su entrada real (RNF-3/RNF-9). El único que toca disco
  sigue siendo `node-render-api-dependencies.spec.ts`, contra un directorio temporal.
- **Fixtures generadas, nunca copiadas** (lección del repo): la `Timeline` de los tests sale de
  `buildMinimalTimeline()` (`src/__fixtures__/minimal-timeline.ts`, vigente desde `cycle-01`); el
  `RenderPipelineReport` de los tests sale de correr el pipeline con los dobles, **no** de un
  literal pegado de otro documento.

---

## 13. Smoke real E2E (CA-033, RF-27, RNF-13)

Ejecución real del proceso contra binarios reales. **No es un test**: la suite sigue corriendo sin
ffmpeg, ffprobe, whisper-cli ni Chrome. Es la primera vez en la spec que se ejercita el bundle
webpack de Remotion de punta a punta (D-10, declarado no verificado desde `cycle-01`) y es la
evidencia que permite marcar `FIX-e-burgos-001-001` como `validated` (RF-28).

### 13.1 Preparación (no es opcional)

| Precondición | Por qué | Cómo se verifica |
| --- | --- | --- |
| `media/smoke-ingest/` con `work/timeline.json`, `raw/aroll/clip01.mp4` y `raw/audio/music01.mp3` | Es el proyecto real: `format` = `reels-9x16` 1080×1920@30, `durationFrames: 538`, `audioMix.voice` = `-14 LUFS` / `-1 dBTP` / `LRA 11` | `ls` de los tres archivos antes de arrancar |
| `set -a && source .env && set +a` | Las variables de binarios del proyecto (`FFMPEG_PATH`, `FFPROBE_PATH`, …) están en el `.env` raíz gitignoreado y **Nx sólo las carga en sus targets**: una invocación directa de `node` no las ve | `GET /health` con `binaries[].resolved: true` |
| `SWC_NODE_PROJECT=tsconfig.base.json` | Sin esto el proceso **ni arranca**: el registro de `@swc-node` no hereda los `paths` de `tsconfig.base.json` y `@video-maker/auto-montage` no resuelve. El guion de `cycle-02` §13 no lo lleva y por eso no es copiable (fragmento de contexto de `cycle-02` § "Qué sigue") | el proceso llega a imprimir `{"event":"listening",…}` |
| Puerto **4399**, no el default 4310 | `pnpm sdd:docs` ocupa 4310 en la máquina del dev (fragmento de contexto de `cycle-01`) | `curl` a `/health` responde |
| `RENDER_API_MEDIA_ROOT="$PWD/media"` | El smoke corre contra el `media/` **real**, no contra un temporal: necesita los assets ya ingeridos | `GET /projects` lista `smoke-ingest` |
| Sin `ffmpeg`/`whisper-cli`/`chrome-headless` vivos y con ≥ 35 % de memoria libre | Lección medida del repo: un render de 1080×1920 compite con cualquier otro proceso pesado | `pgrep -l 'ffmpeg|whisper-cli|Chrome' ; vm_stat` antes de arrancar |

### 13.2 El guion

```bash
set -a && source .env && set +a
pgrep -l 'ffmpeg|whisper-cli|[Cc]hrome' && { echo 'ABORT: heavy process alive'; exit 1; }
ls media/smoke-ingest/work/timeline.json \
   media/smoke-ingest/raw/aroll/clip01.mp4 \
   media/smoke-ingest/raw/audio/music01.mp3

PORT=4399
BASE="http://127.0.0.1:$PORT"
ART="sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/artifacts"
mkdir -p "$ART"

RENDER_API_PORT=$PORT RENDER_API_MEDIA_ROOT="$PWD/media" SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts \
  > "$ART/server.log" 2>&1 &
API_PID=$!

until curl -sf "$BASE/health" > /dev/null; do sleep 0.5; done
curl -s "$BASE/health" | tee "$ART/health.json"            # jobQueue:true, cycle:3, binaries resolved

JOB_ID="$(curl -s -X POST "$BASE/projects/smoke-ingest/jobs" \
  | tee "$ART/job-created.json" \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>process.stdout.write(JSON.parse(s).id))")"
echo "job=$JOB_ID"

SECOND_ID="$(curl -s -X POST "$BASE/projects/smoke-ingest/jobs" \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.error(j.state);process.stdout.write(j.id)})")"
curl -s -o /dev/null -w 'cancel-queued=%{http_code}\n' -X DELETE "$BASE/jobs/$SECOND_ID"   # 200

DEADLINE=$(( $(date +%s) + 1800 ))
while :; do
  SNAP="$(curl -s "$BASE/jobs/$JOB_ID")"
  printf '%s\n' "$SNAP" >> "$ART/job-poll.jsonl"
  STATE="$(printf '%s' "$SNAP" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.state)})")"
  printf '%s' "$SNAP" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.state,JSON.stringify(j.progress))})"
  case "$STATE" in
    succeeded) break ;;
    failed|canceled) echo "SMOKE FAILED: $STATE"; printf '%s\n' "$SNAP" > "$ART/job-final.json"; break ;;
  esac
  [ "$(date +%s)" -ge "$DEADLINE" ] && { echo 'SMOKE FAILED: timeout'; break; }
  sleep 5
done
curl -s "$BASE/jobs/$JOB_ID" > "$ART/job-final.json"

OUT="$(mktemp -t smoke-deliverable).mp4"
curl -s -o "$OUT" -w 'download=%{http_code} %{size_download}\n' \
  "$BASE/projects/smoke-ingest/files/out/$JOB_ID.mp4"

ls -l "media/smoke-ingest/work/renders/$JOB_ID/video-muted.mp4" \
      "media/smoke-ingest/work/renders/$JOB_ID/master.wav" | tee "$ART/intermediates.txt"

ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames \
  -of json "$OUT" | tee "$ART/ffprobe-video-stream.json"
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_name,channels,sample_rate,duration \
  -of json "$OUT" | tee "$ART/ffprobe-audio-stream.json"

node -e '
const { execFileSync } = require("node:child_process");
const out = process.argv[1];
const probe = (args) => JSON.parse(execFileSync(process.env.FFPROBE_PATH ?? "ffprobe", args, { encoding: "utf8" }));
let v = probe(["-v","error","-select_streams","v:0","-show_entries","stream=nb_frames,r_frame_rate","-of","json",out]).streams[0];
let frames = Number(v.nb_frames);
if (!Number.isFinite(frames) || frames <= 0) {
  v = probe(["-v","error","-select_streams","v:0","-count_frames","-show_entries","stream=nb_read_frames,r_frame_rate","-of","json",out]).streams[0];
  frames = Number(v.nb_read_frames);
}
const [num, den] = v.r_frame_rate.split("/").map(Number);
const fps = num / den;
const expectedFrames = 538;
const seconds = frames / fps;
const expectedSeconds = expectedFrames / 30;
console.log(JSON.stringify({ frames, expectedFrames, rFrameRate: v.r_frame_rate, fps, seconds, expectedSeconds,
  frameDelta: frames - expectedFrames, secondsDelta: seconds - expectedSeconds,
  withinTolerance: Math.abs(frames - expectedFrames) <= 1 }, null, 2));
' "$OUT" | tee "$ART/duration-check.json"

ffmpeg -nostdin -hide_banner -i "$OUT" -map a:0 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 \
  | tail -n 20 | tee "$ART/loudnorm-independent.txt"

kill -TERM "$API_PID"; wait "$API_PID"; echo "exit=$?" | tee -a "$ART/server.log"   # exit=0
rm -f "$OUT"
```

### 13.3 Qué prueba, línea por línea, y con qué tolerancia

| Línea | Qué prueba | Criterio de aceptación |
| --- | --- | --- |
| `GET /health` | La cola está declarada y los binarios resuelven | `capabilities.jobQueue: true`, `cycle: 3`, `binaries[].resolved: true`, `engine[].loaded: true` |
| `POST /projects/smoke-ingest/jobs` | EP-012 crea un job leyendo la `Timeline` del store, sin body | `202`, header `location: /jobs/<id>`, `state` `running`, `id` generado por el servicio |
| segundo `POST` + `DELETE` | Concurrencia 1 y cancelación real de un job en cola, contra el proceso real (CA-022 y CA-026 fuera de los dobles) | el segundo job nace `queued`; el `DELETE` responde **200** con `state: "canceled"` |
| polling de `GET /jobs/:id` | EP-014, progreso por etapa y por frame contra Remotion real; **primera evidencia de que el bundle webpack bundlea** (D-10) | se observan `stage` `prepare` → `render` (con `renderedFrames` creciendo hasta `538` y `percent` hasta `100`) → `mix` → `mux` → `verify`, y `state: "succeeded"` |
| `GET .../files/out/<id>.mp4` | EP-011 sirve el entregable del job (RF-24) | `200` y `size_download > 0` |
| `ls` de los intermedios | D-8 / CA-030: el job no borra nada | `work/renders/<id>/video-muted.mp4` y `master.wav` existen y pesan > 0 |
| `ffprobe -select_streams v:0` | El entregable tiene stream de video con el formato del preset | `codec_name` h264, `width` 1080, `height` 1920 |
| `duration-check.json` | **La verificación de duración de RF-27** | `frames` = `nb_frames` (o `nb_read_frames` si el primero viene vacío o 0) del **stream de video**; `fps` = `r_frame_rate` parseado como fracción (`"30/1"` → 30); `seconds = frames / fps`; esperado `538 / 30 = 17.9333…` s. **Tolerancia: `|frames − 538| ≤ 1`**, es decir ±1 frame ≡ ±0,0334 s |
| — | **`format.duration` NUNCA se usa** | En un mp4 con audio AAC remuxeado, `format.duration` es el máximo entre streams e incluye el padding de priming del AAC: mide de más y no mide frames. Lección medida del repo (bisección de una spec entera) |
| `ffprobe -select_streams a:0` | El mux produjo un stream de audio (RF-24) | la salida trae **un** stream con `codec_name` y `channels`. Se **registra** el codec, no se asserta un valor concreto: lo elige `muxAudioIntoVideo` de `libs/media-local`, y fijarlo acá duplicaría una decisión de otra spec |
| `job-final.json → report.loudness` | La etapa `verify` corrió y midió | `integratedLufs`, `truePeakDbtp`, `integratedDeltaLu`, `truePeakDeltaDb` y `withinTolerance` presentes. Tolerancias de `verifyMixLoudness`: `|integratedDeltaLu| ≤ 1 LU` y `truePeakDeltaDb ≤ 0 dB` |
| — | **`withinTolerance: false` NO falla el smoke** | **D-7 sigue vigente**: se publica el entregable y se reporta el delta; no se reintenta ni se re-masteriza. Un integrado fuera de tolerancia es información editorial. El smoke falla sólo si el bloque `loudness` **falta** |
| `loudnorm-independent.txt` | Medición **independiente** del entregable, fuera del código bajo prueba | `input_i` cerca de `-14`, `input_tp` ≤ `-1`. Es evidencia cruzada: el `report.loudness` del job sale del mismo camino de código que se está verificando |
| `kill -TERM` | Apagado ordenado | `exit=0` observado sobre el **proceso**, nunca vía `nx run` (Nx normaliza todo fallo a `1`) |

**Tolerancia de duración, fundamento.** `durationFrames` es `538` exacto y `fps` es `30` exacto: la
composición de Remotion no tiene margen de redondeo. Se admite **±1 frame** por la única diferencia
real posible (convención del muxer sobre el frame final), no por incertidumbre de medición. Un
delta mayor a 1 frame es un defecto del pipeline, no ruido, y el smoke debe reportarlo como falla.

### 13.4 Artefactos a guardar en `cycles/cycle-03/artifacts/`

| Archivo | Contenido |
| --- | --- |
| `server.log` | stdout/stderr del proceso, incluida la línea `{"event":"listening",…}` y el `exit=0` final |
| `health.json` | body literal de `GET /health` |
| `job-created.json` | body literal del `202` de EP-012 |
| `job-poll.jsonl` | una línea por consulta de `GET /jobs/:id` — la traza completa de estados y progreso |
| `job-final.json` | body literal del job `succeeded`, con su `report` completo |
| `intermediates.txt` | `ls -l` de `video-muted.mp4` y `master.wav` (CA-030) |
| `ffprobe-video-stream.json` | salida literal de ffprobe sobre `v:0` |
| `ffprobe-audio-stream.json` | salida literal de ffprobe sobre `a:0` |
| `duration-check.json` | frames, `r_frame_rate`, segundos derivados, deltas y veredicto de tolerancia |
| `loudnorm-independent.txt` | medición independiente de loudness sobre el entregable |

**Si alguna línea no corre** (un binario que no resuelve, memoria insuficiente, el bundle que
falla), se registra explícitamente **cuál** y **por qué** en el reporte del reviewer y en el README.
Un CA documentado y nunca ejecutado **no está verificado** — es exactamente el defecto que
`FIX-e-burgos-001-001` corrigió y que este ciclo existe para no repetir.

---

## 14. Decisiones técnicas (`D-18`..`D-29`)

Continúan la numeración de la spec (`D-1`..`D-17`), en su mismo formato.

| Id | Decisión | Fundamento |
| --- | --- | --- |
| **D-18** | **Las rutas de la cola son `POST` y `GET /projects/:slug/jobs` (creación y listado) y `GET` y `DELETE /jobs/:jobId` (consulta y cancelación).** Es una divergencia declarada del "Plan de ciclos" de la spec, que anticipaba `POST /jobs`, `GET /jobs/:id`, `DELETE /jobs/:id`. | La creación y el listado son operaciones **sobre un proyecto**: RN-3 obliga a identificar el proyecto para crear y RN-6 hace el listado scoped por slug. Colgarlas de `/projects/:slug/` sigue la convención que `cycle-02` ya estableció para los cuatro recursos del store (`assets`, `timeline`, `edl`, `files`) y hace innecesario un body en la creación. La consulta y la cancelación, en cambio, se dirigen a un **job**, que es globalmente único (la cola es global, no por proyecto: RF-18): exigir el slug ahí agregaría un segmento redundante y un caso de error nuevo ("id correcto, slug equivocado") que no describe nada útil. *Descartado:* `POST /jobs` con `{ "slug": … }` en el body — obliga a leer y validar un body (dos caminos de error nuevos: `REQUEST_BODY_INVALID_JSON`, `REQUEST_BODY_TOO_LARGE`) para transportar un dato que la URL ya puede llevar. |
| **D-19** | **La creación no acepta body y la `Timeline` se lee, valida y "snapshotea" en la request de creación**, no al despachar. El job renderiza la `Timeline` que existía cuando se lo creó. | RN-3 prohíbe aceptarla por body y CA-021 exige leer el store **exactamente una vez antes de encolar** — leerla al despachar violaría las dos cosas. Además hace el resultado determinista: si el cliente hace `PUT /timeline` mientras el job está `queued`, el job no cambia de contenido a mitad de espera. *Descartado:* releer al despachar — necesitaría un camino de error nuevo ("la timeline desapareció entre la creación y el despacho") cuyo disparo depende del reloj, y haría que dos jobs creados sobre el mismo estado produjeran videos distintos. |
| **D-20** | **`POST` responde `202 Accepted` con `location: /jobs/<id>`; `DELETE` responde `200` (job en cola) o `202` (job en ejecución).** | `202` es la semántica exacta de la creación: el **recurso job** existe y es consultable de inmediato, pero **el entregable no** — un `201` prometería que `out/<id>.mp4` está listo. En el `DELETE`, los dos status expresan en la línea de estado la asimetría que RF-22 exige: `200` = hecho y terminal; `202` = aceptado, todavía en curso. Que la asimetría viva sólo en el body obligaría a todo consumidor a parsear JSON para saber si su cancelación surtió efecto. |
| **D-21** | **Existe un estado transitorio `canceling`, observable.** `queued + cancel → canceled` (terminal inmediato); `running + cancel → canceling → canceled`. No existe `running → canceled` directa. | RN-2 exige que el resultado de cancelar un job en ejecución sea "observable y distinguible", y deja el mecanismo al architect. Sin `canceling`, entre el `202` y el estado final el job seguiría diciendo `running`, indistinguible de uno que nadie canceló: el consumidor no sabría si su petición llegó. `canceling` es la respuesta honesta a "tu cancelación fue aceptada y el binario en curso está terminando". *Descartado:* cancelar de inmediato a `canceled` y dejar el binario huérfano — el proceso hijo seguiría escribiendo en `work/` de un job que el registro dice terminado, y el slot de la cola se liberaría con la máquina todavía ocupada. |
| **D-22** | **La cancelación de un job en ejecución es cooperativa entre etapas y se señaliza con `RenderPipelineCanceledError`, una clase propia del pipeline que NO pertenece a la jerarquía `RenderApiError`. Al liquidar, el estado vigente es la autoridad: `canceling` gana sobre el resultado del pipeline.** | (a) *Cooperativa:* matar `ffmpeg` o Chrome a mitad de invocación deja un `.mp4`/`.wav` truncado que nada distingue de uno bueno, y no hay puerto para hacerlo (los puertos devuelven promesas, no handles de proceso). (b) *Fuera de la jerarquía de errores:* un `RenderApiErrorCode` obliga a una fila en `STATUS_BY_CODE` y `MESSAGE_BY_CODE`, y ese status **nunca** se devolvería — una cancelación se observa como `state: "canceled"` con `200`. Sería una fila que miente. (c) *El estado gana:* `verify` es la última etapa y no tiene checkpoint posterior; sin esta regla, cancelar durante `verify` daría `succeeded` y CA-027 sería falso en un caso alcanzable. Con ella, las dos ramas del `settle` son alcanzables y testeables. |
| **D-23** | **La cola vive en un `RenderApiRuntime` por servidor, cuarto parámetro obligatorio de `handleRequest`; y ese mismo objeto absorbe el `uploadSerializer`, saldando la deuda heredada de `cycle-02`.** `createKeyedSerializer` no se toca. | `RenderApiDependencies` es un contrato de **puertos sin estado** que cada test construye entero; una cola es una **máquina con estado** que además necesita las dependencias para correr el pipeline (meterla adentro es una dependencia circular que sólo se rompe con un setter o un `let`). Separar puertos de estado vivo es la distinción correcta. Sobre la deuda: este ciclo **ya** obliga a pasar estado vivo por parámetro, así que el objeto existe con o sin el serializador; sumarle un campo cuesta tres líneas, y el costo real —pasar el `runtime` en `assets-handler.spec.ts`— es mecánico y no cambia una sola aserción. Dejarla un ciclo más significaría convivir con dos modelos de estado vivo (uno por parámetro, uno por singleton de módulo) en el mismo archivo de handlers, que es peor que cualquiera de los dos puro. Y el defecto que la deuda describe es real: dos servidores en el mismo proceso —lo que hace `create-render-api-server.spec.ts`— hoy comparten el serializador. |
| **D-24** | **El `renderId` lo genera un puerto nuevo `randomId: () => string`**, cuyo adaptador de producción es `randomUUID()`. El doble es un contador determinista (`render-0001`, `render-0002`, …). | RN-1 exige que el id lo genere el servicio, y el invariante vigente del subproyecto confina `node:crypto` al adaptador (`cycle-02` §14). Un puerto es la única forma de cumplir las dos cosas. Además, ids deterministas en los tests hacen legibles las aserciones sobre `out/<id>.mp4` y `work/renders/<id>/`, que si no serían UUIDs sin significado. *Descartado:* derivar el id de `clock.nowIso()` — dos creaciones en el mismo milisegundo colisionarían sobre el mismo `out/<id>.mp4`, que es exactamente lo que RN-1 quiere evitar. |
| **D-25** | **El progreso por frame es monotónico por construcción (`mergeRenderProgress` descarta un `renderedFrames` menor), existe sólo en la etapa `render`, y se congela —no se borra— al llegar a un estado terminal.** | (a) *Monotonía:* CA-023 pide que dos consultas sucesivas nunca decrezcan; el contrato del puerto no exige que el productor sea monotónico, así que la garantía tiene que vivir del lado que la promete. (b) *Sólo `render`:* RN-4 — inventar un porcentaje para `prepare`/`mix`/`mux`/`verify` sería un número que no mide nada. (c) *Congelado:* un job `canceled` o `failed` cuyo `progress` se borrara perdería el único dato que dice **dónde** se cortó, y evitarlo con un campo nuevo (`canceledAtStage`) duplicaría información que `progress.stage` ya tiene. |
| **D-26** | **El historial de jobs no tiene cap ni purga: `records` crece hasta el reinicio del proceso.** Declarado como límite conocido en el README junto con RNF-12. | RNF-12 ya establece que la cola no sobrevive al reinicio, así que la cota superior de crecimiento es una sesión de trabajo del dev. RN-7 ya previó que un job purgado caería en `404 RENDER_JOB_NOT_FOUND`, el mismo camino que un id inexistente: agregar un cap después **no cambia ningún contrato observable**. *Descartado:* un cap ahora — inventaría un parámetro de configuración, un código de error o una fila de tabla para un problema que este servicio (un dev, una máquina, un render por vez) no tiene. |
| **D-27** | **`GET /health` suma `capabilities.jobQueue: true`, `cycle: 3` y un bloque nuevo `jobs: { running, queued }` que NO participa del cálculo `ok`/`degraded`.** | `capabilities` declara **qué sabe hacer** la instancia; `status` declara **si puede hacerlo** — la misma división que `cycle-02` estableció con `assetStore` (CA-018). Una cola ocupada es operación normal, no degradación: marcar `degraded` con `running: 1` le diría a un supervisor que reinicie el proceso justo mientras rinde. Y una cola vacía no es salud: `running: 0` no distingue "sin trabajo" de "colgada". `jobs` es un contador de **carga**, que es justo lo que un operador necesita antes de disparar un render (la máquina no soporta dos a la vez). La cola no tiene recurso externo que pueda fallar: es un `Map`. |
| **D-28** | **`assertValidProjectSlug`, `resolveExistingProject` y `readStoredTimeline` se centralizan en `src/store/project-scope.ts`, y los cuatro handlers existentes migran** (`montage`, `assets`, `artifact`, más el nuevo `jobs`). | El endpoint de creación necesita exactamente los tres pasos que `handleGetTimeline` ya hace; copiarlos sería la cuarta copia de `assertValidProjectSlug` y la tercera de `resolveExistingProject`. Y `readStoredTimeline` **tiene** que ser un símbolo propio: es el que CA-021 verifica ("lee `work/timeline.json` exactamente una vez"). Migrar los tres handlers vigentes es un cambio sin efecto observable —el compilador lo verifica entero— y ninguno de sus specs cambia. *Descartado:* extraer sólo para el handler nuevo y dejar las copias — introducir un módulo compartido y no usarlo desde tres de los cuatro lugares deja el peor estado posible: dos verdades sobre la misma regla, y la siguiente corrección se aplica a una sola. |
| **D-29** | **El smoke verifica la duración contra el stream de video (`nb_frames` ÷ `r_frame_rate` parseado como fracción) con tolerancia de ±1 frame, nunca contra `format.duration`; y `withinTolerance: false` NO hace fallar el smoke.** | `format.duration` es el máximo entre streams e incluye el padding de priming del AAC: mide de más y no mide frames (lección medida del repo, costó una bisección entera). La tolerancia es ±1 frame y no más, porque `durationFrames: 538` y `fps: 30` son exactos en la composición: el único margen real es la convención del muxer sobre el frame final; un delta mayor es un defecto, no ruido. Sobre loudness: **D-7 sigue vigente** — el entregable se publica y el delta se reporta; el smoke falla sólo si el bloque `loudness` **falta**, no si está fuera de tolerancia. Se agrega además una medición `loudnorm` independiente porque el `report.loudness` del job sale del mismo camino de código que se está verificando. |

---

## 15. Configs protegidas — diff a escalar

**Ninguna config protegida hace falta para implementar este ciclo.** `tsconfig.base.json` ya tiene
los cuatro paths que este diseño usa y `apps/render-api/eslint.config.mjs` sigue sin existir (D-9).

**Este ciclo no suma ningún import restringido nuevo:** la cola no importa un solo módulo `node:`
(el id sale del puerto `randomId`, D-24; el despacho no usa timers). El bloque propuesto de
`cycle-02` §14 queda **sin cambios**, y se reproduce acá completo para que el dev no tenga que
reconstruirlo de tres documentos cuando decida pegarlo:

```js
{
  files: ['src/**/*.ts'],
  ignores: [
    'src/deps/node-render-api-dependencies.ts',
    'src/deps/node-render-api-dependencies.spec.ts',
    'src/main.ts',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['node:fs', 'node:fs/*', 'node:crypto'],
            message: 'Filesystem and randomness go through the ObjectStorage and randomId ports.',
          },
        ],
      },
    ],
  },
},
```

Las tres correcciones acumuladas siguen siendo las de `cycle-02` §14 (el spec del adaptador usa
`node:fs/promises` real contra un directorio temporal; `node:crypto` en el grupo restringido; el
invariante se sostiene por grep mientras el archivo no exista). Este ciclo agrega una sola
precisión al **mensaje** de la regla: `randomId` es ahora el segundo puerto que justifica el
confinamiento de `node:crypto`.

Mientras el archivo no exista, el invariante se verifica al cerrar con el grep de `cycle-02`, sin
cambios:

```bash
grep -rnE "\bprocess\.|\bconsole\.|from 'node:(fs|crypto)" apps/render-api/src --include='*.ts' \
  | grep -vE '^apps/render-api/src/(main\.ts|deps/node-render-api-dependencies(\.spec)?\.ts):'
```

Debe salir vacío.

---

## 16. Escalado al dev

**Ninguna dependencia npm nueva hace falta** (RNF-11 / D-2). Los cuatro candidatos que un diseño
convencional pediría, y la alternativa nativa efectivamente usada:

| Candidato | Para qué se pediría | Alternativa nativa de este diseño |
| --- | --- | --- |
| `bullmq` / `p-queue` / `fastq` | La cola con concurrencia 1 | §5: un `Map` (orden de inserción = orden de creación), un `string[]` FIFO y un `activeId`. El despacho es una llamada sin `await`. ~120 líneas puras, sin persistencia (RNF-12 no la quiere) ni broker |
| `uuid` / `nanoid` | El `renderId` | D-24: puerto `randomId`, adaptador `randomUUID()` de `node:crypto`, ya disponible y ya confinado |
| `abort-controller` / `p-cancelable` | Cancelación | §8: `observer.cancellationRequested()` leído en cuatro checkpoints. `AbortSignal` es nativo, pero no aporta nada acá: los puertos no lo aceptan y no se puede abortar un binario a mitad de invocación sin corromper su salida (D-22) |
| `express` / `fastify` | Las cuatro rutas nuevas | El router propio de `cycle-02` ya soporta `:param`; las cuatro rutas son cuatro filas en `ROUTES` y cuatro `case` en el `switch`, sin una línea de router nueva |

**Un único punto de atención para el dev, no bloqueante:** el smoke de §13 corre contra el `media/`
**real** y deja artefactos reales en `media/smoke-ingest/work/renders/<id>/` y
`media/smoke-ingest/out/<id>.mp4` (dos por corrida contando el job cancelado, que no deja ninguno).
No se borran (D-8): si se acumulan, los limpia el dev, no el servicio.

---

## 17. Riesgos que este contrato deja abiertos

1. **La cola no sobrevive al reinicio y no tiene cap** (RNF-12, D-26). Un `SIGTERM` con un job
   `running` deja el proceso hijo huérfano (`ffmpeg`/Chrome siguen hasta terminar) y el registro
   del job se pierde: no hay forma de volver a consultarlo. El README lo declara. Un apagado que
   espere a `whenIdle()` es de otro ciclo — la firma ya está lista para eso.
2. **La cancelación de un job en ejecución puede tardar una etapa entera.** En `render` de un
   1080×1920 de 538 frames eso son minutos. Está escrito en §8.2 y en el README, pero es la
   expectativa que más fácil se rompe: un consumidor que espere un corte inmediato va a leer
   `canceling` durante mucho tiempo y va a pensar que se colgó.
3. **Un job `canceled` puede haber dejado un `out/<id>.mp4` completo** (§8.3). Nada en el payload
   lo dice: `report` es `null`. Un consumidor que liste `out/` y cruce con los jobs va a encontrar
   entregables sin job `succeeded` que los reclame.
4. **La concurrencia 1 es intra-proceso.** Dos instancias de `render-api` sobre el mismo `media/`
   corren dos renders a la vez y se pisan `work/renders/` sólo si comparten `renderId` (imposible
   con `randomUUID`), pero sí compiten por CPU, memoria y GPU, que es lo que la decisión de
   producto quería evitar. Es el mismo riesgo entre procesos que `cycle-02` documentó para el
   catálogo; sigue sin lock.
5. **`totalFrames` viene de Remotion, no de la `Timeline`.** Si `composition.durationInFrames`
   difiere de `timeline.durationFrames` (por ejemplo si la composición redondea), el `percent` del
   job y la verificación de duración del smoke miden contra números distintos. El smoke lo
   detectaría (compara `nb_frames` contra `538`), pero recién al final.
6. **`jobs-handler.ts` concentra los cuatro endpoints.** Hoy son cortos porque tres de ellos no
   tocan puertos (§6.6); si la cola crece (reintentos, prioridad, purga), hay que partirlo antes de
   que su spec se vuelva ilegible. El umbral de 80 % no detecta eso.

---

## 18. Contratos a registrar

> El architect **no escribe** los registros de este ciclo: el orquestador los aplica y corre
> `pnpm sdd:validate`. Estas son las filas exactas.

`sdd/api.json`, app-key `apps/render-api`:

| Id | Método | Path | Status | Ciclo |
| --- | --- | --- | --- | --- |
| `EP-001` | `GET` | `/health` | `updated` | 1 → 2 → actualizado en **3** (`capabilities.jobQueue: true`, `cycle: 3`, campo `jobs`) |
| `EP-012` | `POST` | `/projects/:slug/jobs` | `defined` | 3 |
| `EP-013` | `GET` | `/projects/:slug/jobs` | `defined` | 3 |
| `EP-014` | `GET` | `/jobs/:jobId` | `defined` | 3 |
| `EP-015` | `DELETE` | `/jobs/:jobId` | `defined` | 3 |

`EP-002`..`EP-011` no cambian de status por este ciclo.

`sdd/schema.json`: **sin cambios** — este subproyecto no tiene base de datos (§1.3).

`sdd/fixes.json`: `FIX-e-burgos-001-001` pasa a `validated` **sólo si** el smoke de §13 corrió y
`job-final.json` dice `succeeded` (RF-28). Si el smoke no corrió, el fix se queda como está y el
reviewer lo declara explícitamente.

---

## 18. Addendum post-smoke — `D-30` (agregado por el orquestador el 2026-09-08)

> Esta sección se agrega **después** de cerrar el documento, porque el smoke real de §13 encontró un
> defecto que ningún test de la suite podía ver. Se deja acá y no en otro lado porque cambia la
> **firma de un puerto**, que es contrato de arquitectura.

| Id | Decisión | Fundamento |
| --- | --- | --- |
| **D-30** | **`MixTimelineAudioInput` gana `projectRoot`, y el adaptador de producción invoca `mixTimelineAudio` con `runOptions: { cwd: projectRoot }`.** El `projectRoot` que recibe la etapa `mix` es **el mismo** `paths.publicDir` que ya recibe `renderMutedVideo`. | `Timeline.assets[].path` que escribe `auto-montage` es **relativo al proyecto** (`raw/aroll/clip01.mp4`). `mixTimelineAudio` pasa esos paths tal cual a ffmpeg y `ExecaCommandRunner` corre con el cwd del proceso de la API — la raíz del repo —, donde no existen. La etapa `render` no lo sufre porque `renderTimeline` ya recibe `publicDir`; `mux` y `verify` tampoco, porque sólo manejan paths absolutos. Es un defecto latente del puerto de `cycle-01` (`{ timeline, outPath }`, sin raíz), que nunca se disparó porque hasta este ciclo ninguna ruta HTTP invocaba `runRenderPipeline` y `apps/render-api` es el **único llamador de `mixTimelineAudio` en todo el repo** (`tools/render-cli` no lo usa). `MixTimelineAudioOptions.runOptions` es `CommandOptions { cwd?, timeoutMs? }`: la API pública de `libs/media-local` ya soportaba esto, así que **la lib no se toca**. |

### 18.1 Evidencia

Reproducido en las dos ramas contra `media/smoke-ingest` antes de asignar la corrección:

```
sin cwd  → CommandFailedError
           Error opening input: No such file or directory
           Error opening input file raw/aroll/clip01.mp4.
con cwd  → OK  media/smoke-ingest/work/renders/repro/master.wav  (3,3 MB)
```

Traza del job que lo descubrió (`artifacts/job-poll.jsonl`): `stage: render` con `renderedFrames`
306 → 520 de 538 (`percent` 56 → 96) y después
`{"state":"failed","error":{"code":"MEDIA_COMMAND_FAILED","stage":"mix","resource":"work/renders/<id>/master.wav"}}`.

### 18.2 Tests obligatorios de D-30 (suman a §12.1)

| Archivo | Nombre del test | Símbolo que ejercita |
| --- | --- | --- |
| `src/pipeline/run-render-pipeline.spec.ts` | el input que recibe `mixTimelineAudio` en el `callLog` lleva `projectRoot` **igual al `publicDir`** que recibió `renderMutedVideo` | `runRenderPipeline` |
| `src/deps/node-render-api-dependencies.spec.ts` | el 4º argumento de `mixTimelineAudio` trae `runOptions.cwd` con la raíz del proyecto | `createNodeRenderApiDependencies` |

### 18.3 Lección

El smoke real de §13 pagó su costo en la primera corrida. `render` y `mix` **resuelven paths
relativos contra bases distintas** y ningún test lo veía: el doble del puerto no resuelve paths, y
la única otra herramienta del repo que arma un pipeline (`tools/render-cli`) no pasa por esta
función. Un puerto que recibe un documento con paths relativos y **no** recibe su raíz es un
defecto de contrato, no un detalle de implementación.
