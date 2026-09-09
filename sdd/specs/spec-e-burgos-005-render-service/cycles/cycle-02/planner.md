# Sprint Plan — Ciclo 2 — `render-service` (`apps/render-api`)

> **Input:** `brief.yaml`, `functional.md`, `architect.md` (contrato cerrado)
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/planner.md`
> **Generado por:** sdd-planner (claude-sonnet, effort medium)
> **Tasks canónicas:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/tasks.json`

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 2 |
| Módulo | `render-service` |
| App | `apps/render-api` |
| Flow | `full` |
| Tasks | 20 (`TASK-001`..`TASK-020`) |
| Story points totales | 73 SP |
| Horas estimadas totales | 63 h |
| Duración estimada | ~2 semanas (implementador único, ~4-5h/día efectivas) |

**Por qué 20 tasks y no 10-16.** El contrato cierra 11 endpoints, 22 archivos de test
obligatorios (§11.1 del architect) y un puerto `ObjectStorage` de 9 operaciones. Respetando el
tope duro de 5 story points por task (≤ 1 día), la aritmética de este contrato no entra en 16
tasks sin violar ese tope o sin dejar afuera del `files[]` alguno de los 22 archivos exigidos.
Se prefirió excederse en cantidad de tasks antes que romper el tope de tamaño o inflar una task
con dos responsabilidades no verificables juntas.

---

## Orden de ejecución y por qué

El ciclo tiene tres bloques estrictamente serializados. Dentro de cada bloque hay tasks que en
teoría son independientes entre sí (podrían asignarse a implementadores distintos), pero como el
ciclo tiene **un solo implementador reanudado task tras task**, el orden real de ejecución es
simplemente el orden de los IDs; `depends_on` documenta cuáles son dependencias de código reales
(las que importan un símbolo de otra task) y cuáles son solo orden recomendado.

```
Bloque A — infraestructura compartida (nada de esto es un endpoint)
  TASK-001 (config + reexports auto-montage)
    → TASK-002 (puerto ObjectStorage, tipos de transporte, fixtures)
    → TASK-003 (helpers puros de validación: slug, rol, paths)
    → TASK-004 (superficie de errores ampliada)
        → TASK-005 (traducción de errores de auto-montage)
    → TASK-006 (router con parámetros y comodín)
    → TASK-007 (body JSON, Range, content-type)
    → TASK-008 (catalog-merge)
        → TASK-009 (project-assets + serialize-by-key)
    → TASK-010 (adaptador de producción fs, confinado)
    → TASK-011 (health-handler: capabilities.assetStore)

Bloque B — handlers de endpoint (consumen todo el Bloque A)
  TASK-012 (projects-handler: list, create, detail)
  TASK-013 (assets-handler: listar)
    → TASK-014 (assets-handler: subir — completa el mismo archivo)
  TASK-015 (montage-handler: timeline + edl)
  TASK-016 (artifact-handler: descarga + Range)

Bloque C — integración final (exige TODO el Bloque B ya wireado)
  TASK-017 (handle-request: switch exhaustivo sobre las 11 rutas)
    → TASK-018 (create-render-api-server: streaming con backpressure)
    → TASK-019 (main.ts: wiring de readStoreConfig)
    → TASK-020 (README + sdd/api.json)
```

**Por qué el Bloque A va completo antes que cualquier handler.** El brief lo exige
explícitamente, y el contrato lo confirma: ningún handler puede escribirse sin que `ObjectStorage`
(TASK-002), las validaciones puras (TASK-003), la superficie de errores (TASK-004/005), el router
(TASK-006), las utilidades de body/bytes (TASK-007) y las funciones de dominio (TASK-008/009)
existan. `TASK-001` es la primera de todas porque sin el diff de `vite.config.ts` (§10.1) Vitest
no resuelve `@video-maker/auto-montage` — un fallo silencioso que sólo aparece al correr tests, no
al lintear ni compilar — y sin los re-exports de `libs/auto-montage/src/index.ts` (§10.2)
`discoverAssets` y los helpers de `project-paths` no son importables desde `render-api` en
absoluto.

**Por qué `TASK-017` (handle-request) va después de TODOS los handlers, no antes.** Este es el
hallazgo de secuencia más importante del ciclo. El contrato (§5.4) exige que `handleRequest` sea
un `switch (match.id)` **exhaustivo** con `satisfies never` en el `default`: el compilador falla
si `ROUTES` tiene una ruta sin handler. Eso significa que `handle-request.ts` **no compila** hasta
que las cinco funciones de handler (`health`, `projects`, `assets`, `montage`, `artifact`) ya
existan. Un plan que pusiera `handle-request` temprano y los handlers "rellenando" después
produciría una task inicial que no puede pasar `build` verde. Por la misma razón, `TASK-018`
(`create-render-api-server`) va después de `TASK-017`: su test de integración (CA-015, "streams a
byte response over a real loopback socket honouring a Range request") ejercita el servidor real
con `handleRequest` ya wireado a las 11 rutas — sin eso el test no tiene qué invocar.

**Por qué `assets-handler` se parte en dos tasks (TASK-013 + TASK-014) sobre el mismo archivo.**
El brief lo pide explícitamente: `assets-handler.ts` concentra 18 pasos en el flujo de upload
(§4.5), demasiado para una sola task verificable de un día. Se partió por responsabilidad (listar
vs. subir), no por mitad de archivo. **Nota de trazabilidad sobre `files[]`:** ambas tasks tocan
`apps/render-api/src/http/handlers/assets-handler.ts`, pero `assets-handler.spec.ts` sólo
aparece en el `files[]` de `TASK-014` — es donde el archivo alcanza su estado final con las filas
de test de §11.1 para `handleListAssets` **y** `handleUploadAsset` (la regla "un archivo de test,
una sola task" se cumple sobre el archivo *completo*; `TASK-013` deja escritos los tests de
listado dentro del mismo archivo, pero el cierre formal del checklist queda en `TASK-014`, que es
la que lo deja en su forma definitiva). Se documenta acá para que el reviewer no lo lea como un
archivo faltante en `TASK-013`.

---

## Tasks — detalle, HU/CA cubiertas y criterio de done

Convención: `pnpm nx run-many -t lint test build` en verde con `render-api` en la corrida es
criterio de done implícito en **todas** las tasks; sólo se listan los criterios específicos.

### Bloque A — infraestructura compartida

**TASK-001 — Config compartida (vite.config.ts, re-exports de auto-montage, store-config)**
HU-02-01 · Sin CA propio (es el prerequisito de CA-017 y de todo lo demás).
Archivos: `apps/render-api/vite.config.ts`, `libs/auto-montage/src/index.ts`,
`src/config/store-config.ts(+spec)`.
Done: los 4 tests de `store-config.spec.ts` (§11.1) en verde; `Vitest` resuelve
`@video-maker/auto-montage` en cualquier spec de `render-api`; el diff de §10.2 no reexporta el
`ProjectRelativePath` local de `project-paths.ts` (colisión advertida en la nota del architect).

**TASK-002 — Puerto ObjectStorage, tipos de transporte y fixtures compartidas**
HU-02-05, HU-02-09.
Archivos: `deps/object-storage.ts`, `http/http-message.ts`, `deps/render-api-dependencies.ts`,
`__fixtures__/fake-object-storage.ts`, `__fixtures__/fake-render-api-dependencies.ts`,
`__fixtures__/http-request.ts`.
Done: `fake-object-storage.ts` implementa las 9 operaciones y registra cada una en el `callLog` de
`cycle-01` §9.3, con `statQueue`/`writeOutcome`/`readTextFileError` programables (§11.3).

**TASK-003 — Helpers puros de validación (slug, rol, paths)**
HU-02-03, HU-02-05, HU-02-09 · CA-010.
Archivos: `store/project-slug.ts(+spec)`, `store/asset-path.ts(+spec)`,
`store/project-layout.ts(+spec)`.
Done: las 5 filas de CA-010 en §11.1 sobre estos tres archivos en verde.

**TASK-004 — Superficie de errores ampliada (35 códigos, details, status HTTP)**
HU-02-11 · CA-016.
Archivos: `errors/render-api-error.ts`, `errors/pipeline-stage-error.ts`,
`errors/http-status-for.ts(+spec)`, `errors/to-error-payload.ts(+spec)`,
`errors/translate-engine-error.ts`.
Done: `http-status-for.spec.ts` cubre las 35 filas de `RENDER_API_ERROR_CODES`; `to-error-payload`
nunca emite ruta absoluta ni `.stack`; `assetPersisted`/`catalogUpdated` se spreadean al tope del
payload y se omiten cuando `details` es `null`.

**TASK-005 — Traducción de errores de `libs/auto-montage`**
HU-02-11 · CA-016.
Archivos: `errors/translate-store-error.ts(+spec)`.
Done: las 7 filas de la tabla §6.4 más el fallback a `INTERNAL_ERROR`.

**TASK-006 — Router con parámetros y comodín (11 rutas)**
HU-02-05, HU-02-09 · CA-017.
Archivos: `http/routes.ts`, `http/router.ts(+spec)`.
Done: los 3 tests vigentes de `cycle-01` (`router.spec.ts`) **no se tocan** y siguen pasando
(DT-4); se agregan los 6 casos nuevos de §11.1 (params del upload, comodín de `files`,
percent-decode, segmento vacío, `method-not-allowed` con params, colisión de patrones).

**TASK-007 — Body JSON, parseo de Range y content-type por extensión**
HU-02-03, HU-02-09 · CA-015, CA-017.
Archivos: `http/read-json-body.ts(+spec)`, `http/byte-range.ts(+spec)`,
`http/content-type-for.ts(+spec)`.
Done: `byte-range.spec.ts` cubre las 11 filas de §7.2; `content-type-for.spec.ts` cubre las 17
filas de §7.1 más el fallback.

**TASK-008 — Fusión de catálogo tras un upload (catalog-merge)**
HU-02-06 · CA-012, CA-013.
Archivos: `store/catalog-merge.ts(+spec)`, `__fixtures__/catalog-fixtures.ts`.
Done: orden ascendente por `asset.id` con un fixture que **no** queda ordenado por simple append
(regla explícita del architect); el resultado siempre pasa `CatalogSchema.parse`;
`mergeProbeFailure` nunca persiste `error.message` de la lib (DT-8).

**TASK-009 — Resolución de assets del proyecto + serialización por clave**
HU-02-02, HU-02-04 · CA-017.
Archivos: `store/project-assets.ts(+spec)`, `store/serialize-by-key.ts(+spec)`.
Done: `resolveProjectAssets` nunca cae a raw-scan si el catálogo existe y está roto (RN-4);
`createKeyedSerializer` corre dos operaciones de la misma clave en orden y de distinta clave en
paralelo.

**TASK-010 — Adaptador de producción del ObjectStorage confinado a la raíz de medios**
HU-02-05, HU-02-09 · CA-010, CA-011.
Archivos: `deps/node-render-api-dependencies.ts(+spec)`.
Done: `assertInsideMediaRoot` verificado contra un directorio temporal real (§3.6); el temporal
del upload vive en `work/.uploads/` y `promoteTemporary` es un solo `rename` (CA-011).

**TASK-011 — `GET /health` declara `capabilities.assetStore` y `cycle: 2`**
HU-02-10 · CA-018.
Archivos: `http/health-handler.ts(+spec)`.
Done: `assetStore: true` en los dos estados (`ok` y `degraded`) — el store no participa del
cálculo de `status`.

### Bloque B — handlers de endpoint

**TASK-012 — Handlers de proyectos (listar, crear, detalle)**
HU-02-01, HU-02-02, HU-02-03 · CA-010, CA-017.
Archivos: `http/handlers/projects-handler.ts(+spec)`.
Done: `POST /projects` crea los 6 directorios en el orden exacto del §4.2 (verificable sobre el
`callLog`); slug inválido no invoca ningún puerto (CA-010).

**TASK-013 — Handler de listado de assets del proyecto**
HU-02-04 · CA-017.
Archivos: `http/handlers/assets-handler.ts` (creación del archivo; los tests de esta
responsabilidad se escriben acá pero el `files[]` de test se cierra formalmente en TASK-014, ver
nota de la sección anterior).
Done: `source: "catalog"` y `source: "raw-scan"` correctos; `500 CATALOG_UNREADABLE` nunca cae al
raw-scan (RN-4); `500 PROJECT_LAYOUT_INVALID` cuando falta `raw/`.

**TASK-014 — Handler de subida de asset (upload binario + catálogo consistente)**
HU-02-05, HU-02-06 · CA-010, CA-011, CA-012, CA-013, CA-017.
Archivos: `http/handlers/assets-handler.ts`, `http/handlers/assets-handler.spec.ts`.
Done: la secuencia de 18 pasos del §4.5 completa; los 4 escenarios de CA-011 (`writeTemporary` →
`promoteTemporary`, límite excedido, stream cortado, carrera con `ASSET_ALREADY_EXISTS`); el
probe fallido deja el archivo, agrega `probeFailures` y responde con `assetPersisted: true,
catalogUpdated: true` (RN-8).

**TASK-015 — Handlers de Timeline y EditDecisionList (GET/PUT)**
HU-02-07, HU-02-08 · CA-014.
Archivos: `http/handlers/montage-handler.ts(+spec)`, `__fixtures__/minimal-edit-decision-list.ts`.
Done: los bytes escritos son **exactamente** los que produce `writeTimeline`/
`writeEditDecisionList` de `auto-montage` (comparación byte a byte, no de objeto — D-16); un
documento inválido no escribe nada (`callLog` sin `writeTextFile` ni `ensureDirectory`).

**TASK-016 — Handler de descarga de artefactos con soporte de Range**
HU-02-09 · CA-015.
Archivos: `http/handlers/artifact-handler.ts(+spec)`.
Done: 200/206/416 correctos; un `Range` malformado o multi-rango se ignora y sirve 200 completo
(RN-11, no es un error); `ASSET_PATH_INVALID` para rutas fuera de `raw/work/out` **antes** de
tocar el filesystem.

### Bloque C — integración final

**TASK-017 — Dispatch exhaustivo de las 11 rutas en handle-request**
Transversal (HU-02-01, HU-02-05, HU-02-09 como representativas) · CA-017.
Archivos: `http/handle-request.ts(+spec)`.
Done: `handle-request.spec.ts` recorre `ROUTES` y verifica que ninguna ruta cae en 404; el
`switch` es exhaustivo (si se agrega una ruta sin handler, `tsc` falla).

**TASK-018 — Streaming con backpressure en create-render-api-server**
HU-02-09 · CA-015.
Archivos: `http/create-render-api-server.ts(+spec)`.
Done: el test de socket loopback real transmite una respuesta de bytes honrando `Range` (única
prueba de integración de bytes con el proceso real de Node, no con dobles).

**TASK-019 — Wiring de main.ts con readStoreConfig**
HU-02-01 · CA-017 (parte del guion de verificación real, §13).
Archivos: `main.ts`.
Done: `main.ts` llama `readStoreConfig(process.env, process.cwd())` y lo pasa a
`createNodeRenderApiDependencies` y a `handleRequest`; sigue siendo el único archivo que toca
`process` (invariante del árbol §9).

**TASK-020 — README del subproyecto y actualización de sdd/api.json**
HU-02-12 · CA-020.
Archivos: `apps/render-api/README.md`, `sdd/api.json`.
Done: los 10 endpoints nuevos documentados (método, path, propósito), `RENDER_API_MEDIA_ROOT`,
`RENDER_API_MAX_UPLOAD_BYTES`, `RENDER_API_OBJECT_STORE`, la decisión D-11, y el guion completo y
copiable de §13; `EP-002`..`EP-011` pasan de `defined` a `implemented` en `sdd/api.json`, `EP-001`
pasa a `updated` con su changelog (`capabilities.assetStore`, `cycle: 2`).

---

## Riesgos de secuencia detectados

1. **`handle-request.ts` no compila hasta que los cinco handlers existen** (switch exhaustivo con
   `satisfies never`, §5.4). Ya está reflejado en `depends_on` de `TASK-017`; se documenta acá
   porque es el riesgo de secuencia más fácil de romper si alguien reordena tasks manualmente.
2. **`assets-handler.spec.ts` compartido entre TASK-013 y TASK-014.** Ver nota de trazabilidad más
   arriba — no es un archivo faltante, es una decisión deliberada de a qué task se le atribuye el
   cierre del checklist de §11.1.
3. **`create-render-api-server.spec.ts` (CA-015, test de socket real) depende de `TASK-017`, no
   sólo de `TASK-002`.** Antes de que las 11 rutas estén wireadas en `handle-request`, ese test no
   tiene una ruta real de descarga que ejercitar sobre el socket loopback.
4. **Ningún hueco de contrato detectado.** El architect.md cierra explícitamente firmas, secuencia
   de pasos, tabla de errores, `Range`, content-type y el árbol de archivos; no hubo que resolver
   ninguna ambigüedad por cuenta propia de este documento. Los tres riesgos ya abiertos por el
   propio architect (§16: atomicidad de `rename` entre filesystems, serialización sólo
   intra-proceso, dependencia de `ENOENT` en `readCatalog`) no generan tasks nuevas — son
   limitaciones conocidas del diseño, no trabajo pendiente de este ciclo.

## Pendiente de documentar en contexto

- **`TASK-002` parcheó provisoriamente dos archivos fuera de su `files[]` original para no dejar
  `pnpm nx run render-api:build` en rojo.** Al ensanchar `RenderApiDependencies` (`storage`,
  `probeAsset`) y `HttpRequestLine` (`headers`, `body`), sus dos únicos productores reales
  (`src/deps/node-render-api-dependencies.ts`, `src/http/create-render-api-server.ts`) dejaban de
  compilar hasta que `TASK-010`/`TASK-018` los tocaran. Decisión del orquestador: adelantar un
  parche mínimo ahora (agregado al `files[]` de `TASK-002`) en vez de tolerar el rojo. El
  `createNodeObjectStorage()` de `node-render-api-dependencies.ts` es una implementación simple sin
  confinamiento a la raíz de medios (bufferea `writeTemporary` en memoria en vez de contar bytes en
  streaming) — **provisoria, `TASK-010` la reemplaza entera** por el adaptador confinado de §3.6.
  `toRequestLine`/`toHeaders` de `create-render-api-server.ts` sólo completan `headers`/`body`;
  el streaming con backpressure de la respuesta (`writeResponse` sobre `response.stream`) sigue
  siendo `TASK-018` íntegro. Ninguna de las dos task pierde alcance: reemplazan, no heredan, este
  parche.
- **`TASK-010` reemplazó entero el `createNodeObjectStorage()` provisorio de `TASK-002`** por el
  adaptador confinado de §3.6 (`assertInsideMediaRoot`, streaming real con `createWriteStream` +
  `drain`, sin buffer en memoria) y cambió la firma de `createNodeRenderApiDependencies` a
  `(env, store)`. Eso rompía la compilación de `apps/render-api/src/main.ts` (única llamadora real,
  fuera del `files[]` de `TASK-010`), así que se agregó `main.ts` al `files[]` de la task con el
  wiring mínimo (`readStoreConfig(process.env, process.cwd())` pasado como segundo argumento). Esto
  **adelanta el contenido central de `TASK-019`**; cuando esa task se ejecute, el wiring ya va a
  estar hecho y su trabajo se reduce a verificarlo (o a la parte de `README`/`sdd/api.json` que le
  corresponda a `TASK-020`, no a `TASK-019`).
- **`TASK-018` volvió a tocar `main.ts` por la misma razón.** `createRenderApiServer` ahora recibe
  `store: StoreConfig` como tercer parámetro para poder pasárselo a `handleRequest` (que TASK-017
  ya exige como tercer argumento); `main.ts` es la única llamadora real de
  `createRenderApiServer`, así que se agregó al `files[]` de `TASK-018` con el único cambio
  necesario: `createRenderApiServer(deps, config, store)`. Sigue siendo parte del adelanto de
  `TASK-019` documentado arriba, no una desviación nueva.
- **Patrón nuevo: fixtures con un objeto `control` anidado.** `createFakeObjectStorage` devuelve
  el puerto `ObjectStorage` más una propiedad `control` (`queueStat`, `queueWriteOutcome`,
  `queueReadTextFileError`) en vez de mezclar los métodos de control al tope del objeto — evita
  colisión de nombres con las 9 operaciones del puerto y no estaba en ninguna constitution previa.

## Fuera del alcance de este planner (recordatorio)

La verificación por ejecución real del proceso (§13 del architect, CA-017 "proceso") **no es una
task**: la corre el orquestador al cerrar el ciclo, contra un `apps/render-api` ya buildeado con
las 20 tasks anteriores completas. Tampoco son tasks: cola de jobs / `POST /jobs` (cycle-03),
adaptador MinIO (D-11), `apps/render-api/eslint.config.mjs` (D-9), ni ninguna dependencia npm
nueva (D-2/RNF-7).
