# spec-e-burgos-020-motion-mode cycle-03 — 2026-10-07

## Qué pasó
La primera corrida real de `auto` costó $1,24 y 243k tokens de entrada para un storyboard de 5 KB. Una
sonda mínima mostró la causa: `claude -p` carga la configuración del usuario (plugins, hooks de
SessionStart, MCP servers) aunque `--system-prompt` reemplace el prompt y el cwd sea un tmpdir: 178k
tokens de caché por llamada ($0,67 un "ok"). Con `--setting-sources '' --strict-mcp-config
--no-session-persistence` la misma llamada cuesta $0,006. Además, la grilla de golpes dio 99 BPM con
confianza 0,03 para un tema de 122: hyperframes devuelve un tren regular de corcheas y la coherencia de
fase se anula (los contratiempos caen a 180°); se agregó la vía por intervalo mediano.

## Lección
Aislar todo `claude -p` de la configuración de la máquina (`--setting-sources ''`, `--strict-mcp-config`)
y medir el costo con una sonda de una línea antes de la primera corrida real; y no confiar en un ajuste
de grilla con confianza < 0,2: mirar el histograma de intervalos de los onsets.

## Costo evitable
~$1,50 de corridas `auto` caras y un plan con cortes fuera de tiempo que se habría renderizado.
