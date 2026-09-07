# Architect — Cycle 2: Core Composition & Media Pipeline Engine (`libs/media-local`)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect
> **Contrato vinculante:** `spec-e-burgos-001-core-composition-media-pipeline.spec.md`
> (secciones "Wrappers locales (`libs/media-local`) — API pública", "Dependencias",
> CA-017 → CA-022, RNF-3, RNF-8)

Este ciclo crea una **lib Node de I/O acotada**: envuelve tres binarios externos (`ffprobe`,
`ffmpeg`, `whisper-cli`) detrás de un `CommandRunner` inyectable y convierte su salida a los
contratos ya cerrados en `@video-maker/timeline-core` (cycle-01). No hay base de datos, no hay
endpoints HTTP y no hay UI: las secciones "Cambios en schema" (§9) y "Contratos de API" (§10)
declaran explícitamente que **no aplican**.

Regla que gobierna todo el diseño y de la que se derivan casi todas las decisiones de abajo:
**en CI no corre ni un solo binario** (RN-9, RNF-3). Todo lo que ejecuta procesos vive detrás de
una interfaz de una sola función; todo lo que interpreta texto es puro y se prueba con fixtures.

---

## 1. Decisiones técnicas

### D-01 — Alias de import: `@video-maker/media-local`, sin `package.json` propio

**Decisión:** se replica exactamente lo que fijó D-01 de cycle-01. El alias es
`@video-maker/media-local`, declarado en `tsconfig.base.json → paths` apuntando a
`src/index.ts` (consumo por *source*, sin bundler ni artefacto en `dist/`).

**Cómo queda `tsconfig.base.json`** (edición **aditiva**: no se reordenan ni se tocan las
entradas existentes):

```json
"paths": {
  "@shared-utils": ["./libs/shared-utils/src/index.ts"],
  "@video-maker/timeline-core": ["./libs/timeline-core/src/index.ts"],
  "@video-maker/media-local": ["./libs/media-local/src/index.ts"]
}
```

- **La lib NO lleva `package.json`.** El repo trabaja con un único `package.json` raíz y
  dependencias hoisted; `timeline-core` cerró así y `execa` se instala en el root (§11).
- **Contingencia idéntica a cycle-01:** si `@nx/js:lib` de Nx 23 genera igualmente
  `libs/media-local/package.json`, **no se borra**; se le deja `"name": "@video-maker/media-local"`,
  `"version": "0.0.0"`, `"private": true`, `"type": "module"`, y `project.json` sigue declarando
  `"name": "media-local"` (project.json gana en Nx). Verificación obligatoria:
  `pnpm nx show projects` lista `media-local`.
- **`media-local` importa `timeline-core` por el alias público** (`@video-maker/timeline-core`),
  nunca por ruta relativa `../../timeline-core/src/...`: el import profundo saltearía el barrel y
  `@nx/enforce-module-boundaries` lo marca como error.

### D-02 — Scaffold, tags, boundary `type:util → [type:domain]` y targets explícitos

**Generación** (skill `scaffold-nx` §5, misma invocación que cycle-01):

```bash
pnpm nx g @nx/js:lib libs/media-local --bundler=none --unitTestRunner=vitest --linter=eslint
```

**Tags Nx (`project.json`):** `["scope:engine", "type:util"]` — literalmente los que declara la
spec en su grafo de dependencias.

**Boundary.** Hoy la regla del root tiene dos entradas (la que agregó cycle-01 más el comodín).
Este ciclo agrega **una sola línea**, entre ambas, sin tocar el resto de `eslint.config.mjs`:

```js
depConstraints: [
  { sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
  { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:domain'] },
  { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
]
```

`type:util` puede depender **solo** de libs `type:domain` — es decir, de `timeline-core` y de nada
más. El orden importa: las reglas específicas van antes del comodín, y `type:domain` queda primera
porque es la más restrictiva. La restricción es real y verificable: si mañana alguien importa
`composition-remotion` (`type:ui`) desde `media-local`, `pnpm nx lint media-local` falla.

**Targets de `project.json` — misma forma que `timeline-core`, sin target `schemas`:**

```json
{
  "name": "media-local",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/media-local/src",
  "projectType": "library",
  "tags": ["scope:engine", "type:util"],
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run --coverage --passWithNoTests", "cwd": "libs/media-local" }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/out-tsc/libs/media-local"],
      "options": { "command": "tsc -p tsconfig.lib.json", "cwd": "libs/media-local" }
    }
  }
}
```

- **Todos los targets son explícitos.** `nx.json` **no se toca**: cycle-01 ya sacó de ahí los
  plugins `@nx/vitest` (inferia `test` en modo *watch*, que cuelga `nx run-many -t test`) y
  `@nx/eslint/plugin` (target duplicado). Volver a agregarlos rompería el ciclo anterior.
- **`build` = `tsc -p tsconfig.lib.json`.** Cierra el follow-up #3 del `reviewer_report` de
  cycle-01: la lib no se bundlea, pero **sí** typechequea y emite `.d.ts` — Vitest no typechequea,
  así que sin este target un error de tipos no lo detecta nadie hasta el próximo ciclo.
- **No hay target `schemas`** ni script en `tools/`: esta lib no genera JSON Schema. El registro
  CJS (`node -r @swc-node/register …`) que documentó cycle-01 queda como referencia por si algún
  ciclo futuro agrega un script; **acá no se usa** y no se copia por inercia.

`tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` se copian de `timeline-core` con los
mismos flags (`declaration`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `verbatimModuleSyntax`; specs con `types: ["node", "vitest/globals"]`).
`noUncheckedIndexedAccess` vuelve a ser la decisión cara y correcta: todos los parsers recorren
arrays de `streams`, `words` y líneas de `stderr` por índice.

### D-03 — ESLint de la lib: qué se permite y qué se prohíbe, por archivo

Esta lib **sí** hace I/O, así que el lint de cycle-01 no sirve tal cual: acá el objetivo no es
prohibir Node, es **confinarlo**. `libs/media-local/eslint.config.mjs`:

```js
import baseConfig from '../../eslint.config.mjs';

const NODE_FS = ['node:fs', 'node:fs/promises', 'fs', 'fs/promises'];
const CHILD_PROCESS = ['node:child_process', 'child_process'];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'El reloj entra por Clock (src/clock.ts): probedAt es inyectable.' },
        { name: 'process', message: 'El entorno entra por parámetro (resolveBinaries(env)).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'media-local es determinista: nombres y rutas son explícitos.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner.' },
            { group: NODE_FS, message: 'El filesystem entra por los ports de src/fs/.' },
            { group: ['execa'], message: 'execa se importa solo en src/runner/execa-command-runner.ts.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'media-local es Node puro, sin UI.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/fs/**/*.ts', 'src/__fixtures__/**/*.ts', 'src/**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner.' },
      { group: ['react', 'react-dom', 'react/*'], message: 'media-local es Node puro, sin UI.' },
    ] }] },
  },
  {
    files: ['src/runner/execa-command-runner.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: CHILD_PROCESS, message: 'Usar execa, no child_process.' },
      { group: NODE_FS, message: 'El runner no toca el filesystem.' },
    ] }] },
  },
  { files: ['src/clock.ts'], rules: { 'no-restricted-globals': 'off' } },
  { files: ['src/**/*.spec.ts'], rules: { 'no-restricted-globals': 'off' } },
];
```

**Qué queda permitido y dónde:**

| Elemento | Permitido en | Por qué |
| -------- | ------------ | ------- |
| `node:path` | **todo `src/**`** | Es aritmética de strings, pura y determinista (`join`, `basename`, `delimiter`). No merece un port. |
| `node:fs` / `node:fs/promises` | `src/fs/**`, `src/__fixtures__/**`, `*.spec.ts` | Los dos únicos accesos reales al disco son ports (`BinaryLookup`, `ReadTextFile`), y las fixtures se leen del disco en tests. |
| `execa` | `src/runner/execa-command-runner.ts` | Único archivo que ejecuta procesos (D-06). Un `import { execa }` en un parser es un error de lint, no una discusión de review. |
| `Date` | `src/clock.ts` | Único reloj de la lib (D-11). `probedAt` se inyecta. |
| `node:child_process` | **ningún archivo** | Todo comando pasa por `CommandRunner`. |
| `react`, `react-dom` | **ningún archivo** | Lib Node; el React de la spec vive en `composition-remotion` (cycle-03). |
| `Math.random` | **ningún archivo** | Nada acá necesita azar: rutas de salida, `outBase` de whisper y ids son parámetros explícitos. No hay nombres de temporales autogenerados (D-13). |

`process.env` **no se lee nunca desde la lib**: `resolveBinaries` recibe un `NodeJS.ProcessEnv`
por parámetro (D-09). Es lo que hace que CA-021 sea testeable con un objeto literal.

### D-04 — Vitest: v8, umbral 80 %, entorno node

`libs/media-local/vite.config.ts` — idéntico en forma al de `timeline-core`, con el umbral que
pide RNF-2 para esta lib (80 %, no 85 %):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/media-local',
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/media-local',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/index.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

`src/fs/**` **queda dentro** de la cobertura y de hecho es el punto donde el porcentaje puede
sufrir: son las dos únicas funciones que no se ejercitan con fixtures. Se cubren con tests que las
apuntan a archivos reales **del propio repo** (`src/fs/read-text-file.spec.ts` lee una fixture;
`binary-lookup.spec.ts` chequea un archivo existente y uno inexistente). Eso es I/O de lectura
sobre el árbol de fuentes, no ejecución de binarios: no viola RN-9.

### D-05 — `CommandRunner`: una interfaz de un método, con `string` y no streams

```ts
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandOptions {
  cwd?: string;
  timeoutMs?: number;
}

export interface CommandRunner {
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
}
```

**Justificación de cada elección:**

1. **Un solo método.** Es la superficie mínima que hace falta para los seis comandos del ciclo y
   la que hace trivial la implementación de fixtures. La interfaz de la spec es exactamente esta.
2. **`stdout`/`stderr` como `string` completo, no streams.** Las salidas que consumimos son
   chicas y acotadas (JSON de ffprobe: ~4 KB; stderr de ffmpeg de un clip: decenas de KB) y los
   parsers necesitan el texto **entero** (el JSON de `loudnorm` aparece al final del stderr, y un
   silencio abierto se detecta por ausencia de una línea posterior). Un API de streams obligaría a
   bufferear igual en cada wrapper y volvería imposible una fixture de una línea. Progreso en vivo
   del render es un problema de `spec-005`, no de este ciclo.
3. **`args: readonly string[]`, nunca un string de shell.** Se pasa el array a `execa` sin shell:
   una ruta con espacios o comillas no puede romper ni inyectar nada, y el array es exactamente lo
   que los tests asertan (§4).
4. **`exitCode: number` siempre presente.** Un proceso que muere por señal o timeout no tiene
   `exitCode`; ese caso no devuelve un resultado, **lanza** (D-06). Así el tipo no obliga a los
   seis wrappers a chequear `undefined`.
5. **`opts` opcional con solo `cwd` y `timeoutMs`.** No se expone `env` a propósito: el entorno de
   los binarios no debe ser configurable desde acá (las rutas ya se resolvieron con
   `resolveBinaries`), y exponerlo abriría la puerta a que un wrapper lea `process.env` por atrás.

Cada wrapper aplica la misma política de exit code: `exitCode !== 0` → `CommandFailedError`. La
única excepción documentada es `ffmpeg … -f null -`, que en la práctica devuelve 0 aun cuando
imprime warnings; no se relaja nada para él.

### D-06 — `ExecaCommandRunner`: `reject: false`, `all: false`, `encoding: 'utf8'`

```ts
export interface ExecaCommandRunnerOptions {
  defaultTimeoutMs?: number;   // default 600_000 (10 min: un whisper de un clip largo)
  cwd?: string;
}

export class ExecaCommandRunner implements CommandRunner {
  constructor(opts?: ExecaCommandRunnerOptions);
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
}
```

Llamada exacta a `execa` (v10):

```ts
const result = await execa(bin, [...args], {
  reject: false,
  all: false,
  encoding: 'utf8',
  stripFinalNewline: false,
  cwd: opts?.cwd ?? this.cwd,
  timeout: opts?.timeoutMs ?? this.defaultTimeoutMs,
});
```

| Opción | Por qué |
| ------ | ------- |
| `reject: false` | Un exit code ≠ 0 **es un resultado**, no una excepción de transporte: el wrapper decide si es un error de dominio y arma el `CommandFailedError` con el comando y args que él conoce. Si `execa` lanzara, el mensaje sería el de `execa` y el `stderr` vendría recortado por su propio formateo. |
| `all: false` | `stdout` y `stderr` **no** se entrelazan. Es obligatorio: `parseFfprobeJson` lee `stdout` puro (cualquier warning mezclado rompería `JSON.parse`) y `parseSilenceDetect`/`parseLoudnormJson` leen `stderr` puro. |
| `encoding: 'utf8'` | Devuelve `string` y no `Buffer`; el JSON de whisper.cpp y los nombres de archivo con acentos dependen de esto. |
| `stripFinalNewline: false` | El texto que llega al parser es **byte por byte** el que grabamos en la fixture; sin esto, fixture y realidad divergen en un `\n`. |
| `timeout` / `cwd` | Opcionales por llamada, con default de constructor. Un `whisper-cli` colgado no puede bloquear un proceso para siempre. |

**Mapeo de fallas de spawn** (el proceso nunca llegó a terminar por su cuenta):

```
si result.exitCode es un número        → { stdout, stderr, exitCode }
si no y result.code === 'ENOENT'       → throw BinaryNotFoundError({ binary: bin })
si no                                  → throw CommandFailedError({ command: bin, args,
                                              exitCode: SPAWN_FAILURE_EXIT_CODE (-1),
                                              stderr: result.stderr || result.message })
```

`ENOENT` se traduce a `BinaryNotFoundError` porque es literalmente el mismo problema que detecta
`resolveBinaries` (CA-021), solo que un instante más tarde: quien lo atrapa quiere el mismo tipo.
Un timeout (`result.timedOut`) cae en la segunda rama con `exitCode: -1` y el `stderr` parcial —
que es la información útil para diagnosticar (RNF-8).

### D-07 — `FixtureCommandRunner`: matching **laxo**, aserción **exacta**

```ts
export interface FixtureCall {
  bin: string;
  args: readonly string[];
  opts?: CommandOptions;
}

export interface FixtureResponse {
  stdout?: string;      // default ''
  stderr?: string;      // default ''
  exitCode?: number;    // default 0
}

export interface FixtureRoute {
  bin: string;                                  // 'ffprobe' | 'ffmpeg' | 'whisper-cli' o ruta completa
  argsPattern?: readonly (string | RegExp)[];   // subsecuencia obligatoria, en orden
  response: FixtureResponse | ((call: FixtureCall, index: number) => FixtureResponse);
}

export class FixtureCommandRunner implements CommandRunner {
  constructor(routes: readonly FixtureRoute[]);
  readonly calls: readonly FixtureCall[];
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
  callsFor(bin: string): readonly FixtureCall[];
  reset(): void;
}
```

**La decisión de diseño está en separar dos cosas que suelen colapsarse en una:**

1. **El *matching* es laxo.** `bin` matchea si es igual al `bin` recibido **o** a su `basename`
   (así una fixture escribe `'ffmpeg'` y el test puede pasar `/opt/homebrew/bin/ffmpeg`).
   `argsPattern` se busca como **subsecuencia en orden** dentro de `args`: cada entrada (string
   exacto o `RegExp.test`) debe aparecer, en ese orden, pero pueden existir otros argumentos entre
   medio. Las rutas se evalúan **en orden de declaración y gana la primera** que matchea.
2. **La aserción es exacta.** El test no verifica los argumentos a través del matching: los
   verifica sobre `runner.calls`, que guarda `bin`, `args` y `opts` **literales** de cada llamada,
   en orden. Ese es el mecanismo con el que CA-020 comprueba el filtro de la segunda pasada y con
   el que §4 se vuelve verificable.

Si el matching fuera exacto, cada test tendría la lista de argumentos escrita **dos veces** (en la
ruta y en la aserción) y el día que cambie un flag habría que editar las dos, con el riesgo real
de que la aserción se "arregle" copiando la ruta. Con matching laxo, la ruta expresa *qué comando
es* (`['-af', /^loudnorm=.*measured_I=/]` = "la segunda pasada") y la aserción expresa *cómo se
invocó*. Son preguntas distintas y se responden en lugares distintos.

**Si ninguna ruta matchea, `run` lanza** un `Error` (no un `CommandFailedError`: es un fallo del
test, no del dominio) con el `bin`, los `args` recibidos y la lista de rutas declaradas. Un
*fallthrough* silencioso devolviendo `{ stdout: '', exitCode: 0 }` haría que un wrapper roto
pareciera pasar; acá el test explota y dice exactamente qué comando no estaba previsto.

`FixtureCommandRunner` vive en `src/runner/` (no en `src/__fixtures__/`) y **se exporta desde
`src/index.ts`**: es parte del contrato público de testing de la lib —`libs/auto-montage` y
`apps/render-api` de las specs siguientes van a testear contra él sin instalar ffmpeg.

### D-08 — Errores tipados: una jerarquía de tres, con `code` discriminante

```ts
export type MediaLocalErrorCode = 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT';

export abstract class MediaLocalError extends Error {
  abstract readonly code: MediaLocalErrorCode;
}
export function isMediaLocalError(value: unknown): value is MediaLocalError;

export class BinaryNotFoundError extends MediaLocalError {
  readonly code = 'BINARY_NOT_FOUND';
  readonly binary: string;                       // 'ffprobe' | 'ffmpeg' | 'whisper-cli' | 'whisper-model'
  readonly envVar?: string;                      // 'FFPROBE_PATH' … (ausente en el ENOENT de D-06)
  readonly searchedPaths: readonly string[];     // [] cuando viene de ENOENT
  constructor(init: { binary: string; envVar?: string; searchedPaths?: readonly string[] });
}

export class CommandFailedError extends MediaLocalError {
  readonly code = 'COMMAND_FAILED';
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;                       // últimos 2048 bytes (RNF-8)
  readonly stderrTruncated: boolean;
  constructor(init: { command: string; args: readonly string[]; exitCode: number; stderr: string });
}

export class UnparseableOutputError extends MediaLocalError {
  readonly code = 'UNPARSEABLE_OUTPUT';
  readonly command: string;                      // 'ffprobe' | 'ffmpeg:silencedetect' | 'ffmpeg:loudnorm' | 'whisper.cpp' | 'faster-whisper'
  readonly reason: string;                       // español, incluye el detalle de Zod si lo hubo
  readonly sample: string;                       // primeros 512 chars de la salida ofensora
  constructor(init: { command: string; reason: string; sample: string; cause?: unknown });
}

export const STDERR_MAX_BYTES = 2048;
export const SAMPLE_MAX_CHARS = 512;
export function truncateStderr(stderr: string): { text: string; truncated: boolean };
```

**Truncado de `stderr` (CA-022, RNF-8) — el detalle que se hace mal:**

- Se conservan los **últimos** 2048 **bytes** (no caracteres): RNF-8 dice "los últimos 2 KB", y la
  información de un ffmpeg que falla está al final, no al principio.
- El corte se hace sobre `Buffer.from(stderr, 'utf8').subarray(-STDERR_MAX_BYTES)`. Cortar por
  bytes puede partir un carácter multibyte al inicio: al decodificar aparece `�` y se
  **descarta ese primer carácter**. Sin esto, un stderr con acentos produce un carácter basura y
  cualquier comparación de strings en un test se vuelve frágil.
- **No se agrega ningún marcador** (`"…"`, `"[truncated]"`) dentro de `stderr`: la aserción de
  CA-022 es `Buffer.byteLength(err.stderr, 'utf8') <= 2048` y un marcador la rompería o la
  volvería aproximada. El hecho de que hubo truncado viaja en `stderrTruncated: boolean`.
- El `message` del error (lo que ve un humano en la consola) sí es legible y compuesto:
  `` `El comando ${command} ${args.join(' ')} terminó con código ${exitCode}.` ``. La ruta del
  binario **no** se recorta: saber que se ejecutó `/opt/homebrew/bin/ffmpeg` y no otro es la mitad
  del diagnóstico.

`sample` de `UnparseableOutputError` se recorta por **caracteres** (512) porque es texto para leer,
no un contrato de tamaño; e incluye el principio de la salida, que es donde está la pista (un
`ffprobe` que devolvió vacío, un JSON con `<html>` de un proxy, un `-inf` en `input_i`).

### D-09 — `resolveBinaries(env, opts?)`: precedencia env > PATH, con lookup **puro sobre el filesystem** (nunca `--version`)

```ts
export type BinaryName = 'ffmpeg' | 'ffprobe' | 'whisperCli' | 'whisperModel';

export const BINARY_ENV_VARS: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  ffprobe: 'FFPROBE_PATH',
  whisperCli: 'WHISPER_CPP_PATH',
  whisperModel: 'WHISPER_MODEL_PATH',
};

export const BINARY_COMMAND_NAMES: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: 'ggml-model',
};

export interface BinaryLookup {
  isExecutableFile(path: string): Promise<boolean>;
  isReadableFile(path: string): Promise<boolean>;
}
export const nodeBinaryLookup: BinaryLookup;

export interface ResolveBinariesOptions {
  lookup?: BinaryLookup;      // default nodeBinaryLookup
}

export interface ResolvedBinaries {
  ffmpeg: string;
  ffprobe: string;
  whisperCli: string;
  whisperModel: string;
}

export function resolveBinary(
  name: BinaryName,
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<string>;

export function resolveBinaries(
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<ResolvedBinaries>;
```

**Algoritmo de `resolveBinary(name, env)`** (CA-021):

```
envVar = BINARY_ENV_VARS[name]
candidate = env[envVar]
si candidate es un string no vacío:
    ok = (name === 'whisperModel') ? lookup.isReadableFile(candidate)
                                   : lookup.isExecutableFile(candidate)
    si ok  → devolver candidate                                  # PRECEDENCIA ABSOLUTA
    si no  → throw BinaryNotFoundError({ binary, envVar, searchedPaths: [candidate] })

si name === 'whisperModel' → throw BinaryNotFoundError({ binary: 'whisper-model',
                                envVar: 'WHISPER_MODEL_PATH', searchedPaths: [] })

dirs = (env.PATH ?? '').split(path.delimiter).filter(d => d !== '')
para cada dir en dirs, EN ORDEN:
    candidate = path.join(dir, BINARY_COMMAND_NAMES[name])
    si lookup.isExecutableFile(candidate) → devolver candidate
throw BinaryNotFoundError({ binary, envVar, searchedPaths: dirs.map(join) })
```

`resolveBinaries(env)` resuelve los cuatro en el orden fijo `ffprobe → ffmpeg → whisperCli →
whisperModel` y **lanza en el primero que falta** (mensaje: qué binario, qué variable lo fija y
dónde se buscó). Quien necesita uno solo llama `resolveBinary('ffprobe', env)` — es la razón de que
exista la función singular en vez de un `ResolvedBinaries` con campos opcionales que todos los
consumidores tendrían que chequear.

**Decisión pedida explícitamente: lookup `which`-like puro sobre `env.PATH` con `fs.access`, NO
`execa <bin> --version`.** Cuatro razones, cualquiera de ellas suficiente:

1. **RN-9 lo prohíbe.** `--version` **ejecuta un binario**. La regla de este ciclo es que la suite
   no ejecuta ninguno; una resolución que spawnea procesos no se puede testear sin violarla, y en
   una máquina sin ffmpeg el test sería no determinista (dependería de qué haya instalado el dev).
2. **No sirve para `WHISPER_MODEL_PATH`.** Un modelo `ggml-large-v3-turbo.bin` es un **archivo de
   datos**: no tiene `--version`, no es ejecutable. Con `--version` haría falta un segundo
   mecanismo solo para el modelo; con `fs.access` el mismo código resuelve los cuatro cambiando
   únicamente `X_OK` por `R_OK`.
3. **Costo y latencia.** Cuatro `spawn` (~50–300 ms cada uno en macOS, más si el binario carga
   Metal) en cada arranque, contra cuatro `stat`. `resolveBinaries` se llama por proceso, no por
   archivo, pero es gasto puro.
4. **Verificar la versión mínima es otro problema.** La spec pide `ffmpeg ≥ 6.0` y
   `whisper-cli ≥ 1.7`; eso es una comprobación de *entorno*, no de *resolución*, y va en el README
   como paso manual del smoke (§8, regla 10). Mezclarlas haría que un ffmpeg 5.1 presente en el
   PATH se reporte como "binario no encontrado", que es un diagnóstico falso.

`isExecutableFile` = `fs.promises.access(p, fs.constants.X_OK)` + `stat.isFile()`;
`isReadableFile` = `access(p, R_OK)` + `isFile()`. Ambas devuelven `false` ante cualquier
excepción (no propagan `ENOENT`/`EACCES`), y son las **únicas** dos funciones de la lib que tocan
`node:fs` fuera de `ReadTextFile`.

**Alcance declarado:** el lookup es POSIX (macOS/Linux, que es el target de la spec). No se
implementa `PATHEXT` ni resolución de `.exe`; en Windows hay que fijar las cuatro variables de
entorno. Queda escrito en el README y en §13 (R-6).

### D-10 — Toda salida externa pasa por Zod **local**, y los parsers reciben **texto**

Principio 3 de la spec ("contrato conservador"): ninguna salida de un binario se mapea sin
validar. Dos consecuencias de diseño:

1. **Los schemas de las salidas crudas son de esta lib, no de `timeline-core`.**
   `FfprobeOutputSchema`, `LoudnormJsonSchema`, `WhisperCppJsonSchema` y `FasterWhisperJsonSchema`
   describen el **formato de una herramienta externa**, que puede cambiar con una versión de
   ffmpeg; los de `timeline-core` describen el **dominio**, que no. Mezclarlos ataría el contrato
   del motor a la versión de un binario. Estos schemas **no se exportan** desde `src/index.ts` y
   **no** generan JSON Schema commiteado (no hay target `schemas` en esta lib).
2. **Cada parser recibe el texto crudo, no un objeto ya parseado.** Firma `(<raw>: string, …)`.
   Motivos: es exactamente lo que devuelve `CommandRunner` (`stdout`/`stderr` son strings), lo que
   contiene una fixture en disco, y deja el `JSON.parse` **dentro** del parser, que es el único
   lugar donde se puede convertir un `SyntaxError` en un `UnparseableOutputError` con `command` y
   `sample`. Si el parser recibiera un objeto, el `JSON.parse` viviría duplicado en los seis
   wrappers y en cada test.

**Política de laxitud de los schemas externos:** `z.object` (no `strictObject`) y campos que no
usamos declarados como opcionales o directamente omitidos. ffprobe agrega campos entre versiones;
fallar porque apareció uno nuevo sería un bug nuestro. Se es estricto solo en **los campos que se
leen**: si `format.duration` no es un string parseable a número finito, es
`UnparseableOutputError`, no un `durationMs: NaN` que se filtra al dominio.

**Punto de contacto con el dominio:** todo parser termina con `Schema.safeParse` del contrato de
`timeline-core` (`MediaAssetSchema`, `TranscriptionSchema`); si falla, envuelve el error de Zod en
`UnparseableOutputError` con `reason` = `z.prettifyError(result.error)`. Nunca devuelve un objeto
sin validar y nunca completa un campo faltante con un valor inventado.

### D-11 — Reloj inyectado: `probedAt` es un parámetro, no un `new Date()`

`MediaAssetSchema` exige `probedAt: z.iso.datetime()`. Es el **único** dato del ciclo que no sale
de la salida de un binario, y por lo tanto la única puerta por la que se colaría el no-determinismo
que prohíbe RNF-4.

```ts
export interface Clock { nowIso(): string }
export const systemClock: Clock;    // src/clock.ts — ÚNICO uso de Date en la lib
```

- **El parser puro lo recibe obligatoriamente:** `parseFfprobeJson(raw, ctx)` con
  `ctx.probedAt: string` **requerido**. Un parser no puede leer el reloj ni por accidente: no
  compila.
- **El wrapper lo inyecta:** `probeMedia(path, runner, opts?)` usa
  `opts?.probedAt ?? (opts?.clock ?? systemClock).nowIso()`.
- Los tests pasan siempre un literal (`'2026-09-07T00:00:00.000Z'`), igual que los fixtures de
  `timeline-core` (§6.2 de cycle-01).

La regla se generaliza: **cualquier valor que no venga del binario entra por parámetro** — `id` del
asset, `path`, `probedAt`, rutas de salida, `outBase` de whisper. La lib no genera nombres.

### D-12 — Rotación: se normaliza a **grados horarios de display**; `side_data_list` manda sobre el tag `rotate`

FFmpeg expone la rotación de dos maneras incompatibles entre sí y ambas aparecen en la naturaleza:

| Fuente | Ejemplo (clip vertical de iPhone) | Convención |
| ------ | --------------------------------- | ---------- |
| `streams[].side_data_list[].rotation` (Display Matrix) | `-90` | grados **antihorarios** que aplica la matriz (ffmpeg ≥ 5, forma vigente) |
| `streams[].tags.rotate` | `"90"` | grados **horarios** de display (forma legacy, ya no la emite ffmpeg moderno pero sí muchos archivos y ffprobe la sigue reportando cuando está) |

**Decisión:** se normaliza todo a **rotación horaria de display** en `{0, 90, 180, 270}`, que es lo
que espera `MediaRotationSchema` de `timeline-core` y lo que significa "cómo se ve".

```
rotationFromSideData(raw) = ((-Math.round(raw) % 360) + 360) % 360
rotationFromTag(raw)      = ((Math.round(Number(raw)) % 360) + 360) % 360

resolveRotation(stream):
    si existe side_data_list con una entrada que tenga 'rotation' numérica
        → rotationFromSideData(esa entrada)          # PRECEDENCIA
    si no, si existe tags.rotate y Number(tags.rotate) es finito
        → rotationFromTag(tags.rotate)
    si no → 0
    si el resultado no está en {0, 90, 180, 270} → 0 y se ignora la rotación
```

Con el fixture de CA-017 (`side_data.rotation: -90` **y** `tags.rotate: "90"`, que es como los
escriben los iPhone) ambas fuentes dan **90**: el signo se resuelve en la conversión, no por
casualidad.

`side_data_list` tiene precedencia porque es la fuente que ffmpeg 6/7 escribe y la que refleja la
matriz real; el tag es un espejo legacy que algunos muxers dejan desactualizado.

**Intercambio de dimensiones (RN-2, CA-017):** si `rotation ∈ {90, 270}`, el `MediaAsset` reporta
`width = stream.height` y `height = stream.width`. El campo `rotation` **se conserva igual** en el
asset (no se pone en 0): quien después arme el filtergraph de render necesita saber que el archivo
en disco está rotado, mientras que todo el cálculo de safe zones y captions trabaja con las
dimensiones ya intercambiadas. Es aditivo y no contradice nada de cycle-01.

### D-13 — El filesystem de whisper se inyecta como **un tipo de función**, no como una clase

`whisper-cli -oj` **no imprime el JSON por stdout**: lo escribe en `<outBase>.json`. El wrapper
tiene que leer un archivo, y eso es I/O que en CI no puede ocurrir.

```ts
export type ReadTextFile = (path: string) => Promise<string>;
export const nodeReadTextFile: ReadTextFile;   // src/fs/read-text-file.ts
```

**Por qué una función y no una interfaz/clase** (a diferencia de `CommandRunner` y `BinaryLookup`):
es **un solo método sin estado y sin variantes**. Un `interface FileSystem { readTextFile() }`
obligaría a cada test a escribir `{ readTextFile: async () => json }` en vez de
`async () => json`, sin ganar nada. `CommandRunner` sí es interfaz porque tiene dos
implementaciones con comportamiento propio (registro de llamadas, matching) y porque es la pieza
que la spec nombra explícitamente; `BinaryLookup` sí es interfaz porque tiene dos métodos
(`isExecutableFile` / `isReadableFile`) que se implementan juntos.

Se inyecta por opciones: `transcribeWithWhisperCpp(wavPath, opts, runner)` con
`opts.readTextFile ?? nodeReadTextFile`. En el test de `transcribe.spec.ts` es
`async () => readFixture('whisper/whisper-cpp.json')`, y el `FixtureCommandRunner` devuelve
`{ stdout: '', exitCode: 0 }` para la llamada a `whisper-cli`: el wrapper queda cubierto sin tocar
el disco más allá de la propia fixture.

**El wrapper no borra el archivo de salida** ni crea directorios: `outBase` es responsabilidad de
quien llama (que es quien sabe si es un temporal o un artefacto que quiere conservar). Sin
`Math.random`, sin `os.tmpdir()`, sin efectos colaterales fuera del comando.

### D-14 — whisper.cpp con `-ml 1`: los tokens se agrupan en palabras por el espacio inicial

`-ml 1` (max-len 1) hace que **cada segmento del JSON sea un token**, no una palabra: el modelo
parte `muestro` en `" mues"` + `"tro"` y emite la puntuación como token propio (`"."`). Sin
agrupar, RN-6 y CA-019 se violan de las dos maneras posibles a la vez (fragmentos de palabra, y
distinta cantidad de palabras que Faster-Whisper).

**Regla de agrupación** (la que usa el propio tokenizador de Whisper: el espacio pertenece al token
que abre palabra):

```
groupTokensIntoWords(tokens):
    words = []
    para cada token en tokens, EN ORDEN:
        text = token.text
        si isSpecialToken(text) → continuar                    # descarte, no abre ni cierra palabra
        si text.trim() === ''   → continuar                    # token de solo espacio
        empiezaPalabra = /^\s/.test(text) || words está vacío
        si empiezaPalabra:
            words.push({ text: text.trim(), startMs: token.offsets.from, endMs: token.offsets.to })
        si no:
            last = words[words.length - 1]
            last.text  = last.text + text.trim()               # 'mues' + 'tro' → 'muestro'
            last.endMs = token.offsets.to                      # el fin es el del último token
    devolver words.filter(w => w.text !== '')

isSpecialToken(t) = /^\s*\[_[A-Z]+_[^\]]*\]\s*$/.test(t)       # [_BEG_], [_TT_350], [_EOT_]
```

**Casos borde fijados acá:**

- **El primer token de contenido nunca continúa nada:** aunque `[_BEG_]` haya sido descartado y el
  siguiente token no traiga espacio inicial, `words` está vacío y abre palabra.
- **La puntuación se pega a la palabra anterior** (`"completo"` + `"."` → `"completo."`), que es lo
  que hace Faster-Whisper y lo que permite que ambos motores devuelvan la misma cantidad de
  palabras (CA-019). `pickEmphasisIndex` de `timeline-core` ya normaliza puntuación, así que no
  molesta aguas abajo.
- **`endMs` de la palabra = `offsets.to` del último token que la compone**, no del primero.
- **Tokens especiales entre dos tokens de la misma palabra** no la parten: se descartan sin tocar
  el estado.
- **Se usa `offsets.from/to` (enteros en ms), no `timestamps.from/to` (`"HH:MM:SS,mmm"`).** Son el
  mismo valor; `offsets` ya está en la unidad del dominio y parsear el string agrega una vía de
  falla (coma vs punto decimal según locale de build) sin aportar precisión. `timestamps` se
  valida como opcional en el schema (para detectar un JSON que no es de whisper.cpp) y no se lee.
- Después de agrupar, **siempre** se aplica `normalizeTranscriptionWords` de `timeline-core` (lo
  dejó pedido el cierre de cycle-01) y recién entonces `TranscriptionSchema.safeParse`.

**`segments` del `Transcription` resultante:** con `-ml 1` la segmentación por frases se pierde
(cada segmento es un token). Emitir un segmento por token sería basura. **Decisión:**
`parseWhisperCppJson` emite **un único segmento** que cubre todas las palabras
(`wordRange: [0, words.length - 1]`, `text` = las palabras unidas por espacio, `startMs`/`endMs` =
extremos), y **cero segmentos** si no hay palabras (el invariante T4 exige `end < words.length`).
`parseFasterWhisperJson`, que sí conserva la segmentación, emite un segmento por entrada de
`segments[]`. CA-019 compara palabras, no segmentos — que es exactamente lo que dice el criterio.

### D-15 — Fixtures: `readFileSync` desde `import.meta.url`, no `resolveJsonModule`

**Decisión:** las fixtures se leen del disco como **texto**, con un único helper:

```ts
// src/__fixtures__/load-fixture.ts
export function readFixture(relativePath: string): string;   // readFileSync(new URL(rel, import.meta.url), 'utf8')
```

**Justificación:**

1. **Un solo mecanismo para todos los formatos.** `silencedetect.stderr.txt` y
   `loudnorm.stderr.txt` **no son JSON**: `resolveJsonModule` no los puede importar. Tener dos
   mecanismos (import para los `.json`, `readFileSync` para los `.txt`) es peor que tener uno.
2. **Los parsers reciben texto (D-10).** Si la fixture se importara como objeto, el test tendría
   que hacer `JSON.stringify` para volver a texto — y entonces estaría probando el parser contra
   una serialización **nuestra**, no contra los bytes que escribió ffprobe (distinto espaciado,
   distinto orden de claves, sin el `\n` final). La fixture pierde su valor de "salida real".
3. **No cambia la configuración de compilación.** `resolveJsonModule` altera lo que `tsc -p
   tsconfig.lib.json` emite y arrastra los `.json` a `dist/out-tsc`; las import attributes
   (`with { type: 'json' }`) son territorio movedizo entre TS ~6.0, `verbatimModuleSyntax` y el
   runner de Vitest. Cero de eso hace falta.
4. `readFixture` vive bajo `src/__fixtures__/`, que ya está excluido de cobertura y donde el lint
   permite `node:fs` (D-03).

**Los fixtures son salidas reales o reconstruidas fielmente del formato documentado.** Lo ideal es
grabarlas ejecutando los binarios una vez en la máquina del dev (macOS M2, ffmpeg 7.x, whisper.cpp
1.7) y commitear el texto tal cual. Cuando eso no sea posible, se reconstruyen respetando **al pie
de la letra** la forma real: claves y tipos de ffprobe (todos los números vienen como **string**),
prefijo `[silencedetect @ 0x…]` y `| silence_duration:` en el stderr, valores de `loudnorm` como
strings con dos decimales, y la estructura `transcription[].{timestamps,offsets,text}` de
whisper.cpp. Cada archivo lleva su procedencia anotada en el README de la lib (comando exacto que
lo generó), **no** en un comentario dentro del archivo.

### D-16 — Formato numérico determinista de los argumentos de `loudnorm`

Los argumentos de la segunda pasada son parte de una aserción de CA-020: si el número se formatea
de dos maneras distintas, el test es frágil. Se fijan dos funciones y no se usa `String(n)` ad hoc:

```ts
formatTargetValue(n)   = String(n)        //  -14 → "-14"    -1 → "-1"    11 → "11"
formatMeasuredValue(n) = n.toFixed(2)     //  -23.45 → "-23.45"   -5.2 → "-5.20"   -0.03 → "-0.03"
```

- Los **targets** (`I`, `TP`, `LRA`) vienen del `VoiceTarget` del dominio, son enteros por defecto
  (`-14`, `-1`, `11`) y se escriben sin decimales, como en la documentación de ffmpeg y como los
  escribe la spec (`I=-14:TP=-1:LRA=11`).
- Los **medidos** (`measured_*`, `offset`) se escriben con **dos decimales**, que es exactamente el
  formato con el que `loudnorm` los imprime (`"input_tp" : "-5.20"`). `toFixed(2)` sobre el número
  ya parseado hace el round-trip idéntico y elimina la ambigüedad de `-5.2` vs `-5.20`.
- El orden de las claves del filtro es **fijo** y está escrito en §4.4; no se arma iterando un
  objeto.

---

## 2. Estructura de `libs/media-local`

```
libs/media-local/
├── project.json                    name: "media-local", tags scope:engine/type:util, targets lint/test/build
├── tsconfig.json                   referencias a lib/spec
├── tsconfig.lib.json               include src/**/*.ts, exclude *.spec.ts, declaration: true
├── tsconfig.spec.json              include src/**/*.spec.ts, types: ["node", "vitest/globals"]
├── vite.config.ts                  Vitest + coverage v8 + thresholds 80
├── eslint.config.mjs               confinamiento de I/O (D-03)
├── README.md                       matriz de binarios, versiones mínimas, variables de entorno,
│                                   procedencia de cada fixture, smoke manual
└── src/
    ├── index.ts                    ÚNICA superficie pública (solo re-exports)
    ├── clock.ts                    Clock, systemClock              ← ÚNICO uso de Date
    ├── errors/
    │   ├── media-local-error.ts    MediaLocalError, MediaLocalErrorCode, isMediaLocalError
    │   ├── binary-not-found-error.ts   BinaryNotFoundError
    │   ├── command-failed-error.ts     CommandFailedError, truncateStderr, STDERR_MAX_BYTES
    │   ├── unparseable-output-error.ts UnparseableOutputError, SAMPLE_MAX_CHARS
    │   └── errors.spec.ts          bordes de truncado (multibyte, exactamente 2048)
    ├── runner/
    │   ├── command-runner.ts       CommandRunner, CommandResult, CommandOptions
    │   ├── execa-command-runner.ts ExecaCommandRunner   ← ÚNICO import de execa
    │   ├── fixture-command-runner.ts  FixtureCommandRunner, FixtureRoute, FixtureCall, FixtureResponse
    │   └── runner.spec.ts          CA-022
    ├── fs/
    │   ├── binary-lookup.ts        BinaryLookup, nodeBinaryLookup  ← node:fs
    │   ├── read-text-file.ts       ReadTextFile, nodeReadTextFile  ← node:fs/promises
    │   └── fs-ports.spec.ts        cobertura de los dos ports
    ├── binaries/
    │   ├── resolve-binaries.ts     BinaryName, BINARY_ENV_VARS, BINARY_COMMAND_NAMES,
    │   │                           resolveBinary, resolveBinaries, ResolvedBinaries
    │   └── binaries.spec.ts        CA-021
    ├── ffprobe/
    │   ├── ffprobe-output.schema.ts  FfprobeOutputSchema (Zod local, no exportado)
    │   ├── parse-ffprobe-json.ts   parseFfprobeJson, resolveRotation, parseRational
    │   ├── probe-media.ts          probeMedia, ProbeMediaOptions, FFPROBE_ARGS
    │   └── ffprobe.spec.ts         CA-017
    ├── ffmpeg/
    │   ├── parse-silence-detect.ts detectSilencesFromStderr → parseSilenceDetect
    │   ├── detect-silences.ts      detectSilencesWithFfmpeg, DetectSilencesWithFfmpegOptions,
    │   │                           DEFAULT_SILENCE_NOISE_DB, DEFAULT_SILENCE_MIN_MS
    │   ├── silencedetect.spec.ts   CA-018
    │   ├── loudnorm-output.schema.ts  LoudnormJsonSchema (Zod local, no exportado)
    │   ├── parse-loudnorm-json.ts  parseLoudnormJson, LoudnessMeasurement, extractTrailingJsonObject
    │   ├── measure-loudness.ts     measureLoudness
    │   ├── normalize-voice.ts      normalizeVoice, buildLoudnormFilter, NormalizeVoiceResult
    │   ├── loudnorm.spec.ts        CA-020
    │   ├── extract-audio.ts        extractAudioForTranscription
    │   └── extract-audio.spec.ts
    ├── whisper/
    │   ├── whisper-cpp-output.schema.ts     WhisperCppJsonSchema (Zod local)
    │   ├── faster-whisper-output.schema.ts  FasterWhisperJsonSchema (Zod local)
    │   ├── build-transcription.ts  buildTranscription (words+segments → Transcription validada)
    │   ├── parse-whisper-cpp-json.ts    parseWhisperCppJson, groupTokensIntoWords
    │   ├── parse-faster-whisper-json.ts parseFasterWhisperJson
    │   ├── transcribe-with-whisper-cpp.ts  transcribeWithWhisperCpp, TranscribeWithWhisperCppOptions
    │   ├── whisper-parsers.spec.ts CA-019
    │   └── transcribe.spec.ts      wrapper con FixtureCommandRunner + ReadTextFile
    └── __fixtures__/
        ├── load-fixture.ts         readFixture(relativePath): string   ← node:fs
        ├── ffprobe/
        │   ├── video-rotated.json  mp4 vertical de iPhone, rotate 90, con audio
        │   ├── image.json          jpg
        │   └── audio.json          wav mono 48 kHz
        ├── ffmpeg/
        │   ├── silencedetect.stderr.txt   3 silencios, el último abierto
        │   ├── loudnorm.stderr.txt        stderr completo de la 1.ª pasada
        │   └── loudnorm.json              solo el objeto JSON de esa pasada
        └── whisper/
            ├── whisper-cpp.json    -oj -ml 1, 12 tokens → 8 palabras
            └── faster-whisper.json word_timestamps=True, 8 palabras del MISMO audio
```

**Regla de superficie (idéntica a cycle-01):** `src/index.ts` contiene **exclusivamente**
`export { … } from './…'` y `export type { … } from './…'`. Los tests importan por **ruta
relativa** el módulo que prueban (así el barrel no oculta un export faltante); un único test de
superficie en `runner.spec.ts` verifica que `index.ts` exporte todos los nombres de la tabla de §3.
Los schemas Zod de salidas externas y las fixtures **no se exportan**.

---

## 3. API pública — firmas TypeScript completas

Todo lo de esta sección se exporta desde `src/index.ts`, y nada más. `Ms`, `AssetId`, `MediaAsset`,
`SilenceRange`, `Transcription`, `Word`, `VoiceTarget` se importan de
`@video-maker/timeline-core` y se **re-exportan como tipo** desde acá para que un consumidor no
tenga que importar dos paquetes para tipar una firma.

### 3.1 Runner y errores

```ts
export interface CommandResult { stdout: string; stderr: string; exitCode: number }
export interface CommandOptions { cwd?: string; timeoutMs?: number }
export interface CommandRunner {
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
}

export interface ExecaCommandRunnerOptions { defaultTimeoutMs?: number; cwd?: string }
export class ExecaCommandRunner implements CommandRunner { … }
export const SPAWN_FAILURE_EXIT_CODE = -1;

export interface FixtureCall { bin: string; args: readonly string[]; opts?: CommandOptions }
export interface FixtureResponse { stdout?: string; stderr?: string; exitCode?: number }
export interface FixtureRoute {
  bin: string;
  argsPattern?: readonly (string | RegExp)[];
  response: FixtureResponse | ((call: FixtureCall, index: number) => FixtureResponse);
}
export class FixtureCommandRunner implements CommandRunner {
  constructor(routes: readonly FixtureRoute[]);
  readonly calls: readonly FixtureCall[];
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
  callsFor(bin: string): readonly FixtureCall[];
  reset(): void;
}

export type MediaLocalErrorCode = 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT';
export abstract class MediaLocalError extends Error { abstract readonly code: MediaLocalErrorCode }
export class BinaryNotFoundError extends MediaLocalError { … }
export class CommandFailedError extends MediaLocalError { … }
export class UnparseableOutputError extends MediaLocalError { … }
export function isMediaLocalError(value: unknown): value is MediaLocalError;
export const STDERR_MAX_BYTES: 2048;
export const SAMPLE_MAX_CHARS: 512;
```

### 3.2 Binarios y reloj

```ts
export type BinaryName = 'ffmpeg' | 'ffprobe' | 'whisperCli' | 'whisperModel';
export const BINARY_ENV_VARS: Readonly<Record<BinaryName, string>>;
export const BINARY_COMMAND_NAMES: Readonly<Record<BinaryName, string>>;

export interface BinaryLookup {
  isExecutableFile(path: string): Promise<boolean>;
  isReadableFile(path: string): Promise<boolean>;
}
export const nodeBinaryLookup: BinaryLookup;

export interface ResolveBinariesOptions { lookup?: BinaryLookup }
export interface ResolvedBinaries { ffmpeg: string; ffprobe: string; whisperCli: string; whisperModel: string }

export function resolveBinary(name: BinaryName, env: NodeJS.ProcessEnv, opts?: ResolveBinariesOptions): Promise<string>;
export function resolveBinaries(env: NodeJS.ProcessEnv, opts?: ResolveBinariesOptions): Promise<ResolvedBinaries>;

export interface Clock { nowIso(): string }
export const systemClock: Clock;

export type ReadTextFile = (path: string) => Promise<string>;
export const nodeReadTextFile: ReadTextFile;
```

### 3.3 ffprobe

```ts
export interface ParseFfprobeContext {
  path: string;          // el que se guarda en MediaAsset.path
  probedAt: string;      // ISO 8601 — REQUERIDO (D-11)
  assetId?: AssetId;     // default: basename(path)
}
export function parseFfprobeJson(raw: string, ctx: ParseFfprobeContext): MediaAsset;

export interface ProbeMediaOptions {
  assetId?: AssetId;
  probedAt?: string;
  clock?: Clock;
  ffprobePath?: string;      // default 'ffprobe'
  runOptions?: CommandOptions;
}
export function probeMedia(path: string, runner: CommandRunner, opts?: ProbeMediaOptions): Promise<MediaAsset>;
```

### 3.4 ffmpeg — silencios

```ts
export const DEFAULT_SILENCE_NOISE_DB = -35;
export const DEFAULT_SILENCE_MIN_MS = 500;

export interface ParseSilenceDetectContext { durationMs: Ms }
export function parseSilenceDetect(stderr: string, ctx: ParseSilenceDetectContext): SilenceRange[];

export interface DetectSilencesWithFfmpegOptions {
  durationMs: Ms;            // REQUERIDO: cierra el silencio abierto al final (RN-3, CA-018)
  noiseDb?: number;          // default -35
  minMs?: Ms;                // default 500
  ffmpegPath?: string;       // default 'ffmpeg'
  runOptions?: CommandOptions;
}
export function detectSilencesWithFfmpeg(
  path: string,
  opts: DetectSilencesWithFfmpegOptions,
  runner: CommandRunner,
): Promise<SilenceRange[]>;
```

`durationMs` es **obligatorio** y no se deriva internamente con un `probeMedia` extra: el llamador
ya sondeó el archivo (es el paso anterior del pipeline) y hacerlo dos veces sería un spawn
gratuito. Además vuelve la función testeable sin encadenar dos comandos.

### 3.5 ffmpeg — loudness

```ts
export interface LoudnessMeasurement {
  integratedLufs: number;    // input_i
  truePeakDbtp: number;      // input_tp
  loudnessRange: number;     // input_lra
  thresholdLufs: number;     // input_thresh
  targetOffsetDb: number;    // target_offset
}
export function parseLoudnormJson(text: string): LoudnessMeasurement;

export interface MeasureLoudnessOptions {
  target?: VoiceTarget;      // default DEFAULT_VOICE_TARGET
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}
export function measureLoudness(
  path: string,
  runner: CommandRunner,
  opts?: MeasureLoudnessOptions,
): Promise<LoudnessMeasurement>;

export const DEFAULT_VOICE_TARGET: VoiceTarget;   // { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 }

export function buildLoudnormFilter(target: VoiceTarget, measured?: LoudnessMeasurement): string;

export interface NormalizeVoiceResult {
  outputPath: string;
  measured: LoudnessMeasurement;
  filter: string;            // el filtro exacto de la 2.ª pasada
}
export interface NormalizeVoiceOptions {
  sampleRate?: number;       // default 48000
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}
export function normalizeVoice(
  path: string,
  out: string,
  target: VoiceTarget,
  runner: CommandRunner,
  opts?: NormalizeVoiceOptions,
): Promise<NormalizeVoiceResult>;
```

`measureLoudness` devuelve **cinco** campos y no los tres que enumera la spec: `thresholdLufs` y
`targetOffsetDb` son insumo obligatorio de la segunda pasada (CA-020 los exige en el filtro).
Es una **ampliación aditiva** del contrato de la spec (los tres campos originales están y con el
mismo nombre); queda declarada en §13 (R-1). `VoiceTarget` es el tipo de `timeline-core`
(`AudioMixPlan.voice`), tal como pide la spec — no se define uno propio.

### 3.6 ffmpeg — extracción de audio

```ts
export interface ExtractAudioOptions {
  sampleRate?: number;       // default 16000
  channels?: number;         // default 1
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}
export function extractAudioForTranscription(
  path: string,
  out: string,
  runner: CommandRunner,
  opts?: ExtractAudioOptions,
): Promise<string>;          // devuelve `out`, para encadenar con transcribeWithWhisperCpp
```

### 3.7 whisper

```ts
export interface ParseTranscriptionOptions {
  language?: string;         // override; si falta se usa el del JSON
  model?: string;            // override; si falta se usa el del JSON cuando exista
}
export function parseWhisperCppJson(raw: string, assetId: AssetId, opts?: ParseTranscriptionOptions): Transcription;
export function parseFasterWhisperJson(raw: string, assetId: AssetId, opts?: ParseTranscriptionOptions): Transcription;

export interface TranscribeWithWhisperCppOptions {
  modelPath: string;         // REQUERIDO (resolveBinary('whisperModel', env))
  outBase: string;           // REQUERIDO: whisper-cli escribe `${outBase}.json`
  assetId: AssetId;          // REQUERIDO: va al Transcription
  language?: string;         // default 'auto'
  whisperPath?: string;      // default 'whisper-cli'
  readTextFile?: ReadTextFile;   // default nodeReadTextFile
  runOptions?: CommandOptions;
}
export function transcribeWithWhisperCpp(
  wavPath: string,
  opts: TranscribeWithWhisperCppOptions,
  runner: CommandRunner,
): Promise<Transcription>;
```

### 3.8 Re-exports de tipos de `timeline-core`

```ts
export type {
  AssetId, Ms, MediaAsset, MediaKind, SilenceRange, Transcription, TranscriptionEngine,
  VoiceTarget, Word,
} from '@video-maker/timeline-core';
```

Solo **tipos** (`export type`), nunca valores: re-exportar `MediaAssetSchema` desde acá crearía dos
caminos de import para el mismo objeto y confundiría de dónde viene el contrato.

---

## 4. Argumentos exactos de cada comando

Estas tablas son **normativas**: son lo que los tests asertan contra `runner.calls[i].args` con
`toEqual`, y lo que las `argsPattern` de las fixtures reconocen. El binario (`bin`) es siempre la
ruta resuelta o el default de la opción correspondiente; **nunca** se arma un string de shell.

Convención común de los comandos de `ffmpeg`: se anteponen `-hide_banner` y `-nostats` para que el
`stderr` que se parsea no traiga la cabecera de compilación ni las líneas de progreso
(`frame= … time= …`), que son ruido puro para los regex y engordan las fixtures. **No** se baja el
`loglevel`: `silencedetect` y `loudnorm` imprimen a nivel *info*; un `-v error` los haría
desaparecer y los parsers no verían nada.

### 4.1 `probeMedia` → `ffprobe`

| # | Argumento |
| - | --------- |
| 0 | `-v` |
| 1 | `quiet` |
| 2 | `-print_format` |
| 3 | `json` |
| 4 | `-show_format` |
| 5 | `-show_streams` |
| 6 | `<path>` |

```ts
export const FFPROBE_ARGS = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams'] as const;
// args = [...FFPROBE_ARGS, path]
```

Se lee **`stdout`** (con `-v quiet` el stderr queda vacío). `exitCode !== 0` → `CommandFailedError`.

### 4.2 `detectSilencesWithFfmpeg` → `ffmpeg` + `silencedetect`

| # | Argumento | Valor con los defaults |
| - | --------- | ---------------------- |
| 0 | `-hide_banner` | |
| 1 | `-nostats` | |
| 2 | `-i` | |
| 3 | `<path>` | |
| 4 | `-af` | |
| 5 | filtro | `silencedetect=noise=-35dB:d=0.5` |
| 6 | `-f` | |
| 7 | `null` | |
| 8 | `-` | |

Construcción del filtro: `` `silencedetect=noise=${noiseDb}dB:d=${minMs / 1000}` ``. `minMs = 500`
→ `d=0.5`; `minMs = 1000` → `d=1`. `noiseDb = -35` → `noise=-35dB`. Se lee **`stderr`**.

### 4.3 `measureLoudness` / `normalizeVoice` 1.ª pasada → `ffmpeg` + `loudnorm` (medición)

| # | Argumento | Valor con los defaults |
| - | --------- | ---------------------- |
| 0 | `-hide_banner` | |
| 1 | `-nostats` | |
| 2 | `-i` | |
| 3 | `<path>` | |
| 4 | `-af` | |
| 5 | filtro | `loudnorm=I=-14:TP=-1:LRA=11:print_format=json` |
| 6 | `-f` | |
| 7 | `null` | |
| 8 | `-` | |

`buildLoudnormFilter(target)` (sin `measured`) produce el filtro de la fila 5, en este orden fijo:
`I` → `TP` → `LRA` → `print_format=json`. Se lee **`stderr`** y se le aplica
`extractTrailingJsonObject`.

### 4.4 `normalizeVoice` 2.ª pasada → `ffmpeg` + `loudnorm` (aplicación) — **CA-020**

| # | Argumento | Valor con los defaults y la medición del fixture |
| - | --------- | ------------------------------------------------ |
| 0 | `-hide_banner` | |
| 1 | `-nostats` | |
| 2 | `-y` | sobrescribe el destino sin preguntar (no hay TTY) |
| 3 | `-i` | |
| 4 | `<path>` | |
| 5 | `-af` | |
| 6 | filtro | ver abajo |
| 7 | `-ar` | |
| 8 | `48000` | tasa interna de `loudnorm`; evita el resample implícito |
| 9 | `<out>` | |

`buildLoudnormFilter(target, measured)` produce, en **este orden exacto**:

```
loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.45:measured_TP=-5.20:measured_LRA=7.60:measured_thresh=-33.99:offset=-0.03:linear=true:print_format=json
```

- `I`, `TP`, `LRA` con `formatTargetValue`; `measured_*` y `offset` con `formatMeasuredValue`
  (D-16).
- `linear=true` fuerza la normalización **lineal** (una ganancia constante) en vez de la dinámica:
  es la que preserva la dinámica de la locución y la que tiene sentido con una medición previa.
  Si `loudnorm` decide internamente que no puede ser lineal, lo reporta como
  `normalization_type: dynamic` en el JSON de salida de esta pasada — se ignora, no altera el
  contrato.
- `print_format=json` también en la segunda pasada: deja en `stderr` la medición **resultante**,
  que es lo que un dev quiere ver para verificar el smoke manual.
- El **códec de salida no se fija**: lo determina la extensión de `out`. El README recomienda
  `.wav` (`pcm_s16le` implícito) para no re-comprimir la voz. Fijar `-c:a` acá impediría escribir
  un `.m4a` para el consumidor que lo quiera.

### 4.5 `extractAudioForTranscription` → `ffmpeg`

| # | Argumento | Valor con los defaults |
| - | --------- | ---------------------- |
| 0 | `-hide_banner` | |
| 1 | `-nostats` | |
| 2 | `-y` | |
| 3 | `-i` | |
| 4 | `<path>` | |
| 5 | `-vn` | descarta el video (el input puede ser un mp4) |
| 6 | `-ac` | |
| 7 | `1` | mono (RN-5) |
| 8 | `-ar` | |
| 9 | `16000` | 16 kHz — lo que exige whisper.cpp (RN-5) |
| 10 | `-c:a` | |
| 11 | `pcm_s16le` | |
| 12 | `<out>` | |

### 4.6 `transcribeWithWhisperCpp` → `whisper-cli`

| # | Argumento | Valor |
| - | --------- | ----- |
| 0 | `-m` | |
| 1 | `<modelPath>` | de `WHISPER_MODEL_PATH` |
| 2 | `-f` | |
| 3 | `<wavPath>` | el `out` de 4.5 |
| 4 | `-oj` | salida JSON a archivo |
| 5 | `-ml` | |
| 6 | `1` | un token por segmento (RN-6 vía D-14) |
| 7 | `-l` | |
| 8 | `<language>` | default `auto` |
| 9 | `-of` | |
| 10 | `<outBase>` | whisper-cli escribe `${outBase}.json` |

Tras un `exitCode === 0`, el wrapper **lee `${outBase}.json`** con `readTextFile` y se lo pasa a
`parseWhisperCppJson(raw, opts.assetId, { language, model: basename(modelPath) })`. Si la lectura
falla (`ENOENT`: whisper corrió pero no escribió), se traduce a `UnparseableOutputError` con
`command: 'whisper.cpp'`, `reason` que nombra el archivo esperado y `sample` = los últimos
caracteres del `stdout` — nunca se deja escapar el error crudo de `fs`.

`-l auto` está soportado por whisper.cpp y activa su detección de idioma. El idioma detectado sale
en el JSON y es el que termina en `Transcription.language` (§5.5).

---

## 5. Parsers: algoritmo, validación y casos borde

Convención: todos los tiempos del dominio son **enteros en milisegundos** (principio 1 de la spec).
Toda conversión desde segundos usa `Math.round(x * 1000)`; nunca `Math.floor` ni truncado de
strings.

### 5.1 `parseFfprobeJson` (CA-017)

**Schema local** (`FfprobeOutputSchema`, laxo por D-10; todos los numéricos de ffprobe llegan como
**string**):

```ts
const FfprobeStreamSchema = z.object({
  index: z.number().int(),
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  duration: z.string().optional(),
  sample_rate: z.string().optional(),
  channels: z.number().int().optional(),
  nb_frames: z.string().optional(),
  disposition: z.record(z.string(), z.number()).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  side_data_list: z.array(z.object({ rotation: z.number().optional() }).loose()).optional(),
});

const FfprobeOutputSchema = z.object({
  streams: z.array(FfprobeStreamSchema).default([]),
  format: z.object({
    filename: z.string().optional(),
    format_name: z.string().optional(),
    duration: z.string().optional(),
    tags: z.record(z.string(), z.string()).optional(),
  }).optional(),
});
```

**Algoritmo:**

```
parseFfprobeJson(raw, ctx):
    probe = JSON.parse(raw)                       # SyntaxError → UnparseableOutputError('ffprobe')
    out   = FfprobeOutputSchema.safeParse(probe)  # !success   → UnparseableOutputError('ffprobe')

    videoStream = primer stream con codec_type === 'video' y disposition.attached_pic !== 1
    audioStream = primer stream con codec_type === 'audio'
    kind = classifyKind(format.format_name, videoStream, audioStream)

    hasAudio = audioStream !== undefined
    audio    = audioStream && { sampleRate: Number(sample_rate), channels, codec: codec_name }

    si kind === 'image':
        asset = { id, kind: 'image', path, durationMs: 0, width, height, hasAudio: false, probedAt }
    si kind === 'video':
        rotation = resolveRotation(videoStream)                     # D-12
        swap     = rotation === 90 || rotation === 270
        asset = { id, kind: 'video', path,
                  durationMs: durationToMs(format.duration ?? videoStream.duration),
                  fps: parseRational(avg_frame_rate ?? r_frame_rate),
                  width:  swap ? videoStream.height : videoStream.width,
                  height: swap ? videoStream.width  : videoStream.height,
                  rotation, hasAudio, audio, videoCodec: videoStream.codec_name, probedAt }
    si kind === 'audio':
        asset = { id, kind: 'audio', path,
                  durationMs: durationToMs(format.duration ?? audioStream.duration),
                  hasAudio: true, audio, probedAt }

    return MediaAssetSchema.parse(asset)     # falla → UnparseableOutputError con prettifyError

classifyKind(formatName, videoStream, audioStream):
    si formatName matchea /(^|,)(image2|image2pipe|[a-z0-9]+_pipe)(,|$)/ → 'image'
    si videoStream existe y videoStream.nb_frames === '1' y
       parseRational(videoStream.avg_frame_rate) es undefined            → 'image'
    si videoStream existe                                                → 'video'
    si audioStream existe                                                → 'audio'
    si no → UnparseableOutputError('ffprobe', 'El archivo no tiene streams de video ni de audio.')

parseRational(text):        # '30/1' → 30 · '30000/1001' → 29.97002997… · '0/0' → undefined
    si text es undefined → undefined
    [num, den] = text.split('/')
    n = Number(num); d = den === undefined ? 1 : Number(den)
    si !isFinite(n) || !isFinite(d) || d === 0 || n <= 0 → undefined
    return n / d

durationToMs(text):
    n = Number(text)
    si !isFinite(n) || n < 0 → UnparseableOutputError('ffprobe', 'duration no numérica', sample)
    return Math.round(n * 1000)
```

**Casos borde fijados:**

- **`fps` no se redondea.** `30000/1001` → `29.97002997002997`; `MediaAssetSchema` lo acepta
  (`z.number().gt(0)`) y `msToFrames` de `timeline-core` trabaja con `Fps` cerrado —la conversión
  a 24/25/30/50/60 es decisión del consumidor, no de este parser, que reporta lo que dice el
  archivo.
- **Imagen:** `durationMs: 0` y `fps` **ausente** (no `undefined` explícito ni `0`): el
  `superRefine` de `MediaAssetSchema` rechaza ambas cosas. Con `exactOptionalPropertyTypes`, la
  propiedad directamente no se escribe.
- **Video sin `width`/`height`/`hasAudio`** → el `superRefine` del dominio lo rechaza y sale como
  `UnparseableOutputError`, no como un `MediaAsset` a medias.
- **Video con portada embebida** (`disposition.attached_pic === 1` en un mp3 con carátula): ese
  stream se ignora como video, así que el archivo se clasifica `audio`. Sin esta guarda, todo mp3
  con carátula sería un "video" sin fps.
- **Duración ausente en `format`** (algunos streams sin contenedor): se cae al `duration` del
  stream; si tampoco está, `UnparseableOutputError`.
- **`assetId` por defecto** = `basename(path)` (con extensión). Determinista y estable; quien
  quiera otro lo pasa por `ctx.assetId`.
- El campo `audio.integratedLufs` de `MediaAssetAudio` **no se completa acá**: lo produce
  `measureLoudness`, y rellenarlo con un valor inventado violaría el principio 3.

### 5.2 `parseSilenceDetect` (CA-018)

`ffmpeg` emite, en `stderr`, líneas como:

```
[silencedetect @ 0x7f9a4c704bc0] silence_start: 2.18
[silencedetect @ 0x7f9a4c704bc0] silence_end: 2.68 | silence_duration: 0.5
```

```
NUMBER = /-?\d+(?:\.\d+)?/
START  = /silence_start:\s*(-?\d+(?:\.\d+)?)/
END    = /silence_end:\s*(-?\d+(?:\.\d+)?)/

parseSilenceDetect(stderr, { durationMs }):
    ranges = []
    open   = undefined
    para cada línea de stderr.split(/\r?\n/):
        m = START.exec(línea)
        si m:
            si open !== undefined: ranges.push({ startMs: open, endMs: durationMs })   # start sin end previo
            open = clamp(Math.round(Number(m[1]) * 1000), 0, durationMs)
            continuar
        m = END.exec(línea)
        si m y open !== undefined:
            endMs = clamp(Math.round(Number(m[1]) * 1000), 0, durationMs)
            si endMs > open: ranges.push({ startMs: open, endMs })
            open = undefined
    si open !== undefined y open < durationMs:
        ranges.push({ startMs: open, endMs: durationMs })      # SILENCIO ABIERTO AL FINAL (RN-3)
    return ranges
```

**Casos borde fijados:**

- **Silencio abierto al final → se cierra en `durationMs`** (CA-018). Es el caso que importa: pasa
  siempre que el clip termina en silencio, porque ffmpeg no emite `silence_end` al llegar al EOF.
- **`silence_start` negativo** (ffmpeg reporta `-0.0184354` cuando el archivo arranca en silencio):
  se clampea a 0. Un `startMs` negativo rompe `SilenceRange` (`MsSchema` es `nonnegative`) y
  rompería `mergeSilences` de `timeline-core`.
- **`silence_end` mayor que `durationMs`** (redondeo del contenedor): se clampea a `durationMs`.
- **Rango degenerado** (`endMs <= startMs`) → se descarta; no se emiten rangos vacíos.
- **Dos `silence_start` seguidos sin `silence_end`** (no debería pasar, pero el parser no puede
  asumirlo): el primero se cierra en `durationMs`. Nunca se pierde silencio ni se solapan rangos.
- **`stderr` sin ninguna línea de `silencedetect`** → `[]`. Es un resultado válido (audio sin
  silencios), **no** un `UnparseableOutputError`: no hay forma de distinguirlo de un clip
  íntegramente hablado, y fallar acá rompería el caso feliz más común.
- El parser **no ordena ni fusiona**: emite los rangos en el orden en que aparecen, que ya es
  cronológico. Fusionar es trabajo de `mergeSilences` (`timeline-core`, CA-004) y duplicarlo acá
  sería dos implementaciones de la misma regla.
- Se parsea **línea por línea con `exec`**, no con un `matchAll` global sobre todo el texto:
  aparear `start` con `end` por posición en el texto es lo que hace correcto el caso del silencio
  abierto.

### 5.3 `parseLoudnormJson` (CA-020)

`loudnorm=print_format=json` imprime el objeto al **final del `stderr`**, después de todo el log.
Todos los valores son **strings**.

```ts
const LoudnormJsonSchema = z.object({
  input_i: z.string(),
  input_tp: z.string(),
  input_lra: z.string(),
  input_thresh: z.string(),
  target_offset: z.string(),
}).loose();
```

```
extractTrailingJsonObject(text):
    idx = índice de la ÚLTIMA línea que empieza con '{' (regex /^\s*\{/m, buscando desde el final)
    si no hay → undefined
    end = último '}' del texto
    si end < idx → undefined
    return text.slice(idx, end + 1)

parseLoudnormJson(text):
    json = extractTrailingJsonObject(text) ?? text.trim()
    obj  = JSON.parse(json)                     # error → UnparseableOutputError('ffmpeg:loudnorm')
    out  = LoudnormJsonSchema.safeParse(obj)    # error → UnparseableOutputError('ffmpeg:loudnorm')
    measurement = {
      integratedLufs: toFiniteNumber(out.input_i,      'input_i'),
      truePeakDbtp:   toFiniteNumber(out.input_tp,     'input_tp'),
      loudnessRange:  toFiniteNumber(out.input_lra,    'input_lra'),
      thresholdLufs:  toFiniteNumber(out.input_thresh, 'input_thresh'),
      targetOffsetDb: toFiniteNumber(out.target_offset,'target_offset'),
    }
    return measurement

toFiniteNumber(text, field):
    n = Number(text)
    si !Number.isFinite(n) → UnparseableOutputError('ffmpeg:loudnorm',
        `El campo ${field} no es un número finito (valor: "${text}").`, sample)
    return n
```

**Casos borde fijados:**

- **`"-inf"`** en `input_i`/`input_thresh` es lo que devuelve `loudnorm` sobre un audio **en
  silencio absoluto**. `Number("-inf")` es `NaN` → `UnparseableOutputError` con el campo y el
  valor. Es la decisión correcta: pasar `-Infinity` a la segunda pasada produce un filtro
  `measured_I=-Infinity` que ffmpeg rechaza, y "silencio" es un problema del usuario que hay que
  reportar, no completar con un valor por defecto.
- **El fallback `?? text.trim()`** hace que `parseLoudnormJson` acepte tanto el `stderr` completo
  como el objeto JSON pelado. Por eso hay dos fixtures (`loudnorm.stderr.txt` y `loudnorm.json`) y
  el test corre el mismo parser sobre ambas y compara con `toEqual`: la extracción es idempotente.
- **Un log que contenga `{` en una línea anterior** (rutas con llaves, otro filtro verboso): se
  busca la **última** apertura de línea, no la primera, y se cierra en el **último** `}`. La
  medición siempre es lo último que imprime ffmpeg.

### 5.4 `normalizeVoice` — las dos pasadas (CA-020, RN-4)

```
normalizeVoice(path, out, target, runner, opts):
    measured = await measureLoudness(path, runner, { target, ffmpegPath, runOptions })   # 1.ª pasada (4.3)
    filter   = buildLoudnormFilter(target, measured)                                     # D-16
    result   = await runner.run(ffmpegPath, [...args de 4.4], runOptions)                # 2.ª pasada
    si result.exitCode !== 0 → CommandFailedError(ffmpegPath, args, exitCode, result.stderr)
    return { outputPath: out, measured, filter }
```

**La segunda pasada nunca se arma con valores genéricos** (RN-4): `buildLoudnormFilter` recibe
`measured` y, si es `undefined`, produce el filtro de medición (sin ningún `measured_*` y sin
`linear`). No hay forma de emitir un filtro con `measured_I` inventado — el tipo no lo permite.
`NormalizeVoiceResult.filter` se devuelve al llamador justamente para que el test de CA-020 pueda
afirmar el string además de afirmar `runner.calls[1].args`.

### 5.5 `parseWhisperCppJson` (CA-019)

**Schema local:**

```ts
const WhisperCppSegmentSchema = z.object({
  timestamps: z.object({ from: z.string(), to: z.string() }).optional(),
  offsets: z.object({ from: z.number(), to: z.number() }),
  text: z.string(),
});
const WhisperCppJsonSchema = z.object({
  params: z.object({ model: z.string().optional(), language: z.string().optional() }).loose().optional(),
  result: z.object({ language: z.string().optional() }).loose().optional(),
  transcription: z.array(WhisperCppSegmentSchema),
}).loose();
```

```
parseWhisperCppJson(raw, assetId, opts):
    obj    = JSON.parse(raw)                          # → UnparseableOutputError('whisper.cpp')
    parsed = WhisperCppJsonSchema.safeParse(obj)      # → UnparseableOutputError('whisper.cpp')
    words  = groupTokensIntoWords(parsed.transcription)          # D-14
    language = opts?.language ?? parsed.result?.language ?? parsed.params?.language ?? 'es'
    model    = opts?.model ?? (parsed.params?.model && basename(parsed.params.model))
    return buildTranscription({ assetId, engine: 'whisper.cpp', language, model, words,
                                segments: singleSegment(words) })
```

`offsets.from/to` son enteros ≥ 0 en ms; se usan tal cual (D-14). Cada palabra sale **sin
`confidence`**: `-oj` (a diferencia de `-ojf`) no reporta probabilidad por token, y sintetizar una
sería inventar datos.

### 5.6 `parseFasterWhisperJson` (CA-019)

**Schema local:**

```ts
const FasterWhisperWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  probability: z.number().optional(),
});
const FasterWhisperJsonSchema = z.object({
  language: z.string().optional(),
  model: z.string().optional(),
  segments: z.array(z.object({
    start: z.number().optional(),
    end: z.number().optional(),
    text: z.string().optional(),
    words: z.array(FasterWhisperWordSchema).default([]),
  })),
}).loose();
```

```
parseFasterWhisperJson(raw, assetId, opts):
    obj    = JSON.parse(raw)                             # → UnparseableOutputError('faster-whisper')
    parsed = FasterWhisperJsonSchema.safeParse(obj)      # → UnparseableOutputError('faster-whisper')
    words = []; segments = []
    para cada segment de parsed.segments:
        first = words.length
        para cada w de segment.words:
            text = w.word.trim()
            si text === '' → continuar
            words.push({ text,
                         startMs: Math.max(0, Math.round(w.start * 1000)),
                         endMs:   Math.max(0, Math.round(w.end   * 1000)),
                         ...(w.probability !== undefined ? { confidence: clamp01(w.probability) } : {}) })
        si words.length > first:
            segments.push({ startMs: Math.round((segment.start ?? words[first].startMs/1000) * 1000),
                            endMs:   Math.round((segment.end   ?? last(words).endMs/1000)     * 1000),
                            text: segment.text?.trim() ?? words.slice(first).map(w => w.text).join(' '),
                            wordRange: [first, words.length - 1] })
    language = opts?.language ?? parsed.language ?? 'es'
    return buildTranscription({ assetId, engine: 'faster-whisper', language,
                                model: opts?.model ?? parsed.model, words, segments })
```

**Casos borde comunes a los dos parsers, resueltos en `buildTranscription`:**

```
buildTranscription({ assetId, engine, language, model, words, segments }):
    normalized = normalizeTranscriptionWords(words)            # timeline-core — SIEMPRE
    doc = { assetId, engine, language, words: normalized,
            segments: normalized.length === 0 ? [] : segments,
            ...(model !== undefined ? { model } : {}) }
    result = TranscriptionSchema.safeParse(doc)
    si !result.success → UnparseableOutputError(engine, z.prettifyError(result.error), sample)
    return result.data
```

- **`normalizeTranscriptionWords` siempre, antes de validar.** Es lo que dejó pedido el cierre de
  cycle-01: el `superRefine` de `TranscriptionSchema` **rechaza** solapes (D-08 de cycle-01) y el
  redondeo de segundos a ms de Faster-Whisper los produce con frecuencia (una palabra que termina
  en `2.1904` y la siguiente que arranca en `2.1901`).
- **Palabras vacías o de solo espacio se descartan** antes de armar nada (un token `" "` de
  whisper, un `word: ""` de faster-whisper).
- **Sin palabras → `segments: []`.** El invariante T4 (`end < words.length`) es insatisfacible con
  un segmento sobre cero palabras.
- **`language` que no matchea `^[a-z]{2}(-[A-Z]{2})?$`** (por ejemplo `"auto"` si el motor lo
  devolviera sin resolver): `TranscriptionSchema` falla y sale un `UnparseableOutputError` que
  nombra el campo. No se "arregla" recortando a dos letras.
- **`probability` fuera de `[0, 1]`** se clampea (`WordSchema.confidence` es `min(0).max(1)`).
- **`startMs > endMs` en una palabra** (redondeo patológico) no se corrige: lo rechaza T1 y sale
  como error tipado. Corregirlo en silencio escondería un JSON corrupto.

---

## 6. Fixtures: contenido exacto y cómo se cargan

Todas viven en `src/__fixtures__/` y se leen con `readFixture('<subdir>/<archivo>')` (D-15), que
devuelve el **texto** tal como está en disco. Su procedencia (comando que las generó, versión del
binario, máquina) se documenta en el README de la lib.

### 6.1 `ffprobe/video-rotated.json` — clip vertical de celular (CA-017, US-2-002)

Stream tal como lo graba el sensor (apaisado) + rotación de 90° horaria:

```json
{
  "streams": [
    { "index": 0, "codec_name": "h264", "codec_type": "video",
      "width": 1920, "height": 1080,
      "r_frame_rate": "30/1", "avg_frame_rate": "30/1",
      "duration": "10.000000", "nb_frames": "300",
      "disposition": { "attached_pic": 0 },
      "tags": { "rotate": "90" },
      "side_data_list": [ { "side_data_type": "Display Matrix", "rotation": -90 } ] },
    { "index": 1, "codec_name": "aac", "codec_type": "audio",
      "sample_rate": "48000", "channels": 2, "duration": "10.000000" }
  ],
  "format": { "filename": "aroll-cam-01.mp4", "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
              "duration": "10.000000" }
}
```

**`MediaAsset` esperado** (con `ctx.probedAt = '2026-09-07T00:00:00.000Z'`,
`ctx.path = '/fixtures/aroll-cam-01.mp4'`):

| Campo | Valor | Por qué |
| ----- | ----- | ------- |
| `id` | `'aroll-cam-01.mp4'` | default `basename(path)` |
| `kind` | `'video'` | hay stream de video no-`attached_pic` |
| `durationMs` | `10000` | `format.duration` × 1000, redondeado |
| `fps` | `30` | `avg_frame_rate` `"30/1"` |
| `width` | **`1080`** | `swap` porque `rotation === 90` → era `height` |
| `height` | **`1920`** | `swap` → era `width` |
| `rotation` | `90` | `side_data.rotation: -90` → 90 horario (D-12) |
| `hasAudio` | `true` | existe stream `audio` |
| `audio` | `{ sampleRate: 48000, channels: 2, codec: 'aac' }` | |
| `videoCodec` | `'h264'` | |
| `probedAt` | `'2026-09-07T00:00:00.000Z'` | inyectado |

Es **exactamente** el `arollAsset` que ya usa `timeline-core` en sus fixtures (§6.2 de cycle-01):
10 000 ms, 1080×1920, 30 fps, audio 48 kHz estéreo. Es deliberado — el asset que produce este
ciclo es el que consume el motor del anterior, y un cambio en cualquiera de los dos lados rompe
tests en los dos lados.

**Variante en el mismo test (no otra fixture):** el mismo objeto con `side_data_list` eliminado y
solo `tags.rotate: "90"` debe dar el **mismo** `MediaAsset` — es la aserción que prueba las dos
ramas de `resolveRotation`.

### 6.2 `ffprobe/image.json` — foto de apoyo (CA-017)

```json
{
  "streams": [
    { "index": 0, "codec_name": "mjpeg", "codec_type": "video",
      "width": 1290, "height": 1720,
      "r_frame_rate": "25/1", "avg_frame_rate": "0/0",
      "nb_frames": "1", "disposition": { "attached_pic": 0 } }
  ],
  "format": { "filename": "broll-shot-01.jpg", "format_name": "jpeg_pipe", "duration": "0.040000" }
}
```

**Esperado:** `kind: 'image'`, `durationMs: 0`, **sin `fps`**, `width: 1290`, `height: 1720`,
`hasAudio: false`. Es el caso que hace fallar a un parser ingenuo por partida triple: `format_name`
es `jpeg_pipe` (por eso se clasifica por formato antes que por streams), `avg_frame_rate` es
`"0/0"` (por eso `parseRational` devuelve `undefined` con `d === 0`) y `format.duration` es
`"0.040000"` ≠ 0 (por eso `durationMs` de una imagen se fuerza a 0 y no se calcula).

### 6.3 `ffprobe/audio.json` — locución (CA-017)

```json
{
  "streams": [
    { "index": 0, "codec_name": "pcm_s16le", "codec_type": "audio",
      "sample_rate": "48000", "channels": 1, "duration": "8.400000" }
  ],
  "format": { "filename": "voice-take-01.wav", "format_name": "wav", "duration": "8.400000" }
}
```

**Esperado:** `kind: 'audio'`, `durationMs: 8400`, `hasAudio: true`,
`audio: { sampleRate: 48000, channels: 1, codec: 'pcm_s16le' }`, **sin** `width`/`height`/`fps`/
`videoCodec`.

### 6.4 `ffmpeg/silencedetect.stderr.txt` — 3 silencios, el último abierto (CA-018)

Sobre el clip de 6.1 (`durationMs = 10000`):

```
[silencedetect @ 0x7f9a4c704bc0] silence_start: 2.18
[silencedetect @ 0x7f9a4c704bc0] silence_end: 2.68 | silence_duration: 0.5
[silencedetect @ 0x7f9a4c704bc0] silence_start: 3.86
[silencedetect @ 0x7f9a4c704bc0] silence_end: 4.66 | silence_duration: 0.8
[silencedetect @ 0x7f9a4c704bc0] silence_start: 8.72
```

**Esperado:** `[{ startMs: 2180, endMs: 2680 }, { startMs: 3860, endMs: 4660 },
{ startMs: 8720, endMs: 10000 }]` — 3 rangos, el último **cerrado en `durationMs`** porque no hay
`silence_end` después.

Los dos primeros rangos son, a propósito, **los mismos** que `detectSilencesFromWords` produce
sobre el fixture `spanishTranscription` de `timeline-core` (huecos de 500 y 800 ms, CA-003). Con
eso, el test de `mergeSilences` de la spec 002 tendrá dos fuentes reales que fusionar en vez de
números inventados.

### 6.5 `ffmpeg/loudnorm.stderr.txt` y `ffmpeg/loudnorm.json` (CA-020)

`loudnorm.json` es el objeto que imprime la primera pasada:

```json
{
	"input_i" : "-23.45",
	"input_tp" : "-5.20",
	"input_lra" : "7.60",
	"input_thresh" : "-33.99",
	"output_i" : "-14.03",
	"output_tp" : "-1.49",
	"output_lra" : "7.20",
	"output_thresh" : "-24.51",
	"normalization_type" : "dynamic",
	"target_offset" : "-0.03"
}
```

(El espaciado con tabulaciones y el ` : ` es el que emite ffmpeg; se conserva tal cual.)

`loudnorm.stderr.txt` es el `stderr` completo de esa corrida: las líneas de `Input #0`, el
`[Parsed_loudnorm_0 @ …]` y, al final, ese mismo objeto. El test corre `parseLoudnormJson` sobre
**las dos** fixtures y afirma `toEqual` entre ambos resultados.

**`LoudnessMeasurement` esperada:**
`{ integratedLufs: -23.45, truePeakDbtp: -5.2, loudnessRange: 7.6, thresholdLufs: -33.99,
targetOffsetDb: -0.03 }`.

### 6.6 `whisper/whisper-cpp.json` — 12 tokens → 8 palabras (CA-019)

Salida de `whisper-cli -oj -ml 1` sobre los primeros 3,7 s de la locución:

| # | `text` | `offsets.from` | `offsets.to` | efecto |
| - | ------ | -------------- | ------------ | ------ |
| 1 | `[_BEG_]` | 0 | 0 | descartado (D-14) |
| 2 | ` Hoy` | 0 | 300 | abre palabra 1 |
| 3 | ` te` | 350 | 500 | abre palabra 2 |
| 4 | ` mues` | 520 | 700 | abre palabra 3 |
| 5 | `tro` | 700 | 900 | **continúa** palabra 3 → `muestro` |
| 6 | ` cómo` | 1200 | 1550 | abre palabra 4 |
| 7 | ` edit` | 1570 | 1800 | abre palabra 5 |
| 8 | `ar` | 1800 | 2050 | **continúa** palabra 5 → `editar` |
| 9 | ` un` | 2070 | 2180 | abre palabra 6 |
| 10 | ` video` | 2680 | 3100 | abre palabra 7 |
| 11 | ` completo` | 3120 | 3620 | abre palabra 8 |
| 12 | `.` | 3620 | 3700 | **continúa** palabra 8 → `completo.` |

Cada entrada del JSON lleva además `timestamps: { from: "00:00:00,000", to: "00:00:00,300" }` (el
mismo valor formateado; se valida, no se lee) y el objeto trae
`params: { model: "/models/ggml-large-v3-turbo.bin", language: "es" }` y `result: { language: "es" }`.

**`Transcription` esperada:** `engine: 'whisper.cpp'`, `language: 'es'`,
`model: 'ggml-large-v3-turbo.bin'`, **8 palabras**, sin `confidence`, y **1 segmento** con
`wordRange: [0, 7]`:

| # | text | startMs | endMs |
| - | ---- | ------- | ----- |
| 1 | `Hoy` | 0 | 300 |
| 2 | `te` | 350 | 500 |
| 3 | `muestro` | 520 | 900 |
| 4 | `cómo` | 1200 | 1550 |
| 5 | `editar` | 1570 | 2050 |
| 6 | `un` | 2070 | 2180 |
| 7 | `video` | 2680 | 3100 |
| 8 | `completo.` | 3120 | 3700 |

Los tiempos son, otra vez, los de las 8 primeras palabras de `spanishTranscription` de
`timeline-core`: el hueco 2180 → 2680 es exactamente el silencio de 500 ms de CA-003.

### 6.7 `whisper/faster-whisper.json` — el MISMO audio (CA-019)

Formato de `faster-whisper` con `word_timestamps=True`, tiempos en **segundos**:

```json
{
  "language": "es",
  "duration": 3.7,
  "segments": [
    { "id": 0, "start": 0.0, "end": 3.695, "text": " Hoy te muestro cómo editar un video completo.",
      "words": [
        { "word": " Hoy",       "start": 0.0,   "end": 0.31,  "probability": 0.982 },
        { "word": " te",        "start": 0.35,  "end": 0.49,  "probability": 0.991 },
        { "word": " muestro",   "start": 0.518, "end": 0.905, "probability": 0.977 },
        { "word": " cómo",      "start": 1.2,   "end": 1.56,  "probability": 0.968 },
        { "word": " editar",    "start": 1.575, "end": 2.04,  "probability": 0.985 },
        { "word": " un",        "start": 2.07,  "end": 2.19,  "probability": 0.994 },
        { "word": " video",     "start": 2.68,  "end": 3.11,  "probability": 0.989 },
        { "word": " completo.", "start": 3.12,  "end": 3.695, "probability": 0.973 }
      ] }
  ]
}
```

**`Transcription` esperada:** `engine: 'faster-whisper'`, `language: 'es'`, **8 palabras** con
`confidence`, **1 segmento** con `wordRange: [0, 7]`:

| # | text | startMs | endMs | Δstart vs whisper.cpp | Δend vs whisper.cpp |
| - | ---- | ------- | ----- | --------------------- | ------------------- |
| 1 | `Hoy` | 0 | 310 | 0 | 10 |
| 2 | `te` | 350 | 490 | 0 | 10 |
| 3 | `muestro` | 518 | 905 | 2 | 5 |
| 4 | `cómo` | 1200 | 1560 | 0 | 10 |
| 5 | `editar` | 1575 | 2040 | 5 | 10 |
| 6 | `un` | 2070 | 2190 | 0 | 10 |
| 7 | `video` | 2680 | 3110 | 0 | 10 |
| 8 | `completo.` | 3120 | 3695 | 0 | 5 |

**Diferencia máxima: 10 ms** — holgadamente dentro del tope de **20 ms** que fija CA-019, y con
margen para que un ajuste menor de una fixture no vuelva el test un fósil. Ninguna palabra se
solapa con la siguiente después del redondeo (`310 ≤ 350`, `490 ≤ 518`, `905 ≤ 1200`,
`1560 ≤ 1575`, `2040 ≤ 2070`, `2190 ≤ 2680`, `3110 ≤ 3120`), así que
`normalizeTranscriptionWords` es un no-op sobre esta fixture — y eso también se afirma
explícitamente en el test, para que el día que deje de serlo alguien lo mire.

---

## 7. Verificación de los criterios de aceptación

### CA-017 — `parseFfprobeJson` con tres fixtures (`ffprobe.spec.ts`)

| Caso | Fixture | Aserciones |
| ---- | ------- | ---------- |
| Video rotado | `ffprobe/video-rotated.json` | `kind === 'video'`; `width === 1080 && height === 1920` (**ya rotados**, no 1920×1080); `rotation === 90`; `fps === 30`; `durationMs === 10000`; `hasAudio === true`; `audio.channels === 2` |
| Misma fixture sin `side_data_list`, solo `tags.rotate: "90"` | derivada por spread en el test | `MediaAsset` **idéntico** al anterior |
| Misma fixture con `rotation: 0` y sin tag | derivada por spread | `width === 1920 && height === 1080`, `rotation === 0` — la prueba de que el swap no es incondicional |
| Imagen | `ffprobe/image.json` | `kind === 'image'`; `durationMs === 0`; `'fps' in asset === false`; `hasAudio === false`; `width === 1290` |
| Audio | `ffprobe/audio.json` | `kind === 'audio'`; `durationMs === 8400`; `audio.sampleRate === 48000`; `audio.channels === 1`; `'width' in asset === false` |
| JSON inválido (`'no soy json'`) | inline | lanza `UnparseableOutputError` con `command === 'ffprobe'` y `sample` no vacío |
| `probeMedia` | `FixtureCommandRunner` con ruta `{ bin: 'ffprobe', response: { stdout: readFixture(...) } }` | `runner.calls[0].args` `toEqual` la tabla §4.1; `asset.probedAt === '2026-09-07T00:00:00.000Z'` (inyectado, no del reloj real) |

### CA-018 — `parseSilenceDetect` (`silencedetect.spec.ts`)

| Caso | Aserciones |
| ---- | ---------- |
| Fixture `silencedetect.stderr.txt` con `durationMs: 10000` | devuelve **3** rangos; `toEqual([{2180,2680},{3860,4660},{8720,10000}])`; el último `endMs === durationMs` |
| `silence_start: -0.018` al inicio | `startMs === 0` (clamp) |
| `stderr` vacío | `[]`, sin lanzar |
| `detectSilencesWithFfmpeg` con `FixtureCommandRunner` | `runner.calls[0].args` `toEqual` la tabla §4.2 con `silencedetect=noise=-35dB:d=0.5`; resultado idéntico al del parser |
| `noiseDb: -40, minMs: 1000` | el filtro es `silencedetect=noise=-40dB:d=1` |
| `exitCode: 1` en la respuesta de la fixture | lanza `CommandFailedError` |

### CA-019 — Equivalencia entre motores (`whisper-parsers.spec.ts`)

| Caso | Aserciones |
| ---- | ---------- |
| `parseWhisperCppJson(readFixture('whisper/whisper-cpp.json'), 'voice-take-01')` | `words.length === 8`; `words.map(w => w.text)` `toEqual` `['Hoy','te','muestro','cómo','editar','un','video','completo.']`; **ninguna** palabra es fragmento (`'mues'`/`'tro'` no aparecen); `engine === 'whisper.cpp'` |
| Tokens especiales | `[_BEG_]` no genera palabra; `words[0].text === 'Hoy'` y `words[0].startMs === 0` |
| `parseFasterWhisperJson(readFixture('whisper/faster-whisper.json'), 'voice-take-01')` | `words.length === 8`; mismos textos; `words[0].confidence === 0.982` |
| **Equivalencia (el criterio)** | `cpp.words.length === fw.words.length`; para cada `i`: `cpp.words[i].text === fw.words[i].text`, `abs(cpp.words[i].startMs - fw.words[i].startMs) <= 20` y `abs(cpp.words[i].endMs - fw.words[i].endMs) <= 20`. Con las fixtures de §6.6/§6.7 el máximo real es **10 ms** |
| Ambos pasan por el dominio | `TranscriptionSchema.safeParse(result).success === true` para los dos |
| JSON de otro formato (el de faster-whisper pasado al parser de whisper.cpp) | lanza `UnparseableOutputError` con `command === 'whisper.cpp'` |
| `transcribeWithWhisperCpp` (`transcribe.spec.ts`) | `runner.calls[0].args` `toEqual` la tabla §4.6; el `readTextFile` inyectado recibe exactamente `` `${outBase}.json` ``; el resultado es igual al del parser |

### CA-020 — `normalizeVoice` con `FixtureCommandRunner` (`loudnorm.spec.ts`)

Rutas del runner:

```ts
new FixtureCommandRunner([
  { bin: 'ffmpeg', argsPattern: ['-af', /^loudnorm=(?!.*measured_I)/],
    response: { stderr: readFixture('ffmpeg/loudnorm.stderr.txt'), exitCode: 0 } },
  { bin: 'ffmpeg', argsPattern: ['-af', /measured_I=/],
    response: { stderr: '', exitCode: 0 } },
]);
```

| Aserción | Valor esperado |
| -------- | -------------- |
| Cantidad de llamadas | `runner.calls.length === 2` (dos pasadas, RN-4) |
| 1.ª pasada | `runner.calls[0].args` `toEqual` la tabla §4.3, con `loudnorm=I=-14:TP=-1:LRA=11:print_format=json` |
| 2.ª pasada — filtro | `runner.calls[1].args[6] === 'loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.45:measured_TP=-5.20:measured_LRA=7.60:measured_thresh=-33.99:offset=-0.03:linear=true:print_format=json'` |
| 2.ª pasada — contiene los 4 `measured_*` | `measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh` presentes y **con los valores de la 1.ª pasada** |
| 2.ª pasada — target | contiene `I=-14`, `TP=-1`, `LRA=11` |
| 2.ª pasada — resto de args | `toEqual` la tabla §4.4 (`-y`, `-ar 48000`, `<out>` al final) |
| Resultado | `result.measured` `toEqual` la medición de §6.5; `result.filter === runner.calls[1].args[6]`; `result.outputPath === out` |
| `measureLoudness` sobre `input_i: "-inf"` | lanza `UnparseableOutputError` nombrando `input_i` |

### CA-021 — `resolveBinaries` (`binaries.spec.ts`)

Con un `BinaryLookup` de test (un `Set<string>` de rutas "existentes", cero I/O real):

| Caso | Aserción |
| ---- | -------- |
| `FFPROBE_PATH=/opt/custom/ffprobe` **y** `/usr/bin/ffprobe` en el `PATH` | devuelve `/opt/custom/ffprobe` — **la variable gana** |
| Sin `FFPROBE_PATH`, `PATH='/usr/bin:/opt/homebrew/bin'`, existe solo `/opt/homebrew/bin/ffprobe` | devuelve `/opt/homebrew/bin/ffprobe` (fallback al PATH, respetando el orden de `PATH`) |
| Existe en los dos directorios del `PATH` | gana el **primero** del `PATH` |
| `FFMPEG_PATH` apunta a una ruta inexistente | `BinaryNotFoundError` con `binary === 'ffmpeg'`, `envVar === 'FFMPEG_PATH'`, `searchedPaths === [esa ruta]` — **no** cae al PATH: una variable mal puesta se avisa, no se ignora |
| Nada configurado y nada en el `PATH` | `BinaryNotFoundError` con `binary === 'whisper-cli'` (o el que falte) y `searchedPaths` = todos los candidatos probados |
| `WHISPER_MODEL_PATH` sin definir | `BinaryNotFoundError` con `binary === 'whisper-model'` — el modelo **no** tiene fallback al PATH |
| `WHISPER_MODEL_PATH` definido a un archivo legible | devuelve esa ruta (se chequea `isReadableFile`, no `isExecutableFile`) |
| `resolveBinaries` con los cuatro resueltos | `toEqual({ ffmpeg, ffprobe, whisperCli, whisperModel })` |
| Ningún test | ejecuta un binario: el `BinaryLookup` es un doble y `execa` no se importa en este archivo |

### CA-022 — `CommandFailedError` (`runner.spec.ts`)

| Caso | Aserción |
| ---- | -------- |
| `FixtureCommandRunner` que devuelve `exitCode: 1` y un `stderr` de 5000 caracteres ASCII | el wrapper lanza `CommandFailedError`; `err.command` es la ruta del binario; `err.args` `toEqual` los args exactos; `err.exitCode === 1`; `Buffer.byteLength(err.stderr, 'utf8') === 2048`; `err.stderrTruncated === true`; `err.stderr` es el **sufijo** del original (`original.endsWith(err.stderr)`) |
| `stderr` corto | `err.stderr === stderr` completo, `stderrTruncated === false`, sin padding |
| `stderr` de exactamente 2048 bytes | sin truncar, `stderrTruncated === false` (el límite es inclusivo) |
| `stderr` con acentos cortado en medio de un carácter multibyte | `Buffer.byteLength <= 2048` y el primer carácter **no** es `�` |
| `err.message` | contiene el binario, los args unidos por espacio y el exit code |
| `isMediaLocalError(err)` | `true`; `err.code === 'COMMAND_FAILED'`; `err instanceof MediaLocalError` |
| Superficie pública | `src/index.ts` exporta todos los nombres de §3 (test de barrel) |

---

## 8. Reglas de implementación (no negociables)

1. **Cero comentarios** en `src/**`. Si una línea pide explicación, se extrae una función cuyo
   nombre sea esa explicación (`groupTokensIntoWords`, `resolveRotation`, `extractTrailingJsonObject`,
   `truncateStderr`, `classifyKind`). Única excepción admitida: una línea que ancle una regla
   contra-intuitiva a su criterio o al comportamiento del binario, p. ej.
   `// ffprobe reports display matrix rotation counter-clockwise (CA-017)`.
2. **Cero `any`** (`@typescript-eslint/no-explicit-any: error`). Lo que sale de `JSON.parse` es
   `unknown` y entra a Zod; no se castea nunca con `as`.
3. **Cero `Date` fuera de `src/clock.ts`, cero `Math.random`, cero `process.env`** — verificado por
   ESLint (D-03), no por revisión humana. `probedAt` y todo dato que no venga del binario entran
   por parámetro (D-11).
4. **Cero `child_process`**: todo comando pasa por `CommandRunner`. **`execa` solo en
   `src/runner/execa-command-runner.ts`**; `node:fs` solo en `src/fs/**`, `src/__fixtures__/**` y
   specs.
5. **Superficie pública solo en `src/index.ts`.** Los schemas Zod de salidas externas y las
   fixtures **no** se exportan. Nada de imports profundos desde fuera de la lib, ni de
   `media-local` hacia el interior de `timeline-core`.
6. **Los parsers son funciones puras** de `(texto, contexto) → contrato validado`: no ejecutan
   nada, no leen archivos, no miran el reloj, no mutan sus argumentos.
7. **Ningún test ejecuta un binario.** `ExecaCommandRunner` no se instancia en ningún `*.spec.ts`;
   `execa` no se importa en ningún test. El único I/O de la suite es leer fixtures del propio repo.
8. **Toda salida externa se valida con Zod antes de mapear** y todo fallo sale como error tipado de
   §3.1 — nunca un `TypeError`, un `NaN` ni un objeto a medio llenar.
9. **Un archivo, una familia de funciones**; funciones cortas. Los archivos de test se llaman como
   los nombra la tabla de CA de la spec (`ffprobe.spec.ts`, `silencedetect.spec.ts`,
   `whisper-parsers.spec.ts`, `loudnorm.spec.ts`, `binaries.spec.ts`, `runner.spec.ts`).
10. **README obligatorio** con: matriz de binarios (nombre, versión mínima, variable de entorno,
    cómo instalarlo en macOS), las cuatro variables de entorno, el hecho de que **nada se descarga
    automáticamente**, la procedencia de cada fixture, la limitación POSIX del lookup (D-09) y el
    procedimiento del smoke manual (que es el único lugar donde se verifica `ffmpeg ≥ 6.0` y
    `whisper-cli ≥ 1.7`).
11. `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde al cierre (RNF-9), con
    cobertura ≥ 80 % en esta lib (RNF-2) y la suite completa por debajo de 20 s (RNF-3).

---

## 9. Cambios en schema (`sdd/schema.json`) — **NO APLICA**

Este ciclo **no crea ni modifica ninguna tabla**. `libs/media-local` no persiste nada: recibe rutas
de archivos, ejecuta procesos y devuelve objetos en memoria. No hay motor de base de datos, ni ORM,
ni migraciones en todo el módulo `core-composition-media-pipeline`; la persistencia llega con
`spec-e-burgos-005-render-service`.

**`sdd/schema.json` no se toca en este ciclo.** No se agrega un app-key vacío para `media-local`:
un key sin tablas es ruido en el registro y en el visor (misma decisión que cycle-01).

Los únicos "schemas" del ciclo son los **Zod locales de salidas externas** (D-10), que describen el
formato de un binario y viven en el código de la lib, no en el registro SDD.

## 10. Contratos de API (`sdd/api.json`) — **NO APLICA**

Este ciclo **no define ningún endpoint HTTP**. `media-local` no expone red y no la consume: es una
lib importada en proceso que habla con binarios locales por `stdin`/`stdout`/`stderr`. Los
endpoints locales llegan con `spec-e-burgos-005-render-service`.

**`sdd/api.json` no se toca en este ciclo.** El "contrato" que consume el resto del sistema es la
API pública de TypeScript de §3 más las tablas de argumentos de §4 (que son el contrato con los
binarios, verificado por los tests con `FixtureCommandRunner`).

> Los `agent_contexts.architect.existing_tables` y `existing_endpoints` del `brief.yaml` ya vienen
> vacíos: es coherente y esperado.

---

## 11. Dependencias externas

| Paquete | Versión | Dónde se declara | Motivo |
| ------- | ------- | ---------------- | ------ |
| `execa` | `^10` | `dependencies` del **`package.json` raíz** | `ExecaCommandRunner`: spawn sin shell, `exitCode`, `timeout`, encoding utf8 (D-06) |

- Se instala con `pnpm add execa@^10 -w`. Va en el **root** porque el repo trabaja con un único
  `package.json` y dependencias hoisted (D-01), y en `dependencies` (no `devDependencies`) porque
  se ejecuta en runtime. Es la **única** dependencia nueva del ciclo.
- `execa` v10 es **ESM puro**; la lib ya es ESM (`module: esnext`, `verbatimModuleSyntax`), así que
  no hace falta ningún interop. Es también la razón de que no se use `node:child_process` a mano:
  `execa` resuelve el escapado de argumentos, el timeout con kill y el encoding de una manera que
  reimplementar sería ~150 líneas propias sin tests.
- **Ya presentes en el root y reutilizadas sin instalar nada:** `zod` (^4.5, para los schemas de
  salidas externas — la misma versión que usa `timeline-core`, sin segunda copia), `vitest`,
  `@vitest/coverage-v8`, `typescript` (~6.0), `eslint`, `@nx/js`, `@nx/vite`.
- **Dependencia interna:** `@video-maker/timeline-core` (por *source*, vía `paths`). Es la única
  lib del repo que `media-local` puede importar (D-02).
- **No se instala nada más.** Sin `which`, sin `fluent-ffmpeg`, sin `ffmpeg-static`, sin
  `@ffprobe-installer/*`: la resolución de binarios son 30 líneas propias (D-09) y **descargar
  binarios está explícitamente fuera de alcance** (`out_of_scope` del brief, RN-8). Sin
  `node-whisper` ni wrappers de terceros: la superficie que necesitamos son 11 argumentos y un
  parser.
- **Binarios locales** (`ffmpeg`/`ffprobe` ≥ 6.0, `whisper-cli` ≥ 1.7 + modelo `ggml-*`): **no son
  dependencias del build ni de CI**. Solo se exigen para el uso real y el smoke manual, y se
  documentan en el README.

---

## 12. Trazabilidad CA → archivo → función

| CA | Test | Función bajo prueba |
| -- | ---- | ------------------- |
| CA-017 | `ffprobe/ffprobe.spec.ts` | `parseFfprobeJson`, `resolveRotation`, `classifyKind`, `probeMedia` |
| CA-018 | `ffmpeg/silencedetect.spec.ts` | `parseSilenceDetect`, `detectSilencesWithFfmpeg` |
| CA-019 | `whisper/whisper-parsers.spec.ts` | `parseWhisperCppJson` (+ `groupTokensIntoWords`), `parseFasterWhisperJson`, `buildTranscription` |
| CA-019 (wrapper) | `whisper/transcribe.spec.ts` | `transcribeWithWhisperCpp` + `ReadTextFile` inyectado |
| CA-020 | `ffmpeg/loudnorm.spec.ts` | `measureLoudness`, `parseLoudnormJson`, `buildLoudnormFilter`, `normalizeVoice` |
| CA-021 | `binaries/binaries.spec.ts` | `resolveBinary`, `resolveBinaries`, `BinaryNotFoundError` |
| CA-022 | `runner/runner.spec.ts` | `CommandFailedError`, `truncateStderr`, `FixtureCommandRunner`, barrel `src/index.ts` |
| — (RN-5) | `ffmpeg/extract-audio.spec.ts` | `extractAudioForTranscription` (args de §4.5) |
| — (bordes) | `errors/errors.spec.ts` | `truncateStderr` multibyte y límite exacto |
| — (cobertura) | `fs/fs-ports.spec.ts` | `nodeBinaryLookup`, `nodeReadTextFile` |

## 13. Riesgos y puntos abiertos declarados

| # | Riesgo | Mitigación / decisión |
| - | ------ | --------------------- |
| R-1 | `measureLoudness` devuelve 5 campos y la spec enumera 3 | D-10/§3.5: ampliación **aditiva** (los 3 originales están con el mismo nombre); `thresholdLufs` y `targetOffsetDb` son insumo obligatorio de CA-020. Delta declarado para el reviewer y para el fragmento de contexto |
| R-2 | Las fixtures pueden no ser capturas reales si el dev no tiene los binarios | D-15: se documenta la procedencia de cada una en el README; si se reconstruye, se respeta el formato documentado al pie de la letra (números como string en ffprobe, prefijo `[silencedetect @ …]`, `offsets` enteros en whisper). El riesgo real es un formato *plausible pero falso*: se mitiga capturando al menos una salida real por binario en el smoke manual y comparándola con la fixture |
| R-3 | Una versión futura de ffmpeg cambia el formato de `silencedetect` o de `loudnorm` | Los schemas externos son laxos (D-10) y los regex están acotados a `silence_start:`/`silence_end:`. Un cambio de formato sale como `UnparseableOutputError` con `sample`, no como un dato silenciosamente mal parseado. El README fija la versión mínima (6.0) y la usada para grabar |
| R-4 | `-ml 1` de whisper.cpp podría cambiar la tokenización entre versiones y alterar la agrupación | D-14 depende solo de la convención "el espacio abre palabra", que es del tokenizador de Whisper y no de la CLI. CA-019 (misma cantidad de palabras que Faster-Whisper) es el detector: si cambia, el test rompe y se revisa |
| R-5 | `execa` v10 es ESM puro: si algún consumidor futuro fuera CJS, no puede requerir esta lib | Todo el repo es ESM y `media-local` es Node ≥ 22. Se declara acá para que el ciclo que arme `apps/render-api` no lo descubra tarde |
| R-6 | El lookup de binarios es POSIX (sin `PATHEXT`) | D-09: documentado en el README; en Windows hay que fijar las cuatro variables de entorno. No hay ningún consumidor Windows en el roadmap de la spec |
| R-7 | `probeMedia` no valida la versión mínima de ffprobe: un binario 4.x podría emitir un JSON parcial | Sale como `UnparseableOutputError` (el `superRefine` de `MediaAssetSchema` exige `fps`/`width`/`height`/`hasAudio` en video), que es un diagnóstico correcto aunque no nombre la versión. La verificación de versión vive en el smoke manual (§8, regla 10) |
| R-8 | La cobertura del 80 % puede quedar corta por las ramas de casos borde de los parsers | Cada caso borde de §5 tiene su test nombrado; `src/index.ts` y `src/__fixtures__/**` están excluidos de cobertura, y `src/fs/**` se cubre con los tests de §D-04 |
| R-9 | `transcribeWithWhisperCpp` deja el `${outBase}.json` en disco | D-13: es deliberado (el wrapper no crea ni borra archivos), pero el consumidor tiene que limpiarlo. Queda anotado para el ciclo que arme el pipeline completo (spec-002 / spec-005) |
