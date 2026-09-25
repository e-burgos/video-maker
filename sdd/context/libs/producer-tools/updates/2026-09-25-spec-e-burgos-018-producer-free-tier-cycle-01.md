# spec-e-burgos-018-producer-free-tier cycle-01 — 2026-09-25

## Estado
El benchmark de modelos (`e2e/openrouter-model-bench.mjs`) volvió a correr contra el runtime actual: pasaba el
input viejo de `buildProducerPrompt` (sin `pendingAssets`) y fallaba antes de la primera llamada. La corrida de
los gratuitos no se pudo hacer: la cuota diaria de la cuenta (1000 pedidos, `free-models-per-day-high-balance`)
ya estaba en 0 el 2026-09-25; queda para `cycle-04`, después del reset de las 00:00 UTC.

## Estructura
- Flags nuevos del bench: `--discover-free` (candidatos `:free` vivos del catálogo con `tools` + `image`),
  `--out=<dir>`, `--report-name=<base>`, `--title=<texto>`, `--base-port=<n>` (default 4520).
- Corta todos los gratuitos restantes al primer `OPENROUTER_FREE_QUOTA_EXHAUSTED`.
- El server de cada corrida se lanza con `process.execPath` y se espera su `exit` real (SIGTERM → SIGKILL):
  quedaron render-api huérfanos del bench de cycle-04 escuchando en 4490–4493.

## Dependencias
Sin cambios.

## Qué sigue
`cycle-04`: correr el bench con `--discover-free` y sumar los que pasen 2/2 a la lista recomendada.
