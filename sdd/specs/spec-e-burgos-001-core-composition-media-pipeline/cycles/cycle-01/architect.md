# Architect — Cycle 1: Core Composition & Media Pipeline Engine (`libs/timeline-core`)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect
> **Contrato vinculante:** `spec-e-burgos-001-core-composition-media-pipeline.spec.md`
> (secciones "Contratos de datos", "Cálculos del motor", CA-001 → CA-016)

Este ciclo crea una **lib de dominio TypeScript pura**. No hay base de datos, no hay endpoints
HTTP y no hay componentes de UI: las secciones "Cambios en schema" y "Contratos de API" declaran
explícitamente que no aplican (ver más abajo).

---

## 1. Decisiones técnicas

### D-01 — Alias de import: `@video-maker/timeline-core` (scope), no `@timeline-core`

**Decisión:** las libs nuevas del motor usan el scope `@video-maker/*`. `@shared-utils` queda como
está (no se renombra en este ciclo) y pasa a ser el patrón *legacy*.

**Justificación:**

1. La spec ya declara el package `@video-maker/timeline-core` en su tabla de arquitectura, y el
   `package.json` raíz ya se llama `@video-maker/source`: el scope existe en el repo.
2. `libs/shared-utils/src/index.ts` contiene literalmente `// @video-maker/shared-utils`: la
   intención original del repo era el scope; `@shared-utils` es una abreviatura de una lib
   placeholder vacía.
3. Vienen **tres** libs de esta spec (`timeline-core`, `media-local`, `composition-remotion`) y al
   menos tres más en las specs 002–006. Un alias sin scope (`@timeline-core`) no es un nombre npm
   válido, no se puede publicar nunca y colisiona visualmente con paquetes reales de node_modules.
4. Si mañana alguna lib se publica o se consume desde fuera del monorepo, el rename es cero.

**Cómo queda `tsconfig.base.json`** (edición aditiva, no reordenar ni tocar la entrada existente):

```json
"paths": {
  "@shared-utils": ["./libs/shared-utils/src/index.ts"],
  "@video-maker/timeline-core": ["./libs/timeline-core/src/index.ts"]
}
```

**`package.json` de la lib:** el repo trabaja con **un único `package.json` raíz** y dependencias
hoisted (`shared-utils` no tiene `package.json` propio). Por lo tanto:

- **Camino por defecto:** `libs/timeline-core` **NO lleva `package.json`**. La resolución la da
  `paths` de `tsconfig.base.json` y el proyecto Nx lo declara `project.json` con
  `"name": "timeline-core"`.
- **Contingencia:** si `@nx/js:lib` de Nx 23 genera igualmente `libs/timeline-core/package.json`
  (setup "TS solution"), **no se borra**: se le deja `"name": "@video-maker/timeline-core"`,
  `"version": "0.0.0"`, `"private": true`, `"type": "module"` y se verifica que `project.json`
  siga declarando `"name": "timeline-core"` (project.json gana sobre package.json en Nx), de modo
  que `pnpm nx test timeline-core` siga funcionando tal como promete el `context_prompt.md` de la
  lib. Verificación obligatoria: `pnpm nx show projects` debe listar `timeline-core`.

> No se agrega `customConditions` a `tsconfig.base.json`: hoy el repo no lo usa y agregarlo sin
> `exports` en los packages rompe la resolución. Fuera de alcance de este ciclo.

### D-02 — Generación con `@nx/js:lib`, tags y boundaries

```bash
pnpm nx g @nx/js:lib libs/timeline-core --bundler=none --unitTestRunner=vitest --linter=eslint
```

- `--bundler=none`: la lib se consume por *source* vía `paths` (igual que `shared-utils`); no
  necesita build propio ni artefacto en `dist/`. Un bundler acá solo agrega superficie de error.
- `--unitTestRunner=vitest`: alineado con el plugin `@nx/vite` ya registrado en `nx.json` y con
  Vitest 4 del root.
- **Tags Nx (`project.json`):** `["scope:engine", "type:domain"]`. `scope:engine` separa el motor
  de `scope:shared`; `type:domain` marca que **no puede depender de nada** — es la hoja del grafo.
- El repo hoy tiene `depConstraints: [{ sourceTag: "*", onlyDependOnLibsWithTags: ["*"] }]`. En
  este ciclo se agrega la restricción que la spec pide, **sin tocar el resto de la regla**:

```js
depConstraints: [
  { sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
  { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
]
```

`onlyDependOnLibsWithTags: []` deja a `timeline-core` sin poder importar ninguna lib del repo —
exactamente lo que declara la spec ("no depende de ninguna lib del repo"). El orden importa: la
regla más específica va primero.

### D-03 — ESM, TypeScript estricto y prohibiciones verificadas por ESLint

`tsconfig.base.json` ya fija `module: esnext`, `target: es2022`, `moduleResolution: bundler`,
`strict: true`. La lib **no** relaja nada y agrega en `tsconfig.lib.json`:
`"declaration": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`,
`"noImplicitOverride": true`, `"verbatimModuleSyntax": true`.

`noUncheckedIndexedAccess` es la decisión más cara del ciclo (obliga a chequear cada `words[i]`),
y es la correcta: todos los algoritmos de acá son recorridos por índice sobre arrays de longitud
variable, que es exactamente donde se cuelan los `undefined` silenciosos.

Las reglas de determinismo del `constitution.md` se hacen **verificables**, no declarativas, en
`libs/timeline-core/eslint.config.mjs`:

```js
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'timeline-core es determinista: el tiempo entra por parámetro.' },
        { name: 'process', message: 'timeline-core no lee el entorno.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usar mulberry32(seed).' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'child_process', 'os'], message: 'timeline-core no hace I/O.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'timeline-core es isomórfica y sin UI.' },
          ],
        },
      ],
    },
  },
];
```

Los `*.spec.ts` y `tools/**` quedan exentos de `no-restricted-imports` (el test anti-drift
necesita `node:fs`; ver D-06).

### D-04 — Vitest: v8, umbral 85 %, entorno node

`libs/timeline-core/vite.config.ts` (el target `test` lo infiere el plugin `@nx/vite`):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/timeline-core',
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/timeline-core',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/index.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
```

- `globals: false` → imports explícitos de `describe/it/expect` desde `vitest` (coherente con
  "cero magia implícita" y con `verbatimModuleSyntax`).
- `environment: 'node'` para los tests; el **código** sigue siendo isomórfico (RNF-5) y eso lo
  garantiza el lint de D-03, no el entorno de test.
- El umbral de 85 % (RNF-2) queda en la config, no en el CI: falla localmente igual que en CI.
- `src/index.ts` (barrel) y los fixtures se excluyen de cobertura: son re-exports y datos, y
  diluirían el porcentaje real de los algoritmos.

### D-05 — `Ms`, `Frame`, `Db`… son *marcas* de documentación, no brands de TypeScript

```ts
export type Ms = number;
export type Frame = number;
export type Db = number;
export type Lufs = number;
export type Scale = number;
export type AssetId = string;
export type ClipId = string;
export type DecisionId = string;
```

**Justificación:** un brand real (`number & { __ms: true }`) obligaría a castear en cada operación
aritmética (`ms + padding`, `frames * 1000 / fps`), lo que en una lib que es *toda* aritmética de
tiempo produce decenas de casts — ruido que además tienta a usar `as unknown as`. La garantía de
"entero ≥ 0" la da **Zod en el borde** (`z.number().int().nonnegative()`), que es donde entra el
dato externo; adentro los tipos son alias legibles. `Fps` y `Rounding` sí son uniones cerradas
porque son conjuntos finitos y chicos:

```ts
export type Fps = 24 | 25 | 30 | 50 | 60;
export type Rounding = 'round' | 'floor' | 'ceil';
```

### D-06 — El generador de JSON Schema es la fuente de verdad del archivo commiteado

El JSON de la spec es normativo sobre **qué campos, enums y constraints existen**. Sobre los
detalles de serialización (`oneOf` vs `anyOf`, dónde aparece `additionalProperties`, orden de
claves, `$defs` inline vs referenciado) **manda lo que emite `z.toJSONSchema()`**: es la única
forma de que CA-016 (identidad byte a byte) sea satisfacible sin edición manual.

Consecuencia concreta y esperada: `EditDecisionList.decisions.items` se modela con
`z.discriminatedUnion("type", …)` y Zod 4 lo serializa como **`anyOf` con `const` en `type`**,
no como el `oneOf` que muestra la spec. Es semánticamente equivalente (los miembros son
mutuamente excluyentes por el discriminante) y **no** es una desviación de contrato: es la
representación que elige el generador. Lo mismo vale para el `timing` de `transition`.

**Protocolo de generación:**

1. Cada contrato se registra con un id corto en `src/schemas/registry.ts`.
2. `src/schemas/json-schema.ts` expone una función **pura** (sin `fs`):

```ts
export function buildJsonSchemaBundle(): Record<SchemaFileName, JsonObject>;
export function timelineToJsonSchema(): JsonObject;
export function serializeJsonSchemaFile(schema: JsonObject): string;
```

   `buildJsonSchemaBundle()` llama a

```ts
z.toJSONSchema(timelineSchemaRegistry, {
  uri: (id) => `${id}.schema.json`,
  unrepresentable: 'throw',
})
```

   (`{ schemas: { 'output-format': {...}, … } }`), y luego, de forma determinista, antepone en cada
   entrada `$schema: "https://json-schema.org/draft/2020-12/schema"` y
   `$id: "https://video-maker.local/schemas/<id>.schema.json"`, eliminando la clave `id` suelta si
   el generador la emitió. Los `$ref` entre archivos quedan relativos
   (`"$ref": "output-format.schema.json"`), tal como los escribe la spec.
   Si `z.toJSONSchema` no aceptara un registry tipado propio, el fallback es `z.globalRegistry`
   con los mismos ids — el resto del protocolo no cambia.
3. `serializeJsonSchemaFile(x)` = `JSON.stringify(x, null, 2) + '\n'`. **Un único punto** de
   serialización, usado tanto por el generador como por el test: si difieren, el drift es del
   contenido y no del formato.
4. `libs/timeline-core/tools/generate-schemas.ts` es el **único** archivo de la lib que toca `fs`:
   escribe `libs/timeline-core/schemas/<id>.schema.json` con `serializeJsonSchemaFile`.
5. Target Nx en `project.json`:

```json
"schemas": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "libs/timeline-core",
    "command": "node --import @swc-node/register/esm-register ./tools/generate-schemas.ts"
  }
}
```

   → `pnpm nx run timeline-core:schemas`. `@swc-node/register` ya está en el root; si el loader
   fallara, el fallback es `node --experimental-strip-types` (Node ≥ 22.6, ya exigido por
   `engines`). El script **no** se corre en CI: CI corre el test anti-drift.
6. Test anti-drift (`src/schemas/schemas.spec.ts`, CA-016): para cada archivo,
   `readFileSync(schemaPath, 'utf8')` === `serializeJsonSchemaFile(bundle[id])`. El mensaje de
   fallo debe decir *"correr `pnpm nx run timeline-core:schemas`"*.
   Un bump de versión de Zod que cambie la serialización hace fallar este test: **es el
   comportamiento deseado** (el contrato publicado cambió y hay que revisarlo y commitearlo).

### D-07 — Invariantes en `superRefine`, con `path` exacto

Todo lo que el JSON Schema no puede expresar (particiones, contención de rangos, unicidad de ids)
vive en `superRefine` sobre el schema de nivel documento, y **siempre** reporta con el `path` del
elemento culpable (`['decisions', i]`, `['decisions', i, 'emphasisIndex']`, `['words', i, 'endMs']`)
para que CA-015 pueda afirmar la ubicación. Los `code` son `z.core.$ZodIssueCode.custom` con un
`message` en español que nombra el id de la decisión.

### D-08 — La normalización de solapes de la transcripción NO va dentro del schema

La spec dice que las palabras solapadas "se normalizan recortando al `startMs` de la siguiente".
Un `.transform()` dentro de `TranscriptionSchema` haría que `z.toJSONSchema(..., { unrepresentable:
'throw' })` explote y rompería CA-016. **Decisión:** el schema **rechaza** el solape (issue con
path `words[i].endMs`) y la normalización se expone como función pura aparte,
`normalizeTranscriptionWords(words)`, que los parsers de `media-local` (cycle-02) aplican **antes**
de validar. El contrato queda transform-free y el JSON Schema, generable.

### D-09 — `buildTimeline` posiciona overlays **relativo al keep**, no vía `remapMsAfterCuts`

`remapMsAfterCuts` mapea tiempo fuente → tiempo de timeline descontando **solo los cortes**
(CA-012). Pero la timeline final además **encoge** por los frames que consumen las transiciones.
Si los overlays (punch-in, B-roll, captions, ducking) se ubicaran con `remapMsAfterCuts`, todo lo
que esté después de la primera transición quedaría corrido N frames.

**Regla:** para un elemento dentro del keep `K` cuyo clip A-roll arranca en `clipFrom(K)`:

```
from = clipFrom(K) + msToFrames(elemento.startMs - K.startMs, fps)
```

`remapMsAfterCuts` sigue siendo API pública (la spec la exige y es lo que consumirá el matching de
B-roll de la spec 002), pero **no** la usa `buildTimeline` para posicionar. Queda documentado en el
README de la lib para que nadie lo "arregle" después.

### D-10 — `captionClip.box`: extensión aditiva y opcional del contrato `Timeline`

CA-014 exige que `validateTimeline` detecte "un subtítulo ubicado fuera de la zona segura", pero el
`captionClip` de la spec **no tiene ninguna coordenada**: sin geometría, ese criterio es
inverificable.

**Decisión:** se agrega a `captionClip` una propiedad **opcional** `box: { x, y, width, height }`
(enteros ≥ 0, píxeles del `format`). Es aditiva y retrocompatible (los documentos sin `box` siguen
validando), es el mínimo necesario para hacer CA-014 verificable, y es exactamente lo que
`captionLayout(safeZone, format)` de cycle-03 (CA-025) va a consumir.

- `buildTimeline` emite siempre `box` = el rectángulo interior del safe zone del formato:
  `{ x: left, y: top, width: width - left - right, height: height - top - bottom }`.
- `validateTimeline` chequea el `box` contra el safe zone **solo si está presente**.

**Delta declarado para el reviewer:** es la única diferencia de campos respecto del JSON de la
spec. Se registra en el fragmento aditivo de contexto del cierre de ciclo.

### D-11 — `anchor` del punch-in no sobrevive a `buildTimeline` (riesgo declarado)

El `videoClip.transform` del contrato `Timeline` tiene solo `scale`, `translateX`, `translateY`.
El `anchor` (`center | top | face-hint`) existe en la decisión de la EDL pero **no tiene lugar en
la Timeline**, y CA-026 (cycle-03) espera que `punchInStyle` derive `transformOrigin` del `anchor`.

**Decisión de este ciclo:** no se extiende el contrato por un requisito de otro ciclo.
`buildTimeline` descarta `anchor` y se deja el hueco **declarado** para que cycle-03 decida (o
`transform.origin` opcional, o `anchor` en el clip). Se anota en "Riesgos" y en el fragmento de
contexto.

### D-12 — Umbral de silencio: **inclusivo** (`gap >= minSilenceMs`)

La spec y el funcional se contradicen: la prosa dice "mayor a 500 ms" y CA-003 (criterio
verificable, en ambos documentos) dice que un hueco de **exactamente 500 ms sí se detecta**
("el límite es inclusivo"). **Manda el criterio de aceptación:** la comparación es `>=`.
El hueco de 300 ms no se detecta; los de 500 y 800 sí. Queda como decisión explícita porque es la
clase de detalle que se "corrige" mal en un refactor futuro.

### D-13 — Ids deterministas y sin dependencia del reloj

Ninguna función genera uuid ni usa `Date`. Los ids se derivan del orden de salida, zero-padded a 4:
`keep-0001`, `cut-0001`, `punch-0001`, `cap-0001`, `duck-0001` para las decisiones, y
`aroll-0001`, `broll-0001`, `voice-0001`, `music-0001`, `caption-0001` para los clips.
El id de la Timeline es `timeline-${edl.sourceAssetId}`. Todo esto vive en `src/timeline/ids.ts`
(`sequentialId(prefix, index)`), una sola implementación.

---

## 2. Estructura de `libs/timeline-core`

```
libs/timeline-core/
├── project.json                    name: "timeline-core", tags scope:engine/type:domain, target schemas
├── tsconfig.json                   referencias a lib/spec/tools
├── tsconfig.lib.json               include src/**/*.ts, exclude *.spec.ts, declaration: true
├── tsconfig.spec.json              include src/**/*.spec.ts, types: ["node", "vitest/globals"]
├── tsconfig.tools.json             include tools/**/*.ts, types: ["node"]
├── vite.config.ts                  Vitest + coverage v8 + thresholds 85
├── eslint.config.mjs               overrides de determinismo (D-03)
├── README.md                       API pública, unidades, cómo regenerar los JSON Schema
├── schemas/                        GENERADO Y COMMITEADO — no editar a mano
│   ├── output-format.schema.json
│   ├── media-asset.schema.json
│   ├── transcription.schema.json
│   ├── edit-decision-list.schema.json
│   ├── audio-mix-plan.schema.json
│   └── timeline.schema.json
├── tools/
│   └── generate-schemas.ts         ÚNICO archivo con fs; escribe schemas/*.schema.json
└── src/
    ├── index.ts                    ÚNICA superficie pública (solo re-exports)
    ├── types/
    │   └── units.ts                Ms, Frame, Db, Lufs, Scale, AssetId, ClipId, DecisionId, Fps, Rounding
    ├── schemas/
    │   ├── primitives.ts           MsSchema, FrameSchema, DbSchema, LufsSchema, ScaleSchema, IdSchema, FpsSchema
    │   ├── output-format.schema.ts OutputFormatSchema, OutputPresetSchema, SafeZoneSchema + tipos
    │   ├── media-asset.schema.ts   MediaAssetSchema + MediaAsset
    │   ├── transcription.schema.ts TranscriptionSchema, WordSchema, SegmentSchema + tipos
    │   ├── edit-decision-list.schema.ts  las 7 decisiones + EditDecisionSchema + EditDecisionListSchema
    │   ├── audio-mix-plan.schema.ts AudioMixPlanSchema, MusicMixSettingsSchema, VoiceTargetSchema, GainKeyframeSchema
    │   ├── timeline.schema.ts      VideoClipSchema, AudioClipSchema, CaptionClipSchema, TimelineTransitionSchema, TimelineSchema
    │   ├── registry.ts             timelineSchemaRegistry + SchemaFileName
    │   ├── json-schema.ts          buildJsonSchemaBundle, timelineToJsonSchema, serializeJsonSchemaFile
    │   └── schemas.spec.ts         CA-015 (invariantes) + CA-016 (anti-drift)
    ├── units/
    │   ├── units.ts                msToFrames, framesToMs
    │   └── units.spec.ts           CA-001
    ├── format/
    │   ├── format.ts               defaultFormat, safeZoneFor, DEFAULT_SAFE_ZONES
    │   └── format.spec.ts          CA-002
    ├── silence/
    │   ├── detect.ts               detectSilencesFromWords
    │   ├── merge.ts                mergeSilences
    │   ├── prune.ts                pruneSilences
    │   ├── remap.ts                remapMsAfterCuts
    │   ├── silence.spec.ts         CA-003, CA-004
    │   ├── prune.spec.ts           CA-005, CA-006
    │   └── remap.spec.ts           CA-012
    ├── punch-in/
    │   ├── random.ts               mulberry32
    │   ├── plan.ts                 planPunchIns
    │   └── punch-in.spec.ts        CA-007
    ├── captions/
    │   ├── emphasis.ts             pickEmphasisIndex, normalizeWordText
    │   ├── group.ts                groupWordsForCaptions
    │   └── captions.spec.ts        CA-008, CA-009
    ├── ducking/
    │   ├── plan.ts                 planDucking, mergeVoiceRanges
    │   └── ducking.spec.ts         CA-010, CA-011
    ├── timeline/
    │   ├── ids.ts                  sequentialId
    │   ├── build.ts                buildTimeline
    │   ├── validate.ts             validateTimeline, TimelineIssue, TimelineIssueCode
    │   ├── build-timeline.spec.ts  CA-013
    │   └── validate-timeline.spec.ts CA-014
    └── __fixtures__/
        ├── transcription.ts        spanishTranscription (20 palabras)
        ├── assets.ts               arollAsset, brollAsset, musicAsset
        ├── edl.ts                  ca013Edl
        └── index.ts                barrel INTERNO (no se re-exporta desde src/index.ts)
```

**Regla de superficie:** `src/index.ts` contiene **exclusivamente** `export { … } from './…'` y
`export type { … } from './…'`. Ningún test importa desde `@video-maker/timeline-core`: los tests
importan por ruta relativa el módulo que prueban (así el barrel no oculta un export faltante), y un
único test de superficie en `schemas.spec.ts` verifica que `index.ts` exporte todos los nombres de
la tabla de la sección 4.

---

## 3. Contratos Zod

### 3.1 Primitivas (`src/schemas/primitives.ts`)

```ts
export const MsSchema = z.number().int().nonnegative();
export const FrameSchema = z.number().int().nonnegative();
export const DbSchema = z.number();
export const LufsSchema = z.number().max(0);
export const ScaleSchema = z.number().min(1).max(2);
export const IdSchema = z.string().min(1);
export const FpsSchema = z.literal([24, 25, 30, 50, 60]);
```

`z.literal([...])` (multi-valor, Zod 4) genera `{ "enum": [24, 25, 30, 50, 60] }`, que es lo que
pide la spec; una `z.union([z.literal(24), …])` generaría `anyOf` de `const` y sería un contrato
más pobre para quien consuma el JSON Schema.

Objetos: `z.strictObject({...})` donde la spec declara `additionalProperties: false`;
`z.object({...})` en el resto. Campos opcionales con default documentado y **no** listados en
`required` por la spec: `z.boolean().meta({ default: true }).optional()` — el `default` viaja al
JSON Schema sin volver el campo requerido. Los campos con default **que sí** están en `required`
(todo `AudioMixPlan.voice` / `.music`) usan `.default(v)`.

### 3.2 Uniones discriminadas

```ts
export const EditDecisionSchema = z.discriminatedUnion('type', [
  KeepDecisionSchema, CutDecisionSchema, PunchInDecisionSchema, BrollOverlayDecisionSchema,
  TransitionDecisionSchema, CaptionGroupDecisionSchema, DuckDecisionSchema,
]);

export const TransitionTimingSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('linear') }),
  z.strictObject({ type: z.literal('spring'), damping: z.number(), stiffness: z.number(), mass: z.number() }),
]);
```

`discriminatedUnion` y no `union`: el error de validación apunta al miembro correcto en vez de
enumerar los siete fallos, que es lo que hace legible el `path` de CA-015.

### 3.3 Invariantes (`superRefine`)

**`TranscriptionSchema.superRefine`**

| # | Invariante | `path` del issue |
| - | ---------- | ---------------- |
| T1 | `endMs >= startMs` en cada palabra | `words[i].endMs` |
| T2 | `words` ordenadas por `startMs` no decreciente | `words[i].startMs` |
| T3 | Sin solape: `words[i].endMs <= words[i+1].startMs` (D-08: rechaza, no normaliza) | `words[i].endMs` |
| T4 | `segments[j].wordRange` = `[a, b]` con `0 <= a <= b < words.length` | `segments[j].wordRange` |

**`EditDecisionListSchema.superRefine`**

| # | Invariante | `path` del issue |
| - | ---------- | ---------------- |
| E1 | `id` único entre todas las decisiones | `decisions[i].id` |
| E2 | `endMs > startMs` (o `durationMs >= 1` en `transition`) | `decisions[i].endMs` |
| E3 | `keep`+`cut` ordenados por `startMs` particionan `[0, maxEnd]`: arrancan en 0, son contiguos, sin huecos ni solapes (RN-5) | `decisions[i].startMs` del primer tramo que rompe la cadena |
| E4 | `punch-in`, `broll-overlay`, `caption-group` y `duck` caen **completos dentro de un único `keep`** (RN-15) → **CA-015** | `decisions[i]` |
| E5 | `transition.atMs` coincide con el `startMs` de un `keep` que no es el primero (RN-16, ver 5.9) | `decisions[i].atMs` |
| E6 | Dos `punch-in` no se solapan entre sí (habilita el split determinista de 5.10) | `decisions[i].startMs` |
| E7 | `caption-group.emphasisIndex < words.length` | `decisions[i].emphasisIndex` |
| E8 | Palabras de un `caption-group` ordenadas y dentro de `[startMs, endMs]` | `decisions[i].words[k].startMs` |

> E3 verifica la partición **relativa** (contigüidad desde 0): la EDL no lleva la duración del
> asset fuente, así que "cubre exactamente `[0, durationMs]`" solo se puede cerrar contra los
> `assets`, y eso lo hace `validateTimeline` (`CLIP_EXCEEDS_ASSET`).

**`TimelineSchema.superRefine`**: solo lo estructural barato (`durationFrames >= 1`, ids de clip
únicos). Todo lo semántico (solapes, assets, safe zone) vive en `validateTimeline`, que devuelve
**lista completa de issues** en vez de abortar en el primero — es lo que pide CA-014.

---

## 4. API pública — firmas completas

Todo lo de esta tabla se exporta desde `src/index.ts` y nada más.

### 4.1 Unidades y formato

```ts
export function msToFrames(ms: Ms, fps: Fps, rounding: Rounding = 'round'): Frame;
export function framesToMs(frames: Frame, fps: Fps, rounding: Rounding = 'round'): Ms;

export type OutputPreset = 'reels-9x16' | 'tiktok-9x16' | 'shorts-9x16' | 'youtube-16x9';
export interface OutputFormat { preset: OutputPreset; width: number; height: number; fps: Fps }
export interface SafeZone { top: number; bottom: number; left: number; right: number }

export function defaultFormat(preset: OutputPreset): OutputFormat;
export function safeZoneFor(format: OutputFormat): SafeZone;
```

### 4.2 Silencios, poda y remapeo

```ts
export interface SilenceRange { startMs: Ms; endMs: Ms }

export interface DetectSilencesOptions { minSilenceMs?: Ms }        // default 500
export function detectSilencesFromWords(
  transcription: Transcription,
  opts?: DetectSilencesOptions,
): SilenceRange[];

export function mergeSilences(
  a: readonly SilenceRange[],
  b: readonly SilenceRange[],
): SilenceRange[];

export interface KeepRange { id: DecisionId; startMs: Ms; endMs: Ms }
export interface CutRange { id: DecisionId; startMs: Ms; endMs: Ms; reason: CutReason }
export type CutReason = 'silence' | 'manual' | 'filler-word';

export interface PruneSilencesOptions { paddingMs?: Ms; minKeepMs?: Ms }   // defaults 80 / 300
export interface PruneSilencesResult { keeps: KeepRange[]; cuts: CutRange[] }
export function pruneSilences(
  durationMs: Ms,
  silences: readonly SilenceRange[],
  opts?: PruneSilencesOptions,
): PruneSilencesResult;

export function remapMsAfterCuts(ms: Ms, keeps: readonly KeepRange[]): Ms;
```

`pruneSilences` devuelve `{ keeps, cuts }` y no un `EditDecision[]` mezclado: el 90 % de los
consumidores quiere una de las dos listas, y las decisiones tipadas se arman con
`toKeepDecision` / `toCutDecision` (helpers internos de `buildTimeline`, no públicos). La unión
ordenada de `keeps ∪ cuts` es la partición de RN-5 y hay un test que lo afirma.

### 4.3 Punch-ins

```ts
export type PunchInAnchor = 'center' | 'top' | 'face-hint';

export interface PunchInOptions {
  seed: number;                          // OBLIGATORIO (RN-7): sin seed no hay determinismo
  every?: number;                        // default 2
  scales?: readonly Scale[];             // default [1.10, 1.15]
  anchor?: PunchInAnchor;                // default 'center'
}

export interface PunchInPlan {
  id: DecisionId; startMs: Ms; endMs: Ms; scale: Scale; anchor: PunchInAnchor; keepId: DecisionId;
}

export function planPunchIns(
  keeps: readonly KeepRange[],
  opts: PunchInOptions,
): PunchInPlan[];
```

`seed` es requerido y `opts` no es opcional: es la única forma de que el tipo impida el
no-determinismo que prohíbe RNF-4.

### 4.4 Captions

```ts
export interface TranscriptWord { text: string; startMs: Ms; endMs: Ms; confidence?: number }

export interface CaptionGroupOptions {
  maxWords?: number;                     // default 3   (RN-9)
  maxDurationMs?: Ms;                    // default 1200 (RN-10)
  minDurationMs?: Ms;                    // default 300  (RN-10)
  maxGapMs?: Ms;                         // default 500  (D-14, ver 5.7)
  emphasisKeywords?: readonly string[];  // default []
}

export interface CaptionGroupPlan {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
  words: TranscriptWord[];               // 1..maxWords
  emphasisIndex: number;
}

export function groupWordsForCaptions(
  words: readonly TranscriptWord[],
  opts?: CaptionGroupOptions,
): CaptionGroupPlan[];

export function pickEmphasisIndex(
  words: readonly TranscriptWord[],
  emphasisKeywords?: readonly string[],
): number;
```

### 4.5 Ducking

```ts
export interface VoiceRange { startMs: Ms; endMs: Ms }
export interface GainKeyframe { frame: Frame; gainDb: Db }

export interface MusicMixSettings {
  baseGainDb: Db;      // default -12
  duckedGainDb: Db;    // default -24
  attackMs: Ms;        // default 150
  releaseMs: Ms;       // default 400
  holdMs: Ms;          // default 250
}

export interface DuckDecisionPlan { id: DecisionId; startMs: Ms; endMs: Ms; gainDb: Db }

export interface DuckingPlanResult {
  automation: GainKeyframe[];
  decisions: DuckDecisionPlan[];
}

export function planDucking(
  voiceRanges: readonly VoiceRange[],
  plan: MusicMixSettings,
  fps: Fps,
): DuckingPlanResult;

export const DEFAULT_MUSIC_MIX: MusicMixSettings;
export const DEFAULT_AUDIO_MIX_PLAN: AudioMixPlan;
```

`plan` es el sub-objeto `music` del `AudioMixPlan` y no el plan entero: pedir un `AudioMixPlan`
completo obligaría a construir el `automation` que esta misma función produce.

### 4.6 Timeline

```ts
export interface MusicInput {
  assetId: AssetId;
  trimStartMs?: Ms;
  gainDb?: Db;
  fadeInFrames?: Frame;
  fadeOutFrames?: Frame;
}

export function buildTimeline(
  edl: EditDecisionList,
  assets: readonly MediaAsset[],
  music?: MusicInput,
): Timeline;

export type TimelineIssueCode =
  | 'SCHEMA_INVALID'
  | 'EMPTY_AROLL'
  | 'ASSET_NOT_FOUND'
  | 'CLIP_EXCEEDS_ASSET'
  | 'AROLL_OVERLAP'
  | 'AROLL_GAP'
  | 'DURATION_MISMATCH'
  | 'CLIP_OUT_OF_TIMELINE'
  | 'TRANSITION_CLIP_NOT_FOUND'
  | 'CAPTION_OUT_OF_SAFE_ZONE';

export interface TimelineIssue {
  code: TimelineIssueCode;
  path: string;        // 'tracks.aroll[1].from'
  message: string;     // español, nombra el id del clip involucrado
}

export type TimelineValidationResult =
  | { ok: true }
  | { ok: false; issues: TimelineIssue[] };

export function validateTimeline(timeline: Timeline): TimelineValidationResult;
```

`buildTimeline` **no lanza** salvo un único caso: EDL sin ninguna decisión `keep`
(`TimelineBuildError` con `code: 'EMPTY_AROLL'`), porque no existe una `Timeline` válida con
`durationFrames = 0`. Todo lo demás —asset inexistente incluido— se construye igual y lo reporta
`validateTimeline`: eso es lo que hace posible el test de CA-014.

### 4.7 Schemas y tipos exportados

`OutputFormatSchema`, `SafeZoneSchema`, `MediaAssetSchema`, `TranscriptionSchema`,
`EditDecisionListSchema`, `EditDecisionSchema` (+ los 7 schemas de decisión),
`AudioMixPlanSchema`, `TimelineSchema`, `VideoClipSchema`, `AudioClipSchema`, `CaptionClipSchema`,
`TimelineTransitionSchema`, `GainKeyframeSchema` y los tipos inferidos homónimos
(`export type Timeline = z.infer<typeof TimelineSchema>` …), más
`timelineToJsonSchema()`, `buildJsonSchemaBundle()`, `serializeJsonSchemaFile()` y
`normalizeTranscriptionWords()`.

---

## 5. Algoritmos, pseudocódigo y casos borde

Convención del pseudocódigo: los rangos son **semiabiertos por construcción**
(`[startMs, endMs)`), así que `endMs` de un tramo == `startMs` del siguiente es contigüidad, no
solape. Ninguna función muta sus argumentos: cuando hace falta ordenar, se copia primero
(`[...input].sort(...)`).

### 5.1 `msToFrames` / `framesToMs` (CA-001)

```
msToFrames(ms, fps, rounding = "round"):
    exact = ms * fps / 1000
    return ROUND[rounding](exact)          // Math.round | Math.floor | Math.ceil

framesToMs(frames, fps, rounding = "round"):
    return ROUND[rounding](frames * 1000 / fps)
```

- `msToFrames(1000, 30)` → `30` ✓ · `msToFrames(999, 30, "floor")` → `⌊29.97⌋ = 29` ✓ ·
  `msToFrames(16, 60, "ceil")` → `⌈0.96⌉ = 1` ✓
- **`Math.round` redondea `.5` hacia +∞** (`Math.round(25.5) = 26`, `Math.round(109.5) = 110`).
  De esto dependen los frames exactos de CA-010: está fijado, no es "detalle de implementación".
- Precondición: `ms >= 0`, `frames >= 0` (garantizado por Zod en el borde). Las funciones **no**
  defienden; `fps` es una unión cerrada, así que nunca es 0.
- Ida y vuelta: `framesToMs(msToFrames(ms, fps), fps)` **no** es la identidad (pérdida por
  cuantización). El test de CA-001 afirma consistencia (`|ida-vuelta − ms| <= 1000/fps`), no
  identidad.

### 5.2 `defaultFormat` / `safeZoneFor` (CA-002)

Tablas literales, sin cálculo:

| preset | width × height | fps |
| ------ | -------------- | --- |
| `reels-9x16`, `tiktok-9x16`, `shorts-9x16` | 1080 × 1920 | 30 |
| `youtube-16x9` | 1920 × 1080 | 30 |

| aspecto | top | bottom | left | right |
| ------- | --- | ------ | ---- | ----- |
| `*-9x16` | 220 | 400 | 60 | 140 |
| `youtube-16x9` | 60 | 60 | 60 | 60 |

`safeZoneFor` decide por `format.preset` (dato explícito), **no** por `width < height`: un formato
custom 9:16 con preset de YouTube debe devolver lo que dice su preset, y el preset es el contrato.

### 5.3 `detectSilencesFromWords` (CA-003)

```
detectSilencesFromWords(transcription, { minSilenceMs = 500 }):
    words = transcription.words
    out = []
    for i in 0 .. words.length - 2:
        gap = words[i+1].startMs - words[i].endMs
        if gap >= minSilenceMs:                       // D-12: INCLUSIVO
            out.push({ startMs: words[i].endMs, endMs: words[i+1].startMs })
    return out
```

**Casos borde**

- `words.length < 2` → `[]`.
- Huecos de 300 / 500 / 800 con default → se reportan **500 y 800** (CA-003, D-12).
- `gap <= 0` (palabras contiguas o solapadas) → nunca supera el umbral; no hace falta guarda extra.
- **Silencio inicial** (antes de la primera palabra) y **final** (después de la última): **no** se
  reportan — la función solo mira *huecos entre palabras*, tal como dice la spec. Ese material lo
  aporta `silencedetect` de FFmpeg en cycle-02 y entra por `mergeSilences`. Documentado en el README
  para que no se confunda con un bug.
- `minSilenceMs: 0` → reporta todo hueco > 0; válido y determinista.

### 5.4 `mergeSilences` (CA-004)

Unión de intervalos clásica sobre la concatenación de ambas fuentes:

```
mergeSilences(a, b):
    all = [...a, ...b]
      .filter(r => r.endMs > r.startMs)
      .sort((x, y) => x.startMs - y.startMs || x.endMs - y.endMs)
    if all is empty: return []
    out = [ { ...all[0] } ]
    for r in all[1..]:
        last = out[out.length - 1]
        if r.startMs <= last.endMs:                  // solapado O adyacente (RN-2)
            last.endMs = max(last.endMs, r.endMs)
        else:
            out.push({ ...r })
    return out
```

**Casos borde**

- `[1000,1600]` ∪ `[1500,2200]` → `[1000,2200]` ✓ (CA-004).
- Adyacentes exactos `[0,500]` ∪ `[500,900]` → `[0,900]` (RN-2 dice "se superponen **o son
  adyacentes**" → comparación `<=`).
- Contenido: `[1000,2000]` ∪ `[1200,1400]` → `[1000,2000]`.
- Rangos degenerados (`endMs <= startMs`) se descartan antes de ordenar.
- Cualquiera de las dos listas vacía → devuelve la otra, normalizada y ordenada (no es un
  passthrough: siempre sale ordenado y sin solapes).
- Es asociativa y conmutativa: `mergeSilences(a, b)` === `mergeSilences(b, a)`. Hay test.

### 5.5 `pruneSilences` (CA-005, CA-006)

Tres fases: recortar por padding → complementar → absorber keeps cortos.

```
pruneSilences(durationMs, silences, { paddingMs = 80, minKeepMs = 300 }):
    if durationMs <= 0: return { keeps: [], cuts: [] }

    # fase 1 — el corte real es el silencio menos el aire de cada lado
    rawCuts = []
    for s in mergeSilences(silences, []):                  # normaliza + clampea
        start = max(0, s.startMs) + paddingMs
        end   = min(durationMs, s.endMs) - paddingMs
        if end > start: rawCuts.push({ startMs: start, endMs: end })
    rawCuts = mergeSilences(rawCuts, [])                   # el padding puede volverlos disjuntos

    # fase 2 — partición: complemento de los cortes sobre [0, durationMs]
    segments = []            # lista alternada { type: 'keep' | 'cut', startMs, endMs }
    cursor = 0
    for c in rawCuts:
        if c.startMs > cursor: segments.push({ type: 'keep', startMs: cursor, endMs: c.startMs })
        segments.push({ type: 'cut', startMs: c.startMs, endMs: c.endMs })
        cursor = c.endMs
    if cursor < durationMs: segments.push({ type: 'keep', startMs: cursor, endMs: durationMs })

    # fase 3 — absorción de keeps por debajo del mínimo utilizable (RN-4)
    repeat until no change (máx. segments.length iteraciones):
        for each keep k con (k.endMs - k.startMs) < minKeepMs:
            if k es el ÚNICO keep de segments: dejarlo (regla del último keep)
            else: convertir k en 'cut' y fusionarlo con los 'cut' adyacentes
    coalescer 'cut' contiguos; reasignar ids secuenciales (keep-0001…, cut-0001…)
    return { keeps: segments.filter(type=keep), cuts: segments.filter(type=cut) }
```

**Verificación de CA-005** — `durationMs = 10000`, `silences = [{4000, 5000}]`, defaults:

| fase | resultado |
| ---- | --------- |
| 1 | `rawCuts = [{4080, 4920}]` (4000+80, 5000−80) |
| 2 | `keep [0,4080]` · `cut [4080,4920]` · `keep [4920,10000]` |
| 3 | 4080 ms y 5080 ms ≥ 300 → sin cambios |

Unión = `[0,10000]` exacta, sin huecos ni solapes ✓.

**Casos borde**

- **Silencio más corto que `2 × paddingMs`** (p. ej. 150 ms con padding 80): `end <= start` → no
  genera corte. Correcto: el aire se come el silencio entero.
- **Silencio pegado al borde**: `[0, 900]` → corte `[80, 820]`, keep inicial `[0,80]` de 80 ms <
  300 → se absorbe y el corte pasa a ser `[0, 820]`. Ese es exactamente CA-006.
- **Absorción en cadena**: keep corto entre dos cuts → el resultado es **un solo** cut que abarca
  `cutIzq ∪ keep ∪ cutDer`; por eso hace falta coalescer y por eso el bucle es a punto fijo.
- **Regla del último keep**: si absorber dejaría **cero** keeps, el keep se conserva aunque sea
  menor a `minKeepMs`. Sin esta regla, un clip que es casi todo silencio produciría una timeline de
  duración 0, que ni siquiera es representable (`durationFrames >= 1`). Es determinista y está
  testeada explícitamente.
- **Silencios fuera de `[0, durationMs]`** → se clampean en fase 1; los enteramente fuera
  desaparecen.
- **Sin silencios** → `{ keeps: [{0, durationMs}], cuts: [] }`.
- **Silencios solapados en la entrada** → los normaliza `mergeSilences` antes de nada; la función
  no asume que le pasan una lista limpia.
- Postcondición testeada siempre: `keeps ∪ cuts` ordenado es contiguo, arranca en 0 y termina en
  `durationMs` (RN-5).

### 5.6 `planPunchIns` (CA-007)

```
mulberry32(seed):
    a = seed >>> 0
    return () =>
        a = (a + 0x6D2B79F5) >>> 0
        t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296     // [0, 1)

planPunchIns(keeps, { seed, every = 2, scales = [1.10, 1.15], anchor = 'center' }):
    if every < 1 or scales is empty: return []
    next = mulberry32(seed)
    out = []
    for i, keep in keeps:                                # orden de entrada, ya ordenado
        if (i + 1) % every != 0: continue                # alternancia 1-based
        scale = scales[floor(next() * scales.length)]    # el PRNG avanza SOLO al seleccionar
        out.push({ id: sequentialId('punch', out.length), startMs: keep.startMs,
                   endMs: keep.endMs, scale, anchor, keepId: keep.id })
    return out
```

**Verificación de CA-007** — 5 keeps, `every: 2` → `(i+1) % 2 === 0` para `i = 1, 3` → punch-in en
el **2.º y 4.º** keep ✓. La escala sale de `scales`, luego siempre está en `[1.10, 1.15]` (RN-6) sin
necesidad de clamp. Misma entrada + mismo `seed` → mismas llamadas al PRNG en el mismo orden →
resultado idéntico ✓ (el test compara dos invocaciones con `toEqual`).

**Casos borde**

- **El PRNG avanza solo en los keeps seleccionados.** Decisión explícita: hace que la secuencia de
  escalas dependa de *cuántos* punch-ins hay, no de cuántos keeps se descartaron. Cambiar esto
  cambia el resultado de CA-007 aunque el test de "2.º y 4.º" siga pasando — está congelado acá.
- `every: 1` → punch-in en todos los keeps. `every > keeps.length` → `[]`.
- `scales` de un solo valor → ese valor siempre (el PRNG igual avanza, para no acoplar la secuencia
  a la longitud de `scales`).
- El punch-in **cubre el keep completo** (`startMs`/`endMs` del keep), lo que satisface RN-8 por
  construcción y hace que E4/E6 nunca fallen sobre la salida de esta función.
- `seed` negativo o fraccionario: `>>> 0` lo normaliza a uint32; determinista igual.
- Keeps más cortos que un umbral **no** se filtran: no hay regla de producto para eso y agregarla
  sería inventar. Si aparece, es opción nueva en otro ciclo.

### 5.7 `groupWordsForCaptions` (CA-008) — **D-14: el hueco que cierra un grupo**

> **D-14 (ambigüedad que dejó abierta el funcional).** "Una palabra aislada por un hueco largo
> forma su propio grupo" no define *cuán largo*. **Se fija `maxGapMs = 500 ms` por defecto, con
> corte inclusivo (`gap >= maxGapMs` cierra el grupo)**, alineado con `minSilenceMs` de D-12: si un
> hueco es suficiente para considerarse silencio y podarse, también es suficiente para cortar un
> subtítulo. Un solo número de producto para las dos reglas, y es configurable.

```
groupWordsForCaptions(words, { maxWords = 3, maxDurationMs = 1200,
                               minDurationMs = 300, maxGapMs = 500,
                               emphasisKeywords = [] }):
    groups = []; current = []
    for w in words:
        if current is empty: current = [w]; continue
        gap       = w.startMs - last(current).endMs
        candidate = w.endMs - current[0].startMs
        if gap >= maxGapMs or current.length >= maxWords or candidate > maxDurationMs:
            groups.push(current); current = [w]
        else:
            current.push(w)
    if current not empty: groups.push(current)

    # extensión de los grupos demasiado cortos (RN-10), sin invadir al siguiente
    plans = []
    for j, g in groups:
        startMs = g[0].startMs
        endMs   = last(g).endMs
        if endMs - startMs < minDurationMs:
            wanted = startMs + minDurationMs
            endMs  = (j + 1 < groups.length) ? min(wanted, groups[j+1][0].startMs) : wanted
        plans.push({ id: sequentialId('cap', j), startMs, endMs, words: g,
                     emphasisIndex: pickEmphasisIndex(g, emphasisKeywords) })
    return plans
```

**Casos borde**

- **7 palabras seguidas** → grupos de 3 / 3 / 1; ninguno supera 1200 ms porque la palabra que
  excedería abre grupo nuevo ✓ (CA-008).
- **Palabra aislada** con hueco ≥ 500 ms antes y después → grupo propio ✓ (CA-008).
- **Una sola palabra más larga que `maxDurationMs`** (p. ej. 1500 ms): queda **sola** en su grupo y
  el grupo supera `maxDurationMs`. Es la única violación tolerada de RN-10 y es deliberada: partir
  una palabra en dos subtítulos es peor producto que un subtítulo largo. Test explícito.
- **Extensión hasta `minDurationMs`**: es *best effort*. Si el grupo siguiente arranca antes, se
  clampea contra él y el grupo puede quedar por debajo del mínimo — nunca se generan solapes entre
  grupos (que sí romperían la timeline).
- La extensión del **último** grupo no tiene tope acá; `buildTimeline` la recorta al final del keep
  que lo contiene (5.10), así que nunca se sale de la timeline.
- `words` vacío → `[]`. `maxWords < 1` → se trata como 1.
- La función **no** conoce keeps: opera sobre la transcripción completa. Quien arme una EDL debe
  filtrar/recortar los grupos a los keeps antes de emitir decisiones (E4 lo verifica).

### 5.8 `pickEmphasisIndex` (CA-009)

```
normalizeWordText(t):
    return t.toLowerCase()
            .normalize('NFD').replace(/\p{M}/gu, '')      // saca tildes: "gratís" → "gratis"
            .replace(/[^\p{L}\p{N}]/gu, '')               // saca puntuación: "¡gratis!" → "gratis"

pickEmphasisIndex(words, emphasisKeywords = []):
    if words is empty: return 0
    keys = new Set(emphasisKeywords.map(normalizeWordText)) menos la cadena vacía
    if keys not empty:
        for i, w in words:                                # PRIMER match gana
            if keys.has(normalizeWordText(w.text)): return i
    best = 0
    for i in 1 .. words.length - 1:
        if (words[i].endMs - words[i].startMs) >= (words[best].endMs - words[best].startMs):
            best = i                                      # '>=' ⇒ el empate lo gana el ÚLTIMO
    return best
```

- Keyword presente → esa palabra ✓; varias keywords en el grupo → la de **menor índice**.
- Sin keywords → la de mayor duración hablada; **empate → la última** (`>=`, no `>`) ✓ (RN-11).
- Comparación normalizada (minúsculas, sin tildes, sin puntuación): `"¡Gratis!"` matchea `"gratis"`.
  El match es por **palabra completa**, no por substring — `"gratuito"` no matchea `"gratis"`.
- Grupo vacío → `0` (defensivo; los grupos reales tienen ≥ 1 palabra por construcción).

### 5.9 `planDucking` (CA-010, CA-011)

```
mergeVoiceRanges(ranges, holdMs):
    sorted = [...ranges].filter(r => r.endMs > r.startMs).sort(by startMs)
    valleys = []
    for r in sorted:
        last = valleys[valleys.length - 1]
        if last exists and (r.startMs - last.endMs) < holdMs:      # RN-14, estricto
            last.endMs = max(last.endMs, r.endMs)
        else:
            valleys.push({ ...r })
    return valleys

planDucking(voiceRanges, plan, fps):
    { baseGainDb, duckedGainDb, attackMs, releaseMs, holdMs } = plan
    valleys = mergeVoiceRanges(voiceRanges, holdMs)
    if valleys is empty: return { automation: [], decisions: [] }

    keys = []
    for v, i in valleys:
        attackStartMs  = max(0, v.startMs - attackMs)               # el ataque TERMINA con la voz
        releaseStartMs = v.endMs + holdMs
        releaseEndMs   = releaseStartMs + releaseMs
        nextAttackMs   = (i + 1 < valleys.length)
                           ? max(0, valleys[i+1].startMs - attackMs) : +Infinity
        clampedEndMs   = min(releaseEndMs, nextAttackMs)            # ver caso borde 3
        endGainDb      = duckedGainDb + (baseGainDb - duckedGainDb)
                         * (clampedEndMs - releaseStartMs) / releaseMs

        if i == 0 and attackStartMs > 0: push(0, baseGainDb)
        push(msToFrames(attackStartMs, fps),  baseGainDb)
        push(msToFrames(v.startMs, fps),      duckedGainDb)
        push(msToFrames(releaseStartMs, fps), duckedGainDb)
        push(msToFrames(clampedEndMs, fps),   endGainDb)

    automation = dedupe(keys)          # mismo frame ⇒ gana el ÚLTIMO empujado
    decisions  = valleys.map((v, i) => ({ id: sequentialId('duck', i),
                                          startMs: v.startMs, endMs: v.endMs,
                                          gainDb: duckedGainDb }))
    return { automation, decisions }
```

**Verificación exacta de CA-010** — voz `[1000, 3000]` ms, 30 fps, defaults
(−12 / −24 dB, attack 150, hold 250, release 400):

| # | instante | cálculo del frame | frame | gainDb |
| - | -------- | ----------------- | ----- | ------ |
| 1 | 0 ms (inicio, base) | — | **0** | **−12** |
| 2 | 850 ms (arranca el ataque) | `round(850 × 30 / 1000) = round(25.5)` | 26 | −12 |
| 3 | 1000 ms (llega la voz) | `round(30.0)` | **30** | **−24** |
| 4 | 3250 ms (fin del hold) | `round(97.5)` | 98 | −24 |
| 5 | 3650 ms (fin del release) | `round(109.5)` | **110** | **−12** |

Coincide punto por punto con CA-010: `−12 dB` en frame 0, `−24 dB` alcanzado en frame 30, y el
regreso a `−12 dB` terminando en `round((3000 + 250 + 400) / 1000 × 30) = 110` ✓. Los 5 keyframes
son la salida completa; la interpolación entre ellos es lineal y la resuelve el consumidor
(Remotion `interpolate` en cycle-03), no esta función.

**Casos borde**

1. **Voz que arranca antes del ataque** (`v.startMs < attackMs`): `attackStartMs` se clampea a 0 y
   **no** se emite el keyframe extra de base — el frame 0 ya es el arranque de la rampa.
2. **Fusión de valles (CA-011)**: `[1000,2000]` y `[2100,3000]` con `holdMs = 250` → gap 100 < 250 →
   un único valle `[1000,3000]` → **un solo** descenso, la música no vuelve a subir en el medio ✓.
   Comparación **estricta** (`<`), literal según RN-14: un gap de exactamente 250 ms **no** fusiona.
3. **Valles no fusionados pero con release invadido** (gap ≥ `holdMs` pero
   `releaseEnd > siguiente attackStart`): el release se **trunca** en el arranque del ataque
   siguiente y su gain se interpola linealmente (`endGainDb`), en vez de emitir keyframes fuera de
   orden. Garantiza `frame` monótonamente creciente en `automation`, que es lo que exige el
   contrato.
4. **Keyframes con el mismo frame** (fps bajo o rampas muy cortas): se deduplican conservando el
   **último** valor empujado — nunca dos entradas con el mismo `frame`, y el valor que queda es el
   más "avanzado" en la curva.
5. `voiceRanges` vacío o todo degenerado → `{ automation: [], decisions: [] }` (la música queda en
   su ganancia base, sin automation).
6. Rangos de voz **desordenados o solapados** en la entrada → los normaliza `mergeVoiceRanges`.
7. `releaseMs = 0` haría división por cero en `endGainDb`: si `releaseMs <= 0`, el retorno a base es
   un escalón (`endGainDb = baseGainDb`, `clampedEndMs = releaseStartMs`).

### 5.10 `remapMsAfterCuts` (CA-012)

```
remapMsAfterCuts(ms, keeps):
    sorted = [...keeps].sort(by startMs)
    acc = 0
    for k in sorted:
        if ms < k.startMs: return acc                  # cae en un cut ⇒ borde izquierdo
        if ms < k.endMs:   return acc + (ms - k.startMs)
        acc += k.endMs - k.startMs
    return acc                                          # después del último keep ⇒ duración total
```

**Verificación de CA-012** — keeps de CA-005 (`[0,4080]`, `[4920,10000]`), `ms = 6000`:
`k1` completo → `acc = 4080`; `6000 ∈ [4920,10000)` → `4080 + (6000 − 4920) = 4080 + 1080 = **5160**` ✓
(exactamente los 840 ms del corte descontados).

**Casos borde**

- `ms` **dentro de un cut** → devuelve el instante de timeline del **final del keep anterior**
  (= inicio del siguiente): el borde izquierdo, determinista.
- `ms` anterior al primer keep → `0`. `ms` posterior al último → suma total de keeps.
- `keeps` vacío → `0`.
- Es **monótona no decreciente** en `ms`; hay una property test barata que lo afirma sobre los
  fixtures.
- **No** es transition-aware: ver D-09. El README lo dice y `buildTimeline` no la usa para ubicar.

### 5.11 `buildTimeline` (CA-013)

```
buildTimeline(edl, assets, music?):
    fps    = edl.format.fps
    keeps  = decisions(type=keep) ordenados por startMs
    if keeps is empty: throw TimelineBuildError('EMPTY_AROLL')
    punches     = decisions(type=punch-in) ordenados por startMs
    transitions = decisions(type=transition)

    # 1. clips A-roll: un keep puede partirse si el punch-in cubre solo una parte
    arollClips = []; clipIdsByKeep = new Map()
    cursorFrame = 0
    for kIndex, keep in keeps:
        if kIndex > 0:
            t = transición cuyo atMs == keep.startMs
            if t: cursorFrame -= msToFrames(t.durationMs, fps)      # solape de la transición
        subRanges = splitKeepByPunchIns(keep, punches contenidos en keep)
                    # [ {startMs, endMs, scale} ... ] contiguo y ordenado; scale = 1 fuera del punch
        ids = []
        for sub in subRanges:
            durationFrames = max(1, msToFrames(sub.endMs - sub.startMs, fps))
            clip = { id: sequentialId('aroll', arollClips.length),
                     assetId: edl.sourceAssetId, from: cursorFrame, durationFrames,
                     trimStartMs: sub.startMs, muted: true,
                     transform: { scale: sub.scale, translateX: 0, translateY: 0 } }
            arollClips.push(clip); ids.push(clip.id); cursorFrame += durationFrames
        clipIdsByKeep.set(keep.id, ids)
    durationFrames = cursorFrame

    # 2. pista de voz: espeja los clips de A-roll (el A-roll va muted)
    voiceClips = arollClips.map(c => ({ id: sequentialId('voice', i), assetId: c.assetId,
                                        from: c.from, durationFrames: c.durationFrames,
                                        trimStartMs: c.trimStartMs, gainDb: 0 }))

    # 3. overlays: SIEMPRE relativos al clip del keep que los contiene (D-09)
    placeInKeep(startMs) = firstClipOf(keep).from + msToFrames(startMs - keep.startMs, fps)

    brollClips   = broll-overlay → { from: placeInKeep(d.startMs),
                                     durationFrames: max(1, msToFrames(d.endMs - d.startMs, fps)),
                                     assetId: d.assetId, fit: d.fit, trimStartMs: 0,
                                     muted: d.keepVoice !== false,
                                     transform: { scale: 1, translateX: 0, translateY: 0 } }

    captionClips = caption-group → { from, durationFrames (recortado al fin del keep, mín. 1),
                                     words: d.words.map(w => ({ text: w.text,
                                        fromFrame: placeInKeep(w.startMs) - from,       # RELATIVO
                                        durationFrames: max(1, msToFrames(w.endMs - w.startMs, fps)) })),
                                     emphasisIndex: d.emphasisIndex ?? pickEmphasisIndex(d.words),
                                     box: safeZoneBox(edl.format) }                      # D-10

    # 4. transiciones de la Timeline
    timelineTransitions = transitions.map(t => ({
        betweenClipIds: [ last(clipIdsByKeep[keepAnterior]), first(clipIdsByKeep[keepSiguiente]) ],
        kind: t.kind, direction: t.direction,
        durationFrames: max(1, msToFrames(t.durationMs, fps)),
        timing: t.timing === 'linear' ? { type: 'linear' } : DEFAULT_SPRING_TIMING }))

    # 5. audio
    duckRanges = decisions(type=duck) → { startMs: placeMs(d.startMs), endMs: placeMs(d.endMs) }
    audioMix = { ...DEFAULT_AUDIO_MIX_PLAN,
                 automation: music ? planDucking(duckRanges, DEFAULT_MUSIC_MIX, fps).automation : [] }
    musicClips = music ? [ { id: 'music-0001', assetId: music.assetId, from: 0,
                             durationFrames, trimStartMs: music.trimStartMs ?? 0,
                             gainDb: music.gainDb ?? audioMix.music.baseGainDb,
                             fadeInFrames: music.fadeInFrames, fadeOutFrames: music.fadeOutFrames } ] : []

    return { schemaVersion: 1, id: `timeline-${edl.sourceAssetId}`, format: edl.format,
             durationFrames, assets: [...assets],
             tracks: { aroll: arollClips, broll: brollClips, voice: voiceClips,
                       music: musicClips, captions: captionClips },
             transitions: timelineTransitions, audioMix, safeZone: safeZoneFor(edl.format) }
```

**Verificación de CA-013** con el fixture `ca013Edl` (§6, asset de 10 000 ms, `reels-9x16` @30):

| paso | número |
| ---- | ------ |
| `keep-0001 [0, 4080]` | `round(4080 × 30/1000) = round(122.4)` = **122** frames |
| `keep-0002 [4920, 10000]` | `round(5080 × 30/1000) = round(152.4)` = **152** frames |
| `trans-0001` (fade, 300 ms) | `round(9.0)` = **9** frames |
| `aroll-0001` | `from 0`, 122 frames, `scale 1` |
| `aroll-0002` | `from 122 − 9 = 113`, 152 frames, `scale 1.15` (punch-in cubre el keep entero) |
| `durationFrames` | `113 + 152 = 265` = **274 − 9** = Σ keeps − frames de transición ✓ |
| `broll-0001 [5200,7200]` | `from = 113 + round(280 × 30/1000 = 8.4) = 113 + 8 = 121`, 60 frames |
| `cap-0003 [5000,6000]` | `from = 113 + round(2.4) = 115`, 30 frames |

`validateTimeline(buildTimeline(ca013Edl, ca013Assets))` → `{ ok: true }` ✓.

**Casos borde**

- **`splitKeepByPunchIns`**: si un punch-in cubre solo parte del keep, el keep se parte en hasta 3
  clips A-roll contiguos (antes / con zoom / después), preservando `trimStartMs` y sin huecos. Un
  punch-in que cubre el keep completo produce **un solo** clip (el caso de `planPunchIns`). E6
  garantiza que dos punch-ins no se solapen, así que el split está bien definido.
- **La transición resta frames en el `from` del keep entrante**, y por eso `durationFrames` es
  exactamente "suma de keeps − transiciones" (CA-013). Si la transición durara más que el keep
  entrante, `cursorFrame` podría retroceder: `validateTimeline` lo reporta como `AROLL_OVERLAP`
  (no se silencia en build).
- **A-roll `muted: true` + pista `voice` espejo.** El audio del A-roll se expone una sola vez, en la
  pista de voz, que es la que la spec 004 va a normalizar y mezclar. Sin esto, la voz sonaría dos
  veces o quedaría fuera del plan de mezcla.
- **Frames relativos en `captionClip.words`**: `fromFrame` es relativo al `from` del clip (lo que
  espera `<Sequence>` de Remotion). Se calcula con `placeInKeep` y se resta el `from` del clip, por
  lo que la palabra 0 casi siempre queda en `fromFrame: 0` y nunca negativo (se clampea a 0).
- **Caption que se pasa del keep** (por la extensión de `minDurationMs`, 5.7): se recorta al último
  frame del keep, con mínimo 1 frame.
- **`music` ausente** → `tracks.music: []` y `audioMix.automation: []`. Las decisiones `duck` sin
  música no generan automation (no hay qué duckear).
- **`assets` incompleto** → se copia tal cual; el `ASSET_NOT_FOUND` lo levanta `validateTimeline`.
- `anchor` del punch-in se descarta (D-11).
- `DEFAULT_SPRING_TIMING = { type: 'spring', damping: 200, stiffness: 100, mass: 1 }` (coherente con
  el ejemplo de CA-024); `timing` ausente en la decisión ⇒ `spring`.

### 5.12 `validateTimeline` (CA-014)

Acumula **todos** los issues; nunca corta en el primero.

```
validateTimeline(timeline):
    parsed = TimelineSchema.safeParse(timeline)
    if not parsed.success:
        return { ok: false, issues: parsed.error.issues.map(i => ({
            code: 'SCHEMA_INVALID', path: formatPath(i.path), message: i.message })) }

    issues = []
    byId = Map(assets by id)
    aroll = [...timeline.tracks.aroll].sort(by from)

    if aroll is empty: issues.push('EMPTY_AROLL', 'tracks.aroll')

    for track in ['aroll','broll','voice','music'], for i, clip in track:
        asset = byId.get(clip.assetId)
        if not asset:
            issues.push('ASSET_NOT_FOUND', `tracks.${track}[${i}].assetId`)
        else:
            usedMs = clip.trimStartMs + framesToMs(clip.durationFrames, fps, 'ceil')
            if asset.kind != 'image' and usedMs > asset.durationMs:
                issues.push('CLIP_EXCEEDS_ASSET', `tracks.${track}[${i}].durationFrames`)
        if clip.from < 0 or clip.from + clip.durationFrames > timeline.durationFrames:
            issues.push('CLIP_OUT_OF_TIMELINE', `tracks.${track}[${i}].from`)

    for i in 1 .. aroll.length - 1:
        prevEnd  = aroll[i-1].from + aroll[i-1].durationFrames
        overlap  = frames de la transición declarada entre aroll[i-1].id y aroll[i].id (0 si no hay)
        if aroll[i].from < prevEnd - overlap: issues.push('AROLL_OVERLAP', `tracks.aroll[${i}].from`)
        if aroll[i].from > prevEnd - overlap: issues.push('AROLL_GAP',     `tracks.aroll[${i}].from`)

    if last(aroll).from + last(aroll).durationFrames != timeline.durationFrames:
        issues.push('DURATION_MISMATCH', 'durationFrames')

    for t in timeline.transitions:
        if algún betweenClipIds no resuelve a un clip: issues.push('TRANSITION_CLIP_NOT_FOUND', ...)

    for i, c in timeline.tracks.captions:
        if c.box and not fitsInSafeZone(c.box, timeline.safeZone, timeline.format):
            issues.push('CAPTION_OUT_OF_SAFE_ZONE', `tracks.captions[${i}].box`)

    return issues is empty ? { ok: true } : { ok: false, issues }
```

`fitsInSafeZone(box, sz, fmt)` = `box.x >= sz.left && box.y >= sz.top &&
box.x + box.width <= fmt.width - sz.right && box.y + box.height <= fmt.height - sz.bottom`.

**Casos borde**

- **CA-014 exige un issue por caso**: los cuatro (`ASSET_NOT_FOUND`, `CLIP_EXCEEDS_ASSET`,
  `AROLL_OVERLAP`, `CAPTION_OUT_OF_SAFE_ZONE`) se testean sobre **una misma** timeline rota, y el
  test afirma `issues.length === 4` con los `path` exactos — por eso hace falta acumular y no
  abortar.
- **Imágenes**: `durationMs = 0` por contrato, así que `CLIP_EXCEEDS_ASSET` **no** aplica a
  `kind: 'image'` (una foto se estira lo que haga falta). Excepción explícita.
- `framesToMs(..., 'ceil')` al comparar contra el asset: redondear hacia abajo dejaría pasar clips
  que se pasan por menos de un frame.
- **Solape permitido**: solo el que declara una transición entre ese par exacto de clips. Un solape
  sin transición asociada es `AROLL_OVERLAP`.
- `caption.box` ausente → no se valida geometría (D-10); la ubicación la decide cycle-03.
- El `path` es siempre una cadena estable tipo `tracks.aroll[1].from`, para que el reviewer pueda
  hacer diff de issues entre corridas.

---

## 6. Estrategia de fixtures (`src/__fixtures__/`)

Los fixtures son **datos literales tipados**, nunca generados: sin `Date`, sin `Math.random`, sin
builders con estado. Cada uno satisface más de un CA para que un cambio de comportamiento rompa
varios tests a la vez (señal fuerte) en lugar de uno solo.

### 6.1 `transcription.ts` — `spanishTranscription: Transcription`

20 palabras en español, `assetId: 'aroll-cam-01'`, `engine: 'whisper.cpp'`, `language: 'es'`.
Los huecos están **diseñados** para cubrir CA-003 (300 / 500 / 800 ms) y CA-008 (una palabra
aislada tras un hueco largo) con la misma pieza de datos:

| # | palabra | startMs | endMs | hueco previo |
| - | ------- | ------- | ----- | ------------ |
| 1 | hoy | 0 | 300 | — |
| 2 | te | 350 | 500 | 50 |
| 3 | muestro | 520 | 900 | 20 |
| 4 | cómo | 1200 | 1550 | **300** (no es silencio) |
| 5 | editar | 1570 | 2050 | 20 |
| 6 | un | 2070 | 2180 | 20 |
| 7 | video | 2680 | 3100 | **500** (silencio, límite inclusivo) |
| 8 | completo | 3120 | 3700 | 20 |
| 9 | sin | 3720 | 3860 | 20 |
| 10 | pagar | 4660 | 5050 | **800** (silencio) |
| 11 | nada | 5070 | 5400 | 20 |
| 12 | es | 5420 | 5520 | 20 |
| 13 | totalmente | 5540 | 6200 | 20 |
| 14 | gratis | 6220 | 6700 | 20 |
| 15 | y | 6720 | 6800 | 20 |
| 16 | corre | 6820 | 7150 | 20 |
| 17 | en | 7170 | 7260 | 20 |
| 18 | tu | 7280 | 7380 | 20 |
| 19 | propia | 7400 | 7800 | 20 |
| 20 | máquina | 7820 | 8400 | 20 |

Lo que habilita, con un solo fixture:

- **CA-003**: con `minSilenceMs: 500` se detectan exactamente **dos** silencios —
  `[2180, 2680]` y `[3860, 4660]`— y **no** el hueco de 300 ms.
- **CA-008**: las palabras 10–20 son 11 palabras corridas (huecos de 20 ms) → grupos de 3/3/3/2,
  todos ≤ 1200 ms; la palabra 4 ("cómo") es la que queda aislada si se sube `maxGapMs` a 300.
- **CA-009**: `emphasisKeywords: ['gratis']` marca la palabra 14; sin keywords, en su grupo gana
  "totalmente" (660 ms), que es la más larga — dos aserciones distintas sobre las mismas palabras.
- `segments` incluye 2 entradas con `wordRange` `[0, 8]` y `[9, 19]` para ejercitar T4.

Además, `overlappingWords` (fixture chico, 3 palabras con solape) para el rechazo de T3 y para
`normalizeTranscriptionWords`.

### 6.2 `assets.ts` — `MediaAsset` mock

```ts
export const arollAsset: MediaAsset = {
  id: 'aroll-cam-01', kind: 'video', path: '/fixtures/aroll-cam-01.mp4',
  durationMs: 10_000, fps: 30, width: 1080, height: 1920, rotation: 0,
  hasAudio: true, audio: { sampleRate: 48_000, channels: 2, codec: 'aac' },
  videoCodec: 'h264', probedAt: '2026-09-07T00:00:00.000Z',
};
export const brollAsset: MediaAsset = { id: 'broll-shot-01', kind: 'image', durationMs: 0, … };
export const musicAsset: MediaAsset = { id: 'music-bed-01', kind: 'audio', durationMs: 120_000, … };
export const ca013Assets = [arollAsset, brollAsset, musicAsset] as const;
```

`probedAt` es una constante literal: ningún fixture llama a `new Date()` (lo bloquea el lint de
D-03). `brollAsset` es `image` con `durationMs: 0` a propósito: valida la excepción de
`CLIP_EXCEEDS_ASSET` para imágenes.

### 6.3 `edl.ts` — `ca013Edl: EditDecisionList` (CA-013)

Composición exigida por CA-013: **2 keeps, 1 cut, 1 punch-in, 1 B-roll, 1 transición, 3
caption-groups**. Los rangos son los de CA-005, para que el fixture ate CA-005 → CA-012 → CA-013:

| id | tipo | rango (ms) | detalle |
| -- | ---- | ---------- | ------- |
| `keep-0001` | keep | 0 – 4080 | |
| `cut-0001` | cut | 4080 – 4920 | `reason: 'silence'` |
| `keep-0002` | keep | 4920 – 10000 | |
| `punch-0001` | punch-in | 4920 – 10000 | `scale: 1.15`, `anchor: 'center'` (cubre el keep entero) |
| `broll-0001` | broll-overlay | 5200 – 7200 | `assetId: 'broll-shot-01'`, `fit: 'cover'`, `keepVoice: true` |
| `trans-0001` | transition | `atMs: 4920` | `kind: 'fade'`, `durationMs: 300`, `timing: 'spring'` |
| `cap-0001` | caption-group | 500 – 1600 | 3 palabras, dentro de `keep-0001` |
| `cap-0002` | caption-group | 1700 – 2800 | 3 palabras, dentro de `keep-0001` |
| `cap-0003` | caption-group | 5000 – 6000 | 2 palabras, dentro de `keep-0002` |

`format: defaultFormat('reels-9x16')`, `sourceAssetId: 'aroll-cam-01'`, `schemaVersion: 1`,
`generatedBy: { tool: 'fixture', params: {} }`. `trans-0001.atMs === keep-0002.startMs` satisface
E5 y produce el par `betweenClipIds: ['aroll-0001', 'aroll-0002']`.

Variantes derivadas (definidas **por spread** del fixture base, para que un cambio del base se
propague):

- `invalidPunchInEdl` — CA-015: `punch-0001` movido a `[4200, 4600]`, dentro de `cut-0001`;
  `EditDecisionListSchema.safeParse` debe fallar con `path` `['decisions', 3]`.
- `brokenTimeline` — CA-014: se construye la Timeline de CA-013 y se la rompe en cuatro puntos
  (assetId inexistente en un clip de B-roll, `durationFrames` que excede el A-roll, `from` de
  `aroll-0002` adelantado para solapar sin transición, `captions[0].box` fuera del safe zone).

---

## 7. Reglas de implementación (no negociables)

1. **Cero comentarios** en `src/**` y `tools/**`. Si una línea pide explicación, el arreglo es
   extraer una función cuyo nombre sea esa explicación (`absorbShortKeepsIntoCuts`,
   `splitKeepByPunchIns`, `fitsInSafeZone`). La única excepción admitida es una línea que ancle una
   regla contra-intuitiva a su criterio, p. ej. `// >= is inclusive per CA-003` sobre la comparación
   de D-12 — y solo esa.
2. **Cero `any`** (`@typescript-eslint/no-explicit-any: error`). Para el JSON Schema generado se usa
   `type JsonValue` / `JsonObject` recursivos, nunca `Record<string, any>`.
3. **Cero `Date`, `Math.random`, `process.env`** en `src/**` — verificado por ESLint (D-03), no por
   revisión humana.
4. **Cero I/O y cero React** en `src/**`. `node:fs` solo en `tools/generate-schemas.ts` y en
   `schemas.spec.ts`.
5. **Superficie pública solo en `src/index.ts`**; nada de imports profundos desde fuera de la lib.
6. **Funciones puras**: no mutan sus argumentos (copiar antes de ordenar) y no comparten estado
   entre llamadas.
7. **Un archivo, una familia de funciones**; funciones cortas. Los archivos de test se llaman como
   los pide la tabla de CA de la spec.
8. **Ningún test depende del orden de ejecución** ni usa `vi.useFakeTimers` (no hay reloj que fingir).
9. `pnpm exec nx run-many -t lint test build` y `pnpm sdd:validate` en verde al cierre (RNF-9).

---

## 8. Cambios en schema (`sdd/schema.json`) — **NO APLICA**

Este ciclo **no crea ni modifica ninguna tabla**. `libs/timeline-core` es una lib de dominio
en memoria: no hay motor de base de datos, ni ORM, ni migraciones en todo el módulo
`core-composition-media-pipeline`. El estado del producto vive en documentos JSON (`Timeline`,
`EditDecisionList`) que la spec 005 (`render-service`) decidirá cómo persistir.

**`sdd/schema.json` no se toca en este ciclo.** No se agrega un app-key vacío para
`timeline-core`: un key sin tablas es ruido en el registro y en el visor.

Los "schemas" de este ciclo son **JSON Schema de contratos de datos**, no schema de base de datos, y
viven versionados en `libs/timeline-core/schemas/*.schema.json` (ver D-06).

## 9. Contratos de API (`sdd/api.json`) — **NO APLICA**

Este ciclo **no define ningún endpoint HTTP**. `timeline-core` no expone red: es una lib importada
en proceso. Los endpoints locales llegan con `spec-e-burgos-005-render-service`.

**`sdd/api.json` no se toca en este ciclo.** El "contrato" que consume el resto del sistema es la
**API pública de TypeScript** de la sección 4 más los JSON Schema commiteados, y ambos están
versionados en el propio repo de la lib.

> Los `agent_contexts.architect.existing_tables` y `existing_endpoints` del `brief.yaml` ya vienen
> vacíos: es coherente y esperado.

## 10. Dependencias externas

| Paquete | Versión | Dónde se declara | Motivo |
| ------- | ------- | ---------------- | ------ |
| `zod` | `^4.5` | `dependencies` del **`package.json` raíz** | Schemas de los 6 contratos, invariantes por `superRefine` y `z.toJSONSchema()` nativo (Zod 4) |

- Va en el **root** porque el repo trabaja con un único `package.json` y dependencias hoisted
  (D-01); se instala con `pnpm add zod@^4.5 -w`.
- Es `dependencies`, no `devDependencies`: `zod` se ejecuta en runtime dentro de la lib.
- **Es la única dependencia de runtime del ciclo.** Nada de `date-fns`, `lodash`, `uuid`,
  `seedrandom` ni `ajv` en `timeline-core`: el PRNG son 6 líneas propias (5.6), los ids son
  determinísticos (D-13) y no hay fechas que manipular.
- Herramientas ya presentes en el root y reutilizadas sin instalar nada: `vitest`,
  `@vitest/coverage-v8`, `typescript`, `eslint`, `@nx/js`, `@nx/vite`, `@swc-node/register`.
- Remotion, `execa`, `ffmpeg` y Whisper son de los ciclos 02 y 03: **no** se instalan acá.

## 11. Trazabilidad CA → archivo → función

| CA | Test | Función bajo prueba |
| -- | ---- | ------------------- |
| CA-001 | `units/units.spec.ts` | `msToFrames`, `framesToMs` |
| CA-002 | `format/format.spec.ts` | `defaultFormat`, `safeZoneFor` |
| CA-003 | `silence/silence.spec.ts` | `detectSilencesFromWords` |
| CA-004 | `silence/silence.spec.ts` | `mergeSilences` |
| CA-005 | `silence/prune.spec.ts` | `pruneSilences` (partición exacta) |
| CA-006 | `silence/prune.spec.ts` | `pruneSilences` (absorción por `minKeepMs`) |
| CA-007 | `punch-in/punch-in.spec.ts` | `planPunchIns` + `mulberry32` |
| CA-008 | `captions/captions.spec.ts` | `groupWordsForCaptions` |
| CA-009 | `captions/captions.spec.ts` | `pickEmphasisIndex` |
| CA-010 | `ducking/ducking.spec.ts` | `planDucking` (keyframes 0/26/30/98/110) |
| CA-011 | `ducking/ducking.spec.ts` | `mergeVoiceRanges` dentro de `planDucking` |
| CA-012 | `silence/remap.spec.ts` | `remapMsAfterCuts` |
| CA-013 | `timeline/build-timeline.spec.ts` | `buildTimeline` + `validateTimeline` |
| CA-014 | `timeline/validate-timeline.spec.ts` | `validateTimeline` (4 issues, 4 `path`) |
| CA-015 | `schemas/schemas.spec.ts` | `EditDecisionListSchema.safeParse` (E4) |
| CA-016 | `schemas/schemas.spec.ts` | `buildJsonSchemaBundle` + `serializeJsonSchemaFile` |

## 12. Riesgos y puntos abiertos declarados

| # | Riesgo | Mitigación / decisión |
| - | ------ | --------------------- |
| R-1 | La serialización de `z.toJSONSchema()` (`anyOf` vs `oneOf`, orden de claves) no es idéntica al JSON de la spec | D-06: el generador manda sobre la serialización, la spec sobre los campos. Se declara en el fragmento de contexto del cierre |
| R-2 | `captionClip.box` es un campo que la spec no tiene | D-10: aditivo y opcional, es el mínimo para que CA-014 sea verificable. Delta explícito para el reviewer |
| R-3 | `anchor` del punch-in se pierde al construir la Timeline, y CA-026 (cycle-03) lo necesita | D-11: no se extiende el contrato en este ciclo; queda anotado para que cycle-03 decida dónde ubicarlo |
| R-4 | Contradicción spec/funcional sobre el umbral de silencio (`>` vs `>=`) | D-12: manda el criterio de aceptación (inclusivo). Si el dev quiere `>`, cambia CA-003 primero |
| R-5 | El hueco que cierra un grupo de captions no estaba definido | D-14: `maxGapMs = 500` inclusivo, configurable |
| R-6 | `@nx/js:lib` de Nx 23 puede generar un `package.json` que renombre el proyecto | D-01 contingencia: `project.json` con `"name": "timeline-core"` manda; verificar con `pnpm nx show projects` |
| R-7 | Un bump de `zod` cambia el JSON Schema generado y rompe CA-016 | Es el comportamiento deseado: el test es el detector de cambio de contrato. Se regenera con `pnpm nx run timeline-core:schemas` y se revisa el diff en el PR |
| R-8 | La cobertura del 85 % puede quedar corta si `buildTimeline` acumula ramas de casos borde | Cada caso borde de la sección 5 tiene su test nombrado; los barrels y fixtures están excluidos de cobertura |
