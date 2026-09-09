# spec-e-burgos-005-render-service cycle-03 — 2026-09-08

## Estado

- **La spec cierra acá.** `apps/render-api` queda completa: store de assets (`cycle-02`) + **cola de
  jobs de render** con progreso por frame y cancelación cooperativa. 15 rutas, 37 códigos de error,
  35 archivos de test / 307 tests, cobertura **96,79 % stmts · 89,69 % branch · 98,71 % funcs ·
  96,74 % lines** sobre el `coverage.include` de `cycle-01` sin recortar.
- **resuelve: `updates/…cycle-02.md` § Qué sigue — "sin ninguna ruta HTTP que dispare
  `runRenderPipeline`"**. `POST /projects/:slug/jobs` lo dispara desde este ciclo.
- **resuelve: `updates/…cycle-02.md` § Qué sigue — deuda del `uploadSerializer`**. El singleton de
  módulo de `assets-handler.ts` se eliminó: la instancia vive en `RenderApiRuntime`, uno por
  servidor (D-23). Dos servidores en el mismo proceso ya no comparten serializador.
- **resuelve: "el bundle webpack de Remotion no está verificado" (D-10, abierto desde `cycle-01`)**.
  El smoke real E2E del 2026-09-09 bundleó y renderió 538 frames a 1080×1920 en 22,4 s contra
  `media/smoke-ingest`. Es también la evidencia que valida `FIX-e-burgos-001-001`.
- **`withinTolerance: false` en el smoke no es un fallo** (D-7, ya vigente): el integrado dio
  `-17.59 LUFS` contra un target de `-14`. Una medición `loudnorm` independiente sobre el mismo
  entregable dio `input_i -17.59` — idéntica: `verifyMixLoudness` mide bien y el integrado bajo es
  material de origen, no instrumento.

## Estructura

- **`src/jobs/`** (paquete nuevo): `render-job.ts` (tipo `RenderJob`, los seis estados, las
  proyecciones `toRenderJob`/`toRenderJobSummary` que nunca dejan salir `projectRoot` ni
  `timeline`), `render-job-state.ts` (máquina de estados pura: `applyRenderJobEvent`),
  `render-job-progress.ts` (`mergeRenderProgress` monotónico por construcción, `progressPercent`
  con piso, `startRenderJobStage`), `render-job-queue.ts` (`createRenderJobQueue` — registro en
  memoria, FIFO, concurrencia 1).
- **`RenderApiRuntime`** (`src/http/render-api-runtime.ts`): **el estado vivo del servidor**, cuarto
  parámetro obligatorio de `handleRequest`. Contiene `jobs` (la cola) y `uploadSerializer`.
  `RenderApiDependencies` sigue siendo el contrato de **puertos sin estado**: la distinción
  puertos-vs-estado-vivo es ahora explícita y **ningún estado de módulo sobrevive en el subproyecto**.
- **`src/store/project-scope.ts`** (D-28): `assertValidProjectSlug`, `resolveExistingProject` y
  `readStoredTimeline` centralizados. Los cuatro handlers (`montage`, `assets`, `artifact`, `jobs`)
  consumen esas tres funciones — se eliminaron la 3ª y 4ª copia de las dos primeras.
- **`src/pipeline/render-pipeline-observer.ts`**: `RenderPipelineObserver`
  (`stageStarted`/`renderProgressed`/`cancellationRequested`) y `RenderPipelineCanceledError`, que
  **queda fuera de la jerarquía `RenderApiError` a propósito** (D-22): una cancelación se observa
  como `state: "canceled"` con `200`, nunca como un status HTTP propio.
- **Cancelación cooperativa entre etapas**, con estado transitorio observable `canceling` (D-21):
  `queued + cancel → canceled` (200, terminal); `running + cancel → canceling → canceled` (202).
  Al liquidar, **el estado vigente gana sobre el resultado del pipeline** — cancelar durante
  `verify` da `canceled` con `report: null`, aunque el MP4 exista y esté completo.
- **Puerto nuevo `randomId: () => string`** (`randomUUID()` en producción, contador determinista en
  los dobles). `node:crypto` sigue confinado al adaptador de producción.
- **`RenderMutedVideoPort` gana `onProgress?`** y el adaptador lo reenvía a `renderTimeline` sin
  alterar los valores.
- **`MixTimelineAudioInput` gana `projectRoot`** (**D-30**, addendum post-smoke del `architect.md`
  §18): el adaptador invoca `mixTimelineAudio` con `runOptions: { cwd: projectRoot }`. Sin eso
  ffmpeg resuelve los `Timeline.assets[].path` relativos contra el cwd del proceso de la API.
- **Dobles nuevos**: `createControllableRenderMutedVideo()` (sostiene un job en `running` sin
  timers) y `createRecordingLogger()` (el registro de transiciones que CA-022/CA-027 exigen como
  evidencia). El logger por defecto de `createFakeRenderApiDependencies` **sigue siendo no-op**.
- `GET /health` suma `capabilities.jobQueue: true`, `cycle: 3` y `jobs: { running, queued }`, que
  **no participa del cálculo `ok`/`degraded`** (D-27): una cola ocupada es operación normal.

## Dependencias

- **Cero dependencias npm nuevas** en todo el ciclo: `git diff --stat package.json pnpm-lock.yaml`
  vacío (CA-035, D-2, RNF-1/RNF-7). La cola, el observador y los ids salen de `node:*` y de código
  propio.
- **`libs/media-local` no se tocó** para resolver D-30: `MixTimelineAudioOptions.runOptions` es
  `CommandOptions { cwd?, timeoutMs? }` y su API pública ya lo soportaba.

## Qué sigue

- **El exit code después de un render no es parte del contrato.** `SIGTERM` responde `0` en un
  proceso que no rindió nada y **143** en uno que sí, porque `@remotion/renderer` instala sus
  propios handlers de señal (`BrowserRunner.js:191-196`). Medido y aislado con dos corridas
  (`artifacts/shutdown-exit-code.md`); un `process.exit(0)` explícito se probó y **no** lo corrige,
  y se revirtió. El arreglo limpio es correr el render en un **worker aparte**, que es el mismo
  cambio que haría falta para subir la concurrencia. Ningún supervisor debe basar su lógica de
  reinicio en ese código.
- **Concurrencia 1 y cola en memoria siguen siendo intra-proceso** (D-26, RNF-12): sin persistencia
  entre reinicios, sin cap de historial, sin lock entre procesos. Un job purgado o perdido cae en
  el mismo `404 RENDER_JOB_NOT_FOUND` que un id inexistente, así que agregar un cap después no
  cambia ningún contrato observable.
- **`apps/render-api/eslint.config.mjs` sigue sin existir** (D-9). El bloque propuesto acumula ya
  las correcciones de `cycle-01`/`cycle-02` más una de `cycle-03` (`architect.md` §15): `randomId`
  es el segundo puerto que justifica confinar `node:crypto` al adaptador.
- **El guion copiable del smoke es el del `README.md`, no el del `architect.md`.** §13.2 del
  architect trae `pgrep -l 'ffmpeg|whisper-cli|[Cc]hrome'`, que matchea el navegador del dev y
  aborta el smoke con un falso positivo (se pagó en la primera corrida). La versión correcta usa
  `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'`.
- **Próximo consumidor: `apps/web` (`spec-e-burgos-006-web-studio`)**, que consume HTTP y no exit
  codes.
