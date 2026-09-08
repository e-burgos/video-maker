# spec-e-burgos-005-render-service cycle-01 — 2026-09-08

## Estado

- El subproyecto pasa de "previsto" a **real**: `apps/render-api` es un proyecto Nx ejecutable con
  los cuatro targets (`lint`, `test`, `build`, `serve`) y sin ningún placeholder del generador.
  `resuelve: context_prompt.md § Estado ("en construcción")` — el estado real es el de este fragmento.
- `GET /health` implementado y verificado por **ejecución real del proceso** (no sólo por test):
  200 con `engine[].loaded: true` para `media-local` y `composition-remotion/render`,
  `binaries[].resolved: true` para ffmpeg y ffprobe, `404 ROUTE_NOT_FOUND` en path desconocido,
  `405 METHOD_NOT_ALLOWED` con `expected: "GET"`, exit 0 ante `SIGTERM` y exit 78 con payload
  `SERVER_CONFIG_INVALID` ante `RENDER_API_PORT` inválido.
- `runRenderPipeline` implementado y cubierto por tests, pero **sin ninguna ruta HTTP que lo dispare**:
  el único endpoint del ciclo es `GET /health` (`EP-001`). El disparo llega en `cycle-03` con la cola de jobs.
- Suite: 12 archivos / 71 tests, cobertura 100 % stmts · 97,72 % branch · 100 % funcs · 100 % lines
  (umbral 80 %). `coverage.include` es `src/**/*.ts` **menos** `*.spec.ts`, `__fixtures__/**`,
  `src/main.ts` y `src/deps/node-render-api-dependencies.ts`: esos dos últimos no entran al piso de
  cobertura — el adaptador tiene su propio `*.spec.ts` hermano con las libs mockeadas, y `main.ts`
  se cubre con la ejecución real de CA-002, no con el reporte de v8.

## Estructura

```
src/
  main.ts                  única frontera de proceso (env, señales, exitCode, stdout/stderr)
  server-register.cjs      loader @swc-node/register acotado a .ts (devuelve el loader nativo de .js)
  config/                  readServerConfig(env) -> ServerConfig
  deps/                    tipos de los siete puertos + único adaptador de producción
  engine/                  nombres de módulos de motor y de binarios de media
  errors/                  superficie propia: códigos, etapas, traducción, status HTTP y payload
  pipeline/                rutas de trabajo + runRenderPipeline (prepare → render → mix → mux → verify)
  http/                    transporte agnóstico de node:http, router, health, handler central, servidor
  __fixtures__/            call-log ordenado, dobles de los siete puertos y Timeline mínima
```

- **Los siete puertos son:** `renderMutedVideo`, `mixTimelineAudio`, `muxAudioIntoVideo`,
  `verifyMixLoudness`, `ensureDirectory`, `probeMediaBinaries`, `preloadEngineModules`
  (más `clock` y `logger`). No existe ningún puerto de borrado: conservar los intermedios (D-8) es
  una propiedad del tipo, no una decisión de runtime.
- **Corrección vs lo planificado:** `createNodeRenderApiDependencies(env)` recibe **sólo** el `env`.
  El esqueleto del `architect.md` §2.1 le pasaba además un `projectRoot` que ningún puerto usaba;
  se reintroduce en `cycle-02`, cuando el endpoint de render tenga que resolver la raíz del proyecto
  de medios por request.
- **Corrección vs lo planificado:** `constitution.md` §2 anuncia `node:util parseArgs`. Este ciclo no
  parsea argv: toda la configuración entra por variables de entorno (`readServerConfig(env)`).
- **Corrección vs lo planificado:** `context_prompt.md` declara dependencia de
  `@video-maker/auto-montage`. En `cycle-01` no se importa: las dependencias reales son
  `timeline-core` (tipos), `media-local` y `composition-remotion/render`.
- **Rutas del pipeline:** intermedios en `work/renders/<renderId>/` (`video-muted.mp4`, `master.wav`),
  entregable en `out/<renderId>.mp4`, `publicDir` = raíz del proyecto de medios. Cada ruta lleva su
  par `{ path, resource }`: `path` es de filesystem, `resource` es relativo al proyecto y es lo único
  que puede salir en un payload (RNF-6).
- **Superficie de errores:** 15 códigos en `RENDER_API_ERROR_CODES`, 5 etapas en
  `RENDER_PIPELINE_STAGES`, una sola subclase concreta (`PipelineStageError`). `translateEngineError`
  traduce estructuralmente por `code` (más `stream` para distinguir audio de video), nunca por
  `instanceof` de la lib. `toErrorPayload` jamás lee `.stack` y omite los campos nulos en vez de
  emitir `null`.

## Dependencias

- **Cero dependencias npm nuevas.** `package.json` y `pnpm-lock.yaml` sin cambios en todo el ciclo.
  `apps/render-api` **no tiene `package.json` propio**: vive del manifiesto raíz.
- Runtime: `node:http`, `node:fs/promises`, `node:path/posix`, `node:url`, `node:net`.
- Workspace: `@video-maker/timeline-core` (sólo tipos), `@video-maker/media-local` y
  `@video-maker/composition-remotion/render`, ambas **exclusivamente por `await import()` dinámico
  dentro de `src/deps/node-render-api-dependencies.ts`**. Ningún otro archivo del proyecto las
  importa en runtime; en el resto son `import type`, que se borra al compilar.
- Tests: Vitest 4 con alias a `src/` de las tres libs. El único spec que toca las libs pesadas las
  neutraliza con dos `vi.mock` con factory antes de importarlas, así que la suite corre sin ffmpeg,
  ffprobe ni Chrome.

## Qué sigue

- **`apps/render-api/eslint.config.mjs` sigue sin existir** (D-9, hook `config-protection`). El
  proyecto lintea contra el flat config de la raíz. El contenido propuesto en `architect.md` §8.2
  **no se puede pegar tal cual**: su regla de `node:fs` restringido necesita sumar
  `src/deps/node-render-api-dependencies.spec.ts` a los `ignores` — ese spec usa `node:fs/promises`
  real (`mkdtemp`/`rm`/`stat`) para probar `ensureDirectory` contra un directorio temporal.
- **El puerto default `4310` está ocupado** en la máquina del dev por `sdd/docs/serve.mjs`
  (`pnpm sdd:docs`). Arrancar con `RENDER_API_PORT` explícito si `sdd:docs` está corriendo.
- **El bundle webpack de Remotion no está verificado.** `GET /health` prueba que el módulo
  `composition-remotion/render` **carga**, no que bundlee. Eso se ejercita en el smoke E2E de `cycle-03`.
- `cycle-02`: store de assets sobre `media/` y persistencia de `Timeline`/`EDL`; ahí se reintroduce
  el `projectRoot` del adaptador.
- `cycle-03`: cola de jobs, progreso, cancelación, el endpoint que dispara `runRenderPipeline` y el
  smoke E2E con binarios reales.
