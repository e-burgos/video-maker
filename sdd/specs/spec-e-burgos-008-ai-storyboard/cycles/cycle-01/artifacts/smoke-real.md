# Smoke real — spec-e-burgos-008 cycle-01 (2026-09-09)

Ejecutado contra `claude -p` **real**, con el binario de `apps/render-api` levantado sobre una
copia temporal de `media/smoke-ingest`. El material del dev no se tocó.

## Entorno

- `claude` 2.1.123 (`/opt/homebrew/bin/claude`), autenticado con la suscripción de la máquina.
  **Sin `ANTHROPIC_API_KEY`.**
- `CLAUDE_CLI_MODEL=sonnet`, `RENDER_API_PORT=4401`, `RENDER_API_MEDIA_ROOT=<tmp>`.
- `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` vacío antes de arrancar.

## Hallazgo que costó la primera corrida (CAUSA RAÍZ, corregida)

La primera corrida terminó en `failed` con `AI_AGENT_INVALID_OUTPUT` / `stage: propose`.
Reproduciendo la llamada a mano se vio que **`--json-schema` se ignora en silencio cuando el
schema declara la clave `$schema`**: la respuesta vuelve con `is_error: false`,
`subtype: "success"` y **sin `structured_output`**, con el JSON en prosa dentro de `result`.

```
# con "$schema": https://json-schema.org/draft/2020-12/schema
is_error False subtype success
has structured_output: False
result[:200]: '```json\n{\n  "storyboard": {\n    "title": "Trampas del Monorepo con Nx", ...

# el mismo schema, sin la clave "$schema"
is_error False subtype success
has structured_output: True
```

Corregido en el origen: `storyboardProposalJsonSchema()` descarta `$schema` y `$id`, y un test lo
sostiene. El error tipado hizo exactamente su trabajo: dijo el código, la etapa y qué se esperaba.

## Puerto ocupado: un servidor viejo respondió un build stale

`RENDER_API_PORT=4399` (el puerto del smoke de `spec-007`) estaba tomado por un proceso
`render-api` de otro ciclo. `curl /health` respondió **200 con un `capabilities` sin
`storyboardQueue`**: el guion siguió contra el servidor equivocado hasta que se leyó el log
(`EADDRINUSE`). Regla que queda en el README: **verificar en `/health` una capacidad que sólo
existe en el build bajo prueba antes de creerle una sola respuesta al smoke.**

## Corrida 1 — job `storyboard` desde un `brief` (CA-013)

`POST /projects/smoke-ingest/jobs` con `{"kind":"storyboard","brief":"…"}` → `202`,
`state: running`, `progress.stage: collect`.

```json
{
  "state": "succeeded",
  "progress": { "stage": "persist", "percent": 100 },
  "report": {
    "storyboardPath": "work/storyboard.json",
    "storyboardId": "67afefd1-402e-4873-8578-e3ddaca9ff44",
    "source": "brief",
    "language": "es-AR",
    "sceneCount": 8,
    "usage": { "tokensIn": 63232, "tokensOut": 6344, "costUsd": 0.1459287, "model": "claude-sonnet-4-6" }
  }
}
```

100,6 s de punta a punta. `GET /projects/smoke-ingest/storyboard` respondió `200` con el documento
—o sea que **validó contra `StoryboardDocumentSchema` al leerlo**—: 8 escenas, `es-AR`, `9:16`,
mezcla de `remotion-scene` (`title`, `code`) y `asset` sobre los ids reales del catálogo. Documento
completo en `smoke-storyboard-from-brief.json`.

## Corrida 2 — export de prompts (CA-015)

`GET /projects/smoke-ingest/storyboard/prompts` → `200`,
`content-type: text/plain; charset=utf-8`, `content-length: 1834`, numerado desde `01`, un bloque
por escena con su fuente anotada. Salida completa en `smoke-prompts-export.txt`.

## Corrida 3 — `overwrite` y la rama `scriptText` (CA-007, CA-014)

Sin `overwrite`, sobre el proyecto que ya tenía storyboard:

```
HTTP 409
{"error":{"code":"STORYBOARD_ALREADY_EXISTS","stage":null,"message":"A storyboard already exists for this project.","resource":"work/storyboard.json"}}
```

Con `{"kind":"storyboard","scriptText":"…","overwrite":true}` → `succeeded` en 70,2 s,
`source: "script"`, 5 escenas, y **la narración de cada escena es el texto del guion, sin
reescribir**: el corte cae donde cambia el visual. Documento en
`smoke-storyboard-from-script.json`.

## Corrida 4 — errores tipados sobre HTTP real

| Body | Código | HTTP |
| --- | --- | --- |
| `{"kind":"storyboard"}` | `STORYBOARD_INPUT_INVALID` | 422 |
| `{"kind":"storyboard","brief":"a","scriptText":"b"}` | `STORYBOARD_INPUT_INVALID` | 422 |
| `{"kind":"storyboard","brief":"a","overwrite":"yes"}` | `STORYBOARD_OVERWRITE_INVALID` | 422 |
| `{"kind":"voice"}` | `JOB_KIND_INVALID` | 422 |

`GET /projects/smoke-ingest/jobs` al final lista **exactamente dos** jobs (los dos que
corrieron): ningún pedido rechazado registró job.

## Prompt y respuesta literales

Capturados invocando el **mismo código de producción** (`collectStoryboardInventory` →
`buildStoryboardSystemPrompt`/`buildStoryboardUserPrompt` → `claudeCliArgs` →
`ExecaCommandRunner`) sobre una copia limpia del proyecto:

- `claude-cli-system-prompt.txt` — system prompt literal.
- `claude-cli-user-prompt.txt` — user prompt literal, con el inventario del catálogo y la
  transcripción del A-roll inyectadas.
- `storyboard-proposal.schema.json` — el JSON Schema derivado que viajó en `--json-schema`.
- `claude-cli-response.json` — respuesta literal del CLI: `is_error: false`, `subtype: success`,
  `duration_ms: 81663`, `structured_output` con 5 escenas,
  `usage: { input_tokens: 4, cache_creation_input_tokens: 34927, cache_read_input_tokens: 25915, output_tokens: 4841 }`,
  `total_cost_usd: 0.21137775`.

## Cuota

No hubo `429` en ninguna de las cuatro llamadas reales. La rama `AI_AGENT_RATE_LIMITED` quedó
verificada por test contra una salida real del CLI con el marcador de límite de plan, no en vivo.
