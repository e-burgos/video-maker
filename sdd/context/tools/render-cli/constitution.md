# Constitución — tools/render-cli

> Versión 1.5 | Última actualización: consolidación de `updates/` hasta FIX-007-002 | Fecha: 2026-09-11
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
- **`@video-maker/media-local` entra por `import` estático y tiene que seguir así**: cargarlo con
  `await import()` en un solo archivo marca la lib entera como lazy-loaded para
  `@nx/enforce-module-boundaries` y rompe el lint de los ocho archivos que la importan
  estáticamente. El único perezoso de la CLI es `@video-maker/composition-remotion/render`.
- Parser de argumentos: `node:util parseArgs`. **Cero dependencias npm nuevas** (verificado de
  nuevo en `spec-e-burgos-007`: `@video-maker/timeline-core` exporta `OUTPUT_PRESETS`, la lista
  contra la que validan CLI y API el `--format`).
- Vitest sobre toda la lógica no-I/O (151 tests en 17 archivos al cierre de `spec-002` cycle-03,
  cobertura 98.26 % stmts / 92.37 % branches / 100 % funcs / 98.24 % lines, umbral 85 %; la
  superficie creció con `spec-007`/`spec-014`/`spec-015` sin bajar el piso); el render real es
  smoke manual (`nx run render-cli:smoke`)
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
src/args/                   parse-cli-args, preset-names (FORMAT_NAMES/DEFAULT_FORMAT,
                             VOICE_SOURCE_NAMES/DEFAULT_VOICE_SOURCE), stage-for-argument (puro)
src/commands/                ingest | plan | render | run — uno por archivo, devuelven un *Report
src/pipeline/                assert-project-preconditions, read-timeline-document,
                             resolve-render-target, master-render-paths (rutas de
                             work/renders/<slug>/ para el mix masterizado)
src/report/                  cli-report (tipos), to-reports (mapeo), format-report (texto)
src/errors/                  RenderCliError + 4 subclases, exit-code-for, format-cli-error, translate-lib-error
src/deps/                    cli-dependencies (puertos, incluye mixTimelineAudio/muxAudioIntoVideo/
                             verifyMixLoudness), node-cli-dependencies (adaptador), timeline-renderer
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
- **`render` entrega la mezcla masterizada, no el audio que dibuja Remotion** (`spec-015`):
  `renderCommand` encadena `renderTimeline(..., { audio: 'muted' })` → `mixTimelineAudio` →
  `muxAudioIntoVideo` → `verifyMixLoudness`. Los intermedios (`video-muted.mp4`, `master.wav`) viven
  en `work/renders/<slug>/`; el entregable sigue siendo `out/<slug>.mp4`. `mix`/`mux`/`verify` son
  pasos **internos** de la etapa `render`: no ensanchan `Stage` ni cambian los exit codes 4/5/6, y
  un fallo de `media-local` en cualquiera de los tres sale como `STAGE_FAILED` con `stage: 'render'`.

## 4. Convenciones propias

- **El render pasa `publicDir` apuntando a la raíz del proyecto de medios, nunca `raw/`** (D-2/HC-1)
  y `outPath` = `out/<slug>.mp4` — lo resuelve `resolve-render-target.ts` y el adaptador lo
  reenvía verbatim.
- **Exit codes**: 0 éxito · 2 uso/argumento · 3 input de etapa faltante · 4 fallo ingest · 5 fallo
  plan · 6 fallo render · 1 error no tipado. Ningún camino imprime `.stack`.
- **`nx run render-cli:cli` NO propaga el exit code real** — Nx normaliza cualquier fallo de
  `nx:run-commands` a `1`. El proceso invocado directo (`node -r
  ./tools/render-cli/src/cli-register.cjs tools/render-cli/src/main.ts …`) sí devuelve el código
  correcto. Un consumidor que necesite el código exacto invoca el binario, no el target Nx —
  incluido `apps/render-api`, que invoca el binario directo (ver `context_prompt.md`).
- **`{workspaceRoot}` no se puede usar como token intermedio** dentro de un `command` compuesto de
  Nx 23: solo se resuelve al inicio absoluto del valor de la opción. Por eso el target `smoke` dice
  `run media/smoke-ingest` a secas (sin `cwd`; `nx:run-commands` ya corre desde la raíz).
- **Nada de I/O oculto**: la CLI es la capa que resuelve rutas y variables de entorno y se las pasa
  explícitas a las libs.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- Regla operativa heredada de `spec-001`: transcribir **antes** de renderizar, nunca en paralelo
  (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper).
- **`stageForArgument` reporta la etapa del comando ya reconocido** (`spec-005` FIX-002-002): un
  error de uso sobre un comando conocido (`--preset`/`--seed` en `ingest|render`, `<project-root>`
  faltante, positional extra, y los tres errores traducidos de `node:util parseArgs`) lleva la etapa
  de ese comando; el token genérico `[uso]` queda solo para cuando ni el comando se reconoció.
- **Las seis etiquetas de `formatCliError` son inglesas** (`[usage]`, `[internal]`, `resource:`,
  `expected:`, `cause:`, `hint:`) — la superficie de salida dejó de ser bilingüe salvo por la línea
  `cause:`, cuyo contenido no lo genera la CLI: viene tal cual del `message` de los errores de
  `libs/media-local` y `libs/composition-remotion`, y traducirlo es cambio de esas libs, no de acá.
- **`plan`/`run` aceptan siete opciones de planificación** (`--preset`, `--seed`, `--script`,
  `--no-logo`, `--format <reels-9x16|tiktok-9x16|shorts-9x16|youtube-16x9>`, `--voice
  <aroll|script>`, `--prune-silences`); `ingest`/`render` las rechazan todas como
  `unexpected-option`. `--prune-silences` es un booleano de tres estados (`true`/ausente): ausente
  delega el default en la librería (`aroll` poda, `script` no).
- La ruta de `--script` se resuelve igual que `<project-root>` (contra la raíz del workspace, no
  del proyecto de medios); si no se puede leer, el error es `STAGE_INPUT_MISSING` con
  `reason: 'script-missing'` en la etapa `plan`. `PlanReport` imprime `logo: <assetId>|none`
  siempre, `script-corrections: N` solo en modo guion, `format: <preset> <ancho>x<alto>@<fps>`,
  `voice: <fuente>` y, en modo guion, `voice-track: <asset> <ms> (truncated <ms>)`.
- El default de `--format` es fijo (`reels-9x16`) y **no** se deriva de la orientación del A-roll:
  derivarlo cambiaría el formato de los renders de referencia y, condicionado a "sin timeline
  previo", volvería `plan` no idempotente. Quien invoca elige explícitamente.

### Pendientes

- **`tools/render-cli/eslint.config.mjs` no existe**: el hook `config-protection` del harness del
  dev (plugin de usuario, fuera de este repo) bloquea cualquier archivo cuyo *basename* sea
  `eslint.config.mjs`, sin distinguir raíz de proyecto. `@nx/eslint:lint` resuelve el flat config
  de la raíz, así que el tool sí se lintea y HC-3 se cumple; faltan los guardrails **extra** de
  §2.5 del `architect.md` (`no-restricted-imports/globals/properties`) — hoy se sostienen por
  convención, verificados a mano por grep. Reversible en un paso: pegar §2.5 tal cual, sin tocar
  código.
- **La línea `cause:` todavía puede traer castellano**: no es un defecto de `render-cli` — el
  mensaje viene de otro subproyecto (`No se encontró el binario "whisper-cli".`, `Remotion no pudo
  bundlear el entry point.`). Traducirlo es cambio de esas libs.
- El conteo de assets del reporte de `ingest` sigue mostrando los cuatro roles originales; el logo
  se ve solo en la línea propia del reporte de `plan`.
- `render` no reusa el `video-muted.mp4` anterior aunque la Timeline no haya cambiado: cada corrida
  rerenderiza (37 s de reloj para 778 frames a 1080×1920 en esta máquina). Cachearlo por hash de la
  Timeline es decisión de otro ciclo.
- Si algún día hace falta apagar la poda de silencios en modo `aroll`, el flag simétrico sería
  `--no-prune-silences` (hoy no existe).
