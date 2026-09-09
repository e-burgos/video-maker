# Architect — Cycle 1: Web Montage (montage-job-api)

> **Input:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect

---

## 0. Resumen para el planner

`apps/render-api` gana un segundo `kind` de job (`'montage'`) en la MISMA cola que ya existe
(`RenderJobQueue`, concurrencia 1, FIFO, en memoria). El job de montaje ejecuta, en este orden,
exactamente las mismas cuatro llamadas que hace `tools/render-cli run` para `ingest` + `plan`:

```
assertMontageProjectIsIngestable(project)   // nuevo, local a render-api
  → resolveMontageBinaries(env)              // nuevo puerto, los 4 binarios
    → ingestProject(project, { binaries }, deps)   // libs/auto-montage, SIN cambios
      → autoMontage(project, { preset, seed }, deps) // libs/auto-montage, SIN cambios
```

Las cuatro etapas observables (`discover`/`probe`/`transcribe`/`plan`) se producen decorando el
`CommandRunner` inyectado (D-5), nunca tocando `libs/auto-montage`. El endpoint sigue siendo el
mismo (`POST /projects/:slug/jobs`, D-2 ratificada), con un discriminante `kind` en el body.

---

## 1. Decisiones ratificadas/rebatidas con evidencia

### 1.1 D-2 — Un solo endpoint de jobs con discriminante `kind` — **RATIFICADA**

Evidencia medida en `apps/render-api/src/http/handlers/jobs-handler.ts::handleCreateRenderJob`
(estado actual, antes de este ciclo): la función no lee `request.body` en absoluto — sólo usa
`params.slug`. Esto confirma literalmente lo que `sdd/api.json → EP-012` ya documenta ("Takes no
request body: a payload, if sent, is never read or parsed"). Cualquier payload que `apps/web` haya
mandado hasta hoy fue ignorado; introducir un campo `kind` opcional es, por construcción,
retro-compatible con el cliente actual.

Además: `apps/render-api/src/jobs/render-job-queue.ts::createRenderJobQueue` ya es agnóstico al
contenido del job — `records`, `pending`, `dispatchNext()` y la máquina de estados
(`applyRenderJobEvent` en `render-job-state.ts`) no miran ni un campo de `RenderJob` que sea
específico de render; sólo `runJob()` invoca `runRenderPipeline`. Un segundo endpoint exigiría, o
bien una segunda cola (perdiendo la garantía de concurrencia 1 entre los dos tipos de trabajo, RN-7),
o bien un dispatcher cruzado entre dos colas — estrictamente más código y más riesgo que agregar un
`kind` a la cola existente. Y `GET /jobs/:jobId` (`EP-014`) ya resuelve por id global
(`records: Map<string, RenderJobRecord>`, no por slug), así que un segundo `kind` no parte el modelo
de lectura.

**Veredicto: ratificada, sin reservas.**

### 1.2 D-5 — Observar las cuatro etapas decorando el `CommandRunner` inyectado — **RATIFICADA**

Evidencia medida:

- `libs/auto-montage/src/ingest/ingest-project.ts::ingestProject` no acepta ningún observador de
  progreso en `IngestOptions`/`IngestDependencies`, y hace `discoverAssets` → `probeAssets` →
  `transcribeAssets` dentro de una sola función `async`, sin ceder el control entre esas tres
  sub-llamadas a nada que la API pueda inyectar.
- `libs/auto-montage/src/index.ts` (el barrel público) **no exporta** `probeAssets` ni
  `transcribeAssets` — sólo `ingestProject`, `discoverAssets` y `autoMontage`. No hay forma de
  invocar las sub-etapas por separado sin importar rutas internas de la lib (prohibido: rompe el
  contrato de barrel y la byte-identidad de D-4 al abrir la puerta a reimplementar la orquestación).
- `libs/auto-montage/src/auto-montage.ts::autoMontage` **no usa `CommandRunner` en absoluto** — su
  `MontageDependencies` sólo tiene `readTextFile`/`writeTextFile`/`ensureDirectory`. La etapa `plan`
  nunca invoca un binario; por eso `plan` no puede fijarse por clasificación de `CommandRunner` y
  tiene que fijarla el job mismo, justo antes de llamar a `autoMontage` (igual que `discover`, que
  tampoco invoca `CommandRunner` — `discoverAssets` sólo usa `readDirectory`/`statFile`).
- Los binarios SÍ se invocan siempre por `runner.run(binPath, args, opts)`, y siempre con la ruta ya
  resuelta como primer argumento — medido en `libs/media-local/src/ffprobe/probe-media.ts:26`
  (`runner.run(ffprobePath, ...)`, usado sólo por `probeAssets`), `libs/media-local/src/whisper/transcribe-with-whisper-cpp.ts:48`
  (`runner.run(whisperPath, ...)`, usado sólo por `transcribeAssets`) y
  `libs/media-local/src/ffmpeg/extract-audio.ts:39` (`runner.run(ffmpegPath, ...)`, usado por
  `transcribeAssets` para extraer el audio **antes** de invocar whisper — nunca por `probeAssets`).
  Esto confirma la clasificación exacta que pide el brief: `binaries.ffprobe` → única señal de
  `probe`; `binaries.ffmpeg` o `binaries.whisperCli` → única señal de `transcribe`. Ningún binario
  se comparte entre `probe` y `transcribe`, así que la clasificación por **igualdad exacta de ruta**
  (nunca `.includes()` de nombre de comando) es determinista y no tiene ambigüedad.

Las dos alternativas descartadas: (a) agregar un observador a `ingestProject` mete una spec cerrada
(`spec-e-burgos-002`) y un subproyecto ajeno dentro de este ciclo — fuera de alcance
(`out_of_scope` del brief lo prohíbe explícitamente); (b) reimplementar `discover`/`probe`/
`transcribe`/`plan` dentro de `apps/render-api` rompe D-4 (deja de ser "la misma secuencia,
literalmente las mismas llamadas") y arriesga divergir en el primer cambio futuro de la lib sin que
ninguna suite lo vea — exactamente el riesgo que D-4 fue diseñada para evitar.

**Veredicto: ratificada.** El diseño completo (clasificación, denominador del contador, semántica de
etapa salteada, `percent` con total desconocido) está en la §5.

### 1.3 D-6 — El 409 de sobreescritura

**Código:** `TIMELINE_ALREADY_EXISTS` (sigue la convención ya vigente de `PROJECT_ALREADY_EXISTS` /
`ASSET_ALREADY_EXISTS`, ambos también `409`, en vez de inventar un prefijo `MONTAGE_*` para un
código que describe el estado de un recurso, no del motor de montaje).

**Status HTTP:** `409`.

**Garantía dura, verificada en el diseño de §4 (no en runtime):** el chequeo de `work/timeline.json`
sucede en el HANDLER, de forma síncrona, **antes** de llamar a `runtime.jobs.create(...)` — la
misma sección de código que hoy resuelve el proyecto y valida el slug, nunca dentro de la cola ni
del pipeline. Por construcción: si el chequeo rechaza, la función retorna (lanza) antes de que
exista una sola referencia al job en `records`/`pending`, y antes de que ningún puerto de
escritura (`storage.writeTextFile`, `ensureDirectory`, el `CommandRunner`) se haya invocado siquiera
una vez. Este es exactamente el mismo patrón que ya usa `handleCreateRenderJob` hoy para
`TIMELINE_NOT_FOUND` (falla antes de `runtime.jobs.create`), así que no es una construcción nueva:
es reutilizar el punto de corte que el código ya tiene.

El chequeo en sí NO reusa `readStoredTimeline` (que parsea y valida contra `TimelineSchema` — coloca
un costo y una superficie de error que el 409 no necesita): usa un `stat` simple sobre la misma ruta
resuelta por `timelinePath()`/`toAbsolutePath()` (ver `assertTimelineNotPersisted` en §4.4). Esto
significa que un `work/timeline.json` **corrupto** (que no valida contra `TimelineSchema`) igual
cuenta como "existe" para el 409 — es la lectura correcta: D-6 protege contra pisar un archivo que
está ahí, no contra pisar un archivo válido.

---

## 2. Modelo de datos de la cola (`src/jobs/render-job.ts`)

### 2.1 Decisión: generalizar a `Job`/`JobKind`, sin renombrar el archivo ni la cola

`RenderJob` se generaliza a una unión discriminada `Job = RenderJob | MontageJob` con `kind` como
discriminante. **Los símbolos `RenderJobQueue`, `createRenderJobQueue`, el archivo
`render-job-queue.ts` y el archivo `render-job.ts` NO se renombran** — la cola ya era agnóstica al
contenido del job (ver §1.1); sólo el tipo de dato que gestiona se ensancha. Se dice una sola vez
acá; no se repite en el resto del documento.

**Campos que NO cambian de nombre, tipo ni posición (RNF-2):** `id`, `slug`, `state`, `createdAt`,
`startedAt`, `finishedAt`, `error` — comunes a ambos `kind` vía `JobBase`. Lo único que un consumidor
de render pre-existente ve agregado es el campo `kind` (con valor `'render'` para todo lo que hoy
produce el sistema) y, dentro de `progress`/`report`, exactamente los mismos campos que ya emitía.

```ts
export type JobKind = 'render' | 'montage';

export const MONTAGE_STAGES = ['discover', 'probe', 'transcribe', 'plan'] as const;
export type MontageStage = (typeof MONTAGE_STAGES)[number];

export interface RenderJobProgress {
  readonly stage: RenderPipelineStage;
  readonly renderedFrames: number | null;
  readonly totalFrames: number | null;
  readonly percent: number | null;
}

export interface MontageJobProgress {
  readonly stage: MontageStage;
  readonly processedAssets: number | null;
  readonly totalAssets: number | null;
  readonly percent: number | null;
}

export interface MontageJobReport {
  readonly catalogPath: string;
  readonly timelinePath: string;
  readonly editDecisionListPath: string;
  readonly preset: MontagePresetName;
  readonly seed: number;
}

interface JobBase {
  readonly id: string;
  readonly slug: string;
  readonly state: RenderJobState;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: RenderApiErrorPayload | null;
}

export type RenderJob = JobBase & {
  readonly kind: 'render';
  readonly progress: RenderJobProgress | null;
  readonly report: RenderPipelineReport | null;
};

export type MontageJob = JobBase & {
  readonly kind: 'montage';
  readonly progress: MontageJobProgress | null;
  readonly report: MontageJobReport | null;
};

export type Job = RenderJob | MontageJob;
```

`RenderJobState`, `RENDER_JOB_STATES`, `TERMINAL_RENDER_JOB_STATES`, `isTerminalRenderJobState` **no
cambian**: son ya genéricos a cualquier `kind` (seis estados, cancelación cooperativa) y
`applyRenderJobEvent` (`render-job-state.ts`) tampoco cambia — no hay ni un `if` sobre contenido de
job en ese archivo hoy.

`toRenderJob`/`toRenderJobSummary` se generalizan a `toJob(record): Job` / `toJobSummary(job): JobSummary`
(un `switch` sobre `record.kind` que arma el objeto correcto por rama — la unión discriminada obliga
a TypeScript a que cada rama tenga exactamente los campos de su propio tipo, no hay forma de que un
campo de montaje se filtre a un `RenderJob` ni viceversa).

```ts
export interface JobSummary {
  readonly id: string;
  readonly kind: JobKind;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | MontageStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}
```

(`RenderJobSummary` se mantiene como alias de compatibilidad de nombre —
`export type RenderJobSummary = JobSummary` — para no forzar a nadie que hoy importe ese nombre a
cambiar un `import`; el shape es idéntico salvo el campo `kind` agregado, que ya cumplía RNF-2.)

### 2.2 `CreateJobInput` (entrada de `runtime.jobs.create`)

```ts
export type CreateJobInput = CreateRenderJobInput | CreateMontageJobInput;

export interface CreateRenderJobInput {
  readonly kind: 'render';
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
}

export interface CreateMontageJobInput {
  readonly kind: 'montage';
  readonly slug: string;
  readonly projectRoot: string;
  readonly preset: MontagePresetName;
  readonly seed: number;
}
```

`CreateRenderJobInput` gana el campo `kind: 'render'` (único cambio; el handler que hoy lo construye
pasa a incluirlo explícitamente). `runtime.jobs.create` pasa de aceptar `CreateRenderJobInput` a
aceptar `CreateJobInput`, y el registro interno `JobRecord` (privado a `render-job-queue.ts`, nunca
serializado tal cual) es la unión análoga con los campos mutables de cada `kind` (`timeline` para
render; `preset`/`seed` para montage).

---

## 3. Puertos nuevos en `RenderApiDependencies`

Cuatro puertos nuevos, todos sin estado (viven en `RenderApiDependencies`, nunca en
`RenderApiRuntime`), cada uno con su doble en `src/__fixtures__/`:

```ts
import type { DirectoryReader, FileStatReader } from '@video-maker/auto-montage';
import type { CommandRunner, ResolvedBinaries } from '@video-maker/media-local';

export type CreateCommandRunnerPort = () => Promise<CommandRunner>;
export type ResolveMontageBinariesPort = () => Promise<ResolvedBinaries>;

export interface RenderApiDependencies {
  // ...los 11 puertos ya existentes, sin cambios...
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
  readonly createCommandRunner: CreateCommandRunnerPort;
  readonly resolveMontageBinaries: ResolveMontageBinariesPort;
}
```

**Por qué sólo estos cuatro y no más** (medido, no asumido — grep de las firmas reales):

- **`readTextFile`/`writeTextFile`/`ensureDirectory` NO son puertos nuevos.** `libs/auto-montage`
  exporta `ReadTextFile = (path:string) => Promise<string>`,
  `WriteTextFile = (path:string, contents:string) => Promise<void>` y
  `EnsureDirectory = (path:string) => Promise<void>` — **estructuralmente idénticas** a
  `deps.storage.readTextFile`, `deps.storage.writeTextFile` (`ObjectStorage`, ya confinado a
  `mediaRoot`) y a `deps.ensureDirectory` (puerto ya existente, usado hoy por
  `runRenderPipeline`). TypeScript acepta pasar esas tres funciones tal cual donde
  `IngestDependencies`/`MontageDependencies` las pide; no hace falta un adaptador ni un puerto
  nuevo, y de yapa el I/O de montaje queda confinado a `mediaRoot` igual que el resto del store.
- **`clock` tampoco es nuevo.** `deps.clock: Clock` (`{ nowIso(): string }`) ya existente en
  `RenderApiDependencies` es estructuralmente idéntico al `Clock` de `@video-maker/media-local` que
  `ingestProject` acepta opcionalmente (`deps.clock ?? systemClock`). Se pasa el mismo objeto.
- **`readDirectory`/`statFile` SÍ son nuevos** porque su contrato de errores difiere del de
  `ObjectStorage`: `DirectoryReader.readDirectory`/`FileStatReader.statFile` **lanzan** si el path no
  existe; `deps.storage.listDirectory`/`deps.storage.stat` **devuelven `null`**. Adaptar uno al otro
  agregaría una capa de traducción sin ganar nada (el consumidor, `libs/auto-montage`, ya espera el
  contrato que lanza — es el mismo que usa `nodeDirectoryReader`/`nodeFileStatReader` de la propia
  lib). Se agregan tal cual, tipados directamente contra la interfaz de la lib.
- **`createCommandRunner`/`resolveMontageBinaries` SÍ son nuevos** porque son el único punto donde
  D-5 necesita acceso al `CommandRunner` **crudo** (para decorarlo antes de pasarlo a `ingestProject`)
  y a los cuatro binarios resueltos (para que el decorador clasifique por ruta). Ningún puerto
  existente expone ninguno de los dos: `renderMutedVideo`/`mixTimelineAudio`/etc. son puertos de
  **alto nivel** que ya encapsulan su propio `CommandRunner` internamente; exponerlo acá es
  exactamente lo que permite que la cola (no `node-render-api-dependencies.ts`) decida cómo
  observar cada invocación.

**Adaptador de producción** (`src/deps/node-render-api-dependencies.ts`, único lugar que toca
`@video-maker/media-local` y `@video-maker/composition-remotion` — invariante de la constitución,
verificado hoy por grep y que este ciclo no rompe):

```ts
readDirectory: nodeDirectoryReader,   // import ESTÁTICO de @video-maker/auto-montage
statFile: nodeFileStatReader,          // import ESTÁTICO de @video-maker/auto-montage

createCommandRunner: async () => {
  const { ExecaCommandRunner } = await loadMediaLocal();
  return new ExecaCommandRunner();
},

resolveMontageBinaries: async () => {
  const { resolveBinaries } = await loadMediaLocal();
  return resolveBinaries(env);
},
```

`@video-maker/auto-montage` se importa **estáticamente** en `node-render-api-dependencies.ts` (ya lo
hace hoy `project-scope.ts` con `resolveMediaProject`/`timelinePath`/`toAbsolutePath` — no es una de
las dos libs restringidas a `await import()`; sólo `media-local` y `composition-remotion/render` lo
están, por la restricción real de la constitución sobre depender de las dos a la vez). `ingestProject`
y `autoMontage` en sí **tampoco son puertos**: se llaman directo, como funciones puras de librería,
desde `src/jobs/run-montage-pipeline.ts` (§6) — no hace falta envolverlas, porque no son ellas las
que tocan un binario o el filesystem directamente, sino los parámetros que reciben.

**Doble de test — decisión importante para el implementador:** `createCommandRunner` **no** puede
resolverse en test devolviendo `FixtureCommandRunner` de `@video-maker/media-local` importado en un
archivo de `__fixtures__/`: eso violaría la única frontera de importación en tiempo de ejecución de
esas dos libs (verificada hoy por grep — ningún archivo de `apps/render-api/src` salvo
`node-render-api-dependencies(.spec).ts` importa un VALOR, sólo tipos, de `@video-maker/media-local`
o `@video-maker/composition-remotion`). El doble vive en un archivo nuevo,
`src/__fixtures__/fake-command-runner.ts`, con una implementación local mínima de `CommandRunner`
(import **type** únicamente de `@video-maker/media-local` para la interfaz), con rutas
`bin → respuesta` configurables — misma idea que `FixtureCommandRunner`, reimplementada localmente
a propósito, no importada.

### 3.1 Medición D-30 — ¿los paths que reciben estos puertos son relativos o absolutos?

**Medido, no supuesto.** `libs/auto-montage/src/ingest/ingest-project.ts` y sus sub-módulos
(`discover-assets.ts`, `probe-assets.ts`, `transcribe-assets.ts`) resuelven **siempre** vía
`toAbsolutePath(project, ...)` antes de invocar `readDirectory`/`statFile`/`readTextFile`/
`writeTextFile`/`ensureDirectory` y antes de pasar un path como argumento de binario a
`runner.run(...)`. Ningún llamado interno de `libs/auto-montage` pasa `runOptions.cwd` al
`CommandRunner` (grep de `probe-assets.ts`/`transcribe-assets.ts`: cero apariciones de
`runOptions`). **Conclusión: ninguno de los cuatro puertos nuevos necesita ir acompañado de
`projectRoot`/`cwd`** — a diferencia de `MixTimelineAudioInput` (D-30 de spec-005), que sí lo
necesita porque los paths de `Timeline.assets[].path` son project-relative por diseño de
`Timeline`. Acá el input de cada puerto siempre es ya una ruta absoluta construida por la lib misma.

---

## 4. Validación de parámetros y precondiciones — orden exacto

Todo lo de esta sección corre **síncrono, en el handler, antes de `runtime.jobs.create`**. Nada de
esto toca un binario ni escribe disco.

### 4.1 Body — lectura y default

`POST /projects/:slug/jobs` pasa de no leer el body a leerlo **opcionalmente**. Se agrega una
variante `'empty'` a `JsonBodyResult` (`src/http/read-json-body.ts`), distinta de `'invalid-json'`:

```ts
export type JsonBodyResult =
  | { readonly kind: 'parsed'; readonly value: unknown }
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'empty' };
```

`readJsonBody` devuelve `{ kind: 'empty' }` cuando el body tiene **cero bytes** (nunca intenta
`JSON.parse('')`, que hoy explotaría y caería en `'invalid-json'` — ese es el bug latente que este
cambio corrige de paso: hoy un `PUT` de timeline/edl con body vacío ya cuenta, correctamente, como
`REQUEST_BODY_INVALID_JSON`, así que **los dos call sites existentes** (`handlePutTimeline`,
`handlePutEditDecisionList` en `montage-handler.ts`) agregan una rama explícita
`bodyResult.kind === 'empty' → mismo error que 'invalid-json'` para preservar ese comportamiento
byte por byte).

En `handleCreateRenderJob` (jobs-handler.ts): `body ausente` (sin `content-length`/stream vacío) y
`body: {}` dan **ambos** `{ kind: 'empty' }` o `{ kind: 'parsed', value: {} }` respectivamente — las
dos rutas convergen en "no hay `kind`" (ver 4.2). Un body con JSON **sintácticamente inválido** (algo
que hoy es ignorado en silencio porque el body nunca se lee) pasa a responder
`400 REQUEST_BODY_INVALID_JSON` — es un cambio de comportamiento respecto de hoy, documentado y
aceptado en §8 (Riesgos): ningún test de `apps/web` envía un body para este endpoint, así que RNF-2
no se ve afectado.

### 4.2 Resolución de `kind`

```ts
function resolveJobKind(value: unknown): JobKind | 'invalid' {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'render'; // ver nota
  }
  const raw = (value as Record<string, unknown>).kind;
  if (raw === undefined) return 'render';
  if (raw === 'render' || raw === 'montage') return raw;
  return 'invalid';
}
```

Nota: un body JSON válido pero no-objeto (`42`, `"x"`, `null`, `[]`) se trata como "sin `kind`" →
`render` (lectura permisiva, consistente con CA-003: "así traiga otros datos que el servicio ya
ignoraba"; no hay ningún CA que exija rechazar esta forma, y `apps/web` nunca la produce).

Si `resolveJobKind` da `'invalid'` → `422 JOB_KIND_INVALID`, **antes** de mirar cualquier otro campo.

### 4.3 Rama `kind: 'render'` — sin cambios de comportamiento

Idéntica a hoy: `assertValidProjectSlug` → `resolveExistingProject` → `readStoredTimeline` →
`runtime.jobs.create({ kind: 'render', slug, projectRoot, timeline })`. Cualquier campo de montaje
presente en el body (`preset`, `seed`, `overwrite`) se ignora — nunca se lee, igual que hoy se
ignora el body entero (CA-001, CA-002, CA-003).

### 4.4 Rama `kind: 'montage'` — validación de parámetros, en este orden

1. `assertValidProjectSlug(slug)` — existente, sin cambios.
2. `resolveExistingProject(deps, store, slug)` — existente, sin cambios (`404 PROJECT_NOT_FOUND`).
3. `parseMontagePreset(value.preset)` — default `'software-demo'` si `undefined`; si está presente
   y no es una clave de `MONTAGE_PRESETS` (`'software-demo' | 'hardware' | 'recipe' | 'educational'`,
   re-exportado por `libs/auto-montage`) → `422 MONTAGE_PRESET_INVALID`.
4. `parseMontageSeed(value.seed)` — default `0` si `undefined`; si está presente y no es
   `Number.isInteger(seed) && seed >= 0` → `422 MONTAGE_SEED_INVALID`.
5. `parseMontageOverwrite(value.overwrite)` — default `false` si `undefined`; si está presente y no
   es `typeof === 'boolean'` → `422 MONTAGE_OVERWRITE_INVALID`.
6. `assertTimelineNotPersisted(deps, project, overwrite)` (nuevo, en `project-scope.ts`): si
   `overwrite === false` y `deps.storage.stat(toAbsolutePath(project, timelinePath()))` no es `null`
   → `409 TIMELINE_ALREADY_EXISTS` (D-6). Si `overwrite === true`, no se llama ni siquiera al
   `stat` (no hace falta: va a reescribir de cualquier forma).
7. `runtime.jobs.create({ kind: 'montage', slug, projectRoot: project.root, preset, seed })`.

Los tres validadores de parámetros (paso 3-5) son funciones puras nuevas en
`src/jobs/montage-job-params.ts`, sin I/O — se pueden testear sin ningún doble.

---

## 5. Progreso del montaje — diseño completo de D-5

### 5.1 Las cuatro etapas y quién las fija

| Etapa | Quién la marca (`stageStarted`) | `CommandRunner` involucrado |
| --- | --- | --- |
| `discover` | El job, **antes** de llamar a `ingestProject` | Ninguno (`discoverAssets` sólo usa `readDirectory`/`statFile`) |
| `probe` | El decorador, en la primera invocación con `bin === binaries.ffprobe` | `ffprobe` únicamente |
| `transcribe` | El decorador, en la primera invocación con `bin === binaries.ffmpeg \|\| bin === binaries.whisperCli` | `ffmpeg` (extracción de audio) y `whisper-cli` |
| `plan` | El job, **antes** de llamar a `autoMontage` | Ninguno (`autoMontage` no usa `CommandRunner`) |

**Monotonía:** el decorador y el job comparten un único `currentStageIndex` (posición en
`MONTAGE_STAGES`); `stageStarted(next)` sólo aplica el cambio si
`MONTAGE_STAGES.indexOf(next) > currentStageIndex` (o si `next === currentStageIndex`, no-op) —
igual que `mergeRenderProgress` ya descarta un `renderedFrames` menor al anterior. Esto es lo que
garantiza CA-014 (nunca retrocede) y a la vez permite CA-015 (un proyecto sin nada que sondear nunca
emite `stageStarted('probe')`, así que la cola simplemente nunca ve esa etapa — no hace falta
ninguna lógica especial para "saltear").

### 5.2 Denominador del contador de assets (`totalAssets`)

Antes de llamar a `ingestProject`, el job llama **una vez** a `discoverAssets(project, { readDirectory,
statFile })` (función pura y exportada, `libs/auto-montage/src/ingest/discover-assets.ts`) **sólo
para obtener `findings.length`** — el resultado en sí se descarta, no se reutiliza para nada más.
Esto paga un walk de filesystem extra (uno más de los que `ingestProject` hace internamente), a
propósito, siguiendo la sugerencia del brief: es la única forma de tener un total sin reimplementar
`planIngestWork` (que decide qué findings se reusan de un catálogo previo — lógica interna, no
exportada, y replicarla violaría D-4/D-5 de la misma forma que reimplementar `probeAssets`).

- `totalAssets` para `probe` **y** `transcribe` es el mismo número: `findings.length` (todos los
  roles, sin filtrar). Es un **techo**, no un conteo exacto de trabajo restante: en el caso más
  común de este ciclo — un proyecto **recién ingestado desde la web, sin catálogo previo** (HU-02) —
  no hay nada que reusar, así que para `probe` el techo es exacto (`findingsToProbe.length ===
  findings.length` cuando `previousCatalog === null`, medido en `ingest-project.ts`: con catálogo
  previo nulo, `entry.reuse` es siempre `undefined` para toda entrada de `plan.assetPlans`). Para
  `transcribe` el techo **nunca** es exacto (sólo se transcribe el rol `aroll` por default, un
  detalle interno de `ingestProject` que no está exportado y que deliberadamente no se replica
  acá) — el `percent` de `transcribe` es, por diseño, un piso monotónico honesto, no una promesa de
  llegar a 100.
- `processedAssets` para `probe`: se incrementa en cada invocación clasificada como `probe`
  (`bin === binaries.ffprobe`) — una invocación por asset sondeado.
- `processedAssets` para `transcribe`: se incrementa **únicamente** en las invocaciones clasificadas
  por `bin === binaries.whisperCli` (una por asset efectivamente transcripto). La invocación de
  `ffmpeg` que la precede (extracción de audio, mismo asset) actualiza el `stage` a `'transcribe'`
  (por la regla de clasificación literal del brief) pero **no** incrementa el contador — es un
  sub-paso de preparación del mismo asset, no una unidad completa; contarla también inflaría
  `processedAssets` a un múltiplo del número real de assets transcriptos.
- `discover` y `plan` **nunca** llevan contador: `processedAssets`/`totalAssets`/`percent` son
  siempre `null` en esas dos etapas (mismo patrón que `startRenderJobStage` ya usa para resetear el
  progreso al entrar a una etapa nueva). Esto es, a la vez, la respuesta a "qué pasa cuando el total
  no se conoce" (CA-016): en `discover`/`plan` el total **nunca aplica** (no son etapas
  archivo-por-archivo, RF-5 las excluye explícitamente de "contadores de assets"), así que ahí el
  campo es explícitamente `null`, nunca `0` ni un porcentaje inventado.
- **Fórmula de `percent`** (`src/jobs/montage-job-progress.ts`, misma forma que
  `progressPercent` de `render-job-progress.ts`, sin reusar el símbolo — distinto dominio):

  ```ts
  export function montageProgressPercent(processed: number, total: number): number | null {
    if (total <= 0) return null;
    return Math.min(100, Math.max(0, Math.floor((processed / total) * 100)));
  }
  ```

  El `Math.min(100, ...)` es lo que evita que `transcribe` (donde `processedAssets` puede, en teoría,
  igualar `totalAssets` exactamente sólo si todo el material es `aroll`) muestre más de 100%.

### 5.3 El decorador (`src/jobs/montage-command-runner-decorator.ts`)

```ts
export interface MontageStageObserver {
  readonly stageStarted: (stage: MontageStage) => void;
  readonly assetProcessed: (stage: 'probe' | 'transcribe') => void;
}

export function createStageObservingCommandRunner(
  runner: CommandRunner,
  binaries: ResolvedBinaries,
  observer: MontageStageObserver,
): CommandRunner {
  return {
    run: async (bin, args, opts) => {
      if (bin === binaries.ffprobe) {
        observer.stageStarted('probe');
        const result = await runner.run(bin, args, opts);
        observer.assetProcessed('probe');
        return result;
      }
      if (bin === binaries.ffmpeg || bin === binaries.whisperCli) {
        observer.stageStarted('transcribe');
        const result = await runner.run(bin, args, opts);
        if (bin === binaries.whisperCli) {
          observer.assetProcessed('transcribe');
        }
        return result;
      }
      return runner.run(bin, args, opts);
    },
  };
}
```

Es pass-through exacto: `args`/`opts`/`result` viajan sin tocarlos (CA-007). La rama final
(`bin` que no matchea ninguno de los tres) existe por si algún día se agrega un quinto binario a
`ResolvedBinaries` sin actualizar el decorador — falla segura (delega igual, no clasifica), no
lanza. En la práctica, con los cuatro binarios de este ciclo, esa rama es inalcanzable (todo
`runner.run` dentro de `ingestProject` pasa por `ffprobe`, `ffmpeg` o `whisperCli` — verificado en
§1.2); se deja por completitud de tipos, no como código a testear con un CA propio.

---

## 6. `src/jobs/run-montage-pipeline.ts` — orquestación y cancelación

Mirror directo de `run-render-pipeline.ts`, misma forma de `checkpoint()`:

```ts
export interface MontagePipelineRequest {
  readonly project: MediaProject;
  readonly preset: MontagePresetName;
  readonly seed: number;
}

export interface MontagePipelineObserver {
  readonly stageStarted: (stage: MontageStage) => void;
  readonly assetProcessed: (stage: 'probe' | 'transcribe', totalAssets: number) => void;
  readonly cancellationRequested: () => boolean;
}
```

> **Corrección aplicada al cerrar TASK-014.** Este documento se contradecía a sí mismo: declaraba
> `assetProcessed` con **un** parámetro y más abajo la invocaba con **dos**
> (`observer.assetProcessed(stage, totalAssets)`), y `tsc` lo rechaza con `TS2554`. La forma de dos
> argumentos es la correcta —espejo de `renderProgressed(renderedFrames, totalFrames)` del
> observador de render—, porque `mergeMontageJobProgress(previous, stage, totalAssets)` necesita el
> total en **cada** incremento. La interfaz `MontageStageObserver` del decorador (§5.3) **no cambia**:
> el decorador no conoce el total, se lo pone el pipeline al adaptar un observador al otro.

```ts

export async function runMontagePipeline(
  request: MontagePipelineRequest,
  deps: RenderApiDependencies,
  observer: MontagePipelineObserver,
): Promise<MontageJobReport> {
  await assertMontageProjectIsIngestable(request.project, deps); // MONTAGE_RAW_MISSING si falla

  checkpoint(observer, 'discover');
  observer.stageStarted('discover');
  const { findings } = await discoverAssets(request.project, {
    readDirectory: deps.readDirectory,
    statFile: deps.statFile,
  });
  const totalAssets = findings.length;

  const binaries = await deps.resolveMontageBinaries(); // MEDIA_BINARY_NOT_FOUND si falta alguno
  const rawRunner = await deps.createCommandRunner();
  const runner = createStageObservingCommandRunner(rawRunner, binaries, {
    stageStarted: observer.stageStarted,
    assetProcessed: (stage) => observer.assetProcessed(stage, totalAssets),
  });

  const ingestResult = await runMontageStage('discover', () =>
    ingestProject(
      request.project,
      { binaries },
      {
        runner,
        readDirectory: deps.readDirectory,
        statFile: deps.statFile,
        readTextFile: deps.storage.readTextFile,
        writeTextFile: deps.storage.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
        clock: deps.clock,
      },
    ),
  );

  checkpoint(observer, 'plan');
  observer.stageStarted('plan');
  const montageResult = await runMontageStage('plan', () =>
    autoMontage(
      request.project,
      { preset: request.preset, seed: request.seed },
      {
        readTextFile: deps.storage.readTextFile,
        writeTextFile: deps.storage.writeTextFile,
        ensureDirectory: deps.ensureDirectory,
      },
    ),
  );

  return {
    catalogPath: ingestResult.catalogPath,
    timelinePath: montageResult.timelinePath,
    editDecisionListPath: montageResult.edlPath,
    preset: request.preset,
    seed: request.seed,
  };
}
```

**Cancelación (RF-8, CA-023) — únicos dos checkpoints posibles, medidos:** ni `ingestProject` ni
`autoMontage` ceden el control a nada externo entre sus propios sub-pasos (son funciones opacas de
principio a fin — §1.2), así que, exactamente como ya sucede con cada etapa larga de
`runRenderPipeline`, la cancelación sólo puede observarse **antes** de `ingestProject` y **antes**
de `autoMontage` — nunca a mitad de una transcripción en curso. Esto reproduce el mismo patrón ya
existente (D-22 de spec-005: "el estado vigente gana sobre el resultado del pipeline"): si el job
está `canceling` cuando `ingestProject` termina (haya escrito o no `work/catalog.json` — lo escribe
siempre, completo, nunca a medias, porque `writeCatalog` es una única llamada al final), el
`checkpoint(observer, 'plan')` lanza `MontagePipelineCanceledError` y el job se asienta como
`canceled` con `report: null`, **aunque `work/catalog.json` exista en disco** — igual que un render
cancelado en `verify` deja el `.mp4` completo pero reporta `canceled`. Esto satisface CA-023 sin
ningún mecanismo nuevo: lo que quedó escrito es siempre el resultado completo de la última llamada
que sí terminó, nunca un archivo a mitad de escribir (ninguna de las dos funciones escribe
incrementalmente).

**Precondición de catálogo antes de `autoMontage` — divergencia deliberada de la estructura literal
del CLI, documentada:** `tools/render-cli/src/commands/plan-command.ts` llama a
`assertCatalogExists` porque `plan` puede invocarse **solo**, sin un `ingest` previo en la misma
corrida. En el job de montaje de la API eso no puede pasar — `autoMontage` sólo se llama
inmediatamente después de que `ingestProject` haya terminado con éxito **en esa misma invocación
del job**, y `ingestProject` escribe `work/catalog.json` incondicionalmente antes de retornar
(`writeCatalog(...)` no está detrás de ningún `if`). Un `assertCatalogExists` acá sería un guard
sobre una condición que no puede darse — exactamente el antipatrón que
`sdd/memory/lessons.md` prohíbe ("un guard sobre una condición imposible es código muerto con
nombre de validación"). Se omite a propósito; la byte-identidad (D-4, sobre el contenido de los
artefactos) no depende de replicar esta precondición interna del CLI, sólo de llamar a las mismas
dos funciones de librería en el mismo orden — lo que sí se hace.

---

## 7. Códigos de error nuevos y su mapeo HTTP

| Código | HTTP | Se dispara cuando… | Test que lo dispara |
| --- | --- | --- | --- |
| `JOB_KIND_INVALID` | 422 | `POST .../jobs` con `kind` presente y distinto de `'render'`/`'montage'` | `jobs-handler.spec.ts`: `{"kind":"bogus"}` |
| `MONTAGE_PRESET_INVALID` | 422 | `kind:'montage'` con `preset` presente y fuera de `MONTAGE_PRESETS` | `jobs-handler.spec.ts`: `preset:"nope"` |
| `MONTAGE_SEED_INVALID` | 422 | `seed` presente, no entero o negativo | `jobs-handler.spec.ts`: `seed:-1`, `seed:1.5`, `seed:"0"` |
| `MONTAGE_OVERWRITE_INVALID` | 422 | `overwrite` presente y no boolean | `jobs-handler.spec.ts`: `overwrite:"yes"` |
| `TIMELINE_ALREADY_EXISTS` | 409 | `work/timeline.json` existe y `overwrite !== true` (D-6) | `jobs-handler.spec.ts`: proyecto con timeline previa, sin `overwrite` |
| `MONTAGE_RAW_MISSING` | 422 | El proyecto existe pero `raw/` no tiene ningún directorio de rol (`aroll`/`broll`/`images`/`audio`), o `raw/` mismo no es legible — replica `assertProjectIsIngestable` del CLI | `montage-preconditions.spec.ts` + `run-montage-pipeline.spec.ts` con un fixture de proyecto sin subdirectorios de rol |
| `MONTAGE_INPUT_INVALID` | 422 | `autoMontage` lanza `MontageInputError` (ej.: catálogo sin ningún asset `aroll` tras el ingest) — traducción estructural 1:1 por `.code === 'MONTAGE_INPUT_INVALID'`, igual que `INVALID_TIMELINE` ya mapea el código homónimo del motor de render | `run-montage-pipeline.spec.ts`: catálogo fixture sin asset `aroll` |
| `MONTAGE_FAILED` | 500 | `ingestProject`/`autoMontage` lanzan cualquier error no cubierto por las filas anteriores ni por los códigos reusados de abajo (catch-all, mismo rol que `RENDER_FAILED` para el pipeline de render) | `run-montage-pipeline.spec.ts`: doble de `ingestProject`/`autoMontage` que rechaza con un `Error` genérico |

**Reusados sin cambios** (ya existen, se les agregan nuevos disparadores desde el flujo de montaje,
cero cambios de código en `render-api-error.ts`/`http-status-for.ts` para estas filas):
`MEDIA_BINARY_NOT_FOUND` (503 — falta cualquiera de los cuatro binarios; `translateEngineError` ya
traduce `BinaryNotFoundError` de forma genérica, sin importar cuál de los cuatro sea), `CATALOG_UNREADABLE`
(500 — `autoMontage` relee el catálogo de forma independiente a `ingestProject`, así que un
`readTextFile` que devuelve JSON corrupto sólo en esa segunda lectura es un caso real y testeable,
no teórico), `TIMELINE_INVALID`/`EDL_INVALID` (422 — `assertValidTimeline`/`assertValidEditDecisionList`
dentro de `autoMontage`), `PROJECT_NOT_FOUND`, `PROJECT_SLUG_INVALID`, `RENDER_JOB_NOT_FOUND`,
`RENDER_JOB_NOT_CANCELABLE` (los cuatro últimos, sin ningún cambio: la cancelación y el lookup son
por `id`, agnósticos a `kind`).

**Traductor nuevo** `src/errors/translate-montage-error.ts` (mirror de `translate-engine-error.ts`,
mismo patrón estructural-por-`code`, nunca `instanceof` de la lib):

```ts
export function translateMontageError(
  cause: unknown,
  stage: MontageStage,
  resource: string | null,
): RenderApiError {
  if (isRenderApiError(cause)) return cause;

  const engineError = asMontageEngineError(cause); // shape { code: string }, igual que translate-engine-error

  if (engineError?.code === 'BINARY_NOT_FOUND') {
    return new PipelineStageError({ code: 'MEDIA_BINARY_NOT_FOUND', stage, resource, hint: '...' });
  }
  if (engineError?.code === 'CATALOG_UNREADABLE') {
    return new PipelineStageError({ code: 'CATALOG_UNREADABLE', stage, resource });
  }
  if (engineError?.code === 'TIMELINE_INVALID' || engineError?.code === 'EDL_INVALID') {
    return new PipelineStageError({ code: engineError.code, stage, resource });
  }
  if (engineError?.code === 'MONTAGE_INPUT_INVALID') {
    return new PipelineStageError({ code: 'MONTAGE_INPUT_INVALID', stage, resource });
  }
  return new PipelineStageError({ code: 'MONTAGE_FAILED', stage, resource, cause });
}
```

`RenderApiErrorPayload.stage` y `PipelineStageError`'s `stage` param se ensanchan de
`RenderPipelineStage | null` a `RenderPipelineStage | MontageStage | null` — cambio de TIPO
únicamente aditivo: ningún código de error **existente** empieza a emitir un valor de `stage` nuevo
(sólo los siete códigos de esta tabla lo hacen), así que RNF-2 (ningún campo publicado cambia de
semántica) se mantiene: el conjunto de valores que un consumidor de render podía observar en
`stage` no cambia.

---

## 8. Contratos de API

### 8.1 `POST /projects/:slug/jobs` (EP-012 → `updated`)

**Request body** (opcional; todo el objeto es opcional, y cada campo dentro de él también):

```ts
interface CreateJobRequestBody {
  readonly kind?: 'render' | 'montage';
  readonly preset?: string;
  readonly seed?: number;
  readonly overwrite?: boolean;
}
```

- Body ausente, `{}`, o `{ "kind": "render", ... }` → job de render, comportamiento **byte por
  byte** idéntico al de antes de este ciclo (CA-001/002/003). `preset`/`seed`/`overwrite` se
  ignoran en esta rama.
- `{ "kind": "montage" }` → job de montaje con `preset: "software-demo"`, `seed: 0`,
  `overwrite: false`.
- `{ "kind": "montage", "preset": "hardware", "seed": 7, "overwrite": true }` → job de montaje con
  esos valores.

**Response `202`** — el body es el `Job` completo (unión discriminada de §2.1), asertado con
`Object.keys(body).sort()` contra:

- `kind: 'render'` → `['createdAt', 'error', 'finishedAt', 'id', 'kind', 'progress', 'report',
  'slug', 'startedAt', 'state']` (exactamente los mismos 9 campos de antes + `kind`).
- `kind: 'montage'` → mismo conjunto de claves (`report`/`progress` cambian de FORMA interna, no de
  presencia ni de nombre de clave).

**Errores nuevos en este endpoint:** `422 JOB_KIND_INVALID`, `422 MONTAGE_PRESET_INVALID`,
`422 MONTAGE_SEED_INVALID`, `422 MONTAGE_OVERWRITE_INVALID`, `409 TIMELINE_ALREADY_EXISTS`,
`400 REQUEST_BODY_INVALID_JSON` (body sintácticamente inválido — nuevo para este endpoint
específicamente; ver §4.1 y §9 sobre por qué es seguro). Los errores existentes
(`422 PROJECT_SLUG_INVALID`, `404 PROJECT_NOT_FOUND`, `404 TIMELINE_NOT_FOUND`,
`422 TIMELINE_INVALID`) siguen aplicando sin cambios para la rama `render`.

### 8.2 `GET /projects/:slug/jobs` (EP-013 → `updated`)

Sin cambio de forma: `{ slug: string, jobs: JobSummary[] }`. `JobSummary` (§2.1) agrega `kind` al
shape que ya existía; el resto de las claves (`id`, `state`, `stage`, `errorCode`, `createdAt`,
`startedAt`, `finishedAt`) no cambian de nombre ni de significado. `Object.keys(entry).sort()` por
elemento del array:
`['createdAt', 'errorCode', 'finishedAt', 'id', 'kind', 'startedAt', 'state', 'stage']`.

### 8.3 `GET /jobs/:jobId` (EP-014 → `updated`)

Response: el `Job` completo, unión discriminada de §2.1 — mismas claves para ambos `kind` descritas
en §8.1. Para `kind: 'montage'`, `progress` (cuando no es `null`) tiene el shape
`{ stage: MontageStage, processedAssets: number|null, totalAssets: number|null, percent:
number|null }`; `report` (cuando el job es `succeeded`) tiene el shape `MontageJobReport` de §2.1.

### 8.4 `DELETE /jobs/:jobId` (EP-015 → `updated`)

Sin cambios de contrato: la cancelación es por `id`, agnóstica a `kind`. Se agrega únicamente al
`description` del registro en `sdd/api.json` que ahora también aplica a jobs de montaje con la
misma semántica (CA-008).

### 8.5 `GET /health` (EP-001 → `updated`)

```ts
interface HealthBody {
  readonly status: 'ok' | 'degraded';
  readonly service: 'render-api';
  readonly cycle: number; // NO se toca (D-8)
  readonly time: string;
  readonly engine: readonly { name: string; loaded: boolean }[];
  readonly binaries: readonly { name: string; envVar: string; resolved: boolean }[]; // 4 elementos, antes 2
  readonly capabilities: {
    readonly renderPipeline: boolean;
    readonly assetStore: boolean;
    readonly jobQueue: boolean;
    readonly montageQueue: boolean; // NUEVO
  };
  readonly jobs: { running: number; queued: number };
}
```

`status` sigue siendo `engine.every(loaded) && binaries.every(resolved)` — **sin tocar la fórmula**:
extender `MEDIA_BINARY_NAMES` a los cuatro nombres hace que `binaries` traiga cuatro entradas y que
`degraded` se dispare solo si falta `WHISPER_MODEL_PATH` (u otro de los cuatro), sin cambiar una
línea de `health-handler.ts` más allá de agregar `montageQueue: true` al objeto `capabilities`.

`Object.keys(body).sort()`: `['binaries', 'capabilities', 'cycle', 'engine', 'jobs', 'service',
'status', 'time']` — sin cambios de claves de primer nivel; `capabilities` gana una clave interna.

---

## 9. Riesgos medidos y descopes

- **Cambio de comportamiento aceptado:** un `POST /projects/:slug/jobs` con un body **presente pero
  con JSON sintácticamente inválido** pasa de "ignorado en silencio" (hoy) a `400
  REQUEST_BODY_INVALID_JSON`. Medido: ningún test de los 307 de `apps/web`, ni el cliente HTTP real
  (`apps/web/src/api/render-api-client.ts`), envía body en este endpoint — grep confirma que el
  `POST` de creación de job no arma un `body` en absoluto. RNF-2 no se ve afectado; se documenta acá
  en vez de silenciarlo porque es, técnicamente, un comportamiento nuevo del endpoint.
- **`totalAssets` de `transcribe` es un techo, no un conteo exacto** (§5.2): el `percent` de esa
  etapa puede quedar por debajo de 100 incluso cuando la etapa termina, si el proyecto tiene
  material no-`aroll`. Es monotónico y honesto (nunca miente con un 100% falso), pero un consumidor
  que asuma "percent 100 = etapa completa" para `transcribe` se equivoca — la señal de completitud
  real es la transición de `stage`, igual que ya es hoy para el render (`render`'s propio `percent`
  tampoco es la señal de fin: `finishedAt`/`state` lo son). Documentado también en el README (§ nueva
  de jobs de montaje).
- **`assertCatalogExists` (equivalente a la del CLI) se descopa a propósito** (§6): sería código
  muerto en la secuencia exacta que este job ejecuta. Fundamento completo en §6.
- **`apps/render-api/eslint.config.mjs` sigue sin crearse** (D-11, heredado de spec-005): ningún
  archivo de este ciclo lo requiere; el proyecto sigue lintando contra el flat config raíz.
- **Lock entre procesos del store**: sin cambios respecto del riesgo ya documentado y aceptado en
  `README.md` § "Known risk" — un job de montaje escribe por el mismo camino que ya escribe el
  upload y el render; no se empeora ni se resuelve acá (fuera de alcance, brief).
- **Persistencia de la cola, cap de historial, concurrencia > 1**: sin cambios (D-12, heredado).
- **Rama muerta del decorador** (§5.3, "bin que no matchea ninguno de los tres"): existe sólo por
  exhaustividad de tipos del `CommandRunner` genérico; no se le exige un CA propio porque, con los
  cuatro binarios de este ciclo, es inalcanzable por diseño (medido en §1.2).

---

## 10. Lista cerrada de archivos

**Creados** (10, cada uno con su `*.spec.ts` salvo donde se indica lo contrario):

1. `apps/render-api/src/jobs/montage-job-params.ts` + `.spec.ts`
2. `apps/render-api/src/jobs/montage-job-progress.ts` + `.spec.ts`
3. `apps/render-api/src/jobs/montage-command-runner-decorator.ts` + `.spec.ts`
4. `apps/render-api/src/jobs/run-montage-pipeline.ts` + `.spec.ts`
5. `apps/render-api/src/jobs/montage-pipeline-observer.ts` + `.spec.ts` (tipos + `MontagePipelineCanceledError`/`isMontagePipelineCanceled`, mirror de `render-pipeline-observer.ts`)
6. `apps/render-api/src/store/montage-preconditions.ts` + `.spec.ts` (`assertMontageProjectIsIngestable`, `assertTimelineNotPersisted`)
7. `apps/render-api/src/errors/translate-montage-error.ts` + `.spec.ts`
8. `apps/render-api/src/__fixtures__/fake-command-runner.ts` (sin `.spec.ts` — es un fixture, mismo criterio que `fake-object-storage.ts`/`call-log.ts`, ninguno de los cuales tiene spec propio hoy)

**Modificados** (16):

9. `apps/render-api/src/jobs/render-job.ts` + `.spec.ts` (§2)
10. `apps/render-api/src/jobs/render-job-queue.ts` + `.spec.ts` (dispatch por `kind`, §2.2/§6)
11. `apps/render-api/src/errors/render-api-error.ts` + `.spec.ts` (7 códigos nuevos, `stage` ensanchado)
12. `apps/render-api/src/errors/http-status-for.ts` + `.spec.ts` (mapeo de los 7 códigos)
13. `apps/render-api/src/errors/to-error-payload.ts` + `.spec.ts` (mensajes de los 7 códigos)
14. `apps/render-api/src/engine/media-binaries.ts` (sin `.spec.ts` propio hoy — verificar si el planner debe crear uno; el archivo es sólo constantes/tipos)
15. `apps/render-api/src/deps/render-api-dependencies.ts` (sólo tipos — sin `.spec.ts`, no lo tiene hoy)
16. `apps/render-api/src/deps/node-render-api-dependencies.ts` + `.spec.ts` (§3)
17. `apps/render-api/src/store/project-scope.ts` + `.spec.ts` (`assertTimelineNotPersisted` o expone el `stat` que §4.4 necesita)
18. `apps/render-api/src/http/handlers/jobs-handler.ts` + `.spec.ts` (§4, §8.1/8.2)
19. `apps/render-api/src/http/handlers/montage-handler.ts` + `.spec.ts` (rama `'empty'` de `read-json-body`, §4.1)
20. `apps/render-api/src/http/read-json-body.ts` + `.spec.ts` (variante `'empty'`, §4.1)
21. `apps/render-api/src/http/health-handler.ts` + `.spec.ts` (§8.5)
22. `apps/render-api/src/__fixtures__/fake-render-api-dependencies.ts` (sin `.spec.ts` — fixture)
23. `apps/render-api/README.md` (§12 de este documento)
24. `sdd/api.json` (este mismo ciclo, ver §11)

**No se tocan** (confirmado explícitamente, para que el planner no las incluya):
`render-job-state.ts` (ya genérico), `render-job-progress.ts` (sigue siendo sólo de render),
`render-pipeline-observer.ts` (sigue siendo sólo de render), `run-render-pipeline.ts`, `routes.ts`,
`router.ts`, `handle-request.ts` (ningún import nuevo, ninguna rama nueva — el `switch` ya despacha
a `handleCreateRenderJob`/`handleListRenderJobs`/etc., que son los que cambian por dentro), ningún
archivo de `apps/web`, ningún archivo de `libs/*`, `tools/render-cli/*`.

---

## 11. `sdd/api.json` — resumen de la actualización

Bajo `apps/render-api`: `EP-001`, `EP-012`, `EP-013`, `EP-014`, `EP-015` pasan a
`status: "updated"`, `updated_in_cycle: 1`, con una entrada de `changelog` `{ cycle: 1, date:
"2026-09-09", change: "..." }` describiendo el cambio de cada uno (detalle en el JSON mismo). **No
se crea ningún `EP-016`**: D-2 ratificada, no hay endpoint nuevo. Se aplica en el siguiente paso de
este mismo turno del arquitecto, seguido de `pnpm sdd:validate`.

---

## 12. Guion literal del smoke real (CA-012, CA-013, CA-014) — para `apps/render-api/README.md`

> Este guion es el que se pega tal cual en el README (D-10) — modelado sobre la sección "Real-process
> verification (CA-033)" ya existente, con las dos correcciones que esa sección ya documenta
> (`pgrep` sin el `[Cc]hrome` que matchea el navegador del dev; puerto distinto del default).

```bash
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'                 # tiene que salir vacío
vm_stat | awk '/Pages free/ {print $3}'                        # >= 35% de memoria libre, a ojo
npx remotion browser ensure                                     # asegura Chrome headless antes del job de render

MEDIA_TMP="$(mktemp -d)"
mkdir -p "$MEDIA_TMP/smoke-montage/raw"
cp -R media/smoke-ingest/raw/. "$MEDIA_TMP/smoke-montage/raw/"   # SOLO raw/, nunca work/ ni out/
# media/smoke-ingest, media/video-01 y media/video-02 no se tocan en ningún paso de este guion

set -a && source .env && set +a
RENDER_API_PORT=4319 RENDER_API_MEDIA_ROOT="$MEDIA_TMP" SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &
API_PID=$!
sleep 2
BASE="http://127.0.0.1:4319"

curl -s "$BASE/health" | grep -q '"montageQueue":true'
curl -s -X POST "$BASE/projects" -d '{"slug":"smoke-montage"}'    # el layout ya existe via cp; 409 esperable, ignorar

JOB_ID=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"montage","preset":"software-demo","seed":0}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")

until curl -s "$BASE/jobs/$JOB_ID" | grep -q '"state":"succeeded"\|"state":"failed"'; do
  curl -s "$BASE/jobs/$JOB_ID" | node -e "process.stdin.once('data', b => { const j = JSON.parse(b); console.log(j.state, j.progress); })"
  sleep 2
done
curl -s "$BASE/jobs/$JOB_ID" | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).state))"  # succeeded

for f in catalog.json timeline.json edl.json; do
  echo "$f: $(shasum -a 256 "$MEDIA_TMP/smoke-montage/work/$f" | cut -d' ' -f1) \
        vs $(shasum -a 256 "media/smoke-ingest/work/$f" | cut -d' ' -f1)"
done
# las tres líneas tienen que mostrar el MISMO hash en ambos lados (RF-4, RNF-1)

# CA-014 — el oráculo tiene que ser sensible: repetir con seed distinto, y TIENE que fallar
rm -rf "$MEDIA_TMP/smoke-montage/work"
JOB_ID_2=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"montage","preset":"software-demo","seed":1,"overwrite":true}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")
until curl -s "$BASE/jobs/$JOB_ID_2" | grep -q '"state":"succeeded"\|"state":"failed"'; do sleep 2; done
diff "$MEDIA_TMP/smoke-montage/work/timeline.json" media/smoke-ingest/work/timeline.json \
  && echo "FALLO: el oráculo NO es sensible — seed distinto dio el mismo timeline" \
  || echo "OK: seed=1 produce un timeline distinto de seed=0 (oráculo sensible, CA-014)"

# job de render encadenado, sobre el resultado de seed=0 (repetir el POST de seed=0 antes de esto si se corrió CA-014)
RENDER_JOB_ID=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" -d '{}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")
until curl -s "$BASE/jobs/$RENDER_JOB_ID" | grep -q '"state":"succeeded"\|"state":"failed"'; do sleep 2; done
curl -s -o "$MEDIA_TMP/out.mp4" "$BASE/projects/smoke-montage/files/out/$RENDER_JOB_ID.mp4"
ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,r_frame_rate \
  -of default=noprint_wrappers=1 "$MEDIA_TMP/out.mp4"
# nb_frames y r_frame_rate se comparan contra el stream de video, NUNCA contra format.duration

kill -TERM "$API_PID"; wait "$API_PID"
rm -rf "$MEDIA_TMP"
```

Qué prueba, línea por línea: `capabilities.montageQueue: true` (D-8) · el job `montage` progresa
hasta `succeeded` con las cuatro etapas visibles por polling (CA-002, CA-006, RF-5) ·
`work/catalog.json`/`work/timeline.json`/`work/edl.json` tienen el mismo `sha256` que los de
`media/smoke-ingest` producidos por la CLI (RF-4, RNF-1, CA-012) · el oráculo es sensible a `seed`
(CA-014, corrida a propósito y registrada) · el job `render` encadenado produce un `.mp4` cuya
duración se verifica contra el stream de video, nunca `format.duration` (CA-013).

**Nota de ejecución real:** este guion no se corrió en esta sesión (el arquitecto no ejecuta
binarios ni escribe código); queda para la task del planner que "deja el binario arrancable con el
job de montaje" (regla de `sdd/memory/lessons.md`: correr el smoke ahí, no al cerrar el ciclo), que
debe registrar su salida real (hashes, estado final, tiempos) como evidencia — igual que ya hizo
`cycle-03` de spec-005 para CA-033.

---

## 13. Tabla CA → test → símbolo (Ciclo 01)

| CA | Archivo de test | Símbolo que invoca el test |
| --- | --- | --- |
| CA-001 | `jobs-handler.spec.ts` | `handleCreateRenderJob` (body ausente) |
| CA-002 | `jobs-handler.spec.ts` | `handleCreateRenderJob` (`kind:"montage"`, sin timeline previa) |
| CA-003 | `run-montage-pipeline.spec.ts` | `runMontagePipeline` (orden `ingestProject` → `autoMontage`, vía `callLog`) + `montage-preconditions.spec.ts::assertMontageProjectIsIngestable` (falla sin invocar `createCommandRunner`) |
| CA-004 | `montage-job-params.spec.ts` + `jobs-handler.spec.ts` | `parseMontagePreset`/`parseMontageSeed`/`parseMontageOverwrite` |
| CA-005 | `jobs-handler.spec.ts` | `handleCreateRenderJob` (409 sin overwrite, 202 con overwrite) + `runtime.jobs.listBySlug` |
| CA-006 | `montage-command-runner-decorator.spec.ts` + `montage-job-progress.spec.ts` | `createStageObservingCommandRunner` (secuencia monotónica; un catálogo previo completo saltea `probe` sin romper la monotonía) + `montageProgressPercent` (`null` con `total <= 0`, número con `total > 0`) |
| CA-007 | `montage-command-runner-decorator.spec.ts` | `createStageObservingCommandRunner` (pass-through exacto de args/opts/result; clasificación por igualdad exacta de ruta, no por substring) |
| CA-008 | `render-job-queue.spec.ts` | `createRenderJobQueue(...).cancel` sobre un job `kind:'montage'` |
| CA-009 | `health-handler.spec.ts` | `handleHealth` (`binaries.length === 4`, `capabilities.montageQueue`, `status` con/sin el modelo de Whisper resuelto) |
| CA-010 | (verificación de ciclo, no un test nuevo) | `pnpm nx run web:test` + `git diff --stat apps/web` |
| CA-011 | (verificación de ciclo) | `git diff --stat package.json pnpm-lock.yaml` + `pnpm nx run-many -t lint test build` |
| CA-012 | Guion real de §12 | job `montage` end to end + `sha256` de los tres artefactos |
| CA-013 | Guion real de §12 | job `render` encadenado + `ffprobe` sobre el stream de video |
| CA-014 | Guion real de §12 | la misma comparación de `sha256` con otro `seed`, que TIENE que fallar |
| CA-015 | (verificación de ciclo) | `apps/render-api/README.md` con el guion de §12 y las cuatro variables del `.env` |
| CA-016 | (verificación de ciclo) | `sdd/api.json` con los cinco endpoints `updated` + `pnpm sdd:validate` |

Los CA que el ciclo verifica de forma transversal y no tienen un símbolo propio distinto de los ya
listados (progreso monótono del montaje, distinción de `kind` en listado y detalle, preservación de
todos los campos ya publicados de un job de render) están cubiertos por `render-job.spec.ts`
(`toJob`/`toJobSummary`) y `jobs-handler.spec.ts`, aserados con `Object.keys(body).sort()` contra
las interfaces de §8.

---

## Dependencias externas

Ninguna (D-3): cero dependencias npm nuevas. Todo lo nuevo consume `@video-maker/auto-montage` y
`@video-maker/media-local`, ya presentes en el workspace.
