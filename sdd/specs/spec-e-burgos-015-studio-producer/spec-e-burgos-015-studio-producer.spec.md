# SPEC-e-burgos-015: Studio Producer: el productor conversacional dentro de la app

> Estado: **completed** — registrada y cerrada el 2026-09-10. Dos ciclos, flow `lite`.
> `cycle-01` (backend, `apps/render-api` + fix de `tools/render-cli`) · `cycle-02` (pantalla en `apps/web`,
> más el rol `logo` de `EP-006` que la pantalla necesitaba).

## Resumen Ejecutivo

El motor ya produce videos reales de punta a punta, pero **el productor es un humano con una skill
en la mano**: el dev abre Claude Code, invoca `sdd/skills/video-producer/SKILL.md`, y el agente hace
el inventario, propone, acuerda, escribe el guion, sintetiza la voz, nombra el material, corre el
montaje y verifica el MP4. Se hizo dos veces a mano y funcionó (`media/demo-espacio`, `media/demo-01`).

Esta spec mete **ese mismo agente adentro del producto**: un lugar en la app donde el usuario escribe
un prompt en lenguaje natural, la IA se pone de acuerdo con él y produce el video con su material,
usando la **suscripción de Claude** de la máquina (sin API key, igual que `spec-008`).

`cycle-01` pone el agente detrás de la API: conversación persistida por proyecto, turnos del
productor fuera de la cola de jobs, runner de Claude Code headless con la skill como system prompt,
y el fix de paridad de audio de `render-cli` que el productor necesita para que los dos caminos de
render entreguen lo mismo. `cycle-02` pone la pantalla.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

### Pedido literal del dev (2026-09-10)

> "Un lugar en la app donde escribo un prompt y la IA hace lo que hiciste vos a mano, con mi
> material; se pone de acuerdo conmigo; usa la suscripción de Claude."

Tres exigencias, no una: (a) **con mi material** — el agente trabaja sobre `media/<slug>/raw/`, no
sobre un banco genérico; (b) **se pone de acuerdo conmigo** — conversación con preguntas y
propuestas, no un botón de "generar"; (c) **la suscripción de Claude** — `claude -p` local, sin API
key ni costo por token facturado aparte.

### Evidencia — el productor ya funciona a mano

- `media/demo-espacio`: 34 s, 9:16, sin material propio (medios libres de NASA/Commons).
- `media/demo-01`: publicidad real de una óptica con el material del cliente. La conversación
  completa quedó en `media/demo-01/work/producer/conversation.md`: inventario → propuesta con guion
  de 8 frases → preguntas (guion, voz, música, marca) → producción → entrega → dos rondas de
  feedback. Ese archivo es **el formato de referencia** de la conversación legible que este ciclo
  automatiza.
- El feedback de esas dos corridas ya produjo `spec-e-burgos-014-production-quality` (música
  audible, captions fieles, logo) y los fixes de captions. La skill es un producto probado, no una
  hipótesis.

### Evidencia medida — el defecto de audio de la CLI (follow-up de spec-014)

Medición por correlación de envolvente RMS contra `media/demo-01/work/producer/voice.wav`:

| Camino | Desfase del audio del MP4 |
| --- | --- |
| A-roll (`raw/aroll/clip01.mp4`) | **0 ms** |
| `render-cli render` (`out/demo-01.mp4`, audio de Remotion) | **+40 ms constante**, sin deriva |
| `render-api` job `render` (`out/demo-01-api-mix.mp4`, mezcla FFmpeg) | **0 ms** |

`render-cli` **no hace mix ni mux**: entrega el audio que renderiza Remotion. `render-api` renderiza
mudo y arma el master con `mixTimelineAudio` → `muxAudioIntoVideo` → `verifyMixLoudness`. Los dos
caminos entregan audios distintos, y el que el productor usa desde la CLI es el que está corrido.
Cerrar la divergencia es requisito del productor: el agente elige herramienta según lo que tenga a
mano y las dos tienen que dar lo mismo.

## Alcance

### Dentro (cycle-01 — backend)

1. **Conversación por proyecto** persistida en `media/<slug>/work/producer/`: `conversation.json`
   (mensajes de máquina), `conversation.md` (legible, formato de `demo-01`), `session.json`
   (sesión de Claude Code para retomar el hilo) y `turns/<turnId>.jsonl` (eventos crudos del turno).
2. **Turnos del productor fuera de la cola de jobs**: `POST /projects/:slug/producer/messages`
   responde `202` con un `turnId` y el turno corre en su propio proceso hijo. Un turno activo por
   proyecto. `GET` de la conversación y del turno, `DELETE` para cancelar.
3. **Runner de Claude Code headless**: puerto `ProducerAgent`, adaptador real sobre `claude -p`
   con `--output-format stream-json`, `--session-id` / `--resume` para la continuidad del hilo,
   `--append-system-prompt` con la skill `video-producer` + el contexto del proyecto + las reglas
   de la app, y una lista blanca de herramientas.
4. **Fix de `render-cli render`**: misma mezcla masterizada que la API.

### Dentro (cycle-02 — web)

5. Pantalla de chat del productor en `apps/web` sobre el contrato de `cycle-01`: mensajes,
   progreso del turno en vivo, sugerencias como botones, cancelación y entrega del MP4.

### Fuera

- Multi-usuario, autenticación, colas remotas o cualquier despliegue fuera de `127.0.0.1`.
- Cambiar el motor: el productor **usa** las herramientas que existen; no agrega pipelines.
- Ejecutar el agente contra la API de Anthropic con key propia: es la suscripción o nada.

## Plan de ciclos

| Ciclo | Alcance | Subproyectos |
| --- | --- | --- |
| `cycle-01` | Conversación persistida, turnos fuera de la cola, runner de Claude Code, endpoints y `capabilities.producer`; fix de paridad de audio de `render-cli` | `apps/render-api`, `tools/render-cli` |
| `cycle-02` | Pantalla del productor en el Web Studio sobre el contrato del `cycle-01` | `apps/web` |

## Requisitos Funcionales (cycle-01)

- **RF-15-001 — Conversación persistida por proyecto.** Todo mensaje del usuario y toda respuesta
  del productor quedan en `work/producer/conversation.json` y se reflejan en `conversation.md` con
  el formato ya usado a mano. `GET /projects/:slug/producer` devuelve la conversación completa y el
  turno activo si lo hay.
- **RF-15-002 — Un turno activo por proyecto.** `POST …/producer/messages` con un turno en curso
  sobre el mismo proyecto responde `409 PRODUCER_TURN_ACTIVE` y no arranca un segundo proceso.
- **RF-15-003 — El turno no pasa por la cola de jobs.** El agente encola jobs `montage`/`render` en
  la misma API y espera su resultado: con la cola de concurrencia 1 el turno se bloquearía a sí
  mismo. El turno corre fuera de la cola y no altera `jobs: { running, queued }` de `/health`.
- **RF-15-004 — Continuidad del hilo.** El primer turno del proyecto fija un `sessionId`; los
  siguientes lo retoman, de modo que el agente recuerda lo acordado sin que la app le reenvíe la
  conversación.
- **RF-15-005 — Eventos legibles del turno.** `GET …/producer/turns/:turnId` devuelve el estado
  (`running|succeeded|failed|canceled`) y los eventos acumulados (`text`, `tool`, `status`), con un
  resumen legible de cada llamada a herramienta; al terminar, el mensaje del asistente y sus
  sugerencias.
- **RF-15-006 — Sugerencias de acción.** Cada respuesta del productor termina con 2–4 acciones
  cortas que la web muestra como botones.
- **RF-15-007 — Cancelación.** `DELETE …/producer/turns/:turnId` mata el proceso hijo y deja el
  turno en `canceled`.
- **RF-15-008 — Capacidad declarada.** `GET /health` reporta `capabilities.producer` según si el
  binario de Claude Code resuelve, **sin** volver `degraded` una máquina sin él.
- **RF-15-009 — Errores tipados.** `PRODUCER_UNAVAILABLE`, `PRODUCER_TURN_ACTIVE`,
  `PRODUCER_TURN_FAILED`, `PRODUCER_RATE_LIMITED` con su mapeo HTTP, sin filtrar rutas del host ni
  stderr crudo al payload.
- **RF-15-010 — Paridad de audio de la CLI.** `render-cli render` entrega la misma mezcla
  masterizada que el job `render` de la API. Criterio: el audio del MP4 de la CLI correlaciona a
  **0 ms** con la locución original.

## Criterios de Aceptación del cycle-01

Ver `cycles/cycle-01/plan.md`. El ciclo no cierra sin un **smoke real** contra `claude -p` sobre una
copia de `media/demo-01` y sin la medición de 0 ms del entregable de la CLI.
