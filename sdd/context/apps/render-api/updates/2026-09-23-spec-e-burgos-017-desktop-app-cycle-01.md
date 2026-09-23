# spec-e-burgos-017-desktop-app cycle-01 — 2026-09-23

## Estado
El productor ya no tiene shell: `claude -p` se lanza con `--tools ""`, `--strict-mcp-config`, un
`--mcp-config` inline que arranca el servidor MCP `studio` de `libs/producer-tools` acotado al proyecto,
`--allowedTools mcp__studio` y `cwd` estable y vacío en `<CLAUDE_CLI_CWD o tmp>/video-maker-producer/<slug>`.
El system prompt lo arma `buildProducerPrompt` de la lib; `PRODUCER_SKILL_PATH` y el puerto
`readSkillDocument` desaparecieron. Endpoints nuevos EP-029..EP-035 y quinto tipo de job `photo-aroll`.

## Estructura
- `store/producer-writable-paths.ts`: única puerta de rutas del productor (relativas, sin `..`, realpath
  dentro del proyecto aunque el archivo no exista, lista de escritura `work/producer/**` + `work/credits.json`).
- Handlers `probe`, `frames`, `project-text` (GET/PUT), `asset-copy`, `music` (búsqueda y descarga contra
  Commons con host fijo y caché de resultados por proyecto en `runtime.musicSearchCache`).
- `jobs/run-photo-aroll-pipeline.ts` + params/progress/observer: Ken Burns por línea del
  `script-manifest.json`, concat y mux de la voz a `raw/aroll/<output>`.
- `producer/producer-mcp-config.ts`; `producer-stream-events.ts` resume cada `mcp__studio__*` en una línea.
- Puertos nuevos: `extractFrame`, `fetchRemote`, `ObjectStorage.copyFile`/`realPath`. Ocho códigos de error nuevos
  del contrato MCP más `PHOTO_AROLL_INPUT_INVALID`.

## Dependencias
Depende de `@video-maker/producer-tools` (contrato, prompt, comando de lanzamiento del MCP).
`@modelcontextprotocol/sdk` entra a la raíz, pero render-api no lo importa.

## Qué sigue
`cycle-02` (SQLite) persiste los jobs y la caché de música, hoy en memoria. El servidor MCP se lanza con
`node -r mcp-register.cjs main.ts`, así que todavía necesita el toolchain del repo: `cycle-03` lo empaqueta.
