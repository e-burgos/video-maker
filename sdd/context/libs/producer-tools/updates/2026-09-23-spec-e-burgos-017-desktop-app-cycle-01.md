# spec-e-burgos-017-desktop-app cycle-01 — 2026-09-23

## Estado
Lib creada y completa para el motor Claude Code: contrato de 14 herramientas congelado, handlers sobre
`RenderApiClient`, servidor MCP stdio acotado a un proyecto y prompt del productor contra herramientas.
Verificada con `claude -p` real: tres recetas con MP4 y dos intentos de inyección sin efecto.

## Estructura
`contract/` (puro), `client/`, `handlers/`, `mcp/` (servidor, `main.ts`, `studio-mcp-cli-args.ts`,
`studio-mcp-launch.ts`, `mcp-register.cjs`), `prompt/`. Target Nx `mcp`.
- `extract_frames` sin `outputSchema`: Claude Code 2.1.123 le pasa al modelo `structuredContent` en vez de
  los bloques de imagen. Toda tool nueva que devuelva imágenes sigue ese patrón.
- `start_job` (unión discriminada) se publica vacía por el SDK: su `description` lleva un ejemplo por `kind`.
- Los literales de parámetros del prompt tienen que salir del contrato: el smoke encontró `voiceId`
  donde el campo es `voice`.

## Dependencias
`@modelcontextprotocol/sdk` ^1.30.1 (importar solo subpaths: la raíz del paquete no resuelve en esta
versión), `zod`, `@video-maker/timeline-core`.

## Qué sigue
`cycle-04`: el motor OpenRouter consume `createStudioToolHandlers` en proceso (sin MCP) con el mismo
contrato. Candidatos: `preview_image` para fotos y `search_free_media` para B-roll libre.
