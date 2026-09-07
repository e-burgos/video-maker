# TASK-007 — notas (para el reviewer y el fragmento de contexto)

- **`CompositionMetadata` no estaba definido en `architect.md` §5** (solo se lo nombra en la firma
  de `RenderTimelineDeps`). Se implementó como alias de `VideoConfig` de `remotion/no-react`
  (`export type CompositionMetadata = VideoConfig;`), vía **type-only import** (`import type {
  VideoConfig } from 'remotion/no-react'`, erased por `verbatimModuleSyntax`, cero costo en
  runtime). Es lo que exige `renderMedia` real: su parámetro `composition` pide el `VideoConfig`
  completo, no un subconjunto — un tipo propio más angosto habría obligado a castear en el único
  punto de producción real. `selectComposition()` ya devuelve `Promise<VideoConfig>`, así que el
  default de producción no necesita ningún cast.
- **`RenderTimelineDeps.renderTimelineMedia` gana un campo opcional `onProgress`**, no listado en la
  firma literal de §5 de `architect.md`. `RenderTimelineOptions.onProgress` sí está en el contrato
  y necesita un conducto real hasta `renderMedia` (cuyo `onProgress` real tiene una firma distinta,
  `(progress: RenderMediaProgress) => void`); sin este campo en el puerto, la opción quedaría muerta
  para cualquier implementación de `RenderTimelineDeps` que no sea la default. Es una extensión
  aditiva y opcional — ningún doble de test existente deja de cumplir la interfaz por omitirlo.
- **`TimelineInputProps` se declaró como `type`, no `interface`** — mismo motivo que documentó
  TASK-006 para `TimelineCompositionProps`: `renderMedia`/`selectComposition` piden
  `inputProps?: Record<string, unknown>`, y solo un alias de tipo objeto (no una `interface`)
  satisface esa asignación sin castear (índice implícito de TypeScript para `type`, ausente en
  `interface`).
- **`RenderTimelineError` no tiene el constructor `(code, message)` que insinúa la superficie
  mínima de §5** (`readonly code`, `readonly issues`, sin más detalle de constructor). Se siguió el
  uso literal que sí aparece en el texto de D-13 — `RenderTimelineError('INVALID_TIMELINE',
  issues)` — con un tercer parámetro opcional `{ cause }` para los tres códigos que no traen
  `issues` (`BUNDLE_FAILED`, `COMPOSITION_NOT_FOUND`, `RENDER_FAILED`). El mensaje sale de un mapa
  interno por código, nunca se redacta a mano en cada call site.
- **Errores de `bundleProject`/`selectTimelineComposition`/`renderTimelineMedia` se envuelven en
  `renderTimeline` (helper `runStage`), no dentro de `remotionRenderDeps`.** Así el default de
  producción queda como un pass-through fino (`await import(...)` + la llamada real, sin lógica de
  mapeo de errores) y el mapeo a `RenderTimelineError` con `cause` aplica igual sin importar si
  `deps` es el default o un doble de test — verificado con el caso `RENDER_FAILED` de
  `render.spec.ts`, que no necesita que el doble conozca `RenderTimelineError`.
- **`entryPoint` por default usa `__dirname`, no `import.meta.url`.** El target `smoke` corre con
  `node -r @swc-node/register` (registro CJS, lección de `cycle-01`/D-02): `import.meta.url` es
  ESM y su comportamiento bajo un registro CJS no está garantizado, mientras que `__dirname` es un
  global de CommonJS estándar y además el que ya usa `timeline-core` (`schemas.spec.ts`) para el
  mismo propósito bajo Vitest.
- **Auditoría de `src/index.ts`:** faltaban `CaptionBox` y `TransitionDirection` (D-06: "se
  re-exportan desde `src/index.ts` solo `CaptionBox` y `TransitionDirection`, que aparecen en
  firmas públicas") — agregados. Se quitó un `export {};` residual del scaffold (ya no hace falta,
  el archivo tiene exports reales). El resto del barrel (helpers/transiciones/componentes de
  TASK-002 a TASK-006) ya estaba completo — lo había dejado armado TASK-006 al cerrar
  `timeline-composition.tsx`. `render.ts`, `smoke.ts`, `Root.tsx`, `remotion-entry.ts` y
  `__fixtures__/**` siguen fuera del barrel (regla 3 de `architect.md` §9).
- **`sdd/components.json`:** se registró `COMP-006` (`ArollSeries`, `src/components/aroll-series.tsx`),
  pendiente que había dejado anotado TASK-006 (el componente de TASK-005 nunca se había registrado).
- Verificado: `pnpm exec nx run-many -t lint test build -p composition-remotion` en verde — 11
  spec files, 67 tests; cobertura `helpers/**` + `transitions/**` 94% stmts / 87.87% branch /
  96.42% funcs / 93.87% lines (≥ 80% en las cuatro métricas). `pnpm exec nx run-many -t lint test
  build` del workspace completo (5 proyectos) en verde — el único warning (`no-non-null-assertion`
  en `apps/web/src/main.tsx`) es preexistente y ajeno a esta task. `pnpm sdd:validate` en verde (14
  archivos, cross-checks OK). `git status` sin binarios ni `public/example/*` (assets no generados
  en este entorno, según D-11). No se corrió el smoke real ni `remotion studio` (descargarían
  Chrome Headless Shell).
- No se tocó `tasks.json`, `sdd/tasks.json`, `planner.md`, `architect.md` ni `cycle.json` — cierre
  de esos registros (incluida la telemetría de esta task) queda para el Orquestador/Reviewer, según
  instrucción explícita de esta corrida.
