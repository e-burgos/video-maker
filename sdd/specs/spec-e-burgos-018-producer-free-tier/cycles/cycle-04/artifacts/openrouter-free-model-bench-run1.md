# Benchmark de modelos gratuitos de OpenRouter — spec-018 cycle-01

> Generado el 2026-09-26 corriendo el runtime real del productor (`runOpenRouterProducerTurn`) contra un clon APFS del proyecto `display-ads-analiticas`, con un render-api real levantado por corrida. Tope de gasto total: US$3.00.

## Candidatos y por qué

| Modelo | Tier | Motivo |
| --- | --- | --- |
| `qwen/qwen3.8-27b:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 262144). |
| `dots-studio/dots-3-note-preview:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 512000). |
| `thinkingmachines/inkling-small:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 1048576). |
| `thinkingmachines/inkling:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 1048576). |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 256000). |
| `google/gemma-4-26b-a4b-it:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 262144). |
| `google/gemma-4-31b-it:free` | free | Gratis y vivo en el catálogo con tools e imagen (contexto 262144). |

Filtro aplicado sobre `GET https://openrouter.ai/api/v1/models` (sin key): `tools` en `supported_parameters` y `image` en `architecture.input_modalities` — el escenario necesita `extract_frames` como imagen. Se excluyeron variantes `:batch`, `openrouter/auto*` y `stealth/*` por no ser modelos reales o predecibles para un loop interactivo.

## Escenario

`get_project_overview` → `probe_media` del A-roll → `extract_frames` con 3 marcas de tiempo → `write_project_text` de `work/producer/script.txt` (4 a 6 líneas, cada una con `[m:ss]` válido y creciente, dentro de la duración del A-roll) → `start_job {job:{kind:"voice"}}` con la voz Daniela, verificado hasta que el job termina → sin `montage` ni `render`. Cada criterio se puntúa desde el estado real del servidor (archivos y jobs), nunca desde lo que dice el modelo. 2 corridas por modelo (hasta 3 si el resultado es dispar y el presupuesto lo permite).

## Resultados por modelo

| Modelo | Tier | Éxito | Pasos prom. | Seg. prom. | Costo prom. | Costo total | Rate-limit | Imágenes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `qwen/qwen3.8-27b:free` | free | 0/2 (0%) | n/d | 7.0 | US$0.0000 | US$0.0000 | 2 | sí |
| `dots-studio/dots-3-note-preview:free` | free | 0/2 (0%) | 8.0 | 79.5 | US$0.0000 | US$0.0000 | 0 | sí |
| `thinkingmachines/inkling-small:free` | free | 0/1 (0%) | n/d | 0.1 | US$0.0000 | US$0.0000 | 1 | sí |
| `thinkingmachines/inkling:free` | free | 0/0 (0%) | n/d | n/d | US$0.0000 | US$0.0000 | 0 | sí |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | free | 0/0 (0%) | n/d | n/d | US$0.0000 | US$0.0000 | 0 | sí |
| `google/gemma-4-26b-a4b-it:free` | free | 0/0 (0%) | n/d | n/d | US$0.0000 | US$0.0000 | 0 | sí |
| `google/gemma-4-31b-it:free` | free | 0/0 (0%) | n/d | n/d | US$0.0000 | US$0.0000 | 0 | sí |

### Criterios pasados por modelo (de las corridas realizadas)

| Modelo | overview | probe A-roll | ≥3 frames | guion válido | voz OK | sin montaje/render | respuesta ES |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `qwen/qwen3.8-27b:free` | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 2/2 | 0/2 |
| `dots-studio/dots-3-note-preview:free` | 2/2 | 2/2 | 2/2 | 0/2 | 2/2 | 2/2 | 2/2 |
| `thinkingmachines/inkling-small:free` | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 1/1 | 0/1 |
| `thinkingmachines/inkling:free` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `google/gemma-4-26b-a4b-it:free` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| `google/gemma-4-31b-it:free` | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |

## Gasto total: US$0.0000 de un tope de US$3.00

## Notas de la corrida

- `thinkingmachines/inkling:free` se saltó: la cuota diaria de modelos gratis de la cuenta ya estaba agotada.
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` se saltó: la cuota diaria de modelos gratis de la cuenta ya estaba agotada.
- `google/gemma-4-26b-a4b-it:free` se saltó: la cuota diaria de modelos gratis de la cuenta ya estaba agotada.
- `google/gemma-4-31b-it:free` se saltó: la cuota diaria de modelos gratis de la cuenta ya estaba agotada.
- `thinkingmachines/inkling-small:free` no se pudo evaluar hoy: OpenRouter devolvió `Rate limit exceeded: free-models-per-day-high-balance` en las 1 corrida(s) — es un tope diario de la cuenta para modelos gratis, no algo que un backoff corto pueda resolver. Reintentar este candidato después del reset diario (00:00 UTC) con `node libs/producer-tools/e2e/openrouter-model-bench.mjs --candidates=thinkingmachines/inkling-small:free --runs=2`.

## Recomendación

Set recomendado (2 a 4 modelos, por tier):


**Modelo por defecto propuesto:** `qwen/qwen3.8-27b:free` (free) — 0/2 corridas exitosas a US$0.0000 promedio por corrida. Se prioriza el más barato que pasó 2/2, ya que el productor encadena decenas de llamadas y un modelo confiable y gratuito o muy barato es lo que hace viable que un amigo sin Claude lo use sin pensar en el costo.

