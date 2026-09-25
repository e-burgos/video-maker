# spec-e-burgos-018-producer-free-tier — cycle-02 · plan (lite)

> Módulo: producer-free-tier | Subproyectos: apps/render-api, apps/web | Fecha: 2026-09-25
> Flow: **lite** — perfil `solo`, sin aprobaciones intermedias a pedido del dev.
> Objetivo: que un usuario sin Claude pueda generar el storyboard (O-2 de la spec).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C2-01 | Se implementa un segundo `AiAgentPort` (`openrouter-ai-agent.ts`) sobre AI SDK 7 + `@openrouter/ai-sdk-provider` con salida estructurada contra `storyboardProposalJsonSchema()`; `run-storyboard-pipeline.ts` no cambia | El puerto ya aísla el motor; el contrato del documento queda igual y `parseProposal` sigue validando con Zod |
| D-C2-02 | El motor se elige por request con la misma regla del productor (`resolveEffectiveProducerEngine`: setting + `claude` disponible + key guardada) | Un solo criterio: si el chat anda con OpenRouter, el storyboard también |
| D-C2-03 | Con OpenRouter, el modelo es el `model` del job solo si es un id de OpenRouter conocido; si no (alias `sonnet`/`haiku`), el modelo configurado del productor o el default recomendado | Los alias de Claude no significan nada en OpenRouter |
| D-C2-04 | Errores de OpenRouter se traducen a los códigos existentes (`AI_AGENT_*`, `OPENROUTER_KEY_MISSING`, `OPENROUTER_FREE_QUOTA_EXHAUSTED`) y el panel del storyboard muestra un mensaje para cada uno | Sin códigos nuevos que la web no conozca |
| D-C2-05 | Smoke real con `deepseek/deepseek-v4.1-flash` contra un clon del proyecto `display-ads-analiticas`, tope US$0.10 | Barato y es el default de OpenRouter |

## Historias

- **US-018-201 — Storyboard con OpenRouter.** CA: con motor OpenRouter y key guardada, `POST /projects/:slug/jobs
  {kind:"storyboard"}` termina en `succeeded`, deja `storyboard.json` válido contra el schema y el reporte trae
  tokens, costo y el id del modelo de OpenRouter; con Claude, el comportamiento no cambia.
- **US-018-202 — Fallas claras.** CA: sin key, con cuota gratuita agotada o con salida inválida, el job falla con
  un código conocido y el panel lo explica en español e inglés.

## Tasks (detalle en tasks.json)

- **TASK-001** — Adaptador OpenRouter del `AiAgentPort`.
- **TASK-002** — Selección por motor efectivo y mensajes en la web.
- **TASK-003** — Smoke real con DeepSeek.
- **TASK-004** — Cierre del ciclo.
