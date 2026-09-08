# Architect — Cycle 01: render-service-foundation

> **Input:** `brief.yaml`, `functional.md`, `spec-e-burgos-005-render-service.spec.md`,
> `spec-e-burgos-004-audio-mix-mastering/cycles/cycle-02/architect.md` §15
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-01/architect.md`
> **Generado por:** sdd-architect (claude/opus, effort high)
> **Regla que gobierna este documento:** cierra todas las firmas. El Planner escribe después y el
> implementador no toma ninguna decisión de diseño: si algo no está acá, se escala, no se inventa.

---

## 1. Resumen y alcance

### 1.1 Qué cierra este ciclo

Este documento define, con firma exacta y lista para implementar:

1. El árbol completo de `apps/render-api`, con una única frontera de proceso (`src/main.ts`).
2. El objeto de puertos inyectables `RenderApiDependencies` y su único adaptador de producción,
   que resuelve `@video-maker/media-local` y `@video-maker/composition-remotion/render` con
   `await import()` dinámico **dentro del método que las usa**.
3. `runRenderPipeline`: firma, resultado tipado, layout de rutas de trabajo, orden no conmutable de
   las cuatro llamadas, `mkdir` previo al paso 1, y las políticas D-7 y D-8 expresadas como código.
4. La superficie de errores propia (`RenderApiErrorCode` `as const`), la traducción desde los
   errores ajenos de `spec-004` §15.2 y la tabla `código propio → status HTTP`.
5. El contrato HTTP del ciclo: `GET /health`, router con 404 y 405 explícitos, manejador central de
   errores y formato de respuesta de error.
6. La configuración literal del proyecto (`project.json`, tsconfigs, `vite.config.ts`) y el patrón
   de arranque real.
7. El contenido propuesto de `apps/render-api/eslint.config.mjs`, que **no se crea** (D-9).
8. La lista cerrada de tests obligatorios, uno por `CA-001`..`CA-008`.

### 1.2 Qué NO cierra (y no se implementa)

- **No hay ningún endpoint que dispare el pipeline en este ciclo.** `runRenderPipeline` existe, está
  cubierto por tests y no tiene ruta HTTP. Fundamento en D-K (§11).
- No hay cola de jobs, progreso, cancelación ni concurrencia (`cycle-03`).
- No hay endpoints de assets, upload, probe ni persistencia de `Timeline`/`EDL` (`cycle-02`).
- No hay MinIO, docker-compose ni cliente S3 (`cycle-02`, D-3).
- No hay dependencias npm nuevas de ningún tipo (RNF-1, D-2).
- No se crea `apps/render-api/eslint.config.mjs` (D-9) ni se toca `tsconfig.base.json` (RNF-5).
- No se toca `tools/render-cli` (D-5) ni el `coverage.include` de `libs/composition-remotion` (D-6).
- **El bundle webpack de Remotion no se verifica en este ciclo** (D-10, ver §10.3).

### 1.3 Schema de datos

Este ciclo **no crea ni modifica tablas**. `apps/render-api` no tiene base de datos: su estado
persistente es el árbol `media/<project-slug>/` en disco (D-3). `sdd/schema.json` no se toca.

---

## 2. Árbol de `apps/render-api`

```
apps/render-api/
├── project.json                                 targets lint | test | build | serve (explícitos)
├── tsconfig.json                                solution file: references a lib y spec
├── tsconfig.lib.json                            build (tsc --noEmit-equivalente vía outDir dist/out-tsc)
├── tsconfig.spec.json                           tipos de Vitest para los *.spec.ts
├── vite.config.ts                               Vitest: alias @video-maker/*, coverage.include, umbral 80
├── README.md                                    comandos, variables de entorno y alcance descopado (CA-008)
└── src/
    ├── main.ts                                  ÚNICA frontera de proceso: argv/env, señales, exitCode, console
    ├── server-register.cjs                      loader: registra @swc-node/register acotado a .ts y devuelve el loader nativo de .js
    ├── config/
    │   ├── server-config.ts                     readServerConfig(env) -> ServerConfig; DEFAULT_HOST/DEFAULT_PORT
    │   └── server-config.spec.ts
    ├── deps/
    │   ├── render-api-dependencies.ts           SOLO tipos: RenderApiDependencies y sus siete puertos
    │   └── node-render-api-dependencies.ts      ÚNICO adaptador de producción; único lugar con await import() de las libs
    ├── engine/
    │   ├── engine-modules.ts                    tipos EngineModuleName / EngineModuleStatus (compartidos por health y el adaptador)
    │   └── media-binaries.ts                    MEDIA_BINARY_NAMES as const, MediaBinaryName, BinaryStatus
    ├── errors/
    │   ├── render-api-error.ts                  RENDER_API_ERROR_CODES / RENDER_PIPELINE_STAGES as const, RenderApiError, isRenderApiError
    │   ├── render-api-error.spec.ts
    │   ├── pipeline-stage-error.ts              PipelineStageError: la única subclase concreta del ciclo
    │   ├── translate-engine-error.ts            traduce estructuralmente los errores de las dos libs a RenderApiError
    │   ├── translate-engine-error.spec.ts
    │   ├── http-status-for.ts                   httpStatusFor(code) -> number (tabla §5.5)
    │   ├── http-status-for.spec.ts
    │   ├── to-error-payload.ts                  toErrorPayload(unknown) -> RenderApiErrorPayload (sin stack, sin rutas de host)
    │   └── to-error-payload.spec.ts
    ├── pipeline/
    │   ├── render-pipeline-paths.ts             resolveRenderPipelinePaths(projectRoot, renderId) -> RenderPipelinePaths
    │   ├── render-pipeline-paths.spec.ts
    │   ├── run-render-pipeline.ts               runRenderPipeline(request, deps) -> RenderPipelineReport
    │   └── run-render-pipeline.spec.ts
    ├── http/
    │   ├── http-message.ts                      tipos HttpRequestLine / HttpResponse (transporte agnóstico de node:http)
    │   ├── routes.ts                            ROUTES as const, RouteId
    │   ├── router.ts                            routeRequest(method, path) -> RouteMatch
    │   ├── router.spec.ts
    │   ├── health-handler.ts                    handleHealth(deps) -> Promise<HttpResponse>
    │   ├── health-handler.spec.ts
    │   ├── handle-request.ts                    manejador central: router + handler + try/catch único
    │   ├── handle-request.spec.ts
    │   ├── create-render-api-server.ts          node:http: adapta IncomingMessage -> HttpRequestLine y HttpResponse -> ServerResponse
    │   └── create-render-api-server.spec.ts
    └── __fixtures__/
        ├── call-log.ts                          createCallLog(): registro ordenado de invocaciones para CA-003 / CA-005 / CA-006
        ├── fake-render-api-dependencies.ts      dobles de los siete puertos, sin binarios ni libs pesadas (RNF-3)
        └── minimal-timeline.ts                  Timeline mínima válida construida con buildTimeline de timeline-core
```

### 2.1 La frontera de proceso

`src/main.ts` es el **único** archivo del proyecto autorizado a:

- leer `process.env` y `process.argv`,
- escribir en `process.exitCode`, `process.stdout` o `process.stderr`,
- usar `console`,
- registrar handlers de señales (`SIGINT`, `SIGTERM`),
- llamar `resolve` de `node:path` (la única ruta dependiente del SO del proyecto).

Todo lo demás **devuelve valores**: `readServerConfig` recibe el `env` como parámetro,
`createNodeRenderApiDependencies` recibe el `env` como parámetro, `createRenderApiServer` devuelve
un objeto con `listen()`/`close()` y no decide cuándo apagarse, `handleRequest` devuelve un
`HttpResponse` y no escribe en ningún socket. Es el mismo invariante que `tools/render-cli` §3 ya
sostiene, y `eslint.config.mjs` (§8) lo haría cumplir mecánicamente si pudiera crearse.

Forma exacta de `main.ts` (esqueleto de contrato, no implementación):

```ts
import { resolve } from 'node:path';

import { readServerConfig } from './config/server-config';
import { createNodeRenderApiDependencies } from './deps/node-render-api-dependencies';
import { createRenderApiServer } from './http/create-render-api-server';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
const CONFIG_EXIT_CODE = 78;

async function main(): Promise<void> {
  const config = readServerConfig(process.env);
  const deps = createNodeRenderApiDependencies(process.env, resolve(process.cwd()));

  await deps.preloadEngineModules();

  const server = createRenderApiServer(deps, config);
  const address = await server.listen();

  process.stdout.write(`${JSON.stringify({ event: 'listening', host: address.host, port: address.port })}\n`);

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      void server.close().then(() => {
        process.exitCode = 0;
      });
    });
  }
}

void main().catch((cause: unknown) => {
  process.stderr.write(`${JSON.stringify({ event: 'startup-failed', error: toErrorPayload(cause) })}\n`);
  process.exitCode = isServerConfigError(cause) ? CONFIG_EXIT_CODE : 1;
});
```

Exit codes del proceso: `0` apagado normal por señal · `78` configuración inválida
(`SERVER_CONFIG_INVALID`) · `1` cualquier otro fallo de arranque. Ningún camino imprime `.stack`.

---

## 3. Puertos inyectables

### 3.1 Tipos de apoyo

```ts
// src/engine/media-binaries.ts
export const MEDIA_BINARY_NAMES = ['ffmpeg', 'ffprobe'] as const;

export type MediaBinaryName = (typeof MEDIA_BINARY_NAMES)[number];

export interface BinaryStatus {
  readonly name: MediaBinaryName;
  readonly envVar: string;
  readonly resolved: boolean;
}

export interface ResolvedMediaBinaries {
  readonly ffmpeg: string;
  readonly ffprobe: string;
}
```

```ts
// src/engine/engine-modules.ts
export const ENGINE_MODULE_NAMES = ['media-local', 'composition-remotion/render'] as const;

export type EngineModuleName = (typeof ENGINE_MODULE_NAMES)[number];

export interface EngineModuleStatus {
  readonly name: EngineModuleName;
  readonly loaded: boolean;
}
```

### 3.2 El objeto de dependencias completo

```ts
// src/deps/render-api-dependencies.ts
import type { MixLoudnessVerification } from '@video-maker/media-local';
import type { Timeline, VoiceTarget } from '@video-maker/timeline-core';

import type { EngineModuleStatus } from '../engine/engine-modules';
import type { BinaryStatus } from '../engine/media-binaries';

export interface RenderMutedVideoInput {
  readonly timeline: Timeline;
  readonly outPath: string;
  readonly publicDir: string;
}

export interface RenderMutedVideoOutput {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export type RenderMutedVideoPort = (input: RenderMutedVideoInput) => Promise<RenderMutedVideoOutput>;

export interface MixTimelineAudioInput {
  readonly timeline: Timeline;
  readonly outPath: string;
}

export interface MixTimelineAudioOutput {
  readonly outputPath: string;
  readonly filterComplex: string;
}

export type MixTimelineAudioPort = (input: MixTimelineAudioInput) => Promise<MixTimelineAudioOutput>;

export interface MuxAudioIntoVideoInput {
  readonly videoPath: string;
  readonly audioPath: string;
  readonly outPath: string;
}

export interface MuxAudioIntoVideoOutput {
  readonly outputPath: string;
}

export type MuxAudioIntoVideoPort = (input: MuxAudioIntoVideoInput) => Promise<MuxAudioIntoVideoOutput>;

export interface VerifyMixLoudnessInput {
  readonly path: string;
  readonly target: VoiceTarget;
}

export type VerifyMixLoudnessPort = (input: VerifyMixLoudnessInput) => Promise<MixLoudnessVerification>;

export type EnsureDirectoryPort = (path: string) => Promise<void>;

export type ProbeMediaBinariesPort = () => Promise<readonly BinaryStatus[]>;

export type PreloadEngineModulesPort = () => Promise<readonly EngineModuleStatus[]>;

export interface Clock {
  nowIso(): string;
}

export interface LogEvent {
  readonly event: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface Logger {
  readonly info: (event: LogEvent) => void;
  readonly error: (event: LogEvent) => void;
}

export interface RenderApiDependencies {
  readonly renderMutedVideo: RenderMutedVideoPort;
  readonly mixTimelineAudio: MixTimelineAudioPort;
  readonly muxAudioIntoVideo: MuxAudioIntoVideoPort;
  readonly verifyMixLoudness: VerifyMixLoudnessPort;
  readonly ensureDirectory: EnsureDirectoryPort;
  readonly probeMediaBinaries: ProbeMediaBinariesPort;
  readonly preloadEngineModules: PreloadEngineModulesPort;
  readonly clock: Clock;
  readonly logger: Logger;
}
```

Notas de firma, derivadas del código real de las libs (no del documento de `spec-004`):

- `MixLoudnessVerification` se importa **como tipo** desde `@video-maker/media-local`
  (`{ measured: LoudnessMeasurement; withinTolerance: boolean; integratedDeltaLu: number;
  truePeakDeltaDb: number }`). No se re-declara: re-declararlo es exactamente el error de copiar un
  literal ajeno.
- `Clock` se re-declara localmente con la misma forma que `@video-maker/media-local`
  (`nowIso(): string`) porque el adaptador la satisface con `systemClock` y el puerto no debe
  obligar a los tests a importar la lib.
- Los puertos de mix y mux **no** devuelven `args` ni `voiceMeasured`: son detalle de ejecución de
  la lib. `voiceMeasured` (reinyectable, §15.3.7 de `spec-004`) no se usa en `cycle-01`; agregarlo al
  puerto sin consumidor sería contrato muerto.
- El puerto de render aplana `RenderTimelineResult` menos `compositionId`, que no se reporta.

### 3.3 El único adaptador de producción

```ts
// src/deps/node-render-api-dependencies.ts
import { mkdir } from 'node:fs/promises';

import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import type { EngineModuleStatus } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, ResolvedMediaBinaries } from '../engine/media-binaries';
import type { RenderApiDependencies } from './render-api-dependencies';

export function createNodeRenderApiDependencies(
  env: NodeJS.ProcessEnv,
  cwd: string,
): RenderApiDependencies {
  let mediaLocalModule: Promise<typeof import('@video-maker/media-local')> | null = null;
  let renderModule: Promise<typeof import('@video-maker/composition-remotion/render')> | null = null;
  let binaries: Promise<ResolvedMediaBinaries> | null = null;

  const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => {
    mediaLocalModule ??= import('@video-maker/media-local');
    return mediaLocalModule;
  };

  const loadRender = (): Promise<typeof import('@video-maker/composition-remotion/render')> => {
    renderModule ??= import('@video-maker/composition-remotion/render');
    return renderModule;
  };

  const loadBinaries = (): Promise<ResolvedMediaBinaries> => {
    binaries ??= (async () => {
      const { resolveBinary } = await loadMediaLocal();
      const [ffmpeg, ffprobe] = await Promise.all([
        resolveBinary('ffmpeg', env),
        resolveBinary('ffprobe', env),
      ]);
      return { ffmpeg, ffprobe };
    })();
    return binaries;
  };

  return {
    renderMutedVideo: async ({ timeline, outPath, publicDir }) => {
      const { renderTimeline } = await loadRender();
      const result = await renderTimeline(timeline, { outPath, publicDir, audio: 'muted' });
      return {
        outPath: result.outPath,
        width: result.width,
        height: result.height,
        fps: result.fps,
        durationInFrames: result.durationInFrames,
      };
    },

    mixTimelineAudio: async ({ timeline, outPath }) => {
      const { ExecaCommandRunner, mixTimelineAudio } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      const result = await mixTimelineAudio(timeline, outPath, new ExecaCommandRunner(), { ffmpegPath: ffmpeg });
      return { outputPath: result.outputPath, filterComplex: result.filterComplex };
    },

    muxAudioIntoVideo: async ({ videoPath, audioPath, outPath }) => {
      const { ExecaCommandRunner, muxAudioIntoVideo } = await loadMediaLocal();
      const { ffmpeg, ffprobe } = await loadBinaries();
      const result = await muxAudioIntoVideo(videoPath, audioPath, outPath, new ExecaCommandRunner(), {
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
      });
      return { outputPath: result.outputPath };
    },

    verifyMixLoudness: async ({ path, target }) => {
      const { ExecaCommandRunner, verifyMixLoudness } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      return verifyMixLoudness(path, target, new ExecaCommandRunner(), { ffmpegPath: ffmpeg });
    },

    ensureDirectory: async (path) => {
      await mkdir(path, { recursive: true });
    },

    probeMediaBinaries: async () => {
      const { BINARY_ENV_VARS, resolveBinary } = await loadMediaLocal();
      const statuses: BinaryStatus[] = [];
      for (const name of MEDIA_BINARY_NAMES) {
        const envVar = BINARY_ENV_VARS[name];
        try {
          await resolveBinary(name, env);
          statuses.push({ name, envVar, resolved: true });
        } catch {
          statuses.push({ name, envVar, resolved: false });
        }
      }
      return statuses;
    },

    preloadEngineModules: async () => {
      const loaders: Record<(typeof ENGINE_MODULE_NAMES)[number], () => Promise<unknown>> = {
        'media-local': loadMediaLocal,
        'composition-remotion/render': loadRender,
      };
      const statuses: EngineModuleStatus[] = [];
      for (const name of ENGINE_MODULE_NAMES) {
        try {
          await loaders[name]();
          statuses.push({ name, loaded: true });
        } catch {
          statuses.push({ name, loaded: false });
        }
      }
      return statuses;
    },

    clock: { nowIso: () => new Date().toISOString() },

    logger: {
      info: () => undefined,
      error: () => undefined,
    },
  };
}
```

Invariantes del adaptador, todos verificables por lectura:

1. **`await import()` sólo dentro de los métodos**, nunca en el tope del módulo. Es lo que permite
   que `main.ts` levante el proceso sin cargar React, Remotion ni `execa`, y lo que hace que
   `preloadEngineModules()` sea una decisión explícita del arranque y no un efecto del `import`.
2. **`resolveBinary` por binario, jamás `resolveBinaries`.** `resolveBinaries` incluye
   `whisperModel`, que no tiene fallback a `PATH` y lanza `BinaryNotFoundError` en cualquier entorno
   sin `WHISPER_MODEL_PATH`: usarlo haría fallar `/health` por un binario que este servicio no usa
   (D-C, §11).
3. **`env` y `cwd` llegan por parámetro** desde `main.ts`: el adaptador no toca `process`.
4. **Los errores de las libs se propagan crudos.** La traducción vive en un único lugar
   (`translateEngineError`, §5.4), invocada por el pipeline. El adaptador no conoce la superficie de
   errores propia.
5. **`logger` es no-op en producción de `cycle-01`**: la única salida del proceso es la línea de
   arranque de `main.ts`. Reemplazarlo por un logger real es un cambio de una línea en el adaptador
   y no toca ningún otro archivo. Se decide en `cycle-03`, junto con el progreso de jobs.
6. El adaptador y `main.ts` quedan **fuera del `coverage.include`** (§7.5): son I/O puro y su
   corrección la certifica la ejecución real de §10.

---

## 4. `runRenderPipeline`

### 4.1 Rutas de trabajo

```ts
// src/pipeline/render-pipeline-paths.ts
import { join } from 'node:path/posix';

export const RENDER_WORK_SEGMENT = 'work/renders';
export const RENDER_OUT_SEGMENT = 'out';
export const MUTED_VIDEO_FILENAME = 'video-muted.mp4';
export const MASTER_AUDIO_FILENAME = 'master.wav';

export interface RenderPipelineFile {
  readonly path: string;
  readonly resource: string;
}

export interface RenderPipelinePaths {
  readonly publicDir: string;
  readonly workDir: RenderPipelineFile;
  readonly outDir: RenderPipelineFile;
  readonly mutedVideo: RenderPipelineFile;
  readonly masterAudio: RenderPipelineFile;
  readonly deliverable: RenderPipelineFile;
}

export function resolveRenderPipelinePaths(projectRoot: string, renderId: string): RenderPipelinePaths {
  const file = (relative: string): RenderPipelineFile => ({
    path: join(projectRoot, relative),
    resource: relative,
  });

  const workRelative = join(RENDER_WORK_SEGMENT, renderId);

  return {
    publicDir: projectRoot,
    workDir: file(workRelative),
    outDir: file(RENDER_OUT_SEGMENT),
    mutedVideo: file(join(workRelative, MUTED_VIDEO_FILENAME)),
    masterAudio: file(join(workRelative, MASTER_AUDIO_FILENAME)),
    deliverable: file(join(RENDER_OUT_SEGMENT, `${renderId}.mp4`)),
  };
}
```

Layout resultante sobre el proyecto de medios:

```
media/<project-slug>/
├── raw/                                   intacto — el pipeline nunca escribe acá
├── work/
│   └── renders/<render-id>/
│       ├── video-muted.mp4                intermedio (D-8, conservado)
│       └── master.wav                     intermedio (D-8, conservado)
└── out/
    └── <render-id>.mp4                    entregable
```

Justificación del layout:

- **`media/<project-slug>/` es el store canónico** (D-3) y el mismo árbol que `tools/render-cli` ya
  lee y escribe: un segundo árbol de trabajo rompería la trazabilidad y duplicaría medios.
- **`publicDir` es la raíz del proyecto, nunca `raw/`**: es la rama verificada de `assetSrc` (regla
  operativa heredada de `spec-002`, D-2/HC-1 de `tools/render-cli`).
- **Un subdirectorio por `renderId` bajo `work/renders/`** y no `work/` plano: con los intermedios
  conservados (D-8) y una cola con varios renders del mismo proyecto (`cycle-03`), `work/master.wav`
  plano se pisaría entre jobs. El `renderId` en el path hace el aislamiento estructural, no
  convencional, y deja el borrado selectivo trivial.
- **El entregable va a `out/<render-id>.mp4`** y no a `out/<slug>.mp4`, para no pisar el entregable
  que produce `tools/render-cli` sobre el mismo proyecto.
- **`path` vs `resource`:** `path` es la ruta que se le pasa a Remotion y a ffmpeg (puede ser
  absoluta, según el `projectRoot` que resolvió `main.ts`); `resource` es la etiqueta POSIX relativa
  al proyecto. **RNF-6: todo payload usa `resource`, jamás `path`.**

### 4.2 Firma y resultado

```ts
// src/pipeline/run-render-pipeline.ts
import type { Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderPipelineStage } from '../errors/render-api-error';

export interface RenderPipelineRequest {
  readonly renderId: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
}

export interface RenderDeliverableReport {
  readonly resource: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export interface RenderIntermediatesReport {
  readonly mutedVideoResource: string;
  readonly masterAudioResource: string;
}

export interface RenderLoudnessReport {
  readonly withinTolerance: boolean;
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export interface RenderPipelineReport {
  readonly renderId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly deliverable: RenderDeliverableReport;
  readonly intermediates: RenderIntermediatesReport;
  readonly loudness: RenderLoudnessReport;
}

export async function runRenderPipeline(
  request: RenderPipelineRequest,
  deps: RenderApiDependencies,
): Promise<RenderPipelineReport>;
```

`RenderPipelineReport` sólo lleva `resource` (rutas relativas al proyecto): el reporte es el insumo
directo del payload HTTP de `cycle-03` y no puede filtrar rutas del host (RNF-6).

### 4.3 Cuerpo: orden no conmutable, `mkdir` previo y políticas D-7/D-8

```ts
const STAGE_ORDER = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

async function runStage<T>(stage: RenderPipelineStage, resource: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw translateEngineError(cause, stage, resource);
  }
}

export async function runRenderPipeline(
  request: RenderPipelineRequest,
  deps: RenderApiDependencies,
): Promise<RenderPipelineReport> {
  const paths = resolveRenderPipelinePaths(request.projectRoot, request.renderId);
  const startedAt = deps.clock.nowIso();

  await runStage('prepare', paths.workDir.resource, async () => {
    await deps.ensureDirectory(paths.workDir.path);
    await deps.ensureDirectory(paths.outDir.path);
  });

  const rendered = await runStage('render', paths.mutedVideo.resource, () =>
    deps.renderMutedVideo({
      timeline: request.timeline,
      outPath: paths.mutedVideo.path,
      publicDir: paths.publicDir,
    }),
  );

  await runStage('mix', paths.masterAudio.resource, () =>
    deps.mixTimelineAudio({ timeline: request.timeline, outPath: paths.masterAudio.path }),
  );

  await runStage('mux', paths.deliverable.resource, () =>
    deps.muxAudioIntoVideo({
      videoPath: rendered.outPath,
      audioPath: paths.masterAudio.path,
      outPath: paths.deliverable.path,
    }),
  );

  const verified = await runStage('verify', paths.deliverable.resource, () =>
    deps.verifyMixLoudness({ path: paths.deliverable.path, target: request.timeline.audioMix.voice }),
  );

  return {
    renderId: request.renderId,
    startedAt,
    finishedAt: deps.clock.nowIso(),
    deliverable: {
      resource: paths.deliverable.resource,
      width: rendered.width,
      height: rendered.height,
      fps: rendered.fps,
      durationInFrames: rendered.durationInFrames,
    },
    intermediates: {
      mutedVideoResource: paths.mutedVideo.resource,
      masterAudioResource: paths.masterAudio.resource,
    },
    loudness: {
      withinTolerance: verified.withinTolerance,
      integratedLufs: verified.measured.integratedLufs,
      truePeakDbtp: verified.measured.truePeakDbtp,
      integratedDeltaLu: verified.integratedDeltaLu,
      truePeakDeltaDb: verified.truePeakDeltaDb,
    },
  };
}
```

**El orden es estructural, no convencional:** cada paso consume el resultado del anterior por
variable (`rendered.outPath` alimenta el mux) o por `await` secuencial. No hay `Promise.all`,
`allSettled` ni `race` en ningún camino, y el llamador no tiene forma de saltear ni reordenar un
paso: `runRenderPipeline` no recibe ninguna opción que altere la secuencia. `spec-004` §15.3.2 dice
que los pasos 1 y 2 podrían correr en paralelo; **`cycle-01` no lo hace** (D-M, §11).

**Por qué el paso 1 lleva `audio: 'muted'`:** `TimelineComposition` monta `AudioTrack` salvo que
`inputProps.audio === 'muted'`. Si el render trajera su propia mezcla y encima se le muxeara la
masterizada de `mixTimelineAudio`, el entregable saldría con el audio duplicado —
`muxAudioIntoVideo` mapea `0:v:0` y `1:a:0`, así que el audio del render no llegaría al archivo,
pero el render habría pagado el costo de renderizarlo y cualquier cambio futuro del mapeo
reintroduciría el defecto. Es el defecto que `spec-004` RF-2-04 existe para evitar. El literal
`'muted'` se pasa en el **adaptador** (§3.3), que es el único que conoce
`RenderTimelineOptions`; el puerto se llama `renderMutedVideo` para que el nombre sea el contrato y
no haya forma de pedirle un render con audio.

**D-7 como código (`withinTolerance: false` publica y reporta el delta):** la verificación es el
último `await` y su resultado sólo alimenta el campo `loudness` del reporte. **No hay ningún `if`
sobre `verified.withinTolerance`** en `runRenderPipeline`: la ausencia del condicional es la
política. No se lanza, no se reintenta, no se invoca un segundo render. `verifyMixLoudness` de
`media-local` tampoco lanza por tolerancia (verificado en el código de la lib), así que el camino es
el mismo con `true` y con `false`.

**D-8 como código (intermedios conservados):** el proyecto **no contiene ninguna llamada de borrado**
— no hay `rm`, `unlink`, `rmdir`, `rimraf` ni un puerto `deleteFile` en `RenderApiDependencies`. La
conservación no depende de una rama de `finally`: es la ausencia de la capacidad. El `try/catch` de
`runStage` sólo traduce y relanza; no limpia nada. Un fallo en `mux` deja `video-muted.mp4` y
`master.wav` en `work/renders/<render-id>/`.

**El `mkdir` previo al paso 1** es la etapa `prepare`, antes de `renderMutedVideo`: `ffmpeg` no crea
el directorio de salida (`spec-004` §15.3.6) y Remotion tampoco crea el de `outPath`. Se crean los
dos: `work/renders/<render-id>/` (intermedios) y `out/` (entregable); omitir `out/` hace fallar el
paso 3 con un `CommandFailedError` opaco en un proyecto recién creado.

---

## 5. Superficie de errores

### 5.1 Códigos y etapas propios

```ts
// src/errors/render-api-error.ts
export const RENDER_PIPELINE_STAGES = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export const RENDER_API_ERROR_CODES = [
  'INVALID_TIMELINE',
  'RENDER_BUNDLE_FAILED',
  'COMPOSITION_NOT_FOUND',
  'RENDER_FAILED',
  'UNRESOLVED_AUDIO_ASSET',
  'MISSING_AUDIO_STREAM',
  'MISSING_VIDEO_STREAM',
  'MEDIA_COMMAND_FAILED',
  'MEDIA_OUTPUT_UNPARSEABLE',
  'MEDIA_BINARY_NOT_FOUND',
  'WORKDIR_UNWRITABLE',
  'ROUTE_NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'SERVER_CONFIG_INVALID',
  'INTERNAL_ERROR',
] as const;

export type RenderApiErrorCode = (typeof RENDER_API_ERROR_CODES)[number];

export interface RenderApiErrorPayload {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderPipelineStage | null;
  readonly message: string;
  readonly resource?: string;
  readonly expected?: string;
  readonly hint?: string;
}

export abstract class RenderApiError extends Error {
  abstract readonly code: RenderApiErrorCode;
  abstract readonly stage: RenderPipelineStage | null;
  abstract readonly resource: string | null;
  abstract readonly expected: string | null;
  abstract readonly hint: string | null;
}

export function isRenderApiError(value: unknown): value is RenderApiError {
  return value instanceof RenderApiError;
}
```

Una sola subclase concreta cubre todo el ciclo:

```ts
// src/errors/pipeline-stage-error.ts
export class PipelineStageError extends RenderApiError {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderPipelineStage | null;
  readonly resource: string | null;
  readonly expected: string | null;
  readonly hint: string | null;

  constructor(init: {
    code: RenderApiErrorCode;
    stage: RenderPipelineStage | null;
    resource?: string | null;
    expected?: string | null;
    hint?: string | null;
    cause?: unknown;
  }) {
    super(init.code, init.cause === undefined ? {} : { cause: init.cause });
    this.name = 'PipelineStageError';
    this.code = init.code;
    this.stage = init.stage;
    this.resource = init.resource ?? null;
    this.expected = init.expected ?? null;
    this.hint = init.hint ?? null;
  }
}
```

`super(init.code)` deja el `message` de la excepción igual al código: es un identificador en inglés,
nunca se serializa tal cual (§5.3) y no arrastra el texto en castellano de la lib.

### 5.2 Estrechamiento en la frontera

Las dos libs son ajenas y sus uniones de códigos **no se copian**. Se declara una lista propia
`as const` por lib y se prueba en compilación que es un subconjunto del union ajeno con `satisfies`
sobre un `import type` (borrado en runtime por `verbatimModuleSyntax`, así que ningún archivo de la
superficie de errores carga `execa`, React ni Remotion — RNF-3):

```ts
// src/errors/translate-engine-error.ts
import type { MediaLocalErrorCode } from '@video-maker/media-local';
import type { RenderTimelineErrorCode } from '@video-maker/composition-remotion/render';

const HANDLED_MEDIA_LOCAL_CODES = [
  'BINARY_NOT_FOUND',
  'COMMAND_FAILED',
  'UNPARSEABLE_OUTPUT',
  'UNRESOLVED_AUDIO_ASSET',
  'MISSING_MEDIA_STREAM',
] as const satisfies readonly MediaLocalErrorCode[];

const HANDLED_RENDER_CODES = [
  'INVALID_TIMELINE',
  'BUNDLE_FAILED',
  'COMPOSITION_NOT_FOUND',
  'RENDER_FAILED',
] as const satisfies readonly RenderTimelineErrorCode[];

type HandledMediaLocalCode = (typeof HANDLED_MEDIA_LOCAL_CODES)[number];
type HandledRenderCode = (typeof HANDLED_RENDER_CODES)[number];
```

El `satisfies` da la garantía que importa: si `media-local` renombra un código, la lista propia deja
de compilar. Si **agrega** uno, la lista sigue compilando y el código nuevo cae en
`INTERNAL_ERROR` — degradación explícita, no silenciosa, y CA-004 sigue verde porque su tabla es la
de §15.2 vigente.

El reconocimiento en runtime es **estructural**, sobre `code` y `stream`, nunca `instanceof`:

```ts
interface EngineErrorShape {
  readonly code: string;
  readonly stream?: string;
}

function asEngineError(value: unknown): EngineErrorShape | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { code?: unknown; stream?: unknown };
  if (typeof candidate.code !== 'string') {
    return null;
  }
  return typeof candidate.stream === 'string'
    ? { code: candidate.code, stream: candidate.stream }
    : { code: candidate.code };
}

function isHandledMediaLocalCode(code: string): code is HandledMediaLocalCode {
  return (HANDLED_MEDIA_LOCAL_CODES as readonly string[]).includes(code);
}

function isHandledRenderCode(code: string): code is HandledRenderCode {
  return (HANDLED_RENDER_CODES as readonly string[]).includes(code);
}
```

Motivo del reconocimiento estructural en vez de `instanceof MediaLocalError` /
`instanceof RenderTimelineError`: las clases sólo existen después del `await import()` dinámico, así
que `instanceof` obligaría a cargar las dos libs pesadas en el módulo de traducción y en todos sus
tests, contra RNF-3. Los conjuntos de códigos de las dos libs son disjuntos (verificado sobre el
código real), así que no hay ambigüedad.

### 5.3 Payload de máquina

`toErrorPayload` es la única función que produce el cuerpo de un error, y el `message` sale de una
tabla propia en inglés — **nunca del `Error.message` ajeno**, que está en castellano:

```ts
// src/errors/to-error-payload.ts
const MESSAGE_BY_CODE: Readonly<Record<RenderApiErrorCode, string>> = {
  INVALID_TIMELINE: 'The submitted timeline did not pass validation.',
  RENDER_BUNDLE_FAILED: 'The renderer could not bundle the composition entry point.',
  COMPOSITION_NOT_FOUND: 'The renderer could not find the requested composition.',
  RENDER_FAILED: 'The renderer failed while producing the muted video.',
  UNRESOLVED_AUDIO_ASSET: 'An audio clip references an asset that is not in the timeline.',
  MISSING_AUDIO_STREAM: 'The referenced voice asset has no audio stream.',
  MISSING_VIDEO_STREAM: 'The rendered file has no video stream to mux into.',
  MEDIA_COMMAND_FAILED: 'A media command exited with a non-zero status.',
  MEDIA_OUTPUT_UNPARSEABLE: 'A media command ran but its output could not be parsed.',
  MEDIA_BINARY_NOT_FOUND: 'A required media binary could not be resolved.',
  WORKDIR_UNWRITABLE: 'The render working directory could not be created.',
  ROUTE_NOT_FOUND: 'No route matches the requested path.',
  METHOD_NOT_ALLOWED: 'The requested method is not allowed on this path.',
  SERVER_CONFIG_INVALID: 'The server configuration is invalid.',
  INTERNAL_ERROR: 'The service failed for an unexpected reason.',
};

export function toErrorPayload(value: unknown): RenderApiErrorPayload {
  if (!isRenderApiError(value)) {
    return { code: 'INTERNAL_ERROR', stage: null, message: MESSAGE_BY_CODE.INTERNAL_ERROR };
  }

  return {
    code: value.code,
    stage: value.stage,
    message: MESSAGE_BY_CODE[value.code],
    ...(value.resource === null ? {} : { resource: value.resource }),
    ...(value.expected === null ? {} : { expected: value.expected }),
    ...(value.hint === null ? {} : { hint: value.hint }),
  };
}
```

Garantías de RNF-6 y CA-004, por construcción y no por convención:

- **Nunca `.stack`**: `toErrorPayload` no lee la propiedad. Verificado con un spy sobre el getter
  (mismo test que `tools/render-cli` ya tiene).
- **Nunca el mensaje ajeno**: el `message` sale de `MESSAGE_BY_CODE`, que es literal ASCII inglés.
  Un test recorre `RENDER_API_ERROR_CODES` y falla si algún mensaje tiene caracteres fuera de ASCII
  o si el payload contiene alguno de los tokens de las libs (`No se`, `El comando`, `La Timeline`).
- **Nunca una ruta absoluta del host**: `resource` siempre viene de `RenderPipelineFile.resource`
  (relativo al proyecto) o del nombre lógico de un binario (`ffmpeg`, `ffprobe`). Un test verifica
  que ningún payload de la tabla de §5.4 empieza con `/` ni contiene `:\\`.
- **Nunca `command`, `args`, `exitCode` ni `stderr`** de `CommandFailedError`: `args` y `stderr`
  llevan rutas absolutas del host. El `hint` de `MEDIA_COMMAND_FAILED` remite al log del servicio,
  no al stderr.

### 5.4 Función de traducción

```ts
export function translateEngineError(
  cause: unknown,
  stage: RenderPipelineStage,
  resource: string,
): RenderApiError {
  if (isRenderApiError(cause)) {
    return cause;
  }

  const engineError = asEngineError(cause);

  if (engineError !== null && isHandledRenderCode(engineError.code)) {
    return new PipelineStageError({
      code: RENDER_CODE_MAP[engineError.code],
      stage,
      resource,
      ...(engineError.code === 'INVALID_TIMELINE'
        ? { expected: 'a timeline accepted by validateTimeline' }
        : {}),
      cause,
    });
  }

  if (engineError !== null && isHandledMediaLocalCode(engineError.code)) {
    if (engineError.code === 'MISSING_MEDIA_STREAM') {
      return new PipelineStageError({
        code: engineError.stream === 'video' ? 'MISSING_VIDEO_STREAM' : 'MISSING_AUDIO_STREAM',
        stage,
        resource,
        expected: engineError.stream === 'video' ? 'a file carrying a video stream' : 'a voice asset carrying an audio stream',
        cause,
      });
    }

    return new PipelineStageError({
      code: MEDIA_LOCAL_CODE_MAP[engineError.code],
      stage,
      resource,
      ...(engineError.code === 'BINARY_NOT_FOUND'
        ? { hint: 'set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH' }
        : {}),
      cause,
    });
  }

  return new PipelineStageError({ code: 'INTERNAL_ERROR', stage, resource, cause });
}

const RENDER_CODE_MAP: Readonly<Record<HandledRenderCode, RenderApiErrorCode>> = {
  INVALID_TIMELINE: 'INVALID_TIMELINE',
  BUNDLE_FAILED: 'RENDER_BUNDLE_FAILED',
  COMPOSITION_NOT_FOUND: 'COMPOSITION_NOT_FOUND',
  RENDER_FAILED: 'RENDER_FAILED',
};

const MEDIA_LOCAL_CODE_MAP: Readonly<Record<Exclude<HandledMediaLocalCode, 'MISSING_MEDIA_STREAM'>, RenderApiErrorCode>> = {
  BINARY_NOT_FOUND: 'MEDIA_BINARY_NOT_FOUND',
  COMMAND_FAILED: 'MEDIA_COMMAND_FAILED',
  UNPARSEABLE_OUTPUT: 'MEDIA_OUTPUT_UNPARSEABLE',
  UNRESOLVED_AUDIO_ASSET: 'UNRESOLVED_AUDIO_ASSET',
};
```

El `WORKDIR_UNWRITABLE` no sale de una lib: lo produce la etapa `prepare` cuando `ensureDirectory`
lanza un error de filesystem. `translateEngineError` lo devuelve como `INTERNAL_ERROR` salvo que la
etapa sea `prepare`, en cuyo caso `runStage` de `prepare` usa el código específico. Regla explícita
para el implementador: **en la etapa `prepare`, el caso `default` de `translateEngineError` es
`WORKDIR_UNWRITABLE` en lugar de `INTERNAL_ERROR`**; se implementa como un parámetro
`fallbackCode: RenderApiErrorCode = 'INTERNAL_ERROR'` de `translateEngineError`, que `prepare` pasa
como `'WORKDIR_UNWRITABLE'`.

### 5.5 Tabla: fila de `spec-004` §15.2 → código propio → etapa → status HTTP

| # | Fila de `spec-004` §15.2 | Discriminante en runtime | Código propio | Etapa | HTTP |
| --- | --- | --- | --- | --- | --- |
| 1 | `RenderTimelineError` `INVALID_TIMELINE` | `code === 'INVALID_TIMELINE'` | `INVALID_TIMELINE` | `render` | **422** |
| 2 | `RenderTimelineError` `BUNDLE_FAILED` | `code === 'BUNDLE_FAILED'` | `RENDER_BUNDLE_FAILED` | `render` | **500** |
| 3 | `RenderTimelineError` `COMPOSITION_NOT_FOUND` | `code === 'COMPOSITION_NOT_FOUND'` | `COMPOSITION_NOT_FOUND` | `render` | **500** |
| 4 | `RenderTimelineError` `RENDER_FAILED` | `code === 'RENDER_FAILED'` | `RENDER_FAILED` | `render` | **500** |
| 5 | `UnresolvedAudioAssetError` | `code === 'UNRESOLVED_AUDIO_ASSET'` | `UNRESOLVED_AUDIO_ASSET` | `mix` | **422** |
| 6 | `MissingMediaStreamError` (`stream: 'audio'`) | `code === 'MISSING_MEDIA_STREAM'` y `stream === 'audio'` | `MISSING_AUDIO_STREAM` | `mix` | **422** |
| 7 | `MissingMediaStreamError` (`stream: 'video'`) | `code === 'MISSING_MEDIA_STREAM'` y `stream === 'video'` | `MISSING_VIDEO_STREAM` | `mux` | **500** |
| 8 | `CommandFailedError` | `code === 'COMMAND_FAILED'` | `MEDIA_COMMAND_FAILED` | `mix` \| `mux` \| `verify` | **500** |
| 9 | `UnparseableOutputError` | `code === 'UNPARSEABLE_OUTPUT'` | `MEDIA_OUTPUT_UNPARSEABLE` | `mix` \| `verify` | **500** |
| 10 | `BinaryNotFoundError` | `code === 'BINARY_NOT_FOUND'` | `MEDIA_BINARY_NOT_FOUND` | la etapa que lo disparó | **503** |

Códigos propios sin fila en §15.2 (transporte y arranque):

| Código propio | Origen | Etapa | HTTP |
| --- | --- | --- | --- |
| `WORKDIR_UNWRITABLE` | `ensureDirectory` falla en `prepare` | `prepare` | **500** |
| `ROUTE_NOT_FOUND` | el router no matchea el path | `null` | **404** |
| `METHOD_NOT_ALLOWED` | el path existe con otro método | `null` | **405** |
| `SERVER_CONFIG_INVALID` | `readServerConfig` con `RENDER_API_PORT` inválido | `null` | **500** |
| `INTERNAL_ERROR` | cualquier `throw` no reconocido | la etapa en curso o `null` | **500** |

Justificación de los tres status no obvios:

- **422 (Unprocessable Content) para las filas 1, 5 y 6**: el fallo es del insumo que envió el
  cliente (la `Timeline` no valida, referencia un asset inexistente o apunta a un archivo de voz sin
  stream de audio). Reintentar el mismo cuerpo nunca converge; el cliente tiene que corregirlo. No
  es 400 porque el cuerpo es JSON sintácticamente válido y bien tipado: falla la semántica.
- **500 para la fila 7**: `MISSING_VIDEO_STREAM` en `mux` significa que **el render que produjo este
  servicio** no tiene stream de video. Es un defecto del servicio, no del insumo del cliente.
- **503 (Service Unavailable) para la fila 10**: falta ffmpeg/ffprobe en el entorno. El servicio no
  está en condiciones de trabajar y lo estará cuando el operador instale o configure el binario:
  es exactamente la semántica de 503 y la que `GET /health` ya anticipa con `status: "degraded"`.

`SERVER_CONFIG_INVALID` es el único código que jamás viaja por HTTP: aborta el arranque antes del
`listen()` (exit code 78). Vive en el union para que `MESSAGE_BY_CODE` y `httpStatusFor` sean
totales sobre `RenderApiErrorCode` y el `switch` no necesite `default`.

```ts
// src/errors/http-status-for.ts
const STATUS_BY_CODE: Readonly<Record<RenderApiErrorCode, number>> = {
  INVALID_TIMELINE: 422,
  RENDER_BUNDLE_FAILED: 500,
  COMPOSITION_NOT_FOUND: 500,
  RENDER_FAILED: 500,
  UNRESOLVED_AUDIO_ASSET: 422,
  MISSING_AUDIO_STREAM: 422,
  MISSING_VIDEO_STREAM: 500,
  MEDIA_COMMAND_FAILED: 500,
  MEDIA_OUTPUT_UNPARSEABLE: 500,
  MEDIA_BINARY_NOT_FOUND: 503,
  WORKDIR_UNWRITABLE: 500,
  ROUTE_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  SERVER_CONFIG_INVALID: 500,
  INTERNAL_ERROR: 500,
};

export function httpStatusFor(code: RenderApiErrorCode): number {
  return STATUS_BY_CODE[code];
}
```

---

## 6. Contrato HTTP del ciclo

### 6.1 Tipos de transporte

```ts
// src/http/http-message.ts
export interface HttpRequestLine {
  readonly method: string;
  readonly path: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
```

`handleRequest` y todos los handlers trabajan sobre estos tipos, **no** sobre `IncomingMessage` /
`ServerResponse`: es lo que permite testear todo el contrato HTTP sin abrir un socket.

### 6.2 `GET /health`

**Request:** método `GET`, path `/health`. Sin path params, sin query params, sin headers
requeridos, sin cuerpo. Un cuerpo enviado se ignora (no se lee el stream).

**Response 200** — `Content-Type: application/json; charset=utf-8`:

```json
{
  "status": "ok",
  "service": "render-api",
  "cycle": 1,
  "time": "2026-09-08T14:32:07.114Z",
  "engine": [
    { "name": "media-local", "loaded": true },
    { "name": "composition-remotion/render", "loaded": true }
  ],
  "binaries": [
    { "name": "ffmpeg", "envVar": "FFMPEG_PATH", "resolved": true },
    { "name": "ffprobe", "envVar": "FFPROBE_PATH", "resolved": true }
  ],
  "capabilities": {
    "renderPipeline": true,
    "assetStore": false,
    "jobQueue": false
  }
}
```

Tipo exacto de la respuesta:

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
}
```

Reglas del handler (`handleHealth(deps): Promise<HttpResponse>`):

- `status` es `'ok'` sólo si **todos** los `engine[].loaded` y **todos** los `binaries[].resolved`
  son `true`; en cualquier otro caso `'degraded'`.
- **El status HTTP es 200 en los dos casos.** `/health` reporta, no falla: un 503 en `/health`
  impide distinguir "el servicio no está" de "el servicio está y le falta ffmpeg", que es
  precisamente la información que el frontend de `spec-006` necesita antes de mandar una `Timeline`.
- **Qué reporta sobre los binarios:** el **nombre lógico** (`ffmpeg`/`ffprobe`), el **nombre de la
  variable de entorno** que los controla (constante de `BINARY_ENV_VARS`, no un valor) y si
  resolvieron. **Nunca la ruta resuelta** — es una ruta absoluta del host (RNF-6).
- `engine[]` es el resultado de `deps.preloadEngineModules()`, memoizado en el adaptador: es la
  evidencia observable, desde fuera del proceso, de que los dos `await import()` funcionaron
  (CA-002).
- `time` sale de `deps.clock.nowIso()`, nunca de `new Date()` directo.
- `capabilities` declara explícitamente lo descopado del ciclo, para que un consumidor no descubra
  por 404 que la cola no existe.

### 6.3 Router

```ts
// src/http/routes.ts
export const ROUTES = [{ id: 'health', method: 'GET', path: '/health' }] as const;

export type RouteId = (typeof ROUTES)[number]['id'];
```

```ts
// src/http/router.ts
export type RouteMatch =
  | { readonly kind: 'matched'; readonly id: RouteId }
  | { readonly kind: 'method-not-allowed'; readonly allow: readonly string[] }
  | { readonly kind: 'not-found' };

export function normalizePath(path: string): string;

export function routeRequest(method: string, path: string): RouteMatch;
```

- `normalizePath` recorta el query string y la barra final (`/health/` → `/health`), y deja `/`
  intacto. Es una función pura y tiene su propio test.
- `routeRequest` busca primero por `path`: si ningún route coincide → `{ kind: 'not-found' }`
  (**404**, `ROUTE_NOT_FOUND`). Si coincide el path pero no el método →
  `{ kind: 'method-not-allowed', allow }` (**405**, `METHOD_NOT_ALLOWED`), y el `allow` alimenta el
  header `Allow` obligatorio de un 405. Los dos casos son explícitos: no hay un `default` que
  colapse 404 y 405 en el mismo status.
- El método `HEAD` **no** se trata especialmente en `cycle-01`: `HEAD /health` devuelve 405 con
  `Allow: GET`. Está declarado a propósito (D-N, §11).

### 6.4 Manejador central de errores

```ts
// src/http/handle-request.ts
export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
): Promise<HttpResponse> {
  try {
    const match = routeRequest(request.method, normalizePath(request.path));

    if (match.kind === 'not-found') {
      throw new PipelineStageError({ code: 'ROUTE_NOT_FOUND', stage: null, resource: normalizePath(request.path) });
    }

    if (match.kind === 'method-not-allowed') {
      throw new PipelineStageError({
        code: 'METHOD_NOT_ALLOWED',
        stage: null,
        resource: normalizePath(request.path),
        expected: match.allow.join(', '),
      });
    }

    return await handleHealth(deps);
  } catch (cause) {
    return toErrorResponse(cause, deps);
  }
}

export function toErrorResponse(cause: unknown, deps: RenderApiDependencies): HttpResponse {
  const error = toErrorPayload(cause);
  deps.logger.error({ event: 'request-failed', detail: { code: error.code } });

  return {
    status: httpStatusFor(error.code),
    headers:
      error.code === 'METHOD_NOT_ALLOWED' && error.expected !== undefined
        ? { 'content-type': JSON_CONTENT_TYPE, allow: error.expected }
        : { 'content-type': JSON_CONTENT_TYPE },
    body: { error },
  };
}
```

**Formato de la respuesta de error** — un único sobre para todos los caminos:

```json
{
  "error": {
    "code": "MEDIA_BINARY_NOT_FOUND",
    "stage": "mix",
    "message": "A required media binary could not be resolved.",
    "resource": "ffmpeg",
    "hint": "set FFMPEG_PATH and FFPROBE_PATH or install ffmpeg in PATH"
  }
}
```

`resource`, `expected` y `hint` se omiten cuando no aplican (nunca `null` en el JSON). **Todos los
caminos responden JSON**: no hay texto plano ni HTML en ninguna rama, incluido el 404. El único
`try/catch` de la capa HTTP es el de `handleRequest`; `createRenderApiServer` no agrega otro salvo
el guard de último recurso del §6.5.

### 6.5 Servidor `node:http`

```ts
// src/http/create-render-api-server.ts
export interface ServerAddress {
  readonly host: string;
  readonly port: number;
}

export interface RenderApiServer {
  readonly listen: () => Promise<ServerAddress>;
  readonly close: () => Promise<void>;
}

export function createRenderApiServer(deps: RenderApiDependencies, config: ServerConfig): RenderApiServer;
```

- Usa `createServer` de `node:http`. El path se extrae con
  `new URL(incoming.url ?? '/', PATH_PARSE_BASE).pathname`, con
  `const PATH_PARSE_BASE = 'http://render-api.invalid'` — una base sentinela, para no reinyectar el
  host real en el parseo ni exponerlo en un error de URL.
- Escribe siempre `JSON.stringify(response.body)` con los headers de `response.headers`.
- Un fallo dentro del propio `createServer` (serialización, socket) responde 500 con el sobre de
  error de `toErrorPayload(cause)`: es el guard de último recurso, y es la única razón por la que
  este archivo tiene un `try/catch`.
- `listen()` resuelve con el `address()` efectivo (permite `RENDER_API_PORT=0` en tests) y `close()`
  resuelve cuando el server cerró. **Ninguno de los dos toca `process`**: quién los llama y cuándo
  lo decide `main.ts`.

### 6.6 Configuración por entorno

```ts
// src/config/server-config.ts
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4310;
export const HOST_ENV_VAR = 'RENDER_API_HOST';
export const PORT_ENV_VAR = 'RENDER_API_PORT';

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig;
```

| Variable | Default | Regla |
| --- | --- | --- |
| `RENDER_API_HOST` | `127.0.0.1` | Cualquier string no vacío se usa tal cual. **El default nunca escucha fuera de loopback** (RNF-6); abrirlo es una decisión explícita del operador. |
| `RENDER_API_PORT` | `4310` | Entero `0..65535`. Vacío o ausente → default. Presente e inválido → `PipelineStageError` con `SERVER_CONFIG_INVALID` (exit 78), **nunca fallback silencioso al default**. |

---

## 7. Configuración del proyecto (literal, para copiar)

### 7.1 `apps/render-api/project.json`

```json
{
  "name": "render-api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/render-api/src",
  "projectType": "application",
  "tags": ["scope:engine", "type:app"],
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vitest run --coverage",
        "cwd": "apps/render-api"
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/out-tsc/apps/render-api"],
      "options": {
        "command": "tsc -p tsconfig.lib.json",
        "cwd": "apps/render-api"
      }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts",
        "env": { "SWC_NODE_PROJECT": "tsconfig.base.json" }
      }
    }
  }
}
```

Puntos que el implementador **no** puede alterar:

- **Los cuatro targets están declarados explícitamente.** El plugin `@nx/vite` de `nx.json` infiere
  targets a partir de `vite.config.ts` y, con un config de Vitest, el `test` inferido corre en modo
  watch: en CI eso cuelga el pipeline. Declararlos en `project.json` los sobrescribe.
- **`test` corre `vitest run`**, nunca `vitest`. Sin `--passWithNoTests`: una suite vacía en este
  proyecto es un defecto, no un caso válido.
- **`serve` corre sin `cwd`** (desde la raíz del workspace, como `render-cli:cli`) con
  `SWC_NODE_PROJECT=tsconfig.base.json`. `{workspaceRoot}` no se puede usar como token intermedio en
  un `command` compuesto de Nx 23 (constitución de `render-cli` §4), por eso el path es literal.
- **`serve` no propaga el exit code real** (Nx normaliza todo fallo de `nx:run-commands` a 1). Es
  cómodo para desarrollo; la verificación de CA-002 invoca el proceso, no el target (§10).

### 7.2 `apps/render-api/package.json` — **no se crea**

Ningún proyecto de este workspace tiene `package.json` propio salvo
`libs/composition-remotion/package.json` (existe para que el bundler de Remotion resuelva el nombre
del paquete). `apps/web` y `tools/render-cli` no lo tienen y están correctamente integrados: el glob
`apps/*` de `pnpm-workspace.yaml` sólo incorpora directorios que **son** paquetes, y Nx deriva el
proyecto de `project.json`. Agregar uno acá crearía un paquete pnpm sin dependencias propias, con
riesgo de que `pnpm install` genere un `node_modules` anidado y de que Nx cambie la inferencia del
proyecto. Ver D-A (§11). Si en el futuro se decidiera crearlo, su contenido sería exactamente:

```json
{
  "name": "@video-maker/render-api",
  "version": "0.0.0",
  "private": true
}
```

### 7.3 `apps/render-api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "strict": true },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

### 7.4 `apps/render-api/tsconfig.lib.json` y `tsconfig.spec.json`

```json
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

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../dist/out-tsc", "jsx": "react-jsx", "types": ["node", "vitest/globals"] },
  "include": ["src/**/*.spec.ts"]
}
```

`"jsx": "react-jsx"` es obligatorio aunque el proyecto no tenga ni un `.tsx`: el
`import type ... from '@video-maker/composition-remotion/render'` de §5.2 arrastra a `tsc` hasta
`src/components/timeline-composition.tsx` de esa lib. Sin la opción, `build` falla con un error
que no menciona a `render-api`. Es el mismo motivo por el que `tools/render-cli` la lleva.
`verbatimModuleSyntax` es lo que garantiza que los `import type` de las libs se borren del emitido y
no se conviertan en carga estática de `execa`, React y Remotion.

### 7.5 `apps/render-api/vite.config.ts`

```ts
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../node_modules/.vite/render-api',
  resolve: {
    alias: {
      '@video-maker/composition-remotion/render': fileURLToPath(
        new URL('../../libs/composition-remotion/src/render.ts', import.meta.url),
      ),
      '@video-maker/media-local': fileURLToPath(
        new URL('../../libs/media-local/src/index.ts', import.meta.url),
      ),
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../../libs/timeline-core/src/index.ts', import.meta.url),
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
      reportsDirectory: '../../coverage/apps/render-api',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__fixtures__/**',
        'src/main.ts',
        'src/deps/node-render-api-dependencies.ts',
      ],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 80 },
    },
  },
});
```

Dos aclaraciones que evitan un falso verde:

- **`coverage.include` es `['src/**/*.ts']` resuelto contra `root`**, que este archivo fija
  explícitamente en el directorio del proyecto: el conjunto medido es exactamente
  `apps/render-api/src/**`, como pide CA-007. Escribir el glob en forma workspace-relativa
  (`apps/render-api/src/**`) **no matchearía nada** con `cwd: apps/render-api`, y Vitest reportaría
  100 % sobre cero archivos sin ningún error visible (D-B, §11).
- **Los tres alias son obligatorios aunque `tsconfig.base.json` ya los declare.** Es la lección más
  cara del repo (constitución de `composition-remotion` §4): `tsconfig.base.json` resuelve para
  `tsc`, no para el runtime de Vitest. Se declaran exactamente los tres `@video-maker/*` que el
  proyecto consume; `@video-maker/auto-montage` **no** se consume en `cycle-01` (D-H) y por eso no
  está — el ciclo que lo agregue tiene que agregar el alias en el mismo commit.

### 7.6 `apps/render-api/src/server-register.cjs` y el arranque real

```js
const Module = require('node:module');
const nodeJsLoader = Module._extensions['.js'];
require('@swc-node/register');
Module._extensions['.js'] = nodeJsLoader;
```

Arranque:

```bash
SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts
```

**Por qué este patrón y no compilar y correr `dist/`:**

1. `tsconfig.base.json` tiene `module: "esnext"` y `moduleResolution: "bundler"`. El emitido de
   `tsc -p tsconfig.lib.json` conserva los especificadores `@video-maker/*` y los imports relativos
   **sin extensión**: Node no resuelve ninguno de los dos. Correr `dist/` exigiría o bien un paso de
   bundling nuevo, o bien reescribir los paths con un plugin — dependencia npm nueva, contra RNF-1 y
   D-2. El target `build` de este proyecto es una **compuerta de tipos**, no un artefacto ejecutable.
2. El `await import('@video-maker/composition-remotion/render')` del adaptador necesita que el alias
   resuelva **en runtime**. `@swc-node/register` con `SWC_NODE_PROJECT=tsconfig.base.json` lo hace
   contra los `paths` de la raíz del workspace; el `tsconfig.json` del proyecto no serviría porque
   no es donde viven los `paths` (ésa fue exactamente la falla que rompió el target `smoke` de
   `composition-remotion` durante dos specs).
3. **La restauración del loader nativo de `.js` no es opcional.** Cuando Remotion bundlea con
   webpack inyecta `.js` de terceros en el proceso; si `@swc-node/register` sigue registrado para
   `.js`, intenta compilarlos y el proceso falla. Está documentado en la constitución de
   `composition-remotion` §3 y replicado en `tools/render-cli`.
4. Precedente: los dos únicos proyectos ejecutables del repo (`render-cli`, el `smoke` de
   `composition-remotion`) usan este patrón y funcionaron contra renders reales el 2026-09-08.

---

## 8. `apps/render-api/eslint.config.mjs`: NO se crea (D-9)

### 8.1 Por qué no se crea

El hook `config-protection` del harness del dev (plugin de usuario, fuera de este repo) bloquea
`Write` y `Edit` sobre **cualquier** archivo cuyo *basename* sea `eslint.config.mjs`, sin distinguir
raíz de proyecto. Rodearlo con `Bash` (heredoc, `sed`, `cp`) **anularía el guardrail**: el hook
existe justamente para que un agente no reescriba la configuración de lint del workspace, y
esquivarlo con otra herramienta convierte una protección en un placebo. Mismo tratamiento ya
aplicado en `tools/render-cli`, y reversible en un paso: el dev pega el bloque de §8.2 tal cual, sin
tocar una línea de código.

### 8.2 Contenido propuesto, completo y listo para pegar

```js
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          allowTypeImports: true,
          paths: [
            {
              name: '@video-maker/composition-remotion',
              message: 'render-api consumes the /render subpath only, never the React barrel.',
            },
            { name: 'execa', message: 'Spawning processes belongs to libs/media-local.' },
            { name: 'child_process', message: 'Spawning processes belongs to libs/media-local.' },
            { name: 'node:child_process', message: 'Spawning processes belongs to libs/media-local.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/main.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'process is only allowed in src/main.ts (single process boundary).' },
        { name: 'console', message: 'console is only allowed in src/main.ts (single process boundary).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'exit', message: 'main.ts sets process.exitCode; nothing calls process.exit.' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/deps/node-render-api-dependencies.ts', 'src/main.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:fs', 'node:fs/*'],
              message: 'Filesystem access goes through the ensureDirectory port.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@video-maker/composition-remotion', '@video-maker/composition-remotion/*', 'execa', 'node:child_process'],
              message: 'RNF-3: specs must not load the heavy libs nor spawn binaries.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/errors/*.ts', 'src/http/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'stack', message: 'RNF-6: no payload may carry a stack trace.' },
      ],
    },
  },
];
```

### 8.3 Cómo se cumplen los boundaries sin ese archivo

Verificado contra el `eslint.config.mjs` de la raíz y el `project.json` propuesto:

1. **`@nx/eslint:lint` sin config de proyecto resuelve el flat config de la raíz.** Es el mismo
   camino por el que `tools/render-cli` (que tampoco tiene el archivo) se lintea hoy en verde.
2. El flat config raíz aplica `@nx/enforce-module-boundaries` a `['**/*.ts', '**/*.tsx', '**/*.js',
   '**/*.jsx']`, es decir también a `apps/render-api/src/**`.
3. Los `depConstraints` de la raíz son, en orden:
   `type:domain → []`, `type:util → ['type:domain']`, `type:ui → ['type:domain']`,
   `type:feature → ['type:domain','type:util']`, `* → ['*']`.
   `render-api` lleva `tags: ["scope:engine", "type:app"]`; **ni `type:app` ni `scope:engine` tienen
   fila propia**, así que ambos caen en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags:
   ['*'] }`, que permite depender de `type:util` (`media-local`) y `type:ui`
   (`composition-remotion`) simultáneamente. Es exactamente el privilegio que la spec le atribuye a
   este subproyecto, y se obtiene **sin editar ninguna config protegida**.
4. Lo único que se pierde son los guardrails **extra** de §8.2 (frontera de proceso, prohibición de
   `execa`/`child_process`/`node:fs` fuera del adaptador, `.stack` en payloads). Hasta que el dev
   pegue el bloque, esos invariantes se sostienen por: (a) los tests obligatorios de §9 —
   `to-error-payload.spec.ts` espía el getter de `.stack`; (b) verificación por grep del reviewer al
   cerrar el ciclo:

   ```bash
   grep -rnE "\bprocess\.|\bconsole\.|from 'node:fs" apps/render-api/src --include='*.ts' \
     | grep -vE '^apps/render-api/src/(main\.ts|deps/node-render-api-dependencies\.ts):'
   ```

   Debe salir vacío. Queda registrado en el fragmento de contexto del subproyecto como pendiente,
   igual que en `tools/render-cli`.

---

## 9. Lista cerrada de tests obligatorios

Contrato que el reviewer contrasta **fila por fila** al cerrar. Un archivo o un símbolo que no
coincide es un hallazgo, no una variante aceptable.

### 9.1 Filas cubiertas por un test

| CA | Archivo | Nombre del test | Símbolo que invoca |
| --- | --- | --- | --- |
| CA-002 | `src/config/server-config.spec.ts` | `defaults the host to 127.0.0.1 when RENDER_API_HOST is unset` | `readServerConfig` |
| CA-002 | `src/config/server-config.spec.ts` | `defaults the port to 4310 when RENDER_API_PORT is unset or empty` | `readServerConfig` |
| CA-002 | `src/config/server-config.spec.ts` | `throws SERVER_CONFIG_INVALID for a non-integer or out-of-range RENDER_API_PORT` | `readServerConfig` |
| CA-002 | `src/http/health-handler.spec.ts` | `answers 200 with status ok, the service name, the clock time and one entry per engine module and media binary` | `handleHealth` |
| CA-002 | `src/http/health-handler.spec.ts` | `answers 200 with status degraded when a media binary does not resolve` | `handleHealth` |
| CA-002 | `src/http/health-handler.spec.ts` | `never exposes a resolved binary path` | `handleHealth` |
| CA-002 | `src/http/router.spec.ts` | `matches GET /health and tolerates a trailing slash and a query string` | `routeRequest` |
| CA-002 | `src/http/router.spec.ts` | `returns not-found for an unknown path` | `routeRequest` |
| CA-002 | `src/http/router.spec.ts` | `returns method-not-allowed with the allow list for POST /health` | `routeRequest` |
| CA-002 | `src/http/handle-request.spec.ts` | `answers 404 with a JSON ROUTE_NOT_FOUND envelope for an unknown path` | `handleRequest` |
| CA-002 | `src/http/handle-request.spec.ts` | `answers 405 with a JSON METHOD_NOT_ALLOWED envelope and an Allow header` | `handleRequest` |
| CA-002 | `src/http/handle-request.spec.ts` | `answers JSON with the mapped status when a handler throws a RenderApiError` | `handleRequest` |
| CA-002 | `src/http/create-render-api-server.spec.ts` | `serves GET /health over a real loopback socket on an ephemeral port and closes` | `createRenderApiServer` |
| CA-003 | `src/pipeline/run-render-pipeline.spec.ts` | `invokes render, mix, mux and verify in that exact order` (asserts sobre `callLog.entries()`) | `runRenderPipeline` |
| CA-003 | `src/pipeline/run-render-pipeline.spec.ts` | `asks the render port for the muted video path and the project root as publicDir` | `runRenderPipeline` |
| CA-003 | `src/pipeline/run-render-pipeline.spec.ts` | `feeds the mux with the rendered video and the mixed master, in that order` | `runRenderPipeline` |
| CA-004 | `src/errors/translate-engine-error.spec.ts` | `it.each` con **una fila por cada fila de la tabla §5.5** (10 filas): `translates <engine error> to <own code> at stage <stage>` | `translateEngineError` |
| CA-004 | `src/errors/translate-engine-error.spec.ts` | `falls back to INTERNAL_ERROR for an unrecognised thrown value` | `translateEngineError` |
| CA-004 | `src/errors/translate-engine-error.spec.ts` | `uses WORKDIR_UNWRITABLE as the prepare-stage fallback` | `translateEngineError` |
| CA-004 | `src/errors/http-status-for.spec.ts` | `it.each` sobre `RENDER_API_ERROR_CODES`: `maps <code> to HTTP <status>` | `httpStatusFor` |
| CA-004 | `src/errors/to-error-payload.spec.ts` | `never reads .stack` (spy sobre el getter) | `toErrorPayload` |
| CA-004 | `src/errors/to-error-payload.spec.ts` | `emits an ASCII English message for every code in RENDER_API_ERROR_CODES` | `toErrorPayload` |
| CA-004 | `src/errors/to-error-payload.spec.ts` | `never emits an absolute host path in resource` | `toErrorPayload` |
| CA-004 | `src/errors/to-error-payload.spec.ts` | `omits resource, expected and hint instead of emitting null` | `toErrorPayload` |
| CA-004 | `src/errors/render-api-error.spec.ts` | `isRenderApiError distinguishes the own hierarchy from a plain Error and a non-error value` | `isRenderApiError` |
| CA-005 | `src/pipeline/render-pipeline-paths.spec.ts` | `places the intermediates under work/renders/<renderId> and the deliverable under out/` | `resolveRenderPipelinePaths` |
| CA-005 | `src/pipeline/render-pipeline-paths.spec.ts` | `exposes project-relative resources alongside the filesystem paths` | `resolveRenderPipelinePaths` |
| CA-005 | `src/pipeline/run-render-pipeline.spec.ts` | `creates the work directory and the out directory before the first stage` (asserts posición en `callLog`) | `runRenderPipeline` |
| CA-005 | `src/pipeline/run-render-pipeline.spec.ts` | `never invokes a delete on any path, including when a later stage throws` | `runRenderPipeline` |
| CA-006 | `src/pipeline/run-render-pipeline.spec.ts` | `resolves with the measured delta when withinTolerance is false` | `runRenderPipeline` |
| CA-006 | `src/pipeline/run-render-pipeline.spec.ts` | `does not invoke the render port a second time when withinTolerance is false` (asserts sobre `callLog`) | `runRenderPipeline` |

### 9.2 Filas cuya evidencia es una compuerta, no un test

| CA | Instrumento | Comando / evidencia exacta |
| --- | --- | --- |
| CA-001 | corrida del workspace | `pnpm nx run-many -t lint test build` — `render-api` aparece en la lista de proyectos corridos y el resultado es verde, sin warnings nuevos respecto del baseline |
| CA-002 (proceso) | ejecución real del binario | §10.1 — 200 + JSON válido + `engine[].loaded` en `true` para las dos libs + exit code 0 |
| CA-007 | umbral de cobertura | `pnpm nx run render-api:test` — el reporte de v8 sobre `src/**/*.ts` (menos los excludes de §7.5) supera 80 % de statements; el umbral está en el `vite.config.ts` del proyecto, así que la compuerta falla sola |
| CA-008 | inspección del entregable | `apps/render-api/README.md` contiene: comandos (`lint`, `test`, `build`, `serve`, el arranque directo de §7.6), `RENDER_API_HOST`, `RENDER_API_PORT`, `FFMPEG_PATH`, `FFPROBE_PATH`, y la lista descopada de `cycle-01` (MinIO, cola de jobs, endpoints de assets, bundle webpack de Remotion, `eslint.config.mjs`) |

### 9.3 El registro de llamadas

CA-003, CA-005 y CA-006 se verifican sobre un registro compartido y **no** por el título del test:

```ts
// src/__fixtures__/call-log.ts
export interface CallLogEntry {
  readonly port: string;
  readonly input: unknown;
}

export interface CallLog {
  readonly record: (port: string, input: unknown) => void;
  readonly entries: () => readonly CallLogEntry[];
  readonly ports: () => readonly string[];
}

export function createCallLog(): CallLog;
```

`createFakeRenderApiDependencies(callLog, overrides?)` cablea los siete puertos contra ese log. La
aserción de orden de CA-003 es literalmente
`expect(callLog.ports()).toEqual(['ensureDirectory', 'ensureDirectory', 'renderMutedVideo', 'mixTimelineAudio', 'muxAudioIntoVideo', 'verifyMixLoudness'])`.
La de CA-006 es `expect(callLog.ports().filter((port) => port === 'renderMutedVideo')).toHaveLength(1)`.
La de CA-005 es `expect(callLog.ports().indexOf('ensureDirectory')).toBeLessThan(callLog.ports().indexOf('renderMutedVideo'))`
más la ausencia de cualquier puerto de borrado (que además no existe en el tipo).

---

## 10. Verificación de ejecución real (CA-002)

### 10.1 Comando exacto

```bash
export SWC_NODE_PROJECT=tsconfig.base.json
export RENDER_API_PORT=4310

node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &
RENDER_API_PID=$!

curl -fsS -m 10 -o /tmp/render-api-health.json -w 'http=%{http_code}\n' http://127.0.0.1:4310/health
cat /tmp/render-api-health.json | node -e "process.stdin.on('data', (d) => JSON.parse(d.toString()))"

kill -TERM "$RENDER_API_PID"
wait "$RENDER_API_PID"
echo "exit=$?"
```

Se corre desde la raíz del workspace, con `NX_WORKSPACE_ROOT_PATH` sin definir o apuntando al cwd.

### 10.2 Qué se observa (los cuatro hechos que CA-002 exige)

1. **`http=200`** en la salida de `curl` (`-f` haría fallar el comando ante cualquier otro status).
2. **JSON válido**: el `node -e` de parseo termina sin error.
3. **Las dos libs pesadas resolvieron por `await import()`**: en el cuerpo,
   `engine` contiene `{"name":"media-local","loaded":true}` y
   `{"name":"composition-remotion/render","loaded":true}`. `main.ts` ya hizo
   `await deps.preloadEngineModules()` **antes** de `listen()`, así que un fallo de resolución
   habría impedido que `curl` obtuviera respuesta: el 200 con los dos `loaded: true` es la
   evidencia.
4. **`exit=0`** tras `SIGTERM`.

### 10.3 Por qué el proceso y no `nx run`

Medido en `tools/render-cli` el 2026-09-08 y registrado en su constitución §4: **`nx run
<proj>:<target>` normaliza cualquier fallo de `nx:run-commands` a exit code `1`**. Un
`nx run render-api:serve` devolvería `1` tanto ante un apagado limpio fallido como ante un crash de
arranque, y `0` sólo por coincidencia. El exit code exacto que CA-002 pide sólo se observa
invocando el binario. El target `serve` existe para desarrollo, no para verificar.

### 10.4 Declaración explícita de D-10

**El bundle webpack de Remotion NO se verifica en `cycle-01`.** `preloadEngineModules()` prueba que
`@video-maker/composition-remotion/render` **se importa** y que sus símbolos existen; **no** ejecuta
`bundleProject`, que es lo que dispara webpack, ni `selectComposition`, ni `renderMedia`. Bundlear
sin renderizar cuesta el mismo tiempo y memoria que el render entero y `cycle-01` no tiene todavía
un job que lo dispare. Queda **declarado como no verificado** y se ejercita en el smoke E2E
obligatorio de `cycle-03`. Ningún CA de este ciclo puede leerse como certificación de que el bundle
compila. Esta declaración explícita existe para no repetir el defecto de `FIX-e-burgos-001-001` (un
smoke roto durante dos specs sin que nadie lo supiera).

---

## 11. Riesgos y decisiones técnicas del arquitecto

| Id | Decisión | Fundamento | Riesgo que evita |
| --- | --- | --- | --- |
| **D-A** | **No se crea `apps/render-api/package.json`.** | Ningún proyecto del workspace lo tiene salvo `libs/composition-remotion` (y ahí es para el bundler de Remotion). El glob `apps/*` de pnpm sólo incorpora directorios que son paquetes; Nx deriva el proyecto de `project.json`. | Un paquete pnpm vacío que genere `node_modules` anidado o cambie la inferencia de Nx. Contenido literal por si se revierte: §7.2. |
| **D-B** | **`coverage.include` es `['src/**/*.ts']` con `root` fijado explícitamente al directorio del proyecto.** | Vitest resuelve `coverage.include` contra `root`; con `cwd: apps/render-api` un glob workspace-relativo no matchea nada. | El falso verde más caro posible: 100 % de cobertura sobre cero archivos, sin ningún error visible, con CA-007 "cumplido". |
| **D-C** | **Se usa `resolveBinary('ffmpeg'\|'ffprobe')`, nunca `resolveBinaries`.** | `resolveBinaries` incluye `whisperModel`, que no tiene fallback a `PATH` y lanza `BinaryNotFoundError` en cualquier entorno sin `WHISPER_MODEL_PATH`. | Que `/health` responda `degraded` (o el arranque falle) por un binario que este servicio no usa. |
| **D-D** | **La traducción de errores es estructural (`code`, `stream`), no `instanceof`; el estrechamiento se prueba en compilación con `as const satisfies readonly <UnionAjeno>[]`.** | Las clases sólo existen tras el `await import()` dinámico; usar `instanceof` obligaría a cargar las dos libs pesadas en el módulo de traducción y en sus tests, contra RNF-3. Los conjuntos de códigos de las dos libs son disjuntos. | Copiar el union ajeno (la lección más cara del repo) y arrastrar `execa`/React/Remotion a la suite. |
| **D-E** | **El `message` del payload sale de una tabla propia en inglés (`MESSAGE_BY_CODE`), nunca del `Error.message` ajeno.** | Los mensajes de las dos libs están en castellano. Derivarlos haría de CA-004 una promesa que un cambio en una lib rompe en silencio. | Castellano en el payload de máquina (D-4) y filtrado de rutas absolutas embebidas en el mensaje ajeno. |
| **D-F** | **`preloadEngineModules()` es un puerto, lo llama `main.ts` antes de `listen()` y su resultado se publica en `/health`.** | CA-002 pide observar desde fuera del proceso que los dos `await import()` funcionaron. Sin esto la única evidencia sería un render real, que D-10 descopa. | Que CA-002 quede sin instrumento y se cierre "por inspección". |
| **D-G** | **`/health` responde 200 tanto en `ok` como en `degraded`.** | Un 503 impide distinguir "el servicio no está" de "el servicio está y le falta ffmpeg", que es justo lo que el consumidor necesita saber antes de mandar una `Timeline`. | Un frontend que trate la falta de ffmpeg como caída del servicio. |
| **D-H** | **`cycle-01` no depende de `@video-maker/auto-montage`.** `ensureDirectory` es un puerto propio. | No necesita `MediaProject` ni los ports de fs de esa lib: `runRenderPipeline` recibe `projectRoot` como string. Una arista de dependencia menos, y un alias menos que mantener sincronizado en tres resolvedores. | Que `cycle-02` (que sí va a usar `MediaProject`) herede un alias declarado en tsconfig pero no en Vitest. |
| **D-I** | **El `renderId` lo provee el llamador; el pipeline no lo genera.** El `clock` sirve sólo para los timestamps del reporte. | La cola de `cycle-03` es la dueña de la identidad de un job. Generarlo acá crearía dos fuentes de ids. | Ids duplicados o inconsistentes entre el job y su directorio de trabajo. |
| **D-J** | **`prepare` crea `work/renders/<render-id>/` y también `out/`.** | Extensión de D-8: ffmpeg no crea el directorio de salida (`spec-004` §15.3.6) y Remotion tampoco. Omitir `out/` hace fallar el paso 3 con un `CommandFailedError` opaco en un proyecto recién creado. | Un fallo del mux que parece un problema de ffmpeg y es un directorio inexistente. |
| **D-K** | **No se expone ningún endpoint que dispare el pipeline en `cycle-01`.** El único route es `GET /health`. | RF-5 sólo pide `/health`. Un `POST /render` síncrono sería un contrato que la cola de `cycle-03` rompe de inmediato (un render tarda minutos: la respuesta correcta es 202 + job id, no 200 + reporte). Definirlo ahora obliga a deprecarlo en el ciclo siguiente. | Publicar y romper un contrato en dos ciclos consecutivos. `capabilities` en `/health` declara el descope para que no se descubra por 404. |
| **D-L** | **`tsconfig.base.json` no necesita ningún cambio. No se propone diff.** | El proyecto consume `@video-maker/timeline-core`, `@video-maker/media-local` y `@video-maker/composition-remotion/render`, los tres ya declarados en `paths`. Una app no necesita alias propio: nadie la importa. | Tocar una config protegida (RNF-5) sin necesidad. |
| **D-M** | **Los pasos 1 (render) y 2 (mix) corren en secuencia, no en paralelo**, aunque `spec-004` §15.3.2 diga que podrían. | Regla operativa heredada de `spec-001`: nunca dos cargas pesadas simultáneas (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper). Además, el paralelismo haría no determinista el registro de llamadas sobre el que se verifica CA-003. | OOM en la máquina del dev y un CA-003 flakeante. Queda anotado como optimización posible para `cycle-03`, con gate de memoria. |
| **D-N** | **`HEAD /health` devuelve 405, no 200.** | El router de `cycle-01` matchea método exacto. Tratar `HEAD` implica no escribir cuerpo y calcular `Content-Length`, lógica sin consumidor hoy. | Media implementación de `HEAD` que devuelva cuerpo y confunda a un cliente. Declarado, no accidental. |
| **D-O** | **El `logger` de producción es no-op en `cycle-01`.** | La única salida del proceso es la línea de arranque de `main.ts`. Un logger real sin niveles ni destino configurable sería una decisión que `cycle-03` (progreso de jobs) va a rehacer. | Formato de log publicado y cambiado un ciclo después. Reemplazarlo es un cambio de una línea en el adaptador. |
| **D-P** | **Riesgo aceptado: los guardrails extra de lint no existen hasta que el dev pegue §8.2.** | D-9. Mitigación: los tests de §9 cubren `.stack`, y el reviewer corre el grep de §8.3 al cerrar. | Que la frontera de proceso se erosione en silencio. Queda registrado como pendiente en el fragmento de contexto del subproyecto, igual que en `tools/render-cli`. |

### 11.1 Qué NO se hace y por qué (resumen para el Planner)

- No se crea `package.json`, `eslint.config.mjs` ni se toca `tsconfig.base.json`.
- No se expone `POST /render` ni ningún otro endpoint fuera de `GET /health`.
- No se implementa parseo de cuerpo de request: ningún route del ciclo lo necesita.
- No se usa `voiceMeasured` ni se persiste nada del reporte: sin consumidor en este ciclo.
- No se agrega ni una dependencia npm.
- No se verifica el bundle de Remotion (D-10).

---

## 12. Contratos registrados

`sdd/api.json`, app-key `apps/render-api`:

| Id | Método | Path | Status | Ciclo |
| --- | --- | --- | --- | --- |
| `EP-001` | `GET` | `/health` | `defined` | 1 |

`sdd/schema.json`: sin cambios — este subproyecto no tiene base de datos (§1.3).
