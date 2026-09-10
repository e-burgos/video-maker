# spec-e-burgos-015-studio-producer — cycle-01 · plan (lite)

> Módulo: studio-producer | Subproyectos: apps/render-api, tools/render-cli | Fecha: 2026-09-10
> Objetivo: poner la skill `video-producer` a correr detrás de `apps/render-api` como un agente
> Claude Code headless con conversación persistida por proyecto, turnos fuera de la cola de jobs y
> eventos legibles, y cerrar la divergencia de audio del entregable de `render-cli`.
> Fuera de alcance: la pantalla en `apps/web` (cycle-02), multi-usuario, cambiar el motor,
> API key de Anthropic, subir assets por el chat.

**Flow `lite` por decisión del dev (prefijo `[LITE]`), con `profile: solo` de acuerdo.** El ciclo
crea cuatro endpoints que `apps/web` va a consumir en `cycle-02`, así que `pnpm sdd:validate` deja
el warning conocido ("flow: lite created 0 tables / 4 endpoints"): el prefijo del pedido gana sobre
la excepción del perfil, y queda escrito acá para que el próximo ciclo de esta spec lo evalúe.
Un solo actor con tres sombreros: escribe este plan, crea `tasks.json`, implementa task por task y
cierra como reviewer. Sin fan-out de subagentes.

## Historias

- US-15-001 — Como usuario del studio quiero que mi conversación con el productor quede guardada por
  proyecto para poder retomarla. CA: `GET /projects/:slug/producer` devuelve los mensajes
  persistidos en `work/producer/conversation.json`, y `conversation.md` los muestra con el mismo
  formato de viñetas que la conversación hecha a mano en `media/demo-01`.
- US-15-002 — Como usuario quiero que el productor no arranque dos veces sobre el mismo proyecto para
  no pisar mi material. CA: `POST …/producer/messages` con un turno en curso responde
  `409 PRODUCER_TURN_ACTIVE` y no arranca un segundo proceso hijo.
- US-15-003 — Como productor quiero encolar jobs `montage`/`render` en la API y esperar su resultado
  dentro del mismo turno. CA: el turno corre fuera de la cola (no aparece en `GET
  /projects/:slug/jobs` ni mueve `jobs.running` de `/health`) y un job encolado por el agente
  progresa mientras el turno sigue vivo.
- US-15-004 — Como usuario quiero que el agente sepa quién es, con qué material trabaja y qué
  herramientas usar. CA: el `--append-system-prompt` del proceso hijo contiene la skill
  `video-producer` completa, el contexto del proyecto (slug, rutas absolutas, `RENDER_API_URL`,
  assets del catálogo, logo) y las reglas de la app; el primer turno fija `sessionId` en
  `session.json` y el siguiente lo retoma con `--resume`.
- US-15-005 — Como usuario quiero ver qué está haciendo el productor mientras trabaja. CA:
  `GET …/producer/turns/:turnId` devuelve `status` y los eventos acumulados (`text` | `tool` |
  `status`), con un resumen legible por herramienta (`ffprobe raw/broll/lentes.mp4`,
  `queued montage job`).
- US-15-006 — Como usuario quiero que el productor me proponga los próximos pasos. CA: la respuesta
  final trae `suggestions` con 2–4 acciones cortas, extraídas del bloque ```suggestions y quitadas
  del texto del mensaje.
- US-15-007 — Como usuario quiero cortar un turno que se fue de largo. CA:
  `DELETE …/producer/turns/:turnId` mata el proceso hijo, deja el turno en `canceled` y libera el
  proyecto para un turno nuevo.
- US-15-008 — Como consumidor de la API quiero saber si el productor está disponible antes de
  ofrecerlo. CA: `GET /health` reporta `capabilities.producer` según si el binario de Claude Code
  resuelve, y una máquina sin él sigue reportando `status: ok`.
- US-15-009 — Como consumidor de la API quiero fallas del productor legibles por máquina. CA:
  `PRODUCER_UNAVAILABLE` (503), `PRODUCER_TURN_ACTIVE` (409), `PRODUCER_TURN_FAILED` (502),
  `PRODUCER_RATE_LIMITED` (429), `PRODUCER_TURN_NOT_FOUND` (404), `PRODUCER_MESSAGE_INVALID` (422)
  y `PRODUCER_TURN_NOT_CANCELABLE` (409), sin rutas del host ni stderr crudo en el payload.
- US-15-010 — Como productor quiero que la CLI entregue el mismo audio que la API para poder elegir
  cualquiera de las dos. CA: sobre `media/demo-01`, el audio del MP4 de `render-cli render`
  correlaciona a **0 ms** con `work/producer/voice.wav` (envolvente RMS por 10 ms, mejor lag),
  contra los +40 ms medidos antes del ciclo.

## Tasks (detalle en tasks.json)

- TASK-001 — `src/producer/`: rutas de `work/producer/`, tipos y parseo estricto de
  `conversation.json` / `session.json` / `turns/<turnId>.jsonl`, el escritor incremental de
  `conversation.md` (respeta el encabezado y el estilo de viñetas ya existente) y el store sobre el
  puerto `storage`. Lo valida `producer-store.spec.ts` con el doble de storage.
- TASK-002 — `producer-config.ts` (`PRODUCER_MODEL`, `PRODUCER_TURN_TIMEOUT_MS`,
  `PRODUCER_SKILL_PATH`, `PRODUCER_API_URL`), `build-producer-system-prompt.ts` (skill + contexto
  del proyecto + reglas de la app), `parse-producer-suggestions.ts` y `producer-stream-events.ts`
  (líneas `stream-json` → eventos `text`/`tool`/`status` con resumen legible). Todo puro.
- TASK-003 — Puerto `ProducerAgentPort` en `RenderApiDependencies` y adaptador
  `claude-code-producer-agent.ts`: construcción de argumentos, spawn por un primitivo inyectable,
  lectura de stdout por líneas, `cancel()`, timeout y clasificación de fallas en los códigos
  tipados. `claude-code-producer-agent.spec.ts` corre 100 % contra un spawner falso.
- TASK-004 — `producer-turn-registry.ts` (un turno activo por slug, historial en memoria) y
  `run-producer-turn.ts` (arma el prompt, consume el stream, persiste conversación, sesión y
  `turns/<turnId>.jsonl`, y estampa el error tipado). Entra a `RenderApiRuntime` al lado de `jobs`.
- TASK-005 — Cuatro rutas nuevas, `producer-handler.ts`, `capabilities.producer` en `/health`,
  cableado real en `node-render-api-dependencies.ts`, README y `sdd/api.json` (EP-022..EP-025 y
  EP-001 en `updated`).
- TASK-006 — `render-cli render` pasa a render mudo → `mixTimelineAudio` → `muxAudioIntoVideo` →
  `verifyMixLoudness` (los mismos cuatro pasos del job `render` de la API), con el reporte
  ampliado. Acepta el guion de medición y la evidencia de 0 ms en `artifacts/`.
- TASK-007 — Smoke real contra `claude -p` sobre una copia temporal de `media/demo-01`: dos turnos
  encadenados, `DELETE` de un turno en curso y evidencia literal en `artifacts/`.

## Decisiones técnicas (obligatoria: toca api.json)

- **D-1 — El turno del productor NO es un quinto `kind` de job** (`api.json`: EP-022..EP-025
  nuevos, la cola no cambia). El agente encola jobs `montage`/`render` en esta misma API y espera
  su resultado; con concurrencia 1, un turno dentro de la cola se bloquearía a sí mismo. El turno
  vive en un registro propio del runtime, con su propia regla de exclusión (uno por proyecto) y su
  propia cancelación (**kill del proceso hijo**, no cooperativa como la de los jobs).
- **D-2 — El puerto del productor es distinto del `aiAgent` de spec-008** (`deps/`): `aiAgent`
  es una llamada de request/response con salida estructurada por `--json-schema` sobre el
  `CommandRunner` (que bufferea); el productor necesita stream, herramientas, sesión y kill. Se
  reusa la resolución de binario y de env (`CLAUDE_CLI_PATH`, `readAiAgentConfig`) y no se duplica
  el adaptador de storyboard.
- **D-3 — `--output-format stream-json --verbose`, sin `--include-partial-messages`**
  (`api.json`: forma de `events[]`). Los mensajes del asistente y los `tool_use` llegan completos
  por mensaje, que es la granularidad que la web va a pollear; los chunks parciales multiplicarían
  el volumen del `.jsonl` sin cambiar lo que se muestra.
- **D-4 — `capabilities.producer` y NO un binario de `/health`** (`api.json`: EP-001 `updated`),
  igual que la decisión D-12 de spec-008: `claude` en `binaries` volvería `degraded` toda máquina
  sin Claude Code, CI incluido.
- **D-5 — La restricción de escritura del agente es por `--add-dir` + instrucción, no por patrón
  de ruta en `--allowedTools`**, salvo que la sonda real demuestre lo contrario (se sondea en
  TASK-003 y el resultado se escribe acá). `cwd` = raíz del repo porque `pnpm nx` lo necesita.
- **D-6 — Los `summary` de los eventos van en inglés y son derivados del comando**
  (`api.json`: `events[].summary`): la regla del repo es payloads en inglés y el agente habla en el
  idioma del usuario en `text`, no en los metadatos.
- **D-7 — `render-cli` orquesta el master en la CLI, sin lib nueva.** `tools/render-cli` tiene tags
  `scope:engine`/`type:tool`, que caen en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags:
  ['*'] }` de `eslint.config.mjs`: puede depender de `media-local` y de `composition-remotion` a la
  vez, igual que `apps/render-api`. Mover la orquestación a una lib obligaría a una lib que
  dependa de una `type:ui` y de una `type:util`, que es exactamente lo que los `depConstraints`
  prohíben.
