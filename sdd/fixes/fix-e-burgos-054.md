# FIX-e-burgos-054 — `pnpm ci:local`: verificar en la Mac y saltear el CI de GitHub

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-054 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | N/A (repo-level) |

## Problema
- En octubre la cuenta superó los 3000 min de Actions del plan Pro (9735 entre todos los repos). video-maker consumió 991.
- El CI corre `nx run-many -t lint test build` completo, unos 7 min, en cada PR (64 corridas, ~447 min) y otra vez en el push a main del merge (52 corridas, ~377 min).

## Solución
- `pnpm ci:local` (`scripts/ci/ci-local.sh`) exige el árbol limpio, Node 22 y el pnpm de `packageManager`. Corre `sdd:validate` y `nx affected -t lint test build` contra el merge-base con main, pushea la rama y publica el commit status `ci-local` sobre HEAD.
- `scripts/ci/ci-local-verified.sh` (el mismo de display-ads) responde si un SHA está verificado: por su propio status (PR, con 45 s de espera porque el status llega después del push) o porque es un merge cuyo PR tiene el status sobre un head con el mismo árbol.
- `ci.yml`: con el status saltea install, `sdd:validate`, lint/test/build y la subida de coverage. Ignora `docs/**`, `sdd/**` y `**/*.md`. Un `workflow_dispatch` con `force` corre todo.
- `sdd-validate.yml`: en el PR, sólo `sdd/**` y su workflow.
- `deploy-docs-site.yml`: `concurrency` con `cancel-in-progress`; el push nuevo publica desde HEAD.

## Verificación
- YAML de los tres workflows parseado.
- `pnpm ci:local` sobre la rama del PR publicó `ci-local`, y el CI del PR salteó la verificación.
