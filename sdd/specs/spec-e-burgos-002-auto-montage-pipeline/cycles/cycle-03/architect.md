# Architect — Cycle 3: CLI headless `tools/render-cli` (ingest → plan → render → run)

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/functional.md
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/architect.md
> **Generado por:** sdd-architect

---

## 0. Registros SDD que este ciclo NO toca

Igual que `cycle-01` y `cycle-02`, y por el mismo motivo: no hay motor de base de datos ni
superficie HTTP en el repo. Este ciclo agrega un ejecutable de línea de comandos, no un servicio.

- **`sdd/schema.json` — NO APLICA.** El único almacenamiento son archivos JSON bajo
  `media/<slug>/work/`, gobernados por los schemas Zod de `timeline-core` y de `auto-montage`
  (`CatalogSchema`, `EditDecisionListSchema`, `TimelineSchema`), ya existentes y versionados por
  `schemaVersion` dentro del propio archivo. Este ciclo **no crea ni modifica ningún schema
  persistido**: la CLI sólo compone lo que las libs ya escriben.
- **`sdd/api.json` — NO APLICA.** No hay endpoints HTTP. El contrato público de este ciclo es la
  **superficie de línea de comandos** (§3), que no tiene representación en `api.schema.json`. El
  primer `api.json` real llega con `apps/render-api` (`spec-e-burgos-005`).
- **`sdd/components.json` — NO APLICA.** No hay UI nueva. El único componente React que este ciclo
  toca es `aroll-series.tsx`, que ya existe y no cambia de contrato (§6).

Queda constancia acá porque el protocolo del `sdd-architect` exige escribir `api.json` y
`schema.json`: en este ciclo hacerlo sería agregar entradas vacías o falsas.

> **N-1 del brief se confirma:** `sdd/schemas/global.schema.json → monorepo` tiene
> `additionalProperties: false` y sólo acepta `apps` y `libs`. `tools/render-cli` se registra en
> `completed_modules[].apps` y **no** aparece en el mapa `monorepo`. No se parchea el schema; el
> reviewer lo reporta al dev.

---

## 1. Decisiones técnicas

Continúan la numeración de `cycle-02` (última: D-20). **No se re-litigan D-1 a D-20** — se aplican
tal cual. En particular D-2 (`publicDir` = raíz del proyecto de medios) es vinculante y HC-1 la
reafirma.

### 1.1 D-21 — `tools/render-cli` es un proyecto Nx `application` con tag `type:tool`

**Decisión:**

```json
{
  "name": "render-cli",
  "sourceRoot": "tools/render-cli/src",
  "projectType": "application",
  "tags": ["scope:engine", "type:tool"]
}
```

**`projectType: "application"`, no `"library"`.** `render-cli` es un ejecutable hoja: nada lo
importa y nada debería poder importarlo. Nx aplica a los proyectos `application` la regla
*"imports of apps are forbidden"* de `@nx/enforce-module-boundaries` de forma automática, sin
configuración extra — es decir, la elección de `projectType` **es** el guardrail que impide que
mañana una lib termine importando lógica de la CLI, que es exactamente lo que la constitución del
tool prohíbe ("no contiene lógica de montaje propia: si un cálculo hace falta, va a una lib").

**Tag `type:tool` — cumple HC-3, verificado leyendo `eslint.config.mjs`.** El orden de las reglas
importa porque `@nx/enforce-module-boundaries` aplica **todas** las `depConstraints` cuyo
`sourceTag` matchea el proyecto fuente (semántica AND), y `sourceTag: '*'` matchea a todos. La
tabla completa de la config raíz vigente:

| # | `sourceTag` | `onlyDependOnLibsWithTags` | ¿matchea `render-cli` (`scope:engine`, `type:tool`)? |
| - | ----------- | ------------------------- | ---------------------------------------------------- |
| 1 | `type:domain`  | `[]`                            | **no** |
| 2 | `type:util`    | `['type:domain']`               | **no** |
| 3 | `type:ui`      | `['type:domain']`               | **no** |
| 4 | `type:feature` | `['type:domain', 'type:util']`  | **no** |
| 5 | `*`            | `['*']`                         | **sí** (única) |

`type:tool` y `scope:engine` no aparecen como `sourceTag` en ninguna regla restrictiva, así que
`render-cli` cae **sólo** en la fila 5, que es permisiva (`['*']` es comodín en el lado del
target). Por lo tanto puede importar `auto-montage` (`type:feature`) y
`composition-remotion` (`type:ui`) sin tocar `eslint.config.mjs`.

**No hace falta editar `eslint.config.mjs`. HC-3 se cumple sin bloqueante.** Si durante la
implementación apareciera igual una violación de boundaries, se **para** y se reporta el diff
propuesto; no se edita la config raíz ni se la rodea con `Bash` (lección destilada).

**`enforceBuildableLibDependency: true` no genera problema:** la regla exige que un proyecto con
target `build` sólo dependa de proyectos que también tengan target `build`. `timeline-core`,
`media-local`, `auto-montage` y `composition-remotion` tienen los cuatro un `build`
(`nx:run-commands` + `tsc -p tsconfig.lib.json`), y `render-cli` va a tener el suyo (§2.3). Es la
misma topología que hoy tiene `auto-montage → timeline-core`, que ya pasa lint.

**Sin entrada en `tsconfig.base.json → paths`.** Nadie importa `@video-maker/render-cli`; agregar
el alias sería config muerta **y** un cambio en una config raíz protegida. Los imports internos del
tool son relativos.

### 1.2 D-22 — Scaffold: `--dry-run` primero; si el generador toca una config raíz, se crea a mano

**Contexto.** `nx.json → workspaceLayout` declara sólo `appsDir: apps` y `libsDir: libs`. Eso **no
impide** crear un proyecto en `tools/`: desde Nx 21 el path del proyecto se pasa como argumento y
`workspaceLayout` es legacy (sólo se usa cuando NO se da un directorio explícito). `tools/*` ya está
en los globs de `pnpm-workspace.yaml`, así que el directorio es de primera clase en el workspace.

El problema real es otro: `@nx/js:library` en Nx 23 genera la forma *TS-solution* (un
`package.json` por proyecto, alias nuevo en `tsconfig.base.json`, a veces un plugin nuevo en
`nx.json`), y este repo usa la forma clásica — `auto-montage`, `media-local`, `timeline-core` y
`composition-remotion` **no tienen `package.json` propio** y sus targets son explícitos. Deshacer lo
que el generador escribe en `tsconfig.base.json` / `nx.json` es editar una config raíz protegida:
el hook cubre `Write|Edit` y rodearlo con `Bash` está prohibido por lección destilada.

**Decisión — procedimiento en dos pasos, en la MISMA task del scaffold:**

1. **Dry-run obligatorio, antes de escribir nada:**

   ```bash
   pnpm exec nx g @nx/js:library tools/render-cli \
     --name=render-cli --unitTestRunner=vitest --bundler=none --linter=eslint \
     --directory=tools/render-cli --dry-run
   ```

   Leer la lista de `CREATE`/`UPDATE`.

2. **Bifurcación explícita:**
   - Si el dry-run **no** toca `tsconfig.base.json` ni `nx.json` ni `package.json` raíz → correr el
     generador de verdad y podar el resto (`package.json` del proyecto, placeholders de `src/`,
     targets inferidos) hasta llegar al estado objetivo de §2.
   - Si el dry-run **sí** toca alguna config raíz → **no se corre el generador**. Se crea el
     proyecto a mano copiando la forma de `libs/auto-montage` (son 6 archivos chicos: `project.json`,
     `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `vite.config.ts`,
     `eslint.config.mjs`), cuyo contenido objetivo está enteramente especificado en §2. Se deja
     constancia en el `journal/` del ciclo.

**Consecuencia para quien implemente:** el estado objetivo de §2 es normativo; el generador es un
medio, no un fin. La auditoría del scaffold (lección destilada) se hace contra §2, no contra la
intuición: `package.json` del proyecto (no debe existir), `nx.json` (no debe ganar plugins — en
particular `@nx/vitest`, que deja `test` en modo watch y cuelga `run-many`), y `src/` (sin
`export {};` ni placeholders).

### 1.3 D-23 — `src/main.ts` es la única frontera de proceso

**Decisión.** `src/main.ts` es el **único** archivo del tool autorizado a tocar `process.argv`,
`process.env`, `process.cwd()`, `process.exitCode` y `console`. Todo lo que está debajo es puro o
recibe sus efectos por parámetro.

```ts
// src/main.ts  (forma, no implementación)
const argv = process.argv.slice(2);
const projectRootResolver = (raw: string) => resolve(process.cwd(), raw);
const deps = createNodeCliDependencies(process.env);
const outcome = await runCli(argv, projectRootResolver, deps);
outcome.lines.forEach((line) => { ... });   // stdout en éxito, stderr en error
process.exitCode = outcome.exitCode;
```

```ts
// src/cli.ts
export interface CliOutcome {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

export async function runCli(
  argv: readonly string[],
  resolveProjectRoot: (raw: string) => string,
  deps: CliDependencies,
): Promise<CliOutcome>;
```

**Por qué `runCli` devuelve un `CliOutcome` en vez de escribir e invocar `process.exit`:** porque es
lo que hace testeable el 100% del contrato de CA-013 (exit codes) y de RNF-7 (formato del mensaje)
sin espiar `console` ni matar el proceso del test runner. `runCli` no lanza nunca: captura, traduce
y devuelve. La única forma de que el proceso termine ≠ 0 es que `main.ts` copie `outcome.exitCode`
a `process.exitCode`.

**`resolveProjectRoot` se inyecta** (en vez de llamar a `process.cwd()` adentro) por dos razones:
el ESLint del tool prohíbe `process` fuera de `main.ts`, y los tests necesitan rutas absolutas
deterministas (`/media/p`) sin depender del cwd del runner.

**Nota operativa importante:** los targets `cli` y `smoke` corren desde la **raíz del workspace**
(§2.3, sin `cwd`), así que una ruta relativa como `media/smoke-ingest` se resuelve contra la raíz
del repo, que es lo que el dev espera. Esto elimina el footgun de `$(pwd)` que hoy documenta el
README de `auto-montage`.

### 1.4 D-24 — Parseo con `node:util parseArgs`, puro y separado de la ejecución

**Decisión.** Cero dependencias npm nuevas (D-9 se reafirma). `parseCliArgs(argv)` es una función
**pura** que devuelve un `ParsedCommand` discriminado o lanza un error tipado de la CLI; no toca el
filesystem, no resuelve rutas y no ejecuta nada.

```ts
export type ParsedCommand =
  | { readonly command: 'ingest'; readonly projectRoot: string }
  | { readonly command: 'plan'; readonly projectRoot: string; readonly preset: MontagePresetName; readonly seed: number }
  | { readonly command: 'render'; readonly projectRoot: string }
  | { readonly command: 'run'; readonly projectRoot: string; readonly preset: MontagePresetName; readonly seed: number };

export function parseCliArgs(argv: readonly string[]): ParsedCommand;
```

`parseArgs` se usa con `{ args, options: { preset: { type: 'string' }, seed: { type: 'string' } },
allowPositionals: true, strict: true }`. `strict: true` lanza `TypeError` con `code`
`ERR_PARSE_ARGS_UNKNOWN_OPTION`, `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` o
`ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`; **esos errores nunca escapan**: se leen por `code`
(duck-typing sin `any`, igual que `isFileNotFoundError` en `read-catalog.ts`) y se traducen a
`CliUsageError`. Un `TypeError` de Node llegando a stderr sería exactamente el stack pelado que
RNF-7 prohíbe.

**`seed` se declara `type: 'string'` y se valida a mano**, no `type: 'string'` + `Number()`:
`Number('')`, `Number(' 1 ')`, `Number('0x10')` y `Number('1e3')` devuelven números válidos y
aceptarían basura. La validación es `/^\d+$/` + `Number.isSafeInteger` (RN-24: entero **no
negativo**).

### 1.5 D-25 — La lista de presets se declara en la CLI, con test de paridad contra la lib

**Contexto.** El mensaje de error de un `--preset` desconocido tiene que incluir "la lista de los
cuatro valores válidos" en un **orden estable** (CA de HU-16). `MONTAGE_PRESETS` es un
`Record<MontagePresetName, MontagePreset>`; `Object.keys()` sobre él devuelve `string[]`, pierde el
tipo y ata el mensaje al orden de declaración de un archivo de otra lib.

**Decisión.**

```ts
export const PRESET_NAMES = ['software-demo', 'hardware', 'recipe', 'educational'] as const satisfies
  readonly MontagePresetName[];
```

más un test de paridad obligatorio:

```
expect([...PRESET_NAMES].sort()).toEqual(Object.keys(MONTAGE_PRESETS).sort());
```

**Consecuencia:** si `auto-montage` agrega un quinto preset, la suite de `render-cli` se pone en
rojo con un mensaje que dice exactamente qué pasó, en vez de que la CLI rechace silenciosamente un
preset válido. Es la única forma de que "la lista literal" no se desincronice.

### 1.6 D-26 — Jerarquía de errores propia y tabla de exit codes por etapa

**Decisión.** `render-cli` no re-exporta ni re-lanza los errores de las libs: los **traduce** a una
jerarquía propia que garantiza por tipo los tres datos que exige RN-26 (etapa, recurso, causa).

```ts
export type Stage = 'ingest' | 'plan' | 'render';

export type RenderCliErrorCode = 'CLI_USAGE' | 'CLI_ARGUMENT' | 'STAGE_INPUT_MISSING' | 'STAGE_FAILED';

export abstract class RenderCliError extends Error {
  abstract readonly code: RenderCliErrorCode;
  abstract readonly stage: Stage | null;
  abstract readonly resource: string | null;
  abstract readonly reason: string;
}
export function isRenderCliError(value: unknown): value is RenderCliError;
```

`stage: Stage | null` — `null` **sólo** para `CliUsageError` (no hay comando, o el comando no
existe: todavía no hay etapa de la que hablar). Los otros tres siempre traen etapa, y esa etapa
**nunca** es `run` (RN-21, decisión funcional 5: `run` no es una etapa).

**Tabla de exit codes (normativa, testeable línea por línea):**

| exit | condición | ejemplo |
| ---- | --------- | ------- |
| `0` | éxito completo de la etapa o de las tres | — |
| `1` | error **no tipado** que escapó de una lib | un `TypeError` inesperado |
| `2` | `CLI_USAGE` o `CLI_ARGUMENT` | comando desconocido, `--preset` faltante, seed inválida |
| `3` | `STAGE_INPUT_MISSING` | falta `raw/`, falta `work/catalog.json`, falta `work/timeline.json` |
| `4` | `STAGE_FAILED` con `stage: 'ingest'` | `BINARY_NOT_FOUND`, `PROJECT_LAYOUT_INVALID` |
| `5` | `STAGE_FAILED` con `stage: 'plan'` | `MONTAGE_INPUT_INVALID`, `EDL_INVALID`, `TIMELINE_INVALID` |
| `6` | `STAGE_FAILED` con `stage: 'render'` | `BUNDLE_FAILED`, `RENDER_FAILED` |

**Por qué exit codes distintos por etapa y no un `1` genérico:** RN-25 sólo exige "≠ 0", pero el
consumidor de esta CLI es un dev con un shell y, más adelante, `apps/render-api` (`spec-005`).
Un código que identifica la etapa permite `if [ $? -eq 6 ]` sin parsear texto, y la tabla es
chica y estable. `2` y `3` van separados porque son las dos situaciones accionables distintas:
"escribiste mal el comando" vs. "falta correr la etapa anterior".

**`1` no imprime stack.** Un error no tipado se reporta como
`error [interno] <ErrorName>: <message>` más, si existe, una línea `causa:` con el `message` del
`cause`. Nunca `error.stack`, ni siquiera acá — RNF-7 no tiene excepciones.

### 1.7 D-27 — La etapa de un error de argumentos es la etapa que **consume** ese argumento

**Contexto.** RN-26 y la decisión funcional 5 exigen que un error de validación de argumentos
lleve etapa, que el vocabulario esté cerrado a `ingest | plan | render`, y que `run` nunca sea la
etapa. Para `plan`, `render` e `ingest` la respuesta es trivial (la etapa homónima). Para `run` no
lo es: es una composición.

**Decisión — regla única:** *la etapa de un error de argumentos es la primera etapa del comando
invocado que consume ese argumento.*

| comando | error en el posicional (project root) | error en `--preset` / `--seed` |
| ------- | ------------------------------------- | ------------------------------ |
| `ingest` | `ingest` | n/a → `CliUsageError` (opción inesperada) |
| `plan`   | `plan`   | `plan` |
| `render` | `render` | n/a → `CliUsageError` (opción inesperada) |
| `run`    | **`ingest`** (primera etapa que abre el proyecto) | **`plan`** (única etapa que consume preset y seed) |

**Consecuencia práctica:** `render-cli run /ruta --preset xxx` reporta `error [plan] unknown-preset`
— y eso es correcto y útil: le dice al dev que el problema está en la decisión de montaje, no en la
ingesta ni en el render. La regla se implementa en una función pura
`stageForArgument(command, argument): Stage` con su propio test de tabla.

**`--preset` y `--seed` en `ingest`/`render` son `CliUsageError`, no `CliArgumentError`** (decisión
funcional 4): aceptarlos y silenciarlos sugeriría falsamente que `render` puede recalcular el
montaje. Se rechazan explícitamente con exit code 2.

### 1.8 D-28 — Las precondiciones viven en la CLI, con los puertos de filesystem de `auto-montage`

**El hallazgo del Funcional es real y es peor de lo que parece — verificado leyendo el código:**

`resolveMediaProject(rootPath)` es puro: normaliza la ruta, deriva el slug y arma
`{ root, rawDir, workDir, outDir }`. **No toca el filesystem** y sólo falla si la ruta está vacía.
Pero el primer efecto de `ingestProject` **no** es descubrir assets, es crear directorios:

```ts
await ensureDirectory(toAbsolutePath(project, workPath()));            // mkdir -p <root>/work
await ensureDirectory(toAbsolutePath(project, workPath('transcripts')));
await ensureDirectory(toAbsolutePath(project, workPath('audio')));
await ensureDirectory(toAbsolutePath(project, workPath('whisper')));
```

y `nodeEnsureDirectory` es `mkdir(path, { recursive: true })`. Es decir: **un typo en la ruta del
proyecto crea un árbol de proyecto falso en disco** (`media/smoke-ingets/work/{transcripts,audio,
whisper}`) *antes* de fallar. Recién después `discoverAssets` intenta leer `raw/` y sí traduce el
fallo a `ProjectLayoutError` (lo hace con un `.catch()` explícito), así que el `ENOENT` crudo no
llega al usuario — pero la basura en disco ya quedó escrita, y el mensaje habla de `raw/` faltante
cuando lo que falta es el proyecto entero.

En `plan` el síntoma es distinto y más confuso: sobre una ruta inexistente, `readCatalog` ve
`ENOENT`, devuelve `null`, y `autoMontage` lanza `MontageInputError('catalog-missing')`, cuyo
mensaje dice *"El montaje de /ruta/con/typo no se puede armar: catalog-missing"* — le sugiere al dev
correr `ingest` cuando el problema es que la ruta no existe.

**Decisión.** Las precondiciones son responsabilidad de la CLI, viven en `src/pipeline/`, son
funciones puras salvo por los puertos que reciben, y corren **antes** de invocar cualquier función
de lib:

```ts
export interface ProjectPreconditionDependencies { readonly readDirectory: DirectoryReader; }
export interface StageInputDependencies { readonly statFile: FileStatReader; }

export async function assertProjectIsIngestable(project: MediaProject, deps: ProjectPreconditionDependencies): Promise<void>;
export async function assertCatalogExists(project: MediaProject, deps: StageInputDependencies): Promise<void>;
export async function assertTimelineExists(project: MediaProject, deps: StageInputDependencies): Promise<void>;
```

Los puertos son **los que `auto-montage` ya exporta desde su barrel** (`DirectoryReader` /
`nodeDirectoryReader`, `FileStatReader` / `nodeFileStatReader`): cero superficie nueva, cero
duplicación, y HC-6 intacto porque son inyectables.

Qué verifica cada una y qué error emite:

| función | chequeo | error |
| ------- | ------- | ----- |
| `assertProjectIsIngestable` | `readDirectory(project.root)` no falla | `StageInputMissingError({ stage:'ingest', reason:'project-root-not-found', resource: project.root })` |
| | `readDirectory(project.rawDir)` no falla | `... reason:'raw-missing', resource:'raw'` |
| | entre las entradas de `raw/` hay al menos un **directorio** llamado `aroll`, `broll`, `images` o `audio` | `... reason:'raw-has-no-role-directory', resource:'raw'` |
| `assertCatalogExists` | `statFile(<workDir>/catalog.json)` no falla | `StageInputMissingError({ stage:'plan', reason:'catalog-missing', resource:'work/catalog.json', hint:'corré `ingest` antes de `plan`' })` |
| `assertTimelineExists` | `statFile(<workDir>/timeline.json)` no falla | `... stage:'render', reason:'timeline-missing', resource:'work/timeline.json', hint:'corré `plan` antes de `render`'` |

Los nombres de las cuatro subcarpetas reconocidas se toman del contrato ya vigente de
`classify-entry.ts` (`ROLE_BY_DIRECTORY_NAME`): `aroll`, `broll`, `images`, `audio`. La CLI los
declara en una constante propia con el mismo criterio que D-25 (no hay export en el barrel para
reusarlos), pero **sin test de paridad**: `classify-entry` no los expone, así que el test sería
una copia de la copia. Se documenta la dependencia y listo.

**Nota:** `assertProjectIsIngestable` no comprueba que haya archivos adentro. Un `raw/aroll/` vacío
es un proyecto legítimamente vacío y el error correcto lo da `autoMontage`
(`MontageInputError('no-aroll-asset')`, exit 5) — un guard de la CLI sobre eso sería código muerto
con nombre de validación (lección destilada).

### 1.9 D-29 — `run` compone los tres comandos y re-lee `work/timeline.json` del disco

**Pregunta (a) del brief.** Dos opciones: `run` reusa las funciones de comando, o hay una capa de
"pipeline" compartida que `run` y los comandos sueltos consumen.

**Decisión: `run` compone las tres funciones de comando, en secuencia estricta, sin capa
intermedia.**

```ts
export async function runCommand(project, options, deps): Promise<RunReport> {
  const ingest = await ingestCommand(project, deps);
  const plan = await planCommand(project, options, deps);
  const render = await renderCommand(project, deps);
  return { ingest, plan, render };
}
```

Por qué:

- **RN-21 sale gratis.** Cada función de comando ya etiqueta sus errores con su propia etapa, así
  que `run` no traduce nada: propaga. Una capa intermedia obligaría a re-etiquetar y sería el lugar
  natural donde se colara `run` como etapa — justo lo que RN-21 prohíbe.
- **RN-32 sale por construcción.** Tres `await` encadenados. No hay `Promise.all` posible sin
  reescribir la función, y el ESLint del tool lo refuerza (§2.5).
- **HU-19 sale gratis.** `RunReport` es la suma de los tres reportes; el dev no pierde ningún fallo
  parcial por usar el atajo.
- **Cero lógica duplicada** entre `run` y los comandos sueltos: `run` **es** los tres comandos, no
  una segunda implementación que pueda derivar.

**Sub-decisión: la etapa `render` dentro de `run` re-lee `work/timeline.json` del disco**, aunque
`autoMontage` acaba de devolver la misma `Timeline` en memoria.

- Es la definición literal de RN-21 ("internamente ejecuta `ingest`, `plan` y `render`"): `run` y
  `ingest && plan && render` tienen que ser indistinguibles, incluido el camino de datos.
- Ejercita el artefacto persistido, que es sobre el que descansa toda la idempotencia de CA-016:
  si `writeTimeline` escribiera algo que no vuelve a parsear, `run` lo descubre.
- El costo es parsear un JSON de unos cientos de KB. Irrelevante frente a un render.

### 1.10 D-30 — El render entra por un puerto **propio** del tool; `composition-remotion` se carga con `await import()` en un único adaptador

**Contexto — dos riesgos concretos, verificados en el código:**

1. `libs/composition-remotion/src/render.ts` importa **como valor**
   `TIMELINE_COMPOSITION_ID` desde `./components/timeline-composition`, que es un `.tsx` que
   importa `react` y `remotion`. Un `import` estático de `@video-maker/composition-remotion/render`
   en el tope de un módulo de la CLI arrastra React y Remotion al proceso — no arrastra
   `@remotion/bundler` ni `@remotion/renderer` (esos siguen adentro de los `await import()` de
   `remotionRenderDeps`, mecanismo que este ciclo **no toca**), pero sí carga un árbol de módulos
   que ningún test de la CLI necesita.
2. HC-2: el carril paralelo de `spec-003` está reescribiendo esa lib y **quita `CaptionTrack` y
   `captionLayout` del barrel**. Cualquier tipo que `render-cli` importe de ahí es superficie que
   puede moverse debajo de nuestros pies antes del merge.

**Decisión — puerto propio, tipos propios, un solo adaptador:**

```ts
// src/deps/timeline-renderer.ts   (cero imports de composition-remotion)
export interface RenderRequest {
  readonly outPath: string;
  readonly publicDir: string;
}
export interface RenderOutcome {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}
export type TimelineRenderer = (timeline: Timeline, request: RenderRequest) => Promise<RenderOutcome>;
```

`RenderRequest` y `RenderOutcome` son estructuralmente compatibles con `RenderTimelineOptions` /
`RenderTimelineResult` pero **no son ellos**: `render-cli` sólo usa `outPath` y `publicDir` de la
opción, y `width/height/fps/durationInFrames/outPath` del resultado.

```ts
// src/deps/node-cli-dependencies.ts  — ÚNICO archivo que sabe que composition-remotion existe
const nodeTimelineRenderer: TimelineRenderer = async (timeline, request) => {
  const { renderTimeline, RenderTimelineError } = await import('@video-maker/composition-remotion/render');
  try {
    const result = await renderTimeline(timeline, { outPath: request.outPath, publicDir: request.publicDir });
    return { outPath: result.outPath, width: result.width, height: result.height, fps: result.fps, durationInFrames: result.durationInFrames };
  } catch (cause) {
    if (cause instanceof RenderTimelineError) {
      throw new StageFailedError({ stage: 'render', reason: cause.code, resource: request.outPath, cause });
    }
    throw cause;
  }
};
```

Consecuencias:

- **La suite de `render-cli` nunca carga `remotion`, React ni `@remotion/*`.** HC-6 se cumple por
  estructura, no por disciplina de cada test (lección destilada: "cargar un binario o paquete nativo
  con `await import()` dentro del método que lo usa").
- `renderTimeline` se invoca con **dos** argumentos: su tercer parámetro (`deps`) queda en su
  default `remotionRenderDeps`. La inyección de la CLI ocurre un nivel más arriba, en el puerto
  `TimelineRenderer`; duplicar el punto de inyección sólo confundiría cuál es el que vale.
- **Ojo con la firma real:** el `known_surface` del brief la anota como
  `renderTimeline(options, deps)`. La firma verdadera, leída en `render.ts`, es
  **`renderTimeline(timeline, options, deps = remotionRenderDeps)`** — la Timeline es el primer
  parámetro. El adaptador la usa así.
- Si `spec-003` rompe el barrel de la lib, `render-cli` no se entera: sólo consume el subpath
  `/render`, nunca `@video-maker/composition-remotion` a secas (prohibido por ESLint, §2.5).

### 1.11 D-31 — `resolveBinaries` es perezoso: sólo `ingest` necesita binarios

`plan` y `render` no invocan `ffmpeg`, `ffprobe` ni `whisper-cli`. Si la CLI resolviera los binarios
al arrancar, un `.env` incompleto rompería `plan` y `render` sin motivo, y con un error cuya etapa
sería mentira.

**Decisión:** en `CliDependencies` el binario entra como **proveedor**, no como valor:

```ts
readonly resolveBinaries: () => Promise<ResolvedBinaries>;
```

Sólo `ingestCommand` lo invoca. Su fallo (`BinaryNotFoundError` de `media-local`, que trae
`code: 'BINARY_NOT_FOUND'`) se traduce a
`StageFailedError({ stage: 'ingest', reason: 'BINARY_NOT_FOUND', resource: <nombre del binario> })`
→ exit 4.

`media-local` expone `isMediaLocalError` / `MediaLocalError` con `code` estable: la traducción se
hace sobre esa raíz, no sobre `instanceof BinaryNotFoundError` clase por clase.

### 1.12 D-32 — `outPath` = `<root>/out/<slug>.mp4`, sin flag; `publicDir` = `project.root`

**Decisión.** Una función pura, un solo lugar:

```ts
// src/pipeline/resolve-render-target.ts
export interface RenderTarget { readonly publicDir: string; readonly outPath: string; }

export function resolveRenderTarget(project: MediaProject): RenderTarget {
  return { publicDir: project.root, outPath: join(project.outDir, `${project.slug}.mp4`) };
}
```

- `publicDir = project.root` — **D-2 / HC-1 / RN-29**, nunca `project.rawDir`. Es lo que mantiene
  las rutas relativas de la Timeline (`raw/aroll/clip01.mp4`) en la rama `staticFile()` de
  `assetSrc`, la única verificada con un render real. Verificado leyendo `asset-src.ts`: una ruta
  absoluta caería en `toFileUrl()` (rama `file://`, no verificada).
- `outPath` **no tiene flag `--out`**. Motivos: (1) es lo que hace el nombre del MP4 determinista,
  que es mitad de CA-016; (2) sin flag no hay forma de escribir fuera de `out/`, así que RN-29 y la
  garantía de `raw/` intacto (RN-31) son estructurales y no dependen de validar una ruta del
  usuario. Un `--out` es alcance de un ciclo posterior si aparece la necesidad real.
- `join` viene de `node:path/posix`, por consistencia con `project-paths.ts` de `auto-montage`
  (`project.outDir` ya está armado con separadores POSIX).
- **Consecuencia buscada:** una segunda corrida **sobrescribe** el MP4 anterior. Por eso el
  procedimiento de smoke copia el MP4 de la primera corrida a un lado antes de borrar `out/` (§7).

### 1.13 D-33 — Cableado de D-4: una línea, y la verificación que sí está disponible

Ver §6 completo. En resumen: se toca **únicamente**
`libs/composition-remotion/src/components/aroll-series.tsx`, línea 44, y D-4 se verifica con
`tsc` + el `punch-in-style.spec.ts` que ya existe + el render real de CA-015 con el preset
`software-demo` (cuyo `punchIn.anchor` es `face-hint`, no `center`, así que el cableado tiene efecto
visible). **No se crea ningún archivo nuevo en esa lib** (HC-2).

### 1.14 D-34 — Criterio de verificación de CA-016 (hallazgo `probedAt`)

Ver §7.4 completo. En resumen, y esto es el punto donde un test ajustado para pasar sería una falla
del ciclo, así que el criterio se fija **antes** de correr nada:

- **`work/edl.json` byte a byte idéntico entre las dos corridas — BLOQUEANTE.**
- **`work/timeline.json` idéntico módulo `assets[].probedAt` — BLOQUEANTE.** Y esto **no** es una
  concesión: `TimelineSchema.assets` es `z.array(MediaAssetSchema)` y `MediaAsset.probedAt` es un
  `z.iso.datetime()` **obligatorio**, escrito por el `Clock` en la etapa de ingesta. Borrar `work/`
  borra el catálogo, así que la segunda corrida re-sondea y `probedAt` cambia **por diseño**.
  Exigir bytes idénticos del `timeline.json` completo sería exigir que la CLI viole D-6/D-7 de
  `cycle-01`. La normalización es mecánica y de una línea (`grep -v '"probedAt"'`), no un ajuste
  a medida.
- **`ffprobe` del MP4: mismas `width`, `height`, `r_frame_rate`, `nb_frames`, `codec_name`,
  `pix_fmt` y `duration` — BLOQUEANTE.** Es literalmente lo que RN-30 pide ("mismas dimensiones y
  misma duración en frames") y lo que CA-015 pide.
- **`framemd5` del contenido decodificado idéntico — BLOQUEANTE.** Prueba igualdad de píxeles y de
  muestras de audio, y es inmune a metadata de contenedor.
- **`shasum` del MP4 — EVIDENCIA, NO BLOQUEANTE**, con la justificación de §7.4.
- **`raw/` sin cambios (`shasum` + `mtime`) — BLOQUEANTE** (RN-31).

### 1.15 D-35 — El material de smoke se regenera: hoy no produce ningún punch-in

**Hallazgo, verificado sobre el material real del repo.** El `media/smoke-ingest` actual tiene un
A-roll de 4913 ms cuya transcripción (`work/transcripts/aroll/clip01.json`) son 11 palabras
**sin un solo hueco ≥ 400 ms** — el `minSilenceMs` del preset `software-demo`. Consecuencia
encadenada:

`detectSilencesFromWords` → 0 silencios → `pruneSilences` → **1 solo keep** →
`planPunchIns` con `every: 3` selecciona los keeps donde `(index + 1) % 3 === 0` → **0 punch-ins** →
`buildTimeline` no emite ningún `transform.anchor` → **la línea de D-4 no se ejecuta ni una vez
durante el render**.

Es decir: con el material actual, CA-015 rendería un MP4 válido y D-4 quedaría verificado por
nada. Y tampoco habría cortes, ni transiciones (`transitions.every: 4`), ni conceptos
(`minFrequency: 3` sobre 11 palabras).

**Decisión.** `media/smoke-ingest/raw/aroll/clip01.mp4` se **regenera** (es material regenerable —
HC-5; `media/video-01` y `media/video-02` son del dev y no se tocan) con **6 frases separadas por
900 ms de silencio**, y el README del tool documenta el comando exacto. Las frases se eligen para
que al menos dos términos del diccionario de `software-demo` aparezcan **3 veces o más**
(`concepts.minFrequency: 3`), así el planificador de B-roll también se ejercita:

```bash
# desde la raíz del repo. Requiere macOS (`say`) — con material propio del dev funciona igual.
mkdir -p /tmp/smoke-aroll && cd /tmp/smoke-aroll
i=1
for phrase in \
  "Abrimos la terminal y escribimos el primer comando." \
  "El comando de instalacion descarga las dependencias." \
  "Ahora corremos el script de deploy." \
  "El deploy publica la version en el servidor." \
  "Volvemos a la terminal y repetimos el comando." \
  "El deploy termina sin errores en la consola."
do
  say -o "phrase-$i.aiff" "$phrase"
  ffmpeg -y -loglevel error -i "phrase-$i.aiff" -ar 16000 -ac 1 "phrase-$i.wav"
  i=$((i + 1))
done
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=16000:cl=mono" -t 0.9 gap.wav
: > concat.txt
for n in 1 2 3 4 5 6; do
  echo "file 'phrase-$n.wav'" >> concat.txt
  [ "$n" != "6" ] && echo "file 'gap.wav'" >> concat.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -c copy voice.wav
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x224488:size=1280x720:rate=30" -i voice.wav \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 1 -ar 16000 \
  <RUTA-DEL-REPO>/media/smoke-ingest/raw/aroll/clip01.mp4
```

Conteo esperado de términos del diccionario: `comando` ×3, `deploy` ×3, `terminal` ×2,
`script` ×1, `consola` ×1 → al menos 2 conceptos detectados.

**Gate barato antes de gastar el render (obligatorio, §7.2):** correr `ingest` y `plan`, y leer
`work/edl.json`. Si `punchIns` está vacío o hay menos de 6 `keeps`, **no se renderiza**: se
regenera el material y se repite. Un render de ~19 s de video a 1080×1920 en una máquina de 16 GB
cuesta minutos; descubrir ahí que D-4 no se ejercitó es tirar ese costo.

### 1.16 D-36 — Targets `cli` y `smoke`, ambos fuera de `lint test build` y de CI

**Pregunta (c) del brief.** No hay un target `smoke` que ejecute un script aparte, como en
`auto-montage`: acá el smoke **es** la CLI corriendo de verdad, y duplicarla en un `src/smoke.ts`
crearía un segundo entry point que puede derivar del real. `auto-montage` necesita su `smoke.ts`
porque su smoke arma una invocación que su API pública no expone; `render-cli` no tiene ese
problema.

```json
"cli": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node -r @swc-node/register tools/render-cli/src/main.ts",
    "env": { "SWC_NODE_PROJECT": "tsconfig.base.json" }
  }
},
"smoke": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node -r @swc-node/register tools/render-cli/src/main.ts run {workspaceRoot}/media/smoke-ingest --preset software-demo --seed 0",
    "forwardAllArgs": false,
    "env": { "SWC_NODE_PROJECT": "tsconfig.base.json" }
  }
}
```

Invocación:

```bash
pnpm nx run render-cli:cli -- ingest media/smoke-ingest
pnpm nx run render-cli:cli -- plan media/smoke-ingest --preset software-demo --seed 0
pnpm nx run render-cli:cli -- render media/smoke-ingest
pnpm nx run render-cli:cli -- run media/smoke-ingest --preset software-demo --seed 0

pnpm nx run render-cli:smoke        # CA-015: la invocación fija, sin argumentos
```

- **Sin `cwd`**, a diferencia del `smoke` de `auto-montage`: `nx:run-commands` corre en la raíz del
  workspace, así que `media/smoke-ingest` es relativo a la raíz del repo. Eso elimina el footgun de
  `$(pwd)` que hoy documenta el README de `auto-montage`, y por eso `SWC_NODE_PROJECT` es
  `tsconfig.base.json` (no `../../tsconfig.base.json`).
- `node -r @swc-node/register` (registro CJS) es el único camino que funciona en este repo para
  ejecutar un `.ts` suelto (lección destilada: el hook ESM y `--experimental-strip-types` no
  funcionan acá).
- **Ninguno de los dos está en `lint test build`,** así que `nx run-many -t lint test build` de CI
  jamás los invoca. HC-6 se cumple por composición de targets, no por un flag.
- El `.env` raíz lo carga Nx en el proceso de cada task (verificado en `cycle-01`), así que
  `resolveBinaries(process.env)` encuentra `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH` y
  `WHISPER_MODEL_PATH` sin nada extra.

### 1.17 D-37 — Cobertura: umbral 85, excluyendo la frontera de proceso y el wiring real

`auto-montage` está en 85 y `composition-remotion` en 80; "no bajar de lo heredado" (HC-7) se
interpreta contra el proyecto más nuevo y más comparable: **85** en `lines`, `functions`,
`branches` y `statements`.

```ts
coverage: {
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/main.ts', 'src/deps/node-cli-dependencies.ts'],
  thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
}
```

Las dos exclusiones son las mismas dos que `auto-montage` justifica para `src/fs/node-*`: son
**wiring** contra el mundo real (`process`, `execa`, `await import` de Remotion), no lógica.
Todo lo demás — parseo, validación de argumentos, precondiciones, resolución de rutas, traducción
de errores, exit codes, formateo de reportes, y los cuatro comandos — está adentro del umbral y es
testeable sin un solo binario.

### 1.18 D-38 — `jsx: react-jsx` en los tsconfig del tool

**Trampa verificada.** `tsc -p tsconfig.lib.json` sigue el grafo de tipos: el `await import()` de
`@video-maker/composition-remotion/render` resuelve a `render.ts`, que importa como valor
`./components/timeline-composition`, que es un **`.tsx`**. `skipLibCheck: true` sólo salta
archivos `.d.ts`, no fuentes, así que TypeScript va a parsear ese `.tsx` — y sin `jsx` configurado
falla con *"Cannot use JSX unless the '--jsx' flag is provided"*. `libs/composition-remotion`
declara `"jsx": "react-jsx"` en sus dos tsconfig por exactamente este motivo.

**Decisión:** `tools/render-cli/tsconfig.lib.json` y `tsconfig.spec.json` declaran
`"jsx": "react-jsx"`. Es una línea, sin efecto sobre el código del tool (que no tiene JSX) y sin la
cual `nx build render-cli` queda en rojo en CI.

### 1.19 D-39 — Aliases de Vitest: los cuatro, y la clave `/render` exacta

Lección destilada: `tsc` resuelve por `tsconfig.base.json → paths`, **Vitest no**. `lint` y `build`
verdes no prueban que la suite resuelva los imports.

```ts
resolve: {
  alias: {
    '@video-maker/composition-remotion/render': fileURLToPath(new URL('../../libs/composition-remotion/src/render.ts', import.meta.url)),
    '@video-maker/timeline-core': fileURLToPath(new URL('../../libs/timeline-core/src/index.ts', import.meta.url)),
    '@video-maker/media-local': fileURLToPath(new URL('../../libs/media-local/src/index.ts', import.meta.url)),
    '@video-maker/auto-montage': fileURLToPath(new URL('../../libs/auto-montage/src/index.ts', import.meta.url)),
  },
}
```

Dos detalles que no son cosméticos:

1. **`'@video-maker/composition-remotion/render'` va primero y es la clave exacta.** El alias por
   objeto de Vite matchea por prefijo (`importee === find` o `importee.startsWith(find + '/')`), así
   que una clave `'@video-maker/composition-remotion'` capturaría también el subpath `/render` y lo
   reescribiría a `.../src/index.ts/render` — roto. **Nunca declarar el barrel** (HC-2: `render-cli`
   no lo consume).
2. Los cuatro se declaran aunque hoy `composition-remotion/render` sólo se importe adentro de un
   `await import()` de un archivo excluido de cobertura: si mañana un spec lo alcanza, el fallo
   sería un `Cannot find module` opaco en vez de un error de tipos.

Las rutas llevan `../../` porque el proyecto vive en `tools/`, no en `libs/`.

### 1.20 D-40 — Salida humana con formato normativo; sin `--json`, sin `--verbose`, sin stack

La CLI escribe texto para un dev en una terminal. No hay `--json` (nadie la consume por programa
todavía; cuando exista `apps/render-api` va a importar las libs, no a hacer spawn de esta CLI), no
hay `--verbose`, y **no hay ningún camino que imprima un `error.stack`** (RNF-7 sin excepciones,
incluido el exit 1 de error no tipado).

El formato es **normativo** (§4.3, §5.3) para que los tests puedan afirmarlo por igualdad exacta en
vez de por `toContain`, que es lo que hace que un contrato de mensajes de error se pudra sin que
nadie lo note. `formatCliError` y `formatReport` son funciones puras que devuelven
`readonly string[]`; `main.ts` sólo las vuelca.

### 1.21 D-9 se reafirma — cero dependencias npm nuevas

`node:util parseArgs` cubre el parseo. `node:path/posix` cubre las rutas. Los puertos de filesystem
y el `CommandRunner` los aporta `auto-montage`/`media-local`. `ffprobe` y `ffmpeg`, que el
procedimiento de smoke usa para verificar (§7), **ya son binarios requeridos del proyecto** y
entran por `resolveBinaries` / por el shell del dev, no por `package.json`.

**No se propone ninguna dependencia nueva. No hay nada que el dev tenga que aprobar en este eje.**

---

## 2. Estructura de `tools/render-cli`

Estado objetivo **normativo**: el generador de D-22 es un medio, y la auditoría posterior al
scaffold se hace contra esta sección, archivo por archivo. Lo que no está acá, no existe.

### 2.1 Árbol de archivos

```
tools/render-cli/
├── project.json                                  targets lint/test/build/cli/smoke y tags (§2.3)
├── tsconfig.json                                 solution file: sin files, referencia a lib y spec
├── tsconfig.lib.json                             compilación del tool; jsx react-jsx (D-38)
├── tsconfig.spec.json                            compilación de los specs; jsx react-jsx (D-38)
├── vite.config.ts                                aliases (D-39) y coverage (D-37) — §2.4
├── eslint.config.mjs                             guardrails del tool — §2.5
├── README.md                                     invocación, regeneración del material de smoke (D-35)
└── src/
    ├── main.ts                                   única frontera de proceso: argv, env, cwd, console, exitCode (D-23)
    ├── cli.ts                                    runCli: parseo → despacho → CliOutcome; no lanza nunca (D-23)
    ├── cli.spec.ts                               contrato punta a punta de runCli con dependencias falsas
    ├── args/
    │   ├── preset-names.ts                       PRESET_NAMES, la lista literal y ordenada (D-25)
    │   ├── preset-names.spec.ts                  test de paridad contra MONTAGE_PRESETS (D-25)
    │   ├── parse-cli-args.ts                     parseCliArgs: parseArgs + validación, puro (D-24)
    │   ├── parse-cli-args.spec.ts                tabla de argumentos válidos e inválidos
    │   ├── stage-for-argument.ts                 stageForArgument: comando + argumento → Stage (D-27)
    │   └── stage-for-argument.spec.ts            tabla de las 8 celdas de D-27
    ├── errors/
    │   ├── render-cli-error.ts                   RenderCliError abstracta + isRenderCliError (D-26) — §5.1
    │   ├── cli-usage-error.ts                    CLI_USAGE, stage null
    │   ├── cli-argument-error.ts                 CLI_ARGUMENT, stage según D-27
    │   ├── stage-input-missing-error.ts          STAGE_INPUT_MISSING, con hint de la etapa previa
    │   ├── stage-failed-error.ts                 STAGE_FAILED, envuelve el error tipado de la lib
    │   ├── translate-lib-error.ts                unknown → RenderCliError vía isAutoMontageError / isMediaLocalError
    │   ├── translate-lib-error.spec.ts           un caso por código de AutoMontageErrorCode y MediaLocalErrorCode
    │   ├── exit-code-for.ts                      exitCodeFor: RenderCliError | unknown → number (§5.2)
    │   ├── exit-code-for.spec.ts                 la tabla de exit codes, fila por fila
    │   ├── format-cli-error.ts                   formatCliError: formato normativo (§5.3)
    │   └── format-cli-error.spec.ts              igualdad exacta de cada forma de error
    ├── pipeline/
    │   ├── assert-project-preconditions.ts       assertProjectIsIngestable / CatalogExists / TimelineExists (D-28)
    │   ├── assert-project-preconditions.spec.ts  cada chequeo con puertos falsos, sin filesystem
    │   ├── resolve-render-target.ts              resolveRenderTarget: publicDir y outPath (D-32)
    │   ├── resolve-render-target.spec.ts         CA-014 sin render real
    │   ├── read-timeline-document.ts             lee work/timeline.json y lo valida con TimelineSchema
    │   └── read-timeline-document.spec.ts        JSON roto, JSON válido, schema inválido
    ├── commands/
    │   ├── ingest-command.ts                     precondición → resolveBinaries → ingestProject → IngestReport
    │   ├── ingest-command.spec.ts
    │   ├── plan-command.ts                       precondición → autoMontage → PlanReport
    │   ├── plan-command.spec.ts
    │   ├── render-command.ts                     precondición → readTimelineDocument → renderer → RenderReport
    │   ├── render-command.spec.ts
    │   ├── run-command.ts                        los tres en secuencia estricta (D-29, RN-32)
    │   └── run-command.spec.ts                   corta en la primera etapa que falla, propaga su etapa
    ├── report/
    │   ├── cli-report.ts                         tipos IngestReport / PlanReport / RenderReport / RunReport (§4.2)
    │   ├── to-reports.ts                         mappers puros de IngestResult / AutoMontageResult / RenderOutcome
    │   ├── to-reports.spec.ts
    │   ├── format-report.ts                      formatReport: formato normativo (§4.3)
    │   └── format-report.spec.ts                 igualdad exacta de cada bloque y de la concatenación de run
    ├── deps/
    │   ├── cli-dependencies.ts                   CliDependencies: todos los puertos, sin defaults (§4.2)
    │   ├── timeline-renderer.ts                  puerto propio de render; cero imports de composition-remotion (D-30)
    │   └── node-cli-dependencies.ts              único wiring real: execa, fs de Node, await import de Remotion
    └── __fixtures__/
        ├── fake-cli-dependencies.ts              CliDependencies completa en memoria, sin un solo binario
        └── media-project.ts                      MediaProject determinista sobre /media/p
```

Dos ausencias deliberadas:

- **No hay `src/index.ts`.** `render-cli` es una aplicación hoja (D-21): un barrel sería superficie
  pública para un proyecto que nadie puede importar.
- **No hay `src/smoke.ts`.** D-36: el smoke **es** la CLI corriendo de verdad; un segundo entry
  point podría derivar del real.

### 2.2 tsconfig

Tres archivos, misma forma que `libs/auto-montage` con la única diferencia de D-38.

```jsonc
// tools/render-cli/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "strict": true },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

```jsonc
// tools/render-cli/tsconfig.lib.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "jsx": "react-jsx",
    "declaration": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

```jsonc
// tools/render-cli/tsconfig.spec.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../dist/out-tsc", "jsx": "react-jsx", "types": ["node", "vitest/globals"] },
  "include": ["src/**/*.spec.ts"]
}
```

`"jsx": "react-jsx"` en los dos es D-38 y no es opcional: el grafo de tipos que abre el
`await import('@video-maker/composition-remotion/render')` llega a un `.tsx`, y `skipLibCheck` no
cubre fuentes.

### 2.3 `project.json` — tags y targets

```jsonc
{
  "name": "render-cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "tools/render-cli/src",
  "projectType": "application",
  "tags": ["scope:engine", "type:tool"],
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run --coverage --passWithNoTests", "cwd": "tools/render-cli" }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/out-tsc/tools/render-cli"],
      "options": { "command": "tsc -p tsconfig.lib.json", "cwd": "tools/render-cli" }
    },
    "cli": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node -r @swc-node/register tools/render-cli/src/main.ts",
        "env": { "SWC_NODE_PROJECT": "tsconfig.base.json" }
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node -r @swc-node/register tools/render-cli/src/main.ts run {workspaceRoot}/media/smoke-ingest --preset software-demo --seed 0",
        "forwardAllArgs": false,
        "env": { "SWC_NODE_PROJECT": "tsconfig.base.json" }
      }
    }
  }
}
```

`lint`, `test` y `build` son los tres que corre `nx run-many -t lint test build` y CI. `cli` y
`smoke` quedan fuera por composición de targets (D-36, HC-6), no por un flag que alguien pueda
olvidarse de pasar. `cli` y `smoke` **no llevan `cwd`**: corren desde la raíz del workspace, por eso
`SWC_NODE_PROJECT` es `tsconfig.base.json` y no `../../tsconfig.base.json`.

### 2.4 `vite.config.ts`

```ts
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/render-cli',
  resolve: {
    alias: {
      '@video-maker/composition-remotion/render': fileURLToPath(
        new URL('../../libs/composition-remotion/src/render.ts', import.meta.url),
      ),
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../../libs/timeline-core/src/index.ts', import.meta.url),
      ),
      '@video-maker/media-local': fileURLToPath(
        new URL('../../libs/media-local/src/index.ts', import.meta.url),
      ),
      '@video-maker/auto-montage': fileURLToPath(
        new URL('../../libs/auto-montage/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/tools/render-cli',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__fixtures__/**',
        'src/main.ts',
        'src/deps/node-cli-dependencies.ts',
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
```

`environment: 'node'` — no hay JSX ni DOM en la suite del tool. La clave
`'@video-maker/composition-remotion/render'` va **primera y exacta**, y el barrel **no se declara**
(D-39, HC-2).

### 2.5 `eslint.config.mjs` — los guardrails del tool

Cada bloque es la contracara ejecutable de una decisión de §1; sin esto las decisiones son prosa.

```js
import baseConfig from '../../eslint.config.mjs';

const NODE_FS = ['node:fs', 'node:fs/promises', 'fs', 'fs/promises'];
const CHILD_PROCESS = ['node:child_process', 'child_process', 'execa'];
const NODE_PATH = ['node:path', 'path'];
const COMPOSITION_BARREL = ['@video-maker/composition-remotion'];
const RENDER_RUNTIME = ['react', 'react-dom', 'react/*', 'remotion', 'remotion/*', '@remotion/*'];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'La frontera de proceso es src/main.ts (D-23).' },
        { name: 'console', message: 'La frontera de proceso es src/main.ts (D-23): las funciones devuelven CliOutcome.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Promise', property: 'all', message: 'RN-32: las etapas corren en secuencia estricta, nunca en paralelo.' },
        { object: 'Promise', property: 'allSettled', message: 'RN-32: las etapas corren en secuencia estricta, nunca en paralelo.' },
        { object: 'Promise', property: 'race', message: 'RN-32: las etapas corren en secuencia estricta, nunca en paralelo.' },
        { property: 'stack', message: 'RNF-7: ningún camino imprime un stack trace.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NODE_FS, message: 'El filesystem entra por los ports de auto-montage inyectados en CliDependencies.' },
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO por CommandRunner; el runner concreto lo arma src/deps/node-cli-dependencies.ts.' },
            { group: NODE_PATH, message: 'Las rutas del proyecto de medios son POSIX: usar node:path/posix (D-32).' },
            { group: COMPOSITION_BARREL, message: 'HC-2: solo el subpath @video-maker/composition-remotion/render.' },
            { group: RENDER_RUNTIME, message: 'D-30: el render entra por el puerto TimelineRenderer, nunca por un import directo.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/main.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/deps/node-cli-dependencies.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
```

- `{ property: 'stack' }` sin `object` restringe el acceso a `.stack` sobre **cualquier** objeto: es
  RNF-7 vuelto regla de lint, incluido el camino de exit 1 de D-26.
- `no-restricted-properties` sobre `Promise.all`/`allSettled`/`race` es el refuerzo que D-29 promete
  para RN-32.
- `src/main.ts` es el único con las dos reglas apagadas: necesita `process`, `console` y
  `resolve` de `node:path` para el cwd (D-23).
- `src/deps/node-cli-dependencies.ts` es el único que puede importar
  `@video-maker/composition-remotion/render`; el resto del tool ve el puerto, no la lib (D-30).

---

## 3. Superficie de línea de comandos

Forma general, con los cuatro comandos y **ninguna** opción global:

```
render-cli <ingest|plan|render|run> <project-root> [--preset <name>] [--seed <n>]
```

No hay `bin` en ningún `package.json` (D-21: el tool no se publica). En este repo se invoca por el
target `cli` de §2.3; los ejemplos de abajo usan esa forma. `<project-root>` relativo se resuelve
contra la raíz del workspace, no contra el cwd del dev (D-23, D-36).

Reglas comunes a los cuatro:

- `<project-root>` es **posicional, obligatorio y único** (RN-22). Un segundo posicional es
  `error [uso] unexpected-positional`, exit 2.
- No hay `--help` ni `--version`: sin comando, o con un comando desconocido, la CLI imprime el error
  de uso con la lista de comandos válidos (§5.3), que cumple la misma función sin una superficie
  extra que mantener.
- Ninguno escribe jamás bajo `raw/` (RN-31): la garantía es estructural, la aporta
  `guardWriteTextFile`/`guardEnsureDirectory` de `auto-montage`, y en la CLI se refuerza porque
  ningún comando acepta una ruta de salida (D-32).
- Salida de éxito: el bloque de `formatReport` (§4.3) por stdout, exit 0. Salida de error: el bloque
  de `formatCliError` (§5.3) por stderr, exit según §5.2, y **stdout vacío**.

### 3.1 `ingest`

```bash
pnpm nx run render-cli:cli -- ingest media/smoke-ingest
```

| | |
| - | - |
| Posicionales | `<project-root>` (obligatorio) |
| Flags | **ninguno**. `--preset` o `--seed` acá son `error [uso] unexpected-option`, exit 2 (D-27, decisión funcional 4) |
| Defaults | `language` y `transcribeRoles` quedan en los de `ingestProject` (`auto`, `['aroll']`): la CLI no los expone (decisión funcional 7) |
| Precondiciones | `assertProjectIsIngestable` (D-28): la raíz existe, existe `raw/`, y `raw/` contiene al menos un **directorio** entre `aroll`, `broll`, `images`, `audio` |
| Efectos en disco | crea `work/`, `work/transcripts/`, `work/audio/`, `work/whisper/`; escribe `work/catalog.json`, los `work/transcripts/**/*.json` del A-roll, y los intermedios `work/audio/**/*.wav` y `work/whisper/**`. Nada fuera de `work/` |
| Éxito imprime | bloque `ok [ingest]` de §4.3 |

La precondición es la que evita que un typo en la ruta cree un árbol de proyecto falso en disco
antes de fallar (D-28): `ingestProject` hace `mkdir -p` **antes** de mirar `raw/`.

### 3.2 `plan`

```bash
pnpm nx run render-cli:cli -- plan media/smoke-ingest --preset software-demo --seed 0
```

| | |
| - | - |
| Posicionales | `<project-root>` (obligatorio) |
| Flags | `--preset <software-demo\|hardware\|recipe\|educational>` **obligatorio, sin default** (RN-23); `--seed <entero ≥ 0>` opcional |
| Defaults | `seed = 0` (RN-24, decisión funcional 1). `outputPreset` queda en el default de la lib, `reels-9x16` → 1080×1920@30 (decisión funcional 7) |
| Precondiciones | `assertCatalogExists` (D-28): existe `work/catalog.json`. La validación de `--preset` y `--seed` ocurre **antes**, en `parseCliArgs`, sin tocar el filesystem |
| Efectos en disco | escribe `work/edl.json` y `work/timeline.json` (`autoMontage` persiste salvo `persist: false`, que la CLI nunca pasa). No borra ni reescribe el catálogo |
| Éxito imprime | bloque `ok [plan]` de §4.3 |

### 3.3 `render`

```bash
pnpm nx run render-cli:cli -- render media/smoke-ingest
```

| | |
| - | - |
| Posicionales | `<project-root>` (obligatorio) |
| Flags | **ninguno** — decisión funcional 4: `--preset`/`--seed` acá sugerirían falsamente que `render` recalcula el montaje. Son `error [uso] unexpected-option`, exit 2 |
| Defaults | `codec` `h264`, `concurrency` 4, `compositionId` y `entryPoint` quedan en los de `renderTimeline`; la CLI **solo** fija `outPath` y `publicDir` (D-30) |
| Precondiciones | `assertTimelineExists` (D-28) y luego `readTimelineDocument`, que parsea el JSON y lo valida con `TimelineSchema` antes de encender Remotion |
| Efectos en disco | crea `out/` si no existe y escribe `out/<slug>.mp4` (D-32), sobrescribiendo el anterior. Nada más |
| Éxito imprime | bloque `ok [render]` de §4.3 |

`publicDir = project.root` y `outPath = <root>/out/<slug>.mp4` salen de `resolveRenderTarget`
(D-32) — es la función pura donde CA-014 se verifica **sin render real**, con una aserción de
igualdad sobre el `RenderRequest` que recibe el `TimelineRenderer` falso.

### 3.4 `run`

```bash
pnpm nx run render-cli:cli -- run media/smoke-ingest --preset software-demo --seed 0
pnpm nx run render-cli:smoke        # la misma invocación, fija, para CA-015
```

| | |
| - | - |
| Posicionales | `<project-root>` (obligatorio) |
| Flags | los mismos de `plan`: `--preset` obligatorio, `--seed` opcional |
| Defaults | los mismos de `plan` |
| Precondiciones | las de cada etapa, evaluadas **dentro** de cada etapa y en su momento (D-29): `run` no tiene precondiciones propias |
| Efectos en disco | la unión de los efectos de las tres etapas, en orden. Si una falla, los efectos de las etapas previas quedan escritos: son artefactos válidos de `work/`, y por eso `plan` sigue siendo re-corrible sin repetir la ingesta |
| Éxito imprime | la **concatenación exacta** de los tres bloques, en orden `ingest`, `plan`, `render` (§4.3) |

Secuencia estricta, tres `await` encadenados, sin `Promise.all` — RN-32 por construcción y por lint
(§2.5). Si una etapa falla, `run` corta ahí, no continúa, y el error reportado lleva **la etapa
real**, nunca `run` (RN-21). Cuando falla, `run` **no** imprime los reportes de las etapas ya
completadas: la CA de HU-19 sobre `run` está condicionada a exit code 0, y mezclar reportes de éxito
con un error en la misma corrida vuelve la salida ambigua justo cuando el dev necesita leerla rápido.

---

## 4. Contratos internos

### 4.1 Resultado del parseo

```ts
// src/args/preset-names.ts
import type { MontagePresetName } from '@video-maker/auto-montage';

export const PRESET_NAMES = ['software-demo', 'hardware', 'recipe', 'educational'] as const satisfies
  readonly MontagePresetName[];

export const COMMAND_NAMES = ['ingest', 'plan', 'render', 'run'] as const;
export const DEFAULT_SEED = 0;
```

```ts
// src/args/parse-cli-args.ts
export interface PlanOptions {
  readonly preset: MontagePresetName;
  readonly seed: number;
}

export type ParsedCommand =
  | { readonly command: 'ingest'; readonly projectRoot: string }
  | { readonly command: 'plan'; readonly projectRoot: string; readonly options: PlanOptions }
  | { readonly command: 'render'; readonly projectRoot: string }
  | { readonly command: 'run'; readonly projectRoot: string; readonly options: PlanOptions };

export function parseCliArgs(argv: readonly string[]): ParsedCommand;
```

`ParsedCommand` agrupa `preset` y `seed` en `PlanOptions` en vez de dejarlos planos como en el
boceto de D-24: es exactamente el objeto que `planCommand` y `runCommand` reciben, así que el
comando no tiene que re-armarlo y no existe la posibilidad de que uno de los dos se pierda en el
camino. La forma discriminada y el contenido son los de D-24.

`parseCliArgs` es pura: no resuelve la ruta (la deja como el dev la escribió; `resolveProjectRoot`
la absolutiza en `main.ts`), no toca el filesystem y no lanza nada que no sea `CliUsageError` o
`CliArgumentError`. Orden de validación, normativo porque fija qué error gana cuando hay varios:

1. hay al menos un token → si no, `CliUsageError('missing-command')`
2. el primero está en `COMMAND_NAMES` → si no, `CliUsageError('unknown-command')`
3. `parseArgs({ args, options, allowPositionals: true, strict: true })` no falla → si falla, se lee
   `error.code` (`ERR_PARSE_ARGS_UNKNOWN_OPTION`, `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`,
   `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`) y se traduce a `CliUsageError` (D-24)
4. hay exactamente un posicional además del comando → si no, `CliUsageError('missing-project-root')`
   o `CliUsageError('unexpected-positional')`
5. el comando no recibió flags que no le corresponden → si los recibió,
   `CliUsageError('unexpected-option')` (D-27)
6. `--preset` presente en `plan`/`run` → si no, `CliArgumentError('missing-preset')`
7. `--preset` ∈ `PRESET_NAMES` → si no, `CliArgumentError('unknown-preset')`
8. `--seed` ausente → `DEFAULT_SEED`; presente → `/^\d+$/` y `Number.isSafeInteger` → si no,
   `CliArgumentError('invalid-seed')` (D-24)

Los pasos 6–8 llevan etapa por `stageForArgument(command, argument)` (D-27); los pasos 1–5 son
`CliUsageError`, con `stage: null`.

```ts
// src/args/stage-for-argument.ts
export type CliArgument = 'project-root' | 'preset' | 'seed';
export function stageForArgument(command: ParsedCommand['command'], argument: CliArgument): Stage;
```

### 4.2 Puertos inyectables y firmas puras

```ts
// src/deps/timeline-renderer.ts   — cero imports de composition-remotion (D-30)
import type { Timeline } from '@video-maker/timeline-core';

export interface RenderRequest {
  readonly outPath: string;
  readonly publicDir: string;
}

export interface RenderOutcome {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export type TimelineRenderer = (timeline: Timeline, request: RenderRequest) => Promise<RenderOutcome>;
```

```ts
// src/deps/cli-dependencies.ts
import type {
  DirectoryReader, EnsureDirectory, FileStatReader, WriteTextFile,
} from '@video-maker/auto-montage';
import type { Clock, CommandRunner, ReadTextFile, ResolvedBinaries } from '@video-maker/media-local';

import type { TimelineRenderer } from './timeline-renderer';

export interface CliDependencies {
  readonly runner: CommandRunner;
  readonly resolveBinaries: () => Promise<ResolvedBinaries>;
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
  readonly readTextFile: ReadTextFile;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
  readonly clock: Clock;
  readonly renderTimeline: TimelineRenderer;
}
```

Los nueve campos son **obligatorios**, sin `?`. `ingestProject` y `autoMontage` aceptan casi todos
como opcionales con default a la implementación de Node, pero la CLI es la raíz de composición: si
los defaults se resolvieran con `??` dentro de cada comando, un test que se olvide de un puerto
tocaría el filesystem real sin avisar, y HC-6 dejaría de estar garantizado por estructura. Los
defaults viven en un solo lugar, `createNodeCliDependencies(env)`.

`resolveBinaries` entra como **proveedor** `() => Promise<ResolvedBinaries>` y solo lo invoca
`ingestCommand` (D-31). Es asíncrono porque la función real de `media-local` lo es —el
`known_surface` del brief la anota como si fuera sincrónica; la firma verdadera es
`resolveBinaries(env, opts?): Promise<ResolvedBinaries>`.

Firmas de las funciones puras y de los comandos:

```ts
// src/pipeline/
export function resolveRenderTarget(project: MediaProject): RenderTarget;
export async function assertProjectIsIngestable(project: MediaProject, deps: { readonly readDirectory: DirectoryReader }): Promise<void>;
export async function assertCatalogExists(project: MediaProject, deps: { readonly statFile: FileStatReader }): Promise<void>;
export async function assertTimelineExists(project: MediaProject, deps: { readonly statFile: FileStatReader }): Promise<void>;
export async function readTimelineDocument(project: MediaProject, deps: { readonly readTextFile: ReadTextFile }): Promise<Timeline>;

// src/errors/
export function translateLibError(cause: unknown, stage: Stage, resource: string | null): RenderCliError;
export function exitCodeFor(error: unknown): number;
export function formatCliError(error: unknown): readonly string[];

// src/report/
export function toIngestReport(result: IngestResult, project: MediaProject): IngestReport;
export function toPlanReport(result: AutoMontageResult): PlanReport;
export function toRenderReport(outcome: RenderOutcome, project: MediaProject): RenderReport;
export function formatReport(report: CliReport): readonly string[];

// src/commands/
export async function ingestCommand(project: MediaProject, deps: CliDependencies): Promise<IngestReport>;
export async function planCommand(project: MediaProject, options: PlanOptions, deps: CliDependencies): Promise<PlanReport>;
export async function renderCommand(project: MediaProject, deps: CliDependencies): Promise<RenderReport>;
export async function runCommand(project: MediaProject, options: PlanOptions, deps: CliDependencies): Promise<RunReport>;
```

Tipos del reporte. Todas las rutas que aparecen son **relativas al proyecto de medios** y POSIX
(`work/catalog.json`, `out/smoke-ingest.mp4`): es lo que hace que el reporte sea idéntico corra
donde corra, y por lo tanto afirmable por igualdad exacta en un test. Los mappers `to*Report` hacen
esa conversión con `toProjectRelativePath`.

```ts
// src/report/cli-report.ts
export type AssetRoleCount = { readonly role: AssetRole; readonly count: number };

export interface IngestReport {
  readonly kind: 'ingest';
  readonly catalogPath: string;
  readonly assetCounts: readonly AssetRoleCount[];       // siempre 4, en orden aroll, broll, image, audio
  readonly transcribedCount: number;
  readonly reusedTranscriptionCount: number;
  readonly probeFailurePaths: readonly string[];         // ordenado ascendentemente
  readonly transcriptionFailures: readonly { readonly assetId: string; readonly failedStage: string }[];
  readonly staleCatalogReplaced: boolean;
}

export interface PlanReport {
  readonly kind: 'plan';
  readonly timelinePath: string;
  readonly edlPath: string;
  readonly editedDurationMs: number;
  readonly transcriptionSource: string;
  readonly conceptTerms: readonly string[];
  readonly brollOverlayCount: number;
  readonly brollRejections: readonly { readonly conceptTerm: string; readonly startMs: number; readonly reason: string }[];
}

export interface RenderReport {
  readonly kind: 'render';
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export interface RunReport {
  readonly kind: 'run';
  readonly ingest: IngestReport;
  readonly plan: PlanReport;
  readonly render: RenderReport;
}

export type CliReport = IngestReport | PlanReport | RenderReport | RunReport;
```

`IngestResult.probeFailures` y `IngestResult.transcriptionFailures` son arrays de **errores**
(`AssetProbeFailedError` con `.path`, `TranscriptionFailedError` con `.assetId` y `.stage`), no de
objetos planos: los mappers extraen solo esos campos, y `.stage` del error de transcripción se
renombra a `failedStage` en el reporte para que no se confunda con la `Stage` de la CLI —
`extract-audio | transcribe | persist` es otro vocabulario.

### 4.3 Formato normativo del reporte de salida

`formatReport(report: CliReport): readonly string[]` — puro, sin `console`, sin salto de línea final
(lo agrega `main.ts` al volcar). **Este formato es contrato: los tests lo afirman con `toEqual`
sobre el array completo, no con `toContain`.**

Tres reglas, y no hay una cuarta:

1. **Cabecera:** `ok [<stage>] <ruta principal>`, sin indentación.
2. **Detalle escalar:** `  <label>: <valor>`, dos espacios de indentación, `label` en kebab-case.
3. **Colección:** `  <label>: <n>` y, **solo si `n > 0`**, una línea por ítem con cuatro espacios de
   indentación. Nunca se omite la línea del contador, ni cuando `n` es 0.

`ingest` — orden de líneas fijo:

```
ok [ingest] work/catalog.json
  assets: aroll=1 broll=1 image=1 audio=1
  transcribed: 1 (reused 0)
  probe-failures: 0
  transcription-failures: 0
```

Los cuatro roles se imprimen siempre, en el orden `aroll broll image audio`, incluso en 0. La línea
`  stale-catalog-replaced: yes` se agrega al final **solo** si `staleCatalogReplaced === true`. Con
fallos parciales (RN-27: exit code sigue siendo 0):

```
ok [ingest] work/catalog.json
  assets: aroll=1 broll=2 image=1 audio=1
  transcribed: 1 (reused 0)
  probe-failures: 1
    raw/broll/clip09.mp4
  transcription-failures: 1
    raw/aroll/clip02.mp4 (transcribe)
```

`plan`:

```
ok [plan] work/timeline.json
  edl: work/edl.json
  edited-duration-ms: 18540
  transcription-source: catalog
  concepts: 2
    comando
    deploy
  broll-overlays: 3
  broll-rejections: 1
    deploy@12400ms punch-in-overlap
```

Los términos de `concepts` van en el orden en que los devuelve `spotConcepts` (ya determinista); las
rejections en el orden de `AutoMontageResult.brollRejections`. RN-28: nada de esto cambia el exit
code.

`render`:

```
ok [render] out/smoke-ingest.mp4
  format: 1080x1920@30
  frames: 556
```

`format` es `<width>x<height>@<fps>`; `frames` es `durationInFrames`. Son exactamente los cuatro
datos que pide la CA de HU-19 para `render`, y los mismos cuatro que `ffprobe` verifica en §7.

`run` — **la concatenación exacta de los tres arrays, en orden, sin cabecera propia, sin separador
y sin línea en blanco**:

```ts
formatReport(runReport) === [
  ...formatReport(runReport.ingest),
  ...formatReport(runReport.plan),
  ...formatReport(runReport.render),
];
```

Eso hace que la salida de `run` sea, byte a byte, la de `ingest && plan && render`. Es RN-21 vuelto
aserción de test, y es el test que hay que escribir: una igualdad entre el `formatReport` del
`RunReport` y la concatenación de los tres.

---

## 5. Errores y exit codes

### 5.1 Jerarquía

```ts
// src/errors/render-cli-error.ts
export type Stage = 'ingest' | 'plan' | 'render';

export type RenderCliErrorCode = 'CLI_USAGE' | 'CLI_ARGUMENT' | 'STAGE_INPUT_MISSING' | 'STAGE_FAILED';

export abstract class RenderCliError extends Error {
  abstract readonly code: RenderCliErrorCode;
  abstract readonly stage: Stage | null;
  abstract readonly resource: string | null;
  abstract readonly reason: string;
  abstract readonly expected: string | null;
  abstract readonly hint: string | null;
}

export function isRenderCliError(value: unknown): value is RenderCliError;
```

`expected` y `hint` extienden los cuatro miembros que enumera D-26 porque las decisiones posteriores
los exigen y no tenían dónde vivir: `hint` lo usa D-28 (`'corré \`ingest\` antes de \`plan\`'`) y
`expected` es lo que hace cumplible la CA de HU-16 ("el mensaje incluye el valor recibido **y** la
lista de los cuatro valores válidos") sin meter la lista dentro del texto libre de `reason`. Ambos
son `string | null`, nunca `undefined`, para que la exhaustividad del formateo sea verificable por
tipo.

Las cuatro concretas:

| clase | `code` | `stage` | `resource` típico | `expected` | `hint` |
| ----- | ------ | ------- | ----------------- | ---------- | ------ |
| `CliUsageError` | `CLI_USAGE` | **siempre `null`** | el token ofensor (`rnder`, `--preset`) o `null` | la lista cerrada de comandos u opciones | `null` |
| `CliArgumentError` | `CLI_ARGUMENT` | por `stageForArgument` (D-27) | `--preset=fast`, `--seed=-1` | la forma o el conjunto esperado | `null` |
| `StageInputMissingError` | `STAGE_INPUT_MISSING` | la etapa que necesita el insumo | `raw`, `work/catalog.json`, `work/timeline.json` | `null` | la etapa previa a correr |
| `StageFailedError` | `STAGE_FAILED` | la etapa donde falló la lib | ruta o id del asset | `null` | `null` |

`StageFailedError` es el único que lleva `cause`, y `cause` es siempre el error tipado de la lib
(`AutoMontageError` o `MediaLocalError` o `RenderTimelineError`); su `reason` es el `code` de ese
error, no una cadena inventada. `translateLibError` es quien lo construye, leyendo
`isAutoMontageError` / `isMediaLocalError` sobre la raíz de cada jerarquía y **nunca**
`instanceof` clase por clase (D-31).

### 5.2 Etapa → error → exit code

Tabla consolidada de D-26 y D-27. `exitCodeFor` la implementa y su spec la recorre fila por fila.

| exit | comando | situación | error emitido | `reason` |
| ---- | ------- | --------- | ------------- | -------- |
| `0` | los 4 | éxito de la etapa o de las tres | — | — |
| `2` | — | sin comando | `CliUsageError`, `stage: null` | `missing-command` |
| `2` | — | comando desconocido | `CliUsageError`, `stage: null` | `unknown-command` |
| `2` | los 4 | falta el posicional | `CliUsageError`, `stage: null` | `missing-project-root` |
| `2` | los 4 | posicional de más | `CliUsageError`, `stage: null` | `unexpected-positional` |
| `2` | `ingest`, `render` | `--preset` o `--seed` presentes | `CliUsageError`, `stage: null` | `unexpected-option` |
| `2` | los 4 | opción desconocida (`ERR_PARSE_ARGS_UNKNOWN_OPTION`) | `CliUsageError`, `stage: null` | `unknown-option` |
| `2` | `plan`, `run` | falta `--preset` | `CliArgumentError`, stage `plan` | `missing-preset` |
| `2` | `plan`, `run` | `--preset` fuera de `PRESET_NAMES` | `CliArgumentError`, stage `plan` | `unknown-preset` |
| `2` | `plan`, `run` | `--seed` no es entero ≥ 0 | `CliArgumentError`, stage `plan` | `invalid-seed` |
| `3` | `ingest`, `run` | la raíz del proyecto no existe | `StageInputMissingError`, stage `ingest` | `project-root-not-found` |
| `3` | `ingest`, `run` | no existe `raw/` | `StageInputMissingError`, stage `ingest` | `raw-missing` |
| `3` | `ingest`, `run` | `raw/` sin subcarpeta de rol | `StageInputMissingError`, stage `ingest` | `raw-has-no-role-directory` |
| `3` | `plan` | falta `work/catalog.json` | `StageInputMissingError`, stage `plan` | `catalog-missing` |
| `3` | `render` | falta `work/timeline.json` | `StageInputMissingError`, stage `render` | `timeline-missing` |
| `4` | `ingest`, `run` | `resolveBinaries` falla | `StageFailedError`, stage `ingest` | `BINARY_NOT_FOUND` |
| `4` | `ingest`, `run` | error tipado de `ingestProject` | `StageFailedError`, stage `ingest` | `PROJECT_LAYOUT_INVALID`, `CATALOG_UNREADABLE`, `PATH_ESCAPES_PROJECT`, `READ_ONLY_RAW_PATH`, `COMMAND_FAILED`, `UNPARSEABLE_OUTPUT` |
| `5` | `plan`, `run` | error tipado de `autoMontage` | `StageFailedError`, stage `plan` | `MONTAGE_INPUT_INVALID`, `EDL_INVALID`, `TIMELINE_INVALID`, `CATALOG_UNREADABLE` |
| `6` | `render`, `run` | `work/timeline.json` ilegible o no valida contra `TimelineSchema` | `StageFailedError`, stage `render` | `TIMELINE_UNREADABLE` |
| `6` | `render`, `run` | error de `renderTimeline` | `StageFailedError`, stage `render` | `INVALID_TIMELINE`, `BUNDLE_FAILED`, `COMPOSITION_NOT_FOUND`, `RENDER_FAILED` |
| `1` | los 4 | error **no tipado** que escapó de una lib | ninguno: `exitCodeFor` devuelve 1 para cualquier `unknown` | — |

Notas de lectura:

- Las filas de `run` no agregan códigos: `run` hereda el exit code de la etapa que falló. Ningún
  error lleva jamás `stage: 'run'` (RN-21).
- `CATALOG_UNREADABLE` aparece en dos etapas con dos exit codes distintos, y está bien: es el mismo
  error de lib en dos momentos distintos del pipeline, y lo que el dev necesita saber es en cuál de
  los dos apareció.
- `TIMELINE_UNREADABLE` es un `reason` propio de la CLI, no un código de lib: cubre el JSON roto y
  el JSON que parsea pero no valida contra `TimelineSchema`, dos cosas que `renderTimeline` nunca
  llega a ver porque la CLI lee el archivo antes.
- `probeFailures`, `transcriptionFailures` y `brollRejections` **no aparecen en esta tabla** y esa
  ausencia es normativa: son datos del reporte, no errores (RN-27, RN-28, decisión funcional 3).

### 5.3 Formato normativo del mensaje de error

`formatCliError(error: unknown): readonly string[]` — puro, y **afirmable por igualdad exacta**.
Escribe a stderr; nunca toca `error.stack` (RNF-7, reforzado por lint en §2.5).

Cabecera, una sola línea, según el tipo:

| caso | cabecera |
| ---- | -------- |
| error con `stage` | `error [<stage>] <reason>` |
| `CliUsageError` (`stage: null`) | `error [uso] <reason>` |
| valor no tipado | `error [interno] <ErrorName>: <message>` (D-26) |

Después, en este orden y **solo si el campo no es `null`**, con dos espacios de indentación:

```
  recurso: <resource>
  esperado: <expected>
  causa: <cause.message>
  sugerencia: <hint>
```

`causa` sale del `message` del `cause` cuando existe; para un `StageFailedError` es el mensaje del
error tipado de la lib, que ya trae ruta o id de asset y está en castellano. Para el camino no
tipado (exit 1) es el `message` del `cause` del `Error`, si lo hay.

Formas exactas, una por familia — estos son los strings que los tests afirman:

```
error [uso] unknown-command
  recurso: rnder
  esperado: ingest | plan | render | run
```

```
error [uso] unexpected-option
  recurso: --preset
  esperado: render no recibe --preset ni --seed
```

```
error [plan] unknown-preset
  recurso: --preset=fast
  esperado: software-demo | hardware | recipe | educational
```

```
error [plan] invalid-seed
  recurso: --seed=-1
  esperado: entero no negativo
```

```
error [plan] catalog-missing
  recurso: work/catalog.json
  sugerencia: corré `ingest` antes de `plan`
```

```
error [render] timeline-missing
  recurso: work/timeline.json
  sugerencia: corré `plan` antes de `render`
```

```
error [ingest] BINARY_NOT_FOUND
  recurso: whisper-cli
  causa: No se encontró el binario "whisper-cli".
```

```
error [render] BUNDLE_FAILED
  recurso: out/smoke-ingest.mp4
  causa: Remotion no pudo bundlear el entry point.
```

```
error [interno] TypeError: Cannot read properties of undefined (reading 'assets')
```

Cada uno de estos bloques cumple RN-26 por construcción: la cabecera trae etapa y causa
(`reason`), y `recurso` trae el recurso afectado cuando lo hay. El único bloque sin etapa real es
`[uso]`, y solo aparece cuando todavía no hay comando válido del cual derivar una (ver la nota N-2
de §9).

---

## 6. Cableado de D-4 en `aroll-series.tsx`

### 6.1 El diff

Un solo archivo, una sola línea. `libs/composition-remotion/src/components/aroll-series.tsx`,
línea 44, dentro de `ArollScene`:

```diff
 function ArollScene({ scene }: { scene: VideoSequenceProps }) {
-  const style = punchInStyle(scene.transform);
+  const style = punchInStyle(scene.transform, scene.transform.anchor);
```

Nada más de esa lib se toca: ni el barrel, ni `vite.config.ts`, ni el README, ni ningún otro
componente (HC-2).

### 6.2 Por qué compila y por qué hace lo que dice

Los tres eslabones están verificados en el código:

1. `ClipTransform = VideoClip['transform']` y `ClipTransformSchema` declara
   `anchor: PunchInAnchorSchema.optional()` — el campo existe en el tipo desde `cycle-02`.
2. `punchInStyle(transform: ClipTransform, anchor?: PunchInAnchor)` ya acepta el segundo parámetro y
   mapea `center → '50% 50%'`, `top → '50% 0%'`, `face-hint → '50% 33%'`, con
   `TRANSFORM_ORIGIN_BY_ANCHOR[anchor ?? 'center']`.
3. `buildTimeline` propaga `punch.anchor` **solo** al sub-rango con zoom
   (`build-timeline.ts:128,177`), verificado por
   `libs/timeline-core/src/timeline/build-timeline.spec.ts` → *"buildTimeline — anchor del punch-in
   (D-4)"*.

**Trampa descartada:** `tsconfig.lib.json` de `composition-remotion` tiene
`exactOptionalPropertyTypes: true`, y `scene.transform.anchor` es `PunchInAnchor | undefined`. No
rompe: `exactOptionalPropertyTypes` restringe **propiedades** opcionales, no **parámetros**
opcionales — un parámetro `anchor?: PunchInAnchor` acepta `undefined` explícito, y el
`?? 'center'` de `punchInStyle` lo absorbe. El comportamiento previo (sin anchor → `center`) se
conserva exactamente para los clips sin punch-in.

### 6.3 Cómo se verifica, dado HC-2

Tres verificaciones reales, ninguna que exija crear infraestructura de test nueva:

1. **`pnpm exec nx build composition-remotion`** — `tsc -p tsconfig.lib.json` con
   `exactOptionalPropertyTypes` y `strict`. Prueba que el segundo argumento es del tipo que
   `punchInStyle` espera. Es la verificación que atrapa el error más probable de este diff (pasar
   `scene.anchor` en vez de `scene.transform.anchor`).
2. **`pnpm exec nx test composition-remotion`** — `punch-in-style.spec.ts` ya cubre los tres anchors
   con igualdad exacta sobre `transformOrigin`. La función destino está probada; lo que el diff
   agrega es el cableado.
3. **El render real de CA-015 con `software-demo`** — es la única evidencia end-to-end de que el
   anchor llega al DOM. `softwareDemoPreset.punchIn.anchor` es **`face-hint`**, no `center`, así que
   el cableado tiene efecto visible: los sub-rangos con zoom escalan desde `50% 33%` en vez de desde
   el centro. Por eso D-35 exige que el material de smoke **produzca punch-ins**, y por eso §7.2 es
   un gate bloqueante antes de gastar el render: sin punch-ins, el paso 3 verifica exactamente nada.

**Lo que NO se hace y por qué.** No se crea `aroll-series.spec.tsx`. La razón real no es la que
anota el brief: `test.include` de `composition-remotion` ya es
`['src/**/*.spec.ts', 'src/**/*.spec.tsx']` y el entorno ya es `jsdom` con `@vitejs/plugin-react`,
así que un spec de componente **no obligaría** a tocar `vite.config.ts` (ver nota N-3 de §9). La
razón real es otra: `ArollScene` no está exportado, y montar `ArollSeries` requiere el contexto de
frame de Remotion y un `TransitionSeries` funcionando bajo jsdom — ese harness **sí** es
infraestructura de test nueva, y en un archivo nuevo dentro de una lib que otra rama está
reescribiendo. El costo/riesgo no se justifica para un diff de un argumento que `tsc` ya valida.

---

## 7. Procedimiento de smoke CA-015 / CA-016

Manual, una sola vez, al final del ciclo, en la máquina del dev. Los pasos son literales y
copiables. Todo desde la **raíz del repo**.

> **Antes de empezar, verificar el entorno** (`echo $NX_WORKSPACE_ROOT_PATH` debe estar vacío o
> apuntar a este repo; si no, cualquier `nx` corre contra otro workspace sin dar error).

### 7.1 Preparar el material (D-35)

`media/smoke-ingest/raw/aroll/clip01.mp4` actual **no sirve**: 11 palabras sin un hueco ≥ 400 ms →
0 silencios → 1 keep → 0 punch-ins → D-4 no se ejercita. Se regenera con el script de D-35 (6
frases separadas por 900 ms de silencio). `media/video-01` y `media/video-02` no se tocan (HC-5).

```bash
# 1. regenerar el A-roll con el script de D-35 (§1.15), que deja el mp4 en
#    media/smoke-ingest/raw/aroll/clip01.mp4

# 2. huella de raw/ ANTES de todo — es la línea base de RN-31
find media/smoke-ingest/raw -type f ! -name '.DS_Store' -print0 \
  | sort -z | xargs -0 shasum -a 256 > /tmp/smoke-raw-before.txt
find media/smoke-ingest/raw -type f ! -name '.DS_Store' -exec stat -f '%N %m %z' {} \; \
  | sort > /tmp/smoke-raw-mtime-before.txt

# 3. partir de cero
rm -rf media/smoke-ingest/work media/smoke-ingest/out
```

### 7.2 Gate barato: `ingest` + `plan` antes de gastar el render (obligatorio)

Nunca en paralelo con nada (HC-4 / RN-32). Esta parte usa Whisper, así que Chrome no debe estar
corriendo.

```bash
pnpm nx run render-cli:cli -- ingest media/smoke-ingest
pnpm nx run render-cli:cli -- plan media/smoke-ingest --preset software-demo --seed 0
```

Verificar sobre `work/edl.json` **antes de renderizar**:

```bash
node -e "const e=require('./media/smoke-ingest/work/edl.json');console.log('keeps',e.keeps.length,'punchIns',e.punchIns.length,'transitions',(e.transitions??[]).length)"
node -e "const t=require('./media/smoke-ingest/work/timeline.json');console.log('anchors',t.tracks.aroll.filter(c=>c.transform.anchor!==undefined).length)"
```

**Bloqueante:** `punchIns` ≥ 1, `keeps` ≥ 6 y `anchors` ≥ 1. Si alguno da 0, **no se renderiza**: se
regenera el material y se repite §7.1–§7.2. Un render de ~19 s a 1080×1920 en una máquina de 16 GB
cuesta minutos; descubrir ahí que D-4 no se ejercitó es tirar ese costo.

### 7.3 Render real — CA-015

```bash
# memoria: HC-4. Esperar hasta que el nivel de presión sea 1 (normal).
memory_pressure | tail -3
sysctl -n kern.memorystatus_vm_pressure_level      # debe imprimir 1

# cerrar Whisper/ffmpeg si quedó algo vivo: nunca transcripción y render juntos (RN-32)
pgrep -l 'whisper|ffmpeg' || echo 'sin procesos de media activos'

pnpm nx run render-cli:cli -- render media/smoke-ingest
```

Verificación del MP4 (CA-015: se reproduce, y con las dimensiones del formato — `reels-9x16` →
1080×1920@30):

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt \
  -show_entries format=duration,format_name \
  -of json media/smoke-ingest/out/smoke-ingest.mp4
```

**Criterio de aceptación de CA-015:** `codec_name` = `h264`, `width` = 1080, `height` = 1920,
`r_frame_rate` = `30/1`, `pix_fmt` = `yuv420p`, `format_name` contiene `mp4`, `nb_frames` igual al
`frames` que imprimió el reporte de `render` (§4.3), y `duration` ≈ `nb_frames / 30` con tolerancia
de un frame. Además, abrirlo con un reproductor y confirmar visualmente que se reproduce y que los
punch-ins escalan desde el tercio superior (`face-hint`, §6.3), no desde el centro.

```bash
# evidencia de la primera corrida, para comparar en §7.4
mkdir -p /tmp/smoke-run1
cp media/smoke-ingest/out/smoke-ingest.mp4 /tmp/smoke-run1/
cp media/smoke-ingest/work/edl.json media/smoke-ingest/work/timeline.json /tmp/smoke-run1/
ffmpeg -v error -i /tmp/smoke-run1/smoke-ingest.mp4 -f framemd5 /tmp/smoke-run1/frames.md5
shasum -a 256 /tmp/smoke-run1/smoke-ingest.mp4 > /tmp/smoke-run1/mp4.sha
```

La copia es imprescindible: `outPath` es fijo (D-32) y la segunda corrida **sobrescribe** el MP4.

### 7.4 Repetición idempotente — CA-016

Una sola corrida más, esta vez con `run`, que es el comando que CA-016 nombra y que ejercita de paso
RN-21 y la concatenación de reportes de §4.3.

```bash
rm -rf media/smoke-ingest/work media/smoke-ingest/out

memory_pressure | tail -3
sysctl -n kern.memorystatus_vm_pressure_level      # 1 antes de arrancar

pnpm nx run render-cli:smoke      # run media/smoke-ingest --preset software-demo --seed 0
```

Comparaciones, con el criterio ya fijado en D-34 **antes** de correr nada:

```bash
# 1. EDL byte a byte — BLOQUEANTE
diff /tmp/smoke-run1/edl.json media/smoke-ingest/work/edl.json && echo 'edl OK'

# 2. Timeline módulo probedAt — BLOQUEANTE
diff <(grep -v '"probedAt"' /tmp/smoke-run1/timeline.json) \
     <(grep -v '"probedAt"' media/smoke-ingest/work/timeline.json) && echo 'timeline OK'

# 3. ffprobe idéntico — BLOQUEANTE
diff <(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt -show_entries format=duration -of json /tmp/smoke-run1/smoke-ingest.mp4) \
     <(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt -show_entries format=duration -of json media/smoke-ingest/out/smoke-ingest.mp4) \
  && echo 'ffprobe OK'

# 4. framemd5 del contenido decodificado — BLOQUEANTE
ffmpeg -v error -i media/smoke-ingest/out/smoke-ingest.mp4 -f framemd5 /tmp/smoke-run2-frames.md5
diff /tmp/smoke-run1/frames.md5 /tmp/smoke-run2-frames.md5 && echo 'framemd5 OK'

# 5. shasum del MP4 — EVIDENCIA, NO BLOQUEANTE
shasum -a 256 media/smoke-ingest/out/smoke-ingest.mp4

# 6. raw/ intacto — BLOQUEANTE (RN-31)
find media/smoke-ingest/raw -type f ! -name '.DS_Store' -print0 \
  | sort -z | xargs -0 shasum -a 256 | diff - /tmp/smoke-raw-before.txt && echo 'raw contenido OK'
find media/smoke-ingest/raw -type f ! -name '.DS_Store' -exec stat -f '%N %m %z' {} \; \
  | sort | diff - /tmp/smoke-raw-mtime-before.txt && echo 'raw mtime OK'
```

**Por qué `shasum` del MP4 no es bloqueante y `framemd5` sí.** El contenedor MP4 escribe metadata de
encoding (entre otras cosas, el tag del encoder y, según build, marcas temporales) que puede variar
entre corridas sin que cambie un solo píxel. `framemd5` compara el flujo **decodificado** frame por
frame y muestra de audio por muestra: si da idéntico, el video es literalmente el mismo, que es lo
que RN-30 y la decisión funcional 6 piden ("el mismo video, no un video parecido"). El `shasum` se
registra como evidencia: si además da idéntico, mejor; si no, no es una falla.

**Si `framemd5` difiere, el ciclo NO cierra.** No se ajusta el criterio para que pase: se reporta al
dev con los dos hashes y el diff del `timeline.json`. La causa más probable sería una fuente de no
determinismo real en el pipeline, que es justamente lo que CA-016 existe para detectar.

Al terminar, dejar la evidencia (salidas de los seis pasos) en
`cycles/cycle-03/artifacts/smoke-ca015-ca016.md` y referenciarla en `cycle.json["artifacts"]`.

---

## 8. Trazabilidad

Decisión / sección → criterio de aceptación:

| Decisión / sección | CA-013 | CA-014 | CA-015 | CA-016 |
| ------------------ | :----: | :----: | :----: | :----: |
| D-21, D-22, §2.1–§2.3 (proyecto, tags, targets) | ✔ | | ✔ | |
| D-23, §4.2 (frontera de proceso, `CliOutcome`) | ✔ | | | |
| D-24, D-25, §4.1 (parseo, presets, seed) | ✔ | | | |
| D-26, D-27, §5.1–§5.2 (jerarquía y exit codes) | ✔ | | | |
| D-28, §3 (precondiciones por comando) | ✔ | | | |
| D-29, §3.4 (`run` compone y re-lee del disco) | ✔ | | ✔ | ✔ |
| D-30, §4.2 (puerto `TimelineRenderer`) | ✔ | ✔ | | |
| D-31 (`resolveBinaries` perezoso) | ✔ | | | |
| D-32, §3.3 (`publicDir` y `outPath`) | | ✔ | ✔ | ✔ |
| D-33, §6 (cableado de D-4) | | | ✔ | |
| D-34, §7.4 (criterio de idempotencia) | | | | ✔ |
| D-35, §7.1–§7.2 (material de smoke y gate) | | | ✔ | ✔ |
| D-36, §2.3 (targets `cli` y `smoke`) | | | ✔ | ✔ |
| D-37, D-38, D-39, §2.2, §2.4 (cobertura, `jsx`, aliases) | ✔ | | | |
| D-40, §4.3, §5.3 (formatos normativos) | ✔ | | | |
| §7.3 (render real y verificación `ffprobe`) | | | ✔ | |

Decisión / sección → historia de usuario:

| HU | Dónde se resuelve |
| -- | ----------------- |
| HU-12 — `ingest` | §3.1, D-28 (`assertProjectIsIngestable`), D-31 (`resolveBinaries` perezoso) |
| HU-13 — `plan` | §3.2, D-28 (`assertCatalogExists`) |
| HU-14 — `render` | §3.3, D-30 (puerto propio), D-32 (`resolveRenderTarget`) |
| HU-15 — `run` | §3.4, D-29 (composición secuencial), §4.3 (concatenación de reportes) |
| HU-16 — preset y seed | §4.1 (orden de validación), D-25 (`PRESET_NAMES` + paridad), §5.3 (línea `esperado:`) |
| HU-17 — contrato de errores | §5.1, §5.2, §5.3, D-27 (etapa del argumento), §2.5 (lint contra `.stack`) |
| HU-18 — idempotencia | §7.4, D-34 (criterio), D-32 (`outPath` determinista) |
| HU-19 — salida informativa | §4.3 (`formatReport`), §4.2 (tipos del reporte), RN-27/RN-28 fuera de §5.2 |
| HU-20 — smoke end-to-end | §7 completo, D-35 (material), D-36 (target `smoke`), HC-4 en §7.3 |

---

## 9. Notas sobre inconsistencias detectadas en §1

Se dejan escritas, sin corregir §1 ni re-litigar ninguna D-x. Las tres son de forma, no de fondo:
ninguna cambia una decisión, y las tres tienen una lectura obvia que §2–§7 adopta explícitamente.

- **N-1 — `outcome.lines` no existe en `CliOutcome`.** El pseudocódigo de `main.ts` en D-23
  (§1.3) hace `outcome.lines.forEach(...)`, pero la interfaz `CliOutcome` declarada tres líneas
  más abajo tiene `stdout` y `stderr`, no `lines`. **Lectura adoptada:** la interfaz es la
  normativa; `lines` era taquigrafía del boceto. `main.ts` vuelca `outcome.stdout` a
  `process.stdout` y `outcome.stderr` a `process.stderr`, en ese orden, y copia
  `outcome.exitCode` a `process.exitCode`. En éxito `stderr` está vacío; en error `stdout` está
  vacío (§3, §5.3).

- **N-2 — `[uso]` es un token de etapa genérico, y la decisión funcional 5 los prohíbe.** D-26
  fija `stage: null` para `CliUsageError` y D-27 manda a `CliUsageError` los casos de
  `--preset`/`--seed` en `ingest`/`render` — casos en los que **sí** hay un comando invocado y por
  lo tanto una etapa derivable. La decisión funcional 5 del Funcional dice que un fallo de
  validación de argumentos se reporta "con la etapa del comando invocado, no con una etapa
  genérica". Con D-26 + D-27 tal como están, `render-cli render /p --preset x` imprime
  `error [uso] unexpected-option`, que es un token genérico. **Lectura adoptada:** se implementa
  D-26/D-27 literalmente (`[uso]`, exit 2), porque son las decisiones vigentes y el mensaje
  igualmente identifica el problema con precisión vía `recurso:` y `esperado:`. **Se reporta al
  reviewer:** si se quisiera alinear con la decisión funcional 5, el cambio mínimo sería enrutar
  `unexpected-option` sobre un comando conocido a `CliArgumentError` con la etapa de
  `stageForArgument` — es un fix acotado a `parse-cli-args.ts` y a una fila de §5.2, no un rediseño.
  No se aplica en este ciclo.

- **N-3 — la premisa del brief sobre el spec del componente es inexacta.** `d4_wiring` del brief
  afirma que crear un test para `aroll-series.tsx` "obligaría a tocar `vite.config.ts`". Verificado:
  `libs/composition-remotion/vite.config.ts` ya declara
  `include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx']`, `environment: 'jsdom'` y el plugin de React,
  así que un `aroll-series.spec.tsx` sería recogido sin editar ninguna config. La conclusión del
  brief (no crear el spec) **se mantiene igual**, pero por el motivo correcto, que está en §6.3:
  `ArollScene` no está exportado y montar `ArollSeries` exige el contexto de frame de Remotion. La
  cobertura sigue sin incluir `src/components/**` (`include: ['src/helpers/**/*.ts',
  'src/transitions/**/*.ts']`), así que el umbral de 80 de esa lib no se ve afectado por el diff de
  §6.1 en ningún sentido.

Y una precisión sobre el `known_surface` del brief, no sobre §1: `resolveBinaries` es **asíncrona**
(`resolveBinaries(env, opts?): Promise<ResolvedBinaries>`), aunque el brief la anota como si
devolviera el objeto directamente. D-31 ya la tipa bien como `() => Promise<ResolvedBinaries>`;
queda anotado para que el implementador no se sorprenda.

---

## 10. Addendum del Orquestador — cómo se ejecuta el binario: tres causas encadenadas

Anexado por el `sdd-orchestrator` después de cerrar `architect.md`. **Reescrito** tras el hallazgo
del carril paralelo (spec-003 / `FIX-e-burgos-001-001`, commit `fe5aa00`), que produjo el primer
render real del repo y destapó que la receta original de esta sección cubría solo un tercio del
problema. No cambia ninguna D-x; corrige el mecanismo de ejecución que D-36 daba por resuelto.

`nx run composition-remotion:smoke` **nunca** produjo un render desde `spec-001 cycle-03`. Fallaba
por **tres causas encadenadas, cada una escondida detrás de la anterior**: al arreglar la primera
aparecía la segunda, y al arreglar la segunda aparecía la tercera. `tools/render-cli` corre el mismo
camino y pisa las tres.

### 10.1 Causa 1 — el alias de tsconfig (ya resuelta en D-36, verificada)

Síntoma: `Cannot find module '../../libs/timeline-core/src'` a los ~400 ms, antes de bundlear.

No es que falte `tsconfig-paths`. El target de la lib declara `"cwd": "libs/composition-remotion"` y
no declara `SWC_NODE_PROJECT`, así que `@swc-node/register` levanta el `tsconfig.json` del proyecto
en vez del de la raíz. El mapping de ese tsconfig apunta al **directorio**
`../../libs/timeline-core/src`, y la resolución CJS de un directorio busca `package.json`/`index.js`
— nunca `index.ts`. El `paths` de `tsconfig.base.json` apunta al **archivo** `.../src/index.ts`.

**`render-cli` ya es inmune por construcción** — es exactamente la diferencia que §1.16 justifica al
decidir no usar `cwd` y fijar `SWC_NODE_PROJECT=tsconfig.base.json`. Verificado con los dos imports
reales de la CLI:

```bash
SWC_NODE_PROJECT=tsconfig.base.json node -r @swc-node/register tools/render-cli/src/main.ts
# -> resolveMediaProject y renderTimeline, ambos function; exit 0
```

El carril B necesitó un `tsconfig.smoke.json` dedicado para lo mismo porque su target sí tiene `cwd`.
Nosotros no. **No se agrega `tsconfig-paths` ni `tsx`: D-9 se sostiene.**

### 10.2 Causa 2 — `@swc-node/register` también registra loader de `.js`, y eso panica en el bundle

Síntoma: panic de Rust `miette graphical.rs: Formatting argument out of range` durante `bundle()`.

`@swc-node/register` no se limita a `.ts`/`.tsx`: reemplaza también `Module._extensions['.js']`. Al
bundlear, el webpack de Remotion hace `require()` de un build hook de terceros que la extensión
**Console Ninja de VSCode** inyecta en todo proceso Node de esta máquina. swc intenta compilar ese
`.js` ajeno y revienta. El carril B lo aisló por bisección: pasa con un entry trivial de Remotion, y
sin `-r @swc-node/register` el mismo `bundle()` funciona.

**Es un fallo de entorno de esta máquina, no del código** — pero es determinista acá y el smoke tiene
que correr acá.

**D-41 (decisión del orquestador) — `render-cli` replica el patrón `smoke-register.cjs`.**

Se crea `tools/render-cli/src/cli-register.cjs`, idéntico en espíritu al de la lib: guarda el loader
nativo de `.js`, registra swc-node, y se lo devuelve a Node, dejando a swc acotado a TypeScript.

```js
const Module = require('node:module');
const nodeJsLoader = Module._extensions['.js'];
require('@swc-node/register');
Module._extensions['.js'] = nodeJsLoader;
```

Los targets `cli` y `smoke` de §2.3 pasan de `-r @swc-node/register` a
`-r ./tools/render-cli/src/cli-register.cjs`, conservando `SWC_NODE_PROJECT=tsconfig.base.json` y
la ausencia de `cwd` (causa 1).

**Por qué este camino y no `nx build` + ejecutar `dist/`**, que era la otra opción sobre la mesa: el
target `build` es `tsc -p tsconfig.lib.json`, y `tsc` **no reescribe los `paths`** al emitir. El
`dist/` resultante seguiría pidiendo `@video-maker/auto-montage` como paquete, que no existe en
`node_modules` — habría que introducir un bundler solo para poder correr la CLI, lo que rompe D-9 y
agrega un artefacto intermedio entre el código y lo que el dev ejecuta. Cuatro líneas de `.cjs`
contra una cadena de build: no hay competencia. Además es el patrón **ya probado con un render real
en este repo**, no una apuesta.

### 10.3 Causa 3 — el webpack de Remotion no conoce los alias del workspace

Síntoma: el bundle falla al resolver `@video-maker/timeline-core` desde el entry point de Remotion.

`remotionRenderDeps.bundleProject` pasaba `webpackOverride: (config) => config` — la identidad. El
webpack de Remotion es un resolvedor **independiente** de tsconfig y de Vite, y nadie le había
declarado los alias. El carril B lo arregló dentro de `libs/composition-remotion/src/render.ts` con
`WORKSPACE_ALIASES` + `withWorkspaceAliases`, aplicado en `bundleProject`. **La firma pública no
cambia y `render.spec.ts` no se tocó.**

**Para este ciclo esto llega gratis**: `render-cli` consume `renderTimeline` a través de
`remotionRenderDeps`, así que el arreglo entra con el cherry-pick de `fe5aa00` sin que el tool
escriba una línea. **No lo re-implementes en `render-cli`** — y no toques `render.ts`, que HC-2
prohíbe.

### 10.4 La lección transversal

**Un alias de workspace hay que declararlo en cada resolvedor del stack, y son tres: tsconfig, Vite
y el webpack de Remotion.** Ninguno hereda del otro. Verde en `tsc` y verde en `vitest` no dicen
absolutamente nada sobre el tercero. `spec-005` (`apps/render-api`) hereda esta lección entera.

### 10.5 Criterios de verificación que este addendum vuelve obligatorios

1. **Compilar no es ejecutar, y ejecutar no es bundlear.** `nx build` y `nx lint` verdes no prueban
   nada sobre la resolución en runtime; que la CLI arranque y haga `await import()` del módulo de
   render no prueba nada sobre el bundle. Son tres verificaciones distintas.
2. **La task que introduzca `cli-register.cjs` verifica que el loader nativo de `.js` queda
   restaurado** — es comprobable en el acto y sin render:
   `node -r ./tools/render-cli/src/cli-register.cjs -e "console.log(require('node:module')._extensions['.js'].name)"`
   más la corrida de la CLI con exit 0.
3. **Diagnóstico de CA-015.** Si el render real falla, leer el síntoma antes de tocar nada:
   `Cannot find module` → causa 1 (`SWC_NODE_PROJECT` o un `cwd` colado en el target); panic de Rust
   con `miette` → causa 2 (el register `.cjs` no se está usando); fallo de resolución **dentro** del
   bundle → causa 3 (falta el cherry-pick de `fe5aa00`). Ninguna de las tres es Chrome ni memoria.

### 10.6 Corrección del criterio de memoria para CA-015 (reemplaza a HC-4 en su parte operativa)

`memory_pressure` en esta máquina reporta **nivel 2 (warn) de forma basal**, con Chrome, VSCode y el
compresor ocupando ~6,5 GB y 42 % libre, incluso sin un solo proceso de `ffmpeg`, `whisper` o Chrome
Headless. El carril B esperó 20 minutos a que bajara a nivel 1: no baja nunca. **Esperar `normal` es
esperar para siempre.**

Criterio corregido, que preserva la intención real de HC-4/RN-14 (que render y transcripción no
compitan por RAM):

```bash
pgrep -fl 'ffmpeg|whisper-cli|headless'   # tiene que no devolver nada
memory_pressure | head -5                  # >= 35 % libre
npx remotion browser ensure                # pre-descarga Chrome Headless Shell; acorta el render
```

Con eso se procede. Se mantiene intacto lo que sí importa de HC-4: **una sola corrida real, al final
del ciclo, y jamás render y transcripción en simultáneo.**

### 10.7 Estado del cherry-pick

`fe5aa00` toca `libs/composition-remotion/{project.json, tsconfig.smoke.json, src/smoke-register.cjs,
src/render.ts, README.md, .gitignore}`, más `sdd/fixes.json`, el fix doc de `spec-001`, el fragmento
de contexto de `composition-remotion` y el journal del fix. **Nada de eso colisiona con este ciclo**:
el único archivo de esa lib que `cycle-03` toca es `src/components/aroll-series.tsx` (§6, HC-2).
