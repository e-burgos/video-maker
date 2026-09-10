# spec-e-burgos-015-studio-producer cycle-02 — 2026-09-10

## Estado
El Web Studio gana **su punto de partida**: `/projects/:slug/producer` es la primera entrada del nav
(`producer · library · storyboard · voice · preview`) y el destino de cada tarjeta del listado de
proyectos. Es el chat con el productor de `cycle-01`: conversación persistida (`EP-022`) con markdown
básico propio, envío con Enter (`EP-023`), actividad del turno en vivo cada 2,5 s con los eventos
legibles del agente, reloj de transcurrido y **Cancel** que mata el proceso (`EP-024`/`EP-025`),
`suggestions` y opciones numeradas de la respuesta como **chips** que envían ese texto tal cual,
estado vacío con el inventario real del proyecto (`EP-005`) y sugerencias iniciales editables, los
jobs que el agente encola visibles mientras el turno corre, y refresco de conversación, assets y jobs
al cerrar el turno. Los ocho códigos del productor se muestran con su code **y** una frase de
usuario; `429 PRODUCER_RATE_LIMITED` dice que se agotó la cuota y que la conversación queda guardada.
El ciclo cierra además dos deudas del feedback real: el **logo** se maneja desde la app (rol `logo`
end to end y panel en el preview) y los **presets de montaje** se ofrecen con etiqueta y descripción
legibles sin cambiar sus ids. Suite: **76 archivos / 703 tests**, 98,71 % stmts · 95,89 % branch ·
98,67 % funcs · 98,98 % lines, piso 80 % y `coverage.include` sin recortar. Cero dependencias npm
nuevas.

## Estructura
- `src/api/render-api-types.ts`: tipos del productor (`ProducerMessage`, `ProducerSession`,
  `ProducerTurn` con su unión de eventos `text|tool|status`, `ProducerConversation`,
  `ProducerTurnAccepted`), `producer` en `ServiceCapabilities` y **`'logo'` como sexto `AssetRole`**.
- `src/api/parse-producer.ts` (guards estructurales, sin Zod, como `parse-voice`),
  `producer-capability.ts` (`producerBlockers` + `producerFailureExplanation` de los 8 códigos),
  `producer-turn-poll-plan.ts` (2,5 s, `terminal|not-found|unreachable`) y `producer-markdown.ts`
  (encabezados, párrafos, listas `-`/`1.`, reglas `---`, **tablas**, bloques cercados, negritas,
  código inline y `numberedOptions`, todo puro y a mano). La lista de bloques salió de mirar lo que
  el agente **realmente** contesta en la corrida real: la primera versión sólo tenía párrafos,
  listas y negritas, y una tabla de inventario se veía como una pared de pipes.
- **El turno NO entró a la unión `Job`** y `useProducerTurnPoll` es un hook propio: el turno no tiene
  `kind`, ni `state`, ni `progress`, y para el `Job` habría que ensanchar con opcionales, que es
  justo el antipatrón que esta app prohíbe. Mismo patrón interno que `useRenderJobPoll`
  (`setTimeout` re-armado, nunca `setInterval`). Los jobs que el agente encola se leen del listado real.
- Componentes nuevos: `ProducerMessageList` (COMP-039), `ProducerComposer` (040),
  `ProducerTurnActivity` (041), `ProducerWelcome` (042), `ProducerPage` (043),
  `LogoOverlayEditor` (044). `ProjectsPage`, `StudioLayout`, `MontageTrigger` y
  `ProjectPreviewPage` quedan en `updated`.
- **El logo vive en la página de preview, no en el productor**: ahí ya están el reducer, el `dirty`,
  la severidad de issues y el único `PUT` completo; duplicarlos daría dos fuentes de verdad del mismo
  documento. `timeline-edit/logo-overlay.ts` escribe `timeline.logo` **y** mete el `MediaAsset` en
  `timeline.assets` (`validateTimeline` emite `LOGO_ASSET_NOT_FOUND`/`LOGO_ASSET_NOT_IMAGE` si no
  está o no es imagen), y lo saca al apagar el logo si ningún clip lo referencia. El control se
  habilita sólo con un logo **probado** en el catálogo (`media !== null`); con `source: 'raw-scan'`
  queda deshabilitado con el motivo escrito.
- `src/api/montage-presets.ts` es el espejo declarado del union de presets: etiqueta y descripción
  viven en `src/api/`, no en el componente, para que un preset nuevo rompa el tipo en un solo lugar.
- `producer-page` es una ruta perezosa más. Medido tras el ciclo: chunk inicial **478 kB**,
  `producer-page` 23,1 kB, `voice-page` 19,9 kB, `storyboard-page` 33,1 kB,
  `project-preview-page` 366 kB, sin el aviso de 500 kB de Vite.
- `e2e/producer-smoke.mjs` con `claude -p` real sobre una copia temporal de `media/demo-01`, y el
  gate barato `PRODUCER_SMOKE_STOP_AFTER=4` que ejercita copia, servidores, navegación e inventario
  sin gastar un token.

## Dependencias
Ninguna npm nueva. Consume de `apps/render-api` el contrato de `cycle-01` sin modificarlo
(`EP-001` `capabilities.producer`, `EP-005`, `EP-013`, `EP-022`..`EP-025`). **Sí** entró un cambio
aditivo del servicio en este ciclo, por el logo: `EP-006` acepta el rol `logo` (antes
`ASSET_ROLE_INVALID`), `EP-004` suma la clave `logo` a `assetCounts` y `EP-003` crea `raw/logo/`
junto a las otras cinco. Sin ese sexto rol el check "Show logo" era decorativo: no había forma de
meter un logo en el proyecto desde la app.

## Qué sigue
- **La conversación no se puede borrar ni empezar de nuevo desde la UI**: el servicio no expone un
  `DELETE` de `work/producer/`, así que un hilo largo o envenenado sólo se corta a mano en disco.
- **Un turno perdido por reinicio del servicio da `PRODUCER_TURN_NOT_FOUND`** y la página lo explica,
  pero no puede reengancharse: el registro de turnos es in-memory (limitación anotada en `cycle-01`).
- **El productor no sube archivos**: el usuario sigue subiendo material por la biblioteca o por el
  panel del logo. Un adjunto en el chat es candidato natural de la próxima spec de `apps/web`.
- **`widthRatio`, `marginRatio` y `opacity` del logo no se editan**: la UI ofrece mostrar/ocultar y
  las cuatro esquinas; el resto queda en los defaults del schema.
- **La página no muestra el costo del turno** (tokens del agente), que `cycle-01` tampoco expone en
  el contrato del turno: misma laguna que el `usage` del storyboard.
