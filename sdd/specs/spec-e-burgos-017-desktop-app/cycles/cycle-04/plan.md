# spec-e-burgos-017-desktop-app — cycle-04 · plan (lite)

> Módulo: desktop-app | Subproyectos: libs/producer-tools, apps/render-api, apps/web, apps/desktop | Fecha: 2026-09-24
> Flow: **lite** — decisión del dev (perfil `solo`). Un solo actor: escribe este plan, implementa
> task por task (con implementores delegados) y cierra como reviewer.
> Objetivo: que un amigo **sin Claude** pueda usar el productor con su API key de **OpenRouter**, con
> las mismas herramientas, las mismas recetas y la misma conversación que con el CLI `claude`.
> Fuera de alcance: la interfaz nueva centrada en el chat (`cycle-05`), cualquier otro proveedor que no
> sea OpenRouter, y cambiar el motor Claude (sigue siendo `claude -p` con el servidor MCP).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C4-01 | **Vercel AI SDK 7 + `@openrouter/ai-sdk-provider` 3** en `libs/producer-tools` | Es lo acordado en la spec (D-04). El SDK maneja el bucle de herramientas, el streaming y la cancelación; el provider de OpenRouter declara soporte para Zod 4 |
| D-C4-02 | El runtime OpenRouter usa `createStudioToolHandlers` **en proceso**, sobre el mismo cliente HTTP que usa el MCP | Mismas validaciones, mismos errores tipados y mismo alcance por proyecto que el motor Claude, sin un segundo proceso |
| D-C4-03 | **Cambio de contrato:** `start_job` pasa a recibir `{ job: <unión por kind> }` | Una unión en la raíz se publica vacía por MCP (hallazgo de `cycle-01`) y los proveedores estilo OpenAI exigen un objeto en la raíz del schema de una herramienta. Envolverla arregla los dos motores de una vez; los únicos consumidores son nuestros |
| D-C4-04 | La API key vive en el **llavero de macOS** (`/usr/bin/security`, servicio `Video Maker`, cuenta `openrouter`), escrita y leída por `render-api` | La ventana del estudio no tiene acceso a Electron, y así funciona igual en la app y en `pnpm studio`. La key nunca vuelve en un payload: la API solo informa si está cargada |
| D-C4-05 | El historial para OpenRouter se **reconstruye desde la base** (mensajes de usuario y del productor, más un resumen de las herramientas de cada turno), recortado al presupuesto de contexto del modelo | Claude retoma su sesión con `--resume`; OpenRouter no tiene sesión del lado del proveedor |
| D-C4-06 | **Lista curada** de modelos, elegida con un benchmark real y no por reputación | El productor encadena decenas de llamadas a herramientas; un modelo que falla en eso rompe la receta. La lista y sus resultados quedan en un artefacto |
| D-C4-07 | Motor por defecto: Claude si el CLI está disponible y logueado; si no, OpenRouter si hay key | Nadie tiene que configurar nada si ya tiene uno de los dos |
| D-C4-09 | **Catálogo en vivo** de OpenRouter servido por `render-api` (todos los modelos con herramientas, con precio, contexto, entrada de imágenes y si son gratuitos), combinado con el set recomendado; la web no tiene listas propias. Configuración muestra el catálogo completo con búsqueda; el chat, solo los recomendados (pedido del dev, 2026-09-24) | La lista fija de 3 modelos era un placeholder; el dev quiere elegir entre todo lo que ofrece OpenRouter y que los recomendados incluyan modelos gratuitos y muy baratos |
| D-C4-08 | Cada turno de OpenRouter registra `usage` y costo en USD que informa OpenRouter, visible en el turno | Es plata de tu amigo: tiene que poder ver cuánto le costó un video |

## Historias

- **US-017-301 — Un schema real para `start_job`.** CA: `tools/list` del MCP publica el schema completo
  de `start_job`, con `job` como unión por `kind`; el prompt y los ejemplos usan la forma nueva; un turno
  real con Claude (Haiku) inicia un job sin rechazos de forma.
- **US-017-302 — Cargar la key sin riesgo.** CA: desde la web se pega la key, se guarda en el llavero y
  la pantalla muestra solo "key cargada" más los últimos 4 caracteres; borrarla la saca del llavero;
  una key inválida se detecta con una llamada barata a OpenRouter y se informa.
- **US-017-303 — El productor con OpenRouter.** CA: con el motor OpenRouter, un turno usa las mismas
  herramientas del estudio y deja la misma conversación persistida, los mismos eventos legibles y las
  mismas sugerencias que con Claude; se puede cancelar; `extract_frames` le llega al modelo como imagen
  en los modelos que la aceptan.
- **US-017-304 — Elegir motor y modelo.** CA: la web permite elegir el motor por defecto y el modelo;
  el selector del chat muestra los modelos del motor activo; `/health` informa qué motores están listos
  y el productor queda disponible si al menos uno lo está.
- **US-017-305 — La key nunca se filtra.** CA: después de un turno real, un `grep` de la key sobre la
  base, los logs, `work/producer/` y las respuestas de la API no encuentra nada.
- **US-017-306 — Modelos que funcionan.** CA: la lista curada tiene entre 2 y 4 modelos que completaron
  el escenario del benchmark; cada uno con su tasa de éxito, pasos, latencia y costo por corrida.

## Tasks (detalle en tasks.json)

- **TASK-001** — `start_job` envuelto en `{ job }`.
- **TASK-002** — Llavero y endpoints de configuración del productor.
- **TASK-003** — Runtime OpenRouter en `libs/producer-tools`.
- **TASK-004** — Ruteo por motor en `render-api`.
- **TASK-005** — Configuración en la web.
- **TASK-006** — Benchmark de modelos y lista curada.
- **TASK-007** — Verificación real en la app empaquetada.
- **TASK-008** — Cierre.

## Verificación

- `pnpm nx run-many -t lint test build` en verde, cobertura ≥ 80%.
- **Benchmark (TASK-006):** escenario fijo sobre una copia de un proyecto real: inventario, medir el
  A-roll, mirar 3 frames, escribir un guion con marcas de tiempo y lanzar el job de voz. De 6 a 8
  candidatos, 2 corridas cada uno, con un **tope de gasto total de USD 3**.
- **Receta Tutorial con OpenRouter (TASK-007)** en la app empaquetada, con el modelo por defecto de la
  lista: MP4 verificado por `nb_frames`, secuencia de herramientas comparada con la corrida de Claude de
  `cycle-03`, y el `grep` de la key en todo lo que persiste la app.

## Riesgos del ciclo

| Riesgo | Mitigación |
| --- | --- |
| Hace falta una API key de OpenRouter con saldo para probar | La carga el dev desde la web o con `security add-generic-password`; **nunca por el chat**. Tope de gasto por corrida y total |
| Un modelo barato no sigue las recetas | Por eso el benchmark; el modelo por defecto sale de ahí |
| Las imágenes de `extract_frames` no llegan en algunos modelos | La lista curada marca qué modelos aceptan imágenes; para los demás, `extract_frames` devuelve solo texto y el prompt lo sabe |
| El historial reconstruido supera el contexto | Recorte por presupuesto con los mensajes más recientes completos y un resumen de los anteriores |

## Notas de implementación

- **TASK-002** adelantó dos piezas que `tasks.json` había asignado a **TASK-004** porque las pedía
  el mismo endpoint de settings: `apps/render-api/src/http/health-handler.ts` (y su spec) ganó
  `capabilities.producerEngines: { claudeCli, openrouter }` de forma aditiva, y `capabilities.producer`
  ahora es `claudeCli || openrouter` (antes solo probaba el CLI de Claude) — implementa D-C4-07 para
  `/health`. TASK-004 no necesita volver a tocar esos dos campos; sigue siendo dueña del ruteo por
  motor y del resto de `capabilities`.
- El puerto `SecretStore` (`apps/render-api/src/secrets/keychain-secret-store.ts`) quedó agregado a
  `RenderApiDependencies` y wireado en `createNodeRenderApiDependencies` y en
  `createFakeRenderApiDependencies` (fixture en memoria por defecto). Cualquier task siguiente que
  necesite la key de OpenRouter (TASK-004) la lee con `deps.secretStore.get('openrouter')` —
  constante `OPENROUTER_SECRET_NAME` exportada desde `producer-settings-handler.ts`.
- `apps/render-api/src/config/curated-openrouter-models.ts` es un placeholder de 3 ids (verificados
  contra `GET https://openrouter.ai/api/v1/models`, con `tools` en `supported_parameters`) que
  TASK-006 reemplaza con la lista curada por benchmark real.
- **TASK-005** agregó `/settings` como ruta perezosa top-level (mismo patrón que `/guide`) con nav
  propio en `studio-layout.tsx` (`HEADER_LINKS`, ahora data-driven para no duplicar el `className`
  de cada link). La página consume `GET/PUT /settings/producer` y `PUT/DELETE
  /settings/producer/openrouter-key` (EP-037..040) a través de cuatro métodos nuevos en
  `render-api-client.ts` + `parse-producer-settings.ts`. `isProducerModelOption` se exportó desde
  `parse-producer.ts` para no duplicar el validador en el parser nuevo.
  El campo de la key es **write-only en memoria**: `submitKey` lee el input a una constante local y
  llama `setKeyDraft('')` antes del `await` a la API, así que el componente nunca vuelve a tener la
  key en su estado ni la renderiza de nuevo, ni siquiera durante el request pendiente o tras un
  rechazo — patrón a documentar en la constitución para cualquier input de secreto futuro.
  `producer-composer.tsx` ahora recibe `models`/`activeEngine` que `producer-page.tsx` deriva de
  `GET /settings/producer` (motor efectivo → catálogo de modelos de ESE motor), con fallback al
  catálogo de `GET .../producer` mientras el nuevo recurso carga; `producer-message-list.tsx` pinta
  `producer.turnCost` bajo un mensaje del asistente sólo si trae `costUsd` (campo opcional,
  TASK-004 lo suma de forma aditiva del lado del turno).
  **Presupuesto de chunk inicial:** el ciclo pedía no crecer más de 2 kB con la página de settings
  perezosa. La página en sí y todo el catálogo `MESSAGES_ES` no cuestan nada al chunk inicial (ambos
  perezosos), pero los cuatro métodos nuevos de `render-api-client.ts` (el cliente vive en
  `RenderApiProvider`, que envuelve el router entero, nunca perezoso) y las ~35 claves nuevas de
  `MESSAGES_EN` (también eager: es el catálogo por defecto de `translate()`) sí cuentan. Medido:
  526,63 kB → 530,87 kB (+4,24 kB crudo, +0,96 kB gzip) tras deduplicar `isProducerModelOption` y
  fusionar claves de catálogo redundantes (`settings.key.saving`→`settings.saving`,
  `settings.key.removeAccept`→`settings.key.remove`, `producer.withEngine.{claudeCli,openrouter}`→
  `producer.withEngine` con interpolación). No se pudo bajar de los 2 kB pedidos sin sacrificar los
  cuatro endpoints reales o el catálogo EN — para la próxima superficie de API grande conviene
  discutir si el cliente puede dejar de ser 100% eager.
- **TASK-009** reemplazó `config/curated-openrouter-models.ts` (placeholder de 3 ids) por el
  catálogo en vivo de D-C4-09: `producer/openrouter-model-catalog.ts` pega `GET
  https://openrouter.ai/api/v1/models` a través del `fetchRemote` port, cachea 1h en memoria (mismo
  patrón que `music/music-search-cache.ts`) y sirve la copia vieja con `stale: true` si el refetch
  falla; sin caché y sin red tira `OPENROUTER_CATALOG_UNAVAILABLE` (503, nuevo código). Sólo quedan
  los modelos con `"tools"` en `supported_parameters`; precios de OpenRouter (string USD por token)
  se convierten a `promptPerMTokUsd`/`completionPerMTokUsd` (× 1e6). El set recomendado vive en
  `config/recommended-openrouter-models.ts`, sembrado con los mismos 3 ids placeholder (`tier:
  'reference'`, `bench: null`) que TASK-006 reemplaza.
  **Desviación del contrato:** el Arquitecto pedía el set recomendado como `.json`; se implementó
  como un literal `.ts` (mismo shape JSON, validado en el import con la misma función que validaría
  un `.json`) porque el repo no tiene ningún precedente de `resolveJsonModule` y el bundle de
  producción (`scripts/esbuild-node-bundle.mjs`, salida CJS single-file) mezclado con `tsc -p
  tsconfig.lib.json` (ESM, sin bundlear) y `@swc-node/register` (dev) habría exigido tres
  comportamientos de interop distintos para un mismo import sin poder probarlos los tres en CI barato;
  el `.ts` es idéntico en ergonomía para el próximo benchmark (reemplaza el array entero) y cero
  riesgo de build. Si el kit adopta `resolveJsonModule` en otro ciclo, migrar es un solo archivo.
  `GET /settings/producer` (EP-037) sigue devolviendo `engines.openrouter.models` como
  `ProducerModelOption[]` para no romper `producer-composer.tsx`, pero ahora son sólo los
  recomendados descriptos desde el catálogo en vivo (nombre real, precio o "Free"), con fallback a
  `id`+`notes` estáticos si OpenRouter no contesta. `PUT /settings/producer` y `startProducerTurn`
  (`run-producer-turn.ts`) validan `models.openrouter` contra el catálogo completo (no sólo
  recomendados); si el catálogo es inalcanzable, caen a aceptar sólo los ids recomendados — mismo
  criterio en los dos lados. Nuevo endpoint `GET /settings/producer/openrouter-models` (EP-041,
  `scope=all|recommended&q=&sort=price|name`) sirve el catálogo completo a
  `openrouter-model-picker.tsx` (dos pestañas: Recomendados en cards, Todos los modelos en filas
  compactas paginadas de a 30 sin virtualización — alcanza para ~400 modelos). El selector del chat
  (`producer-page.tsx`) arma la lista como `engines.openrouter.models` (recomendados) + el
  `models.openrouter` guardado si no está en esa lista, marcado "tu elección"
  (`producer.model.yourChoice`). Chunk inicial: 530,97 kB → 533,89 kB (+2,92 kB crudo, +0,80 kB
  gzip) — el picker en sí no pesa nada (vive en el chunk perezoso de `settings-page`), el costo es
  el método nuevo de `render-api-client.ts` y las claves nuevas de `MESSAGES_EN` (eager).
