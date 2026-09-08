# Constitución — libs/timeline-core

> Versión 1.0 | Última actualización: spec-e-burgos-001 cycle-01 + spec-e-burgos-002 cycle-02 | Fecha: 2026-09-08
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-001-core-composition-media-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib de dominio (TypeScript puro, isomórfica)
- **Rol en el sistema:** fuente de verdad de los contratos de datos del motor de video
  (`Timeline`, `EditDecisionList`, `Transcription`, `MediaAsset`, `AudioMixPlan`, `OutputFormat`)
  y de los cálculos de edición que los producen y validan. Ninguna otra lib define esos tipos.

## 2. Stack tecnológico

- TypeScript estricto (ESM, `module: esnext`, `target: es2022`)
- Zod 4 para schemas y tipos inferidos; JSON Schema generado con `z.toJSONSchema()`
- Vitest para tests; sin dependencias de runtime fuera de `zod` (dev del workspace: `@swc-node/register` para el target `schemas`, Vitest 4 + `@vitest/coverage-v8`, Prettier)
- La lib **no tiene `package.json` propio**: se consume por source vía el alias de `tsconfig.base.json`

## 3. Estructura y patrones

- `src/index.ts` es la única superficie pública. `PunchInAnchorSchema` y `ClipTransformSchema` no se exportan ahí.
- `src/schemas/` — un archivo por contrato (`primitives.ts`, `registry.ts`, `json-schema.ts` incluidos), exporta el schema Zod y el tipo inferido
- `src/units/`, `src/format/`, `src/silence/`, `src/punch-in/`, `src/captions/`, `src/ducking/`, `src/timeline/` (`build-timeline.ts`, `validate-timeline.ts`, `remap-ms-after-cuts.ts`, `ids.ts`) — un módulo por familia de cálculos, funciones puras. Nombres de archivo: los de `tasks.json`/`planner.md` (`detect-silences.ts`, `plan-punch-ins.ts`, `remap-ms-after-cuts.ts`), no los abreviados de `architect.md` §2.
- `src/types/units.ts` — tipos de unidades (`Ms`, `Frame`)
- `schemas/*.schema.json` — JSON Schema generado y commiteado (test anti-drift). Se regenera con `pnpm nx run timeline-core:schemas` (`node -r @swc-node/register ./tools/generate-schemas.ts` — registro **CJS**; `--import @swc-node/register/esm-register` rompe por interop ESM/CJS en este repo). Determinista: dos corridas seguidas dejan `git diff` vacío. `schemas.spec.ts` compara byte a byte contra los 6 archivos de `schemas/` (CA-016), así que tras tocar cualquier schema Zod hay que correrlo y commitear el resultado.
- `src/schemas/json-schema.ts` post-procesa la salida de `z.toJSONSchema(registry)`: Zod extrae subestructuras compartidas a un documento sintético `__shared`, y el post-proceso las inlinea como `$defs` locales para que los 6 archivos queden autocontenidos.
- `ClipTransform` (en `tracks.aroll[]`/`tracks.broll[]` de `Timeline`) tiene un campo opcional `anchor: PunchInAnchor` (`src/schemas/timeline.schema.ts`, importa `PunchInAnchorSchema` de `./edit-decision-list.schema`). `buildTimeline` lo propaga desde `PunchInDecision.anchor` únicamente al sub-rango con zoom que ese punch-in genera (`KeepSubRange.anchor?`, tipo importado de `../punch-in/plan-punch-ins`); los sub-ranges sin zoom nunca lo llevan. Cambio aditivo y retrocompatible.
- `src/__fixtures__/` — EDL y transcripciones de ejemplo para tests; **no** se exportan desde `src/index.ts`
- **Targets de `project.json` (todos explícitos, sin targets inferidos por plugin):** `lint` (`@nx/eslint:lint`), `test` (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json` — typecheck + `.d.ts`; Vitest no typechequea) y `schemas`. Se quitaron de `nx.json` los plugins `@nx/vitest` (inferia `test` en modo watch, cuelga `nx run-many -t test` fuera de CI) y `@nx/eslint/plugin` (target `eslint:lint` duplicado). Matiza `architect.md` D-02/D-04: sin bundler, pero **con** target `build`.

## 4. Convenciones propias

- **Cero I/O y cero React**: no importar `node:*`, `fs`, `child_process` ni `react`
- **Determinismo**: nada de `Date.now()`, `Math.random()` ni lectura de `process.env`; la variación se recibe por `seed`
- **Unidades**: `Ms` (enteros) en el dominio de medios, `Frame` (enteros) en la timeline; una única función de conversión
- **Sin comentarios** en el código (regla del repo); nombres declarativos y funciones cortas
- ESLint de la lib impone mecánicamente las reglas de determinismo: `no-explicit-any`, `no-restricted-globals` (`Date`, `process`), `no-restricted-properties` (`Math.random`) y `no-restricted-imports` (`node:*`, `fs`, `path`, `child_process`, `os`, `react`)
- Las funciones públicas devuelven objetos propios: `safeZoneFor` y `buildTimeline` no comparten estado entre llamadas (regla 6 de `architect.md` §12)
- Tags Nx: `scope:engine`, `type:domain`. Boundaries Nx: `type:domain` → `onlyDependOnLibsWithTags: []` (no depende de ninguna otra lib del repo)
- Alias de import: **`@video-maker/timeline-core`** (scope `@video-maker/*`, no el `@shared-utils` heredado); declarado en `tsconfig.base.json → paths`, apuntando a `src/index.ts` (consumo por source, sin bundler)
