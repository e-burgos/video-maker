# spec-e-burgos-005-render-service cycle-02 — 2026-09-08

## Estado

- `apps/render-api` deja de ser un servicio de un solo endpoint: expone el **store de medios sobre
  `media/`** por HTTP con 10 endpoints nuevos (`EP-002`..`EP-011`) más `GET /health` ampliado
  (`EP-001`: `capabilities.assetStore: true`, `cycle: 2`). El store **nunca** entra en el cálculo
  `ok`/`degraded` de health.
- Verificado por **ejecución real del proceso** contra el binario (no vía `nx run`, que normaliza
  todo fallo a `1`): raíz vacía ⇒ `200 []`, creación de layout ⇒ `201`, upload binario real con
  `rename` atómico y catálogo consistente en la misma request, `PUT`/`GET` de `Timeline`,
  descarga completa `200`, `206` con `Range: bytes=0-999` (1000 bytes) y `416` ante rango
  insatisfacible, `SIGTERM` ⇒ `exit 0`, y `exit 78` ante `RENDER_API_MAX_UPLOAD_BYTES=0` y
  `RENDER_API_OBJECT_STORE=minio`. El `diff` del `work/timeline.json` escrito por la API contra el
  de `tools/render-cli` da **bytes idénticos** (D-16).
- `resuelve: updates/…cycle-01.md § Qué sigue ("ahí se reintroduce el projectRoot del adaptador")` —
  se reintrodujo, pero **no** como `projectRoot`: `createNodeRenderApiDependencies(env, store)`
  recibe el `StoreConfig` completo (`mediaRoot`, `maxUploadBytes`, `objectStore`), que es lo que el
  adaptador necesita para confinar el I/O.
- `resuelve: updates/…cycle-01.md § Estructura ("context_prompt.md declara dependencia de
  @video-maker/auto-montage; en cycle-01 no se importa")` — en `cycle-02` **sí** se importa, y es la
  dependencia de workspace central del ciclo.
- **MinIO queda descopado con fundamento (D-11)**: el puerto `ObjectStorage` existe con un único
  adaptador `fs`; `RENDER_API_OBJECT_STORE` acepta sólo `fs` y aborta el arranque con
  `SERVER_CONFIG_INVALID` (exit 78) ante cualquier otro valor. La `description` del módulo en
  `sdd/global.json` todavía dice "assets crudos en MinIO": es el texto original de la spec, no el
  estado real.
- Suite: **27 archivos / 215 tests**, cobertura **96,59 % stmts · 88,88 % branch · 98,34 % funcs ·
  96,53 % lines** con el `coverage.include` de `cycle-01` **sin recortar** (umbral 80 %).

## Estructura

```
src/
  config/store-config.ts        readStoreConfig(env, cwd) -> StoreConfig
  deps/object-storage.ts        puerto ObjectStorage (9 operaciones, sólo tipos)
  errors/translate-store-error.ts  AutoMontageError -> código propio, estructural por .code
  http/read-json-body.ts        body JSON acotado por bytes sobre un AsyncIterable
  http/byte-range.ts            parseByteRange(header, size): absent|ignored|satisfiable|unsatisfiable
  http/content-type-for.ts      tabla cerrada extensión -> content-type, cero dependencias
  http/handlers/                projects · assets · montage (timeline+edl) · artifact
  store/                        project-slug · asset-path · project-layout · catalog-merge ·
                                project-assets · serialize-by-key
```

- **El árbol coincide fila por fila con `architect.md` §9**: 34 archivos nuevos, 22 modificados,
  ninguno fuera del árbol.
- **Puertos nuevos (dos):** `ObjectStorage` (único puerto de filesystem del store: `stat`,
  `listDirectory`, `ensureDirectory`, `readTextFile`, `writeTextFile`, `readFileRange`,
  `writeTemporary`, `promoteTemporary`, `removeTemporary`) y `probeAsset` (único puerto que toca
  ffprobe). El adaptador los confina a `mediaRoot`: toda ruta que se escape es `ASSET_PATH_INVALID`.
- **Router con parámetros y comodín**: `:slug`, `:role`, `:filename` y `*path`, con percent-decode
  de cada param y `not-found` ante un param indecodificable o un segmento vacío. Un test recorre
  `ROUTES` y verifica que dos patrones nunca matcheen el mismo path concreto.
- **Superficie de errores: 15 → 35 códigos**, `stage: RenderPipelineStage | null` (los 20 nuevos son
  `stage: null` porque no pertenecen al pipeline de render), y el payload admite
  `assetPersisted`/`catalogUpdated` en el nivel superior.
- **Upload atómico (`PUT` de asset)**: validación pura completa **antes del primer puerto**, luego
  `writeTemporary` en `work/.uploads/` → `stat` → `promoteTemporary` (rename). Un fallo de
  `probeAsset` **no** borra el archivo: registra la falla en `catalog.probeFailures` con el mensaje
  **estático en inglés** del código propio, nunca `error.message` de la lib (que lleva la ruta
  absoluta del binario).
- **`AssetListEntry` es la única forma de un asset en la API**: `toAssetListEntry` (en
  `store/project-assets.ts`) la produce tanto para `GET .../assets` como para el `201` del upload.
- **Estado global conocido**: `uploadSerializer = createKeyedSerializer()` es un **singleton a nivel
  de módulo** en `http/handlers/assets-handler.ts`. Serializa los pasos 8..17 del upload por slug
  (DT-10), que es la semántica buscada, pero no se resetea entre tests ni se inyecta por
  dependencia. Deuda registrada, no bloqueante.
- **Invariantes que siguen en pie** (verificados por grep al cerrar, con `node:crypto` sumado):
  `process.`, `console.`, `node:fs` y `node:crypto` sólo aparecen en `src/main.ts` y
  `src/deps/node-render-api-dependencies(.spec).ts`. **Cero comentarios** en todo el código nuevo.

## Dependencias

- **Cero dependencias npm nuevas.** `git diff --stat package.json pnpm-lock.yaml` vacío en todo el
  ciclo (CA-009, D-2, RNF-7). El content-type se resuelve con un `Record` propio: sin `mime-db` ni
  `mime-types`.
- **Nueva dependencia de workspace: `@video-maker/auto-montage`** — `resolveMediaProject`,
  `CatalogSchema`/`Catalog`, `TimelineSchema`, `EditDecisionListSchema`, `readCatalog`/`writeCatalog`,
  `writeTimeline`/`writeEditDecisionList`, `discoverAssets`, las utilidades de `project-paths` y la
  jerarquía `AutoMontageError`.
- `libs/auto-montage/src/index.ts` suma re-exports **aditivos** (DT-1): `project-paths`
  (8 símbolos) y `discoverAssets` + sus tipos. No se re-exporta el alias local
  `ProjectRelativePath` de `project-paths` — colisiona con el del schema en el barrel.
- El alias `@video-maker/auto-montage` hay que declararlo en **cuatro** resolvedores, no tres:
  `tsconfig.base.json → paths` (tsc), `resolve.alias` del `vite.config.ts` de `render-api`
  (Vitest, agregado este ciclo), `webpackOverride` de Remotion, y **`SWC_NODE_PROJECT=tsconfig.base.json`
  en toda invocación directa del binario** (`node -r ./src/server-register.cjs src/main.ts`). Sin la
  cuarta el proceso ni arranca, y `lint`/`test`/`build` verdes no lo detectan.
- Variables de entorno nuevas: `RENDER_API_MEDIA_ROOT` (default `media` resuelto contra `cwd`),
  `RENDER_API_MAX_UPLOAD_BYTES` (default 2 GiB, entero positivo) y `RENDER_API_OBJECT_STORE`
  (sólo `fs`). Las tres abortan el arranque con exit 78 ante un valor inválido.

## Qué sigue

- **`architect.md` §13 quedó con el guion de verificación sin `SWC_NODE_PROJECT`** y por eso no
  arranca copiado tal cual. El documento está cerrado y no se reescribe: la **versión correcta y
  copiable es la del `apps/render-api/README.md` § "Real-process verification (CA-017)"**. Cualquier
  ciclo futuro que copie un guion de ejecución directa lo toma del README, no del architect.
- **El store no es seguro entre procesos.** `createKeyedSerializer` serializa por slug dentro de
  **un** proceso; dos instancias de `render-api` sobre el mismo `media/` se pisan el
  `work/catalog.json`. Documentado en el README ("Known risk"); si `cycle-03` corre workers en
  procesos separados, hace falta un lock real.
- **`apps/render-api/eslint.config.mjs` sigue sin existir** (D-9). El bloque propuesto acumula ya
  **tres** correcciones (`architect.md` §14): sumar `node-render-api-dependencies.spec.ts` a los
  `ignores` y `node:crypto` al grupo restringido. Mientras no exista, el invariante se sostiene con
  el grep del reviewer.
- **`cycle-03` cierra la spec**: cola de jobs, progreso, cancelación, el endpoint que dispara
  `runRenderPipeline` (implementado desde `cycle-01` y todavía **sin ninguna ruta HTTP que lo
  dispare**) y el smoke E2E con binarios reales. Sigue sin verificarse que el bundle webpack de
  Remotion **bundlee** (health sólo prueba que el módulo carga).
- **Deuda a decidir en `cycle-03`**: mover `uploadSerializer` a `RenderApiDependencies` (o a un
  factory por servidor) para eliminar el estado global de módulo.
