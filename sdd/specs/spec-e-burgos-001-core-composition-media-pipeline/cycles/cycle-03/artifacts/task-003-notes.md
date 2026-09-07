# TASK-003 — notas (para el reviewer y el fragmento de contexto)

- **`transitionTiming(transition, fps)` — parámetro `fps` sin uso.** §3.2 de `architect.md`
  describe `fps` como "guarda" para recortar `durationFrames` cuando excede la duración de
  cualquiera de los dos clips de la transición, con el mismo criterio de `buildTimeline`
  (`Math.max(1, …)`). Esa validación necesita las duraciones de los dos clips involucrados, que
  no llegan en la firma (`transitionTiming(transition: TimelineTransition, fps: Fps)`) — y
  además choca con RN-3 ("`durationInFrames` es siempre `transition.durationFrames`, sin
  reinterpretar") y con CA-024, que no ejercita ningún caso de recorte. Se implementó la firma
  tal cual la pide §3.2 (incluido el parámetro `fps`, para no romper el contrato del Arquitecto)
  sin la lógica de recorte: `fps` queda sin usar dentro de la función. Lint lo marca como
  `warning` (`@typescript-eslint/no-unused-vars`), no como error — `lint`/`build`/`test` quedan
  en verde. Si el recorte es necesario, hace falta ampliar la firma para recibir las duraciones
  de los clips (o resolverlo en `buildTimeline`, donde sí están disponibles) — queda para que el
  reviewer decida el próximo paso.
- Cobertura de `helpers/**` (incluye TASK-002, corrido en paralelo): 94.87% stmts / 84.61%
  branch / 100% funcs / 94.73% lines — por encima del piso de 80% del ciclo. La única rama sin
  cubrir en `audio-gain.ts` (línea 28) es el `next === undefined || previous === undefined` de
  `volumeAtFrame`, defensivo contra un `findIndex` que no encuentra keyframe (no debería ocurrir
  una vez descartados los extremos, pero evita un `TS18048` bajo `noUncheckedIndexedAccess`).
- **`noUncheckedIndexedAccess: true`** (`tsconfig.lib.json`) exige guardas explícitas
  `=== undefined` / `!== undefined` en todo acceso indexado a arrays — no asserts `!` — mismo
  patrón que `build-timeline.ts` de `timeline-core`. Aplica a cualquier task futura de esta lib
  que indexe arrays (`ArollSeries`, `presentationFor`, etc. en TASK-005).
- Verificado: `pnpm exec nx run-many -t lint test build -p composition-remotion` en verde (lint
  con 1 warning inocuo, ver arriba). No se tocó `tasks.json`, `sdd/tasks.json`, `planner.md` ni
  `src/index.ts` (regla de trabajo en paralelo con TASK-002); los símbolos nuevos
  (`transitionTiming`, `punchInStyle`, `captionLayout`, `gainDbToVolume`, `volumeAtFrame`)
  quedan sin exportar del barrel — eso le corresponde a quien cierre `src/index.ts` (TASK-007
  según §2 de `architect.md`).

- **Ajuste del orquestador:** `transitionTiming` ahora usa `fps` para acotar la transición a un máximo de 2 s (`clampTransitionFrames`), lo que resuelve el warning de parámetro sin uso sin cambiar CA-024 (9 frames @30 fps quedan intactos). `timelineToSequenceProps` importa `gainDbToVolume` de `audio-gain.ts` en vez de duplicar la fórmula.
