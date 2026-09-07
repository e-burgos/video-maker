# TASK-004 — notas (para el reviewer y el fragmento de contexto)

- **Sin tests de render para `BrollTrack`/`AudioTrack`/`CaptionTrack`.** Los tres componentes usan
  `Sequence` de Remotion, que internamente llama `useVideoConfig`/`SequenceContext` y lanza fuera de
  un `<Composition>`/`<Player>` real. Montarlos con `@testing-library/react` exigiría envolverlos en
  un runtime de Remotion, exactamente lo que RN-13 y D-08 prohíben. Coherente con el precedente de
  TASK-002/003 (cero tests de componente) y con D-08 §3: la cobertura del ciclo solo mide
  `src/helpers/**` y `src/transitions/**`, que ya están en 95% stmts / 84.61% branch / 100% funcs /
  94.87% lines. No se agregó ningún `*.spec.tsx`.
- **`pip` en `BrollTrack` sin `safeZone` disponible.** `BrollTrackProps` (§4.3 de `architect.md`)
  solo declara `clips: readonly VideoSequenceProps[]` — no recibe `safeZone` ni `format`. El texto
  de la sección pide anclar el wrapper "dentro del safe zone", pero sin esos datos en la firma la
  única opción sin ampliar el contrato es un margen relativo al contenedor:
  `PIP_MARGIN_RATIO = 0.05` (5% del ancho/alto) junto a `PIP_WIDTH_RATIO = 0.32`, ambas constantes
  del módulo. No se tocó la firma de `BrollTrackProps` para no romper el contrato congelado del
  Arquitecto; si se necesita el safe zone real, hay que ampliar la firma en un ciclo futuro.
- **`AudioSequenceProps.fadeInFrames`/`fadeOutFrames`** se reciben en el plan pero no se aplican en
  `AudioTrack` — documentado explícitamente en §4.4 del architect como fuera de alcance de este
  ciclo (`spec-004` mezcla).
- Verificado: `pnpm exec nx run-many -t lint test build -p composition-remotion` en verde (0
  warnings nuevos; el warning inocuo de `transitionTiming`/`fps` de TASK-003 ya no aparece porque
  el orquestador lo resolvió con `clampTransitionFrames`). No se tocó `tasks.json`, `sdd/tasks.json`,
  `planner.md` ni `src/index.ts` (regla de trabajo en paralelo con TASK-005). Los tres componentes
  (`BrollTrack`, `AudioTrack`, `CaptionTrack`) quedan sin exportar del barrel — le corresponde a
  quien cierre `src/index.ts` (TASK-007 según §2 de `architect.md`).
- Se registró `sdd/components.json → "libs/composition-remotion"` con `COMP-001..003` (los tres
  componentes de esta task), `consumes: []` porque el ciclo no consume API REST (§0 de
  `architect.md`). No se corrió `pnpm sdd:rebuild-tasks-index` (edita `sdd/tasks.json`, prohibido en
  este trabajo paralelo); `pnpm sdd:validate` puede marcar el índice de tasks desactualizado —
  esperado, a resolver cuando se cierre TASK-004 en `tasks.json`.
