# Sprint Plan — Cycle 1: Core Composition & Media Pipeline Engine (timeline-core)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo                    | Valor                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| Ciclo                    | 1                                                                     |
| Módulo                   | core-composition-media-pipeline (`libs/timeline-core`)               |
| Duración estimada        | ~2 semanas                                                            |
| Story points totales     | 46                                                                    |
| Horas totales            | 39 h                                                                  |
| Tasks                    | 11 (todas backend — lib TypeScript pura, sin frontend en este ciclo) |

No hay tasks de frontend en este ciclo: `libs/timeline-core` es una librería de dominio sin UI ni
endpoints (ver `brief.yaml` → `out_of_scope`).

---

## Tasks backend

### TASK-001: Scaffold de libs/timeline-core con scaffold-nx

- **Historias:** infraestructura común a US-1-001..US-1-012
- **CA que cierra:** ninguno directamente (prerequisito de todos)
- **Descripción:** Usar la skill `scaffold-nx` para generar `libs/timeline-core` con
  `@nx/js:lib` (vitest), tags `scope:engine`/`type:domain`, sin dependencias del repo. Agregar
  alias en `tsconfig.base.json` siguiendo la convención de `shared-utils`, dejar `src/index.ts`
  vacío como única superficie pública y un README mínimo con propósito y comandos
  (`pnpm nx test|lint|build timeline-core`).
- **Archivos a crear/modificar:**
  - `libs/timeline-core/project.json`
  - `libs/timeline-core/package.json`
  - `libs/timeline-core/tsconfig.json`, `tsconfig.lib.json`
  - `libs/timeline-core/vite.config.ts`
  - `libs/timeline-core/src/index.ts`
  - `libs/timeline-core/README.md`
  - `tsconfig.base.json` (alias `@video-maker/timeline-core`)
- **Criterio de done:**
  - [ ] `pnpm nx test timeline-core` y `pnpm nx lint timeline-core` corren en verde sin tests aún
  - [ ] Tags Nx `scope:engine, type:domain` aplicados y `@nx/enforce-module-boundaries` no reporta violaciones
  - [ ] `.nxignore`/`pnpm-workspace.yaml` reconocen la lib sin cambios manuales adicionales
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** ninguna

### TASK-002: Schemas Zod OutputFormat, MediaAsset y Transcription con invariantes

- **Historias:** US-1-001
- **CA que cierra:** soporte de CA-002 (contratos que usa `defaultFormat`/`safeZoneFor`)
- **Descripción:** Definir en `src/schemas/` los schemas Zod y tipos inferidos de `OutputFormat`
  (preset, width, height, fps), `MediaAsset` (kind, dimensiones, durationMs, hasAudio) y
  `Transcription` (palabras con `startMs`/`endMs` no negativos y ordenadas). Invariantes: `startMs
  < endMs` por palabra, palabras ordenadas por tiempo, `width`/`height`/`fps` enteros positivos.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/schemas/output-format.schema.ts`
  - `libs/timeline-core/src/schemas/media-asset.schema.ts`
  - `libs/timeline-core/src/schemas/transcription.schema.ts`
  - `libs/timeline-core/src/schemas/schemas.spec.ts`
  - `libs/timeline-core/src/__fixtures__/transcription.fixture.ts`
- **Criterio de done:**
  - [ ] `safeParse` rechaza una `Transcription` con palabras fuera de orden o `startMs > endMs`
  - [ ] Tipos inferidos exportados y usados por el resto de la lib (sin `any`)
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001

### TASK-003: Schemas Zod EditDecisionList, AudioMixPlan y Timeline con invariantes

- **Historias:** US-1-011
- **CA que cierra:** CA-015
- **Descripción:** Definir `EditDecisionList` (unión discriminada de decisiones `keep`/`cut`/
  `punch-in`/`broll`/`transition`/`caption-group`/`duck`), `AudioMixPlan` y `Timeline`. Invariante
  central de CA-015: un `punch-in` (u otra decisión superpuesta) no puede caer dentro de un rango
  marcado `cut` — implementar con `.superRefine` reportando el `path` de la decisión inválida.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/schemas/edit-decision-list.schema.ts`
  - `libs/timeline-core/src/schemas/audio-mix-plan.schema.ts`
  - `libs/timeline-core/src/schemas/timeline.schema.ts`
  - `libs/timeline-core/src/schemas/schemas.spec.ts`
  - `libs/timeline-core/src/__fixtures__/edl.fixture.ts`
- **Criterio de done:**
  - [ ] CA-015: una EDL con `punch-in` dentro de un `cut` falla `safeParse` señalando la ubicación
  - [ ] Fixture de EDL válida (usada luego por TASK-009) parsea sin errores
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002

### TASK-004: Conversión de unidades, defaultFormat y safeZoneFor

- **Historias:** US-1-001, US-1-002
- **CA que cierra:** CA-001, CA-002
- **Descripción:** Implementar `msToFrames`/`framesToMs` con parámetro `rounding` (`round` por
  defecto, `floor`, `ceil`) y probar los tres casos de borde de CA-001. Implementar
  `defaultFormat(preset)` para `reels-9x16`/`youtube-16x9` y `safeZoneFor(format)` con los
  márgenes de RN-17.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/units/convert-time.ts`
  - `libs/timeline-core/src/units/convert-time.spec.ts`
  - `libs/timeline-core/src/format/default-format.ts`
  - `libs/timeline-core/src/format/safe-zone.ts`
  - `libs/timeline-core/src/format/format.spec.ts`
- **Criterio de done:**
  - [ ] CA-001: `msToFrames(1000,30)=30`, `msToFrames(999,30,"floor")=29`, `msToFrames(16,60,"ceil")=1`
  - [ ] CA-002: `defaultFormat("reels-9x16")` = 1080×1920@30, `defaultFormat("youtube-16x9")` = 1920×1080@30, `safeZoneFor` devuelve los márgenes de RN-17 por preset
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-002

### TASK-005: Detección, fusión y poda de silencios (keep/cut)

- **Historias:** US-1-003, US-1-004
- **CA que cierra:** CA-003, CA-004, CA-005, CA-006
- **Descripción:** `detectSilencesFromWords(transcription, opts)` con `minSilenceMs: 500` (límite
  inclusivo hacia el silencio detectado, RN-1); `mergeSilences(a, b)` para unir rangos
  superpuestos/adyacentes (RN-2); `pruneSilences(durationMs, silences, opts)` con `paddingMs: 80`
  (RN-3) y `minKeepMs: 300` (RN-4, absorción del tramo mínimo en el corte adyacente), garantizando
  partición sin huecos ni solapes (RN-5).
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/silence/detect-silences.ts`
  - `libs/timeline-core/src/silence/merge-silences.ts`
  - `libs/timeline-core/src/silence/prune-silences.ts`
  - `libs/timeline-core/src/silence/silence.spec.ts`
  - `libs/timeline-core/src/silence/prune.spec.ts`
  - `libs/timeline-core/src/__fixtures__/silence.fixture.ts`
- **Criterio de done:**
  - [ ] CA-003: huecos de 300/500/800 ms → solo se reportan 500 y 800
  - [ ] CA-004: merge de `[1000-1600]` y `[1500-2200]` → `[1000-2200]`
  - [ ] CA-005: clip de 10000 ms con silencio `[4000-5000]` → `keep[0-4080]`, `cut[4080-4920]`, `keep[4920-10000]`, unión = `[0,10000]` exacta
  - [ ] CA-006: un `keep` menor a `minKeepMs` se absorbe en el `cut` adyacente
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-003

### TASK-006: Planificación de punch-ins deterministas y remapeo de tiempos

- **Historias:** US-1-005, US-1-008
- **CA que cierra:** CA-007, CA-012
- **Descripción:** `planPunchIns(keeps, opts)` con `scales: [1.10, 1.15]`, `every: 2` y `seed`
  explícito (RN-6, RN-7, RN-8: solo dentro de tramos `keep`); debe ser puro y determinista frente
  a la misma entrada+seed. `remapMsAfterCuts(ms, keeps)` para ubicar un instante del clip original
  en la timeline resultante, descontando el tiempo cortado.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/punch-in/plan-punch-ins.ts`
  - `libs/timeline-core/src/punch-in/punch-in.spec.ts`
  - `libs/timeline-core/src/timeline/remap-ms-after-cuts.ts`
  - `libs/timeline-core/src/timeline/remap.spec.ts`
- **Criterio de done:**
  - [ ] CA-007: 5 keeps, `every:2, seed:7` → punch-in en keeps 2 y 4, escala en `[1.10,1.15]`; repetir la llamada da resultado idéntico
  - [ ] CA-012: `remapMsAfterCuts(6000, keeps de CA-005)` = 5160
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-005

### TASK-007: Agrupado de palabras en captions con palabra de énfasis

- **Historias:** US-1-006
- **CA que cierra:** CA-008, CA-009
- **Descripción:** `groupWordsForCaptions(words, opts)` con `maxWords: 3`, `maxDurationMs: 1200`,
  `minDurationMs: 300` (RN-9, RN-10: una palabra aislada por hueco largo forma su propio grupo) y
  `emphasisKeywords: []`; `emphasisIndex` marca la palabra clave configurada o, en su ausencia, la
  de mayor duración (empate → la última, RN-11).
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/captions/group-words-for-captions.ts`
  - `libs/timeline-core/src/captions/captions.spec.ts`
  - `libs/timeline-core/src/__fixtures__/captions.fixture.ts`
- **Criterio de done:**
  - [ ] CA-008: 7 palabras seguidas → grupos ≤ 3 palabras, ninguno > 1200 ms; palabra aislada por hueco largo forma grupo propio
  - [ ] CA-009: `emphasisKeywords:["gratis"]` marca esa palabra; sin keywords marca la más larga (empate → última)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002

### TASK-008: Planificación de ducking de música (automation de ganancia)

- **Historias:** US-1-007
- **CA que cierra:** CA-010, CA-011
- **Descripción:** `planDucking(voiceRanges, plan, fps)` con niveles `-12 dB`/`-24 dB` (RN-12) y
  rampas `attack: 150ms`, `hold: 250ms`, `release: 400ms` (RN-13); dos tramos de voz separados por
  menos que `holdMs` se fusionan en un único valle (RN-14). Devuelve `automation[]` (keyframes en
  frames, usando `msToFrames`) y las decisiones `duck`.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/ducking/plan-ducking.ts`
  - `libs/timeline-core/src/ducking/ducking.spec.ts`
- **Criterio de done:**
  - [ ] CA-010: voz `[1000-3000]` @30fps → `-12dB` en 0, rampa a `-24dB` que termina en frame 30, hold+release de vuelta a `-12dB` terminando en frame 110
  - [ ] CA-011: dos rangos de voz separados por menos del hold → un único valle, sin subida intermedia
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-004

### TASK-009: buildTimeline — EDL + assets → Timeline completa

- **Historias:** US-1-009
- **CA que cierra:** CA-013
- **Descripción:** `buildTimeline(edl, assets, music?)` combina las decisiones de una EDL válida
  (keeps/cuts, punch-in, broll, transition, caption-groups) más los assets en un documento
  `Timeline` completo, calculando `durationFrames` como la suma de los `keep` menos los frames
  consumidos por las transiciones. Crear la fixture de referencia (2 keeps, 1 cut, 1 punch-in, 1
  broll, 1 transición, 3 caption-groups) reusada por TASK-010.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/timeline/build-timeline.ts`
  - `libs/timeline-core/src/timeline/build-timeline.spec.ts`
  - `libs/timeline-core/src/__fixtures__/edl-reference.fixture.ts`
- **Criterio de done:**
  - [ ] CA-013: la Timeline construida desde la fixture de referencia pasa `validateTimeline` y `durationFrames` = suma de keeps − frames de transición
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-003, TASK-006, TASK-007, TASK-008

### TASK-010: validateTimeline y refuerzo de invariantes de schema

- **Historias:** US-1-010, US-1-011
- **CA que cierra:** CA-014
- **Descripción:** `validateTimeline(timeline)` recorre la Timeline y reporta cada violación como
  un `issue` independiente con su `path` (RN-20): asset inexistente, clip que excede la duración
  de su asset, solape entre clips de A-roll, subtítulo fuera de la zona segura del formato. Reusar
  la fixture de TASK-009 mutada para cada caso.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/src/timeline/validate-timeline.ts`
  - `libs/timeline-core/src/timeline/validate-timeline.spec.ts`
- **Criterio de done:**
  - [ ] CA-014: los cuatro casos (asset inexistente, clip excede asset, solape A-roll, caption fuera de safe zone) producen un `issue` cada uno con su `path`
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-009

### TASK-011: JSON Schema commiteado, test anti-drift, export público y cobertura ≥ 85 %

- **Historias:** US-1-012
- **CA que cierra:** CA-016
- **Descripción:** Generar `schemas/*.schema.json` (uno por contrato) con `z.toJSONSchema()` desde
  los schemas Zod vigentes, commitearlos en `libs/timeline-core/schemas/`, y agregar un test que
  regenere el schema en memoria y lo compare byte a byte (`JSON.stringify` estable) contra el
  archivo commiteado. Consolidar `src/index.ts` como única superficie pública (todas las funciones
  de la tabla "Cálculos del motor" + `*Schema` + `timelineToJsonSchema()`). Cerrar con
  `pnpm nx test timeline-core --coverage` ≥ 85 % y actualizar el README con la lista de exports.
- **Archivos a crear/modificar:**
  - `libs/timeline-core/schemas/output-format.schema.json`
  - `libs/timeline-core/schemas/media-asset.schema.json`
  - `libs/timeline-core/schemas/transcription.schema.json`
  - `libs/timeline-core/schemas/edit-decision-list.schema.json`
  - `libs/timeline-core/schemas/audio-mix-plan.schema.json`
  - `libs/timeline-core/schemas/timeline.schema.json`
  - `libs/timeline-core/src/schemas/schemas.spec.ts`
  - `libs/timeline-core/src/index.ts`
  - `libs/timeline-core/README.md`
- **Criterio de done:**
  - [ ] CA-016: el JSON Schema generado en el test es idéntico byte a byte al commiteado en `schemas/`
  - [ ] `pnpm nx test timeline-core --coverage` reporta ≥ 85 % de cobertura de líneas
  - [ ] `pnpm nx lint timeline-core` y `pnpm nx build timeline-core` en verde
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-010

## Tasks frontend

Ninguna — `libs/timeline-core` no tiene UI ni endpoints en este ciclo.

## Orden de ejecución

```
TASK-001 → TASK-002 → TASK-003 ─┬─→ TASK-005 → TASK-006 ─┐
                                 │                        ├─→ TASK-009 → TASK-010 → TASK-011
                        TASK-004 ┴─→ TASK-008 ────────────┤
                                 └─→ TASK-007 ─────────────┘
```

TASK-002 y TASK-004 solo requieren TASK-001; TASK-004 y TASK-007 pueden avanzar en paralelo con
TASK-003/TASK-005/TASK-006 una vez cerrado TASK-002. El camino crítico es
TASK-001 → TASK-002 → TASK-003 → TASK-005 → TASK-006 → TASK-009 → TASK-010 → TASK-011.

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.

