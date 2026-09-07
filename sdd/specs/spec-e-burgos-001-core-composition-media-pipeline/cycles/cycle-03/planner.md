# Sprint Plan — Cycle 3: Core Composition & Media Pipeline Engine (composition-remotion)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| Ciclo                | 3                                                                      |
| Módulo               | core-composition-media-pipeline (`libs/composition-remotion`)         |
| Duración estimada    | ~1 semana                                                              |
| Story points totales | 33                                                                     |
| Horas totales        | 27 h                                                                   |
| Tasks                | 7 (4 backend [BE], 3 frontend [FE])                                    |

`libs/composition-remotion` es React 19 + Remotion 4: los helpers puros y la entrada Node de
render son `[BE]` (implementor_back); los componentes que montan Remotion son `[FE]`
(implementor_front). Ninguna task de este ciclo consume un endpoint HTTP — la "dependencia
backend→frontend" de la regla general se traduce acá en "helper puro → componente que lo usa".

Lección de `cycle-02` (`reviewer_report.follow_ups`) aplicada en este plan: la infraestructura
compartida (scaffold, dependencias de Remotion pinneadas, fixture única de `Timeline`) es **una
sola task serializada** (TASK-001) antes de abrir el paralelismo, y **ninguna task que corre en
paralelo lleva un umbral de cobertura global de la lib en su criterio de done** — ese umbral
(≥ 80 % sobre los helpers) vive únicamente en TASK-007, la task final y no paralela.

---

## Tasks Backend

### TASK-001: [BE] Scaffold de libs/composition-remotion + dependencias Remotion + fixture de Timeline

- **Historias:** infraestructura común a US-3-001..US-3-009
- **CA que cierra:** ninguno directamente (prerequisito de todos — CA-023 a CA-027 dependen de que
  exista la lib, sus dependencias y la fixture)
- **Descripción:** Usar la skill `scaffold-nx` para generar `libs/composition-remotion` con
  `@nx/react:lib`, Vitest + jsdom (entorno de test, sin levantar un navegador real), tags
  `scope:engine`/`type:ui`, dependiendo solo de `@video-maker/timeline-core`. Targets explícitos en
  `project.json` — `lint`, `test` (`vitest run --coverage --passWithNoTests`), `build`
  (`tsc -p tsconfig.lib.json`) — sin plugins inferidos en `nx.json`, siguiendo el mismo ajuste que
  dejaron `cycle-01` y `cycle-02`. Agregar el alias `@video-maker/composition-remotion` en
  `tsconfig.base.json`. Instalar en el `package.json` raíz `remotion`, `@remotion/transitions`,
  `@remotion/bundler`, `@remotion/renderer` y `@remotion/cli` en la **misma versión exacta única**
  (4.0.522, o la que el orquestador confirme vigente al instalar — regla de Remotion, no mezclar
  versiones entre paquetes) y, como dev-dependencies, `@testing-library/react` + `jsdom`. Sin
  scripts de `postinstall` propios de esta lib (la descarga de Chrome Headless Shell la resuelve
  Remotion la primera vez que corre un render real, nunca en `pnpm install`) — el orquestador
  verifica esto al revisar el lockfile. Si pnpm bloquea algún script de instalación de
  `@remotion/compositor-*`, agregarlo a `onlyBuiltDependencies` en `pnpm-workspace.yaml`
  documentando el motivo en el commit. Construir la fixture de `Timeline` de CA-013 (la EDL de
  `cycle-01`: 2 keeps, 1 cut, 1 punch-in, 1 broll, 1 transición, 3 caption-groups) pasando una EDL
  local por `buildTimeline` de `@video-maker/timeline-core` — la API pública de `timeline-core` no
  expone fixtures, así que esta lib arma la suya propia. `src/index.ts` vacío (barrel público) y
  `src/render.ts` vacío (entrada Node separada) como únicas dos superficies iniciales; README
  mínimo con propósito y comandos.
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/project.json`
  - `libs/composition-remotion/package.json`
  - `libs/composition-remotion/tsconfig.json`
  - `libs/composition-remotion/tsconfig.lib.json`
  - `libs/composition-remotion/tsconfig.spec.json`
  - `libs/composition-remotion/vitest.config.ts` (entorno `jsdom`)
  - `libs/composition-remotion/src/index.ts`
  - `libs/composition-remotion/src/render.ts`
  - `libs/composition-remotion/src/__fixtures__/edl.fixture.ts`
  - `libs/composition-remotion/src/__fixtures__/timeline.fixture.ts`
  - `libs/composition-remotion/README.md`
  - `tsconfig.base.json` (alias `@video-maker/composition-remotion`)
  - `package.json` raíz (deps de Remotion en versión exacta + devDeps de testing)
  - `pnpm-workspace.yaml` (solo si `onlyBuiltDependencies` lo requiere)
- **Criterio de done:**
  - [ ] `pnpm nx test composition-remotion` y `pnpm nx lint composition-remotion` corren en verde
        sin tests propios de helpers todavía (solo la fixture, sin componentes)
  - [ ] Tags Nx `scope:engine, type:ui`; `@nx/enforce-module-boundaries` permite depender de
        `timeline-core` (tag `type:domain`) y de nada más del repo
  - [ ] Los 5 paquetes de Remotion instalados comparten exactamente la misma versión (`grep` del
        lockfile o de `package.json`)
  - [ ] Ningún script de `postinstall` de esta lib descarga Chrome Headless Shell
  - [ ] La fixture de `Timeline` construida con `buildTimeline` pasa `validateTimeline` (reusa el
        mismo caso que CA-013 de `cycle-01`)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** ninguna

### TASK-002: [BE] timelineToSequenceProps + tests (CA-023)

- **Historias:** US-3-001, US-3-009
- **CA que cierra:** CA-023
- **Descripción:** Implementar `timelineToSequenceProps(timeline)`, la función pura que traduce
  cada clip de cada pista (`aroll`, `broll`, `voice`, `music`, `captions`) de la `Timeline` de la
  fixture de TASK-001 a las props que necesitan los componentes de `Sequence` — una entrada por
  clip con su `from`/`durationInFrames` exactos y las transiciones asociadas al par de clips
  correcto (RN-1, RN-2). No monta ningún componente de Remotion; es una función de datos a datos,
  probada con Vitest sin renderizar nada (RF-3-01, CA-17/CA-18 de la trazabilidad US-3-009).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/helpers/timeline-to-sequence-props.ts`
  - `libs/composition-remotion/src/helpers/sequence-props.spec.ts`
- **Criterio de done:**
  - [ ] CA-023: sobre la Timeline de fixture de TASK-001, `timelineToSequenceProps` devuelve una
        entrada por clip con `from`/`durationInFrames` correctos y las transiciones asociadas a
        los pares de clips correctos, ni un frame antes ni después de lo que la Timeline indica
  - [ ] El test no importa nada de `remotion` que requiera un DOM o un render — es un test de
        datos puro (CA-18 de la trazabilidad US-3-009)
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001

### TASK-003: [BE] transitionTiming + punchInStyle + captionLayout + tests (CA-024, CA-025, CA-026)

- **Historias:** US-3-002, US-3-003, US-3-004, US-3-009
- **CA que cierra:** CA-024, CA-025, CA-026
- **Descripción:** Tres helpers puros independientes entre sí (archivos separados, sin dependencia
  mutua) para no bloquearse con TASK-002 en paralelo:
  - `transitionTiming(transition, fps)`: para `timing.type === "spring"` devuelve la config de
    `springTiming` con `durationInFrames` igual a `transition.durationFrames` (RN-3); para
    `"linear"`, `linearTiming` a velocidad constante durante esos mismos cuadros, sin rebote.
  - `punchInStyle(transform)`: a partir de `{scale, translateX, translateY}` de la Timeline
    devuelve el estilo CSS acercado y desplazado exactamente en esos valores, con el punto de
    anclaje (`transformOrigin`) coincidiendo con el que la Timeline definió, sin reinterpretar ni
    redondear (RN-5).
  - `captionLayout(safeZone, format)`: calcula la caja donde se ubican los captions, siempre
    dentro de `[left, width−right] × [top, height−bottom]` del `safeZone` del formato (RN-6).
  Los tres se prueban sin montar Remotion (RF-3-02, RF-3-03, RF-3-04; CA-17/CA-18 de la
  trazabilidad US-3-009).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/helpers/transition-timing.ts`
  - `libs/composition-remotion/src/helpers/transition-timing.spec.ts`
  - `libs/composition-remotion/src/helpers/punch-in-style.ts`
  - `libs/composition-remotion/src/helpers/punch-in-style.spec.ts`
  - `libs/composition-remotion/src/helpers/caption-layout.ts`
  - `libs/composition-remotion/src/helpers/caption-layout.spec.ts`
- **Criterio de done:**
  - [ ] CA-024: `transitionTiming` con timing `spring` devuelve `durationInFrames` exactamente
        igual a `transition.durationFrames`; con timing `linear` no aplica rebote
  - [ ] CA-025: `captionLayout(safeZoneFor(9:16), format)` devuelve una caja dentro de
        `[left, width−right] × [top, height−bottom]`, verificado también para 16:9
  - [ ] CA-026: `punchInStyle({scale: 1.15, translateX: 0, translateY: 0})` refleja exactamente
        esos valores, con `transformOrigin` según el `anchor` de la Timeline
  - [ ] Un `transition.kind` no reconocido (o `"light-leak"`) no rompe `transitionTiming` — sigue
        devolviendo un timing válido (CE-2, RN-4)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-001

### TASK-007: [BE] renderTimeline + target smoke + README (CA-027) + export final + cobertura ≥ 80 %

- **Historias:** US-3-007, US-3-008, US-3-009
- **CA que cierra:** CA-027
- **Descripción:** Implementar `renderTimeline(timeline, { outPath, codec: "h264" })` en
  `src/render.ts` (entrada Node, separada del barrel React) usando `bundle()` +
  `selectComposition()` + `renderMedia()` de `@remotion/bundler`/`@remotion/renderer`, con
  `concurrency` configurable (default acotado, nunca "todo lo que la CPU permita" — RN-14). Esta
  función y el target `smoke` que la invoca **nunca corren en CI**: agregar el target `smoke`
  (manual) a `project.json` y documentar en el README, paso a paso, el procedimiento CA-027 —
  incluyendo explícitamente que la transcripción debe haber terminado antes de iniciar el render
  (nunca en simultáneo, RN-14/CA-15) y el límite de trabajos en paralelo del ejemplo
  (`--concurrency=4`, CA-16). Si `renderMedia` no encuentra Chrome Headless Shell, el error debe
  indicarlo con claridad sin que ninguna prueba automatizada intente descargarlo (CE-7). Cerrar
  `src/index.ts` como única superficie pública browser-safe final (todos los helpers y componentes
  de TASK-002 a TASK-006, sin incluir `render.ts`) y `pnpm nx test composition-remotion --coverage`
  ≥ 80 % sobre los helpers puros (único umbral de cobertura del ciclo — ver nota de paralelismo más
  abajo).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/render.ts`
  - `libs/composition-remotion/src/render.spec.ts` (arma los args hacia bundler/renderer con
    dobles de test; nunca invoca un render real)
  - `libs/composition-remotion/project.json` (target `smoke`)
  - `libs/composition-remotion/src/index.ts`
  - `libs/composition-remotion/README.md`
- **Criterio de done:**
  - [ ] CA-027: el README documenta el procedimiento manual completo —
        `pnpm nx run composition-remotion:smoke` renderiza la Timeline de ejemplo a MP4
        1080×1920@30 de la duración esperada, fuera de CI
  - [ ] El README indica explícitamente el orden transcripción→render (nunca simultáneo, CA-15) y
        el límite de concurrencia del ejemplo (CA-16)
  - [ ] Ningún `*.spec.ts` de la lib ejecuta un render real ni descarga Chrome Headless Shell
        (CE-7, RNF-3)
  - [ ] `pnpm nx test composition-remotion --coverage` ≥ 80 % sobre los helpers puros;
        `pnpm nx lint composition-remotion` y `pnpm nx build composition-remotion` en verde
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-006

---

## Tasks Frontend

### TASK-004: [FE] BrollTrack, AudioTrack (automation de ganancia) y CaptionTrack mínimo

- **Historias:** US-3-001, US-3-005
- **CA que cierra:** ninguno numerado directamente — soporta CA-023 (usa `timelineToSequenceProps`)
  y prepara CA-025 (usa `captionLayout`)
- **Descripción:** Tres componentes de pista, cada uno ubicado con `<Sequence>` en el `from`/
  `durationInFrames` que le da `timelineToSequenceProps` (RN-1):
  - `BrollTrack`: renderiza los clips de `broll` con `<OffthreadVideo>`/`<Img>` según el tipo de
    asset.
  - `AudioTrack`: renderiza `voice` y `music` con `<Audio>`, aplicando la ganancia de cada clip y,
    para `music`, la automatización de ganancia (`AudioMixPlan.automation`) vía `interpolate` de
    Remotion en cada frame — nunca un volumen fijo (RN-8, RN-9).
  - `CaptionTrack`: versión mínima (texto plano) que ubica cada `captionClip` dentro de la caja que
    devuelve `captionLayout` (TASK-003) — sin resaltado ni tipografía cinética (RN-7, fuera de
    alcance hasta 003).
  Ningún componente tiene estado propio ni I/O — reciben la Timeline y devuelven JSX puro (regla de
  la constitución de la lib).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/components/broll-track.tsx`
  - `libs/composition-remotion/src/components/audio-track.tsx`
  - `libs/composition-remotion/src/components/caption-track.tsx`
- **Criterio de done:**
  - [ ] `AudioTrack` calcula la ganancia de `music` en cada frame con `interpolate` a partir de
        `AudioMixPlan.automation`, nunca con un valor constante (CA-9)
  - [ ] `AudioTrack` reproduce `voice` con la ganancia y el rango (`from`/`durationFrames`) exactos
        del clip (CA-10)
  - [ ] `CaptionTrack` ubica el texto siempre dentro de la caja de `captionLayout` (CA-7, CA-8)
  - [ ] Un `assetId` que no resuelve en `timeline.assets` no rompe el resto de la composición — la
        pista afectada se degrada sin tirar abajo las demás (CE-1)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-001, TASK-003

### TASK-005: [FE] ArollSeries con TransitionSeries (fade, slide, whip-pan propia) y light-leak→fade

- **Historias:** US-3-002, US-3-003
- **CA que cierra:** ninguno numerado directamente — soporta CA-024 (usa `transitionTiming`) y
  CA-023 (usa `timelineToSequenceProps` para las escenas de A-roll)
- **Descripción:** `ArollSeries` encadena los clips de `aroll` con `TransitionSeries` de
  `@remotion/transitions`, usando `transitionTiming` (TASK-003) para elegir `springTiming` o
  `linearTiming` según cada `transition.timing` de la Timeline (RN-3). Presentaciones: `fade` y
  `slide(direction)` reusadas de `@remotion/transitions`; `whip-pan(direction)` propia (desenfoque
  de movimiento + desplazamiento veloz) implementada en esta lib. Cada clip de A-roll con
  `transform` aplica `punchInStyle` (TASK-003) sin reinterpretar sus valores (RN-5). Una transición
  de tipo `"light-leak"` se acepta en el contrato y se renderiza como `fade` en este ciclo, sin que
  el sistema falle por no reconocerla (RN-4, CE-2) — el efecto visual real de light-leak queda para
  spec-003 (kinetic typography).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/transitions/whip-pan.ts`
  - `libs/composition-remotion/src/transitions/whip-pan.spec.ts` (la parte pura de cálculo de
    desplazamiento/blur por frame, sin montar `TransitionSeries`)
  - `libs/composition-remotion/src/components/aroll-series.tsx`
- **Criterio de done:**
  - [ ] Una transición `spring` anima con la duración exacta de `transition.durationFrames`; una
        `linear` cambia a velocidad constante en esos mismos cuadros, sin rebote (CA-3, CA-4)
  - [ ] Una transición `"light-leak"` se muestra como `fade`, sin romper la serie ni dejar el corte
        sin transición visible (CA-5)
  - [ ] Un clip con `transform` de punch-in se ve acercado y desplazado exactamente en la escala y
        el desplazamiento definidos, con el punto de anclaje correcto (CA-6)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002, TASK-003

### TASK-006: [FE] TimelineComposition + calculateMetadata + Root.tsx (9:16 y 16:9) + remotion.config.ts

- **Historias:** US-3-001, US-3-006
- **CA que cierra:** ninguno numerado directamente — ensambla CA-023 a CA-026 en una composición
  completa y prepara CA-027 (TASK-007 renderiza esta composición)
- **Descripción:** `TimelineComposition` es la composición raíz: recibe una `Timeline` como prop,
  usa `calculateMetadata` de Remotion para derivar `durationInFrames`, `fps`, `width` y `height`
  del propio documento (nunca hardcodeados) y monta `ArollSeries`, `BrollTrack`, `AudioTrack` y
  `CaptionTrack` (TASK-004, TASK-005) en el árbol. `Root.tsx` registra `TimelineComposition` con
  `defaultProps` de al menos un ejemplo en 9:16 (1080×1920@30) y otro en 16:9 (1920×1080@30),
  reusando o extendiendo la fixture de TASK-001, para que `remotion studio` los liste (RF-3-06,
  RN-10). `remotion.config.ts` en la raíz de la lib configura el estudio para uso local — no forma
  parte de ningún flujo de CI (RN-11). Abrir el estudio no debe requerir generar ningún archivo de
  video ni descargar nada adicional a lo ya instalado en TASK-001 (CA-12).
- **Archivos a crear/modificar:**
  - `libs/composition-remotion/src/components/timeline-composition.tsx`
  - `libs/composition-remotion/src/Root.tsx`
  - `libs/composition-remotion/remotion.config.ts`
  - `libs/composition-remotion/src/__fixtures__/timeline.fixture.ts` (extender con la variante
    16:9 si TASK-001 solo dejó una)
- **Criterio de done:**
  - [ ] `TimelineComposition` deriva `durationInFrames`/`fps`/`width`/`height` de la Timeline vía
        `calculateMetadata`, no de valores fijos en el componente
  - [ ] `Root.tsx` registra al menos un ejemplo 9:16 y otro 16:9, cada uno con sus propias
        dimensiones y fps (CA-11)
  - [ ] `remotion studio` abre sin generar un MP4 ni descargar componentes fuera de lo instalado en
        TASK-001 (CA-12)
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-004, TASK-005

---

## Orden de ejecución

```
TASK-001 ─┬─→ TASK-002 ─┐
          └─→ TASK-003 ─┼─→ TASK-005 ─┐
                         └─→ TASK-004 ─┴─→ TASK-006 → TASK-007
```

TASK-002 y TASK-003 solo requieren TASK-001 y corren en paralelo entre sí (archivos distintos,
`src/helpers/*` sin overlap). TASK-004 requiere TASK-003 (usa `captionLayout`); TASK-005 requiere
TASK-002 y TASK-003 (usa `timelineToSequenceProps` y `transitionTiming`). TASK-004 y TASK-005
pueden avanzar en paralelo entre sí una vez cerrada TASK-003 — tocan archivos distintos
(`components/broll-track.tsx`+`audio-track.tsx`+`caption-track.tsx` vs.
`transitions/whip-pan.ts`+`components/aroll-series.tsx`). TASK-006 ensambla ambas pistas y por eso
requiere que las dos (TASK-004 y TASK-005) estén cerradas. TASK-007 es la única task final: no
corre en paralelo con nada y es la que lleva el único criterio de cobertura global del ciclo.

**Camino crítico:** `TASK-001 → TASK-003 → TASK-004 → TASK-006 → TASK-007` (o el equivalente vía
TASK-005, misma longitud: 4h + 4h + 4h + 4h + 4h = 20h). TASK-002 tiene holgura — puede terminar en
cualquier momento antes de que TASK-005 lo necesite.

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.
