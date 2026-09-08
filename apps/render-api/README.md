# render-api

Servicio HTTP que orquesta el pipeline de render silencioso + mezcla de audio masterizada +
mux + verificación de loudness sobre un proyecto de `media/<project-slug>/`. Cierra `cycle-01`
de `spec-e-burgos-005-render-service`: expone `GET /health` y deja `runRenderPipeline`
implementado y cubierto por tests, pero **sin ningún endpoint que lo dispare todavía** (llega en
`cycle-03`, junto con la cola de jobs).

## Comandos

```bash
pnpm nx run render-api:lint
pnpm nx run render-api:test
pnpm nx run render-api:build
pnpm nx run render-api:serve
```

`serve` es cómodo para desarrollo, pero **no propaga el exit code real del proceso**: Nx
normaliza cualquier fallo de `nx:run-commands` a `1`. Para observar un exit code exacto (por
ejemplo al verificar `CA-002`) hay que invocar el binario directamente, nunca a través de `nx
run`:

```bash
SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts
```

`server-register.cjs` registra `@swc-node/register` acotado a `.ts` y devuelve el loader nativo
de `.js` apenas termina — es lo que permite que Remotion bundlee con webpack en el mismo proceso
sin que `@swc-node/register` intente compilar los `.js` de terceros que inyecta.

## Variables de entorno

| Variable | Default | Regla |
| --- | --- | --- |
| `RENDER_API_HOST` | `127.0.0.1` | Cualquier string no vacío se usa tal cual. El default nunca escucha fuera de loopback: abrirlo es una decisión explícita del operador. |
| `RENDER_API_PORT` | `4310` | Entero `0..65535`. Vacío o ausente usa el default. Presente e inválido (no entero o fuera de rango) aborta el arranque con `SERVER_CONFIG_INVALID` — nunca cae en el default en silencio. |
| `FFMPEG_PATH` | — | Ruta al binario `ffmpeg`. Sin esta variable, se resuelve por `PATH`. |
| `FFPROBE_PATH` | — | Ruta al binario `ffprobe`. Sin esta variable, se resuelve por `PATH`. |

**El puerto por defecto (`4310`) puede estar ocupado en esta máquina por el visor de docs del
propio kit SDD** (`pnpm sdd:docs`, que corre `sdd/docs/serve.mjs`). Si el arranque falla con
`EADDRINUSE`, no es un defecto del servicio: usar otro puerto para la verificación manual, por
ejemplo `RENDER_API_PORT=4319`.

## Exit codes del proceso

| Código | Causa |
| --- | --- |
| `0` | Apagado normal por `SIGINT`/`SIGTERM`. |
| `78` | Configuración inválida (`SERVER_CONFIG_INVALID`, típicamente `RENDER_API_PORT`). |
| `1` | Cualquier otro fallo de arranque. |

Ningún camino de arranque imprime `.stack`; el error va por stdout/stderr como una línea JSON
(`{"event": "startup-failed", "error": {...}}`).

## Errores HTTP

Todo error responde JSON con el sobre `{ "error": { code, stage, message, resource?, expected?,
hint? } }` — `resource`, `expected` y `hint` se omiten cuando no aplican, nunca viajan como
`null`. El mapeo completo `código propio → status HTTP` está en `architect.md` del ciclo, §5.5
(`httpStatusFor`); no se duplica acá para no desincronizarse. Los dos códigos de transporte que sí
importan para consumir `GET /health` hoy:

| Código | HTTP | Origen |
| --- | --- | --- |
| `ROUTE_NOT_FOUND` | 404 | Ningún route matchea el path. |
| `METHOD_NOT_ALLOWED` | 405 | El path existe con otro método (trae header `Allow`). |

## Alcance descopado de `cycle-01`

- **No hay endpoint que dispare `runRenderPipeline`.** La función existe y está cubierta por
  tests; conectarla a una ruta HTTP, con cola de jobs y progreso, es `cycle-03`.
- **No hay MinIO ni cliente S3.** El store sigue siendo el filesystem local
  (`media/<project-slug>/`), igual que `tools/render-cli`.
- **No hay endpoints de assets, upload, probe ni persistencia de `Timeline`/`EDL`.** Llegan en
  `cycle-02`.
- **El bundle webpack de Remotion no está verificado en este ciclo.** `GET /health` prueba que
  `@video-maker/composition-remotion/render` se importa y expone sus símbolos
  (`engine[].loaded`), no que `bundleProject`/`renderMedia` corren. Se ejercita en el smoke E2E de
  `cycle-03`.
- **`apps/render-api/eslint.config.mjs` no existe.** El hook `config-protection` del harness
  bloquea escribir o editar cualquier archivo llamado `eslint.config.mjs`, sin distinguir raíz de
  proyecto de subproyecto; rodearlo con otra herramienta anularía esa protección. El proyecto
  lintea hoy contra el flat config de la raíz (mismo camino que `tools/render-cli`, que tampoco
  tiene el archivo). El contenido propuesto para cuando se decida crearlo está en `architect.md`
  del ciclo, §8.2 — agrega la frontera de proceso (`process`/`console` solo en `main.ts`),
  la prohibición de `execa`/`child_process`/`node:fs` fuera del adaptador, y de `.stack` en
  cualquier payload. Nota para quien lo pegue: la sección de `node:fs` de ese borrador ignora
  `src/deps/node-render-api-dependencies.ts` y `src/main.ts`, pero no
  `node-render-api-dependencies.spec.ts` — ese spec necesita `node:fs/promises` real
  (`mkdtemp`/`stat`/`rm`) para probar `ensureDirectory` contra un directorio temporal genuino, así
  que el `ignores` tiene que sumar ese archivo también o el lint quedaría roto apenas se active.
