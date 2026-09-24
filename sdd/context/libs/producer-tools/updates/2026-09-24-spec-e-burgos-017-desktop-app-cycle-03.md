# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
El servidor MCP se compila a JavaScript (`producer-tools:bundle`) y corre con el Node de Electron.

## Estructura
`buildStudioMcpLaunchCommand` acepta `compiledEntryPath` (agrega `ELECTRON_RUN_AS_NODE=1`) y `accessToken`
(`STUDIO_API_TOKEN`); el cliente HTTP manda `x-studio-token` en cada pedido.

## Dependencias
Sin cambios.

## Qué sigue
`cycle-04`: runtime OpenRouter sobre los mismos handlers.
