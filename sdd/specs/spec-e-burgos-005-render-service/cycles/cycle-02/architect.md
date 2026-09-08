# Architect — Cycle 02: `asset-store-and-project-persistence` (`render-service`)

> **Input:** `brief.yaml`, `functional.md`, `spec-e-burgos-005-render-service.spec.md`,
> `cycles/cycle-01/architect.md`, `sdd/context/apps/render-api/` (base + `updates/`), y el código
> real de `apps/render-api/src/**`, `libs/auto-montage/src/**` y `libs/media-local/src/ffprobe/`.
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/architect.md`
> **Generado por:** sdd-architect (claude-opus, effort high)
> **Regla que gobierna este documento:** cierra todas las firmas. El Planner escribe después y el
> implementador no toma ninguna decisión de diseño: si algo no está acá, se escala, no se inventa.
> **Relación con `cycle-01/architect.md`:** este documento **extiende**, no repite. Donde el
> contrato vigente ya cierra algo (tipos de transporte §6.1, router §6.3, payload de error §5.3,
> configuración del proyecto §7, `eslint.config.mjs` §8.2, registro de llamadas §9.3) se **cita la
> sección** y sólo se escribe el delta.

---

## 1. Alcance del contrato

### 1.1 Qué cierra este documento

1. Los **10 endpoints nuevos** (§4), con request, response por status y lista cerrada de códigos de
   error por endpoint, más la ampliación de `EP-001` (§4.10).
2. Los **puertos nuevos** que se suman a `RenderApiDependencies`: `ObjectStorage` (8 operaciones) y
   `probeAsset` (§3), con la frontera explícita entre puerto y lógica pura.
3. El **router con parámetros y comodín** (§5), preservando `RouteId` tipado y los tests vigentes de
   `router.spec.ts`.
4. La **superficie de errores ampliada** (§6): 20 códigos nuevos sobre los 15 de `cycle-01`, con
   etapa, status HTTP, momento de emisión y campos del payload.
5. La **tabla extensión → content-type** (§7.1) y la semántica exacta de `Range` (§7.2).
6. La **lectura del body** (§8): JSON con tope, binario con streaming, temporal y `rename` atómico.
7. El **árbol de archivos** resultante (§9) y el **diff exacto** de `vite.config.ts` (§10).
8. La **lista cerrada de tests obligatorios por CA** (§11), checklist de cierre del reviewer.
9. Las **decisiones técnicas DT-1..DT-20** (§12) con su alternativa descartada.
10. La verificación por **ejecución real del proceso** de CA-017 (§13).

### 1.2 Qué NO cierra (y no se implementa)

- **Ninguna ruta dispara `runRenderPipeline`.** Sigue sin disparador HTTP al cerrar el ciclo
  (brief `out_of_scope`; `cycle-03`).
- **Ningún `DELETE`.** El store no borra material del dev por HTTP (RN-5; el único borrado del
  ciclo es el del archivo temporal de un upload que no se promovió).
- **`HEAD` no se trata especialmente.** `HEAD` sobre cualquier ruta sigue devolviendo 405 con
  `Allow`, igual que en `cycle-01` §6.3. Se declara como limitación conocida en §12 (DT-19): el
  consumidor previsto (`<video>` + Remotion Player) usa `GET` con `Range`, no `HEAD`.
- **Sin adaptador MinIO** (D-11): el puerto `ObjectStorage` queda con un solo adaptador `fs`.
- **`apps/render-api/eslint.config.mjs` sigue sin existir** (D-9). §14 registra el delta que ese
  archivo necesitaría si el dev decide pegarlo.
- **Sin autenticación, sin multiusuario, sin transcodificación ni thumbnails.**

### 1.3 Schema de datos

`sdd/schema.json` **no cambia**: `apps/render-api` no tiene base de datos. La única persistencia del
ciclo es el filesystem, y su "schema" es el layout de `libs/auto-montage` (`CatalogSchema`,
`TimelineSchema`, `EditDecisionListSchema`), que este ciclo **consume y no redefine** (D-13).

---

## 2. Punto de partida literal y qué se reusa de `libs/auto-montage`

### 2.1 Estado real de `apps/render-api` al abrir el ciclo

Verificado sobre el código, no sobre el plan: 32 archivos `.ts` en `src/`, 9 puertos en
`RenderApiDependencies` (`renderMutedVideo`, `mixTimelineAudio`, `muxAudioIntoVideo`,
`verifyMixLoudness`, `ensureDirectory`, `probeMediaBinaries`, `preloadEngineModules`, más `clock` y
`logger`), 15 códigos en `RENDER_API_ERROR_CODES`, una sola ruta en `ROUTES`
(`{ id: 'health', method: 'GET', path: '/health' }`) y `routeRequest` haciendo match **exacto** por
`route.path === path`. `createNodeRenderApiDependencies(env)` recibe sólo el `env` y **nunca lee el
body del request**: `createRenderApiServer` construye `HttpRequestLine` con `{ method, path }` y
responde siempre `JSON.stringify(response.body)`.

### 2.2 Qué se importa de `@video-maker/auto-montage` (D-13)

| Símbolo | Qué aporta a este ciclo |
| --- | --- |
| `resolveMediaProject(rootPath)` | `MediaProject` (`slug`, `root`, `rawDir`, `workDir`, `outDir`) — la única definición del layout |
| `readCatalog(project, { readTextFile })` | Lectura + validación del catálogo; devuelve `null` ante `ENOENT`, lanza `CatalogUnreadableError` si existe y está roto (RN-4 sale de acá tal cual) |
| `writeCatalog(project, catalog, { writeTextFile, ensureDirectory })` | Escritura validada (`CatalogSchema.parse`) y serialización estable |
| `writeTimeline` / `writeEditDecisionList` | Bytes idénticos a los de la CLI (D-16, CA-014) |
| `discoverAssets(project, { readDirectory, statFile })` | El **raw-scan** de RF-10, con la misma clasificación por directorio y extensión que usa `ingestProject` |
| `CatalogSchema`, `CATALOG_SCHEMA_VERSION`, `AssetRoleSchema`, `ProjectRelativePathSchema` y los tipos | Validación de entrada y de salida |
| `catalogPath()`, `timelinePath()`, `editDecisionListPath()`, `workPath()`, `toAbsolutePath()`, `toProjectRelativePath()` | Resolución de rutas del proyecto sin reimplementar el layout |
| `AutoMontageError` / `isAutoMontageError`, `CatalogUnreadableError`, `ProjectLayoutError`, `PathEscapesProjectError` | Traducción estructural a la superficie propia (§6.4) |

**Bloqueo detectado y su resolución (DT-1).** De esa lista, `libs/auto-montage/src/index.ts` **hoy
no exporta** `discoverAssets` (ni `AssetFinding`) ni ninguno de los helpers de
`src/project/project-paths.ts`. `tsconfig.base.json` mapea un único specifier
(`"@video-maker/auto-montage": ["./libs/auto-montage/src/index.ts"]`), así que un deep-import no
resuelve, y agregar un subpath exigiría tocar `tsconfig.base.json` (config protegida). La única
salida que no toca configs protegidas ni duplica lógica es **ampliar el barrel de la lib** con
re-exports aditivos. Diff exacto en §10.2.

### 2.3 Qué se importa de `@video-maker/media-local` y `@video-maker/timeline-core`

- `probeMedia(path, runner, opts)` + `ExecaCommandRunner` + `resolveBinary('ffprobe', env)` —
  **sólo dentro del adaptador de producción**, vía el `await import()` dinámico ya existente.
- `MediaLocalError` / `isMediaLocalError` — sólo como tipos, para `translateEngineError` (que ya
  traduce estructuralmente por `.code`, sin `instanceof` de la lib: `cycle-01` §5.4).
- `TimelineSchema`, `EditDecisionListSchema`, `MediaAsset` de `@video-maker/timeline-core`.
  `TimelineSchema` y `EditDecisionListSchema` se importan como **valor** (hay que ejecutar
  `safeParse`); ya se usan así en `libs/auto-montage`, y `timeline-core` no arrastra binarios.

---

## 3. Puertos nuevos (RF-15)

### 3.1 `ObjectStorage` — el único puerto de filesystem del store

`src/deps/object-storage.ts` (archivo de tipos, sin runtime):

```ts
export interface StorageEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
}

export interface StorageStat {
  readonly kind: 'file' | 'directory';
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

export interface WriteTemporaryInput {
  readonly directory: string;
  readonly source: AsyncIterable<Uint8Array>;
  readonly expectedBytes: number;
  readonly limitBytes: number;
}

export type WriteTemporaryOutcome =
  | { readonly kind: 'written'; readonly temporaryPath: string; readonly bytesWritten: number }
  | { readonly kind: 'limit-exceeded'; readonly limitBytes: number }
  | { readonly kind: 'aborted' };

export interface ObjectStorage {
  readonly stat: (path: string) => Promise<StorageStat | null>;
  readonly listDirectory: (path: string) => Promise<readonly StorageEntry[] | null>;
  readonly ensureDirectory: (path: string) => Promise<void>;
  readonly readTextFile: (path: string) => Promise<string>;
  readonly writeTextFile: (path: string, contents: string) => Promise<void>;
  readonly openReadStream: (path: string, range?: ByteRange) => AsyncIterable<Uint8Array>;
  readonly writeTemporary: (input: WriteTemporaryInput) => Promise<WriteTemporaryOutcome>;
  readonly promoteTemporary: (temporaryPath: string, finalPath: string) => Promise<void>;
  readonly removeTemporary: (path: string) => Promise<void>;
}
```

Por qué cada operación existe (ninguna es especulativa):

| Operación | Quién la necesita | Por qué no alcanza otra |
| --- | --- | --- |
| `stat` → `StorageStat \| null` | Presencia del proyecto (404), banderas de layout de `GET /projects`, `size` para `content-length`/`Range`, `ASSET_ALREADY_EXISTS` (RN-5), fingerprint del asset subido | Devolver `null` en vez de lanzar `ENOENT` es lo que permite que **"ausente" sea un valor** y no una excepción a re-estrechar en 8 call sites. Todo el ciclo distingue "no existe" de "existe y está roto" (RN-4): esa distinción tiene que estar en el **tipo**. |
| `listDirectory` → `… \| null` | `GET /projects` (RN-1: raíz inexistente ⇒ 200 `[]`), raw-scan de RF-10 | `null` (no existe) ≠ `[]` (existe y está vacío): `GET /projects` colapsa los dos a `200 []`, pero las banderas de layout necesitan distinguirlos. |
| `ensureDirectory` | `POST /projects` (6 directorios), `raw/<dir>` y `work/.uploads/` del upload, y `work/` que exigen `writeCatalog`/`writeTimeline` | Ya existe como puerto suelto en `RenderApiDependencies` para el pipeline; se **duplica dentro de `ObjectStorage`** a propósito (DT-2). |
| `readTextFile` | `readCatalog`, `GET` de `timeline`/`edl` | Firma **estructuralmente idéntica** a `ReadTextFile` de `media-local`: se pasa a `readCatalog` sin adaptador. |
| `writeTextFile` | `writeCatalog`, `writeTimeline`, `writeEditDecisionList` | Idéntica a `WriteTextFile` de `auto-montage`: los tres helpers se cablean directo, y el test de bytes (CA-014) captura exactamente el string que la lib produjo. |
| `openReadStream(path, range?)` | Descarga de artefactos, 200 y 206 | El rango se resuelve **en el adaptador** (`createReadStream(path, { start, end })`): leer el archivo entero para cortar 1 000 bytes de un MP4 de 2 GB es inaceptable y hace inverificable CA-015. |
| `writeTemporary` | Upload (D-14, CA-011) | El contador de bytes sólo existe donde fluyen los bytes. Devuelve un **union de resultado**, no lanza: el mapeo a `ASSET_TOO_LARGE` / `ASSET_UPLOAD_ABORTED` es del handler, no del adaptador (DT-9). El adaptador borra el temporal antes de devolver `limit-exceeded` o `aborted`. |
| `promoteTemporary` | El `rename` atómico | Separado de la escritura para que el handler controle **cuándo** promueve (después de re-verificar el destino) y para que CA-011 se pueda afirmar sobre el orden del `callLog`. |
| `removeTemporary` | Descarte del temporal cuando el destino apareció entre el pre-check y la escritura | `rename(2)` **sobrescribe en silencio** en POSIX: sin este descarte, una carrera pisa material del dev, que es justo lo que RN-5 prohíbe. |

**`exists` no existe**: `stat(path) !== null` lo cubre, y un `exists` aparte invita a un doble
round-trip y a un TOCTOU extra. Tampoco hay ninguna operación de borrado de archivos finales: el
puerto no puede destruir material del dev ni por error de programación.

### 3.2 `probeAsset` — el único puerto que toca ffprobe

```ts
export interface ProbeAssetInput {
  readonly path: string;
  readonly assetId: string;
}

export type ProbeAssetPort = (input: ProbeAssetInput) => Promise<MediaAsset>;
```

- `path` es la ruta de filesystem del archivo recién promovido; `assetId` es la ruta relativa al
  proyecto (`raw/aroll/clip02.mp4`).
- El puerto devuelve el `MediaAsset` **crudo** que produce `probeMedia`. La normalización
  (`asset.id === asset.path === assetId`, invariante que `CatalogAssetSchema` exige) la hace
  **lógica pura** en `src/store/catalog-merge.ts`, no el adaptador (DT-3).

### 3.3 El objeto de dependencias resultante

```ts
export interface RenderApiDependencies {
  readonly renderMutedVideo: RenderMutedVideoPort;
  readonly mixTimelineAudio: MixTimelineAudioPort;
  readonly muxAudioIntoVideo: MuxAudioIntoVideoPort;
  readonly verifyMixLoudness: VerifyMixLoudnessPort;
  readonly ensureDirectory: EnsureDirectoryPort;
  readonly probeMediaBinaries: ProbeMediaBinariesPort;
  readonly preloadEngineModules: PreloadEngineModulesPort;
  readonly storage: ObjectStorage;
  readonly probeAsset: ProbeAssetPort;
  readonly clock: Clock;
  readonly logger: Logger;
}
```

Los siete puertos de `cycle-01` **no cambian de firma**. Se suman `storage` y `probeAsset`.

### 3.4 Frontera puerto / lógica pura

**Todo lo siguiente es puro y se testea sin ningún doble** (funciones que reciben datos y devuelven
datos):

| Módulo puro | Responsabilidad |
| --- | --- |
| `store/project-slug.ts` | `isValidProjectSlug(value)` — RN-2: un solo segmento, kebab-case `^[a-z0-9]+(-[a-z0-9]+)*$`, ni `.` ni `..` |
| `store/asset-path.ts` | `isAssetRole(value)`, `rawDirectoryForRole(role)` (`image` → `images`), `isPortableFileName(value)` (RN-6), `isPortableArtifactPath(value)` (RN-12), `SERVABLE_ROOTS = ['raw','work','out']` |
| `store/project-layout.ts` | `layoutFlagsFrom(stats)` — de 5 `StorageStat \| null` a `{ raw, catalog, timeline, edl, out }` |
| `store/catalog-merge.ts` | `emptyCatalogFor(slug)`, `toCatalogAsset({ asset, assetId, role, fingerprint })`, `mergeUploadedAsset(previous, entry, slug)`, `mergeProbeFailure(previous, failure, slug)` |
| `store/project-assets.ts` (parte pura) | `assetListFromCatalog(catalog)`, `assetListFromFindings(findings)`, `countAssetsByRole(entries)` |
| `store/serialize-by-key.ts` | `createKeyedSerializer()` — cola de promesas por clave (DT-10) |
| `http/read-json-body.ts` | `readJsonBody(source, limitBytes)` sobre un `AsyncIterable` |
| `http/byte-range.ts` | `parseByteRange(header, sizeBytes)` |
| `http/content-type-for.ts` | `contentTypeFor(fileName)` |
| `http/router.ts`, `http/routes.ts` | matching y extracción de params |

**Sólo pasa por puertos**: existencia y listado de directorios, lectura y escritura de archivos,
streaming de bytes, temporal + `rename`, y el probe. Ningún archivo fuera de
`src/deps/node-render-api-dependencies.ts` importa `node:fs`.

### 3.5 Configuración del store

`src/config/store-config.ts` (nuevo; `server-config.ts` **no se toca**, su spec sigue verde):

```ts
export const MEDIA_ROOT_ENV_VAR = 'RENDER_API_MEDIA_ROOT';
export const MAX_UPLOAD_BYTES_ENV_VAR = 'RENDER_API_MAX_UPLOAD_BYTES';
export const OBJECT_STORE_ENV_VAR = 'RENDER_API_OBJECT_STORE';

export const DEFAULT_MEDIA_ROOT = 'media';
export const DEFAULT_MAX_UPLOAD_BYTES = 2_147_483_648;
export const OBJECT_STORE_KINDS = ['fs'] as const;

export type ObjectStoreKind = (typeof OBJECT_STORE_KINDS)[number];

export interface StoreConfig {
  readonly mediaRoot: string;
  readonly maxUploadBytes: number;
  readonly objectStore: ObjectStoreKind;
}

export function readStoreConfig(env: NodeJS.ProcessEnv, cwd: string): StoreConfig;
```

- `mediaRoot`: `RENDER_API_MEDIA_ROOT` (default `media`), resuelto contra `cwd` con
  `node:path/posix` si es relativo. `cwd` **entra como argumento**: `readStoreConfig` no toca
  `process` (frontera única de proceso, `cycle-01` §2.1).
- `maxUploadBytes`: entero > 0; si no, `SERVER_CONFIG_INVALID` con
  `expected: 'a positive integer number of bytes'` → `main.ts` sale con exit 78 por el camino ya
  probado en `cycle-01`.
- `objectStore`: sólo `fs` (D-11); cualquier otro valor es `SERVER_CONFIG_INVALID` con
  `expected: 'fs'`. Es el punto de extensión documentado para un futuro `MinioObjectStorage`.
- `createNodeRenderApiDependencies(env, store)` recibe ahora el `StoreConfig` — es la
  reintroducción del media root que `cycle-01` dejó pendiente, y **tiene un uso real**: el adaptador
  `fs` confina toda operación de `ObjectStorage` dentro de `store.mediaRoot` (§3.6).

### 3.6 Confinamiento en el adaptador (segunda línea de RNF-8)

`createNodeRenderApiDependencies(env, store)` construye el `ObjectStorage` sobre una función privada
`assertInsideMediaRoot(path)` que compara la ruta normalizada contra `store.mediaRoot` y lanza
`PipelineStageError({ code: 'ASSET_PATH_INVALID', stage: null, resource: '<relativa>' })` si sale.
La primera línea de defensa son las validaciones puras de `store/asset-path.ts` **antes** de llamar
a cualquier puerto (CA-010); ésta es la red que atrapa un bug futuro del handler. Se verifica en
`node-render-api-dependencies.spec.ts` contra un directorio temporal real.

---

## 4. Contrato de los endpoints

Convenciones comunes a los 10:

- **Respuesta de error**: siempre el sobre de `cycle-01` §5.3 —
  `{ "error": { "code", "stage", "message", "resource"?, "expected"?, "hint"?, "assetPersisted"?, "catalogUpdated"? } }`
  con `content-type: application/json; charset=utf-8`. `stage` es `null` en **todos** los códigos
  nuevos (§6.2).
- **Sin rutas absolutas**: todo `resource` es un slug, una ruta relativa al proyecto o un nombre de
  header/variable (RNF-6/RNF-8).
- **404 `ROUTE_NOT_FOUND` / 405 `METHOD_NOT_ALLOWED`** siguen siendo del router (`cycle-01` §6.3) y
  aplican a todas las rutas nuevas; no se repiten en cada tabla.
- **500 `INTERNAL_ERROR`** es el fallback del manejador central para cualquier valor fuera de la
  jerarquía propia; aplica a los 10 endpoints y no se repite.
- Todo endpoint con `:slug` valida el slug (RN-2) **antes** de tocar el filesystem y luego resuelve
  la existencia del proyecto con un solo `stat`.

### 4.1 `GET /projects` — listar proyectos (EP-002)

**Request:** sin path params, sin headers requeridos, sin body.

**200** — body: array JSON ordenado ascendentemente por `slug`.

```json
[
  {
    "slug": "smoke-ingest",
    "layout": { "raw": true, "catalog": true, "timeline": true, "edl": false, "out": true }
  }
]
```

```ts
export interface ProjectLayoutFlags {
  readonly raw: boolean;
  readonly catalog: boolean;
  readonly timeline: boolean;
  readonly edl: boolean;
  readonly out: boolean;
}

export interface ProjectSummary {
  readonly slug: string;
  readonly layout: ProjectLayoutFlags;
}
```

Reglas:

- Entradas consideradas: sólo `isDirectory === true` cuyo nombre pase `isValidProjectSlug` — un
  archivo suelto o un directorio con nombre no portable bajo la raíz **se ignora en silencio**, no
  rompe el listado.
- `listDirectory(mediaRoot) === null` (raíz inexistente) ⇒ `200 []` (RN-1). Ídem `[]`.
- `layout.raw` y `layout.out` son `stat(...).kind === 'directory'`; `catalog`, `timeline` y `edl`
  son `stat(...).kind === 'file'` sobre `work/catalog.json`, `work/timeline.json`, `work/edl.json`.

**Errores:** ninguno propio. (Un error de I/O real del puerto cae en `INTERNAL_ERROR`.)

### 4.2 `POST /projects` — crear proyecto (EP-003)

**Request:** body JSON `{ "slug": "proyecto-nuevo" }`. `content-type` **no** es obligatorio
(DT-12); claves desconocidas se ignoran; tope de body: `MAX_JSON_BODY_BYTES` (§8.1).

**201** — headers `content-type: application/json; charset=utf-8` y `location: /projects/<slug>`.
Body: el mismo `ProjectDetail` de §4.3, con `layout.catalog/timeline/edl` en `false` y
`assetCounts` en cero (RN-9).

Efecto: `ensureDirectory` × 6, en este orden exacto (verificable sobre el `callLog`):
`raw/aroll`, `raw/broll`, `raw/images`, `raw/audio`, `work`, `out`.
`raw/` y la raíz de medios se materializan como padres de esos `mkdir -p`.

**Errores:**

| Status | Código | Cuándo |
| --- | --- | --- |
| 400 | `REQUEST_BODY_INVALID_JSON` | El body no parsea como JSON, o no es un objeto, o `slug` no es string |
| 413 | `REQUEST_BODY_TOO_LARGE` | El body supera `MAX_JSON_BODY_BYTES` |
| 422 | `PROJECT_SLUG_INVALID` | `slug` no cumple RN-2. **Ningún puerto fue invocado** (CA-010) |
| 409 | `PROJECT_ALREADY_EXISTS` | `stat(mediaRoot/<slug>)` no es `null` (RN-3). El proyecto existente no se toca |

### 4.3 `GET /projects/:slug` — detalle de proyecto (EP-004)

**200:**

```json
{
  "slug": "smoke-ingest",
  "layout": { "raw": true, "catalog": true, "timeline": true, "edl": false, "out": true },
  "assetSource": "catalog",
  "assetCounts": { "aroll": 1, "broll": 1, "image": 0, "audio": 1 }
}
```

```ts
export interface ProjectDetail extends ProjectSummary {
  readonly assetSource: 'catalog' | 'raw-scan';
  readonly assetCounts: Readonly<Record<AssetRole, number>>;
}
```

`assetCounts` y `assetSource` salen de **la misma función** que sirve `GET .../assets`
(`resolveProjectAssets`), así que la regla de fuente de verdad de HU-02-02 y HU-02-04 es una sola
implementación (RN-4). `assetCounts` declara siempre las cuatro claves, con `0` donde no hay nada.

**Errores:** `404 PROJECT_NOT_FOUND` · `422 PROJECT_SLUG_INVALID` · `500 CATALOG_UNREADABLE` ·
`500 PROJECT_LAYOUT_INVALID`.

### 4.4 `GET /projects/:slug/assets` — listar assets (EP-005)

**200:**

```json
{
  "slug": "smoke-ingest",
  "source": "catalog",
  "assets": [
    {
      "path": "raw/aroll/clip01.mp4",
      "role": "aroll",
      "fingerprint": { "sizeBytes": 10485760, "modifiedAtMs": 1757289600000 },
      "media": { "id": "raw/aroll/clip01.mp4", "kind": "video", "path": "raw/aroll/clip01.mp4", "durationMs": 12000, "fps": 30, "width": 1080, "height": 1920, "hasAudio": true, "probedAt": "2026-09-08T00:00:00.000Z" }
    }
  ],
  "probeFailures": [{ "path": "raw/audio/bad.wav", "errorCode": "COMMAND_FAILED" }]
}
```

```ts
export interface AssetListEntry {
  readonly path: ProjectRelativePath;
  readonly role: AssetRole;
  readonly fingerprint: AssetFingerprint;
  readonly media: MediaAsset | null;
}

export interface AssetListBody {
  readonly slug: string;
  readonly source: 'catalog' | 'raw-scan';
  readonly assets: readonly AssetListEntry[];
  readonly probeFailures: readonly { readonly path: ProjectRelativePath; readonly errorCode: ProbeFailure['errorCode'] }[];
}
```

Reglas:

- **`source: "catalog"`** cuando `stat(work/catalog.json)` es un archivo y `readCatalog` devuelve un
  catálogo. `assets` es exactamente `catalog.assets` proyectado a `AssetListEntry`
  (`media = entry.asset`), en el orden del catálogo (ascendente por `asset.id`, invariante que
  `CatalogSchema` ya garantiza).
- **`source: "raw-scan"`** cuando `stat(work/catalog.json)` es `null` (o `readCatalog` devuelve
  `null` por una carrera). `assets` viene de `discoverAssets`, con **`media: null`**: el raw-scan
  **no sondea nada** ni escribe nada (RF-10). `probeFailures` es `[]`.
- **`500 CATALOG_UNREADABLE`** si el catálogo existe pero `readCatalog` lanza
  `CatalogUnreadableError` (JSON inválido, no valida, `schemaVersion` distinto, o `projectSlug`
  distinto del directorio). **Nunca** se cae al raw-scan en ese caso (RN-4).
- `probeFailures` del payload lleva **`path` y `errorCode`, nunca `message`**: el `message` del
  catálogo puede contener el comando completo con la ruta absoluta del binario (RNF-6/8).
- `500 PROJECT_LAYOUT_INVALID` si hay que hacer raw-scan y `stat(raw/)` es `null`: el directorio
  existe bajo la raíz de medios pero no es un proyecto.

**Errores:** `404 PROJECT_NOT_FOUND` · `422 PROJECT_SLUG_INVALID` · `500 CATALOG_UNREADABLE` ·
`500 PROJECT_LAYOUT_INVALID`.

### 4.5 `PUT /projects/:slug/assets/:role/:filename` — subir asset (EP-006)

**Request:** body **binario crudo** (D-14, nunca multipart).
Headers obligatorios: `content-length` y `content-type`.
Path params: `:role` ∈ `aroll | broll | image | audio`; `:filename` un solo segmento portable.
Destino: `raw/<rawDirectoryForRole(role)>/<filename>` — nótese `image` → `raw/images/`.

**Secuencia exacta** (el orden es contrato; CA-010 y CA-011 se afirman sobre el `callLog`):

| # | Paso | Falla ⇒ |
| --- | --- | --- |
| 1 | `isValidProjectSlug(slug)` | 422 `PROJECT_SLUG_INVALID` |
| 2 | `isAssetRole(role)` | 422 `ASSET_ROLE_INVALID` |
| 3 | `isPortableFileName(filename)` | 422 `ASSET_PATH_INVALID` |
| 4 | `content-length` presente y numérico | 411 `ASSET_CONTENT_LENGTH_REQUIRED` |
| 5 | `content-type` presente y no vacío | 400 `ASSET_CONTENT_TYPE_REQUIRED` |
| 6 | `contentLength <= store.maxUploadBytes` | 413 `ASSET_TOO_LARGE` (RN-7: **antes del primer byte**) |
| — | **fin de la validación pura: recién acá se invoca el primer puerto** | |
| 7 | `stat(projectRoot)` es directorio | 404 `PROJECT_NOT_FOUND` |
| 8 | *(a partir de acá, serializado por slug — DT-10)* | |
| 9 | `stat(destino)` es `null` | 409 `ASSET_ALREADY_EXISTS` (RN-5) |
| 10 | `ensureDirectory(raw/<dir>)`, `ensureDirectory(work/.uploads)` | |
| 11 | `writeTemporary({ directory: work/.uploads, source, expectedBytes, limitBytes: store.maxUploadBytes })` | `limit-exceeded` ⇒ 413 `ASSET_TOO_LARGE`; `aborted` ⇒ 400 `ASSET_UPLOAD_ABORTED`. En los dos casos el temporal ya fue borrado por el adaptador y **no se llama a `promoteTemporary`** (CA-011) |
| 12 | `stat(destino)` sigue `null` | `removeTemporary(tmp)` + 409 `ASSET_ALREADY_EXISTS` (evita que el `rename` pise material) |
| 13 | `promoteTemporary(tmp, destino)` | |
| 14 | `stat(destino)` ⇒ fingerprint `{ sizeBytes, modifiedAtMs }` | |
| 15 | `readCatalog` (o catálogo vacío si `null`) | `CatalogUnreadableError` ⇒ 500 `CATALOG_UNREADABLE` — **el asset ya quedó escrito**: el payload lleva `assetPersisted: true, catalogUpdated: false` |
| 16 | `probeAsset({ path: destino, assetId })` | ver **probe fallido** abajo |
| 17 | `writeCatalog(mergeUploadedAsset(...))` | |
| 18 | **201** | |

**201** — body: la entrada de catálogo recién escrita.

```json
{
  "path": "raw/aroll/clip02.mp4",
  "role": "aroll",
  "fingerprint": { "sizeBytes": 10485760, "modifiedAtMs": 1757289600000 },
  "media": { "id": "raw/aroll/clip02.mp4", "kind": "video", "path": "raw/aroll/clip02.mp4", "durationMs": 12000, "fps": 30, "width": 1080, "height": 1920, "hasAudio": true, "probedAt": "2026-09-08T00:00:00.000Z" }
}
```

Header adicional: `location: /projects/<slug>/files/raw/<dir>/<filename>` — la ruta por la que ese
mismo asset se descarga (EP-011).

**Probe fallido (RN-8, D-15, CA-013).** Si el paso 16 lanza:

1. El archivo **no se borra**.
2. `mergeProbeFailure` agrega/reemplaza la entrada en `catalog.probeFailures`
   (`{ path, errorCode, message }`, ordenado ascendentemente por `path`, sin duplicados) y se
   escribe el catálogo con `writeCatalog`.
3. La respuesta es el código traducido por `translateEngineError` (`cycle-01` §5.4):
   `503 MEDIA_BINARY_NOT_FOUND`, `500 MEDIA_COMMAND_FAILED` o `500 MEDIA_OUTPUT_UNPARSEABLE`; un
   valor irreconocible cae en `500 INTERNAL_ERROR`.
4. Ese payload agrega **`assetPersisted: true` y `catalogUpdated: true`**.
5. `errorCode` del catálogo se deriva del código propio ya traducido, no de una segunda
   inspección del error: `MEDIA_BINARY_NOT_FOUND → BINARY_NOT_FOUND`,
   `MEDIA_COMMAND_FAILED → COMMAND_FAILED`, `MEDIA_OUTPUT_UNPARSEABLE → UNPARSEABLE_OUTPUT`,
   cualquier otro → `UNKNOWN`.
6. `message` del catálogo es el **mensaje estático en inglés** del código propio
   (`MESSAGE_BY_CODE`), nunca `error.message` de la lib: `CommandFailedError` incluye el comando y
   sus argumentos, o sea la ruta absoluta del binario, y ese texto se persistiría en un archivo del
   proyecto (DT-8).

**Lista cerrada de errores:** `PROJECT_SLUG_INVALID` (422) · `ASSET_ROLE_INVALID` (422) ·
`ASSET_PATH_INVALID` (422) · `ASSET_CONTENT_LENGTH_REQUIRED` (411) ·
`ASSET_CONTENT_TYPE_REQUIRED` (400) · `ASSET_TOO_LARGE` (413) · `PROJECT_NOT_FOUND` (404) ·
`ASSET_ALREADY_EXISTS` (409) · `ASSET_UPLOAD_ABORTED` (400) · `CATALOG_UNREADABLE` (500) ·
`MEDIA_BINARY_NOT_FOUND` (503) · `MEDIA_COMMAND_FAILED` (500) · `MEDIA_OUTPUT_UNPARSEABLE` (500).

### 4.6 `GET /projects/:slug/timeline` (EP-007) y `GET /projects/:slug/edl` (EP-009)

**200:** el documento parseado (`TimelineSchema` / `EditDecisionListSchema`), tal cual, sin sobre.

Secuencia: validar slug → `stat(projectRoot)` → `stat(work/timeline.json)` → `readTextFile` →
`JSON.parse` → `safeParse`.

**Errores:** `422 PROJECT_SLUG_INVALID` · `404 PROJECT_NOT_FOUND` ·
`404 TIMELINE_NOT_FOUND` / `404 EDL_NOT_FOUND` (el archivo no existe; **nunca** un body `null`,
RF-13) · `422 TIMELINE_INVALID` / `422 EDL_INVALID` (el archivo existe pero no parsea como JSON o
no valida — RN-10: el endpoint tipado valida también en lectura).

### 4.7 `PUT /projects/:slug/timeline` (EP-008) y `PUT /projects/:slug/edl` (EP-010)

**Request:** body JSON con el documento completo (reemplazo total, no patch). `content-type` no es
obligatorio (DT-12). Tope: `MAX_JSON_BODY_BYTES`.

**200:**

```json
{ "slug": "smoke-ingest", "path": "work/timeline.json" }
```

`path` es exactamente el valor que devuelve `writeTimeline` / `writeEditDecisionList`.

Secuencia: validar slug → leer body (tope) → `JSON.parse` → `TimelineSchema.safeParse` →
`stat(projectRoot)` → `writeTimeline(project, parsed, { writeTextFile: storage.writeTextFile, ensureDirectory: storage.ensureDirectory })`.

- La validación de schema ocurre **antes** de cualquier puerto de escritura: ante un documento
  inválido `callLog` no registra ni un `ensureDirectory` ni un `writeTextFile` (CA-014).
- Los bytes los produce `writeTimeline` (`TimelineSchema.parse` + `serializeMontageDocument`, o sea
  `JSON.stringify(parsed, null, 2) + '\n'`), nunca un `JSON.stringify` propio del handler: el orden
  de claves tras un `.parse()` de Zod es el del schema, no el del literal recibido (D-16).
- Siempre **200**, tanto si el archivo se creó como si se reemplazó (DT-14).

**Errores:** `422 PROJECT_SLUG_INVALID` · `400 REQUEST_BODY_INVALID_JSON` ·
`413 REQUEST_BODY_TOO_LARGE` · `422 TIMELINE_INVALID` / `422 EDL_INVALID` ·
`404 PROJECT_NOT_FOUND`.

### 4.8 `GET /projects/:slug/files/*path` — descargar artefacto (EP-011)

**Request:** el comodín `*path` captura el resto de la ruta, percent-decodificada segmento a
segmento por el router (§5.3). Header opcional: `Range`.

**200** (sin `Range`, o con `Range` ignorable):
headers `content-type: <tabla §7.1>`, `content-length: <size>`, `accept-ranges: bytes`.
Body: el archivo completo, en streaming.

**206** (rango satisfacible): `content-range: bytes <start>-<end>/<size>`,
`content-length: <end - start + 1>`, más `content-type` y `accept-ranges`.

**416**: header `content-range: bytes */<size>` + body de error `RANGE_NOT_SATISFIABLE`.

Secuencia: validar slug → `isPortableArtifactPath(path)` **y** primer segmento ∈
`{raw, work, out}` → `stat(projectRoot)` → `stat(artefacto)` → `parseByteRange` →
`openReadStream(path, range?)`.

**Errores:** `422 PROJECT_SLUG_INVALID` · `422 ASSET_PATH_INVALID` (ruta no portable, con `..`,
absoluta, con `\`, con esquema de URI, **o fuera de `raw/`, `work/`, `out/`** — con
`expected: 'a project-relative path under raw/, work/ or out/'`) · `404 PROJECT_NOT_FOUND` ·
`404 ARTIFACT_NOT_FOUND` (no existe **o** es un directorio: no hay listado de directorios) ·
`416 RANGE_NOT_SATISFIABLE`.

**RN-10 explícito:** este endpoint **nunca** parsea el contenido. Sirve `work/timeline.json` como
bytes crudos aunque el documento no valide — es la ruta de bytes, y D-16 sólo se sostiene si nunca
reserializa.

### 4.9 Resumen de rutas

| RouteId | Método | Patrón | EP |
| --- | --- | --- | --- |
| `health` | GET | `/health` | EP-001 |
| `projects.list` | GET | `/projects` | EP-002 |
| `projects.create` | POST | `/projects` | EP-003 |
| `projects.detail` | GET | `/projects/:slug` | EP-004 |
| `projects.assets.list` | GET | `/projects/:slug/assets` | EP-005 |
| `projects.assets.upload` | PUT | `/projects/:slug/assets/:role/:filename` | EP-006 |
| `projects.timeline.get` | GET | `/projects/:slug/timeline` | EP-007 |
| `projects.timeline.put` | PUT | `/projects/:slug/timeline` | EP-008 |
| `projects.edl.get` | GET | `/projects/:slug/edl` | EP-009 |
| `projects.edl.put` | PUT | `/projects/:slug/edl` | EP-010 |
| `projects.files.get` | GET | `/projects/:slug/files/*path` | EP-011 |

**No hay dos patrones que puedan matchear el mismo path**: `/projects` (1 segmento después de la
raíz) · `/projects/:slug` (2) · `/projects/:slug/{assets,timeline,edl}` (3, con literal fijo) ·
`/projects/:slug/assets/:role/:filename` (5) · `/projects/:slug/files/*path` (≥ 4 con literal
`files` en la posición 3). El comodín es el único patrón con `files` en esa posición, así que no
compite con el de 5 segmentos. Hay un test que lo afirma (§11).

### 4.10 `GET /health` (EP-001) — ampliación

Cambia exactamente dos valores del body de `cycle-01` §6.2:

- `capabilities.assetStore: true` (RF-16, CA-018).
- `cycle: 2` (la constante `SERVICE_CYCLE`).

`status` sigue siendo `'ok'` sólo si todos los `engine[].loaded` y todos los `binaries[].resolved`
son `true`, y **sigue siendo 200 en los dos estados**: el store de assets no participa del cálculo
(CA-018). No se agrega ningún chequeo de la raíz de medios al health: `GET /projects` sobre una raíz
inexistente es 200 `[]` (RN-1), así que "la raíz no existe" no es un estado degradado.

---

## 5. Router con parámetros (extensión de `cycle-01` §6.3)

### 5.1 Tabla de rutas

```ts
// src/http/routes.ts
export const ROUTES = [
  { id: 'health', method: 'GET', pattern: '/health' },
  { id: 'projects.list', method: 'GET', pattern: '/projects' },
  { id: 'projects.create', method: 'POST', pattern: '/projects' },
  { id: 'projects.detail', method: 'GET', pattern: '/projects/:slug' },
  { id: 'projects.assets.list', method: 'GET', pattern: '/projects/:slug/assets' },
  { id: 'projects.assets.upload', method: 'PUT', pattern: '/projects/:slug/assets/:role/:filename' },
  { id: 'projects.timeline.get', method: 'GET', pattern: '/projects/:slug/timeline' },
  { id: 'projects.timeline.put', method: 'PUT', pattern: '/projects/:slug/timeline' },
  { id: 'projects.edl.get', method: 'GET', pattern: '/projects/:slug/edl' },
  { id: 'projects.edl.put', method: 'PUT', pattern: '/projects/:slug/edl' },
  { id: 'projects.files.get', method: 'GET', pattern: '/projects/:slug/files/*path' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];
```

`path` se renombra a `pattern` — el campo ya no es una ruta literal. `RouteId` conserva **la misma
forma tipada** (`(typeof ROUTES)[number]['id']`), que es lo que permite el `switch` exhaustivo del
dispatch (§5.4).

### 5.2 Gramática del patrón

- Los segmentos se separan por `/`.
- Un segmento literal matchea sólo su texto exacto.
- `:name` matchea **exactamente un segmento no vacío** y lo captura como `name`.
- `*name`, permitido **sólo como último segmento**, matchea **uno o más** segmentos y captura el
  resto unido por `/`.
- Sin comodín, la cantidad de segmentos tiene que coincidir exactamente.

### 5.3 Firma

```ts
// src/http/router.ts
export type RouteParams = Readonly<Record<string, string>>;

export type RouteMatch =
  | { readonly kind: 'matched'; readonly id: RouteId; readonly params?: RouteParams }
  | { readonly kind: 'method-not-allowed'; readonly allow: readonly string[] }
  | { readonly kind: 'not-found' };

export function normalizePath(path: string): string;
export function routeRequest(method: string, path: string): RouteMatch;
```

- `normalizePath` **no cambia** (recorta query y una barra final, deja `/` intacto). Su test sigue
  igual.
- `params` se **omite** cuando el patrón no tiene parámetros. Por eso
  `routeRequest('GET', '/health')` sigue devolviendo exactamente `{ kind: 'matched', id: 'health' }`
  y los tres tests vigentes de `router.spec.ts` pasan sin tocarse (DT-4).
- **Decodificación**: cada valor capturado se pasa por `decodeURIComponent` (los nombres de archivo
  llegan percent-encoded desde `new URL(...).pathname`). Si el valor no decodifica (`%zz`),
  `routeRequest` devuelve `{ kind: 'not-found' }`: el router es puro y no tiene superficie de
  errores propia, y una ruta que no se puede decodificar no identifica ningún recurso (DT-5).
- Un segmento vacío (`/projects//x`) **no** matchea un `:param`: el resultado es `not-found`.
- El orden de resolución es el de `cycle-01`: primero se buscan todos los patrones que matchean el
  path; si ninguno ⇒ `not-found` (404); si alguno matchea pero ninguno con ese método ⇒
  `method-not-allowed` con el `allow` (405).

### 5.4 Dispatch

```ts
// src/http/handle-request.ts
export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
  store: StoreConfig,
): Promise<HttpResponse>;
```

`handleRequest` hace `switch (match.id)` sobre `RouteId` con `satisfies never` en el `default`: el
compilador falla si se agrega una ruta a `ROUTES` sin handler. Cada handler recibe
`(deps, store, params, request)` y devuelve `HttpResponse`. `store` es el tercer parámetro y no
entra a `RenderApiDependencies`: ese objeto es de **puertos**, no de configuración (DT-6).

---

## 6. Superficie de errores ampliada (RF-16)

### 6.1 Códigos nuevos

Se agregan 20 códigos a `RENDER_API_ERROR_CODES` (que pasa de 15 a 35). `STATUS_BY_CODE` y
`MESSAGE_BY_CODE` son `Readonly<Record<RenderApiErrorCode, …>>`: el compilador obliga a completar
las 20 filas en los dos archivos, no hay forma de olvidarse de una.

| Código | Etapa | Status | Cuándo se emite | Campos del payload |
| --- | --- | --- | --- | --- |
| `PROJECT_NOT_FOUND` | `null` | 404 | `stat(mediaRoot/<slug>)` es `null` o no es directorio, en cualquier ruta con `:slug` | `resource: <slug>` |
| `PROJECT_SLUG_INVALID` | `null` | 422 | El slug del body (`POST`) o del path no cumple RN-2. Antes de todo puerto | `resource: <slug>`, `expected: 'a single kebab-case path segment'` |
| `PROJECT_ALREADY_EXISTS` | `null` | 409 | `POST /projects` sobre un slug ya presente en disco | `resource: <slug>` |
| `PROJECT_LAYOUT_INVALID` | `null` | 500 | Hay que hacer raw-scan y `stat(<slug>/raw)` es `null` | `resource: 'raw'`, `expected: 'a project with the canonical raw/ layout'` |
| `ASSET_ROLE_INVALID` | `null` | 422 | `:role` fuera de `aroll\|broll\|image\|audio`. Antes de todo puerto | `resource: <role>`, `expected: 'aroll, broll, image or audio'` |
| `ASSET_PATH_INVALID` | `null` | 422 | `:filename` no es un segmento portable (RN-6); o el `*path` de la descarga no es portable o cae fuera de `raw/`, `work/`, `out/` (RN-12); o el adaptador detectó una ruta fuera de la raíz de medios (§3.6) | `resource: <valor recibido>`, `expected` |
| `ASSET_ALREADY_EXISTS` | `null` | 409 | El destino del `PUT` ya existe, antes o después de escribir el temporal (RN-5) | `resource: raw/<dir>/<file>` |
| `ASSET_CONTENT_LENGTH_REQUIRED` | `null` | 411 | Falta `content-length` en el `PUT` de asset | `resource: 'content-length'` |
| `ASSET_CONTENT_TYPE_REQUIRED` | `null` | 400 | Falta `content-type` en el `PUT` de asset | `resource: 'content-type'` |
| `ASSET_TOO_LARGE` | `null` | 413 | `content-length` > límite (antes de escribir), o los bytes recibidos superan el límite durante la escritura | `resource: raw/<dir>/<file>`, `expected: 'at most <N> bytes'` |
| `ASSET_UPLOAD_ABORTED` | `null` | 400 | El stream del body erró o entregó menos bytes que `content-length` | `resource: raw/<dir>/<file>` |
| `TIMELINE_NOT_FOUND` | `null` | 404 | `GET` de `work/timeline.json` inexistente | `resource: 'work/timeline.json'` |
| `TIMELINE_INVALID` | `null` | 422 | El documento (del body en `PUT`, del disco en `GET`) no parsea o no valida contra `TimelineSchema` | `resource: 'work/timeline.json'`, `expected: 'a document accepted by TimelineSchema'` |
| `EDL_NOT_FOUND` | `null` | 404 | Ídem `work/edl.json` | `resource: 'work/edl.json'` |
| `EDL_INVALID` | `null` | 422 | Ídem contra `EditDecisionListSchema` | `resource: 'work/edl.json'`, `expected` |
| `ARTIFACT_NOT_FOUND` | `null` | 404 | El path pedido no existe, o existe y es un directorio | `resource: <ruta relativa al proyecto>` |
| `RANGE_NOT_SATISFIABLE` | `null` | 416 | Rango sintácticamente válido pero fuera de `[0, size-1]`, o archivo de 0 bytes | `resource: <ruta relativa>`, `expected: 'bytes */<size>'`. Header `content-range: bytes */<size>` |
| `CATALOG_UNREADABLE` | `null` | 500 | `work/catalog.json` existe y `readCatalog` lanza `CatalogUnreadableError` | `resource: 'work/catalog.json'` |
| `REQUEST_BODY_INVALID_JSON` | `null` | 400 | El body de un endpoint JSON no parsea, no es objeto, o `slug` no es string | `expected: 'a JSON object'` |
| `REQUEST_BODY_TOO_LARGE` | `null` | 413 | El body JSON supera `MAX_JSON_BODY_BYTES` | `expected: 'at most <N> bytes'` |

### 6.2 Por qué `stage: null` en los 20

`RENDER_PIPELINE_STAGES` es `['prepare','render','mix','mux','verify']`: son las etapas del
**pipeline de render**. Ninguna operación del store es una de ellas, y RF-16 ya prevé
`stage: null` para los códigos que no pertenecen al pipeline. Se descarta agregar una etapa
`'ingest'`: inventaría vocabulario de pipeline para algo que no lo es, y `run-render-pipeline`
usa esa lista como su propia semántica de progreso (que `cycle-03` va a reportar por etapa).

Consecuencia sobre `translateEngineError`: su parámetro `stage` se **ensancha** de
`RenderPipelineStage` a `RenderPipelineStage | null`. Es un ensanchamiento puro; los llamadores de
`cycle-01` y `translate-engine-error.spec.ts` siguen compilando y pasando sin cambios.

### 6.3 Extensión del payload (RN-8)

```ts
export interface RenderApiErrorDetails {
  readonly assetPersisted?: boolean;
  readonly catalogUpdated?: boolean;
}

export interface RenderApiErrorPayload {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderPipelineStage | null;
  readonly message: string;
  readonly resource?: string;
  readonly expected?: string;
  readonly hint?: string;
  readonly assetPersisted?: boolean;
  readonly catalogUpdated?: boolean;
}
```

- `RenderApiError` gana `abstract readonly details: RenderApiErrorDetails | null;` y
  `PipelineStageError` lo acepta en su `init` con default `null`. Todas las construcciones de
  `cycle-01` siguen compilando (el campo es opcional en el `init`).
- `toErrorPayload` hace `...(value.details === null ? {} : value.details)`: los dos booleanos salen
  **al tope del payload**, como pide el funcional, y siguen omitidos donde no aplican.
- El tipo de `details` es **cerrado** (dos booleanos opcionales), no un bag libre: no hay forma de
  filtrar una ruta absoluta por ahí.
- `render-api-error.spec.ts` no define subclases propias (usa `PipelineStageError`), así que el
  miembro abstracto nuevo no lo rompe. `to-error-payload.spec.ts` sí se amplía (§11).

### 6.4 Traducción de los errores de `libs/auto-montage`

`translateAutoMontageError(cause, resource)` en `src/errors/translate-store-error.ts`, con la misma
técnica estructural que `translateEngineError` (por `.code`, nunca por `instanceof` de la lib —
lección del repo sobre no copiar el union de códigos ajeno: se estrecha con una lista propia
`as const`):

| `AutoMontageErrorCode` | Código propio | Status |
| --- | --- | --- |
| `CATALOG_UNREADABLE` | `CATALOG_UNREADABLE` | 500 |
| `PROJECT_LAYOUT_INVALID` | `PROJECT_LAYOUT_INVALID` | 500 |
| `PATH_ESCAPES_PROJECT` | `ASSET_PATH_INVALID` | 422 |
| `READ_ONLY_RAW_PATH` | `ASSET_PATH_INVALID` | 422 |
| `TIMELINE_INVALID` | `TIMELINE_INVALID` | 422 |
| `EDL_INVALID` | `EDL_INVALID` | 422 |
| cualquier otro / no-error | `INTERNAL_ERROR` | 500 |

`READ_ONLY_RAW_PATH` **es alcanzable**: `writeCatalog`/`writeTimeline` envuelven el `writeTextFile`
con `guardWriteTextFile`, que lanza `ReadOnlyRawPathError` si alguna vez se le pasara una ruta bajo
`raw/`. Es la red que protege D-12 desde adentro de la lib. `PATH_ESCAPES_PROJECT` lo lanza
`toProjectRelativePath` cuando una ruta cae fuera del proyecto.

---

## 7. Bytes: content-type y `Range`

### 7.1 Tabla extensión → content-type (cerrada, cero dependencias)

`src/http/content-type-for.ts` — `contentTypeFor(fileName: string): string`. Match por la última
extensión, en minúsculas. Las 15 primeras filas son exactamente las extensiones que
`libs/auto-montage/src/ingest/supported-extensions.ts` acepta como asset, así que **todo archivo
ingestable es servible con un tipo correcto**; las 4 últimas cubren `work/**`.

| Extensión | `content-type` |
| --- | --- |
| `.mp4` | `video/mp4` |
| `.mov` | `video/quicktime` |
| `.mkv` | `video/x-matroska` |
| `.avi` | `video/x-msvideo` |
| `.webm` | `video/webm` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.wav` | `audio/wav` |
| `.mp3` | `audio/mpeg` |
| `.m4a` | `audio/mp4` |
| `.aac` | `audio/aac` |
| `.flac` | `audio/flac` |
| `.json` | `application/json; charset=utf-8` |
| `.txt` | `text/plain; charset=utf-8` |
| `.srt` | `application/x-subrip` |
| `.vtt` | `text/vtt` |
| *(cualquier otra, o sin extensión)* | `application/octet-stream` |

Sin `mime-db`, sin `mime-types`, sin `node:` nada: es un `Readonly<Record<string, string>>` y un
`lastIndexOf('.')` (RNF-7).

### 7.2 Semántica de `Range` (D-17, RN-11, CA-015)

```ts
export type ByteRangeResult =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'satisfiable'; readonly start: number; readonly end: number }
  | { readonly kind: 'unsatisfiable' };

export function parseByteRange(header: string | undefined, sizeBytes: number): ByteRangeResult;
```

| Entrada | Resultado | Respuesta HTTP |
| --- | --- | --- |
| Header ausente | `absent` | **200**, `content-length: <size>`, `accept-ranges: bytes`, archivo entero |
| `bytes=0-999` con `size = 5000` | `satisfiable 0..999` | **206**, `content-range: bytes 0-999/5000`, `content-length: 1000` |
| `bytes=0-999999` con `size = 5000` | `satisfiable 0..4999` (el `end` se **satura** a `size-1`) | **206**, `content-range: bytes 0-4999/5000`, `content-length: 5000` |
| `bytes=1000-` con `size = 5000` | `satisfiable 1000..4999` | **206**, `content-range: bytes 1000-4999/5000`, `content-length: 4000` |
| `bytes=-500` con `size = 5000` (sufijo) | `satisfiable 4500..4999` | **206** |
| `bytes=-99999` con `size = 5000` (sufijo mayor que el archivo) | `satisfiable 0..4999` | **206**, archivo entero con status 206 |
| `bytes=5000-` o `bytes=9999999-` con `size = 5000` | `unsatisfiable` | **416**, `content-range: bytes */5000`, body de error `RANGE_NOT_SATISFIABLE` |
| `bytes=-0` | `unsatisfiable` | **416** |
| Cualquier rango sobre un archivo de `size = 0` | `unsatisfiable` | **416**, `content-range: bytes */0` |
| `bytes=abc`, `bytes=`, `0-999` (sin prefijo), `bytes=10-5` (`start > end`), `items=0-1` | `ignored` | **200**, archivo entero — **no es un error** (RN-11, RFC 7233 §3.1) |
| `bytes=0-10,20-30` (más de un rango) | `ignored` | **200**, archivo entero |
| Header presente pero vacío o sólo espacios | `ignored` | **200** |

Reglas de la gramática aceptada: prefijo literal `bytes=`, exactamente un `<first>-<last>` donde
`first` y `last` son secuencias de dígitos decimales (una de las dos puede faltar, nunca las dos), y
espacios en blanco recortados alrededor. Cualquier otra cosa es `ignored`.

`accept-ranges: bytes` va en las respuestas 200 y 206. En 416 no se emite (la respuesta es el sobre
de error JSON con su `content-range`).

---

## 8. Lectura del body

### 8.1 Body JSON (`POST /projects`, `PUT` de `timeline` y `edl`)

```ts
// src/http/read-json-body.ts
export const MAX_JSON_BODY_BYTES = 16_777_216;

export type JsonBodyResult =
  | { readonly kind: 'parsed'; readonly value: unknown }
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'too-large' };

export async function readJsonBody(
  source: AsyncIterable<Uint8Array>,
  limitBytes: number,
): Promise<JsonBodyResult>;
```

- Acumula los chunks en un array y lleva el total; en cuanto **supera** el límite, **deja de
  consumir** y devuelve `too-large` (no se buferea de más).
- Decodifica con `new TextDecoder('utf-8')` y hace `JSON.parse`. Cualquier fallo ⇒ `invalid-json`.
- Es **pura**: recibe un `AsyncIterable`, así que se testea con un generador escrito a mano, sin
  socket ni fixture de disco.
- 16 MiB es holgado para una `Timeline` con miles de palabras de subtítulo y sigue acotando el
  consumo de memoria de un cliente que mande basura.

### 8.2 Body binario (`PUT` de asset)

Los bytes **nunca** pasan por la memoria del proceso más allá del chunk en vuelo: el handler entrega
el `AsyncIterable` directo a `storage.writeTemporary`.

Adaptador `fs` (`src/deps/node-render-api-dependencies.ts`), única implementación:

1. `randomUUID()` de `node:crypto` genera el nombre: `upload-<uuid>.part`.
2. **Ubicación del temporal: `work/.uploads/` del mismo proyecto** (DT-11) — mismo filesystem que
   el destino (condición para que `rename(2)` sea atómico), dentro del proyecto (D-14), invisible
   para `discoverAssets` (que sólo recorre `raw/`), y `work/` es un destino de escritura legítimo de
   la API (D-12). No va en `raw/<role>/` para no dejar basura en el directorio de material del dev
   ni depender de la regla de "archivo oculto" del clasificador.
3. Se escribe con un `WriteStream` consumiendo el `AsyncIterable`, contando bytes.
4. Si el acumulado supera `limitBytes`: se destruye el stream, se `unlink` el temporal y se devuelve
   `{ kind: 'limit-exceeded', limitBytes }`.
5. Si el source erra (cliente cortado) **o** `bytesWritten !== expectedBytes` al terminar: se
   `unlink` el temporal y se devuelve `{ kind: 'aborted' }`.
6. Éxito ⇒ `{ kind: 'written', temporaryPath, bytesWritten }`.
7. `promoteTemporary` es `rename(temporaryPath, finalPath)`, una sola llamada: el archivo aparece
   en `raw/` con su nombre final **completo o no aparece** (CA-011).
8. `removeTemporary` es `unlink` tolerante a `ENOENT`.

**Si el cliente corta**: el temporal ya fue borrado por el adaptador, `promoteTemporary` nunca se
llama, y en `raw/` no queda ningún archivo con el nombre final. Un reintento posterior del mismo
`PUT` encuentra el destino libre y se comporta como un upload nuevo (HU-02-05).

### 8.3 Transporte: qué cambia en `http-message.ts`

```ts
export type HttpHeaders = Readonly<Record<string, string>>;

export interface RequestBodySource {
  readonly stream: () => AsyncIterable<Uint8Array>;
}

export interface HttpRequestLine {
  readonly method: string;
  readonly path: string;
  readonly headers: HttpHeaders;
  readonly body: RequestBodySource;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: HttpHeaders;
  readonly body: unknown;
  readonly stream?: () => AsyncIterable<Uint8Array>;
}

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
```

- `headers`: nombres **en minúsculas**, valores múltiples unidos por `, ` (lo que ya entrega
  `IncomingMessage.headers`, normalizado en `create-render-api-server.ts`).
- `body` es un **thunk**: el stream se consume una sola vez y sólo si el handler lo pide. `GET` y
  `DELETE` nunca lo tocan.
- `HttpResponse.stream` **opcional** es el único cambio del tipo de respuesta (DT-15): cuando está
  presente, `writeResponse` escribe los headers y bombea los chunks con backpressure
  (`outgoing.write()` → esperar `'drain'` cuando devuelve `false`) e ignora `body`; cuando está
  ausente, hace exactamente lo de hoy (`JSON.stringify(response.body)`). Ningún handler de
  `cycle-01` cambia, y `bytesResponse({ status, headers, stream })` construye la variante binaria
  con `body: undefined`.
- `handle-request.spec.ts` pasa a construir sus requests con el fixture `requestLine()` (§9), que
  rellena `headers: {}` y un body vacío.

---

## 9. Árbol de `apps/render-api/src/` al cerrar el ciclo

`N` = archivo nuevo, `M` = modificado, el resto queda intacto.

```
src/
  main.ts                                    M  lee readStoreConfig(process.env, process.cwd())
  server-register.cjs
  config/
    server-config.ts                            (sin cambios)
    server-config.spec.ts                       (sin cambios)
    store-config.ts                          N  readStoreConfig(env, cwd) -> StoreConfig
    store-config.spec.ts                     N
  deps/
    render-api-dependencies.ts               M  + storage, + probeAsset
    object-storage.ts                        N  tipos del puerto (sin runtime, sin spec)
    node-render-api-dependencies.ts          M  + adaptador fs confinado, + probeAsset
    node-render-api-dependencies.spec.ts     M
  engine/
    engine-modules.ts                           (sin cambios)
    media-binaries.ts                           (sin cambios)
  errors/
    render-api-error.ts                      M  35 códigos, details
    render-api-error.spec.ts                    (sin cambios)
    pipeline-stage-error.ts                  M  + details
    http-status-for.ts                       M  35 filas
    http-status-for.spec.ts                  M
    to-error-payload.ts                      M  35 mensajes + spread de details
    to-error-payload.spec.ts                 M
    translate-engine-error.ts                M  stage: RenderPipelineStage | null
    translate-engine-error.spec.ts              (sin cambios)
    translate-store-error.ts                 N  AutoMontageError -> código propio
    translate-store-error.spec.ts            N
  http/
    http-message.ts                          M  headers, body source, stream
    routes.ts                                M  11 rutas con patrón
    router.ts                                M  params + comodín
    router.spec.ts                           M  (los 3 tests vigentes NO se tocan; se agregan casos)
    handle-request.ts                        M  switch exhaustivo sobre RouteId
    handle-request.spec.ts                   M  usa el fixture requestLine()
    health-handler.ts                        M  cycle 2, assetStore true
    health-handler.spec.ts                   M
    create-render-api-server.ts              M  headers, body source, streaming con backpressure
    create-render-api-server.spec.ts         M
    read-json-body.ts                        N
    read-json-body.spec.ts                   N
    byte-range.ts                            N
    byte-range.spec.ts                       N
    content-type-for.ts                      N
    content-type-for.spec.ts                 N
    handlers/
      projects-handler.ts                    N  list, create, detail
      projects-handler.spec.ts               N
      assets-handler.ts                      N  list, upload
      assets-handler.spec.ts                 N
      montage-handler.ts                     N  timeline y edl, GET y PUT
      montage-handler.spec.ts                N
      artifact-handler.ts                    N  descarga con Range
      artifact-handler.spec.ts               N
  pipeline/                                     (sin cambios)
  store/
    project-slug.ts                          N
    project-slug.spec.ts                     N
    asset-path.ts                            N
    asset-path.spec.ts                       N
    project-layout.ts                        N
    project-layout.spec.ts                   N
    catalog-merge.ts                         N
    catalog-merge.spec.ts                    N
    project-assets.ts                        N  resolveProjectAssets (catálogo vs raw-scan)
    project-assets.spec.ts                   N
    serialize-by-key.ts                      N
    serialize-by-key.spec.ts                 N
  __fixtures__/
    call-log.ts                                 (sin cambios)
    fake-render-api-dependencies.ts          M  + storage, + probeAsset
    fake-object-storage.ts                   N  ObjectStorage en memoria, cableado al callLog
    http-request.ts                          N  requestLine({ method, path, headers?, body? })
    catalog-fixtures.ts                      N  catálogo mínimo y CatalogAsset de ejemplo
    minimal-timeline.ts                         (sin cambios)
    minimal-edit-decision-list.ts            N
```

Invariantes que este árbol respeta:

- **Una sola frontera de proceso**: `main.ts` sigue siendo el único archivo que toca `process`.
- **Todo I/O por puertos**: sólo `deps/node-render-api-dependencies.ts` importa `node:fs`,
  `node:crypto` y las libs pesadas.
- **Sin comentarios** en ninguno de los archivos nuevos.
- Cada archivo nuevo con runtime tiene su `*.spec.ts` hermano. Los dos que no lo tienen son
  `deps/object-storage.ts` (sólo tipos, se borra al compilar) y los `__fixtures__/**` (excluidos
  del `coverage.include` desde `cycle-01`).

`resolveProjectAssets` (en `store/project-assets.ts`) es la función compartida por `GET
/projects/:slug` y `GET /projects/:slug/assets`:

```ts
export interface ProjectAssets {
  readonly source: 'catalog' | 'raw-scan';
  readonly assets: readonly AssetListEntry[];
  readonly probeFailures: readonly { readonly path: string; readonly errorCode: ProbeFailure['errorCode'] }[];
}

export async function resolveProjectAssets(
  storage: ObjectStorage,
  project: MediaProject,
): Promise<ProjectAssets>;
```

---

## 10. Configuración: diffs exactos

### 10.1 `apps/render-api/vite.config.ts` — **obligatorio** (lección del repo)

`@video-maker/auto-montage` está en `tsconfig.base.json → paths` (línea 20) y por eso `tsc`,
`lint` y `serve` lo resuelven, pero **no está declarado en el `resolve.alias` de este proyecto**:
sin este diff, todo compila y lintea en verde y **Vitest falla al importar la lib**.

```diff
--- a/apps/render-api/vite.config.ts
+++ b/apps/render-api/vite.config.ts
@@
   resolve: {
     alias: {
+      '@video-maker/auto-montage': fileURLToPath(
+        new URL('../../libs/auto-montage/src/index.ts', import.meta.url),
+      ),
       '@video-maker/composition-remotion/render': fileURLToPath(
         new URL('../../libs/composition-remotion/src/render.ts', import.meta.url),
       ),
```

`coverage.include` **no se toca**: ya es `['src/**/*.ts']` y cubre todos los archivos nuevos
(CA-019 exige no recortarlo). `coverage.exclude` tampoco: `src/main.ts`,
`src/deps/node-render-api-dependencies.ts`, `src/__fixtures__/**` y `src/**/*.spec.ts` siguen fuera,
y `src/deps/object-statement.ts`… no aplica: `object-storage.ts` es sólo tipos y v8 no reporta
archivos sin código ejecutable.

El tercer resolvedor (el `webpackOverride` de Remotion) **no** necesita esta entrada: `render-api`
no bundlea; `auto-montage` se importa desde el proceso Node, no desde la composición.

### 10.2 `libs/auto-montage/src/index.ts` — re-exports aditivos (DT-1)

No es una config protegida ni cambia comportamiento: son re-exports de símbolos que ya existen.

```diff
--- a/libs/auto-montage/src/index.ts
+++ b/libs/auto-montage/src/index.ts
@@
 export { resolveMediaProject } from './project/media-project';
 export type { MediaProject } from './project/media-project';
+
+export {
+  buildProjectSubdirectories,
+  catalogPath,
+  editDecisionListPath,
+  isInsideRaw,
+  timelinePath,
+  toAbsolutePath,
+  toProjectRelativePath,
+  workPath,
+} from './project/project-paths';
+
+export { discoverAssets } from './ingest/discover-assets';
+export type {
+  AssetFinding,
+  DiscoverAssetsDependencies,
+  DiscoverAssetsResult,
+  IgnoredFinding,
+} from './ingest/discover-assets';
```

Nota para el implementador: `project-paths.ts` exporta un alias local
`export type ProjectRelativePath = string;` que **colisiona** con el `ProjectRelativePath` ya
exportado desde `catalog/catalog.schema` en el barrel. El diff de arriba **no** re-exporta ese tipo
(el vigente sigue siendo el del schema); si se agrega por error, `tsc` falla con
`Duplicate identifier`.

`libs/auto-montage/vite.config.ts` no cambia: los símbolos ya están cubiertos por sus tests
actuales, y un re-export no agrega statements.

### 10.3 `apps/render-api/project.json`, `tsconfig.*.json` — sin cambios

`tsconfig.lib.json` resuelve `@video-maker/auto-montage` por los `paths` de `tsconfig.base.json`
igual que resuelve hoy `timeline-core`; el proyecto no usa `references` a las libs. `project.json`
tampoco cambia: el `serve` con `SWC_NODE_PROJECT=tsconfig.base.json` ya resuelve el alias nuevo.

---

## 11. Lista cerrada de tests obligatorios

Contrato que el reviewer contrasta **fila por fila** al cerrar, y que el Planner copia al `files[]`
de las tasks. Un archivo o un símbolo que no coincide es un hallazgo, no una variante aceptable.
Todo CA se verifica **por el símbolo que el test invoca**, nunca por el título del `it`.

### 11.1 Filas cubiertas por un test

| CA | Archivo | Nombre del test | Símbolo que ejercita |
| --- | --- | --- | --- |
| CA-010 | `src/store/project-slug.spec.ts` | `accepts a kebab-case single segment and rejects dots, slashes, uppercase and spaces` | `isValidProjectSlug` |
| CA-010 | `src/store/asset-path.spec.ts` | `accepts the four asset roles and rejects any other value` | `isAssetRole` |
| CA-010 | `src/store/asset-path.spec.ts` | `maps the image role to the raw/images directory` | `rawDirectoryForRole` |
| CA-010 | `src/store/asset-path.spec.ts` | `rejects a file name with a separator, a parent segment, a drive letter or a URI scheme` | `isPortableFileName` |
| CA-010 | `src/store/asset-path.spec.ts` | `rejects an artifact path outside raw, work and out` | `isPortableArtifactPath` |
| CA-010 | `src/http/handlers/projects-handler.spec.ts` | `rejects an invalid slug with PROJECT_SLUG_INVALID before invoking any storage port` (asserta `callLog.ports()` vacío) | `handleCreateProject` |
| CA-010 | `src/http/handlers/assets-handler.spec.ts` | `rejects an invalid role with ASSET_ROLE_INVALID before invoking any storage port` (`callLog.ports()` vacío) | `handleUploadAsset` |
| CA-010 | `src/http/handlers/assets-handler.spec.ts` | `rejects ../escape.mp4 and sub/dir.mp4 with ASSET_PATH_INVALID before invoking any storage port` (`callLog.ports()` vacío) | `handleUploadAsset` |
| CA-010 | `src/http/handlers/artifact-handler.spec.ts` | `rejects a traversing, absolute or windows path with ASSET_PATH_INVALID before invoking any storage port` (`callLog.ports()` vacío) | `handleGetArtifact` |
| CA-010 | `src/deps/node-render-api-dependencies.spec.ts` | `confines every storage operation to the configured media root` | `createNodeRenderApiDependencies` |
| CA-011 | `src/http/handlers/assets-handler.spec.ts` | `writes to a temporary and promotes it, in that order` (`callLog.ports()` = `[…,'writeTemporary','stat','promoteTemporary',…]`) | `handleUploadAsset` |
| CA-011 | `src/http/handlers/assets-handler.spec.ts` | `never promotes and leaves nothing at the destination when the write exceeds the limit` | `handleUploadAsset` |
| CA-011 | `src/http/handlers/assets-handler.spec.ts` | `never promotes and answers ASSET_UPLOAD_ABORTED when the source stream is cut` | `handleUploadAsset` |
| CA-011 | `src/http/handlers/assets-handler.spec.ts` | `removes the temporary and answers ASSET_ALREADY_EXISTS when the destination appears before the promotion` | `handleUploadAsset` |
| CA-011 | `src/deps/node-render-api-dependencies.spec.ts` | `writes into work/.uploads and renames onto the final path against a real temporary directory` | `createNodeRenderApiDependencies` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `creates an empty catalog for the slug when there is no previous one` | `emptyCatalogFor` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `forces asset.id and asset.path to the project-relative path` | `toCatalogAsset` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `inserts the new asset keeping assets sorted ascending by asset.id` (fixture con ids que **no** quedan ordenados por append) | `mergeUploadedAsset` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `produces a catalog that CatalogSchema accepts` (`CatalogSchema.parse` sobre el resultado) | `mergeUploadedAsset` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `drops a previous probe failure for the same path when the asset probes fine` | `mergeUploadedAsset` |
| CA-012 | `src/store/catalog-merge.spec.ts` | `preserves transcripts and ignored entries untouched` | `mergeUploadedAsset` |
| CA-012 | `src/http/handlers/assets-handler.spec.ts` | `writes a catalog containing the uploaded asset next to the pre-existing ones` (asserta sobre el argumento de `writeTextFile`) | `handleUploadAsset` |
| CA-013 | `src/store/catalog-merge.spec.ts` | `keeps probeFailures sorted ascending by path without duplicates` | `mergeProbeFailure` |
| CA-013 | `src/store/catalog-merge.spec.ts` | `stores the static English message for the code, never the engine error message` | `mergeProbeFailure` |
| CA-013 | `src/http/handlers/assets-handler.spec.ts` | `keeps the asset written and records the probe failure when probeAsset fails` (`callLog` sin borrado del destino) | `handleUploadAsset` |
| CA-013 | `src/http/handlers/assets-handler.spec.ts` | `it.each` sobre las tres causas: `answers <status> <code> with assetPersisted and catalogUpdated true` | `handleUploadAsset` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `writes the timeline with the same bytes writeTimeline produces` (compara el string capturado contra el que produce `writeTimeline` de `@video-maker/auto-montage` con un segundo doble) | `handlePutTimeline` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `writes the edl with the same bytes writeEditDecisionList produces` | `handlePutEditDecisionList` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `answers 422 TIMELINE_INVALID and writes nothing when the body does not validate` (`callLog.ports()` sin `writeTextFile` ni `ensureDirectory`) | `handlePutTimeline` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `answers 422 EDL_INVALID and writes nothing when the body does not validate` | `handlePutEditDecisionList` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `answers 404 TIMELINE_NOT_FOUND instead of a null body when the file is absent` | `handleGetTimeline` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `answers 422 TIMELINE_INVALID when the stored document does not validate` | `handleGetTimeline` |
| CA-014 | `src/http/handlers/montage-handler.spec.ts` | `answers 404 EDL_NOT_FOUND and 422 EDL_INVALID for the stored document` | `handleGetEditDecisionList` |
| CA-015 | `src/http/byte-range.spec.ts` | `it.each` con **una fila por cada fila de la tabla §7.2** (11 filas) | `parseByteRange` |
| CA-015 | `src/http/handlers/artifact-handler.spec.ts` | `answers 200 with content-length and accept-ranges when there is no Range header` | `handleGetArtifact` |
| CA-015 | `src/http/handlers/artifact-handler.spec.ts` | `answers 206 with content-range and exactly the requested bytes` (compara los bytes del stream, no sólo los headers) | `handleGetArtifact` |
| CA-015 | `src/http/handlers/artifact-handler.spec.ts` | `answers 416 with content-range bytes */size for an unsatisfiable range` | `handleGetArtifact` |
| CA-015 | `src/http/handlers/artifact-handler.spec.ts` | `serves the whole file with 200 for a malformed or multi-range header` | `handleGetArtifact` |
| CA-015 | `src/http/handlers/artifact-handler.spec.ts` | `answers 404 ARTIFACT_NOT_FOUND for an absent path and for a directory` | `handleGetArtifact` |
| CA-015 | `src/http/content-type-for.spec.ts` | `it.each` sobre las 17 filas de la tabla §7.1 más el fallback | `contentTypeFor` |
| CA-015 | `src/http/create-render-api-server.spec.ts` | `streams a byte response over a real loopback socket honouring a Range request` | `createRenderApiServer` |
| CA-016 | `src/errors/http-status-for.spec.ts` | `it.each` sobre `RENDER_API_ERROR_CODES` (35 filas): `maps <code> to HTTP <status>` | `httpStatusFor` |
| CA-016 | `src/errors/to-error-payload.spec.ts` | `emits an ASCII English message for every code in RENDER_API_ERROR_CODES` (35 códigos) | `toErrorPayload` |
| CA-016 | `src/errors/to-error-payload.spec.ts` | `never emits an absolute host path in resource` (amplía `ENGINE_DERIVED_RESOURCES` con los recursos del store) | `toErrorPayload` |
| CA-016 | `src/errors/to-error-payload.spec.ts` | `spreads assetPersisted and catalogUpdated at the top level and omits details when null` | `toErrorPayload` |
| CA-016 | `src/errors/translate-store-error.spec.ts` | `it.each` sobre las 7 filas de la tabla §6.4 | `translateAutoMontageError` |
| CA-016 | `src/errors/translate-store-error.spec.ts` | `falls back to INTERNAL_ERROR for a value outside the AutoMontageError hierarchy` | `translateAutoMontageError` |
| CA-017 | `src/http/router.spec.ts` | `matches GET /health and tolerates a trailing slash and a query string` (**sin tocar**) | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `returns not-found for an unknown path` (**sin tocar**) | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `returns method-not-allowed with the allow list for POST /health` (**sin tocar**) | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `extracts the slug, role and filename params of the upload route` | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `captures the remaining segments of the files route in a single path param` | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `percent-decodes every captured param and returns not-found for an undecodable one` | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `never matches an empty segment against a named param` | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `answers method-not-allowed with every method declared for a parameterised path` | `routeRequest` |
| CA-017 | `src/http/router.spec.ts` | `no two ROUTES patterns match the same concrete path` (recorre `ROUTES` y prueba un path canónico por patrón) | `ROUTES`, `routeRequest` |
| CA-017 | `src/config/store-config.spec.ts` | `defaults the media root to media resolved against the cwd` | `readStoreConfig` |
| CA-017 | `src/config/store-config.spec.ts` | `keeps an absolute RENDER_API_MEDIA_ROOT as is` | `readStoreConfig` |
| CA-017 | `src/config/store-config.spec.ts` | `defaults the upload limit and rejects a non-positive RENDER_API_MAX_UPLOAD_BYTES with SERVER_CONFIG_INVALID` | `readStoreConfig` |
| CA-017 | `src/config/store-config.spec.ts` | `accepts only fs as RENDER_API_OBJECT_STORE` | `readStoreConfig` |
| CA-017 | `src/store/project-layout.spec.ts` | `derives the five layout flags from the stats of raw, catalog, timeline, edl and out` | `layoutFlagsFrom` |
| CA-017 | `src/store/project-assets.spec.ts` | `reports source catalog and the catalog assets when work/catalog.json validates` | `resolveProjectAssets` |
| CA-017 | `src/store/project-assets.spec.ts` | `reports source raw-scan with media null and writes nothing when there is no catalog` (`callLog` sin escrituras) | `resolveProjectAssets` |
| CA-017 | `src/store/project-assets.spec.ts` | `throws CATALOG_UNREADABLE and never falls back to the raw scan when the catalog is corrupt` | `resolveProjectAssets` |
| CA-017 | `src/store/project-assets.spec.ts` | `counts assets by role including the roles with zero` | `countAssetsByRole` |
| CA-017 | `src/store/serialize-by-key.spec.ts` | `runs two operations on the same key one after the other and different keys concurrently` | `createKeyedSerializer` |
| CA-017 | `src/http/read-json-body.spec.ts` | `parses a JSON object, reports invalid-json and stops consuming past the limit` | `readJsonBody` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `answers 200 with an empty array when the media root does not exist` | `handleListProjects` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `lists one entry per project directory sorted by slug with its layout flags` | `handleListProjects` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `ignores files and non-portable directory names under the media root` | `handleListProjects` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `creates the six layout directories in order and answers 201 with catalog, timeline and edl false` | `handleCreateProject` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `answers 409 PROJECT_ALREADY_EXISTS without touching the existing project` | `handleCreateProject` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `answers 400 REQUEST_BODY_INVALID_JSON and 413 REQUEST_BODY_TOO_LARGE for a malformed body` | `handleCreateProject` |
| CA-017 | `src/http/handlers/projects-handler.spec.ts` | `answers 404 PROJECT_NOT_FOUND and 200 with assetCounts for the detail route` | `handleGetProject` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 200 with source catalog and 200 with source raw-scan` | `handleListAssets` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 500 CATALOG_UNREADABLE for a corrupt catalog` | `handleListAssets` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 500 PROJECT_LAYOUT_INVALID when the raw directory is missing on a raw scan` | `handleListAssets` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 411 without content-length and 400 without content-type` | `handleUploadAsset` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 413 ASSET_TOO_LARGE from the content-length header before touching any port` | `handleUploadAsset` |
| CA-017 | `src/http/handlers/assets-handler.spec.ts` | `answers 409 ASSET_ALREADY_EXISTS without writing when the destination exists` | `handleUploadAsset` |
| CA-017 | `src/http/handle-request.spec.ts` | `dispatches every RouteId to its handler` (recorre `ROUTES` y verifica que ninguna ruta cae en 404) | `handleRequest` |
| CA-018 | `src/http/health-handler.spec.ts` | `answers capabilities.assetStore true and cycle 2` | `handleHealth` |
| CA-018 | `src/http/health-handler.spec.ts` | `keeps answering 200 in the degraded state with assetStore still true` | `handleHealth` |

### 11.2 Filas cuya evidencia es una compuerta, no un test

| CA | Instrumento | Evidencia exacta |
| --- | --- | --- |
| CA-009 | corrida del workspace | `pnpm nx run-many -t lint test build` verde con `render-api` en la corrida · `pnpm sdd:validate` verde · `git diff --stat package.json pnpm-lock.yaml` vacío en todo el ciclo |
| CA-017 (proceso) | ejecución real del binario | §13 — el guion completo contra un directorio de medios temporal, con exit 0 ante `SIGTERM` observado sobre el proceso, nunca sobre `nx run` |
| CA-019 | umbral de cobertura | `pnpm nx run render-api:test` — v8 sobre `src/**/*.ts` con el `coverage.include` **sin recortar**; el umbral de 80 % vive en el `vite.config.ts` del proyecto y falla solo |
| CA-020 | inspección del entregable | `apps/render-api/README.md` documenta los 10 endpoints nuevos (método, path, propósito), `RENDER_API_MEDIA_ROOT`, `RENDER_API_MAX_UPLOAD_BYTES`, `RENDER_API_OBJECT_STORE`, la decisión D-11 (por qué no hay MinIO y cómo se agregaría detrás de `ObjectStorage`), el guion de §13 completo y copiable, y lo que sigue fuera de alcance |

### 11.3 Dobles de test

- **`createFakeObjectStorage(callLog, seed?)`** (`src/__fixtures__/fake-object-storage.ts`): un
  `Map<string, { kind, bytes, modifiedAtMs }>` en memoria detrás de las 9 operaciones, cada una
  registrada en el `callLog` de `cycle-01` §9.3. Permite programar por operación: `statQueue` (para
  simular que el destino aparece entre dos `stat`), `writeOutcome` (para `limit-exceeded` y
  `aborted`) y `readTextFileError` (para simular `ENOENT` con `code`).
- **`createFakeRenderApiDependencies(callLog, overrides?)`** suma `storage` y `probeAsset` con
  defaults exitosos; los overrides existentes no cambian de forma.
- **Ningún spec** importa `execa`, `node:child_process`, `@video-maker/media-local` ni
  `@video-maker/composition-remotion` por su entrada real (RNF-3/RNF-9). El único que toca disco es
  `node-render-api-dependencies.spec.ts`, contra un directorio temporal, como ya hace hoy.
- **Fixtures**: `catalog-fixtures.ts` construye su catálogo con `emptyCatalogFor` +
  `toCatalogAsset` sobre `MediaAsset` mínimos válidos, y lo pasa por `CatalogSchema.parse` antes de
  devolverlo; **no se copia ningún literal de otro ciclo**.

---

## 12. Decisiones técnicas

**DT-1 — El barrel de `@video-maker/auto-montage` se amplía con re-exports aditivos (§10.2).**
D-13 exige reusar `discoverAssets` y los helpers de `project-paths`, y hoy el barrel no los exporta.
*Descartado:* deep-import (`@video-maker/auto-montage/src/project/project-paths`) — `tsconfig.base.json`
mapea un único specifier, así que no resuelve en tsc ni en Vitest. *Descartado:* declarar un subpath
`@video-maker/auto-montage/project` — obliga a tocar `tsconfig.base.json`, que es config protegida.
*Descartado:* reimplementar los helpers en `render-api` — es exactamente la divergencia de layout que
D-13 prohíbe.

**DT-2 — `ensureDirectory` queda duplicado: como puerto suelto (pipeline) y dentro de `ObjectStorage`.**
El puerto suelto lo usa `runRenderPipeline` y su firma no se toca; el de `ObjectStorage` está sujeto
al confinamiento en la raíz de medios (§3.6), que el del pipeline no tiene (el pipeline escribe en el
workdir del render). *Descartado:* reusar el puerto suelto en el store — le sacaría el confinamiento
o se lo impondría al pipeline, que no lo quiere.

**DT-3 — La normalización `asset.id = asset.path = <ruta relativa>` es lógica pura, no del adaptador.**
`probeMedia` devuelve el `MediaAsset` con la ruta **absoluta** en `path`; ese valor no puede salir en
un payload (RNF-6/8) ni entrar al catálogo (`CatalogAssetSchema` exige `asset.id === asset.path`).
El adaptador está excluido del `coverage.include`, así que si la normalización viviera ahí sería el
único invariante crítico del ciclo sin cobertura. *Descartado:* hacerlo en el adaptador como hace
`probeAssets` de `auto-montage` (que sí está cubierto por los tests de la lib).

**DT-4 — `RouteMatch.matched.params` es opcional y se omite en las rutas sin parámetros.**
Es lo que mantiene `routeRequest('GET','/health')` estrictamente igual a hoy, así que los tres tests
vigentes de `router.spec.ts` pasan sin tocarse. El costo es un `match.params ?? {}` en un solo lugar
(el dispatch). *Descartado:* `params: RouteParams` siempre presente — rompe los tres `toEqual` del
spec vigente por una diferencia puramente cosmética.

**DT-5 — Un parámetro que no percent-decodifica devuelve `not-found` (404), no un error propio.**
El router es puro y no tiene superficie de errores; un `%zz` no identifica ningún recurso.
*Descartado:* 400 con un código nuevo `PATH_ENCODING_INVALID` — un código más, un mensaje más y una
fila más de tabla para un caso que el consumidor previsto no produce nunca (`fetch` y `curl`
codifican bien).

**DT-6 — `StoreConfig` viaja como tercer parámetro de `handleRequest`, no dentro de
`RenderApiDependencies`.** RF-15 dice "puertos inyectables sumados a `RenderApiDependencies`": la
raíz de medios y el límite de upload son configuración, no puertos. Mantener el objeto de
dependencias como un objeto de puertos puros es lo que hace que los dobles de test sigan siendo
triviales. *Descartado:* meterlo en `RenderApiDependencies` (mezcla config y puertos) y ampliar
`readServerConfig` (obligaría a cambiar su firma y su spec vigente, hoy verde).

**DT-7 — `PROJECT_LAYOUT_INVALID` es 500, no 404 ni 409.** Un directorio bajo la raíz de medios sin
`raw/` sí existe (`GET /projects` lo lista), así que 404 mentiría; y el cliente HTTP no puede
arreglarlo reintentando, así que 409 tampoco describe la situación. Queda en la misma familia que
`CATALOG_UNREADABLE`, que el funcional ya fijó en 500: la regla para el cliente es una sola —
**5xx del store ⇒ andá a mirar la carpeta**. *Descartado:* 409, y *descartado:* devolver
`assets: []` en silencio (esconde un proyecto roto justo donde D-13 más quiere transparencia).

**DT-8 — El `message` que se persiste en `catalog.probeFailures` es el mensaje estático en inglés del
código propio, nunca `error.message` de la lib.** `CommandFailedError` incluye el comando y sus
argumentos, o sea la ruta absoluta del binario del host; ese texto quedaría escrito en un archivo del
proyecto que después se puede compartir. Además hace el catálogo determinista entre máquinas.
*Descartado:* propagar el mensaje de la lib (lo que hace `probeAssets` internamente, que nunca sale
por HTTP).

**DT-9 — `writeTemporary` devuelve un union de resultado; no lanza.** El adaptador no conoce la
superficie de errores del servicio, y un `limit-exceeded` o un `aborted` no son excepcionales: son
respuestas previstas. El mapeo a `ASSET_TOO_LARGE` / `ASSET_UPLOAD_ABORTED` es del handler, que es
donde vive el contrato HTTP. *Descartado:* que el puerto lance el `PipelineStageError` (acopla el
adaptador a los códigos y hace que el doble tenga que construir errores).

**DT-10 — Los pasos 8..17 del upload se serializan por slug con `createKeyedSerializer()`.**
`apps/web` va a disparar N `PUT` en paralelo al soltar N archivos; sin serializar, los N ciclos
lectura-modificación-escritura de `work/catalog.json` se pisan y sobrevive uno solo. La cola es una
cadena de promesas por clave: ~15 líneas, cero dependencias, pura y testeable. *Descartado:* un
lock de archivo en disco (complejidad y estados zombie ante un crash) y *descartado:* no hacer nada
("es mono-usuario" — mono-usuario no es mono-request).

**DT-11 — El temporal del upload vive en `work/.uploads/`.** Mismo filesystem que el destino
(condición para que `rename(2)` sea atómico), dentro del proyecto (D-14), invisible para
`discoverAssets` (que sólo recorre `raw/`) y en un directorio donde D-12 ya autoriza a la API a
escribir. *Descartado:* `raw/<role>/` (deja basura entre el material del dev y depende de la regla
de archivo oculto del clasificador) y *descartado:* `os.tmpdir()` (puede estar en otro filesystem, y
entonces `rename` falla con `EXDEV` o se degrada a copiar).

**DT-12 — Los endpoints JSON no exigen `content-type`.** Sólo el `PUT` de asset lo exige (D-14 y el
funcional lo mandan explícitamente). Para el resto, exigirlo agregaría un código
(`UNSUPPORTED_MEDIA_TYPE`) y fricción con `curl -d`, sin ganar nada: el body se parsea igual y un
body no-JSON ya tiene su error. *Descartado:* exigir `application/json` en los tres endpoints JSON.

**DT-13 — `GET /projects` devuelve un array JSON al tope, no un objeto con `{ projects: [...] }`.**
Es lo que el funcional escribe literalmente ("el body es un array"). La envoltura sería preferible si
hubiera paginación o metadata, y ninguna de las dos está en este ciclo. *Anotado como reversible:*
si `cycle-03` agrega paginación, se envuelve ahí con su changelog en `api.json`.

**DT-14 — El `PUT` de `timeline`/`edl` responde siempre 200, nunca 201.** Distinguir creado de
reemplazado exigiría un `stat` previo que ninguna otra parte del flujo necesita, y el cliente
previsto (un editor que guarda) no usa esa diferencia. *Descartado:* 201 en la creación.

**DT-15 — `HttpResponse` gana un `stream?` opcional en vez de convertir `body` en un union.**
Convertir `body: unknown` en `{ kind: 'json' | 'bytes' }` obligaría a tocar los cinco handlers y los
cuatro specs de `cycle-01` sin ningún cambio de comportamiento. La variante binaria se construye
siempre con `bytesResponse(...)`, que deja `body: undefined`. *Descartado:* el union discriminado, y
*descartado:* bufferear el archivo en `body` como `Buffer` (rompe `JSON.stringify` y contradice el
streaming que CA-015 exige).

**DT-16 — `openReadStream` recibe el rango; el corte no se hace en el handler.**
`createReadStream(path, { start, end })` lee del disco sólo lo pedido. Cortar en memoria significaría
leer 2 GB para devolver 1 000 bytes. *Descartado:* `read` + `slice` en el handler.

**DT-17 — La descarga se limita a `raw/`, `work/` y `out/`.** RF-14 nombra esos tres. Servir la raíz
del proyecto expondría cualquier archivo que el dev deje ahí (notas, credenciales, un `.env`), y el
endpoint no tiene autenticación. El rechazo es 422 `ASSET_PATH_INVALID` con `expected`, no 404, para
que el cliente entienda que la ruta está mal formada y no que el archivo no está. *Descartado:*
servir cualquier ruta portable del proyecto.

**DT-18 — El adaptador confina toda operación de `ObjectStorage` a `store.mediaRoot` (§3.6).**
Le da un uso real al media root que el brief pide reintroducir en
`createNodeRenderApiDependencies`, y es la red que atrapa un bug futuro de un handler que no valide.
*Descartado:* pasar el media root sin usarlo (el defecto exacto que `cycle-01` corrigió al quitar el
`projectRoot` que ningún puerto usaba).

**DT-19 — `HEAD` sigue devolviendo 405.** El consumidor previsto (`<video>` y el Remotion Player)
descubre el tamaño con la primera respuesta `200`/`206` y su `content-range`, no con `HEAD`.
Implementarlo bien exige que el servidor omita el body en todas las rutas, no sólo en la descarga.
*Registrado como limitación conocida* para `cycle-03`, no como bug.

**DT-20 — Sin `zod` como import directo de `apps/render-api`.** Los únicos schemas que el servicio
ejecuta son `TimelineSchema`, `EditDecisionListSchema` y `CatalogSchema`, que llegan ya construidos
desde las libs. Los bodies chicos (`{ slug }`) se estrechan con un type guard de seis líneas. Así la
lista de dependencias del subproyecto sigue siendo la que declara su constitución.
*Descartado:* declarar schemas propios con `zod` (no sería una dependencia npm nueva —`zod@^4.5` ya
está en el manifiesto raíz— pero sí una dependencia nueva **del subproyecto**, sin necesidad).

---

## 13. Verificación por ejecución real del proceso (CA-017)

Un test con dobles no prueba que el servicio real escriba en el disco real. El guion siguiente es
la evidencia de CA-017 y va **completo y copiable en el README** (CA-020). El exit code se observa
sobre el proceso, nunca sobre `nx run`, que normaliza todo fallo a `1`.

```bash
MEDIA_TMP="$(mktemp -d)"
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT="$MEDIA_TMP" \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &
API_PID=$!
sleep 2
BASE="http://127.0.0.1:4399"

curl -s "$BASE/health" | grep -q '"assetStore":true'
curl -s "$BASE/projects"                                            # 200 []
curl -s -X POST "$BASE/projects" -d '{"slug":"smoke-api"}'          # 201
curl -s -X PUT "$BASE/projects/smoke-api/assets/aroll/clip01.mp4" \
  -H 'content-type: video/mp4' --data-binary @media/smoke-ingest/raw/aroll/clip01.mp4
curl -s "$BASE/projects/smoke-api/assets"                           # source: "catalog"
curl -s -X PUT "$BASE/projects/smoke-api/timeline" \
  --data-binary @media/smoke-ingest/work/timeline.json               # 200
curl -s "$BASE/projects/smoke-api/timeline" > /dev/null              # 200
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"              # 200 <size>
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  -H 'Range: bytes=0-999' "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"   # 206 1000
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Range: bytes=999999999-' "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"  # 416

diff <(node -e "process.stdout.write(require('fs').readFileSync('$MEDIA_TMP/smoke-api/work/timeline.json','utf8'))") \
     media/smoke-ingest/work/timeline.json                           # bytes idénticos (D-16)

kill -TERM "$API_PID"; wait "$API_PID"; echo "exit=$?"               # exit=0
rm -rf "$MEDIA_TMP"
```

**Qué prueba, hecho por hecho:** `capabilities.assetStore: true` (CA-018) · raíz vacía ⇒ `200 []`
(RN-1) · creación de layout (RF-9) · upload binario real con `rename` (CA-011) y catálogo
consistente en la misma request (CA-012) · `Timeline` con **los mismos bytes** que la CLI (CA-014,
el `diff` es la evidencia) · descarga completa, 206 y 416 (CA-015) · exit 0 ante `SIGTERM`.

**Si el entorno no tiene el proyecto `media/smoke-ingest`** (o `ffprobe` no resuelve y el upload
responde 503 `MEDIA_BINARY_NOT_FOUND` con `assetPersisted: true`), el ciclo **no puede declarar
CA-017 verificado**: hay que registrar explícitamente qué línea del guion no corrió y por qué. Un CA
documentado y nunca ejecutado no está verificado.

---

## 14. Configs protegidas — diff a escalar

**Ninguna config protegida hace falta para implementar este ciclo.** `tsconfig.base.json` ya tiene
el path de `@video-maker/auto-montage` (línea 20) y `apps/render-api/eslint.config.mjs` sigue sin
existir (D-9). El diseño no depende de ninguno de los dos.

Para cuando el dev decida pegar `apps/render-api/eslint.config.mjs`, el bloque de `cycle-01` §8.2
necesita **tres correcciones** acumuladas (una ya registrada en el fragmento de contexto de
`cycle-01`, dos nuevas de este ciclo):

```diff
   {
     files: ['src/**/*.ts'],
-    ignores: ['src/deps/node-render-api-dependencies.ts', 'src/main.ts'],
+    ignores: [
+      'src/deps/node-render-api-dependencies.ts',
+      'src/deps/node-render-api-dependencies.spec.ts',
+      'src/main.ts',
+    ],
     rules: {
       'no-restricted-imports': [
         'error',
         {
           patterns: [
             {
-              group: ['node:fs', 'node:fs/*'],
-              message: 'Filesystem access goes through the ensureDirectory port.',
+              group: ['node:fs', 'node:fs/*', 'node:crypto'],
+              message: 'Filesystem and randomness go through the ObjectStorage port.',
             },
           ],
         },
       ],
     },
   },
```

1. `node-render-api-dependencies.spec.ts` usa `node:fs/promises` real contra un directorio temporal
   (pendiente ya declarado por `cycle-01`).
2. `node:crypto` se suma al grupo restringido: el nombre del temporal lo genera `randomUUID()` y
   sólo el adaptador puede hacerlo.
3. Sin ese archivo, el invariante se sostiene con la verificación por grep del reviewer al cerrar,
   ampliada con `node:crypto`:

```bash
grep -rnE "\bprocess\.|\bconsole\.|from 'node:(fs|crypto)" apps/render-api/src --include='*.ts' \
  | grep -vE '^apps/render-api/src/(main\.ts|deps/node-render-api-dependencies(\.spec)?\.ts):'
```

Debe salir vacío.

---

## 15. Escalado al dev

**Ninguna dependencia npm nueva hace falta** (RNF-7 / D-2). Los tres candidatos que un diseño
convencional pediría, y su alternativa nativa efectivamente usada:

| Candidato | Para qué se pediría | Alternativa nativa de este diseño |
| --- | --- | --- |
| `express` / `fastify` | Router con parámetros, parseo de body | §5 (router propio, 11 rutas, ~60 líneas puras) y §8 (`readJsonBody` puro + streaming al puerto) |
| `mime` / `mime-types` | `content-type` por extensión | §7.1: `Readonly<Record<string, string>>` de 17 filas derivado de `supported-extensions.ts` |
| `busboy` / `multer` | Upload | D-14 ya descartó multipart: `PUT` binario crudo, que `fetch(url, { method: 'PUT', body: file })` produce en una línea |

**Un único punto de atención para el dev, no bloqueante:** el puerto default `4310` sigue ocupado
por `pnpm sdd:docs` en esta máquina (registrado en el fragmento de contexto de `cycle-01`); el guion
de §13 usa `4399` explícitamente por eso.

---

## 16. Riesgos que este contrato deja abiertos

1. **La atomicidad del upload depende de `rename(2)` en el mismo filesystem.** Si `RENDER_API_MEDIA_ROOT`
   apuntara a un montaje distinto del `work/` del proyecto — imposible por construcción, porque el
   temporal vive dentro del mismo proyecto — el `rename` fallaría con `EXDEV`. El test contra
   directorio temporal real de `node-render-api-dependencies.spec.ts` es la evidencia.
2. **Serializar por slug protege dentro de un proceso, no entre procesos.** Si el dev corre la CLI
   (`tools/render-cli ingest`) mientras la API escribe el catálogo, gana el último en escribir. Es
   el mismo riesgo que ya existe hoy entre dos corridas de la CLI, y está fuera del alcance del
   ciclo; el README debe decirlo.
3. **`readCatalog` distingue "ausente" por `error.code === 'ENOENT'`.** Este diseño no depende de
   eso (decide con `stat` antes de leer), pero si un adaptador futuro enmascarara el errno, el
   camino de `readCatalog` que devuelve `null` dejaría de dispararse. El contrato del puerto exige
   propagar el error del filesystem sin envolverlo.
4. **La cobertura del ciclo se apoya en handlers gordos.** `assets-handler.ts` concentra 18 pasos;
   si crece más, hay que partirlo antes de que su spec se vuelva ilegible. El umbral de 80 % no
   detecta eso.

---

## 17. Contratos registrados

`sdd/api.json`, app-key `apps/render-api`:

| Id | Método | Path | Status | Ciclo |
| --- | --- | --- | --- | --- |
| `EP-001` | `GET` | `/health` | `updated` | 1 → actualizado en 2 (`capabilities.assetStore: true`, `cycle: 2`) |
| `EP-002` | `GET` | `/projects` | `defined` | 2 |
| `EP-003` | `POST` | `/projects` | `defined` | 2 |
| `EP-004` | `GET` | `/projects/:slug` | `defined` | 2 |
| `EP-005` | `GET` | `/projects/:slug/assets` | `defined` | 2 |
| `EP-006` | `PUT` | `/projects/:slug/assets/:role/:filename` | `defined` | 2 |
| `EP-007` | `GET` | `/projects/:slug/timeline` | `defined` | 2 |
| `EP-008` | `PUT` | `/projects/:slug/timeline` | `defined` | 2 |
| `EP-009` | `GET` | `/projects/:slug/edl` | `defined` | 2 |
| `EP-010` | `PUT` | `/projects/:slug/edl` | `defined` | 2 |
| `EP-011` | `GET` | `/projects/:slug/files/*path` | `defined` | 2 |

`sdd/schema.json`: sin cambios — este subproyecto no tiene base de datos (§1.3).
