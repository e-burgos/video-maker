# TASK-011 — notas (para el reviewer y el fragmento de contexto)

## Runtime del generador: `node -r @swc-node/register`, no `--import @swc-node/register/esm-register`

El target `schemas` de architect.md D-06 proponía
`node --import @swc-node/register/esm-register ./tools/generate-schemas.ts`. En este entorno
(Node 22.22.2, root `package.json` sin `"type": "module"`, ninguna lib con `package.json` propio)
ese loader ESM falla: para cada `.ts` local sin `package.json` que declare `type`, el `resolve()`
de `@swc-node/register/esm` cae a `format: 'commonjs'`, y el interop ESM↔CJS resultante hace que
hasta un import trivial (`import { MsSchema } from './primitives'`) explote con
`SyntaxError: ... does not provide an export named 'MsSchema'`.

El fallback que el propio D-06 preveía (`node --experimental-strip-types`) tampoco sirve tal cual:
Node exige extensión explícita en cada especificador (`./primitives.ts`), y todo el código fuente
de la lib usa imports relativos **sin** extensión (`./primitives`, no `./primitives.ts`) — reescribir
esos imports está fuera del alcance de esta task y rompería la convención del resto del repo.

**Solución aplicada:** `node -r @swc-node/register ./tools/generate-schemas.ts` (registro **CJS**
clásico de `@swc-node/register`, no el hook ESM). Transpila todo a CommonJS de punta a punta sin
cruzar el límite ESM/CJS, resuelve imports sin extensión igual que Vitest/tsc, y no requiere tocar
ningún `package.json`. `project.json → targets.schemas.options.command` quedó así. Verificado
determinista: dos corridas consecutivas de `pnpm nx run timeline-core:schemas` no producen diff.

## `z.toJSONSchema(registry, …)` genera un documento `__shared` cuando dos archivos reusan la misma subestructura Zod

`EditDecisionListSchema.generatedBy.params` usa `z.record(z.string(), z.json())`. `z.json()` es
recursivo, y cuando se convierte un **registry** completo (no un schema suelto), Zod extrae
cualquier subestructura Zod compartida a un documento sintético `schemas.__shared` con su propio
`$defs`, referenciado como `"$ref": "__shared.schema.json#/$defs/schemaN"` — sin flag público para
desactivarlo (`reused: 'inline'` solo afecta reuso *dentro* de un mismo documento, no entre
documentos del registry; confirmado leyendo `node_modules/zod/src/v4/core/json-schema-processors.ts`
línea ~817).

Un `__shared.schema.json` no commiteado rompería CA-016 (6 archivos exactos, autocontenidos).
**Solución:** `src/schemas/json-schema.ts` post-procesa el resultado — para cada uno de los 6
documentos, detecta sus `$ref` a `__shared.schema.json#/$defs/*` (con clausura transitiva, por si
el propio `$defs` referenciado se autorreferencia, como pasa acá), los reescribe a `#/$defs/<id>`
locales y copia esas definiciones dentro del `$defs` del documento que las usa. El documento
`__shared` se descarta. Determinista y sin tocar los schemas Zod de negocio. Único caso real hoy:
`edit-decision-list.schema.json` obtiene un `$defs.schema0` local (el tipo JSON recursivo).

Esto extiende el protocolo de D-06 (paso 2: "$schema/$id deterministas, elimina `id` suelto") con
un paso adicional no anticipado por el architect. No cambia ningún campo/enum/constraint — es
puramente de fontanería de referencias.

## `oneOf` en vez de `anyOf` para las uniones discriminadas

D-06 predice `anyOf` para `EditDecisionSchema` y `TransitionTimingSchema` (`z.discriminatedUnion`).
La build real de Zod 4.5.4 emite `oneOf` (con `const` en el discriminante igual). D-06 ya cubre
esto explícitamente ("el generador manda... no es una desviación de contrato"), pero se anota
porque el ejemplo concreto de la predicción no coincidió con el runtime real.

## `normalizeTranscriptionWords` — implementado en esta task, no en TASK-002

D-08 de architect.md exige `normalizeTranscriptionWords(words)` como función pública (D-08: "la
normalización se expone como función pura aparte... que los parsers de `media-local` (cycle-02)
aplican antes de validar") y la sección 4.7 la lista como parte de la superficie final de
`src/index.ts`. Ni `planner.md` (TASK-002) ni el código de `TASK-002/003` la incluyeron — es un
hueco entre el contrato del architect y el detalle de planner, no una decisión de TASK-011.

Como el criterio de done de TASK-011 pide que `src/index.ts` exporte "exactamente la API pública
de architect.md §4 ... y nada interno", se implementó acá: `src/schemas/transcription.schema.ts`
exporta `normalizeTranscriptionWords(words: readonly Word[]): Word[]` — recorta el `endMs` de una
palabra al `startMs` de la siguiente cuando se solapan, sin mutar el array de entrada (regla de
sección 5 de architect.md). 4 tests nuevos en `schemas.spec.ts`. El reviewer puede decidir si esto
amerita una línea en `constitution.md`/`context_prompt.md` del subproyecto o si con esta nota
alcanza.

## Export público: ajustes sobre el barrel existente

Auditado `src/index.ts` completo contra architect.md §4.1–4.7 (única fuente: "todo lo de esta
tabla se exporta desde `src/index.ts` y nada más", línea 499):

- **Agregados** (existían en el schema Zod pero faltaban en el barrel): `MusicMixSettingsSchema` +
  tipo `MusicMixSettings` (referenciado por la firma pública `planDucking(voiceRanges, plan:
  MusicMixSettings, fps)` de 4.5 — sin esto el tipo del segundo parámetro no era nombrable desde
  fuera de la lib), `VoiceTargetSchema` + tipo `VoiceTarget` (sección 2 los lista junto a
  `AudioMixPlanSchema`), y los tres exports nuevos de JSON Schema (`buildJsonSchemaBundle`,
  `timelineToJsonSchema`, `serializeJsonSchemaFile`) + tipos `JsonObject`/`JsonValue`/
  `SchemaFileName` (necesarios para que `tsc -p tsconfig.lib.json --declaration` pueda nombrar el
  tipo de retorno de esas funciones sin error de "private name").
- **Quitados** (no están en ninguna firma de §4, calificaban como "interno" bajo el criterio de
  esta task): `DEFAULT_SAFE_ZONES` (constante de `format/format.ts`, usada solo internamente por
  `safeZoneFor`) y `mergeVoiceRanges` (de `ducking/plan-ducking.ts`; su propio test importa por
  ruta relativa, no por el barrel, así que quitarlo no rompe nada). Ninguno de los dos se borró del
  archivo fuente — siguen siendo exports de su módulo, solo dejaron de re-exportarse desde el
  índice público.
- Se agregó el test de superficie que pide la sección 2 de architect.md ("un único test de
  superficie en `schemas.spec.ts` verifica que `index.ts` exporte todos los nombres de la tabla de
  la sección 4"): compara `Object.keys(import * as publicApi from '../index')` contra la lista
  explícita de 4.1–4.7 (solo exports en tiempo de ejecución — los `export type` se erasan y los
  cubre `tsc`, no este test).

## Verificación

- `pnpm nx run timeline-core:schemas` corrido dos veces seguidas → `git diff --stat
  libs/timeline-core/schemas` vacío ambas veces.
- `pnpm nx run-many -t lint test build -p timeline-core` → verde (207 tests, cobertura 97.29 %
  statements / 90.68 % branches / 99.42 % functions / 97.19 % lines).
- `pnpm exec nx run-many -t lint test build` (workspace completo) → verde.
- `pnpm sdd:validate` → verde.
