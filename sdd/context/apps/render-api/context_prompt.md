# Context Prompt — apps/render-api

> Entry point para agentes que trabajen sobre `apps/render-api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-005 cycle-03 | Fecha: 2026-09-09
> Consolidado por el orquestador al abrir `cycle-01` de `spec-e-burgos-007-web-montage`.

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario)
- **Estado:** **completo.** `spec-e-burgos-005-render-service` cerró en `cycle-03`: 15 rutas,
  37 códigos de error, 307 tests. Verificado contra binarios reales (538 frames a 1080×1920
  renderizados en 22,4 s contra `media/smoke-ingest`).
- **Specs que la gobiernan:** `spec-e-burgos-005-render-service` (la creó, completed) ·
  `spec-e-burgos-007-web-montage` (`cycle-01`, en curso: segundo tipo de job en la cola).
- **Rol en el sistema:** la puerta HTTP del motor. Es **el único subproyecto del monorepo que puede
  depender a la vez de `libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`)**:
  los `depConstraints` del `eslint.config.mjs` raíz impiden que esas dos libs se importen entre sí, y
  el tag `type:app` cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`. Por eso
  la orquestación `render → mix → mux → verify` en una sola llamada vive acá y en ningún otro lado.
- **Depende de:** `@video-maker/timeline-core`, `@video-maker/auto-montage`,
  `@video-maker/media-local` y `@video-maker/composition-remotion/render` (subpath `/render`
  exclusivamente, vía `await import()`). **Cero dependencias npm propias.**
- **No contiene lógica de motor propia:** si un cálculo hace falta, va a una lib. Acá vive sólo el
  transporte HTTP, la orquestación de llamadas y la traducción de errores a payload de máquina.
- **Consumidor:** `apps/web` (Web Studio), que consume HTTP y **no** exit codes, y el dev en su
  máquina.

## Mapa del código

```
src/
  main.ts                      única frontera de proceso (env, señales, exitCode, stdout/stderr)
  server-register.cjs          loader @swc-node/register acotado a .ts (devuelve el loader nativo de .js)
  config/                      readServerConfig(env) · readStoreConfig(env, cwd)
  deps/                        contrato de puertos + puerto ObjectStorage + adaptador de producción
  engine/                      nombres de módulos de motor y de binarios de media
  errors/                      37 códigos, 5 etapas, PipelineStageError, traducción y status HTTP
  pipeline/                    runRenderPipeline (prepare → render → mix → mux → verify) + observer
  jobs/                        RenderJob, máquina de estados pura, progreso monotónico, cola FIFO
  store/                       slug · asset-path · layout · catalog-merge · project-assets ·
                               project-scope (slug + proyecto + timeline) · serialize-by-key
  http/                        router con params y comodín, handlers, health, runtime, servidor
  __fixtures__/                call-log ordenado y dobles de todos los puertos
```

## Contrato y comportamiento que hay que respetar

- **15 endpoints, registrados campo a campo en `sdd/api.json`** (`EP-001`..`EP-015`). Es el contrato
  que `apps/web` consume: ningún campo publicado cambia de nombre, tipo ni semántica sin un ciclo
  que lo declare.
- **`GET /health`** reporta módulos de motor, binarios (por nombre lógico y variable de entorno,
  **nunca** por ruta resuelta), `capabilities` y `jobs: { running, queued }`. El bloque `jobs` es un
  contador de carga: **nunca** afecta el cálculo `ok`/`degraded`.
- **Cola de jobs:** FIFO, **concurrencia 1**, en memoria. Seis estados
  (`queued`/`running`/`canceling`/`succeeded`/`failed`/`canceled`). Cancelación **cooperativa**: no
  se señala ni se mata ningún proceso; `queued + cancel → canceled` (200), `running + cancel →
  canceling` (202) y se liquida en el próximo checkpoint de etapa. **El estado vigente gana sobre el
  resultado del pipeline**: cancelar durante `verify` da `canceled` con `report: null` aunque el MP4
  exista. Un job fallado es `200` con el error tipado **en el body**, no un status HTTP de error.
- **El `Timeline` se snapshotea al crear el job**: un job siempre rinde el documento que existía
  cuando se creó, nunca un `PUT` posterior.
- **Upload atómico**: validación pura completa **antes del primer puerto**, luego `writeTemporary`
  en `work/.uploads/` → `stat` → `promoteTemporary` (rename). Un fallo de `probeAsset` **no** borra
  el archivo: registra la falla en `catalog.probeFailures` con el mensaje estático del código propio.
- **Bytes idénticos a los de la CLI**: `PUT` de `Timeline`/`EDL` escribe con `writeTimeline` /
  `writeEditDecisionList` de `@video-maker/auto-montage`, así que el `diff` contra
  `tools/render-cli` da bytes idénticos (D-16). Cualquier ciclo que escriba un artefacto de `work/`
  usa los escritores de la lib, nunca `JSON.stringify` propio.

## Variables de entorno

| Variable | Default | Regla |
| --- | --- | --- |
| `RENDER_API_HOST` | `127.0.0.1` | Cualquier string no vacío se usa tal cual. El default nunca escucha fuera de loopback. |
| `RENDER_API_PORT` | `4310` | Entero `0..65535`. Inválido ⇒ aborta con `SERVER_CONFIG_INVALID` (exit 78), nunca cae al default en silencio. |
| `RENDER_API_MEDIA_ROOT` | `media` (contra `process.cwd()`) | Raíz a la que se confina todo el I/O del store y bajo la que resuelve el `projectRoot` de cada job. |
| `RENDER_API_MAX_UPLOAD_BYTES` | `2147483648` | Entero positivo. Enforced dos veces: por `content-length` y mientras el body streamea. |
| `RENDER_API_OBJECT_STORE` | `fs` | Sólo `fs` (D-11, MinIO descopado). Cualquier otro valor ⇒ exit 78. |
| `FFMPEG_PATH` / `FFPROBE_PATH` | — | Sin la variable, se resuelve por `PATH`. |

**El puerto default `4310` puede estar tomado** por el visor de docs del kit SDD (`pnpm sdd:docs`).
Un `EADDRINUSE` ahí no es un defecto del servicio: usar otro puerto (el smoke usa `4399`).

## Trampas conocidas (medidas, no teóricas)

- **`nx run render-api:serve` NO propaga el exit code real** (Nx normaliza todo fallo a `1`). Para
  observar un exit code exacto hay que invocar el binario directo con
  `SWC_NODE_PROJECT=tsconfig.base.json node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts`.
- **El exit code después de un render no es parte del contrato:** `SIGTERM` responde `0` en un
  proceso que no rindió nada y **143** en uno que sí, porque `@remotion/renderer` instala sus
  propios handlers de señal. Un `process.exit(0)` explícito se probó y **no** lo corrige. Ningún
  supervisor debe basar su lógica de reinicio en ese código.
- **El store no es seguro entre procesos.** La serialización por slug (`createKeyedSerializer`) es
  intra-proceso: correr `tools/render-cli` contra un proyecto mientras la API escribe su catálogo es
  una carrera y gana el que escribe último. La cola tiene el mismo riesgo: concurrencia 1 vale
  **dentro de un** proceso.
- **La cola no persiste** entre reinicios y no tiene cap de historial. Un job perdido cae en el
  mismo `404 RENDER_JOB_NOT_FOUND` que un id inexistente, así que agregar un cap después no cambia
  ningún contrato observable.
- **Los binarios reales sólo se ejercitan en el smoke manual**, nunca en CI. Antes de correrlo:
  `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` vacío y ≥ 35 % de memoria libre (el `[Cc]hrome`
  del guion original matchea el navegador del dev y aborta el smoke con un falso positivo).
