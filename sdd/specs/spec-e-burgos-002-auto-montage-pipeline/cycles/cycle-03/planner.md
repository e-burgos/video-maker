# Sprint Plan — Ciclo 3 — `tools/render-cli`

> **Input:** `functional.md` (HU-12..HU-20, RN-20..RN-32, CA-013..CA-016) y `architect.md`
> (D-21..D-40, §1..§10) de este ciclo.
> **Output:** este documento + `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/tasks.json`
> **Generado por:** sdd-planner

**Duración estimada:** 1 semana
**Story points totales:** 45 (39 h estimadas)
**Implementador:** uno solo, backend, reanudado con `SendMessage` task tras task — las 13 tasks
son **estrictamente secuenciales**, sin paralelismo.

---

## Nota sobre el orden: por qué no sigue literalmente el orden de agrupación pedido

La consigna agrupa por "parseo y validación de argumentos; errores y exit codes; precondiciones...".
Verificando el código real del `architect.md` (D-24, §4.1) resulta que `parseCliArgs` **construye**
instancias de `CliUsageError`/`CliArgumentError`, y `stageForArgument` **devuelve** el tipo `Stage`
que `render-cli-error.ts` declara (§5.1). Es decir: el módulo de argumentos importa del módulo de
errores, no al revés. Si TASK de args se hiciera antes que la de errores, el workspace quedaría rojo
al cerrarla (`tsc` no resuelve `CliUsageError`) — violando la regla de que cada task deja
`lint test build` y `sdd:validate` en verde. Por eso este plan pone **errores antes que args**
(TASK-002 antes que TASK-003), y deja constancia acá para que quien lo audite no lo lea como un
descuido.

El resto de los grupos pedidos (precondiciones y rutas; adaptador de render; los comandos; el
reporte; el cableado de D-4; el smoke) sí respeta el orden sugerido, con la única inversión
justificada arriba.

---

## Tasks

### TASK-001: Scaffold de `tools/render-cli`: dry-run del generador, auditoría y verificación de ejecución real

**Historia:** HU-12
**App:** `tools/render-cli`
**Descripción:** Ejecutar el procedimiento de D-22: `pnpm exec nx g @nx/js:library tools/render-cli
--name=render-cli --unitTestRunner=vitest --bundler=none --linter=eslint --directory=tools/render-cli
--dry-run` y leer la lista `CREATE`/`UPDATE`. Si toca `tsconfig.base.json`, `nx.json` o el
`package.json` raíz → **no correr el generador**: crear a mano los 6 archivos copiando la forma de
`libs/auto-montage` (`project.json`, `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`,
`vite.config.ts`, `eslint.config.mjs`), con el contenido literal de §2.2–§2.5 del `architect.md`
(incluye `jsx: react-jsx` — D-38 — y los aliases de Vitest — D-39 — y los guardrails de ESLint —
§2.5). Si el dry-run no toca configs raíz, correr el generador de verdad y podar hasta ese mismo
estado objetivo. En la MISMA task, auditar: `package.json` del proyecto (no debe existir),
`nx.json` (no debe ganar plugins — en particular `@nx/vitest`, que deja `test` en modo watch y
cuelga `run-many`), y `src/` (sin placeholders ni `export {};`). Crear un `src/main.ts` mínimo que
YA importe de forma real `resolveMediaProject` de `@video-maker/auto-montage` y haga
`await import('@video-maker/composition-remotion/render')`, imprima algo por stdout y termine con
`process.exitCode = 0` — es el criterio de ejecución real del addendum §10 (punto 3): `nx build` y
`nx lint` verdes no prueban que `@swc-node/register` resuelva esos imports en runtime. Crear también
`README.md` con la forma de invocación (§3) como placeholder inicial (el contenido de regeneración
de material de D-35 se completa en TASK-012).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `project.json` tiene `projectType: "application"`, `tags: ["scope:engine", "type:tool"]` y los
      targets `lint`, `test`, `build`, `cli`, `smoke` exactos de §2.3 (sin `cwd` en `cli`/`smoke`,
      `SWC_NODE_PROJECT: tsconfig.base.json`)
- [ ] `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` calzan con §2.2, incluido
      `"jsx": "react-jsx"` en los dos últimos
- [ ] `vite.config.ts` tiene los cuatro aliases de D-39 (con `'@video-maker/composition-remotion/render'`
      primero y exacto, nunca el barrel) y el bloque `coverage` de D-37 (umbral 85 en las 4 métricas)
- [ ] `eslint.config.mjs` reproduce §2.5 completo (guardrails de `process`/`console`, `Promise.all`,
      `.stack`, imports restringidos), sin tocar `eslint.config.mjs` de la raíz
- [ ] No existe `package.json` propio del proyecto; `nx.json` no ganó ningún plugin nuevo
- [ ] `pnpm nx run render-cli:cli` imprime algo por stdout y termina con exit code 0, con los dos
      imports reales (`@video-maker/auto-montage`, `@video-maker/composition-remotion/render`)
      efectivamente resueltos por `@swc-node/register`
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-002: Jerarquía de errores propia, tabla de exit codes y formato normativo de error

**Historia:** HU-17
**App:** `tools/render-cli`
**Descripción:** Implementar `src/errors/`: `render-cli-error.ts` (clase abstracta `RenderCliError`
+ `isRenderCliError`, con `code`/`stage`/`resource`/`reason`/`expected`/`hint` — §5.1), las cuatro
concretas (`cli-usage-error.ts`, `cli-argument-error.ts`, `stage-input-missing-error.ts`,
`stage-failed-error.ts`), `translate-lib-error.ts` (`unknown → RenderCliError` vía
`isAutoMontageError`/`isMediaLocalError`, nunca `instanceof` clase por clase — D-31) con su spec
cubriendo un caso por código de `AutoMontageErrorCode` y `MediaLocalErrorCode` de la tabla de §5.2,
`exit-code-for.ts` con la tabla completa etapa→error→exit code de §5.2 fila por fila en su spec, y
`format-cli-error.ts` con las formas exactas de §5.3 (afirmables por `toEqual`, nunca `toContain`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `exitCodeFor` devuelve exactamente los códigos 0/1/2/3/4/5/6 de la tabla de §5.2, con test
      fila por fila
- [ ] `translateLibError` cubre cada código de `AutoMontageErrorCode` y `MediaLocalErrorCode` que
      aparece en la tabla, sin usar `instanceof` sobre clases concretas
- [ ] `formatCliError` reproduce byte a byte las 8 formas de ejemplo de §5.3 (incluida
      `error [interno] <ErrorName>: <message>` para el no tipado)
- [ ] Ningún camino de código accede a `.stack` (lint del bloque `no-restricted-properties` en verde)
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-003: Parseo y validación de argumentos: `PRESET_NAMES`, `parseCliArgs` y `stageForArgument`

**Historia:** HU-16, HU-12
**App:** `tools/render-cli`
**Descripción:** Implementar `src/args/`: `preset-names.ts` (`PRESET_NAMES` literal y ordenada,
`COMMAND_NAMES`, `DEFAULT_SEED = 0`) con su test de paridad contra `MONTAGE_PRESETS` (D-25);
`parse-cli-args.ts` (`parseCliArgs`, pura, usa `node:util parseArgs` con `strict: true` y traduce
`ERR_PARSE_ARGS_*` por `code` a `CliUsageError` — D-24) siguiendo el orden de validación normativo
de 8 pasos de §4.1 (con su spec de tabla de argumentos válidos e inválidos, uno por paso); y
`stage-for-argument.ts` (`stageForArgument`, la tabla de 8 celdas de D-27, con `run` mapeando el
error del posicional a `ingest` y el de `--preset`/`--seed` a `plan`).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] Test de paridad `[...PRESET_NAMES].sort() === Object.keys(MONTAGE_PRESETS).sort()` en verde
- [ ] `parseCliArgs` respeta el orden de validación de 8 pasos de §4.1 (test que confirma qué error
      gana cuando hay más de uno aplicable)
- [ ] `--seed` se valida con `/^\d+$/` + `Number.isSafeInteger`, nunca `Number()` a secas (casos
      `''`, `' 1 '`, `'0x10'`, `'1e3'` cubiertos como inválidos)
- [ ] `stageForArgument` cubre las 8 celdas de la tabla D-27 con test explícito
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-004: Precondiciones por etapa y resolución de rutas

**Historia:** HU-12, HU-13, HU-14
**App:** `tools/render-cli`
**Descripción:** Implementar `src/pipeline/`: `assert-project-preconditions.ts`
(`assertProjectIsIngestable`, `assertCatalogExists`, `assertTimelineExists` — D-28, con los puertos
`DirectoryReader`/`FileStatReader` ya exportados por `auto-montage`, nunca acceso directo a
filesystem), `resolve-render-target.ts` (`resolveRenderTarget` — D-32, `publicDir = project.root`,
`outPath = <root>/out/<slug>.mp4` con `node:path/posix`) y `read-timeline-document.ts`
(`readTimelineDocument`, lee y valida `work/timeline.json` con `TimelineSchema` antes de tocar
Remotion). Crear el fixture `src/__fixtures__/media-project.ts` (`MediaProject` determinista sobre
`/media/p`), usado desde acá en adelante por el resto de las tasks.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] `assertProjectIsIngestable` cubre los tres chequeos de la tabla de D-28 (`project-root-not-found`,
      `raw-missing`, `raw-has-no-role-directory`) sin invocar `ingestProject`
- [ ] `assertProjectIsIngestable` NO exige archivos dentro de `raw/aroll/` (un directorio de rol vacío
      no es un error de la CLI — nota de D-28)
- [ ] `assertCatalogExists`/`assertTimelineExists` emiten `StageInputMissingError` con el `hint` de
      la etapa previa (`'corré \`ingest\` antes de \`plan\`'`, `'corré \`plan\` antes de \`render\`'`)
- [ ] `resolveRenderTarget` verificado con test de igualdad (CA-014 sin render real): `publicDir`
      nunca es `project.rawDir`
- [ ] `readTimelineDocument` cubre JSON roto, JSON válido y JSON que no valida contra `TimelineSchema`
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-005: Puerto `TimelineRenderer`, `CliDependencies` y wiring real de Node

**Historia:** HU-14
**App:** `tools/render-cli`
**Descripción:** Implementar `src/deps/timeline-renderer.ts` (tipos `RenderRequest`/`RenderOutcome`
propios, cero imports de `composition-remotion` — D-30), `src/deps/cli-dependencies.ts` (interfaz
`CliDependencies` con los 9 campos obligatorios, sin `?` — §4.2) y `src/deps/node-cli-dependencies.ts`
(`createNodeCliDependencies(env)`, ÚNICO archivo que hace `await import('@video-maker/composition-remotion/render')`
dentro del método que lo usa, con el `try/catch` que traduce `RenderTimelineError` a
`StageFailedError({ stage: 'render', ... })` — D-30; `resolveBinaries` entra como proveedor
perezoso, invocado SOLO desde `ingestCommand` — D-31). Este archivo queda excluido de cobertura
(D-37): no lleva spec, se verifica en el smoke final.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] `timeline-renderer.ts` no importa nada de `@video-maker/composition-remotion` (verificable por
      lint: `no-restricted-imports` del bloque de §2.5 no se dispara en este archivo)
- [ ] `node-cli-dependencies.ts` es el ÚNICO archivo del tool que importa el subpath `/render`
      (grep de verificación manual, además del lint)
- [ ] `resolveBinaries` en `CliDependencies` tiene la firma `() => Promise<ResolvedBinaries>`, no un
      valor resuelto
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-006: Tipos de reporte, mappers `to*Report` y `formatReport`

**Historia:** HU-19
**App:** `tools/render-cli`
**Descripción:** Implementar `src/report/cli-report.ts` (tipos `IngestReport`/`PlanReport`/
`RenderReport`/`RunReport`/`CliReport` de §4.2), `src/report/to-reports.ts` (mappers puros
`toIngestReport`/`toPlanReport`/`toRenderReport`, con rutas siempre relativas al proyecto y POSIX
vía `toProjectRelativePath`; `.stage` del error de transcripción se renombra a `failedStage`) y
`src/report/format-report.ts` (`formatReport`, las tres reglas normativas de §4.3 y las formas
exactas por `ingest`/`plan`/`render`, más la regla de concatenación exacta para `run` sin cabecera
propia).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `formatReport` reproduce byte a byte los cuatro bloques de ejemplo de §4.3 (`ingest` con y sin
      fallos parciales, `plan`, `render`)
- [ ] Los cuatro roles de asset se imprimen siempre en el orden `aroll broll image audio`, incluso en 0
- [ ] La línea de contador de una colección nunca se omite, ni cuando el valor es 0
- [ ] Test que confirma `formatReport(runReport) === [...formatReport(ingest), ...formatReport(plan), ...formatReport(render)]`
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-007: Comandos `ingest`, `plan` y `render`

**Historia:** HU-12, HU-13, HU-14
**App:** `tools/render-cli`
**Descripción:** Implementar `src/commands/ingest-command.ts`, `plan-command.ts` y
`render-command.ts`: cada uno corre su precondición (TASK-004), invoca la lib correspondiente
(`resolveBinaries` + `ingestProject`; `autoMontage`; `readTimelineDocument` + el `TimelineRenderer`
de TASK-005), traduce cualquier error tipado con `translateLibError` (TASK-002), y mapea el
resultado a su reporte (TASK-006). Crear el fixture `src/__fixtures__/fake-cli-dependencies.ts`
(`CliDependencies` completa en memoria, sin un solo binario real), usado por los tres specs de esta
task y por TASK-008/TASK-009 en adelante.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-004, TASK-005, TASK-006
**Criterio de done:**

- [ ] `ingestCommand` propaga `probeFailures`/`transcriptionFailures` como reporte, nunca como causa
      de exit code distinto de 0 (RN-27)
- [ ] `planCommand` propaga `brollRejections` como reporte, nunca como causa de exit code distinto
      de 0 (RN-28)
- [ ] `renderCommand` invoca `resolveRenderTarget` y pasa exactamente `publicDir`/`outPath` al
      `TimelineRenderer` (CA-014, sin render real: se verifica contra el `TimelineRenderer` falso)
- [ ] Los tres comandos con un error tipado de su lib producen el `StageFailedError` correcto con la
      etapa homónima (nunca `run`)
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-008: Comando `run`

**Historia:** HU-15, HU-18
**App:** `tools/render-cli`
**Descripción:** Implementar `src/commands/run-command.ts` (`runCommand`, D-29): tres `await`
encadenados a `ingestCommand`/`planCommand`/`renderCommand`, sin capa intermedia, sin `Promise.all`;
si una etapa falla, corta ahí y propaga el error con su etapa real; si las tres completan, `RunReport`
es la suma de los tres. `renderCommand` dentro de `run` re-lee `work/timeline.json` del disco
(no reusa la `Timeline` en memoria que devolvió `planCommand`) — es la sub-decisión de D-29 que
ejercita el artefacto persistido.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-007
**Criterio de done:**

- [ ] `runCommand` corta en la primera etapa que falla y NUNCA reporta `stage: 'run'`
- [ ] Test que confirma que la etapa `render` de `run` lee `work/timeline.json` del disco (con un
      doble de `readTextFile` que se puede espiar)
- [ ] No hay ningún `Promise.all`/`allSettled`/`race` en el archivo (lint en verde lo refuerza)
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-009: `runCli` — parseo, despacho y `CliOutcome`

**Historia:** HU-15, HU-17, HU-19
**App:** `tools/render-cli`
**Descripción:** Implementar `src/cli.ts` (`runCli(argv, resolveProjectRoot, deps): Promise<CliOutcome>`
— D-23): parsea con `parseCliArgs` (TASK-003), resuelve la ruta del proyecto con
`resolveProjectRoot`, despacha al comando correspondiente (TASK-007/TASK-008), y traduce cualquier
error capturado (tipado o no) a `exitCodeFor` + `formatCliError` (TASK-002). `runCli` no lanza
nunca: en éxito, `stdout` = `formatReport(report)` y `stderr` vacío; en error, `stdout` vacío y
`stderr` = `formatCliError(error)`.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-003, TASK-008
**Criterio de done:**

- [ ] `runCli` nunca lanza: todo camino de error resuelve a un `CliOutcome` con `exitCode !== 0`
- [ ] En éxito, `stderr` está vacío; en error, `stdout` está vacío (§3)
- [ ] Test de contrato punta a punta: cada fila de la tabla de exit codes de §5.2 alcanzable desde
      `runCli` con dependencias falsas (sin binarios)
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-010: `main.ts` — única frontera de proceso

**Historia:** HU-12, HU-13, HU-14, HU-15
**App:** `tools/render-cli`
**Descripción:** Reemplazar el `src/main.ts` mínimo de TASK-001 por la implementación completa de
D-23: lee `process.argv.slice(2)`, arma `resolveProjectRoot` con `resolve(process.cwd(), raw)`,
construye `deps` con `createNodeCliDependencies(process.env)` (TASK-005), llama `runCli` (TASK-009),
vuelca `outcome.stdout` a `process.stdout` y `outcome.stderr` a `process.stderr` (nota N-1 de §9:
la interfaz real es `stdout`/`stderr`, no `lines`), y copia `outcome.exitCode` a `process.exitCode`.
Verificar ejecución real de los 4 comandos contra un proyecto de prueba desechable en `/tmp` (sin
usar `media/smoke-ingest` todavía — eso es TASK-012/TASK-013).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-009
**Criterio de done:**

- [ ] `main.ts` es el único archivo del tool que toca `process`/`console` (lint del resto del tool
      en verde con las reglas de §2.5 activas)
- [ ] `pnpm nx run render-cli:cli -- ingest <ruta-inexistente>` termina con exit code 3 y el mensaje
      de `raw-missing` o `project-root-not-found` por stderr, stdout vacío
- [ ] `pnpm nx run render-cli:cli -- run <proyecto-de-prueba> --preset software-demo` completa las
      tres etapas contra un proyecto desechable con material mínimo real (no `media/smoke-ingest`)
- [ ] `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde

---

### TASK-011: Cableado de D-4 en `aroll-series.tsx`

**Historia:** HU-20
**App:** `libs/composition-remotion` (ÚNICO archivo tocado — HC-2)
**Descripción:** Cambiar la línea 44 de
`libs/composition-remotion/src/components/aroll-series.tsx`, de
`punchInStyle(scene.transform)` a `punchInStyle(scene.transform, scene.transform.anchor)` (§6.1).
No tocar ningún otro archivo de esa lib: ni el barrel, ni el README, ni `vite.config.ts`, ni ningún
otro componente. No crear `aroll-series.spec.tsx` (§6.3: `ArollScene` no está exportado y montar
`ArollSeries` exige el contexto de frame de Remotion — sería infraestructura de test nueva en una
lib que otra rama está reescribiendo).
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `pnpm exec nx build composition-remotion` en verde (con `exactOptionalPropertyTypes: true`
      activo, prueba que el segundo argumento es del tipo esperado)
- [ ] `pnpm exec nx test composition-remotion` en verde, sin ningún archivo nuevo bajo
      `src/components/`
- [ ] `git diff --stat libs/composition-remotion` muestra solo `aroll-series.tsx`, una línea
- [ ] Si el diff necesitara tocar `vite.config.ts` o cualquier config raíz: **parar y reportar**,
      no proceder (HC-2, HC-3)

---

### TASK-012: Preparar material de smoke y documentar invocación en README

**Historia:** HU-20
**App:** `tools/render-cli` (+ `media/smoke-ingest/`, regenerable — HC-5)
**Descripción:** Regenerar `media/smoke-ingest/raw/aroll/clip01.mp4` con el script de D-35 (6 frases
separadas por 900 ms de silencio, elegidas para que `comando` y `deploy` aparezcan ≥3 veces cada
uno). Completar el `README.md` de `tools/render-cli` con la invocación de los 4 comandos (§3) y el
comando exacto de regeneración del material de smoke (D-35), tal como el README de `auto-montage`
documenta la suya. Correr el gate barato de §7.2 (`ingest` + `plan`, y verificar sobre
`work/edl.json`/`work/timeline.json` que `punchIns ≥ 1`, `keeps ≥ 6` y `anchors ≥ 1`) ANTES de
gastar el render real de TASK-013. Nunca en paralelo con nada (HC-4): Whisper corre acá, Chrome no
debe estar corriendo.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-010, TASK-011
**Criterio de done:**

- [ ] `media/smoke-ingest/raw/aroll/clip01.mp4` regenerado, con `media/video-01` y `media/video-02`
      sin tocar (HC-5)
- [ ] `README.md` de `tools/render-cli` documenta los 4 comandos y el script de regeneración de D-35
- [ ] Gate de §7.2: `punchIns ≥ 1`, `keeps ≥ 6`, `anchors ≥ 1` sobre `work/edl.json`/`work/timeline.json`
      de `media/smoke-ingest` — si da 0 en cualquiera, regenerar el material y repetir, NO avanzar a
      TASK-013 con el gate en rojo
- [ ] `pnpm sdd:validate` en verde

---

### TASK-013: Smoke manual end-to-end — CA-015 y CA-016

**Historia:** HU-20, HU-18
**App:** `tools/render-cli`
**Descripción:** Se corre UNA SOLA VEZ, al final del ciclo, siguiendo §7.3–§7.4 literal. Antes de
renderizar: `memory_pressure` y `sysctl -n kern.memorystatus_vm_pressure_level` deben decir `normal`/
`1` (HC-4); confirmar que no hay procesos de whisper/ffmpeg activos (RN-32). Render real con
`pnpm nx run render-cli:cli -- render media/smoke-ingest`; verificar con `ffprobe` que
`codec_name=h264`, `width=1080`, `height=1920`, `r_frame_rate=30/1`, `pix_fmt=yuv420p`, `nb_frames`
coincide con el reporte, y reproducir el MP4 a ojo confirmando que los punch-ins escalan desde el
tercio superior (`face-hint`, D-4). Copiar la evidencia de la primera corrida
(`smoke-ingest.mp4`, `edl.json`, `timeline.json`, `framemd5`, `shasum`) a `/tmp/smoke-run1/` antes de
borrar nada (`outPath` es fijo — D-32 — y la segunda corrida sobrescribe). Repetir con
`rm -rf media/smoke-ingest/work media/smoke-ingest/out` + `pnpm nx run render-cli:smoke` y comparar
contra el criterio ya fijado por D-34: `edl.json` byte a byte (BLOQUEANTE), `timeline.json` módulo
`probedAt` (BLOQUEANTE), `ffprobe` idéntico (BLOQUEANTE), `framemd5` idéntico (BLOQUEANTE), `shasum`
del MP4 (evidencia, NO bloqueante), y `raw/` sin cambios de contenido ni mtime (BLOQUEANTE, RN-31).
Si `framemd5` difiere, el ciclo NO cierra: se reporta al dev con los dos hashes, no se ajusta el
criterio. Dejar la evidencia de los seis pasos en `cycles/cycle-03/artifacts/smoke-ca015-ca016.md`
y referenciarla en `cycle.json["artifacts"]`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-012
**Criterio de done:**

- [ ] CA-015: MP4 reproducible, `ffprobe` confirma 1080×1920@30, `h264`, `yuv420p`
- [ ] CA-016: `edl.json` idéntico byte a byte, `timeline.json` idéntico módulo `probedAt`, `ffprobe`
      idéntico, `framemd5` idéntico entre las dos corridas
- [ ] `raw/` de `media/smoke-ingest` sin cambios de contenido ni de mtime tras la segunda corrida
- [ ] Evidencia de los seis pasos escrita en `cycles/cycle-03/artifacts/smoke-ca015-ca016.md` y
      referenciada en `cycle.json["artifacts"]`
- [ ] Si `framemd5` difiere: NO se ajusta el test/criterio — se reporta al dev con el diff completo

---

## Camino crítico

```
TASK-001 (scaffold)
  └─ TASK-002 (errores)
       ├─ TASK-003 (args)
       ├─ TASK-004 (precondiciones/rutas)
       └─ TASK-005 (render adapter)
  └─ TASK-006 (reporte)            [depende solo de TASK-001]

TASK-004 + TASK-005 + TASK-006 → TASK-007 (comandos ingest/plan/render)
TASK-007 → TASK-008 (comando run)
TASK-003 + TASK-008 → TASK-009 (runCli)
TASK-009 → TASK-010 (main.ts)

TASK-011 (D-4, independiente)
TASK-010 + TASK-011 → TASK-012 (material de smoke + README)
TASK-012 → TASK-013 (smoke real CA-015/CA-016)
```

`TASK-011` no tiene dependencia de código real con el resto (toca una lib distinta), pero se
ejecuta en este orden porque el mismo implementador la resuelve entre el cierre de la CLI (TASK-010)
y la preparación del smoke (TASK-012), que sí depende de que D-4 esté cableado para que el gate de
§7.2 tenga sentido (verificar `anchors ≥ 1` presupone que el cableado ya está hecho).

Ninguna task de este ciclo tiene contraparte frontend: `tools/render-cli` no tiene UI (regla
"frontend después de backend" no aplica).

## Riesgos y notas para el implementador

- **TASK-001 es la más atípica del repo**: primer proyecto Nx bajo `tools/`. Si el dry-run del
  generador toca cualquier config raíz, no forzar: crear los archivos a mano (D-22 ya lo prevé) y
  dejar constancia en el `journal/` del ciclo si aplica (lección real, no ruido).
- **TASK-002 antes que TASK-003** (ver nota de reordenamiento arriba): no es un error de este plan,
  es una corrección sobre el orden de agrupación sugerido, verificada contra el código real de
  `parse-cli-args.ts` en `architect.md` §4.1.
- **TASK-005 y TASK-007 son las únicas que tocan wiring real** (`node-cli-dependencies.ts`, los tres
  comandos): son las que exigen más cuidado con HC-6 (la suite no debe cargar Remotion, React ni
  binarios) — el `await import()` dentro del método es lo que lo garantiza, no la disciplina de
  cada test.
- **TASK-011 es la única que toca `libs/composition-remotion`**, y es la más chica de todo el
  ciclo (una línea). Si durante su verificación aparece cualquier necesidad de tocar algo más de esa
  lib, es una señal de que algo no calza con HC-2: parar y reportar, no improvisar.
- **TASK-013 es irrepetible dentro del ciclo**: si `framemd5` da distinto, no hay ajuste de test que
  la salve — es una falla real de determinismo que hay que reportar, no ocultar.

## Pendiente de documentar en contexto

- **TASK-001 — `tools/render-cli/eslint.config.mjs` NO se creó.** El hook `config-protection` del
  harness del dev (plugin de usuario `everything-claude-code`, no versionado en este repo) bloquea
  cualquier `Write`/`Edit` sobre un archivo cuyo *basename* sea `eslint.config.mjs`, sin distinguir
  si es la config raíz o la de un proyecto (mismatch confirmado leyendo
  `scripts/hooks/config-protection.js`: matchea por `path.basename`). El implementador paró en vez de
  rodearlo con `Bash`, se consultó y se decidió NO crear el archivo en este ciclo: el executor
  `@nx/eslint:lint` resuelve el flat config más cercano hacia arriba, así que `nx lint render-cli`
  usa el `eslint.config.mjs` de la raíz, que ya trae la regla fallback de boundaries
  (`{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`) — HC-3 se cumple igual. Lo que falta son
  los guardrails **extra** de §2.5 del `architect.md` (`no-restricted-imports/globals/properties`:
  nada de `node:fs`/`child_process`/`node:path` fuera de los puertos, nada de `Promise.all`/
  `allSettled`/`race`, nada de `.stack`, solo el subpath `/render` de `composition-remotion`,
  `process`/`console` solo en `main.ts`). **Todas las tasks siguientes del ciclo (TASK-002 a
  TASK-010) sostienen estas reglas a mano, por convención, sin el refuerzo de lint.** Es reversible
  en un solo paso cuando el dev habilite la excepción del hook: agregar el archivo tal cual está en
  §2.5, sin tocar ninguna línea de código existente.
- **TASK-001 — desviación del `command` literal de `smoke` en §2.3.** El literal del architect
  (`"...run {workspaceRoot}/media/smoke-ingest..."`) hace fallar la validación de Nx 23
  (`target-merging.js`: el token `{workspaceRoot}` solo se resuelve si está al **inicio absoluto**
  del valor de la opción completa, no de un token intermedio dentro de un `command` compuesto —
  error `The {workspaceRoot} token is only valid at the beginning of an option`), y ese error se
  dispara al validar el `project.json` completo (incluso invocando solo el target `cli`). Se quitó
  `{workspaceRoot}/` y quedó `"...run media/smoke-ingest..."`: sin `cwd` en el target (D-36 ya
  vigente), `nx:run-commands` corre desde la raíz del workspace, así que la ruta relativa resuelve
  igual — verificado imprimiendo el proyecto resuelto (`resolveMediaProject(process.cwd())` da
  `slug=video-maker`, la raíz del repo). No cambia ningún comportamiento descrito en D-36/§3, solo
  la sintaxis del token.
- **TASK-003 — `reason` para `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` y
  `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL` no está en el literal del architect.** D-24/§4.1 solo fija
  el `reason` de `ERR_PARSE_ARGS_UNKNOWN_OPTION` (`unknown-option`, vía la fila de §5.2). Para los
  otros dos códigos que D-24 manda traducir "por code", usé `invalid-option-value` y
  `unexpected-positional` (reusando este último nombre del paso 4 del algoritmo, ya que ambos
  describen el mismo síntoma observable). Verificado empíricamente (`node -e "parseArgs(...)"`,
  Node 22) que con la config `{ preset:{type:'string'}, seed:{type:'string'}, allowPositionals:true,
  strict:true }` de D-24, `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL` nunca se dispara en la práctica
  (`allowPositionals:true` lo hace estructuralmente imposible); la rama queda como traducción
  defensiva/completa por si Node cambia de comportamiento, sin cobertura de test (línea marcada en
  el reporte de cobertura, umbral global igual en verde). También verificado que `--seed -1`
  (separado en dos tokens) es ambiguo para `parseArgs` y cae en `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`
  antes de llegar a la validación propia de la CLI — por eso el ejemplo `--seed=-1` de §5.3 usa
  sintaxis `=`, no dos tokens; los tests de `parse-cli-args.spec.ts` cubren ambos caminos.
- **TASK-006/TASK-007 — `toIngestReport` quedó con un solo parámetro, distinto de §4.2.** El
  literal del architect declara `toIngestReport(result: IngestResult, project: MediaProject):
  IngestReport`, pero verificado que `IngestResult.catalogPath` y `probeFailures[].path` ya vienen
  relativos al proyecto desde `auto-montage` (`catalogPath()`, `finding.relativePath`) — a
  diferencia de `RenderOutcome.outPath` (absoluto), que sí necesita `toProjectRelativePath` en
  `toRenderReport`, que sí conserva sus dos parámetros. En TASK-006 mantuve el `project` sin usar
  por fidelidad literal (costaba 1 warning de lint); en TASK-007, al escribir el call site en
  `ingest-command.ts`, se decidió sacarlo: un parámetro sin uso es engañoso (sugiere
  relativización que no ocurre) y el repo tiene línea de base de cero warnings propias — la de
  `apps/web` es preexistente y ajena, no es precedente. Firma final:
  `toIngestReport(result: IngestResult): IngestReport`. `to-reports.spec.ts` actualizado.
- **TASK-008 — bug real en `fake-cli-dependencies.ts` (TASK-007), corregido acá.** `statFile` y
  `readDirectory` solo miraban `filesByPath` (los archivos sembrados), nunca `writtenFiles` (lo que
  el propio comando escribe con `writeTextFile` durante el test). En TASK-007 no se notaba porque
  cada spec de comando sembraba directamente lo que su propia precondición necesitaba. `run-command`
  fue la primera prueba real de la cadena completa (`ingest` escribe `catalog.json` → `plan` lo lee
  vía su precondición) y expuso el gap: `assertCatalogExists` fallaba con `catalog-missing` aunque
  `ingestCommand` ya lo había escrito. Corregido para que `statFile`/`readDirectory` reflejen
  también `writtenFiles` — usado por `ingest-command.spec.ts`/`plan-command.spec.ts` sin cambios
  porque ninguno de los dos dependía de ese camino, y ahora correcto para TASK-009/TASK-010 en
  adelante.
- **TASK-010 — `nx run render-cli:cli` no propaga el exit code real del proceso.** Verificado
  con `ingest` sobre una ruta inexistente: el proceso real termina con `process.exitCode = 3`
  (confirmado invocando `node -r ./tools/render-cli/src/cli-register.cjs tools/render-cli/src/main.ts`
  directamente, sin Nx, `$? = 3`), pero `pnpm nx run render-cli:cli -- ...` normaliza cualquier
  fallo del `nx:run-commands` a su propio `$? = 1` (comportamiento genérico de Nx, no de la CLI).
  El contrato de `main.ts`/`runCli` es correcto y está probado; lo que no es literal es "termina
  con exit code 3" **a través de Nx** — sí lo hace invocando el binario directamente. No hay nada
  que arreglar en el tool: si un consumidor futuro (`apps/render-api`, `spec-005`) necesita el
  código exacto, invoca el binario, no el target de Nx.
- **TASK-012 — el script de verificación de §7.2 no matchea el schema real de `EditDecisionList`.**
  El literal (`e.keeps.length`, `e.punchIns.length`, `(e.transitions??[]).length`) asume arrays
  top-level separados. El schema real (`EditDecisionListSchema` de `timeline-core`) tiene un único
  array `decisions`, discriminado por `type` (`keep | cut | punch-in | transition | caption-group |
  duck`) — verificado corriendo el gate de verdad contra el material regenerado: `e.punchIns` es
  `undefined` y `e.keeps` también. La forma correcta es contar por `type`. Corregido y documentado
  en el README del tool (sección "Gate barato antes de renderizar"), con el resultado real de esta
  corrida: `keep: 6, cut: 5, punch-in: 2, transition: 1, caption-group: 20, duck: 6` y `anchors: 2`
  — las tres condiciones bloqueantes (`keep ≥ 6`, `punch-in ≥ 1`, `anchors ≥ 1`) se cumplen.
- **TASK-012 — regenerar el A-roll con 6 frases (D-35) expuso un segundo problema real, no
  cosmético: `raw/audio/music01.mp3` (8 s) quedó más corto que la duración editada (18.2 s) y
  `autoMontage` rechazaba la Timeline con `TIMELINE_INVALID` / `CLIP_EXCEEDS_ASSET`.** Diagnostiqué
  con un probe descartable (`tools/.probe/`, borrado al terminar) que corrió `autoMontage` directo
  y volcó `error.issues`. D-35 solo preveía regenerar el A-roll; extendí `music01.mp3` haciendo
  loop del propio clip con `ffmpeg -stream_loop 4 ... -c copy` (8 s → 40.2 s, mismo contenido, sin
  sintetizar audio nuevo) — motivo y comando documentados en el README para que la próxima
  regeneración no vuelva a pisar la misma piedra si el A-roll se alarga más.
