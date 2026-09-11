# FIX-e-burgos-008-001 — El job `storyboard` muere con `AI_AGENT_FAILED` sin detalle cuando `CLAUDE_CLI_MODEL` no está seteada

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-008-001                                                  |
| **Tipo**      | BUGFIX                                                                |
| **Severidad** | high                                                                  |
| **Keyword**   | [BUGFIX]                                                              |
| **Fecha**     | 2026-09-11                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | implemented                                                           |
| **Spec**      | spec-e-burgos-008-ai-storyboard                                       |
| **Origen**    | Caso real `media/display-ads`: el productor de la app se trabó pidiendo una "API key" que no existe. |

## Problema

Tres defectos encadenados, verificados sobre el proyecto real:

1. La API corría sin `CLAUDE_CLI_MODEL`, así que `claudeCliArgs` **no pasaba `--model`** y el CLI usaba
   el modelo por defecto del dev (`claude-fable-5-1[1m]`). Claude Code 2.1.123 lo rechaza con
   `API Error: 400 … claude_code_version_too_old … Run 'claude update'`, y el job `storyboard` fallaba
   en 5–10 s. Con `--model sonnet` la misma llamada funciona.
2. El adaptador tiraba `failed(payload.subtype)` y **descartaba `payload.result`**, que es donde el CLI
   escribe el error del proveedor. El `502 AI_AGENT_FAILED` llegaba sin una sola pista, y el productor
   le inventó al usuario que faltaba una API key (nunca hubo API key: el CLI usa la suscripción).
3. El modelo del turno del chat no llegaba a los jobs que el agente encola, así que aunque el usuario
   eligiera un modelo en la app, el `storyboard` seguía corriendo con el del servidor.

## Solución

- `CLAUDE_CLI_MODEL` tiene default **`sonnet`** (`DEFAULT_AI_AGENT_MODEL`) y `AiAgentConfig.model` deja
  de ser nullable: **nunca** se invoca el CLI sin `--model`.
- `AI_AGENT_FAILED` viaja con `details: { subtype, result }` recortados a 600 caracteres
  (`AI_AGENT_DETAIL_MAX_CHARS`) y con un `hint` específico —`update Claude Code: run \`claude update\``—
  cuando el `result` menciona `claude_code_version_too_old`. `mentionsRateLimit` sigue teniendo
  prioridad y mapeando 429/limit a `AI_AGENT_RATE_LIMITED`.
- `POST /projects/:slug/jobs` acepta `model?` en los jobs `storyboard` y `voice`, validado contra la
  misma lista `PRODUCER_MODELS` del FIX-e-burgos-015-001 (`422 JOB_MODEL_INVALID`). El `storyboard` lo
  pasa al CLI por `AiAgentRequest.model`; el `voice` lo acepta por uniformidad —el productor manda el
  mismo campo en todos sus `POST /jobs`— pero la síntesis es local y no lo usa.

## Justificación del bypass del SPEC GATE

Bug confirmado en producción de un proyecto real. No crea endpoints, módulos ni entidades: un default de
entorno, dos campos opcionales en el payload de error y un campo opcional en el body de EP-012, ya
registrado en `sdd/api.json`. Perfil `solo`, sin ciclo abierto.

## Archivos

`ai-agent-config`, `claude-cli-ai-agent`, `render-api-error`, `jobs/job-model-params`, `jobs-handler`,
`render-job`, `render-job-queue`, `run-storyboard-pipeline`, `to-error-payload`, `http-status-for` y el
README en `apps/render-api`; más `sdd/api.json`. Lista completa en `affected_files` de `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
