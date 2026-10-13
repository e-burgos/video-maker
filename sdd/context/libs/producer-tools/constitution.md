# Constitución — libs/producer-tools

> Versión 2.0 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

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
- **Contrato vigente: 32 tools** (`get_project_overview` con `mode`, `pendingAssets`, jobs `review`/`publish` vía
  `StudioListedJobKindSchema`; `search_free_media`, `import_media`, `view_images` —1–6 fotos, acepta `brand:<clave>`—,
  `patch_timeline`, `get_motion_brands`, `read_motion_brief`, `write_motion_brief` —acepta `boxes`, `source` por caja,
  completa quién/cuándo de las medidas y rechaza pisar una caja dada—, `read_motion_storyboard`, `get_render_review`
  —espera el job review en curso y devuelve cuadros por escena—, `propose_production`, `get_reference_brief`,
  `review_material`, `record_visual_review` —el error de cuadros sin ver nombra escena y cuadros—,
  `set_voice_direction` —por línea del guion y por escena del storyboard narrado; escribe
  `work/producer/voice-direction.json` validado—, `draft_publication`, `list_publications` —sólo ítems de la cola del
  proyecto—, `queue_publication` —exige `userConfirmation` con la cita del sí del usuario; nunca lanza jobs
  `publish`—). `start_job` acepta `kind: motion` y `reference`, y `musicMode` en montage. Cliente: `searchFreeMedia`,
  `importFreeMedia`, `previewImages`. No hay tool para escribir el storyboard (existe `PUT`): sumarla si el productor
  necesita editar escenas.
- **Guardas del productor**: `propose_production` exige revisión de material (`MATERIAL_NOT_REVIEWED`);
  `start_job` render/motion completo sin propuesta aprobada se bloquea con `PROPOSAL_NOT_APPROVED` salvo
  `skipProposal: true` a pedido explícito del dev (`sample` nunca se bloquea). `patch_timeline` reemplaza solo `logo`,
  `bumpers`, `audioMix`, `captionStyle`, `safeZone` y `tracks.music` (get → merge → `TimelineSchema` → put; los
  subtítulos nunca viajan: con `put_timeline` el modelo re-escribía 12 KB y perdía las tildes). `put_timeline` acepta
  el timeline como string JSON y rechaza (`INVALID_INPUT`) un cambio en el texto de los subtítulos salvo
  `editCaptions: true`; la guarda vive en la tool, no en `PUT /timeline` (lo usa el editor de la web).
  `wait_for_job.error` = `RenderApiJobErrorSchema` (`z.looseObject`: `code`, `stage`, `message`, opcionales
  `resource`/`expected`/`hint`).
- `prompt/` construye el system prompt del productor contra las herramientas, nunca contra shell.
  `get_project_overview` suma `pendingAssets`: el prompt obliga a pedir confirmación de lo
  pendiente antes de usarlo. Además: B-roll o fotos libres con `search_free_media`/`import_media`; mirar fotos con
  `view_images`, nunca con `extract_frames`; receta motion cuando el proyecto es motion (brief → storyboard → resumen y
  OK → video); sección "Brand" con nombre, tagline y web en guiones y cierres cuando hay marca (el productor no crea
  marcas); receta de material crudo con marca (logo ya cargado, subtítulos `brand`, cierre con tagline y web; estilos
  derivados de timeline-core); proponer 2–3 enfoques y esperar aprobación antes del primer render completo; analizar
  la referencia y basar la propuesta en su ritmo, duración y estructura; secciones Material y "Reviewing a finished
  render" (mirar antes de elegir, cajas como dato, todo lo que nombra la voz se ve, revisiones en el idioma del
  usuario); sección "Publishing on YouTube"; pestañas por su nombre en el idioma del usuario; la despedida de la receta
  sólo si entra antes del final del A-roll (~2,5 palabras/s + gap); una falla determinista nunca es "transitoria".
- `extract_frames` no declara `outputSchema`: Claude Code 2.1.123 le pasa al modelo
  `structuredContent` en vez de bloques de imagen — toda tool nueva que devuelva imágenes sigue ese
  patrón (`view_images` también va en `TOOLS_WITHOUT_OUTPUT_SCHEMA`; el `tool_result` del `stream-json` trae `[image, text]`). `start_job` (unión discriminada por `kind`) se publica vacía por el SDK: su `description`
  lleva un ejemplo por `kind`. Los literales de parámetros del prompt tienen que salir del
  contrato — el smoke encontró `voiceId` donde el campo es `voice`.
- `e2e/openrouter-model-bench.mjs`: benchmark reproducible del motor OpenRouter con tope de gasto,
  lee la key del llavero en memoria. Flags: `--discover-free` (candidatos `:free` vivos del
  catálogo con `tools` + `image`), `--out=<dir>`, `--report-name=<base>`, `--title=<texto>`,
  `--base-port=<n>` (default 4520), `--backoff-ms`, `--rate-limit-retries` (la cuota diaria se declara sólo por error explícito); corta todos los gratuitos restantes al primer
  `OPENROUTER_FREE_QUOTA_EXHAUSTED`. Cada corrida lanza su server con `process.execPath` y espera
  su `exit` real (SIGTERM → SIGKILL) — sin eso quedan `render-api` huérfanos escuchando.

## 4. Convenciones propias

- Ninguna herramienta recibe el slug del proyecto ni rutas absolutas: el alcance lo fija el
  proceso del servidor al arrancar.
- Todo error sale como `{ code, hint }` de la lista cerrada del contrato, sin rutas del host ni stderr.
- La lib no importa `apps/*`; `render-api` depende de ella, nunca al revés.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).

## Lecciones específicas

- Cada error tipado se define para su concepto: no copiar el schema de error de otro.
- El prompt nombra las pantallas actuales del estudio: revisarlo al renombrar una.
