# spec-e-burgos-017-desktop-app cycle-04 — 2026-09-24

## Estado
Sin cambios en el proceso principal: la app empaquetada corre el motor OpenRouter tal cual (la key la lee
`render-api` del llavero del usuario).

## Estructura
`e2e/packaged-app-smoke.mjs` gana `--engine=openrouter` y `waitForTurnRunning` antes de esperar que el turno
termine (sin esa guarda leía el estado final del turno anterior).

## Dependencias
Sin cambios.

## Qué sigue
`cycle-06`: documentar la carga de la key en la web de instalación.
