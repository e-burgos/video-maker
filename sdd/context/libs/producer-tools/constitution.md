# Constitución — libs/producer-tools

> Versión 1.1 | Última actualización: consolidación spec-017 cycle-01/03/04/05 + spec-018 cycle-01 | Fecha: 2026-09-25

## 1. Propósito

- **Tipo:** lib TypeScript (Node)
- **Rol en el sistema:** fuente única de las herramientas del productor conversacional: contrato
  (nombres, schemas Zod de entrada y salida, errores tipados), handlers sobre un puerto
  `RenderApiClient`, servidor MCP stdio acotado a un proyecto y prompt del productor. Dos motores la
  consumen: `apps/render-api` lanza `claude -p` con el servidor MCP `mcp/`, y el runtime OpenRouter
  (`runtime/`) llama los mismos handlers en proceso, sin MCP.

## 2. Stack tecnológico

- TypeScript + Zod (contrato) + `@video-maker/timeline-core`, Vitest.
- Motor Claude Code: `@modelcontextprotocol/sdk` ^1.30.1 — importar solo subpaths, la raíz del
  paquete no resuelve en esta versión.
- Motor OpenRouter: `ai` 7.0.113 (Vercel AI SDK) + `@openrouter/ai-sdk-provider` 3.1.0.

## 3. Estructura y patrones

- `contract/` puro y sin I/O: es lo que se congela en
  `sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-01/plan.md` § Contrato MCP.
- `handlers/` y `client/` hablan con `render-api` solo por el puerto `RenderApiClient` (incluye
  `listPendingAssets()` sobre `GET /projects/:slug/inbox`).
- `mcp/` es el servidor stdio (`main.ts`, `studio-mcp-cli-args.ts`, `studio-mcp-launch.ts`,
  `mcp-register.cjs`; target Nx `mcp`). Se compila a JS con `producer-tools:bundle` y corre con el
  Node de Electron: `buildStudioMcpLaunchCommand` acepta `compiledEntryPath` (agrega
  `ELECTRON_RUN_AS_NODE=1`) y `accessToken` (`STUDIO_API_TOKEN`), que el cliente HTTP manda como
  header `x-studio-token`.
- `runtime/` (motor OpenRouter): `studio-ai-sdk-tools.ts` expone los mismos handlers como tools
  `mcp__studio__<tool>` (errores como `error-json`, imágenes como partes `file` solo si el modelo
  las acepta) y `openrouter-producer-runtime.ts` (`runOpenRouterProducerTurn`,
  `runProducerTurnWithModel` para tests con `MockLanguageModelV4`). Un 429 llega envuelto en
  `RetryError`: hay que desenvolver `lastError` antes de clasificar; la cuota diaria de modelos
  gratis es `OPENROUTER_FREE_QUOTA_EXHAUSTED` y no se reintenta (el `fetch` reescribe ese 429 a 400).
- `prompt/` construye el system prompt del productor contra las herramientas, nunca contra shell.
  `get_project_overview` suma `pendingAssets`: el prompt obliga a pedir confirmación de lo
  pendiente antes de usarlo.
- `extract_frames` no declara `outputSchema`: Claude Code 2.1.123 le pasa al modelo
  `structuredContent` en vez de bloques de imagen — toda tool nueva que devuelva imágenes sigue ese
  patrón. `start_job` (unión discriminada por `kind`) se publica vacía por el SDK: su `description`
  lleva un ejemplo por `kind`. Los literales de parámetros del prompt tienen que salir del
  contrato — el smoke encontró `voiceId` donde el campo es `voice`.
- `e2e/openrouter-model-bench.mjs`: benchmark reproducible del motor OpenRouter con tope de gasto,
  lee la key del llavero en memoria. Flags: `--discover-free` (candidatos `:free` vivos del
  catálogo con `tools` + `image`), `--out=<dir>`, `--report-name=<base>`, `--title=<texto>`,
  `--base-port=<n>` (default 4520); corta todos los gratuitos restantes al primer
  `OPENROUTER_FREE_QUOTA_EXHAUSTED`. Cada corrida lanza su server con `process.execPath` y espera
  su `exit` real (SIGTERM → SIGKILL) — sin eso quedan `render-api` huérfanos escuchando.

## 4. Convenciones propias

- Ninguna herramienta recibe el slug del proyecto ni rutas absolutas: el alcance lo fija el
  proceso del servidor al arrancar.
- Todo error sale como `{ code, hint }` de la lista cerrada del contrato, sin rutas del host ni stderr.
- La lib no importa `apps/*`; `render-api` depende de ella, nunca al revés.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
