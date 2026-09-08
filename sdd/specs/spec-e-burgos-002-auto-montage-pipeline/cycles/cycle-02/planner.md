# Sprint Plan — Cycle 2: Conceptos clave, planificador de B-roll y composición del auto-montaje

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo                 | Valor                                          |
| --------------------- | ----------------------------------------------- |
| Ciclo                 | 2                                                |
| Módulo                | auto-montage-pipeline                            |
| App                   | libs/auto-montage (TASK-012 condicional: libs/timeline-core) |
| Duración estimada     | ~1.5 semanas (34h sin la condicional, 37h con ella) |
| Story points totales  | 39 SP sin la condicional, 42 SP con ella         |
| Tasks                 | 11 firmes + 1 condicional (12 en tasks.json)     |

Ciclo sin frontend: el actor sigue siendo el dev operando su máquina local. Toda la
implementación es sobre `libs/auto-montage`, salvo la task condicional que —si D-4 lo
requiere— toca `libs/timeline-core`.

Corro en paralelo con el sdd-architect: no toqué `architect.md`, `functional.md`,
`brief.yaml` ni `cycle.json`. La task condicional (TASK-012) queda con el alcance que
definió el brief; el orquestador/architect la ajusta (o la marca `skipped`) una vez
resuelto D-4.

---

## Tasks Backend

### TASK-001: Tipo `Preset` y los 4 presets (`software-demo`, `hardware`, `recipe`, `educational`)

**Historia:** HU-09
**App:** libs/auto-montage
**Descripción:** Definir en `src/presets/` el tipo `Preset` (agresividad de poda, agresividad y
frecuencia de punch-in, ventana de no-repetición de B-roll, densidad de B-roll, transición
dominante, diccionario de conceptos, umbral mínimo de frecuencia) y las 4 instancias concretas
con parámetros propios en cada eje de RN-16. Es la base que consumen todas las demás familias:
ninguna otra task puede arrancar sin esto. Lógica y datos puros, sin I/O.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-010: existen exactamente los 4 presets con los IDs `software-demo`, `hardware`,
      `recipe`, `educational`
- [ ] CA-010: un test compara los 4 presets **entre sí** (no contra un literal fijo) y confirma
      que difieren en, como mínimo, los 5 ejes de RN-16
- [ ] `nx run auto-montage:lint` y `:test` verdes sobre `src/presets/`

---

### TASK-002: Normalización léxica y stopwords por idioma, con fallback para idiomas sin lista (A-5)

**Historia:** HU-07
**App:** libs/auto-montage
**Descripción:** Función de normalización léxica (minúsculas, sin tildes, sin signos de
puntuación) reutilizada por el keyword spotting y por el matching de nombres de archivo del
B-roll. Listas de stopwords por idioma y el comportamiento que definió el arquitecto para
`Transcription.language` sin lista propia (A-5: degradar a una lista por defecto, fallar
tipado, o lo que haya resuelto). Lógica pura, testeable con fixtures de string.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Dado un término con tildes/mayúsculas/puntuación, la normalización produce la forma
      canónica esperada
- [ ] Rama con lista de stopwords conocida y rama con idioma sin lista (A-5) cubiertas cada
      una con su propio test, en esta misma task

---

### TASK-003: Keyword spotting — conceptos clave con sus ocurrencias temporales

**Historia:** HU-07
**App:** libs/auto-montage
**Descripción:** En `src/concepts/`, sobre una `Transcription` ya normalizada (TASK-002) y el
diccionario/umbral del preset (TASK-001), detectar los conceptos clave (RN-08: frecuencia ≥
umbral del preset, o presencia literal en el diccionario del preset con una sola mención
alcanzando) y calcular el rango temporal de cada ocurrencia a partir de los timestamps de las
palabras que la componen (RN-09). Función pura sobre `Transcription`, sin ningún servicio
externo ni modelo de lenguaje.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-002
**Criterio de done:**

- [ ] CA-008: sobre una `Transcription` de fixture, el conjunto de conceptos detectado coincide
      con el esperado, cada uno con su(s) rango(s) temporal(es)
- [ ] CA-008: dos corridas sobre la misma `Transcription` y el mismo preset producen el mismo
      conjunto de conceptos, en el mismo orden (test de determinismo explícito)
- [ ] Rama "cumple por frecuencia", rama "cumple por diccionario" y rama "no es concepto
      (stopword o ninguna condición)" cubiertas cada una con su propio test

---

### TASK-004: Candidatos de B-roll por concepto — matching léxico contra `broll/` e `images/`

**Historia:** HU-08
**App:** libs/auto-montage
**Descripción:** En `src/broll/`, dado el conjunto de conceptos (TASK-003) y los assets
`broll`/`image` del catálogo (cycle-01), generar la lista de candidatos por concepto comparando
el concepto normalizado (TASK-002) contra el nombre de archivo normalizado del asset (RN-10,
RN-11). Aplicar el criterio de A-1 que fijó el arquitecto (nombre de archivo como única señal, o
la fuente adicional que haya decidido) y, si dos tipos de asset matchean igual, el criterio de
prioridad de A-2 entre `broll/` e `images/`. Lógica pura sobre listas, sin I/O.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002, TASK-003
**Criterio de done:**

- [ ] Dado un concepto y un catálogo de fixture con assets de `broll/` e `images/`, la lista de
      candidatos generada matchea exactamente lo esperado
- [ ] Rama "coincide por `broll/`", rama "coincide por `images/`" y rama "empate entre ambos
      tipos resuelto por A-2" cubiertas cada una con su propio test

---

### TASK-005: Selección con ventana de no-repetición y desempate determinista entre conceptos

**Historia:** HU-08
**App:** libs/auto-montage
**Descripción:** Sobre los candidatos de TASK-004, aplicar la ventana de no-repetición del
preset (RN-12: ningún asset vuelve a usarse mientras no transcurrió esa ventana desde su último
uso, sin importar si lo disparó el mismo concepto u otro) y el criterio de prioridad
enteramente determinista que definió el arquitecto para cuando dos o más conceptos compiten por
el mismo asset (RN-15) — independiente del orden de iteración del catálogo o de un mapa en
memoria. Los conceptos que compiten y pierden quedan sin asset para esa ocurrencia.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] CA-009: ningún asset se asigna dos veces dentro de la ventana de no-repetición del
      preset, sea el mismo concepto repetido u otro distinto
- [ ] CA-009: cuando dos conceptos compiten por el mismo asset, el desempate es determinista —
      un test corre la selección con dos órdenes de entrada distintos (ej. catálogo shuffleado)
      y confirma el mismo resultado en ambos casos
- [ ] Rama "ventana aún no vencida" y rama "ventana vencida, asset reutilizable" cubiertas cada
      una con su propio test

---

### TASK-006: No-solape con punch-ins, duración mín/máx del overlay y concepto sin candidato

**Historia:** HU-08
**App:** libs/auto-montage
**Descripción:** Cerrar el planificador de B-roll: ninguna superposición seleccionada (TASK-005)
puede caer, total ni parcialmente, dentro del rango temporal de un punch-in ya planificado por
`planPunchIns` (RN-13); aplicar la duración mínima/máxima del overlay que define el preset; y un
concepto (u ocurrencia) sin ningún candidato, o cuyo único candidato quedó descartado por
solaparse con un punch-in, no genera overlay y no interrumpe la planificación del resto
(RN-14). Salida: lista de `BrollOverlayDecision`-like listas para entrar al EDL.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-005
**Criterio de done:**

- [ ] CA-009: ninguna superposición planificada solapa, ni total ni parcialmente, un punch-in ya
      planificado (fixture con punch-ins conocidos)
- [ ] CA-009: un concepto sin candidato, y un concepto cuyo único candidato quedó descartado por
      solape con punch-in, no producen overlay y el resto de la planificación sigue sin
      interrumpirse
- [ ] Rama de clamp por duración mínima y rama de clamp por duración máxima cubiertas cada una
      con su propio test

---

### TASK-007: Composición — `autoMontage` orquesta timeline-core, conceptos y B-roll

**Historia:** HU-10
**App:** libs/auto-montage
**Descripción:** En `src/auto-montage.ts`, componer en el orden correcto: `pruneSilences` →
`planPunchIns` → keyword spotting (TASK-003) → planificador de B-roll (TASK-004..006) →
`groupWordsForCaptions` → `planDucking` → `buildTimeline`, usando los parámetros del preset
elegido (TASK-001) y el `seed` recibido. La salida es un `EditDecisionList` válido (pasa su
propio `.parse()`/`superRefine`) y una `Timeline` que pasa `validateTimeline` sin ningún issue,
sobre el caso feliz de un proyecto de fixture con material en todas las categorías.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-001, TASK-006
**Criterio de done:**

- [ ] CA-011: sobre el proyecto de fixture con `aroll`/`broll`/`images` completos,
      `autoMontage(project, preset, seed)` produce una `Timeline` que pasa `validateTimeline`
      sin ningún issue
- [ ] El orden de composición respeta las dependencias de datos entre etapas (ej. el B-roll no
      se planifica antes de tener los punch-ins, para poder excluirlos)
- [ ] Ningún cálculo de esta task lee `Date`, `process` ni usa `Math.random` — toda variación
      entra por `seed` (verificable por ESLint de la lib)

---

### TASK-008: Persistencia de `work/edl.json` y `work/timeline.json` vía puertos inyectables

**Historia:** HU-10
**App:** libs/auto-montage
**Descripción:** Persistir y releer el `EditDecisionList` y la `Timeline` (TASK-007) en
`work/edl.json` y `work/timeline.json`, reutilizando los puertos de filesystem inyectables del
cycle-01 y su guard de solo-lectura sobre `raw/`. Serializar con las schemas de
`@video-maker/timeline-core` (`EditDecisionListSchema`, `TimelineSchema`).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-007
**Criterio de done:**

- [ ] Un EDL y una Timeline persistidos pueden releerse y reconstruyen el mismo estado
      (roundtrip con `.parse()`)
- [ ] Ningún path de escritura de esta task puede resolver dentro de `raw/` (cubierto por el
      puerto del cycle-01)

---

### TASK-009: Integración end-to-end — función pública del auto-montaje

**Historia:** HU-07, HU-08, HU-09, HU-10
**App:** libs/auto-montage
**Descripción:** Exponer la función pública de la lib (p. ej. `autoMontageProject(project,
preset, seed)`) que lee `work/catalog.json` y las transcripciones (cycle-01) vía los puertos
inyectables, compone el auto-montaje (TASK-007) y persiste el resultado (TASK-008). Es lo que
consumirá `tools/render-cli` en `cycle-03`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-008
**Criterio de done:**

- [ ] Un test de integración con puertos fake corre el pipeline completo sobre un proyecto de
      fixture ya ingerido y produce `edl.json`/`timeline.json` coherentes
- [ ] La función queda exportada desde `src/index.ts`

---

### TASK-010: CA-012 — determinismo byte a byte de `edl.json` y `timeline.json`

**Historia:** HU-11
**App:** libs/auto-montage
**Descripción:** Task dedicada al CA-012, no un detalle de otra task. Definir (con el arquitecto)
y verificar la función de serialización determinista de `edl.json` y `timeline.json` —
incluyendo el **orden de claves** tras un `.parse()` de Zod, que cycle-01 dejó registrado como
no idéntico al literal de entrada y por eso se verifica con test, nunca se asume.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-009
**Criterio de done:**

- [ ] CA-012: correr `autoMontageProject` dos veces sobre el mismo proyecto, preset y `seed`
      produce un `timeline.json` (y un `edl.json`) serializado byte a byte idéntico entre ambas
      corridas
- [ ] Un test compara explícitamente el **orden de claves** del JSON serializado contra el
      orden esperado (no asume que `JSON.stringify` tras `.parse()` preserva el orden del
      literal de entrada)
- [ ] CA-012 / RN-18: cambiar el `seed` puede cambiar el resultado; cambiar el orden en que un
      fake de filesystem devuelve los assets del catálogo, no

---

### TASK-011: Cobertura de branches con margen real y casos degenerados (RN-17)

**Historia:** HU-10
**App:** libs/auto-montage
**Descripción:** Task dedicada, no un añadido de otra task. cycle-01 cerró en 85,25 % de branches
contra un umbral de 85 — sin margen real, y este ciclo agrega ramas nuevas en presets, conceptos
y B-roll. Sumar los tests de rama que falten para dejar un margen real sobre el umbral, y los
tres casos degenerados de RN-17 que HU-10/CA-011 exigen y que las tasks anteriores no cubrieron
explícitamente: proyecto sin ningún asset en `broll/` ni `images/`, `Transcription` sin
palabras, y A-roll sin silencios detectables — en los tres casos `autoMontage` no lanza excepción
y produce igual una `Timeline` válida.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-009
**Criterio de done:**

- [ ] CA-011: fixture sin `broll/` ni `images/` → `autoMontage` no falla, `Timeline` válida sin
      superposiciones de B-roll
- [ ] CA-011: fixture con `Transcription` sin palabras → `autoMontage` no falla, sin conceptos
      ni B-roll planificado
- [ ] CA-011: fixture de A-roll sin silencios detectables → `autoMontage` no falla, A-roll
      completo sin cortes de poda
- [ ] `nx run auto-montage:test -- --coverage` reporta branches con margen real sobre el 85 %
      (no un empate apenas por encima)

---

### TASK-012 (CONDICIONAL — sujeta a la resolución de D-4 en `architect.md`): extensión aditiva de `libs/timeline-core` para el anchor del punch-in

**Historia:** HU-10
**App:** libs/timeline-core (única task del ciclo fuera de `libs/auto-montage`)
**Estado al abrir el ciclo:** `pending`, pero **su alcance final depende de `architect.md`**.
Esta task solo aplica si el arquitecto resuelve D-4 con la opción (a) — extender
`timeline-core` de forma aditiva y retrocompatible para que el `anchor` del punch-in llegue
hasta la `Timeline`. Si resuelve la opción (b) — el `anchor` se pierde a propósito antes de la
`Timeline`, resuelto enteramente dentro de `auto-montage` —, el orquestador marca esta task
`skipped` sin tocar `timeline-core`.
**Descripción (si aplica):** Aplicar el cambio aditivo y retrocompatible que definió el
arquitecto (campo opcional en `ClipTransformSchema`/`VideoClipSchema`, o derivación de
`translateX`/`translateY` a partir del `anchor` dentro de `buildTimeline` — lo que haya elegido
D-4), acotado estrictamente a lo necesario para el anchor: nada más entra en ese diff. Regenerar
los JSON Schema commiteados con `pnpm nx run timeline-core:schemas` (`schemas.spec.ts` los
compara byte a byte) y escribir el fragmento de contexto en
`sdd/context/libs/timeline-core/updates/2026-09-07-spec-e-burgos-002-cycle-02.md`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna declarada — **advertencia:** si D-4 resuelve la opción (a), TASK-007
(composición) probablemente necesita este cambio disponible antes de wirear el anchor hasta la
`Timeline`; el orquestador/architect debe entonces insertar `TASK-007` → `depends_on: TASK-012`
al ajustar este archivo con el `architect.md` en mano. No lo pre-asumo acá porque corro en
paralelo con el architect y todavía no sé qué eligió.
**Criterio de done (si aplica):**

- [ ] El cambio es aditivo y retrocompatible: ningún test existente de `timeline-core` cambia
      de resultado
- [ ] `pnpm nx run timeline-core:schemas` regenerado y commiteado; `schemas.spec.ts` compara
      byte a byte en verde
- [ ] Fragmento de contexto en `sdd/context/libs/timeline-core/updates/` describiendo el cambio
- [ ] Si esta task se marca `skipped`: el `architect.md` deja escrito dónde se pierde el
      `anchor` y quién lo recupera (opción b), sin tocar `timeline-core`

---

## Orden de ejecución

Camino crítico principal (lineal por familia, con dos ramas cortas de tests que pueden
resolverse en cualquier orden entre sí):

```
TASK-001 (presets) ─┐
                     ├─→ TASK-003 (keyword spotting)
TASK-002 (normalización + stopwords) ─┘
                                        → TASK-004 (candidatos de B-roll)
                                          → TASK-005 (no-repetición + desempate)
                                            → TASK-006 (no-solape con punch-in + duración)
                                              → TASK-007 (composición: autoMontage)
                                                → TASK-008 (persistencia edl/timeline)
                                                  → TASK-009 (integración end-to-end)
                                                    → TASK-010 (CA-012: determinismo byte a byte)
                                                    → TASK-011 (cobertura + casos degenerados)

TASK-012 (condicional D-4, libs/timeline-core) — posición final provisional, ver advertencia
en su propia descripción; el orquestador la resecuencia con el architect.md en mano.
```

División lógica pura vs. I/O (para que el implementador sepa qué puede testear con fixtures y
qué necesita puertos inyectables):

- **Lógica pura, testeable con fixtures:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005,
  TASK-006, TASK-007 (todas las funciones de `src/presets/`, `src/concepts/`, `src/broll/` y la
  orquestación de `auto-montage.ts` son funciones puras sobre datos ya en memoria)
- **I/O, con puertos inyectables (sin binarios en CI):** TASK-008, TASK-009
- **Determinismo y cobertura, sobre todo lo anterior:** TASK-010, TASK-011
- **Condicional, otra lib:** TASK-012

## Riesgos operativos (de `known_traps` del brief)

- **Cobertura de branches en 85,25 % contra umbral 85:** cualquier rama nueva sin test la pone
  en rojo de inmediato. Por eso cada task de TASK-001 a TASK-007 suma sus propios tests de rama
  en la misma task (regla del ciclo), y TASK-011 existe además como red de seguridad para el
  margen agregado y los tres casos degenerados de RN-17.
- **Orden de claves de `JSON.stringify` tras `.parse()` de Zod:** no es el del literal de
  entrada — TASK-010 lo verifica con test explícito, nunca lo asume, igual que hizo el
  cycle-01 con el catálogo.
- **ESLint prohíbe `Date`, `process` y `Math.random` fuera de `src/smoke.ts`:** ninguna task de
  este ciclo puede introducirlos; toda variación (desempates, selección de transición, etc.)
  entra por `seed`. Verificar en TASK-003, TASK-005 y TASK-007 en particular.
- **Alias de Vite:** si TASK-012 llega a ejecutarse y algo de `auto-montage` empieza a importar
  un símbolo nuevo de `timeline-core`, confirmar que `vite.config.ts` ya lo resuelve (cycle-01
  ya dejó el alias de `timeline-core`, pero un símbolo nuevo exportado no rompe el alias en sí).
- **`NX_WORKSPACE_ROOT_PATH`:** verificar que no apunte a otro repo antes de correr cualquier
  `nx …` en cualquier task.
- **Hook que bloquea `Write`/`Edit` sobre config raíz:** si TASK-012 toca algo fuera de
  `libs/timeline-core/src/`, y un hook bloquea la escritura, PARAR y reportar al orquestador —
  no rodearlo con Bash (incidente abierto de cycle-01).

## Pendiente de documentar en contexto

- **TASK-001 — `resolveMontagePreset` diferido, no implementado todavía.** `architect.md` §2
  describe `presets/preset-registry.ts` como `MONTAGE_PRESETS + resolveMontagePreset(nameOrPreset)`
  en un solo archivo, pero el criterio de done de TASK-001 en este documento sólo exige "existen
  los 4 presets" y el test comparativo de CA-010 — no ejercita la resolución. Implementé
  únicamente `MONTAGE_PRESETS` (el registro `Record<MontagePresetName, MontagePreset>`).
  `resolveMontagePreset` requiere lanzar `MontageInputError('unknown-preset')` (D-20), una clase
  que vive en `src/errors/` y no está asignada a ninguna task de este documento — queda para la
  task que primero consuma `AutoMontageOptions.preset: MontagePresetName | MontagePreset`
  (arquitectónicamente TASK-007, la única que depende de TASK-001 y compone `autoMontage`).
  Cuando esa task la agregue, extiende `preset-registry.ts` (no lo reemplaza) y agrega el export
  a `src/index.ts`.
- **TASK-001 — diccionarios de concepto ya normalizados a mano, sin invocar `normalizeTerm`.**
  El test de vocabulario de `architect.md` §3.4 (familia 2) dice "ningún diccionario... tiene
  duplicados **tras `normalizeTerm`**", pero `normalizeTerm` es de TASK-002, que corre en paralelo
  a TASK-001 (sin dependencia entre ellas) — no existía al escribir esta task. Escribí los 6
  términos de cada preset ya en la forma que produciría `normalizeTerm` (minúsculas, sin tildes,
  sin puntuación: `bateria`, `sarten`, `formula`, `definicion`, etc.), así que la propiedad que
  pide CA-010 (sin vacíos, sin duplicados, con exclusividad cruzada) se verifica con comparación
  de string plana en `preset-registry.spec.ts` y da el mismo resultado que si pasara por
  `normalizeTerm`. Si TASK-002/003 quiere una aserción más fuerte que invoque `normalizeTerm`
  explícitamente sobre estos diccionarios, puede agregarla sin tocar los preset files.
- **`ClipFit` no se importa de `@video-maker/timeline-core` como sugiere el snippet de
  `architect.md` §3.1** (`import type { ClipFit, PunchInAnchor, Scale } ...`) porque ese tipo no
  está exportado desde el barrel de `timeline-core` (sólo `ClipFitSchema` internamente, sin
  re-export). Usé el mismo patrón ya validado en `libs/composition-remotion/src/helpers/timeline-types.ts`:
  derivar `type ClipFit = NonNullable<VideoClip['fit']>` localmente en `montage-preset.ts`, ya que
  `VideoClip` sí es público. `PunchInAnchor` y `Scale` sí se importan directo del barrel, sin
  problema.
