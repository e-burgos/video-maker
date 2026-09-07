# spec-e-burgos-001-core-composition-media-pipeline cycle-01 — 2026-09-07

## Estado

- Lib creada y completa para su alcance de `cycle-01`: los 6 contratos Zod
  (`OutputFormat`, `MediaAsset`, `Transcription`, `EditDecisionList`, `AudioMixPlan`, `Timeline`)
  con sus invariantes, y todas las funciones puras del motor: `msToFrames`/`framesToMs`,
  `defaultFormat`/`safeZoneFor`, `detectSilencesFromWords`/`mergeSilences`/`pruneSilences`,
  `planPunchIns`, `remapMsAfterCuts`, `groupWordsForCaptions`/`pickEmphasisIndex`,
  `planDucking`, `buildTimeline`, `validateTimeline`, `normalizeTranscriptionWords` y los
  helpers de JSON Schema. CA-001..CA-016 en verde; 209 tests, cobertura 97.29 % statements.
- `resolve: constitution.md §4 "Alias de import: se decide en cycle-01"` → el alias es
  **`@video-maker/timeline-core`** (scope `@video-maker/*`, no el `@shared-utils` heredado);
  declarado en `tsconfig.base.json → paths`, apuntando a `src/index.ts` (consumo por source,
  sin bundler).
- `resolve: context_prompt.md "Estado: en construcción"` → `cycle-01` cerrado; siguen
  `cycle-02` (`libs/media-local`) y `cycle-03` (`libs/composition-remotion`), que consumen
  esta lib.

## Estructura

- Árbol real de `src/`: `schemas/` (un archivo por contrato + `primitives.ts`, `registry.ts`,
  `json-schema.ts`), `types/units.ts`, `units/`, `format/`, `silence/`, `punch-in/`,
  `captions/`, `ducking/`, `timeline/` (`build-timeline.ts`, `validate-timeline.ts`,
  `remap-ms-after-cuts.ts`, `ids.ts`), `__fixtures__/`. Nombres de archivo: los de
  `tasks.json`/`planner.md` (`detect-silences.ts`, `plan-punch-ins.ts`,
  `remap-ms-after-cuts.ts`), no los abreviados del árbol de `architect.md` §2.
- **Targets de `project.json` (todos explícitos, sin targets inferidos por plugin):**
  `lint` (`@nx/eslint:lint`), `test` (`vitest run --coverage --passWithNoTests`),
  `build` (`tsc -p tsconfig.lib.json` — typecheck + `.d.ts`; Vitest no typechequea) y
  `schemas`. Se quitaron de `nx.json` los plugins `@nx/vitest` (inferia `test` en modo
  **watch**, que cuelga `nx run-many -t test` fuera de CI) y `@nx/eslint/plugin` (target
  `eslint:lint` duplicado). Matiza `architect.md` D-02/D-04: sin bundler, pero **con**
  target `build`.
- **Regenerar los JSON Schema commiteados:** `pnpm nx run timeline-core:schemas`
  (`node -r @swc-node/register ./tools/generate-schemas.ts` — registro **CJS**;
  `--import @swc-node/register/esm-register` rompe por interop ESM/CJS en este repo).
  Determinista: dos corridas seguidas dejan `git diff` vacío. `schemas.spec.ts` compara
  byte a byte contra los 6 archivos de `schemas/` (CA-016), así que tras tocar cualquier
  schema Zod hay que correrlo y commitear el resultado.
- `src/schemas/json-schema.ts` post-procesa la salida de `z.toJSONSchema(registry)`:
  Zod extrae subestructuras compartidas a un documento sintético `__shared`, y el
  post-proceso las inlinea como `$defs` locales para que los 6 archivos queden
  autocontenidos.
- ESLint de la lib impone mecánicamente las reglas de determinismo: `no-explicit-any`,
  `no-restricted-globals` (`Date`, `process`), `no-restricted-properties` (`Math.random`)
  y `no-restricted-imports` (`node:*`, `fs`, `path`, `child_process`, `os`, `react`).
  Boundaries Nx: `type:domain` → `onlyDependOnLibsWithTags: []` (no depende de nada).
- Las funciones públicas devuelven objetos propios: `safeZoneFor` y `buildTimeline` no
  comparten estado entre llamadas (regla 6 de `architect.md` §12).

## Dependencias

- Runtime: `zod` 4.5.4 (única dependencia de la lib).
- Dev del workspace, agregadas por este ciclo: `@swc-node/register` (target `schemas`),
  Vitest 4 + `@vitest/coverage-v8`, Prettier. Primer proyecto Vitest del repo: se crearon
  `vitest.config.ts` raíz, `.prettierrc` y `.prettierignore` (afectan al workspace, no
  requieren mantenimiento por lib).
- La lib **no tiene `package.json` propio**: se consume por source vía el alias de
  `tsconfig.base.json`.

## Qué sigue

- `cycle-02` (`libs/media-local`) aplica `normalizeTranscriptionWords` en sus parsers antes
  de validar contra `TranscriptionSchema`.
- `cycle-03` (`libs/composition-remotion`) necesita la Timeline de CA-013 (CA-023): los
  fixtures viven en `src/__fixtures__/` y **no** se exportan desde `src/index.ts`; hay que
  decidir si se exponen públicamente o si el consumidor arma su propio fixture.
- `buildTimeline` fija el clip de música con `durationFrames` = duración de la Timeline: si
  el asset de música es más corto, `validateTimeline` lo reporta como `CLIP_EXCEEDS_ASSET`.
  No hay estrategia de loop/fade definida — la define el ciclo que la necesite.
