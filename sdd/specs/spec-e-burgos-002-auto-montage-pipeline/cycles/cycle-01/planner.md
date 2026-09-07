# Sprint Plan — Cycle 1: Auto Montage Pipeline (Ingesta y catálogo del proyecto de medios)

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                       |
| -------------------- | -------------------------------------------- |
| Ciclo                | 1                                            |
| Módulo               | auto-montage-pipeline                       |
| App                  | libs/auto-montage                           |
| Duración estimada    | ~1 semana (24.5h)                           |
| Story points totales | 25                                           |
| Tasks                | 11 (todas de implementor-back)              |

Este ciclo no tiene frontend: el actor es el dev operando su máquina local, sin UI ni red.
Toda la implementación es sobre `libs/auto-montage`.

---

## Tasks Backend

### TASK-001: Scaffold de libs/auto-montage con scaffold-nx

**Historia:** HU-01, HU-02, HU-03, HU-04, HU-05, HU-06 (infraestructura base del ciclo)
**App:** libs/auto-montage
**Descripción:** Scaffoldear `libs/auto-montage` con la skill `scaffold-nx`: targets explícitos
`lint`/`test`/`build`, alias `@video-maker/auto-montage` en `tsconfig.base.json` Y en
`resolve.alias` de `vite.config.ts`. Sin este scaffold ninguna otra task puede arrancar.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] `nx run-many -t lint test build` corre verde sobre `libs/auto-montage` (aunque esté vacía de lógica)
- [ ] Alias presente en `tsconfig.base.json` (`paths`) y en `vite.config.ts` (`resolve.alias`)
- [ ] Ningún plugin inferido nuevo agregado a `nx.json`

---

### TASK-002: Contrato del proyecto de medios — tipos y resolución de rutas raw/work/out

**Historia:** HU-03, HU-05
**App:** libs/auto-montage
**Descripción:** Definir el contrato del proyecto de medios: dado un `project-slug`, resolver
las rutas `raw/`, `work/`, `out/` bajo `media/<project-slug>/` (según D-2 del arquitecto, la raíz
del proyecto de medios) y los tipos base que el resto del ciclo consume. Lógica pura, testeable
con fixtures de paths sin tocar el filesystem real.
**Estimación:** 1.5h · **Story points:** 2
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] Dado un slug, la función retorna las tres rutas esperadas y son consistentes con las que
      usa el resto de las tasks (schema del catálogo incluido)
- [ ] Tests con fixtures cubren el caso feliz sin acceder al filesystem

---

### TASK-003: Puerto de filesystem inyectable con invariante de solo-lectura en raw/

**Historia:** HU-05
**App:** libs/auto-montage
**Descripción:** Puerto de I/O inyectable (`FilesystemPort` o equivalente que defina el
arquitecto) para leer/escribir sobre el proyecto de medios, con la invariante de que cualquier
intento de escritura dentro de `raw/` — desde cualquier etapa del pipeline — resulta en un error
tipado y no produce ningún efecto sobre el filesystem real.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] CA-006: un intento de escritura dentro de `raw/` lanza un error tipado y no toca el disco
      (verificable con un fake/mock del puerto en los tests)
- [ ] El puerto es inyectable: la suite corre sin binarios ni filesystem real

---

### TASK-004: Descubrimiento y clasificación de assets en raw/ por subcarpeta

**Historia:** HU-01
**App:** libs/auto-montage
**Descripción:** Recorrer `raw/` vía el puerto de filesystem (TASK-003) y clasificar cada
archivo según su subcarpeta (`aroll`, `broll`, `images`, `audio`), ignorando archivos ocultos y
extensiones no soportadas (se reportan como ignorados, nunca como error).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-003
**Criterio de done:**

- [ ] CA-001: dado un árbol `raw/` de fixture con las cuatro subcarpetas, un oculto y una
      extensión no soportada, el resultado contiene exactamente los assets esperados y reporta
      ambos casos como ignorados

---

### TASK-005: Probe de assets descubiertos vía probeMedia, tolerante a fallos individuales

**Historia:** HU-02
**App:** libs/auto-montage
**Descripción:** Sondear cada asset descubierto (TASK-004) con `probeMedia` de `media-local`
para obtener duración y formato. Un asset cuyo sondeo falla se reporta con su ruta y no aborta
el sondeo del resto.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] CA-002: si el sondeo de un asset falla, el resto de los assets sondeados correctamente
      sigue disponible y el fallido queda reportado con su ruta, sin abortar la ingesta

---

### TASK-006: Schema Zod del catálogo con rutas siempre relativas

**Historia:** HU-03
**App:** libs/auto-montage
**Descripción:** Schema Zod propio del catálogo (`work/catalog.json`) que ensambla los assets
sondeados (TASK-005) y garantiza que ninguna ruta serializada empieza con `/` — todas relativas
a la raíz del proyecto de medios. Lógica pura de validación/serialización, sin I/O.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-005
**Criterio de done:**

- [ ] CA-003: en el catálogo serializado, ninguna ruta de asset empieza con `/`
- [ ] El schema rechaza (o normaliza, según defina el arquitecto) cualquier ruta absoluta de entrada

---

### TASK-007: Persistencia y lectura de work/catalog.json vía el puerto de filesystem

**Historia:** HU-03, HU-05
**App:** libs/auto-montage
**Descripción:** Persistir y releer el catálogo (TASK-006) en `work/catalog.json` usando el
puerto de filesystem (TASK-003), respetando que la escritura ocurre siempre dentro de `work/`,
nunca en `raw/`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003, TASK-006
**Criterio de done:**

- [ ] Un catálogo persistido puede releerse y reconstruye el mismo estado
- [ ] Ningún path de escritura de esta task puede resolver dentro de `raw/` (cubierto por el
      puerto de TASK-003)

---

### TASK-008: Lógica de invalidación incremental de transcripciones

**Historia:** HU-04
**App:** libs/auto-montage
**Descripción:** Dado el estado persistido de un clip de A-roll (tamaño y fecha de modificación
en el catálogo) y su estado actual en disco, decidir si la transcripción existente sigue vigente
o debe regenerarse. Lógica pura, testeable con fixtures de metadata sin invocar whisper-cli.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-007
**Criterio de done:**

- [ ] CA-004 (lógica): con metadata sin cambios, la decisión es "no re-transcribir"
- [ ] CA-005 (lógica): con tamaño o mtime distintos, la decisión es "invalidar y re-transcribir"
      únicamente ese clip, sin afectar la decisión de los demás

---

### TASK-009: Transcripción incremental del A-roll vía transcribeWithWhisperCpp

**Historia:** HU-04
**App:** libs/auto-montage
**Descripción:** Orquestar la transcripción del A-roll usando `transcribeWithWhisperCpp` de
`media-local`, persistiendo el resultado en `work/transcripts/` y aplicando la decisión de
TASK-008 para no invocar whisper-cli sobre clips sin cambios.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-008
**Criterio de done:**

- [ ] CA-004 (integración): una segunda ingesta sobre un proyecto sin cambios en su A-roll no
      genera ninguna invocación nueva a whisper-cli (verificable con un `CommandRunner` fake que
      cuenta invocaciones)
- [ ] CA-005 (integración): un cambio en un clip de A-roll dispara una nueva transcripción solo
      para ese clip

---

### TASK-010: Integración end-to-end — función pública de ingesta del proyecto de medios

**Historia:** HU-01, HU-02, HU-03, HU-04, HU-05
**App:** libs/auto-montage
**Descripción:** Componer el pipeline completo (contrato → descubrimiento → probe → catálogo →
transcripción incremental) detrás de una única función pública de la lib (p. ej.
`ingestMediaProject`), que es lo que consumirá el smoke manual y, en ciclos futuros, la CLI.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-009
**Criterio de done:**

- [ ] Un test de integración con puertos fake (filesystem + `CommandRunner`) corre la ingesta
      completa sobre un árbol de fixture y produce un catálogo coherente con transcripciones
- [ ] Ninguna etapa del pipeline compuesto escribe dentro de `raw/` (test de integración lo cubre)

---

### TASK-011: Target de smoke manual sobre un proyecto real

**Historia:** HU-06
**App:** libs/auto-montage
**Descripción:** Documentar en el README de `libs/auto-montage` un target de smoke manual que
corre `ingestMediaProject` (TASK-010) sobre un proyecto real en `media/`, con whisper-cli y las
herramientas de sondeo instaladas en la máquina — sin binarios en CI.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] CA-007: correr el target documentado sobre un proyecto real produce un `catalog.json` y
      transcripciones coherentes con el contenido real del material
- [ ] El README deja explícito que este target no corre en CI (requiere binarios locales)

---

## Orden de ejecución

Camino crítico lineal — no hay paralelismo real entre tasks dentro de este ciclo, porque cada
etapa del pipeline consume el output de la anterior:

```
TASK-001 (scaffold)
  → TASK-002 (contrato de rutas)
    → TASK-003 (puerto de filesystem + invariante raw/ read-only)
      → TASK-004 (descubrimiento y clasificación)
        → TASK-005 (probe tolerante a fallos)
          → TASK-006 (schema del catálogo, rutas relativas)
            → TASK-007 (persistencia del catálogo)
              → TASK-008 (lógica de invalidación incremental)
                → TASK-009 (transcripción incremental orquestada)
                  → TASK-010 (integración end-to-end)
                    → TASK-011 (smoke manual — última, requiere binarios)
```

División lógica pura vs. I/O (para que el implementador sepa qué puede testear con fixtures y
qué necesita puertos inyectables):

- **Lógica pura, testeable con fixtures:** TASK-002, TASK-006, TASK-008
- **I/O, con puertos inyectables (sin binarios en CI):** TASK-003, TASK-004, TASK-005, TASK-007, TASK-009
- **Integración de todo lo anterior:** TASK-010 (con fakes) y TASK-011 (con binarios reales, manual)

## Riesgos operativos (de `known_traps` del brief)

- **Alias de Vite:** `vite.config.ts` necesita `resolve.alias` de cada `@video-maker/*` que
  importe `libs/auto-montage` (mínimo `timeline-core` y `media-local`). `tsc` resuelve por
  `tsconfig.base.json` → `paths`, pero Vitest/Vite no — si falta, lint y build quedan verdes y
  los tests revientan con `ERR_MODULE_NOT_FOUND`. Verificar en TASK-001, antes de escribir
  ningún test de las tasks siguientes.
- **`NX_WORKSPACE_ROOT_PATH`:** verificar que no apunte a otro repo antes de correr cualquier
  `nx …` en cualquier task — si está mal seteada, corre los targets de otro repo sin error
  visible.
- **Plugins inferidos en `nx.json`:** no agregar ninguno en TASK-001 (ni después). `@nx/vitest`
  infiere `test` en modo watch y cuelga `nx run-many -t test`.
