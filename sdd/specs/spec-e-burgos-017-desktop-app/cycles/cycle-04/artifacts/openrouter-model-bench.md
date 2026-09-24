# Benchmark de modelos OpenRouter — cycle-04 TASK-006

> Generado el 2026-09-24 corriendo el runtime real del productor (`runOpenRouterProducerTurn`) contra un clon APFS del proyecto `display-ads-analiticas`, con un render-api real levantado por corrida. Tope de gasto total: US$3.00.

## Candidatos y por qué

| Modelo | Tier | Motivo |
| --- | --- | --- |
| `google/gemma-4-31b-it:free` | free | Familia Gemma (Google), gratis, tools+image confirmados en vivo. |
| `qwen/qwen3.8-27b:free` | free | Familia Qwen, gratis, tools+image confirmados en vivo. |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | free | Familia Nemotron (NVIDIA), multimodal nativo, gratis. |
| `google/gemma-4-26b-a4b-it:free` | free | Variante MoE de Gemma 4, gratis, más liviana que la 31B. |
| `google/gemini-2.5-flash-lite` | cheap | Gemini Flash-Lite, ~US$0.10/1M tokens de entrada, tools+image. |
| `openai/gpt-5-nano` | cheap | GPT-5 nano, ~US$0.05/1M tokens de entrada, el más barato de pago del catálogo con tools+image. |
| `deepseek/deepseek-v4.1-flash` | cheap | DeepSeek Flash, ~US$0.15/1M tokens de entrada, contexto de 1M. |
| `anthropic/claude-haiku-4.5` | reference | Referencia paga de calidad conocida (Claude), para comparar contra los baratos. |

Filtro aplicado sobre `GET https://openrouter.ai/api/v1/models` (sin key): `tools` en `supported_parameters` y `image` en `architecture.input_modalities` — el escenario necesita `extract_frames` como imagen. Se excluyeron variantes `:batch`, `openrouter/auto*` y `stealth/*` por no ser modelos reales o predecibles para un loop interactivo.

## Escenario

`get_project_overview` → `probe_media` del A-roll → `extract_frames` con 3 marcas de tiempo → `write_project_text` de `work/producer/script.txt` (4 a 6 líneas, cada una con `[m:ss]` válido y creciente, dentro de la duración del A-roll) → `start_job {job:{kind:"voice"}}` con la voz Daniela, verificado hasta que el job termina → sin `montage` ni `render`. Cada criterio se puntúa desde el estado real del servidor (archivos y jobs), nunca desde lo que dice el modelo. 2 corridas por modelo (hasta 3 si el resultado es dispar y el presupuesto lo permite).

## Resultados por modelo

| Modelo | Tier | Éxito | Pasos prom. | Seg. prom. | Costo prom. | Costo total | Rate-limit | Imágenes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `google/gemma-4-31b-it:free` | free | 0/2 (0%) | n/d | 6.6 | US$0.0000 | US$0.0000 | 2 | sí |
| `qwen/qwen3.8-27b:free` | free | 0/2 (0%) | n/d | 7.0 | US$0.0000 | US$0.0000 | 2 | sí |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | free | 0/2 (0%) | n/d | 6.2 | US$0.0000 | US$0.0000 | 2 | sí |
| `google/gemma-4-26b-a4b-it:free` | free | 0/2 (0%) | n/d | 6.7 | US$0.0000 | US$0.0000 | 2 | sí |
| `google/gemini-2.5-flash-lite` | cheap | 0/2 (0%) | 5.5 | 90.3 | US$0.0016 | US$0.0032 | 0 | sí |
| `openai/gpt-5-nano` | cheap | 1/3 (33%) | 7.7 | 115.1 | US$0.0043 | US$0.0129 | 0 | sí |
| `deepseek/deepseek-v4.1-flash` | cheap | 2/2 (100%) | 9.5 | 118.2 | US$0.0045 | US$0.0091 | 0 | sí |
| `anthropic/claude-haiku-4.5` | reference | 2/2 (100%) | 7.0 | 70.8 | US$0.0972 | US$0.1944 | 0 | sí |

### Criterios pasados por modelo (de las corridas realizadas)

| Modelo | overview | probe A-roll | ≥3 frames | guion válido | voz OK | sin montaje/render | respuesta ES |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `google/gemma-4-31b-it:free` | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 2/2 | 0/2 |
| `qwen/qwen3.8-27b:free` | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 2/2 | 0/2 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 2/2 | 0/2 |
| `google/gemma-4-26b-a4b-it:free` | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 2/2 | 0/2 |
| `google/gemini-2.5-flash-lite` | 1/2 | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | 2/2 |
| `openai/gpt-5-nano` | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 | 3/3 | 3/3 |
| `deepseek/deepseek-v4.1-flash` | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| `anthropic/claude-haiku-4.5` | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |

## Gasto total: US$0.2195 de un tope de US$3.00

## Notas de la corrida

- `google/gemma-4-31b-it:free` no se pudo evaluar hoy: OpenRouter devolvió `Rate limit exceeded: free-models-per-day-high-balance` en las 2 corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con `node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=google/gemma-4-31b-it:free --runs=2`.
- `qwen/qwen3.8-27b:free` no se pudo evaluar hoy: OpenRouter devolvió `Rate limit exceeded: free-models-per-day-high-balance` en las 2 corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con `node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=qwen/qwen3.8-27b:free --runs=2`.
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` no se pudo evaluar hoy: OpenRouter devolvió `Rate limit exceeded: free-models-per-day-high-balance` en las 2 corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con `node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free --runs=2`.
- `google/gemma-4-26b-a4b-it:free` no se pudo evaluar hoy: OpenRouter devolvió `Rate limit exceeded: free-models-per-day-high-balance` en las 2 corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con `node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=google/gemma-4-26b-a4b-it:free --runs=2`.

## Recomendación

Set recomendado (2 a 4 modelos, por tier):

- **cheap** — `deepseek/deepseek-v4.1-flash`: 2/2 corridas exitosas, costo promedio US$0.0045, 9.5 pasos promedio.
- **reference** — `anthropic/claude-haiku-4.5`: 2/2 corridas exitosas, costo promedio US$0.0972, 7.0 pasos promedio.

**Modelo por defecto propuesto:** `deepseek/deepseek-v4.1-flash` (cheap) — 2/2 corridas exitosas a US$0.0045 promedio por corrida. Se prioriza el más barato que pasó 2/2, ya que el productor encadena decenas de llamadas y un modelo confiable y gratuito o muy barato es lo que hace viable que un amigo sin Claude lo use sin pensar en el costo.

