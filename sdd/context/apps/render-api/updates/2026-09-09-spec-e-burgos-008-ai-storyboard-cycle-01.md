# spec-e-burgos-008-ai-storyboard cycle-01 — 2026-09-09

## Estado

Tercer tipo de job en la misma cola: `kind: 'storyboard'` produce `work/storyboard.json` desde un
`brief` **o** un `scriptText` (exactamente uno; ninguno o los dos es `422
STORYBOARD_INPUT_INVALID`, evaluado antes de registrar el job), con `overwrite` explícito
(`409 STORYBOARD_ALREADY_EXISTS` sin él, verificado sobre HTTP real: el listado de jobs del
proyecto sigue en dos). Etapas propias `collect | propose | persist`, monótonas, con checkpoints de
cancelación **entre** etapas y nunca dentro de la llamada al agente.

Tres endpoints nuevos —`EP-016` `GET /projects/:slug/storyboard`, `EP-017` `PUT`, `EP-018`
`GET .../storyboard/prompts`— y `EP-012`/`EP-001` en `updated`. `apps/web` no se tocó
(`git diff --stat apps/web` vacío). `GET /health` suma `capabilities.storyboardQueue`; `cycle`
sigue en `3`.

**La IA es un binario, no un servicio.** Puerto `aiAgent` en `RenderApiDependencies` con un único
adaptador `ClaudeCliAiAgent` que invoca `claude -p` por el `CommandRunner` ya inyectable. **Sin API
key**: el CLI usa la suscripción de la máquina. Nueve códigos de error nuevos (cuatro del agente,
cinco del documento). Smoke real ejecutado con `claude -p`: brief → 8 escenas en 100,6 s,
`scriptText` → 5 escenas en 70,2 s respetando el guion palabra por palabra, export de prompts en
`text/plain` numerado desde `01`. Cobertura 97,58 % stmts · 91,30 % branch (piso 80 %), 580 tests.

## Estructura

- `src/ai/claude-cli-ai-agent.ts`: arma los argumentos (`--print`, `--system-prompt`,
  `--output-format json`, `--json-schema`, `--tools ""`, `--permission-mode dontAsk`,
  `--disable-slash-commands`), parsea la única línea JSON de stdout, toma `structured_output` y
  clasifica el fallo en `AI_AGENT_UNAVAILABLE` (503) · `AI_AGENT_RATE_LIMITED` (429) ·
  `AI_AGENT_FAILED` (502) · `AI_AGENT_INVALID_OUTPUT` (502). **Nunca mete `stderr`, rutas absolutas
  del host ni `.stack` en el payload**: sólo escanea `subtype`/`result` buscando el marcador de
  cuota. `502` y no `500` porque el fallo es de un proceso externo.
- `src/config/ai-agent-config.ts`: `CLAUDE_CLI_PATH` (default `claude`), `CLAUDE_CLI_CWD` (default
  el temporal del SO, **fuera del repo** para que el CLI no cargue el `CLAUDE.md` del proyecto),
  `CLAUDE_CLI_TIMEOUT_MS` (default 600000), `CLAUDE_CLI_MODEL`.
- `src/storyboard/`: `storyboard-store.ts` (lectura estricta, escritura con
  `serializeMontageDocument` de `auto-montage` y `readStoryboardIfUsable` para el inventario),
  `collect-storyboard-inventory.ts` (assets del catálogo, transcripción del A-roll, storyboard
  previo; un catálogo corrupto es `CATALOG_UNREADABLE`, una transcripción o un storyboard previo
  ilegibles se **ignoran** en vez de bloquear la generación), `build-storyboard-prompt.ts` (prompts
  en inglés, salida en el idioma del pedido), `render-storyboard-prompts.ts`.
- `src/jobs/`: `storyboard-job-params.ts`, `storyboard-pipeline-observer.ts`,
  `storyboard-job-progress.ts`, `run-storyboard-pipeline.ts` (estampa la etapa en el error tipado
  que llega sin ella, y no reestampa el que ya la trae).
- `render-job.ts` pasa de dos a **tres** miembros en la unión discriminada por `kind`. Agregar uno
  rompe la exhaustividad en todos los call sites: es la red de seguridad, no un costo.
- `http-message.ts` gana `PLAIN_TEXT_CONTENT_TYPE` y `plainTextResponse(status, text)`, que emite
  `content-length` y un `stream` propio: el servidor hace `JSON.stringify` de todo `body` sin
  `stream`, así que **texto plano sin `stream` saldría entrecomillado**.
- **`StoryboardDocument` vive en `libs/timeline-core`, no acá** (regla vigente: la app no tiene
  lógica de motor propia; `spec-010` produce la `Timeline` desde ese documento dentro de las libs).

## Dependencias

Ninguna dependencia npm nueva (`git diff --stat package.json pnpm-lock.yaml` vacío). Lo nuevo es
consumo de `@video-maker/timeline-core` (el contrato del storyboard) y del binario externo `claude`,
que entra por el mismo `CommandRunner` de `media-local` que ya usaban ffmpeg y whisper.

## Qué sigue

- `cycle-02` de esta spec: la UI en `apps/web` sobre este contrato (backend cerrado).
- **`claude` no está en `binaries` de `GET /health`** (D-12): esa lista la resuelve `media-local` y
  meterlo volvería `degraded` toda máquina sin Claude Code, CI incluido. Una sonda propia del
  agente en `/health` es decisión de un ciclo futuro.
- `captionsStyle` y los `*Tags` son strings libres hasta `spec-012` y `spec-011`. En el smoke el
  modelo escribió `captionsStyle` como una frase en español en vez de un nombre de estilo: cuando
  exista el catálogo hay que cerrarlo a un enum en el prompt y en el schema.
- Los specs **no se typechequean**: `tsconfig.lib.json` los excluye y Vitest no tipa. Dos tests de
  `spec-005`/`007` creaban un job **sin `kind`** y pasaban porque el ternario los volvía `montage`
  en silencio; el `switch` exhaustivo de este ciclo los delató. Vale para todo `*.spec.ts` del
  subproyecto.
