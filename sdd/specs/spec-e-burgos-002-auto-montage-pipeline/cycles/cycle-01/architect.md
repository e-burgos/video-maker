# Architect — Cycle 1: Ingesta y catálogo del proyecto de medios (`libs/auto-montage`)

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect

---

## 0. Registros SDD que este ciclo NO toca

Este ciclo no agrega tablas de base de datos ni endpoints HTTP: `libs/auto-montage` es una lib
Node que se consume por source y su único "almacenamiento" son archivos JSON dentro de
`media/<project-slug>/work/`.

- **`sdd/schema.json` — NO APLICA.** No hay motor de base de datos en el repo. El contrato de
  persistencia de este ciclo es el schema Zod de `work/catalog.json` (§4), versionado por
  `schemaVersion` dentro del propio archivo.
- **`sdd/api.json` — NO APLICA.** No hay superficie HTTP. La API pública del ciclo es el
  `src/index.ts` de la lib (§7). El primer `api.json` real del proyecto llega con
  `apps/render-api` (`spec-e-burgos-005`).

Queda constancia acá porque el protocolo del `sdd-architect` exige escribir ambos archivos: en
este ciclo hacerlo sería agregar entradas vacías o falsas.

---

## 1. Decisiones técnicas

### D-1 — Tag Nx de `libs/auto-montage`: `type:feature` (ÚNICA decisión abierta del ciclo)

**Decisión:** `libs/auto-montage` lleva `"tags": ["scope:engine", "type:feature"]`, y el
`eslint.config.mjs` **raíz** suma una restricción:

```js
{ sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] },
```

Diff conceptual sobre `depConstraints` de la raíz (una línea agregada, cero líneas modificadas):

```diff
 depConstraints: [
   { sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
   { sourceTag: 'type:util',   onlyDependOnLibsWithTags: ['type:domain'] },
   { sourceTag: 'type:ui',     onlyDependOnLibsWithTags: ['type:domain'] },
+  { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] },
   { sourceTag: '*',           onlyDependOnLibsWithTags: ['*'] },
 ]
```

**Por qué hace falta tocar la config raíz.** Hoy el repo tiene tres capas y ninguna compone:
`type:domain` (timeline-core) no depende de nada, `type:util` (media-local) solo del dominio, y
`type:ui` (composition-remotion) solo del dominio. `auto-montage` es la primera lib que **compone
dos capas a la vez** — los cálculos puros de `timeline-core` con los wrappers de binarios de
`media-local`. Ninguno de los tres tags existentes describe eso.

**Por qué es seguro para todo el repo.** El cambio es estrictamente **aditivo**: hoy ningún
proyecto lleva `type:feature`, así que ninguna regla vigente cambia de significado y
`nx run-many -t lint` sobre `timeline-core`, `media-local`, `composition-remotion` y
`shared-utils` no puede cambiar de resultado. Nx aplica **todas** las restricciones cuyo
`sourceTag` matchea (conjunción), así que la línea nueva **restringe** a `auto-montage` respecto
del catch-all `*`; no relaja nada de nadie.

**Qué prohíbe explícitamente.** `type:feature` **no** puede depender de `type:ui`: `auto-montage`
no renderiza y no debe poder importar `@video-maker/composition-remotion` ni Remotion. Quien
cablea el motor con el render es `tools/render-cli` (`cycle-03`), que es una app/tool, no una lib
del engine. Esto es RNF-6 hecho mecánico. Se refuerza dentro de la lib con un
`no-restricted-imports` propio (§8), para que el error aparezca también en el editor y no solo en
el `lint` de Nx.

**Alternativas descartadas:**

| Alternativa | Por qué no |
| --- | --- |
| Tagear `auto-montage` como `type:util` y relajar `type:util → ['type:domain', 'type:util']` | Habilitaría a `media-local` a depender de otras utils y borraría la distinción entre "wrapper de un binario" y "orquestador del pipeline". Relaja una regla existente para todo el repo en vez de agregar una nueva. |
| No ponerle tag de tipo (solo `scope:engine`) | Cae en el catch-all `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }` → podría importar `composition-remotion`, o mañana una app. Es exactamente lo que RNF-6 quiere impedir. |
| `type:app-logic` / `type:pipeline` | Nombres ad-hoc. `type:feature` es el nombre canónico de Nx para la capa que compone dominio + utilidades, y `tools/render-cli` (`cycle-03`) va a necesitar el mismo tag o uno por encima; usar el vocabulario estándar evita re-litigar el nombre en dos ciclos. |

### D-2 — `publicDir` = raíz del proyecto y rutas relativas (RESUELTA por el dev — se aplica, no se re-litiga)

`publicDir = media/<project-slug>` (la raíz, **no** `raw/`) y todas las rutas persistidas son
relativas a esa raíz. Motivo registrado: los medios derivados (voz normalizada de `spec-004`,
audio extraído para transcribir) viven en `work/`; con `publicDir` en `raw/` habrían caído en la
rama `file://` de `assetSrc`, que el README de `composition-remotion` marca como **no verificada**.

Cómo se materializa en este ciclo (contrato de rutas, obligatorio para el implementor):

1. **Toda ruta que cruza el borde de la lib hacia disco persistido es POSIX y relativa a
   `project.root`.** Forma canónica: `raw/aroll/clip01.mp4`, `work/transcripts/aroll/clip01.json`,
   `work/audio/aroll/clip01.wav`. Nunca empieza con `/`, nunca contiene `..`, nunca contiene `\`
   (CA-003).
2. **Las rutas absolutas existen solo en memoria y solo para hablarle al filesystem o a un
   binario.** Se construyen en el borde con `toAbsolutePath(project, relativePath)` y se
   descartan; jamás se serializan.
3. **`MediaAsset.path` guarda la ruta relativa** (`MediaAssetSchema.path` es
   `z.string().min(1)`, no exige absoluta), y `probeMedia` recibe la absoluta como argumento —
   la ruta que queda en el `MediaAsset` la fija el llamador, no `ffprobe`.
4. El consumidor del render (`cycle-03`) pasa `publicDir: <absoluto de project.root>` y las
   rutas relativas del catálogo entran tal cual en la `Timeline` → rama `staticFile()` verificada.

### D-3 — `media/` es el store canónico en disco (heredada por `spec-005`)

`media/<project-slug>/` es el **único lugar donde viven los archivos**. El MinIO de
`spec-e-burgos-005` es una **vista** que `render-api` expone sobre ese árbol (lectura, y escritura
solo bajo `work/`/`out/`), nunca un segundo almacenamiento con su propia copia. Consecuencia
directa para este ciclo: el catálogo no lleva ningún campo de URL, bucket, key ni endpoint — solo
rutas relativas al proyecto (D-2). `spec-005` hereda esta decisión y no puede introducir un
identificador de objeto que no sea derivable de la ruta relativa.

### D-4 — Anchor del punch-in: **diferida a `cycle-02`** por decisión del dev. Fuera de alcance acá.

### D-5 — `assetId` = ruta relativa POSIX del asset

`probeMedia` deriva por defecto `id = basename(path)`, lo que colisiona entre
`raw/aroll/clip01.mp4` y `raw/broll/clip01.mp4`. La ingesta **siempre** pasa `assetId` explícito
= la ruta relativa al proyecto (`raw/aroll/clip01.mp4`).

Por qué: es único por construcción (el filesystem ya garantiza unicidad de rutas), **determinista
sin contador, sin hash y sin reloj** (RNF-4), legible en el `edl.json`/`timeline.json` de
`cycle-02`, y estable si el proyecto se mueve de carpeta (D-2). Invariante del catálogo:
`asset.id === asset.path`, verificado por Zod (§4) — por eso la entrada del catálogo no duplica un
tercer campo de ruta.

### D-6 — El *fingerprint* invalida el probe **además de** la transcripción

`MediaAssetSchema.probedAt` es un `z.iso.datetime()`: si cada corrida re-sondea, el
`catalog.json` cambia byte a byte aunque no haya cambiado nada, y el archivo deja de ser
diffeable. La misma clave que decide re-transcribir (§6) decide re-sondear: si el fingerprint del
archivo coincide con el de la corrida anterior, se **reusa la entrada previa completa**
(`MediaAsset` incluido, con su `probedAt` original) y no se invoca `ffprobe`.

Consecuencia deseada: **una segunda ingesta sin cambios produce un `catalog.json` idéntico byte a
byte** — condición mucho más fuerte que CA-004 y trivialmente testeable. La única lectura de reloj
de la lib es el `probedAt` de un asset nuevo, y entra por el puerto `Clock`.

### D-7 — El catálogo **no** lleva `generatedAt`

Corolario de D-6: agregar una marca de tiempo de generación reintroduciría exactamente la
no-determinación que D-6 elimina. El catálogo es una función pura de (`raw/` + catálogo anterior);
cuándo se generó lo dice el `mtime` del propio `catalog.json`, no su contenido.

### D-8 — Un catálogo anterior ilegible **no aborta**: degrada a ingesta completa

Si `work/catalog.json` no parsea, o su `schemaVersion` no es el vigente, `readCatalog` lanza
`CatalogUnreadableError`; `ingestProject` lo **captura**, marca `staleCatalogReplaced: true` en el
resultado y procede como si no hubiera catálogo previo (re-sondeo y re-transcripción completos).

Justificación: el invariante de la spec es que `work/` es **regenerable desde `raw/`** y que
`rm -rf work out` es seguro en cualquier momento. Un `work/` corrupto no puede dejar al dev sin
poder ingerir; el precio (minutos de whisper) se paga una vez y se reporta explícito en el
resultado, nunca en silencio.

### D-9 — Cero dependencias npm nuevas

La lib usa `zod` (ya en el repo), `@video-maker/timeline-core` y `@video-maker/media-local`. Todo
el I/O nuevo se cubre con `node:fs/promises` (`readdir`, `stat`, `readFile`, `writeFile`, `mkdir`)
confinado en `src/fs/` y `node:path/posix` confinado en `src/project/project-paths.ts`. No hace
falta `glob`, `fast-glob`, `chokidar` ni ninguna librería de hashing: el descubrimiento es un
`readdir` recursivo de cuatro carpetas y la invalidación es tamaño + mtime (§6).

---

## 2. Estructura de `src/` (definitiva para `cycle-01`)

La constitución de la lib proponía un esquema; se **confirma con tres correcciones**, todas con
motivo:

```
libs/auto-montage/
├── project.json                     tags: ["scope:engine", "type:feature"]  (D-1)
├── eslint.config.mjs                reglas propias de la lib (§8)
├── vite.config.ts                   resolve.alias de timeline-core Y media-local (trampa conocida)
├── tsconfig.lib.json / tsconfig.spec.json
├── README.md                        incluye el smoke manual (CA-007)
└── src/
    ├── index.ts                     ÚNICA superficie pública (§7)
    ├── errors/
    │   ├── auto-montage-error.ts        AutoMontageError (abstract) + AutoMontageErrorCode + isAutoMontageError
    │   ├── project-layout-error.ts
    │   ├── read-only-raw-path-error.ts
    │   ├── path-escapes-project-error.ts
    │   ├── catalog-unreadable-error.ts
    │   ├── asset-probe-failed-error.ts
    │   └── transcription-failed-error.ts
    ├── fs/                          ← ÚNICO directorio que puede importar node:fs (§8)
    │   ├── directory-reader.ts          port + nodeDirectoryReader
    │   ├── file-stat-reader.ts          port + nodeFileStatReader
    │   ├── write-text-file.ts           port + nodeWriteTextFile
    │   ├── ensure-directory.ts          port + nodeEnsureDirectory
    │   └── guard-raw-writes.ts          decoradores que imponen CA-006
    ├── project/
    │   ├── media-project.ts             MediaProject + resolveMediaProject
    │   └── project-paths.ts         ← ÚNICO archivo que puede importar node:path/posix (§8)
    ├── catalog/
    │   ├── catalog.schema.ts            Zod del catálogo (§4)
    │   ├── read-catalog.ts
    │   └── write-catalog.ts
    ├── ingest/
    │   ├── supported-extensions.ts      puro
    │   ├── classify-entry.ts            puro
    │   ├── discover-assets.ts           I/O superficial (DirectoryReader + FileStatReader)
    │   ├── probe-assets.ts              I/O (CommandRunner → probeMedia)
    │   ├── transcription-key.ts         puro — la clave de invalidación (§6)
    │   ├── plan-ingest-work.ts          puro — catálogo previo + hallazgos → qué re-sondear / re-transcribir
    │   ├── transcribe-assets.ts         I/O (CommandRunner → extractAudio + whisper)
    │   └── ingest-project.ts            orquestador de la etapa
    └── __fixtures__/
        ├── media-project-fixture.ts     árbol raw/ de fixture en memoria (dobles de los puertos)
        ├── fake-file-system.ts          implementaciones in-memory de los 4 puertos de fs
        └── ffprobe/  whisper/           salidas de fixture reusadas para el FixtureCommandRunner
```

**Correcciones respecto de la constitución (§3), con motivo:**

1. **`src/errors/` es nuevo.** La constitución no lo preveía; CA-006 y RNF-7 exigen errores
   tipados con datos estructurados (ruta, asset, causa). Un archivo por error, igual que
   `media-local` — evita el módulo-basurero y los ciclos de import.
2. **`src/fs/` es nuevo y es la clave de RNF-3.** La constitución decía "un puerto de filesystem"
   sin ubicarlo. Se adopta literal el precedente de `media-local`: los puertos viven en `src/fs/`
   y ESLint prohíbe `node:fs` fuera de ahí (§8). Sin este directorio la regla mecánica no se puede
   escribir.
3. **`src/catalog/` se separa de `src/project/`.** La constitución metía "serialización del
   catálogo" dentro de `project/`. Se separa porque son dos cosas de vida distinta: `project/` es
   **álgebra de rutas pura y estable** (no cambia más después de este ciclo), mientras que
   `catalog/` es el **contrato persistido y versionado** que `cycle-02` va a extender con
   `edl.schema.ts` y `timeline-ref.schema.ts` al lado. Además evita el ciclo de imports
   `project ↔ catalog` (la lección de `media-local` con `buildLoudnormFilter`).

**Carpetas de la constitución que este ciclo NO crea** (out of scope del brief, se crean cuando
las necesite su ciclo): `src/concepts/`, `src/broll/`, `src/presets/`, `src/auto-montage.ts` →
`cycle-02`.

---

## 3. Contrato del proyecto de medios

```ts
export interface MediaProject {
  readonly slug: string;
  readonly root: string;
  readonly rawDir: string;
  readonly workDir: string;
  readonly outDir: string;
}

export function resolveMediaProject(rootPath: string): MediaProject;
```

`resolveMediaProject` es **puro**: normaliza `rootPath`, deriva `slug` del último segmento y arma
las tres subcarpetas. **No toca el filesystem** (no verifica existencia) — la verificación de que
`raw/` existe es I/O y ocurre en `discoverAssets`, que lanza `ProjectLayoutError` si no está.
Motivo: mantener el contrato testeable sin dobles y sin `await`.

`ProjectLayoutError` se lanza cuando `rootPath` está vacío o cuando `raw/` no existe o no es un
directorio. Cualquier otra ausencia (`work/`, `out/`) **no** es error: se crean con
`ensureDirectory` (son regenerables por definición).

### Álgebra de rutas (`src/project/project-paths.ts`, todo puro)

| Función | Contrato |
| --- | --- |
| `toProjectRelativePath(project, absolutePath): ProjectRelativePath` | Normaliza a POSIX; lanza `PathEscapesProjectError` si el resultado sale de `project.root` (empieza con `..` o es absoluto). |
| `toAbsolutePath(project, relativePath): string` | Inversa; única forma de obtener una absoluta. |
| `isInsideRaw(relativePath): boolean` | `true` si el primer segmento es `raw`. |
| `rawAssetMirror(relativePath): string` | `raw/aroll/clip01.mp4` → `aroll/clip01` (sin prefijo `raw/`, sin extensión). Base de todas las rutas derivadas. |
| `workPath(...segments): ProjectRelativePath` | Constructor: **solo puede producir rutas bajo `work/`**. |
| `catalogPath()` / `transcriptPath(mirror)` / `extractedAudioPath(mirror)` / `whisperOutBase(mirror)` | Rutas canónicas del ciclo (§5), todas construidas con `workPath`. |

### Layout de `work/` que este ciclo produce

```
media/<project-slug>/work/
├── catalog.json                     contrato de la lib (§4)
├── transcripts/<mirror>.json        Transcription validada — contrato de la lib, lo consume cycle-02
├── audio/<mirror>.wav               16 kHz mono, derivado para whisper (extractAudioForTranscription)
└── whisper/<mirror>.json            salida CRUDA de whisper-cli (-of) — subproducto, no es contrato
```

**Por qué `transcripts/` y `whisper/` están separados:** `transcribeWithWhisperCpp` le pasa
`-of <outBase>` a `whisper-cli`, que deja su **formato propio** en `<outBase>.json` y devuelve una
`Transcription` ya parseada. Si `work/transcripts/` guardara ese archivo crudo, reusarlo obligaría
a re-parsear el formato de whisper en cada corrida y a que `cycle-02` conozca ese formato. El
crudo queda en `work/whisper/` (subproducto, descartable) y en `work/transcripts/` se persiste la
`Transcription` validada contra `TranscriptionSchema` — que es lo que `cycle-02` lee.

`<mirror>` espeja el subárbol de `raw/` sin el prefijo y sin extensión (`aroll/clip01`), así que
es único por construcción y legible. El descubrimiento es **recursivo** dentro de cada carpeta de
rol, y el mirror preserva la anidación.

---

## 4. Schema Zod del catálogo (`work/catalog.json`)

Reusa `MediaAssetSchema` y `TranscriptionEngineSchema` de `timeline-core` — **no se redefinen**.

```ts
import { MediaAssetSchema, TranscriptionEngineSchema } from '@video-maker/timeline-core';

export const CATALOG_SCHEMA_VERSION = 1;

export const ProjectRelativePathSchema = z
  .string()
  .min(1)
  .refine(isPortableProjectRelativePath, {
    message: 'La ruta debe ser POSIX y relativa a la raíz del proyecto de medios.',
  });
// isPortableProjectRelativePath: no empieza con '/', no matchea /^[A-Za-z]:[\\/]/,
// no contiene '\\' y ningún segmento es '..'  → CA-003

export const AssetRoleSchema = z.enum(['aroll', 'broll', 'image', 'audio']);

export const AssetFingerprintSchema = z.strictObject({
  sizeBytes: z.number().int().nonnegative(),
  modifiedAtMs: z.number().int().nonnegative(),
});

export const CatalogAssetSchema = z
  .strictObject({
    role: AssetRoleSchema,
    fingerprint: AssetFingerprintSchema,
    asset: MediaAssetSchema,
  })
  .superRefine(assertAssetIdEqualsPath);   // D-5: asset.id === asset.path

export const TranscriptRefSchema = z.strictObject({
  assetId: z.string().min(1),
  transcriptPath: ProjectRelativePathSchema,
  fingerprint: AssetFingerprintSchema,
  engine: TranscriptionEngineSchema,
  model: z.string().min(1),
  language: z.string().min(1),
});

export const IgnoredEntrySchema = z.strictObject({
  path: ProjectRelativePathSchema,
  reason: z.enum([
    'hidden',
    'unsupported-extension',
    'unknown-directory',
    'unexpected-file',
    'extension-role-mismatch',
  ]),
});

export const ProbeFailureSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  errorCode: z.enum(['BINARY_NOT_FOUND', 'COMMAND_FAILED', 'UNPARSEABLE_OUTPUT', 'UNKNOWN']),
  message: z.string().min(1),
});
```

**Los cinco motivos de `ignored` se detectan íntegramente en el descubrimiento**
(`classify-entry.ts` / `discover-assets.ts`), a partir del **nombre y el tipo de entry del
listado de directorio** — nunca del probe. `ignored[]` es por lo tanto un producto exclusivo del
descubrimiento; el sondeo solo escribe `assets[]` y `probeFailures[]`.

| `reason` | Qué es | Ejemplo |
| --- | --- | --- |
| `hidden` | El nombre del entry empieza con `.`, a cualquier profundidad. | `raw/aroll/.DS_Store` |
| `unsupported-extension` | Archivo dentro de una carpeta de rol cuya extensión no está en `SUPPORTED_EXTENSIONS`. | `raw/aroll/notas.txt` |
| `unknown-directory` | **Directorio** bajo `raw/` que no es uno de los 4 roles. | `raw/descartes/` |
| `unexpected-file` | **Archivo** suelto en el nivel de roles: bajo `raw/` solo se esperan las 4 carpetas. | `raw/README.md` |
| `extension-role-mismatch` | Extensión soportada, pero el `MediaKind` **que la extensión declara** es incompatible con el rol de la carpeta. | `raw/images/demo.mp4`, `raw/aroll/tema.mp3` |

`extension-role-mismatch` compara **extensión contra rol**, no el `MediaKind` sondeado contra el
rol: la comparación es pura, no cuesta un `ffprobe` y no depende de que el binario esté
instalado. Mapa: `aroll`/`broll` → `video`, `image` → `image`, `audio` → `audio`.

**Un `MediaKind` sondeado que no coincide con el rol NO es un `ignored` ni un `probeFailure`.**
`role` (declarado por la carpeta) y `asset.kind` (sondeado por `ffprobe`) son dos campos
independientes que ya conviven en `CatalogAssetSchema`: el catálogo registra ambos y `cycle-02`
decide con la regla que necesite su planificador. Descartar el asset ahí sería perder material del
dev por una discrepancia que el propio catálogo ya deja visible, y meterlo en `probeFailures[]`
mentiría —el probe no falló—. La extensión es lo que el dev declaró al nombrar el archivo y es lo
que filtra; el probe es la realidad y es lo que se registra.

```ts
export const CatalogSchema = z
  .strictObject({
    schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
    projectSlug: z.string().min(1),
    assets: z.array(CatalogAssetSchema),
    transcripts: z.array(TranscriptRefSchema),
    ignored: z.array(IgnoredEntrySchema),
    probeFailures: z.array(ProbeFailureSchema),
  })
  .superRefine(assertCatalogInvariants);
```

### Invariantes que impone `assertCatalogInvariants`

1. `assets[].asset.id` **único**; `assets` **ordenado ascendente por `asset.id`** (comparación de
   strings, sin locale) → serialización determinista (D-6).
2. `transcripts[].assetId` único, ordenado ascendente, y cada uno **referencia un `assets[]`
   existente cuyo `role` es `'aroll'`**.
3. `ignored` y `probeFailures` ordenados ascendente por `path`, sin duplicados.
4. Ninguna ruta del documento es absoluta (lo garantiza `ProjectRelativePathSchema` y, para
   `asset.path`, la superRefine de `CatalogAssetSchema` vía `asset.id === asset.path`) → **CA-003
   verificable sobre el JSON serializado**.
5. `projectSlug` coincide con `project.slug` al leer (lo chequea `readCatalog`, no el schema: es
   contexto externo al documento).

### Versionado

`schemaVersion` es un `z.literal(CATALOG_SCHEMA_VERSION)`, no un `number`: un catálogo de otra
versión **falla el parseo**, no se interpreta a medias. La política de migración es D-8 —
`readCatalog` lanza `CatalogUnreadableError` e `ingestProject` degrada a ingesta completa. Regla
para ciclos futuros: **agregar un campo opcional no sube la versión; cambiar el significado de un
campo existente o volver requerido uno opcional, sí.** Los campos previstos como aditivos futuros:
`contentHash` en `AssetFingerprintSchema` (§6) y `concepts` / `brollPlan` en `cycle-02`.

### Serialización

`writeCatalog` emite `JSON.stringify(catalog, null, 2) + '\n'` con las claves en el orden del
schema y los arrays ya ordenados (invariante 1–3). Dos corridas sin cambios producen el mismo
byte (D-6): eso es lo que hace el catálogo diffeable y lo que convierte CA-004 en un `toEqual`
sobre el string, no en una inspección de campos.

---

## 5. Puertos de I/O inyectables

Patrón obligatorio, copiado de `media-local`: **`CommandRunner` sin default (argumento
obligatorio), el resto con default de producción.** Ningún módulo instancia I/O adentro; el
default se resuelve una sola vez, en el borde. Es lo que permite RNF-3 (la suite corre sin
`ffmpeg`, sin `whisper-cli` y sin filesystem real).

| Puerto | Interfaz | Default de producción | Quién lo usa |
| --- | --- | --- | --- |
| `CommandRunner` (reusado de `media-local`) | `run(bin, args, opts): Promise<CommandResult>` | **ninguno — argumento obligatorio** | `probe-assets.ts`, `transcribe-assets.ts` (se lo pasan a `probeMedia`, `extractAudioForTranscription`, `transcribeWithWhisperCpp`) |
| `DirectoryReader` | `readDirectory(path): Promise<readonly DirectoryEntry[]>` con `DirectoryEntry = { name: string; isDirectory: boolean; isFile: boolean }` | `nodeDirectoryReader` (`readdir` con `withFileTypes`) | `discover-assets.ts` |
| `FileStatReader` | `statFile(path): Promise<FileStats>` con `FileStats = { sizeBytes: number; modifiedAtMs: number }` | `nodeFileStatReader` (`stat`, `modifiedAtMs = Math.trunc(stats.mtimeMs)`) | `discover-assets.ts` — **única fuente del fingerprint** |
| `ReadTextFile` (reusado de `media-local`) | `(path) => Promise<string>` | `nodeReadTextFile` (reusado) | `read-catalog.ts`, lectura de transcripciones reusadas, y se lo pasa a `transcribeWithWhisperCpp` |
| `WriteTextFile` | `(path, contents) => Promise<void>` | `nodeWriteTextFile` (`writeFile` utf8) | `write-catalog.ts`, persistencia de `Transcription` |
| `EnsureDirectory` | `(path) => Promise<void>` | `nodeEnsureDirectory` (`mkdir` recursivo) | creación de `work/**` |
| `Clock` (reusado de `media-local`) | `nowIso(): string` | `systemClock` (reusado) | `probe-assets.ts` → `probedAt` del `MediaAsset` de un asset **nuevo**. Único uso de reloj de la lib. |

`DirectoryEntry` y `FileStats` son tipos propios de la lib, no `Dirent`/`Stats` de Node: el doble
de test no puede depender de una clase de `node:fs`, y el puerto no debe filtrar la API del
runtime.

**Bag de dependencias** (una sola, en el borde):

```ts
export interface IngestDependencies {
  readonly runner: CommandRunner;             // obligatorio
  readonly readDirectory?: DirectoryReader;
  readonly statFile?: FileStatReader;
  readonly readTextFile?: ReadTextFile;
  readonly writeTextFile?: WriteTextFile;
  readonly ensureDirectory?: EnsureDirectory;
  readonly clock?: Clock;
}
```

`ingestProject` resuelve los defaults **una vez** al entrar y pasa los puertos ya resueltos hacia
adentro; ninguna función interna vuelve a hacer `?? nodeX`. En tests se pasa el `FixtureCommandRunner`
de `media-local` (que además **cuenta las invocaciones** → así se verifica CA-004: cero llamadas a
`whisper-cli`) y el `fake-file-system.ts` de `src/__fixtures__/`.

---

## 6. Clave de invalidación de la transcripción incremental (CA-004 / CA-005)

### La clave

**Determinista, sin reloj, sin entorno, sin aleatoriedad.** Función pura de
`src/ingest/transcription-key.ts`:

```ts
export interface TranscriptionKeyInput {
  readonly assetId: string;          // ruta relativa POSIX  (D-5)
  readonly sizeBytes: number;        // FileStatReader
  readonly modifiedAtMs: number;     // FileStatReader, Math.trunc(mtimeMs)
  readonly engine: TranscriptionEngine;
  readonly model: string;            // BASENAME del modelo, p.ej. 'ggml-large-v3-turbo-q5_0.bin'
  readonly language: string;         // idioma solicitado; 'auto' es un valor literal válido
}

export function buildTranscriptionKey(input: TranscriptionKeyInput): string;
// `${assetId}|${sizeBytes}|${modifiedAtMs}|${engine}|${model}|${language}`
```

### Por qué cada componente

- **`assetId`** — la clave es por asset, así que un cambio en un clip invalida **solo ese clip**
  (RN-04).
- **`sizeBytes` + `modifiedAtMs`** — es exactamente lo que CA-005 especifica ("tamaño o fecha de
  modificación"). Son datos del `stat`, no del reloj del proceso: la clave de la corrida N y la de
  la corrida N+1 son idénticas si el archivo no se tocó, sin importar cuándo se corrió.
  `modifiedAtMs` va truncado a entero porque `mtimeMs` es float y su fracción varía entre
  filesystems.
- **`model` y `language`** — cambiar de `ggml-base` a `ggml-large-v3-turbo` produce una
  transcripción distinta sobre el mismo archivo. Sin estos dos componentes, cambiar de modelo
  dejaría transcripciones viejas cacheadas para siempre: sería un bug silencioso de calidad. Se
  guarda el **basename** del modelo, no su ruta absoluta: la ruta es de la máquina del dev y
  rompería la portabilidad del catálogo (D-2); el basename es además lo que
  `transcribeWithWhisperCpp` ya escribe en `Transcription.model`.
- **`engine`** — `spec-001` dejó `parseFasterWhisperJson` además de whisper.cpp; el día que la
  lib acepte el otro motor, la clave ya discrimina.

### La decisión de reuso

`plan-ingest-work.ts` (puro: recibe los hallazgos del descubrimiento y el catálogo anterior,
devuelve el plan) **reusa** la transcripción de un asset si y solo si se cumplen las cuatro:

1. El catálogo anterior tiene un `TranscriptRef` para ese `assetId`.
2. `buildTranscriptionKey(refAnterior) === buildTranscriptionKey(hallazgoActual)`.
3. El archivo `work/transcripts/<mirror>.json` existe.
4. Su contenido parsea contra `TranscriptionSchema`.

Cualquier fallo → se re-transcribe **solo ese asset**. Las condiciones 3 y 4 son las que hacen que
borrar `work/transcripts/` a mano no deje al catálogo mintiendo, y son I/O: se evalúan en
`transcribe-assets.ts` a partir del plan, no dentro de la función pura.

### Limitación conocida y aceptada

`mtime` cambia con un `cp`, un `rsync` sin `-t` o un checkout, aunque el contenido sea idéntico →
**falso positivo** de invalidación: se re-transcribe de más. Es la dirección segura del error
(nunca reusa una transcripción que no corresponde) y es literalmente lo que pide CA-005. La
alternativa exacta —hash de contenido— exige leer gigabytes en cada ingesta, lo que cuesta más
que el ahorro en el caso común. El schema queda preparado: `contentHash` entra como campo
**opcional** de `AssetFingerprintSchema` sin subir `schemaVersion` (§4), y la clave lo usaría en
lugar de `modifiedAtMs` cuando esté presente.

### El mismo mecanismo para el probe

Por D-6, `plan-ingest-work.ts` compara el `fingerprint` (`sizeBytes` + `modifiedAtMs`) contra el
del `CatalogAsset` anterior y, si coincide, **reusa el `MediaAsset` entero** en vez de invocar
`ffprobe`. Es la misma comparación, sin `model`/`language`/`engine` (que no afectan al sondeo).

---

## 7. Superficie pública (`src/index.ts`) y firmas

Sigue el criterio de `timeline-core`/`media-local`: **el barrel exporta exactamente lo que el
consumidor necesita, ni un símbolo más**; los specs importan por ruta relativa, nunca desde el
barrel.

```ts
export { resolveMediaProject } from './project/media-project';
export type { MediaProject } from './project/media-project';

export {
  CATALOG_SCHEMA_VERSION,
  AssetFingerprintSchema, AssetRoleSchema, CatalogAssetSchema, CatalogSchema,
  IgnoredEntrySchema, ProbeFailureSchema, ProjectRelativePathSchema, TranscriptRefSchema,
} from './catalog/catalog.schema';
export type {
  AssetFingerprint, AssetRole, Catalog, CatalogAsset, IgnoredEntry,
  ProbeFailure, ProjectRelativePath, TranscriptRef,
} from './catalog/catalog.schema';

export { readCatalog } from './catalog/read-catalog';
export { writeCatalog } from './catalog/write-catalog';

export { ingestProject } from './ingest/ingest-project';
export type { IngestDependencies, IngestOptions, IngestResult } from './ingest/ingest-project';

export { AutoMontageError, isAutoMontageError } from './errors/auto-montage-error';
export type { AutoMontageErrorCode } from './errors/auto-montage-error';
export { AssetProbeFailedError } from './errors/asset-probe-failed-error';
export { CatalogUnreadableError } from './errors/catalog-unreadable-error';
export { PathEscapesProjectError } from './errors/path-escapes-project-error';
export { ProjectLayoutError } from './errors/project-layout-error';
export { ReadOnlyRawPathError } from './errors/read-only-raw-path-error';
export { TranscriptionFailedError } from './errors/transcription-failed-error';

export { nodeDirectoryReader } from './fs/directory-reader';
export type { DirectoryEntry, DirectoryReader } from './fs/directory-reader';
export { nodeFileStatReader } from './fs/file-stat-reader';
export type { FileStatReader, FileStats } from './fs/file-stat-reader';
export { nodeWriteTextFile } from './fs/write-text-file';
export type { WriteTextFile } from './fs/write-text-file';
export { nodeEnsureDirectory } from './fs/ensure-directory';
export type { EnsureDirectory } from './fs/ensure-directory';
```

**NO se exportan** (detalle de implementación de este ciclo, igual que en `media-local`):
`classifyEntry`, `discoverAssets`, `probeAssets`, `transcribeAssets`, `planIngestWork`,
`buildTranscriptionKey`, `SUPPORTED_EXTENSIONS`, el álgebra de `project-paths.ts`, los guards de
`guard-raw-writes.ts` y todo `src/__fixtures__/`.

### Firma de la etapa

```ts
export interface IngestOptions {
  readonly binaries: ResolvedBinaries;                  // de media-local: ffmpeg/ffprobe/whisperCli/whisperModel
  readonly language?: string;                           // default 'auto'
  readonly transcribeRoles?: readonly AssetRole[];      // default ['aroll']
}

export interface IngestResult {
  readonly catalog: Catalog;
  readonly catalogPath: ProjectRelativePath;            // 'work/catalog.json'
  readonly probeFailures: readonly AssetProbeFailedError[];
  readonly transcriptionFailures: readonly TranscriptionFailedError[];
  readonly transcribedAssetIds: readonly string[];
  readonly reusedTranscriptionAssetIds: readonly string[];
  readonly reusedProbeAssetIds: readonly string[];
  readonly staleCatalogReplaced: boolean;
}

export function ingestProject(
  project: MediaProject,
  opts: IngestOptions,
  deps: IngestDependencies,
): Promise<IngestResult>;
```

`ResolvedBinaries` se **recibe ya resuelto**: `resolveBinaries(env)` lee `process.env` y eso es
responsabilidad del llamador (el smoke de este ciclo, la CLI de `cycle-03`). Así `process` queda
prohibido dentro de la lib por ESLint (§8) sin excepciones.

`transcribeRoles` existe para que el smoke pueda ingerir sin transcribir (`[]`) y para que
`cycle-02` pueda transcribir B-roll con voz sin cambiar la firma. Default `['aroll']` = RF-3.

### Orden de la etapa `ingestProject`

1. `ensureDirectory(work/)` y subcarpetas (`transcripts/`, `audio/`, `whisper/`) — nunca `raw/`.
2. `readCatalog` → catálogo anterior, o `null` con `staleCatalogReplaced: true` (D-8).
3. `discoverAssets` → hallazgos (`{ relativePath, role, fingerprint }`) + `ignored[]` (CA-001).
4. `planIngestWork` (**puro**) → qué re-sondear, qué reusar, qué transcribir, qué reusar (§6).
5. `probeAssets` → `MediaAsset` de los nuevos/cambiados; los fallos se **acumulan** y no abortan
   (CA-002 / RN-02). Un asset con probe fallido queda fuera de `assets[]` y dentro de
   `probeFailures[]`.
6. `transcribeAssets` → por cada A-roll a transcribir: `extractAudioForTranscription` →
   `transcribeWithWhisperCpp` → validar contra `TranscriptionSchema` → `writeTextFile` en
   `work/transcripts/<mirror>.json`. Los fallos se acumulan igual que en el paso 5.
7. `writeCatalog` → `work/catalog.json` (arrays ordenados, salida determinista).

Un asset con probe fallido **no se transcribe** (no hay `MediaAsset` que referenciar), y su
transcripción anterior, si existía, se conserva en `work/transcripts/` pero **no** se referencia
en `transcripts[]` del catálogo nuevo: el catálogo solo afirma lo que pudo verificar en esta
corrida.

---

## 8. Invariante de `raw/` de solo lectura (CA-006) — error tipado, dos capas

**Capa 1 — hacerlo irrepresentable.** Todas las rutas de salida se construyen con `workPath(...)`
(§3), un constructor que solo puede producir rutas bajo `work/`. Ninguna función de la lib arma
una ruta de escritura concatenando strings.

**Capa 2 — punto de estrangulamiento tipado.** `src/fs/guard-raw-writes.ts` expone dos
decoradores y un aserto:

```ts
export function guardWriteTextFile(project: MediaProject, write: WriteTextFile): WriteTextFile;
export function guardEnsureDirectory(project: MediaProject, ensure: EnsureDirectory): EnsureDirectory;
export function assertWritableProjectPath(project: MediaProject, absolutePath: string): void;
```

Los decoradores se aplican **una sola vez**, al resolver los puertos en `ingestProject`: de ahí
para adentro no existe un `WriteTextFile` sin guardia. Cada uno convierte la ruta a relativa
(`toProjectRelativePath`), y si `isInsideRaw(...)` o si la ruta escapa del proyecto, **lanza antes
de tocar el filesystem**:

```ts
export class ReadOnlyRawPathError extends AutoMontageError {
  readonly code = 'READ_ONLY_RAW_PATH';
  readonly attemptedPath: string;      // relativa al proyecto
  readonly projectRoot: string;
}
```

`assertWritableProjectPath` cubre el agujero que los decoradores no pueden tapar: **las rutas de
salida que se le pasan a un binario externo** (el `out` de `extractAudioForTranscription`, el
`outBase` de `transcribeWithWhisperCpp`). Ahí no escribe la lib, escribe `ffmpeg`/`whisper-cli`, y
ningún decorador de `WriteTextFile` lo intercepta. Se llama en `transcribe-assets.ts`
inmediatamente antes de armar los argumentos del comando.

Así CA-006 se testea desde cualquier etapa: se le pasa a `ingestProject` un `WriteTextFile` doble
que registra llamadas, se fuerza una ruta bajo `raw/`, y se verifica `ReadOnlyRawPathError` +
**cero llamadas al doble** ("sin efecto sobre el filesystem").

---

## 9. Jerarquía de errores tipados

Estilo `MediaLocalError`: una clase abstracta con `code` discriminante, un type guard, y una
subclase por causa con sus datos estructurados (nunca un stack pelado — RNF-7).

```ts
export type AutoMontageErrorCode =
  | 'PROJECT_LAYOUT_INVALID'
  | 'READ_ONLY_RAW_PATH'
  | 'PATH_ESCAPES_PROJECT'
  | 'CATALOG_UNREADABLE'
  | 'ASSET_PROBE_FAILED'
  | 'TRANSCRIPTION_FAILED';

export abstract class AutoMontageError extends Error {
  abstract readonly code: AutoMontageErrorCode;
}

export function isAutoMontageError(value: unknown): value is AutoMontageError;
```

| Clase | `code` | Datos que lleva | Se lanza / se acumula |
| --- | --- | --- | --- |
| `ProjectLayoutError` | `PROJECT_LAYOUT_INVALID` | `projectRoot`, `missingPath` | **Lanza** — sin `raw/` no hay ingesta posible. |
| `ReadOnlyRawPathError` | `READ_ONLY_RAW_PATH` | `projectRoot`, `attemptedPath` | **Lanza** — es un bug del pipeline, no un dato del material (CA-006). |
| `PathEscapesProjectError` | `PATH_ESCAPES_PROJECT` | `projectRoot`, `attemptedPath` | **Lanza** — idem. |
| `CatalogUnreadableError` | `CATALOG_UNREADABLE` | `catalogPath`, `issues: readonly string[]`, `cause` | Lanzado por `readCatalog`, **capturado** por `ingestProject` (D-8). |
| `AssetProbeFailedError` | `ASSET_PROBE_FAILED` | `path`, `cause: unknown` (típicamente un `MediaLocalError`) | **Se acumula** — RN-02 / CA-002. |
| `TranscriptionFailedError` | `TRANSCRIPTION_FAILED` | `assetId`, `stage: 'extract-audio' \| 'transcribe' \| 'persist'`, `cause` | **Se acumula** — un clip que no se pudo transcribir no aborta el resto. |

Regla de traducción: **un `MediaLocalError` nunca sale crudo de `auto-montage`**. Se envuelve
siempre como `cause` de un error de esta jerarquía, que agrega el contexto que a `media-local` le
falta: qué asset y qué etapa. `errorCode` del `ProbeFailureSchema` (§4) se deriva del `code` del
`MediaLocalError` envuelto, y cae en `'UNKNOWN'` si la causa no lo es.

`AssetProbeFailedError` y `TranscriptionFailedError` viajan en el `IngestResult` **como
instancias**, y su proyección serializable va al catálogo (`probeFailures[]`). El llamador decide
si un fallo parcial es aceptable; la lib no decide por él.

---

## 10. Reglas ESLint propias de la lib (`libs/auto-montage/eslint.config.mjs`)

Mismo espíritu que `media-local`/`timeline-core`: **el determinismo y el confinamiento de I/O son
mecánicos, no una convención de buena voluntad.**

**Base — `files: ['src/**/*.ts']`:**

| Regla | Qué impone |
| --- | --- |
| `@typescript-eslint/no-explicit-any: 'error'` | RNF-1. |
| `no-restricted-globals`: `Date` | "El reloj entra por `Clock`: `probedAt` es inyectable." RNF-4 / D-6. |
| `no-restricted-globals`: `process` | "El entorno entra por parámetro (`IngestOptions.binaries`, ya resuelto por el llamador)." RNF-4. |
| `no-restricted-properties`: `Math.random` | "`auto-montage` es determinista: el `seed` entra por parámetro." RNF-4 / RF-9. |

**`no-restricted-imports` — confinamiento de I/O y de capa:**

| Grupo prohibido | Mensaje | Dónde SÍ se permite |
| --- | --- | --- |
| `node:fs`, `node:fs/promises`, `fs`, `fs/promises` | "El filesystem entra por los ports de `src/fs/`." | `src/fs/**`, `src/__fixtures__/**`, `**/*.spec.ts` |
| `node:child_process`, `child_process`, `execa` | "Los comandos se ejecutan SOLO a través de `CommandRunner`; el runner concreto vive en `media-local`." | **en ningún lado** |
| `node:path`, `path` | "El separador de Windows en el catálogo rompe la portabilidad (D-2/CA-003): usar `node:path/posix` desde `src/project/project-paths.ts`." | — (siempre prohibido; `node:path/posix` es un specifier distinto) |
| `node:path/posix`, `path/posix` | "El álgebra de rutas vive en `src/project/project-paths.ts`." | `src/project/project-paths.ts`, `**/*.spec.ts` |
| `node:os`, `os`, `node:http`, `node:https`, `node:net` | "`auto-montage` no lee el sistema ni la red." | **en ningún lado** |
| `react`, `react-dom`, `react/*`, `remotion`, `@remotion/*`, `@video-maker/composition-remotion`, `@video-maker/composition-remotion/*` | "`auto-montage` no renderiza: el render lo cablea `tools/render-cli`." | **en ningún lado** — espejo del boundary de D-1 dentro del archivo, para que falle en el editor y no solo en `nx lint`. |

**Overrides:**

- `files: ['src/fs/**/*.ts']` → `node:fs` / `node:fs/promises` permitidos (mantiene prohibido
  `child_process`, `execa` y la capa UI).
- `files: ['src/project/project-paths.ts']` → `node:path/posix` permitido.
- `files: ['src/__fixtures__/**/*.ts']` → `node:fs` permitido (fixtures de disco del smoke).
- `files: ['src/**/*.spec.ts']` → `no-restricted-globals: 'off'` (los tests fijan fechas
  literales, igual que en `media-local`).

---

## 11. Configuración de proyecto (contrato para el implementor)

- **`project.json`** — `tags: ["scope:engine", "type:feature"]` (D-1). Targets **explícitos**, sin
  plugins inferidos en `nx.json` (trampa conocida: `@nx/vitest` infiere `test` en modo watch y
  cuelga `nx run-many -t test`):
  - `lint`: `@nx/eslint:lint`
  - `test`: `vitest run --coverage --passWithNoTests` (cwd `libs/auto-montage`)
  - `build`: `tsc -p tsconfig.lib.json` (cwd `libs/auto-montage`, outputs
    `{workspaceRoot}/dist/out-tsc/libs/auto-montage`)
  - `smoke`: `node -r @swc-node/register ./src/smoke.ts` (registro **CJS**, como
    `composition-remotion`; el `--import .../esm-register` rompe por interop en este repo).
- **`tsconfig.base.json`** — agregar
  `"@video-maker/auto-montage": ["./libs/auto-montage/src/index.ts"]`.
- **`libs/auto-montage/vite.config.ts`** — `resolve.alias` de **los dos** aliases que la lib
  importa:
  `@video-maker/timeline-core` → `../timeline-core/src/index.ts` y
  `@video-maker/media-local` → `../media-local/src/index.ts`. Sin esto, `lint` y `build` quedan
  verdes y **los tests revientan con `ERR_MODULE_NOT_FOUND`** al importar cualquier *valor*
  (`MediaAssetSchema`, `TranscriptionSchema`, `FixtureCommandRunner`): `tsc` resuelve por
  `tsconfig.base.json → paths`, Vitest/Vite no.
- **Cobertura** — thresholds del `vite.config.ts` en 85 (RNF-2), excluyendo
  `src/**/*.spec.ts`, `src/__fixtures__/**`, `src/index.ts` y `src/fs/node-*` (los defaults de
  producción son las cuatro líneas que sí tocan `node:fs`; su verificación es el smoke manual,
  mismo criterio que `ExecaCommandRunner.run()` en `media-local`).
- **Sin `package.json` propio**: la lib se consume por source, igual que las otras tres.
- **Dependencias npm nuevas: ninguna** (D-9).

---

## 12. Smoke manual (CA-007)

Target `smoke` documentado en el README de la lib. No corre en CI (necesita `ffmpeg`, `ffprobe`,
`whisper-cli` y el modelo). Lee la ruta del proyecto de un argumento posicional con
`parseArgs` de `node:util` — **es el único lugar de la lib donde se lee `process`**, y por eso
`src/smoke.ts` vive fuera de `src/**` a efectos de las reglas base (override explícito en el
`eslint.config.mjs` de la lib, igual que `media-local` hace con `src/clock.ts`).

Qué verifica el dev al correrlo (RNF-7: la salida identifica etapa, asset y causa):

1. Primera corrida sobre un proyecto real → `work/catalog.json` con los assets esperados,
   duraciones coherentes, y `work/transcripts/aroll/*.json` con texto reconocible.
2. Segunda corrida inmediata → `reusedTranscriptionAssetIds` con todos los A-roll,
   `transcribedAssetIds` vacío, y `git diff --no-index` del `catalog.json` anterior contra el
   nuevo **vacío** (D-6).
3. `touch` de un clip de A-roll + tercera corrida → **solo** ese clip vuelve a transcribirse
   (CA-005 / RN-04).
4. `rm -rf work out` + cuarta corrida → reconstruye todo, `raw/` intacto (invariante del layout).

---

## 13. Contratos de API (`sdd/api.json`)

**NO APLICA** en este ciclo — ver §0. `libs/auto-montage` no expone superficie HTTP; su contrato
público es el `src/index.ts` de §7.

## 14. Cambios en schema (`sdd/schema.json`)

**NO APLICA** en este ciclo — ver §0. No hay motor de base de datos; la persistencia es
`work/catalog.json`, cuyo contrato es el schema Zod de §4, versionado dentro del propio archivo.

---

## 15. Dependencias externas

- **npm nuevas: ninguna** (D-9). La lib usa `zod` (ya en el repo) y consume `timeline-core` y
  `media-local` por source.
- **Binarios externos** (los invoca a través de `media-local`, nunca directamente; no los instala
  ni los descarga): `ffprobe` ≥ 6.0, `ffmpeg` ≥ 6.0, `whisper-cli` ≥ 1.7 y el modelo
  `ggml-*.bin`. Se reciben **ya resueltos** en `IngestOptions.binaries`; quién llama a
  `resolveBinaries(env)` es el smoke de este ciclo y la CLI de `cycle-03`.
- **Ninguna red, ninguna API paga** — decisión heredada de `spec-001`.

---

## 16. Registro de consumo

La entrada `{"agent": "architect"}` de `cycle.json → metrics.usage.by_agent[]` la escribe el
orquestador con el `subagent_tokens` **exacto** de la notificación de este subagente
(`source: agent-usage-notification`, `approx: false`), en vez de una estimación declarada desde
acá. `provider_model: claude/opus`, `effort: high`, declarados antes de diseñar. Motivo: el
número exacto solo lo ve el padre, y este documento se escribió en paralelo con el `sdd-planner`
— dos escrituras concurrentes sobre `cycle.json` se pisan.
