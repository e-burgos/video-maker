# Storyboard on OpenRouter — real smoke

Date: 2026-09-25T16:43:24.463Z
Model: deepseek/deepseek-v4.1-flash
Budget cap: US$0.10 · observed cost: US$0.000366
Key leak check: PASSED (the OpenRouter key never appears in this report or in job output)

## Success path (real key, engine=openrouter)

- Attempts until success: 1 (a schema-noncompliant generation is a real, transient AI_AGENT_INVALID_OUTPUT — the storyboard panel already tells the user to propose again)
- Job state: succeeded
- Storyboard path: work/storyboard.json
- Scene count: 3
- usage.model: deepseek/deepseek-v4.1-flash
- usage.tokensIn / tokensOut: 1571 / 826
- usage.costUsd: 0.000365625

## Failure path (well-formed but wrong key, stored unverified)

- Job state: failed
- Error code: OPENROUTER_KEY_MISSING
- No completion was billed: OpenRouter rejects an invalid key with 401 before running the model.
