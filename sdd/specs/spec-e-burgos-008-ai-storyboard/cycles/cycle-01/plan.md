# spec-e-burgos-008-ai-storyboard — cycle-01 · plan (lite)

> Módulo: ai-storyboard | Subproyectos: apps/render-api, libs/timeline-core | Fecha: 2026-09-09
> Objetivo: que el servicio produzca, persista y publique un `StoryboardDocument` a partir de un
> brief o de un guion, invocando `claude -p` como binario local por un puerto inyectable, y que
> entregue la lista numerada de prompts visuales para las herramientas generativas externas.
> Fuera de alcance: la UI (`cycle-02`), la voz (`spec-009`), el ensamblado y las escenas nativas de
> Remotion (`spec-010`), el banco de audio (`spec-011`) y el catálogo de estilos (`spec-012`) —
> `captionsStyle`, `musicTags` y `sfxTags` se persisten como strings libres hasta entonces.

## Historias

- US-08-001 — Como creador quiero describir mi idea en un brief y recibir un storyboard completo
  (título, personajes, escenas con narración y prompt visual) para no empezar de cero.
  CA: un job `storyboard` con un brief real llega a `succeeded` y `work/storyboard.json` valida.
- US-08-002 — Como creador quiero pegar un guion ya escrito y que la IA lo estructure en escenas
  para reutilizar lo que ya redacté. CA: la rama `scriptText` produce escenas que respetan el texto.
- US-08-003 — Como creador quiero copiar una lista numerada de prompts visuales para generarlos en
  Meta AI o Google Flow y traer los archivos numerados. CA: el export es texto plano numerado
  desde `01`, con la hoja de personajes.
- US-08-004 — Como creador quiero editar y volver a guardar el storyboard sabiendo que una
  regeneración no lo pisa sin que yo lo pida. CA: `409 STORYBOARD_ALREADY_EXISTS` sin `overwrite`,
  sin job registrado; `PUT` valida y persiste.
- US-08-005 — Como dev quiero que un fallo del agente me diga qué hacer (instalarlo, esperar la
  cuota, reintentar) en vez de un 500 opaco. CA: los cuatro códigos se disparan desde una condición
  real y distinta, con su status HTTP y sin filtrar `stderr` ni rutas del host.

## Tasks (detalle en tasks.json)

- TASK-001 — `StoryboardDocument` en `libs/timeline-core`: schema Zod (documento, hoja de
  personajes, escenas, `remotionScene` plano con validación cruzada por `kind`), el schema de
  **propuesta** que el modelo devuelve, la función que lo convierte en documento asignando ids e
  índices, y el JSON Schema **derivado** con `z.toJSONSchema`. Lo validan tests de ida y vuelta
  (documento mínimo, documento completo, rechazos por `kind` incoherente) y un test que valida el
  ejemplo contra el JSON Schema derivado.
- TASK-002 — Puerto `AiAgent` en `RenderApiDependencies`, adaptador `ClaudeCliAiAgent`
  (`src/ai/`) sobre el `CommandRunner`, lector de configuración `readAiAgentConfig(env, defaultCwd)`
  (`src/config/`), los cuatro códigos de error con su status, y `FakeAiAgent` en `__fixtures__`.
  Lo valida un test por código de error con una salida real del CLI, un test de los argumentos
  exactos del binario y un test de que el payload no filtra `stderr`, rutas absolutas ni `.stack`.
- TASK-003 — Inventario del proyecto (`collectStoryboardInventory`) y prompts
  (`buildStoryboardSystemPrompt`, `buildStoryboardUserPrompt`, `renderStoryboardPrompts`), todo
  puro, en `src/storyboard/`. Lo validan tests con y sin catálogo, con y sin transcripción, con y
  sin storyboard previo, y un test del texto exportado (numeración desde `01`, personajes).
- TASK-004 — Job `kind: 'storyboard'`: `storyboard-job-params.ts` (`brief` XOR `scriptText`,
  `overwrite`), `run-storyboard-pipeline.ts` (etapas `collect` → `propose` → `persist`),
  `storyboard-job-progress.ts`, la tercera rama de la unión `Job`/`CreateJobInput` y su despacho en
  la cola, y la rama del `jobs-handler`. Lo validan tests de cada entrada inválida sin job
  registrado, del 409 sin `overwrite`, de la secuencia monotónica de etapas y de la cancelación.
- TASK-005 — Endpoints `GET`/`PUT /projects/:slug/storyboard` y
  `GET /projects/:slug/storyboard/prompts` (texto plano), sus rutas, el handler y
  `capabilities.storyboardQueue` en `GET /health`. Lo validan tests con
  `Object.keys(body).sort()` sobre el set completo de claves y un test de `content-type` y cuerpo
  del export.
- TASK-006 — `sdd/api.json` (dos endpoints nuevos, `EP-012` y `EP-001` en `updated` con su
  `changelog`), README de `apps/render-api` (job, parámetros, errores, variables nuevas y guion
  copiable) y el **smoke real ejecutado** contra `claude -p`, con prompt y respuesta literal en
  `artifacts/`.

## Decisiones técnicas

- **`StoryboardDocument` vive en `libs/timeline-core`, no en `apps/render-api`** (D-6 de la spec):
  la app no contiene lógica de motor propia, `timeline-core` es la lib de contratos Zod y
  `spec-010` produce la `Timeline` **desde** este documento dentro de las libs. Registro afectado:
  ninguno de `sdd/schema.json` (no hay base de datos); el contrato queda en el código y en
  `sdd/api.json` por los endpoints que lo publican.
- **El JSON Schema se deriva del schema Zod (`z.toJSONSchema`), nunca se escribe a mano** (D-6): es
  la única forma de que el schema que ve el modelo y el que valida la respuesta no diverjan en
  silencio. La derivación se toma del objeto **sin refinar**, porque una validación cruzada no es
  representable en JSON Schema; el refinamiento sigue corriendo al parsear.
- **El modelo devuelve una *propuesta*, no el documento**: sin `id`, sin `index`, sin `createdAt`.
  Esos tres los asigna el servicio. Un modelo que inventa ids produce documentos que colisionan con
  los de una regeneración parcial, y `index` derivado de la posición del array es el único que no
  puede quedar inconsistente con el orden.
- **`remotionScene` es un objeto plano con `kind` y props opcionales, validado por refinamiento
  cruzado**, no una unión discriminada (D-6): las uniones son el constructo que peor sobrevive a
  `--json-schema` en salidas estructuradas, y la validación estricta se conserva del lado de Zod.
- **`api.json`:** `EP-016` `GET /projects/:slug/storyboard`, `EP-017` `PUT`, `EP-018`
  `GET .../storyboard/prompts`; `EP-012` (`POST /projects/:slug/jobs`) y `EP-001` (`GET /health`)
  pasan a `updated` con su entrada de `changelog` del ciclo.
- **`claude` no entra a `MEDIA_BINARY_NAMES`** (D-12): esa lista la resuelve `media-local` y
  volvería `degraded` toda máquina sin Claude Code, incluido CI. La capacidad se publica en
  `capabilities.storyboardQueue`; una sonda propia del agente queda como follow-up.
