# spec-e-burgos-018-producer-free-tier cycle-02 — 2026-09-25

## Estado
El job `storyboard` corre sobre el motor efectivo del productor: Claude CLI (`claude -p --json-schema`) u
OpenRouter (AI SDK 7, salida estructurada). Smoke real con DeepSeek 3/3 con un brief común; camino Claude
verificado con `structured_output` válido.

## Estructura
- `src/ai/openrouter-ai-agent.ts`: segundo `AiAgentPort`; mapea fallas a `OPENROUTER_KEY_MISSING`,
  `OPENROUTER_FREE_QUOTA_EXHAUSTED`, `AI_AGENT_RATE_LIMITED`, `AI_AGENT_INVALID_OUTPUT`, `AI_AGENT_FAILED`.
- `src/ai/effective-ai-agent.ts`: elige el agente por request con `resolveEffectiveProducerEngine`; en OpenRouter
  usa el `model` del job solo si es un id de OpenRouter conocido, si no el modelo configurado o el default.
- `src/producer/openrouter-model-knowledge.ts`: carga compartida catálogo/lista recomendada (productor y storyboard).
- `run-storyboard-pipeline.ts`: si la propuesta no pasa `StoryboardProposalSchema`, un reintento de reparación con
  los issues de Zod; el uso de las dos llamadas se suma y el reporte trae `repaired`.
- `node-render-api-dependencies.ts` arma `const deps` y el `aiAgent` se cierra sobre él (resolución perezosa).

## Dependencias
Sin nuevas (`ai` 7.0.113 y `@openrouter/ai-sdk-provider` 3.1.0 ya estaban en la raíz).

## Qué sigue
`cycle-03`: material libre (video e imágenes) y herramienta para mirar fotos.
