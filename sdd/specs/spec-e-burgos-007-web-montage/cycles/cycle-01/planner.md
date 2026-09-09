# Sprint Plan — Ciclo 1 — Web Montage (montage-job-api)

> **Input:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/functional.md,
> sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/architect.md
> **Output:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                                          |
| -------------------- | --------------------------------------------------------------- |
| Ciclo                 | 1                                                                |
| Módulo                | web-montage                                                      |
| Fase                  | montage-job-api                                                  |
| App                   | apps/render-api                                                  |
| Flow                  | full                                                             |
| Implementador         | Uno solo (backend), reanudado task tras task, sin paralelismo    |
| Duración estimada     | ~2 semanas (57h ÷ ~6h efectivas/día ≈ 9-10 días hábiles)         |
| Story points totales  | 65                                                                |
| Cantidad de tasks     | 20 (todas `[BE]`; no hay frontend en este ciclo — `apps/web` es cycle-02) |

---

## Tasks Backend

### TASK-001: Modelo de datos de la cola — unión discriminada Job/JobKind

**Historia:** HU-01, HU-05
**App:** apps/render-api
**Descripción:** Generalizar `render-job.ts` a `Job = RenderJob | MontageJob` (§2 del architect):
`JobKind`, `MONTAGE_STAGES`/`MontageStage`, `MontageJobProgress`, `MontageJobReport`, `JobBase`,
`CreateJobInput`/`CreateRenderJobInput`/`CreateMontageJobInput`, y generalizar
`toRenderJob`/`toRenderJobSummary` a `toJob`/`toJobSummary` (switch exhaustivo sobre `kind`).
`RenderJobSummary` se mantiene como alias de `JobSummary`. Ningún campo existente de `RenderJob`
cambia de nombre, tipo ni posición (RNF-2).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `Job`/`JobKind`/`MontageJobProgress`/`MontageJobReport`/`CreateJobInput` compilan y son
      exhaustivos (ningún campo de montaje se filtra a `RenderJob` ni viceversa).
- [ ] `toJob`/`toJobSummary` cubiertos por test con ambos `kind`.
- [ ] `render-job.spec.ts` verifica que los 7 campos de `JobBase` no cambian de nombre/tipo.

---

### TASK-002: Códigos de error nuevos y su mapeo HTTP

**Historia:** HU-03, HU-07
**App:** apps/render-api
**Descripción:** Agregar los 7 códigos de §7 (`JOB_KIND_INVALID`, `MONTAGE_PRESET_INVALID`,
`MONTAGE_SEED_INVALID`, `MONTAGE_OVERWRITE_INVALID`, `TIMELINE_ALREADY_EXISTS`,
`MONTAGE_RAW_MISSING`, `MONTAGE_INPUT_INVALID`, `MONTAGE_FAILED` — 8 en total, la tabla lista 8
filas) a `render-api-error.ts` con `stage` ensanchado a `RenderPipelineStage | MontageStage | null`,
su mapeo en `http-status-for.ts` y sus mensajes en `to-error-payload.ts`. Los códigos reusados
(`MEDIA_BINARY_NOT_FOUND`, `CATALOG_UNREADABLE`, etc.) no se tocan.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001 (tipo `MontageStage` para ensanchar `stage`)
**Criterio de done:**

- [ ] Los 8 códigos nuevos existen en `render-api-error.ts` y compilan contra `stage: RenderPipelineStage | MontageStage | null`.
- [ ] `http-status-for.spec.ts` verifica el mapeo HTTP exacto de cada uno (422/409/503/500 según §7).
- [ ] `to-error-payload.spec.ts` verifica que el mensaje nunca expone una ruta de archivo del disco (RF de HU-07).

---

### TASK-003: Cuarto binario de media

**Historia:** HU-09
**App:** apps/render-api
**Descripción:** Extender `MEDIA_BINARY_NAMES` (`media-binaries.ts`) de dos a los cuatro nombres
(ffmpeg, ffprobe, whisper-cli, modelo de Whisper) que `resolveMontageBinaries` necesita.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `MEDIA_BINARY_NAMES` tiene 4 entradas; `pnpm nx run render-api:build` compila sin cambiar la
      fórmula de `status` de `GET /health` (§8.5, verificado en TASK-019).

---

### TASK-004: Puertos nuevos en RenderApiDependencies

**Historia:** HU-02, HU-04, HU-09
**App:** apps/render-api
**Descripción:** Agregar los 4 puertos de §3 (`readDirectory`, `statFile`, `createCommandRunner`,
`resolveMontageBinaries`) a la interfaz `RenderApiDependencies`, tipados contra
`@video-maker/auto-montage` (tipo) y `@video-maker/media-local` (tipo) — sólo tipos, sin
implementación real (esa es TASK-005).
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `RenderApiDependencies` compila con los 4 puertos nuevos declarados; ningún archivo de
      `apps/render-api/src` fuera de `node-render-api-dependencies.ts` importa un VALOR de
      `@video-maker/media-local` (sólo tipos) — grep de verificación.

---

### TASK-005: Adaptador de producción de los cuatro puertos nuevos

**Historia:** HU-09
**App:** apps/render-api
**Descripción:** Implementar en `node-render-api-dependencies.ts` los 4 puertos: import estático de
`nodeDirectoryReader`/`nodeFileStatReader` (`@video-maker/auto-montage`), y `createCommandRunner`/
`resolveMontageBinaries` vía `await import()` de `@video-maker/media-local` (frontera única de la
constitución).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-003, TASK-004
**Criterio de done:**

- [ ] `node-render-api-dependencies.spec.ts` verifica que `resolveMontageBinaries` llama a
      `resolveBinaries(env)` con las 4 variables de entorno.
- [ ] Ningún import estático nuevo de `@video-maker/media-local` fuera de este archivo (grep).

---

### TASK-006: Dobles de test — fake-command-runner y fake-render-api-dependencies

**Historia:** HU-02, HU-04
**App:** apps/render-api
**Descripción:** Crear `fake-command-runner.ts` (implementación local mínima de `CommandRunner`,
import **type** únicamente de `@video-maker/media-local`, rutas `bin → respuesta` configurables) y
agregar a `fake-render-api-dependencies.ts` los dobles de los 4 puertos nuevos de TASK-004. Sin
`.spec.ts` propio (son fixtures, mismo criterio que `fake-object-storage.ts`/`call-log.ts`).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] `fake-command-runner.ts` no importa ningún VALOR de `@video-maker/media-local` (sólo el tipo
      `CommandRunner`) — grep de verificación, es la garantía que D-5/§3 exige.
- [ ] `fake-render-api-dependencies.ts` expone los 4 puertos nuevos con defaults deterministas.

---

### TASK-007: Validadores puros de preset/seed/overwrite

**Historia:** HU-02, HU-07
**App:** apps/render-api
**Descripción:** `montage-job-params.ts`: `parseMontagePreset`/`parseMontageSeed`/
`parseMontageOverwrite` (§4.4, pasos 3-5), funciones puras sin I/O, con sus defaults
(`software-demo`, `0`, `false`) y sus rechazos (`422 MONTAGE_PRESET_INVALID`/`MONTAGE_SEED_INVALID`/
`MONTAGE_OVERWRITE_INVALID`).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Los 3 validadores testeados sin ningún doble (son puros).
- [ ] Casos límite cubiertos: `seed` no entero, `seed` negativo, `seed` string, `preset` inexistente,
      `overwrite` no boolean.

---

### TASK-008: Fórmula de porcentaje de progreso del montaje

**Historia:** HU-04
**App:** apps/render-api
**Descripción:** `montage-job-progress.ts::montageProgressPercent` (§5.2), símbolo propio (no reusa
`progressPercent` de render), con `Math.min(100, ...)` y `total <= 0 → null`.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Test cubre `total <= 0 → null`, `processed === total → 100`, `processed > total` (no supera 100).

---

### TASK-009: Tipos de observador de progreso y cancelación del pipeline de montaje

**Historia:** HU-04, HU-06
**App:** apps/render-api
**Descripción:** `montage-pipeline-observer.ts`, mirror de `render-pipeline-observer.ts`:
`MontagePipelineObserver`, `MontagePipelineCanceledError`, `isMontagePipelineCanceled`, y la función
`checkpoint()` que la pipeline (TASK-014) invoca en los dos únicos puntos de control.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001 (tipo `MontageStage`)
**Criterio de done:**

- [ ] `isMontagePipelineCanceled` distingue el error propio de cualquier otro `Error`.
- [ ] `checkpoint()` testeado con observer cancelado y no cancelado.

---

### TASK-010: Decorador del CommandRunner que observa discover/probe/transcribe/plan

**Historia:** HU-04
**App:** apps/render-api
**Descripción:** `montage-command-runner-decorator.ts::createStageObservingCommandRunner` (§5.3):
clasificación por **igualdad exacta de ruta** (nunca `.includes()`), pass-through exacto de
`args`/`opts`/`result`, incremento de `assetProcessed` sólo en `ffprobe` y en `whisperCli` (no en
`ffmpeg` de extracción de audio).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001, TASK-006 (usa `fake-command-runner.ts` como runner de base a decorar)
**Criterio de done:**

- [ ] Secuencia monotónica testeada: `probe` nunca retrocede a `discover`, `transcribe` nunca
      retrocede a `probe`.
- [ ] Un catálogo previo completo (sin invocaciones de `ffprobe`) nunca dispara `stageStarted('probe')`.
- [ ] Clasificación por **igualdad exacta** de ruta verificada con dos binarios de nombre similar.

---

### TASK-011: project-scope expone la precondición de sobreescritura

**Historia:** HU-03
**App:** apps/render-api
**Descripción:** `assertTimelineNotPersisted(deps, project, overwrite)` en `project-scope.ts` (§4.4
paso 6, ubicación literal del architect): si `overwrite === false` y el `stat` de
`timelinePath()`/`toAbsolutePath()` no es `null` → `409 TIMELINE_ALREADY_EXISTS`. Con
`overwrite === true` no se llama ni siquiera al `stat`. No reusa `readStoredTimeline` (D-6, §1.3):
usa un `stat` simple, así que un `work/timeline.json` corrupto también cuenta como "existe".
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-002 (código `TIMELINE_ALREADY_EXISTS`)
**Criterio de done:**

- [ ] `overwrite: true` no invoca `deps.storage.stat` (test de espía/call-log).
- [ ] Un timeline con JSON corrupto en disco sigue disparando `409` (D-6).

---

### TASK-012: Precondiciones de montaje — proyecto ingestable y timeline no persistida

**Historia:** HU-02, HU-03, HU-07
**App:** apps/render-api
**Descripción:** `montage-preconditions.ts`: `assertMontageProjectIsIngestable` (replica
`assertProjectIsIngestable` del CLI — `raw/` con al menos un directorio de rol legible, si no
`422 MONTAGE_RAW_MISSING`) y `assertTimelineNotPersisted` como función de este módulo que se apoya
en el `stat` que `project-scope.ts` (TASK-011) expone — ver nota de interpretación al final de este
documento sobre la relación entre ambos archivos.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002, TASK-004, TASK-006, TASK-011
**Criterio de done:**

- [ ] `assertMontageProjectIsIngestable` falla **sin invocar** `deps.createCommandRunner` (CA-003,
      verificado con `call-log`/espía).
- [ ] Fixture de proyecto sin subdirectorios de rol dispara `MONTAGE_RAW_MISSING`.

---

### TASK-013: Traductor de errores del motor de montaje

**Historia:** HU-07
**App:** apps/render-api
**Descripción:** `translate-montage-error.ts::translateMontageError` (mirror estructural de
`translate-engine-error.ts`, por `.code`, nunca `instanceof`): mapea `BINARY_NOT_FOUND` →
`MEDIA_BINARY_NOT_FOUND`, `CATALOG_UNREADABLE`, `TIMELINE_INVALID`/`EDL_INVALID`,
`MONTAGE_INPUT_INVALID`, catch-all → `MONTAGE_FAILED`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] Las 5 ramas de la función testeadas con un `cause` fixture por rama.
- [ ] Un `RenderApiError` ya construido pasa sin re-envolver (`isRenderApiError(cause)`).

---

### TASK-014: Orquestación del pipeline de montaje (run-montage-pipeline) con cancelación cooperativa

**Historia:** HU-02, HU-04, HU-06
**App:** apps/render-api
**Descripción:** `run-montage-pipeline.ts::runMontagePipeline` (§6): precondición →
`discoverAssets` (una vez, sólo para `totalAssets`) → `resolveMontageBinaries` →
`createCommandRunner` decorado (TASK-010) → `ingestProject` (etapas `discover`→`probe`→
`transcribe`) → checkpoint → `autoMontage` (etapa `plan`). Cancelación: sólo dos checkpoints
posibles (antes de `ingestProject`, antes de `autoMontage`); un job cancelado en `plan` deja
`work/catalog.json` completo en disco pero reporta `canceled`/`report: null` (CA-023). Se omite a
propósito un `assertCatalogExists` equivalente al del CLI (guard sobre condición imposible, §6).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-004, TASK-006, TASK-009, TASK-010, TASK-012, TASK-013
**Criterio de done:**

- [ ] Orden de llamadas verificado con `callLog`: `ingestProject` antes que `autoMontage`, siempre.
- [ ] Cancelación en el checkpoint de `plan` deja `report: null` aunque `catalog.json` exista (doble
      de `writeCatalog` que sí escribió).
- [ ] `totalAssets` = `findings.length` de la llamada standalone a `discoverAssets`, descartado
      después (no reutilizado).

---

### TASK-015: La cola despacha jobs de montaje (dispatch por kind, cancelación, FIFO única)

**Historia:** HU-06, HU-08
**App:** apps/render-api
**Descripción:** `render-job-queue.ts`: `runJob()` gana una rama `kind === 'montage'` que invoca
`runMontagePipeline` (TASK-014), mirror exacto de la rama `render` existente. `records`/`pending`/
`dispatchNext()` no cambian (ya agnósticos, §1.1). `cancel()` se verifica también para `kind:
'montage'`.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-014
**Criterio de done:**

- [ ] Un job `montage` cancelado mientras está `pending` nunca invoca `runMontagePipeline` (CA-021).
- [ ] Un `montage` y un `render` encolados juntos nunca corren en simultáneo (RN-7/CA-028,
      verificado con `callLog` de orden de ejecución).

---

### TASK-016: Variante 'empty' de la lectura del body JSON

**Historia:** HU-01
**App:** apps/render-api
**Descripción:** `read-json-body.ts`: agregar `{ kind: 'empty' }` a `JsonBodyResult`, devuelto cuando
el body tiene cero bytes (nunca `JSON.parse('')`, que hoy cae en `'invalid-json'`).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Body de cero bytes → `{ kind: 'empty' }`, nunca `{ kind: 'invalid-json' }`.
- [ ] Body con JSON sintácticamente inválido sigue dando `{ kind: 'invalid-json' }` (sin regresión).

---

### TASK-017: montage-handler preserva el rechazo de body vacío en PUT timeline/EDL

**Historia:** HU-01
**App:** apps/render-api
**Descripción:** `handlePutTimeline`/`handlePutEditDecisionList` (`montage-handler.ts`) agregan la
rama explícita `bodyResult.kind === 'empty' → mismo error que 'invalid-json'` (§4.1), para no
cambiar el comportamiento vigente de esos dos endpoints.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-016
**Criterio de done:**

- [ ] `PUT` de timeline/EDL con body vacío sigue respondiendo `REQUEST_BODY_INVALID_JSON` byte por
      byte igual que antes de este ciclo (test de regresión explícito).

---

### TASK-018: Handler de jobs con discriminante kind — POST/GET, validación de parámetros y 409

**Historia:** HU-01, HU-02, HU-03, HU-05, HU-07
**App:** apps/render-api
**Descripción:** `jobs-handler.ts` (§4 completo, §8.1/§8.2): `resolveJobKind` (§4.2, `422
JOB_KIND_INVALID`), rama `render` sin cambios de comportamiento (§4.3), rama `montage` con el orden
exacto de §4.4 (slug → proyecto → preset → seed → overwrite → `assertTimelineNotPersisted` →
`runtime.jobs.create`). `handleListRenderJobs`/`handleGetRenderJob` exponen `kind` en
`JobSummary`/`Job` sin tocar ningún campo existente (RNF-2).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-002, TASK-006, TASK-007, TASK-011, TASK-012, TASK-015, TASK-016
**Criterio de done:**

- [ ] Body ausente/`{}`/`{"kind":"render",...}` producen el mismo `RenderJob` byte a byte que antes
      de este ciclo (CA-001/002/003, `Object.keys(body).sort()` contra la lista de §8.1).
- [ ] `{"kind":"montage"}` sin `overwrite` sobre proyecto con timeline previa → `409` sin job
      registrado y sin ningún archivo tocado (CA-009/010 de functional.md).
- [ ] `Object.keys(entry).sort()` de `GET /projects/:slug/jobs` y de `GET /jobs/:jobId` verificados
      contra las listas exactas de §8.2/§8.3.

---

### TASK-019: GET /health reporta los cuatro binarios y capabilities.montageQueue

**Historia:** HU-09
**App:** apps/render-api
**Descripción:** `health-handler.ts` (§8.5): `binaries` pasa de 2 a 4 entradas (vía
`MEDIA_BINARY_NAMES` extendido, TASK-003), `capabilities.montageQueue: true` agregado, sin tocar la
fórmula de `status` (`engine.every(loaded) && binaries.every(resolved)`) ni el campo `cycle` (D-8).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003, TASK-004, TASK-006
**Criterio de done:**

- [ ] `binaries.length === 4`.
- [ ] Falta de `WHISPER_MODEL_PATH` (u otra de las 4) → `status: 'degraded'` (CA-032 de
      functional.md).
- [ ] `Object.keys(body).sort()` == `['binaries','capabilities','cycle','engine','jobs','service','status','time']`.

---

### TASK-020: README + SMOKE REAL end-to-end (binario arrancable con el job de montaje)

**Historia:** HU-02, HU-04, HU-06, HU-07, HU-09
**App:** apps/render-api
**Descripción:** Documentar en `README.md` el tipo de job `montage`, sus parámetros, sus etapas, los
códigos de error nuevos, las 4 variables de entorno de los binarios, y pegar tal cual el guion de
§12 del architect. **Correr ese guion contra el binario real** (no describirlo sin ejecutar):
levantar `apps/render-api` sobre una copia temporal de `media/smoke-ingest/raw`, disparar un job
`montage`, verificar `sha256` de los 3 artefactos contra los de `media/smoke-ingest/work`, probar
que el oráculo es sensible (`seed` distinto → hash distinto), y encadenar un job `render` verificado
con `ffprobe` contra el stream de video. Registrar la salida real (hashes, estados, tiempos) en
`artifacts/task-020-smoke-notes.md`.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-005, TASK-018, TASK-019
**Criterio de done:**

- [ ] `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` vacío y ≥35% memoria libre **antes** de arrancar.
- [ ] Los 3 `sha256` (`catalog.json`/`timeline.json`/`edl.json`) idénticos a los de
      `media/smoke-ingest/work` (CA-012 de functional.md).
- [ ] `seed: 1` produce un `timeline.json` con hash **distinto** al de `seed: 0` — corrida a
      propósito y registrada (CA-014 de la §13 del architect).
- [ ] Job `render` encadenado: `nb_frames`/`r_frame_rate` verificados contra el stream de video
      (nunca `format.duration`).
- [ ] `media/smoke-ingest`, `media/video-01`, `media/video-02` sin tocar (`git status` vacío sobre
      esas rutas al terminar).
- [ ] `artifacts/task-020-smoke-notes.md` con la evidencia real (hashes, estados, timestamps).

---

## Orden de ejecución

```
TASK-001 (modelo Job/JobKind)
  → habilita TASK-002 (códigos de error, usa MontageStage)
  → habilita TASK-009 (observer, usa MontageStage)
  → habilita TASK-010 (decorador, usa MontageStage)
  → habilita TASK-014, TASK-015, TASK-018 (consumen Job/CreateJobInput directamente)

TASK-002 (códigos de error + mapeo HTTP)
  → habilita TASK-011 (TIMELINE_ALREADY_EXISTS)
  → habilita TASK-012 (MONTAGE_RAW_MISSING, TIMELINE_ALREADY_EXISTS)
  → habilita TASK-013 (traductor de errores)
  → habilita TASK-018 (handler consume los 8 códigos)

TASK-003 (4 binarios) + TASK-004 (4 puertos, en paralelo lógico, sin dependencia mutua)
  → ambas habilitan TASK-005 (adaptador real)
  → TASK-004 habilita TASK-006 (fixtures)
  → TASK-003 + TASK-004 habilitan TASK-019 (health-handler)

TASK-005 (adaptador de producción)
  → habilita TASK-020 (smoke real necesita el adaptador real, no los fixtures)

TASK-006 (fixtures fake-command-runner / fake-render-api-dependencies)
  → habilita TASK-010 (decorador testeado con el runner fake)
  → habilita TASK-012 (precondiciones testeadas con los puertos fake)
  → habilita TASK-014 (pipeline testeado con ambos fixtures — regla dura del brief)
  → habilita TASK-018, TASK-019 (handlers testeados con RenderApiDependencies fake completo)

TASK-007 (validadores preset/seed/overwrite) → habilita TASK-018

TASK-008 (fórmula de percent) → no bloquea a nadie más (consumida directamente dentro de TASK-014
  al construir MontageJobProgress, sin pasar por un archivo intermedio — dependencia de contenido,
  no de import formal)

TASK-009 (observer/cancelación) → habilita TASK-014

TASK-010 (decorador) → habilita TASK-014

TASK-011 (project-scope: stat de timeline) → habilita TASK-012, TASK-018

TASK-012 (precondiciones de montaje) → habilita TASK-014, TASK-018

TASK-013 (traductor de errores) → habilita TASK-014

TASK-014 (run-montage-pipeline) → habilita TASK-015

TASK-015 (cola despacha por kind) → habilita TASK-018

TASK-016 ('empty' body) → habilita TASK-017, TASK-018

TASK-017 (montage-handler preserva 'empty') → no bloquea a nadie más (hoja de este subárbol)

TASK-018 (jobs-handler completo) → habilita TASK-020

TASK-019 (health-handler) → habilita TASK-020

TASK-020 (README + smoke real) → cierra el ciclo, no habilita nada (última task)
```

**Camino crítico** (la cadena más larga de dependencias obligatorias):
`TASK-001 → TASK-002 → TASK-011 → TASK-012 → TASK-014 → TASK-015 → TASK-018 → TASK-020`
(8 tasks, 6+4+2+3+6+4+6+4 = 35h de las 57h totales — el resto son ramas que un único
implementador intercala pero que no alargan el camino mínimo).

---

## Definición de "done" por task — comando y símbolos de §13 cubiertos

Comando base para toda task de este ciclo (ningún archivo de `apps/web`, `libs/*` ni `tools/*` se
toca, así que basta con el proyecto):

```bash
pnpm nx run render-api:test        # unit + specs de la task
pnpm nx run-many -t lint test build # antes de cerrar TASK-014, TASK-015, TASK-018 y TASK-020 (los
                                     # puntos de mayor riesgo de romper algo fuera de render-api)
```

| Task | Comando de verificación | Símbolos de §13 cubiertos |
| --- | --- | --- |
| TASK-001 | `pnpm nx run render-api:test -- render-job` | Base de CA-001/002/004/005/008/009 (tipos) |
| TASK-002 | `pnpm nx run render-api:test -- render-api-error http-status-for to-error-payload` | Base de CA-001..CA-009 (códigos que todas las demás tasks disparan) |
| TASK-003 | `pnpm nx run render-api:build` | Base de CA-009 |
| TASK-004 | `pnpm nx run render-api:build` | Base de CA-003, CA-006, CA-009 |
| TASK-005 | `pnpm nx run render-api:test -- node-render-api-dependencies` | Base de CA-009 (adaptador real) |
| TASK-006 | `pnpm nx run render-api:build` (fixtures sin spec propio) | Base de CA-003, CA-006, CA-009 |
| TASK-007 | `pnpm nx run render-api:test -- montage-job-params` | **CA-004** |
| TASK-008 | `pnpm nx run render-api:test -- montage-job-progress` | Base de CA-006 |
| TASK-009 | `pnpm nx run render-api:test -- montage-pipeline-observer` | Base de CA-003 (cancelación) |
| TASK-010 | `pnpm nx run render-api:test -- montage-command-runner-decorator` | **CA-006, CA-007** |
| TASK-011 | `pnpm nx run render-api:test -- project-scope` | Base de CA-005 |
| TASK-012 | `pnpm nx run render-api:test -- montage-preconditions` | Base de **CA-003** (parte 2: `assertMontageProjectIsIngestable`) |
| TASK-013 | `pnpm nx run render-api:test -- translate-montage-error` | Base de CA-003 (traducción de errores del pipeline) |
| TASK-014 | `pnpm nx run render-api:test -- run-montage-pipeline` | **CA-003** (parte 1: orden `ingestProject`→`autoMontage`) |
| TASK-015 | `pnpm nx run render-api:test -- render-job-queue` | **CA-008** |
| TASK-016 | `pnpm nx run render-api:test -- read-json-body` | Base de CA-001 |
| TASK-017 | `pnpm nx run render-api:test -- montage-handler` | Base de CA-001 (regresión PUT) |
| TASK-018 | `pnpm nx run render-api:test -- jobs-handler` | **CA-001, CA-002, CA-004** (parte handler), **CA-005** |
| TASK-019 | `pnpm nx run render-api:test -- health-handler` | **CA-009** |
| TASK-020 | Guion real de §12 (README) + `git diff --stat apps/web package.json pnpm-lock.yaml` + `pnpm sdd:validate` | **CA-010, CA-011, CA-012, CA-013, CA-014, CA-015, CA-016** |

**Nota sobre CA-003, CA-004 y CA-006** (arquitectura de la tabla §13 del architect): estos tres CA
citan **dos** archivos de test cada uno. Por la regla de este planner ("cada CA a exactamente una
task"), quedan **cerrados** en la task más tardía de las dos (donde la verificación es end-to-end):
CA-003 cierra en TASK-014 (TASK-012 deja la mitad — `assertMontageProjectIsIngestable`— lista pero
la integración completa del orden de llamadas sólo se ve en `run-montage-pipeline.spec.ts`); CA-004
cierra en TASK-018 (TASK-007 deja los validadores puros testeados, pero el CA describe el
comportamiento observado por HTTP); CA-006 cierra en TASK-010 (TASK-008 deja la fórmula pura, pero
el CA describe la secuencia observada a través del decorador).

Todos los CA de la tabla §13 (CA-001 a CA-016) quedan asignados a exactamente una task en la
columna de arriba.

---

## Riesgos de secuencia

- **Primera task que puede romper la suite de `apps/render-api` (307 tests hoy): TASK-001.**
  Generalizar `RenderJob` a `Job` y `toRenderJob`/`toRenderJobSummary` a `toJob`/`toJobSummary`
  toca el tipo que **todo** el resto de la suite de jobs ya importa (`render-job-queue.spec.ts`,
  `jobs-handler.spec.ts`, cualquier fixture que construya un `RenderJob` a mano). Si el switch
  exhaustivo del nuevo `toJob` no preserva exactamente los mismos campos en la rama `render`, la
  ruptura aparece en specs que hoy pasan y que esta task no toca directamente — por eso
  `pnpm nx run-many -t lint test build` es obligatorio al cerrar TASK-001, no sólo
  `render-api:test`, aunque la tabla de arriba lo marque recién como obligatorio desde TASK-014.
  **Corrección:** agregar `pnpm nx run-many -t lint test build` también al cierre de TASK-001.
- **Segunda task de riesgo alto: TASK-018** (jobs-handler). Es el punto donde las dos ramas
  (`render`/`montage`) conviven en el mismo handler; un error en `resolveJobKind` o en el orden de
  §4.4 puede romper silenciosamente CA-001/002/003 (retro-compatibilidad) sin que ningún test de
  montaje lo detecte — sólo los tests de la rama `render` lo detectan. Verificar explícitamente que
  los tests de la rama `render` de `jobs-handler.spec.ts` siguen en verde ANTES de dar por cerrada
  la rama `montage`.
- **Primera task que verifica que `apps/web` sigue verde sin tocarla: TASK-020**, con
  `pnpm nx run web:test` + `git diff --stat apps/web` (vacío) — es la única task de este ciclo con
  ese comando en su criterio de done, y corre al final a propósito: recién ahí existe la superficie
  completa (contrato + implementación) que podría, en teoría, haber roto algo que `apps/web`
  consume. Riesgo mitigado por TASK-002 documentando que ningún campo publicado cambia de nombre
  (RNF-2) y por el `Object.keys(...).sort()` de TASK-018, pero la verificación real contra la suite
  de 307 tests de `apps/web` no ocurre antes de TASK-020.

---

## Discrepancias con la lista cerrada del architect

Ninguna. Los 24 archivos de la §10 (8 creados + 16 modificados, `sdd/api.json` excluido porque el
arquitecto ya lo actualizó) quedaron mapeados 1:1 en `files[]` de las 20 tasks — ningún archivo
fuera de esa lista aparece en `tasks.json`, y ningún archivo de la lista quedó sin task dueña
(excepto `apps/render-api/README.md`, que sí está en TASK-020, y el artefacto de evidencia del
smoke, que TASK-020 agrega — no es un archivo de código, es el registro de ejecución que el
architect (§12, nota de ejecución real) pide explícitamente).

### Notas de interpretación (no son discrepancias de archivos, pero conviene dejarlas escritas)

- **`assertTimelineNotPersisted` — dos menciones en la §10 del architect:** el ítem 6
  (`montage-preconditions.ts`) lista esta función entre sus símbolos, y el ítem 17
  (`project-scope.ts`) dice "(`assertTimelineNotPersisted` o expone el `stat` que §4.4 necesita)".
  El §4.4 (paso 6) es más específico y dice literalmente "nuevo, en `project-scope.ts`". Este
  planner resuelve la ambigüedad así: TASK-011 (`project-scope.ts`) implementa la función real
  `assertTimelineNotPersisted` con el `stat` simple que D-6 exige; TASK-012
  (`montage-preconditions.ts`) la reexpone o la compone junto con
  `assertMontageProjectIsIngestable` para que el handler (TASK-018) tenga un solo punto de entrada
  a las precondiciones de montaje. El implementador puede ajustar cuál de los dos archivos hace
  el `export` final sin que eso mueva ningún archivo fuera de la lista cerrada.
- **`media-binaries.ts` sin `.spec.ts`:** el architect deja explícitamente a criterio del planner si
  corresponde crear uno (ítem 14 de §10: "verificar si el planner debe crear uno"). Este planner
  decide que no: el archivo es sólo constantes/tipos, no tiene lógica propia que testear en
  aislamiento, y su único efecto observable (cuatro binarios en `GET /health`) ya lo cubre
  `health-handler.spec.ts` (TASK-019, CA-009 de §13). No se agrega `media-binaries.spec.ts` a
  ningún `files[]`.
