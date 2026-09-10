# spec-e-burgos-008-ai-storyboard — cycle-02 · plan (lite)

> Módulo: ai-storyboard | Subproyectos: apps/web | Fecha: 2026-09-09
> Objetivo: que el creador arranque un video desde una idea o un guion sin salir del navegador —
> proponer el storyboard con la IA local, editarlo escena por escena, guardarlo y llevarse la
> lista numerada de prompts visuales a Meta AI / Google Flow. **Cierra la spec.**
> Fuera de alcance: la voz en off (`spec-009`), los huecos por escena y la importación numerada
> (`spec-010`), el banco de audio (`spec-011`) y el catálogo de estilos de captions (`spec-012`) —
> `captionsStyle`, `musicTags` y `sfxTags` se editan como texto libre hasta entonces. Tampoco se
> toca el contrato: `cycle-01` ya publicó `EP-016`/`EP-017`/`EP-018` y las ramas de `EP-012`.

## Historias

- US-08-006 — Como creador quiero describir mi idea (o pegar mi guion) en el estudio y ver
  proponerse el storyboard, para no salir del navegador ni usar la CLI. CA: la página dispara
  `EP-012` `kind: 'storyboard'`, muestra las tres etapas (`collect|propose|persist`) y avisa en
  pantalla que `propose` tarda más de un minuto porque llama al agente local.
- US-08-007 — Como creador quiero editar el storyboard propuesto y guardarlo, para corregir la
  narración, los prompts y la fuente del visual antes de generar nada. CA: edición inline con
  estado dirty, `PUT` del documento completo (`EP-017`) y validación de cliente espejo de los 422
  que bloquea el guardado con el motivo escrito.
- US-08-008 — Como creador quiero copiar la lista numerada de prompts, y el de una escena suelta,
  para pegarla en Meta AI o Google Flow. CA: un botón copia al portapapeles el `text/plain` de
  `EP-018` tal cual lo emite el servicio, la hoja se puede ver en pantalla, y cada escena tiene su
  propio botón de copia.
- US-08-009 — Como creador quiero que un storyboard existente no se pise sin que yo lo confirme y
  que un fallo del agente me diga qué hacer. CA: `409 STORYBOARD_ALREADY_EXISTS` abre una
  confirmación que reintenta con `overwrite: true`; los códigos del agente (`429`, `503`, `502`,
  `422`) se muestran con su código **y** una explicación en lenguaje de usuario.
- US-08-010 — Como dev quiero no poder disparar el job si el servicio no puede generar
  storyboards. CA: `capabilities.storyboardQueue` aparece en el panel de salud y
  `storyboardBlockers()` deshabilita el botón con el motivo escrito.

## Tasks (detalle en tasks.json)

- TASK-001 — Frontera con el servicio en `src/api/`: la tercera rama de la unión `Job`
  (`StoryboardJob`, `STORYBOARD_STAGES`, `StoryboardJobProgress`, `StoryboardJobReport`),
  `storyboardQueue` en `ServiceCapabilities`, los guards y `parseStoryboardJob` en
  `parse-render-job.ts`, `storyboard-capability.ts` (`storyboardBlockers` puro) y los cuatro
  métodos del cliente (`createStoryboardJob`, `getStoryboard`, `putStoryboard`,
  `getStoryboardPrompts`, este último por un camino de `text/plain`). Lo validan tests con
  `Object.keys(body).sort()` sobre el payload del `POST` y del `PUT`, un test por código de error
  del agente, un test del lector de texto plano y un test de que `parseStoryboardJob` rechaza los
  otros dos `kind`.
- TASK-002 — Modelo de edición puro en `src/api/storyboard-edit/`: `parseStoryboardDocument`
  (`safeParse` contra `StoryboardDocumentSchema`), `storyboardIssues` (espejo de cliente de los
  422, una línea por issue de Zod con su path) y los editores inmutables del documento (encabezado,
  personajes, escenas, fuente del visual y escena Remotion). Lo validan tests de cada editor sobre
  el documento completo, de los rechazos (`visualSource=asset` sin `assetId`, escena Remotion con
  props de otro `kind`) y de que un editor nunca muta el documento de entrada.
- TASK-003 — `StoryboardTrigger` y `StoryboardJobPanel` en `src/components/`: brief o guion
  (pegado o subido como archivo de texto), gating por `storyboardBlockers`, confirmación ante el
  409 con `overwrite`, aviso de duración durante `propose` y traducción a lenguaje de usuario de
  los códigos del agente. Los validan tests de cada rama de error, del gating y de la
  confirmación.
- TASK-004 — Editor del storyboard en `src/components/`: `StoryboardHeaderEditor`,
  `StoryboardCharacterSheet`, `StoryboardSceneEditor` (narración, prompt visual, fuente,
  `assetId`, escena Remotion y sus props, duración, estilo de captions y etiquetas),
  `StoryboardSaveBar` (dirty + issues + `PUT`) y `StoryboardPromptSheet` (copiar todo, ver el texto
  numerado, copiar por escena). Los validan tests de edición, de dirty, del bloqueo por issue y de
  la copia al portapapeles con un `navigator.clipboard` inyectado.
- TASK-005 — `StoryboardPage` (`/projects/:slug/storyboard`) montada **perezosamente** en el
  router, estado vacío accionable cuando no hay storyboard, navegación del ciclo completo
  (trigger → job → editor → prompts), nav por proyecto en `StudioLayout` (library · storyboard ·
  preview) y enlace desde la biblioteca de assets. Lo validan tests de la página en sus cuatro
  estados y del nav derivado del `pathname`.
- TASK-006 — Cierre: `apps/web/e2e/storyboard-smoke.mjs` contra `claude -p` real, README de
  `apps/web`, `sdd/components.json`, fragmento de contexto, journal y registros del ciclo.

## Decisiones técnicas

- **Flow `lite` por decisión explícita del dev**, en contra de la sugerencia del validador. El
  aviso de `pnpm sdd:validate` (`flow: lite created 5 endpoint(s) — … open the next cycle as
  flow: full`) se refiere a los endpoints que creó `cycle-01`; **`cycle-02` no crea ni modifica
  ningún contrato**: sólo consume `EP-001`, `EP-012`, `EP-016`, `EP-017` y `EP-018` tal como
  quedaron publicados. El dev pidió "todo en lite" y el ciclo tiene un solo subproyecto y un solo
  actor. Registro afectado: `cycle.json → flow: "lite"`; `sdd/api.json` **no se toca**.
- **`StoryboardDocument` y `StoryboardDocumentSchema` se importan de
  `@video-maker/timeline-core`, no se replican en `src/api/`.** D-5 de `spec-006` prohíbe importar
  de `apps/render-api` (otra app) y de `libs/auto-montage` (lib Node con `node:fs` y `execa`);
  `timeline-core` es Zod puro, ya está aliaseado en `vite.config.ts` y ya es la fuente de `Timeline`
  y `TimelineSchema` en esta app (`parse-timeline.ts`). Replicar el schema a mano crearía dos
  verdades del mismo documento: el 422 del servidor sale de ese mismo schema. Lo que **sí** se
  declara en `src/api/` es el contrato **HTTP** (el job, sus etapas, su reporte y las capabilities),
  que es lo que D-5 gobierna.
- **La página de storyboard entra por un chunk perezoso**, igual que la de preview: Zod y
  `timeline-core` no pueden entrar al chunk inicial. El detector es la salida de `vite build`
  (sin el aviso de "chunks larger than 500 kB" y con el chunk inicial estable). Registro afectado:
  ninguno; es una restricción de la constitución de `apps/web`.
- **`getStoryboardPrompts` no pasa por `requestJson`**: `EP-018` responde `text/plain` con
  `content-length`, y el cuerpo se copia al portapapeles **tal cual lo emite el servicio**, sin
  recomponerlo en el cliente. La numeración desde `01` es la que va a leer la importación en lote
  de `spec-010`: recomponerla acá la haría divergir en silencio. Los errores de ese endpoint sí
  vuelven en JSON y se leen con la misma superficie de `RenderApiError`.
- **`components.json`:** `COMP-027` `StoryboardTrigger`, `COMP-028` `StoryboardJobPanel`,
  `COMP-029` `StoryboardHeaderEditor`, `COMP-030` `StoryboardCharacterSheet`, `COMP-031`
  `StoryboardSceneEditor`, `COMP-032` `StoryboardSaveBar`, `COMP-033` `StoryboardPromptSheet`,
  `COMP-034` `StoryboardPage`, bajo la app-key `apps/web` con su `consumes`.
