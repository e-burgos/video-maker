# TASK-002 — notas de implementación (assetSrc + timelineToSequenceProps)

- **Desviación deliberada — `gainDbToLinearVolume` duplicada en `timeline-to-sequence-props.ts`.**
  El contrato de §3.1 de `architect.md` pide `volume = gainDbToVolume(clip.gainDb)` en `voice` y
  `music`, pero `gainDbToVolume` es de `src/helpers/audio-gain.ts`, archivo de TASK-003 (agente en
  paralelo, `depends_on` disjunto de TASK-002). Para no bloquear esta task contra un archivo que no
  existía al momento de escribir el mapeo, se agregó una función privada, no exportada,
  `gainDbToLinearVolume(db)` dentro de `timeline-to-sequence-props.ts` con la misma fórmula
  (`clamp(10 ** (db / 20), 0, 1)`) descrita en D-12/§3.5. Verificado al cerrar la task que
  `audio-gain.ts` (TASK-003) exporta la misma fórmula bajo el nombre `gainDbToVolume`. Queda
  **duplicación intencional** entre ambos archivos — el Reviewer puede optar por hacer que
  `timeline-to-sequence-props.ts` importe `gainDbToVolume` desde `./audio-gain` ahora que ambos
  archivos ya conviven, eliminando la copia local.
- `src/index.ts` no se tocó (fuera del alcance de TASK-002 por instrucción explícita de
  paralelismo; lo cierra TASK-007). Los símbolos públicos (`timelineToSequenceProps`, `assetSrc` y
  los tipos de `SequencePropsPlan`) quedan pendientes de export desde el barrel.
- Verificado tras la finalización de TASK-003 (que corre en paralelo sobre archivos disjuntos):
  `pnpm exec nx run-many -t lint test build -p composition-remotion` en verde — 40 tests, cobertura
  global sobre `src/helpers/**` 94.87 % stmts / 84.61 % branch / 100 % funcs / 94.73 % lines (≥ 80 %
  en las cuatro métricas). El único warning de lint (`fps` sin usar en `transition-timing.ts`) es de
  un archivo de TASK-003, no de esta task.
- Sin cambios en `sdd/api.json` ni `sdd/schema.json` (no aplica a este ciclo, ver `architect.md` §0
  y §12).
