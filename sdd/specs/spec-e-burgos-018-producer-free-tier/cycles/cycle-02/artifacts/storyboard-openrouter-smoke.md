# Storyboard on OpenRouter — real smoke (ordinary brief, no visualSource steering)

Date: 2026-09-25T17:15:36.297Z
Model: deepseek/deepseek-v4.1-flash
Brief: "Un anuncio corto de 3 escenas para una app de analítica de campañas de display ads: el gancho, una demo del dashboard con las métricas clave, y un llamado a la acción para probar la app gratis."
Budget cap: US$0.10 · observed cost: US$0.002879
Key leak check: PASSED (the OpenRouter key never appears in this report or in job output)

## Success path — 3/3 runs succeeded, 0 of those needed the repair retry

### Run 1: succeeded

- Needed the repair retry: no
- Scene count: 3
- visualSource mix: remotion-scene=3
- usage.model: deepseek/deepseek-v4.1-flash
- usage.tokensIn / tokensOut: 477 / 1712
- usage.costUsd: 0.0007336728

### Run 2: succeeded

- Needed the repair retry: no
- Scene count: 3
- visualSource mix: remotion-scene=3
- usage.model: deepseek/deepseek-v4.1-flash
- usage.tokensIn / tokensOut: 477 / 2373
- usage.costUsd: 0.0010112928

### Run 3: succeeded

- Needed the repair retry: no
- Scene count: 3
- visualSource mix: remotion-scene=3
- usage.model: deepseek/deepseek-v4.1-flash
- usage.tokensIn / tokensOut: 477 / 2665
- usage.costUsd: 0.0011339328

## Failure path (well-formed but wrong key, stored unverified)

- Job state: failed
- Error code: OPENROUTER_KEY_MISSING
- No completion was billed: OpenRouter rejects an invalid key with 401 before running the model.
