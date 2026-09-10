# spec-e-burgos-015-studio-producer cycle-01 — 2026-09-10

## Estado
La skill `sdd/skills/video-producer/SKILL.md` corre **detrás de la API** como proceso Claude Code
headless sobre la suscripción de la máquina. Cuatro endpoints nuevos (`EP-022`..`EP-025`) y
`capabilities.producer` en `/health` (`EP-001` en `updated`). `apps/web` no se tocó; su pantalla es
el `cycle-02`.

**El turno del productor NO es un quinto `kind` de job (D-1).** El agente encola jobs
`montage`/`render` en esta misma API y espera su resultado: con la cola de concurrencia 1 un turno
adentro se bloquearía a sí mismo. Vive en un registro propio del runtime con dos diferencias contra
la cola: la exclusión es **por proyecto** y la cancelación **mata el proceso hijo**.

El registro es en memoria; la conversación no: `work/producer/` guarda `conversation.json`,
`conversation.md`, `session.json` y `turns/<turnId>.jsonl`. `session.json` es lo que hace que el
segundo turno recuerde el primero (`--session-id` y después `--resume`), y guarda el id que
**reporta el CLI** en su `init`, no el uuid que le pasamos.

## Estructura
- `src/producer/`: paths, documentos (parseo estricto a mano: la app no tiene Zod), markdown de la
  conversación, store, contexto del proyecto, prompt del sistema, parser de sugerencias, mapeo del
  `stream-json`, puerto `ProducerAgent`, adaptador Claude Code, registro de turnos y orquestación.
- Tres puertos nuevos: `producerAgent`, `readSkillDocument`, `probeProducerBinary`. El adaptador
  **no** usa el `CommandRunner` de `media-local` (bufferea): spawnea por un `SpawnProducerProcess`
  inyectable, lee stdout por líneas y sabe matar.
- `RenderApiRuntime` gana `producerTurns` y `producer: ProducerConfig`; `close()` del servidor
  cancela los turnos vivos.
- Ocho códigos nuevos y cuatro variables nuevas (`PRODUCER_MODEL`, `PRODUCER_TURN_TIMEOUT_MS`,
  `PRODUCER_SKILL_PATH`, `RENDER_API_URL`); el binario se reusa de `spec-008` (`CLAUDE_CLI_PATH`).

## Dependencias
Ninguna dependencia npm nueva. Lo nuevo es el mismo binario `claude` de `spec-008`, ahora con
herramientas, sesión y kill, más `node:child_process` en el adaptador de producción.

## Qué sigue
- `cycle-02`: la pantalla del chat en `apps/web` sobre `EP-022`..`EP-025`.
- Dos límites medidos de `--allowedTools` y la reescritura del hook `rtk`: ver `context_prompt.md`.
- El turno no se persiste y el historial en memoria no tiene cap.
