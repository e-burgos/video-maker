# spec-e-burgos-015-studio-producer — cycle-02 · plan (lite)

> Módulo: studio-producer | Subproyectos: apps/web, apps/render-api | Fecha: 2026-09-10
> Objetivo: poner la pantalla del productor en el Web Studio sobre el contrato de `cycle-01`
> (chat con la conversación persistida, actividad del turno en vivo con cancelación, sugerencias
> como chips y errores traducidos), hacerla el punto de partida del proyecto, y darle al usuario
> el control del logo y presets de montaje legibles. Cierra la spec.
> Fuera de alcance: multi-usuario, cambiar el motor, subir assets por el chat, editar la Timeline
> desde el productor (eso sigue en la página de preview), y cualquier endpoint nuevo.

**Flow `lite` por decisión del dev (prefijo `[LITE]`), con `profile: solo` de acuerdo.** El ciclo
**consume** el contrato de `cycle-01` sin crear endpoints nuevos, así que no aplica la excepción de
"crea contratos que otro subproyecto consume" que obligaría a `full`. Un solo actor con tres
sombreros: escribe este plan, crea `tasks.json`, implementa task por task y cierra como reviewer.
Sin fan-out de subagentes.

**Extensión de alcance declarada — `apps/render-api` entra al ciclo por una sola razón.** El pedido
del dev exige que `AssetUploader` acepte el rol `logo`, y `EP-006` hoy no lo acepta:
`ASSET_ROLES` del servicio tiene cinco roles y `logo` no está entre ellos (`ASSET_ROLE_INVALID`),
aunque el catálogo de `@video-maker/auto-montage` ya clasifica `raw/logo/` como rol `logo` y
`EP-005` lo devuelve. Sin ese sexto rol el check "Show logo" sería decorativo: no habría forma de
meter un logo desde la app. Es un cambio aditivo (un rol, un directorio, un contador) sobre
`EP-004`/`EP-006`; ningún endpoint nuevo.

## Historias

- US-15-011 — Como usuario del studio quiero conversar con el productor desde la app para no tener
  que abrir Claude Code a mano. CA: `/projects/:slug/producer` carga `EP-022` y muestra cada mensaje
  con su rol y su markdown básico (párrafos, listas y negritas) renderizado, no crudo; el campo de
  texto envía con Enter (`Shift+Enter` hace salto de línea) y con el botón, y el mensaje del usuario
  aparece en pantalla apenas el `202` de `EP-023` vuelve.
- US-15-012 — Como usuario quiero ver qué está haciendo el productor mientras trabaja para no mirar
  una pantalla muerta 3 a 9 minutos. CA: con un turno activo la página pollea `EP-024` cada 2,5 s,
  lista los `events` en orden con su resumen legible, muestra el tiempo transcurrido y hace
  auto-scroll al último evento; al terminar, el mensaje del asistente entra a la conversación.
- US-15-013 — Como usuario quiero contestarle al productor con un clic. CA: las `suggestions` del
  turno se muestran como chips que envían ese texto tal cual; si el texto del asistente trae opciones
  numeradas (`1. … 2. …`) esas opciones aparecen también como botones de respuesta rápida.
- US-15-014 — Como usuario quiero cortar un turno que se fue de largo y que la app no quede colgada.
  CA: el botón Cancel llama `EP-025`, sigue polleando hasta `canceled` y libera la página para un
  turno nuevo; `PRODUCER_TURN_NOT_CANCELABLE` no rompe la pantalla.
- US-15-015 — Como usuario que abre un proyecto por primera vez quiero saber qué puedo pedirle al
  productor. CA: sin mensajes, la pantalla muestra el inventario real del proyecto por rol (derivado
  de `EP-005`) y 3–4 sugerencias iniciales editables; si el proyecto no tiene ningún asset, la
  sugerencia es subir material con enlace a la biblioteca.
- US-15-016 — Como usuario quiero entender qué pasó cuando el productor falla. CA: los ocho códigos
  del productor se muestran con su código **y** una frase en lenguaje de usuario; `429
  PRODUCER_RATE_LIMITED` dice explícitamente que se agotó la cuota de la suscripción y que la
  conversación queda guardada; con `capabilities.producer` en `false` el envío queda deshabilitado
  con el motivo escrito.
- US-15-017 — Como usuario quiero poner mi logo sin editar JSON. CA: el panel de logo de la página de
  preview activa `timeline.logo` con la posición elegida (`bottom-right` por defecto) y lo persiste
  con el `PUT` completo existente (`EP-008`); sin un asset de rol `logo` probado en el catálogo el
  control está deshabilitado con el motivo a la vista, y `AssetUploader` ofrece el rol `logo`
  (`EP-006` lo acepta y lo guarda en `raw/logo/`).
- US-15-018 — Como usuario quiero elegir el preset de montaje por lo que hace, no por su id. CA: el
  selector muestra etiqueta y descripción legibles de los cuatro presets y el `value` sigue siendo el
  id del contrato (`software-demo`, `hardware`, `educational`, `recipe`).
- US-15-019 — Como dev quiero la prueba de que la pantalla produce un video real. CA: `producer-smoke.mjs`
  va del estado vacío al MP4 en `out/` por el navegador contra un `claude -p` real sobre una copia
  temporal de `media/demo-01`, con capturas de cada pantalla en `artifacts/`.

## Tasks (detalle en tasks.json)

- TASK-001 — `src/api/`: tipos del productor (mensaje, sesión, turno, evento, `producer` en
  `ServiceCapabilities`), `parse-producer.ts` (guards estructurales, sin Zod, como `parse-voice`),
  `producer-capability.ts` (`producerBlockers` + `producerFailureExplanation` de los ocho códigos),
  `producer-turn-poll-plan.ts` y los cuatro métodos del cliente. Aserción de forma por
  `Object.keys().sort()` contra el contrato.
- TASK-002 — `producer-markdown.ts` (párrafos, listas `-`/`1.`, negritas y extracción de opciones
  numeradas, todo puro y sin dependencias), `ProducerMessageList` y `ProducerComposer`.
- TASK-003 — `useProducerTurnPoll` (mismo patrón de `useRenderJobPoll`: `setTimeout` re-armado,
  nunca `setInterval`) y `ProducerTurnActivity` con eventos, tiempo transcurrido, auto-scroll y
  cancelación.
- TASK-004 — `ProducerWelcome` (inventario por rol desde `EP-005` + sugerencias iniciales) y
  `ProducerPage`: ruta perezosa, primera entrada del nav, destino por defecto al abrir un proyecto,
  jobs del agente en vivo y refresco de conversación, assets y jobs al cerrar el turno.
- TASK-005 — Rol `logo` en `apps/render-api` (`asset-path.ts`, `countAssetsByRole`, `EP-004`/`EP-006`
  en `api.json`, README) y en `apps/web`; `timeline-edit/logo-overlay.ts` (alta y baja del overlay
  **y** del `MediaAsset` en `assets`, porque `validateTimeline` exige que el `assetId` exista y sea
  `image`), acción nueva del reducer y `LogoOverlayEditor` en la página de preview.
- TASK-006 — `montage-presets.ts` con etiqueta y descripción de los cuatro presets, consumido por
  `MontageTrigger` sin cambiar los ids del contrato.
- TASK-007 — E2E real `apps/web/e2e/producer-smoke.mjs` sobre copia temporal de `media/demo-01`,
  capturas y evidencia literal en `artifacts/`, y cierre: `components.json`, README de `apps/web`,
  nota de uso en la skill `video-producer`, contexto, memoria y `global.json`.

## Decisiones técnicas (obligatoria: toca api.json y components.json)

- **D-1 — El panel del logo va en la página de preview, no en el productor** (`components.json`:
  `LogoOverlayEditor` bajo `apps/web`). La máquina de edición de la Timeline (reducer, `dirty`,
  severidad de issues, barra de guardado y el único `PUT` completo) ya vive ahí; un control en el
  productor obligaría a duplicar la barra de guardado y crearía una segunda fuente de verdad del
  mismo documento. Además el `<Player>` de esa página dibuja el logo, así que el efecto se ve al
  instante.
- **D-2 — El rol `logo` se agrega al servicio, no se simula en el cliente** (`api.json`: `EP-006`
  y `EP-004` en `updated`). La alternativa —dejar que el usuario copie el archivo a `raw/logo/` a
  mano— convierte una función del producto en una instrucción de terminal. `assetCounts` de `EP-004`
  gana la clave `logo` (cambio aditivo) y el catálogo ya sabía clasificar ese directorio.
- **D-3 — El overlay del logo escribe también `timeline.assets`.** `validateTimeline` emite
  `LOGO_ASSET_NOT_FOUND` si el `assetId` no está en `assets` y `LOGO_ASSET_NOT_IMAGE` si no es una
  imagen: el control sólo se habilita con un asset de rol `logo` **probado** en el catálogo
  (`media !== null`), que es el `MediaAsset` que se inserta. Con `source: 'raw-scan'` el control
  queda deshabilitado con el motivo escrito, porque no hay `MediaAsset` que insertar.
- **D-4 — El productor NO reusa `useRenderJobPoll`** (`components.json`: hook propio). El turno no es
  un `Job`: no tiene `kind`, ni `state`, ni `progress`, y su parada es por `status` terminal propio
  con un intervalo distinto (2,5 s contra 1 s). Forzarlo dentro de la unión `Job` repetiría el
  antipatrón de opcionales que la constitución del subproyecto prohíbe. Los jobs que el agente encola
  se siguen leyendo con el listado real de `EP-013`.
- **D-5 — El markdown se implementa a mano y acotado** (cero dependencias npm nuevas, RNF del
  subproyecto): párrafos, listas ordenadas y no ordenadas y negritas. Todo lo demás se muestra como
  texto plano. El texto del asistente llega en el idioma del usuario y nunca se interpreta como HTML.
- **D-6 — Las etiquetas de preset viven en `src/api/`, no en el componente** (`components.json`:
  `MontageTrigger` en `updated`): son un espejo declarado del union del contrato y un preset nuevo
  tiene que romper el tipo en un solo lugar.
