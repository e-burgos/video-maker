# Constitución — tools/render-cli

> Versión 1.0 | Última actualización: spec-e-burgos-002 cycle-03 | Fecha: 2026-09-08
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-002-auto-montage-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** tool Node ejecutable (CLI headless)
- **Rol en el sistema:** la única interfaz de línea de comandos del motor. Va de una carpeta de
  assets (`media/<project-slug>/`) a un MP4 en `out/`, encadenando `libs/auto-montage` y
  `@video-maker/composition-remotion/render`. **No contiene lógica de montaje propia**: si un
  cálculo hace falta, va a una lib, no acá.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `@video-maker/auto-montage`, `@video-maker/media-local`, `@video-maker/timeline-core` y
  `@video-maker/composition-remotion/render` (subpath `/render` exclusivamente, nunca el barrel, y
  solo vía `await import()` desde `node-cli-dependencies.ts`)
- Parser de argumentos: `node:util parseArgs`. **Cero dependencias npm nuevas.**
- Vitest sobre toda la lógica no-I/O (151 tests en 17 archivos, cobertura 98.26 % stmts / 92.37 %
  branches / 100 % funcs / 98.24 % lines, umbral 85 %); el render real es smoke manual
  (`nx run render-cli:smoke`)
- Tags Nx: `["scope:engine", "type:tool"]`. `type:tool` no tiene regla propia en los
  `depConstraints` de la raíz y cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags:
  ['*'] }` — HC-3 se cumple sin editar `eslint.config.mjs` de la raíz.
- Targets: `lint`, `test` (vitest + coverage), `build` (`tsc -p tsconfig.lib.json`), `cli`
  (invocación libre) y `smoke` (invocación fija sobre `media/smoke-ingest`). `cli` y `smoke` corren
  sin `cwd` (desde la raíz del workspace) con `SWC_NODE_PROJECT=tsconfig.base.json`.

## 3. Estructura y patrones

```
src/main.ts                 frontera de proceso: argv, cwd, stdout/stderr, process.exitCode
src/cli.ts                  runCli(argv, resolveProjectRoot, deps) -> CliOutcome; try/catch único
src/args/                   parse-cli-args, preset-names, stage-for-argument (puro, sin I/O)
src/commands/                ingest | plan | render | run — uno por archivo, devuelven un *Report
src/pipeline/                assert-project-preconditions, read-timeline-document, resolve-render-target
src/report/                  cli-report (tipos), to-reports (mapeo), format-report (texto)
src/errors/                  RenderCliError + 4 subclases, exit-code-for, format-cli-error, translate-lib-error
src/deps/                    cli-dependencies (puertos), node-cli-dependencies (adaptador), timeline-renderer
src/cli-register.cjs         loader: registra swc-node y le devuelve a Node su loader nativo de .js
src/__fixtures__/            fake-cli-dependencies, media-project
```

- **`main.ts` es la única frontera de proceso**: el único archivo que puede tocar `process`,
  `console` y `resolve` de `node:path`. Todo lo demás devuelve un `CliOutcome`
  (`{ exitCode, stdout, stderr }`) y no imprime nada. `runCli` tiene un solo `try/catch`.
- **Todo el I/O y el render entran por puertos inyectables** (`CliDependencies`), armados solo en
  `node-cli-dependencies.ts` — deja la suite corriendo sin ffmpeg, whisper ni Chrome (RNF-3) y
  permite verificar CA-014 sin un render real.
- **Rutas del proyecto de medios en POSIX** (`node:path/posix`); la única ruta de SO es el
  `resolve` del cwd en `main.ts`.
- **Etapas en secuencia estricta**: `run` encadena y corta en la primera que falla; nada de
  `Promise.all`/`allSettled`/`race`.

## 4. Convenciones propias

- **El render pasa `publicDir` apuntando a la raíz del proyecto de medios, nunca `raw/`** (D-2/HC-1)
  y `outPath` = `out/<slug>.mp4` — lo resuelve `resolve-render-target.ts` y el adaptador lo
  reenvía verbatim.
- **Exit codes**: 0 éxito · 2 uso/argumento · 3 input de etapa faltante · 4 fallo ingest · 5 fallo
  plan · 6 fallo render · 1 error no tipado. Ningún camino imprime `.stack`.
- **`nx run render-cli:cli` NO propaga el exit code real** — Nx normaliza cualquier fallo de
  `nx:run-commands` a `1`. El proceso invocado directo (`node -r
  ./tools/render-cli/src/cli-register.cjs tools/render-cli/src/main.ts …`) sí devuelve el código
  correcto. Un consumidor que necesite el código exacto invoca el binario, no el target Nx.
- **`{workspaceRoot}` no se puede usar como token intermedio** dentro de un `command` compuesto de
  Nx 23: solo se resuelve al inicio absoluto del valor de la opción. Por eso el target `smoke` dice
  `run media/smoke-ingest` a secas (sin `cwd`; `nx:run-commands` ya corre desde la raíz).
- **Nada de I/O oculto**: la CLI es la capa que resuelve rutas y variables de entorno y se las pasa
  explícitas a las libs.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- Regla operativa heredada de `spec-001`: transcribir **antes** de renderizar, nunca en paralelo
  (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper).

### Pendientes (a resolver en spec-005)

- **`tools/render-cli/eslint.config.mjs` no existe**: el hook `config-protection` del harness del
  dev (plugin de usuario, fuera de este repo) bloquea cualquier archivo cuyo *basename* sea
  `eslint.config.mjs`, sin distinguir raíz de proyecto. `@nx/eslint:lint` resuelve el flat config
  de la raíz, así que el tool sí se lintea y HC-3 se cumple; faltan los guardrails **extra** de
  §2.5 del `architect.md` (`no-restricted-imports/globals/properties`) — hoy se sostienen por
  convención, verificados a mano por grep. Reversible en un paso: pegar §2.5 tal cual, sin tocar
  código.
- **N-2**: los errores de uso sobre un comando ya conocido (`--preset`/`--seed` en
  `ingest|render`, falta de `<project-root>`, positional extra) se reportan con el token genérico
  `[uso]` en vez de la etapa del comando (decisión funcional 5). No cambia el exit code
  (`CLI_USAGE`/`CLI_ARGUMENT` mapean ambos a 2). La columna `'project-root'` de
  `STAGE_FOR_ARGUMENT` está cableada y ningún llamador de producción la usa.
- **Superficie de salida bilingüe**: etiquetas en castellano (`recurso:`, `esperado:`, `causa:`,
  `sugerencia:`, `[uso]`, `[interno]`) sobre tokens de datos en inglés (`ingest|plan|render`,
  `unknown-preset`). Decisión a tomar explícitamente en spec-005, donde pasan a ser payload de API.
- Regenerar `media/smoke-ingest`: receta en el README del tool; incluye alargar
  `raw/audio/music01.mp3`, no solo el A-roll (ver fragmento de contexto de `auto-montage` de esta
  misma fecha).
