# spec-e-burgos-020-motion-mode cycle-03 — 2026-10-07

## Estado
Comando `auto <brief.json> <proyecto>`: genera el storyboard con la IA, lo escribe y compone como
`storyboard` (imágenes desde `images/` al lado del brief). Reporte: escenas, reparación, tokens y costo.
Medido: ~$0,40–0,60 y 3–6 min por storyboard de 60 s con `sonnet`. 23 tests.

## Estructura
`src/deps/claude-cli-ask-agent.ts` (adaptador Claude CLI: cwd en `mkdtemp`, schema sin `$schema`/`$id`,
exige `structured_output`); `composeFromStoryboard` compartido por `storyboard` y `auto`.

## Dependencias
`CLAUDE_CLI_PATH` (default `claude`), `MOTION_STUDIO_MODEL` (default `sonnet`). El CLI corre con
`--setting-sources '' --strict-mcp-config --no-session-persistence`: sin eso carga plugins/hooks/MCP del
usuario (~180k tokens por llamada).

## Qué sigue
La salida es mayormente razonamiento (16–29k tokens): un `--effort` configurable puede bajar costo y
tiempo sin cambiar la calidad del storyboard; medirlo antes de cambiar el default.
