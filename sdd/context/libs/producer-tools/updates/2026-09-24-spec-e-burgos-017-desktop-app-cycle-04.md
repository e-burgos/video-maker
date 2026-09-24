# spec-e-burgos-017-desktop-app cycle-04 — 2026-09-24

## Estado
Segundo motor del productor: OpenRouter sobre Vercel AI SDK 7.0.113 + `@openrouter/ai-sdk-provider` 3.1.0,
con las mismas herramientas en proceso. `start_job` recibe `{ job: <unión por kind> }` y publica su schema
completo en los dos motores. Verificado con la Receta Tutorial en la app empaquetada (DeepSeek v4.1 Flash,
US$ 0,07 el video).

## Estructura
- `runtime/studio-ai-sdk-tools.ts` (tools con nombre `mcp__studio__<tool>`, errores como `error-json`, imágenes
  como partes `file` solo si el modelo las acepta) y `runtime/openrouter-producer-runtime.ts`
  (`runOpenRouterProducerTurn`, `runProducerTurnWithModel` para tests con `MockLanguageModelV4`).
- Un 429 llega envuelto en `RetryError`: se desenvuelve `lastError` antes de clasificar; la cuota diaria de
  modelos gratis es `OPENROUTER_FREE_QUOTA_EXHAUSTED` y no se reintenta (el `fetch` reescribe ese 429 a 400).
- `e2e/openrouter-model-bench.mjs`: benchmark reproducible con tope de gasto; lee la key del llavero en memoria.

## Dependencias
`ai` 7.0.113, `@openrouter/ai-sdk-provider` 3.1.0.

## Qué sigue
Correr el benchmark de modelos gratuitos después del reinicio de cuota (00:00 UTC) y sumar los que pasen.
