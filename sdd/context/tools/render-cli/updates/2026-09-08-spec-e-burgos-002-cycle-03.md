# spec-e-burgos-002 cycle-03 — 2026-09-08

## Estado

- **`tools/render-cli` existe y está completo.** `resuelve: context_prompt.md → "Estado: todavía no
  existe en Nx"` y `resuelve: constitution.md §3 → "La define el ciclo cycle-03. Esquema previsto"`.
  Primer proyecto bajo `tools/` del repo. 52 archivos, 151 tests en 17 archivos, cobertura
  98.26 % stmts / 92.37 % branches / 100 % funcs / 98.24 % lines (umbral 85). **Cero dependencias npm
  nuevas**: el parseo es `node:util parseArgs`.
- Los cuatro comandos están implementados y verificados: `ingest`, `plan`, `render`, `run`.
  CA-013 a CA-016 en PASS; CA-015/CA-016 con dos renders reales (evidencia literal en
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/artifacts/smoke-ca015-ca016.md`).
- Con esto **la spec-002 queda cerrada** (`completed`, 3 ciclos).

## Estructura

```
src/main.ts                 frontera de proceso: argv, cwd, stdout/stderr, process.exitCode
src/cli.ts                  runCli(argv, resolveProjectRoot, deps) -> CliOutcome; try/catch único
src/args/                   parse-cli-args, preset-names, stage-for-argument (puro, sin I/O)
src/commands/               ingest | plan | render | run — uno por archivo, devuelven un *Report
src/pipeline/               assert-project-preconditions, read-timeline-document, resolve-render-target
src/report/                 cli-report (tipos), to-reports (mapeo), format-report (texto)
src/errors/                 RenderCliError + 4 subclases, exit-code-for, format-cli-error, translate-lib-error
src/deps/                   cli-dependencies (puertos), node-cli-dependencies (adaptador), timeline-renderer
src/cli-register.cjs        loader: registra swc-node y le devuelve a Node su loader nativo de .js
src/__fixtures__/           fake-cli-dependencies, media-project
```

Patrones que rigen el tool y que conviene no re-litigar:

- **`main.ts` es la única frontera de proceso.** Es el único archivo que puede tocar `process`,
  `console` y `resolve` de `node:path`. Todo lo demás devuelve un `CliOutcome`
  (`{ exitCode, stdout, stderr }`) y no imprime nada. `runCli` tiene un solo `try/catch`.
- **Todo el I/O y el render entran por puertos inyectables** (`CliDependencies`), armados solo en
  `node-cli-dependencies.ts`. Es lo que deja la suite corriendo sin ffmpeg, whisper ni Chrome
  (RNF-3) y lo que permite verificar CA-014 sin un render real.
- **`@video-maker/composition-remotion` se consume SOLO por el subpath `/render`**, y solo desde
  `node-cli-dependencies.ts`, con `await import()` dentro de la función. Nunca el barrel.
- **Rutas del proyecto de medios en POSIX** (`node:path/posix`); la única ruta de SO es el `resolve`
  del cwd en `main.ts`.
- **Etapas en secuencia estricta**: `run` encadena y corta en la primera que falla; nada de
  `Promise.all`/`allSettled`/`race`.
- **Exit codes**: 0 solo en éxito; uso/argumento 2, input de etapa faltante 3, fallo de etapa
  ingest 4 / plan 5 / render 6, error no tipado 1. Ningún camino imprime `.stack`.
- **`publicDir` = raíz del proyecto de medios, nunca `raw/`** (D-2/HC-1), y `outPath` =
  `out/<slug>.mp4`. Lo resuelve `resolve-render-target.ts` y el adaptador lo reenvía verbatim.

## Dependencias

- Runtime: `@video-maker/auto-montage`, `@video-maker/media-local`, `@video-maker/timeline-core` y
  `@video-maker/composition-remotion/render`. **Ningún paquete npm nuevo.**
- Tags Nx: `["scope:engine", "type:tool"]`. `type:tool` no tiene regla propia en los
  `depConstraints` de la raíz, así que cae en el fallback `{ sourceTag: '*',
  onlyDependOnLibsWithTags: ['*'] }` — HC-3 se cumple **sin editar `eslint.config.mjs` de la raíz**.
- Targets: `lint`, `test` (vitest + coverage), `build` (`tsc -p tsconfig.lib.json`), `cli`
  (invocación libre) y `smoke` (invocación fija sobre `media/smoke-ingest`). `cli` y `smoke` corren
  **sin `cwd`** (desde la raíz del workspace) y con `SWC_NODE_PROJECT=tsconfig.base.json`.

## Qué sigue

- **`tools/render-cli/eslint.config.mjs` NO existe.** El hook `config-protection` del harness del dev
  (plugin de usuario, fuera de este repo) bloquea cualquier archivo cuyo *basename* sea
  `eslint.config.mjs`, sin distinguir raíz de proyecto. `@nx/eslint:lint` resuelve el flat config de
  la raíz, así que el tool **sí se lintea** y HC-3 se cumple; lo que falta son los guardrails
  **extra** de §2.5 del `architect.md` (`no-restricted-imports/globals/properties`). **Hoy esas 8
  reglas se sostienen por convención** — se verificaron a mano por grep al cerrar el ciclo, las 8
  pasan. Sin el archivo, la primera task que introduzca `node:fs` o `child_process` va a pasar el
  pipeline en verde. Reversible en un paso: pegar §2.5 tal cual, sin tocar código.
- **N-2 pendiente (fix acotado, no bloqueante):** los errores de uso sobre un comando ya conocido
  (`--preset`/`--seed` en `ingest|render`, falta de `<project-root>`, positional extra) se reportan
  con el token genérico `[uso]` en vez de la etapa del comando, contra la decisión funcional 5. No
  cambia ningún exit code (`CLI_USAGE` y `CLI_ARGUMENT` mapean ambos a 2). Huella: la columna
  `'project-root'` de `STAGE_FOR_ARGUMENT` está cableada y **ningún llamador de producción la usa**.
- **`nx run render-cli:cli` NO propaga el exit code real**: Nx normaliza cualquier fallo de
  `nx:run-commands` a su propio `1`. El proceso sí devuelve el código correcto invocado directo
  (`node -r ./tools/render-cli/src/cli-register.cjs tools/render-cli/src/main.ts …`, verificado
  `$? = 3`). Un consumidor que necesite el código exacto —**`apps/render-api` de spec-005**— invoca
  el binario, no el target.
- **`{workspaceRoot}` no se puede usar como token intermedio** dentro de un `command` compuesto de
  Nx 23: solo se resuelve al inicio absoluto del valor de la opción. Por eso el target `smoke` dice
  `run media/smoke-ingest` a secas (sin `cwd`, `nx:run-commands` ya corre desde la raíz).
- Regenerar `media/smoke-ingest`: la receta está en el README del tool, y **incluye alargar
  `raw/audio/music01.mp3`**, no solo el A-roll — ver el fragmento de contexto de `auto-montage` de
  esta misma fecha.
- La superficie de salida es bilingüe: etiquetas en castellano (`recurso:`, `esperado:`, `causa:`,
  `sugerencia:`, `[uso]`, `[interno]`) sobre tokens de datos en inglés (`ingest|plan|render`,
  `unknown-preset`). Decisión a tomar explícitamente en spec-005, donde pasan a ser payload de API.
