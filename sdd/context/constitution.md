# Constitución del Proyecto

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Es la única fuente de verdad — este documento nunca los hardcodea, así `sdd/` se copia
> a otro repo sin editarlo. `pnpm sdd:validate` falla si el nombre se filtra acá.
> Versión 1.0 | Metodología: SDD (Spec-Driven Development) | Última actualización: cycle-0 (inicial)
> Este documento representa la base institucional, tecnológica y metodológica del proyecto.
> **PLANTILLA:** completar las secciones marcadas con `[...]` al inicializar el proyecto.

---

## 1. Resumen Ejecutivo y Visión

### 1.1 Propósito del Sistema

- **Nombre:** ver `sdd/global.json` → `project`
- **Rol arquitectónico:** motor local y autónomo de edición/postproducción de video para redes sociales (Reels/TikTok 9:16 y YouTube 16:9). Recibe material real (clips de cámara o pantalla, fotos de apoyo, locución y música), lo describe como datos (`Timeline` + `EditDecisionList`), calcula la edición (poda de silencios, punch-ins, captions, ducking) y la materializa con FFmpeg, Whisper local y Remotion. Sirve al creador que opera el sistema en su propia máquina, sin costo por minuto ni salida del material a la nube.
- **Descripción:** ver `sdd/global.json` → `description`

### 1.2 Responsabilidades del Sistema

**Sí hacemos:**

- Representar cualquier video de salida como un documento de datos validable contra JSON Schema.
- Calcular las decisiones de edición de forma determinista y testeable sin renderizar.
- Sondear, transcribir, normalizar y renderizar con herramientas 100% locales (FFmpeg, whisper.cpp, Remotion).
- Ofrecer previsualización, gestión de assets y disparo de renders locales desde una UI web.

**No hacemos:**

- No dependemos de APIs externas pagas (transcripción, IA generativa, render en la nube).
- No subimos material del usuario a servicios de terceros; el almacenamiento es local (filesystem / MinIO en dev).
- No somos un editor no-lineal genérico: cubrimos los cuatro casos de uso declarados en la spec 001.

### 1.3 Principios de Diseño

1. Motor declarativo: la edición es un documento (`Timeline`), nunca código imperativo por video.
2. Determinismo: misma entrada y mismo `seed` producen la misma salida; ningún cálculo lee reloj, entorno ni aleatoriedad.
3. Contrato conservador: toda entrada externa (ffprobe, Whisper, timelines guardadas) se valida con Zod y se rechaza con error tipado; nunca se completa con valores inventados.
4. Sin binarios en CI: los wrappers reciben un runner inyectable y los tests usan fixtures grabadas.
5. Unidades explícitas: milisegundos en el dominio de medios, frames en la timeline, una sola función de conversión.

### 1.4 Objetivos de Desarrollo

- Establecer un proceso de desarrollo guiado por especificaciones (SDD) robusto y de calidad.
- Garantizar que todo cambio pase por una fase de diseño funcional, de planificación y de arquitectura antes de codificar.
- Mantener un contrato de API coherente, versionado y documentado.

---

## 2. Arquitectura del Sistema

### 2.1 Estructura General

El sistema está organizado como un monorepo administrado con Nx.
Para el detalle técnico de cada subproyecto, ver su constitución específica:

| Subproyecto | Tipo | Rol en el sistema | Constitución específica |
| ----------- | ---- | ----------------- | ----------------------- |
| `libs/timeline-core` | lib de dominio TS | Contratos de datos del motor de video y cálculos puros de edición | `sdd/context/libs/timeline-core/constitution.md` |
| `libs/media-local` | lib Node TS | Wrappers de ffprobe/ffmpeg/whisper-cli y parsers hacia los contratos del motor | `sdd/context/libs/media-local/constitution.md` |
| `libs/composition-remotion` | lib React + Remotion | Renderiza una Timeline en frames: pistas, transiciones, captions y render headless | `sdd/context/libs/composition-remotion/constitution.md` |
| `libs/auto-montage` | lib Node TS | Ingesta de un proyecto de medios, keyword spotting, planificador de B-roll y armado automático de la Timeline | `sdd/context/libs/auto-montage/constitution.md` |
| `tools/render-cli` | tool Node ejecutable | CLI headless: de carpeta de assets a MP4 | `sdd/context/tools/render-cli/constitution.md` |
| `apps/render-api` | app Node (servicio HTTP local) | Puerta HTTP del motor: orquesta render mudo → mezcla → mux → verificación de loudness en una sola llamada | `sdd/context/apps/render-api/constitution.md` |
| `apps/web` | app React 19 (SPA local) | Web Studio: biblioteca de assets del proyecto, preview de la Timeline y disparo de renders, todo por HTTP contra `apps/render-api` | `sdd/context/apps/web/constitution.md` |

> Al generar un subproyecto nuevo, sumar una fila a esta tabla (solo agregar filas — nunca reformatear la tabla completa).
> Las constituciones de subproyecto son la **fuente de verdad** del stack y las convenciones técnicas.
> La sección 3 de este documento es un resumen de alto nivel — siempre leer el subproyecto para detalles.

---

## 3. Stack Tecnológico (resumen — fuente de verdad en cada subproyecto)

> ⚠️ Este resumen es mantenido por el Reviewer al cerrar cada ciclo.
> Para el stack completo y actualizado de un subproyecto, leer su `constitution.md` individual.

### Monorepo

- **Nx** + **pnpm** como workspace manager [ajustar a las herramientas reales del proyecto]

### Snapshot de stacks por subproyecto

| Subproyecto | Stack base | Última actualización |
| ----------- | ---------- | -------------------- |
| `libs/timeline-core` | TypeScript estricto + Zod 4.5 + Vitest 4 + `@swc-node/register` (JSON Schema) | cycle-01 \| 2026-09-07 |
| `libs/auto-montage` | TypeScript estricto + Zod 4.5 + Vitest 4 (puertos de I/O inyectables, cero binarios en CI; montaje determinista por seed, smoke manual aparte) | cycle-02 \| 2026-09-07 |
| `tools/render-cli` | TypeScript estricto (ESM, Node >= 22) + `node:util parseArgs` + Vitest 4 (puertos inyectables, cero binarios en CI; render real solo en el target `smoke`) — cero dependencias npm propias; superficie de errores íntegramente en inglés (`[usage]`, `[internal]`, `resource:`, `expected:`, `cause:`, `hint:`) y etapa real del comando en el header cuando el comando se reconoció (FIX-e-burgos-002-002) | FIX-e-burgos-002-002 \| 2026-09-08 |
| `libs/media-local` | TypeScript estricto + execa 10 + Zod 4.5 + Vitest 4 (fixtures de ffprobe grabadas, fixtures de ffmpeg/whisper reconstruidas a mano, cero binarios en CI) + capa pura de mezcla de audio en `src/mix/`: `AudioMixPlan`/`Timeline` → `FilterGraph` tipado → `-filter_complex` y args de ffmpeg, sin ejecutar el binario (paridad de la curva de ducking con el preview de Remotion fijada por tabla) + capa de ejecución en `src/ffmpeg/`: `mixTimelineAudio` (N+1 pasadas, master bus `alimiter level=disabled`), `verifyMixLoudness` (tolerancias declaradas) y `muxAudioIntoVideo` (`-c:v copy`, AAC 192k); target manual `smoke-audio` con ffmpeg real, fuera de CI | spec-004 cycle-02 \| 2026-09-08 |
| `libs/composition-remotion` | React 19 + Remotion 4.0.522 (`transitions`/`bundler`/`renderer`/`cli`) + Vitest 4/jsdom (cero render en CI) + kinetic captions completos: presets con animación `spring`, safe zones por plataforma, plan de caja por clip y `<KineticCaptions />` cableado en `TimelineComposition` (helpers puros, sin binarios de fuente); target `smoke` funcional desde FIX-e-burgos-001-001; `renderTimeline`/`TimelineComposition` aceptan `audio: 'mix' \| 'muted'` (default estructural, render mudo para el mux de `media-local`); componente de video conmutable `TimelineVideo` + contexto `VideoBackendProvider` (default `'render'` → `OffthreadVideo`; `'player'` → `Video`), usado por `ArollSeries` y `BrollTrack`; **paridad de encuadre preview/render resuelta (D-12): `objectFit: 'fill'` sólo en la rama `player`, con el estilo del llamador ganando por orden de spread y la rama `render` invariante carácter por carácter — `sha256` del render reproducido y ningún contrato público cambiado; el encuadre defectuoso es el del render (estirado anamórfico 16:9 en 9:16) y está descopado a un `[FIX]`**; `coverage.include` cubre `src/render.ts`, los dos archivos del conmutador y `src/components/audio-track.tsx` (93,85 % stmts con el piso global de 80 % intacto), el resto de `src/components/**` descopado con fundamento medido (FIX-e-burgos-001-002); bundle webpack verificado de punta a punta por el smoke E2E de `spec-005 cycle-03` | spec-006 cycle-03 \| 2026-09-09 |
| `apps/render-api` | TypeScript estricto (ESM, Node >= 22) + `node:http` + Vitest 4 — cero dependencias npm propias; store de medios sobre `media/` por HTTP y **cola de jobs de render en proceso** (15 endpoints: proyectos, assets con upload binario atómico y catálogo consistente en la misma request, `Timeline`/`EDL` con los mismos bytes que la CLI, descarga de artefactos con `Range`, y jobs con progreso por frame y cancelación cooperativa vía estado transitorio `canceling`) detrás del puerto `ObjectStorage` (único adaptador `fs`, MinIO descopado por D-11) más `probeAsset` y `randomId`; router con parámetros y comodín, superficie de errores propia de 37 códigos, estado vivo por servidor en `RenderApiRuntime` (cola + serializador de uploads, sin estado de módulo) y `runRenderPipeline` disparado por `POST /projects/:slug/jobs`; concurrencia 1 e in-memory, sin persistencia entre reinicios; verificado con smoke real E2E (Remotion + FFmpeg, 538 frames a 1080×1920); las libs pesadas entran sólo por `await import()` en el único adaptador de producción; sin `eslint.config.mjs` propio (D-9); **segundo tipo de job en la misma cola (`kind: 'montage'`, spec-007 cycle-01): `ingestProject` + `autoMontage` sobre `media/<slug>/` con `preset`/`seed`/`overwrite` (`409 TIMELINE_ALREADY_EXISTS` sin `overwrite`), etapas propias `discover`/`probe`/`transcribe`/`plan` con progreso monótono y cancelación cooperativa sólo entre llamadas opacas, `Job`/`JobSummary` como unión discriminada por `kind` retro-compatible campo por campo con lo que `apps/web` ya consume (que no se tocó), `POST /projects/:slug/jobs` leyendo body por primera vez (body ausente/vacío/sin `kind` = el render de antes byte por byte), `GET /health` con los cuatro binarios de media y `capabilities.montageQueue`; `edl.json` byte-idéntico al de la CLI verificado por sha256 y probado sensible al `seed`** | spec-007 cycle-01 \| 2026-09-09 |
| `apps/web` | React 19 + `react-router-dom` 7 + Tailwind CSS 4 + Vite 8 + Vitest 4/jsdom con `@testing-library/react` + **`@remotion/player` 4.0.522** (única dependencia npm propia, versión exacta de `remotion`); Web Studio **completo**: shell con badge de salud, alta y listado de proyectos, biblioteca de assets crudos por rol reproducidos desde `EP-011` con upload binario, preview de la `Timeline` persistida (`EP-007`) montada en el `<Player>` de Remotion con la composición real de `composition-remotion` (backend de video `player`, assets reescritos a URLs same-origin de `EP-011`, encuadre en paridad con el render por D-12), **edición del documento persistido sobre un draft local (trim/orden de escenas, texto de captions, niveles de música con reescritura de `audioMix.automation`, preset de salida) reflejada en el Player antes de guardar y persistida con un único `PUT` completo de `EP-008`, validación de cliente espejo de `validateTimeline` clasificada por severidad, y jobs de render (`EP-012`..`EP-015`) con polling propio, cancelación y descarga del MP4 por `EP-011`** — ruta de preview code-split (chunk inicial 249 kB; `timeline-edit/**` y Zod sólo en el chunk perezoso); toda la frontera con el servicio confinada a `src/api/` (tipos del contrato declarados desde `sdd/api.json`, cliente tipado, `RenderApiError` con los 37 códigos del servicio más 3 propios de transporte) y transporte exclusivamente por el proxy `/api` del dev-server (`render-api` no emite CORS); estado de servidor con `useAsyncResource` propio y sin librería de queries (D-3 mantenida con el polling de jobs como consumidor real, cero deps nuevas); sin `eslint.config.mjs` propio (D-9); verificado con smoke E2E real de punta a punta con Playwright (edición → `PUT` verificado en disco → render → progreso por frame → MP4 + `ffprobe`); **generación del montaje desde la biblioteca (spec-007 cycle-02): `Job` como unión discriminada por `kind` espejo del servicio, `createMontageJob` sobre `EP-012` con preset/seed/overwrite, `MontageTrigger` + `MontageJobPanel` con progreso por etapa y salto automático al preview, confirmación explícita ante `409 TIMELINE_ALREADY_EXISTS`, estado vacío accionable del preview ante `TIMELINE_NOT_FOUND`, y panel de salud con los cuatro binarios y `capabilities.montageQueue` que deshabilita el montaje con el motivo escrito; segundo E2E `montage-smoke.mjs` que va de `raw/` al MP4 por la web (montaje 4,7 s, render 11,7 s, `nb_frames` del stream de video == `durationFrames`)** | spec-007 cycle-02 \| 2026-09-09 |

---

## 4. Metodología SDD (Spec-Driven Development)

El proyecto se rige estrictamente por SDD. Ninguna funcionalidad se codifica sin antes completar el ciclo de diseño.

### 4.1 Ciclo de Agentes y Roles

1. **Orquestador:** Lee la especificación (`sdd/specs/`) y el estado (`sdd/global.json`), valida dependencias y prepara el `cycle_brief` con contexto mínimo para cada agente especializado.
2. **Funcional:** Toma el `cycle_brief` y genera historias de usuario (HU) y requisitos funcionales (RF) en lenguaje de negocio.
3. **Planner:** Descompone las historias en tareas técnicas ordenadas y estimadas (story points).
4. **Arquitecto:** (En paralelo con el Planner) Diseña la estructura técnica, define el esquema de datos y los contratos de la API.
5. **Implementador Backend:** Desarrolla la API y lógica de backend siguiendo los contratos y la tarea asignada.
6. **Implementador Frontend:** Desarrolla la UI y vistas del frontend.
7. **Reviewer:** Valida la calidad, tests, cumplimiento de requisitos y aprueba para cerrar el ciclo.

### 4.2 Reglas Estrictas del Proyecto

> ⛔ **SPEC GATE — REGLA GLOBAL INVIOLABLE**
> Antes de escribir UNA SOLA LÍNEA de código de implementación, el agente DEBE verificar:
>
> 1. Existe un archivo `.spec.md` en `sdd/specs/` para el módulo que se va a desarrollar
> 2. El módulo figura en `pending_modules` o `in_progress_modules` de `sdd/global.json`
> 3. Existe un `cycle_brief` generado por el Orquestador
> 4. Existen historias de usuario generadas por el Funcional
> 5. Existen tasks técnicas en `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` generadas por el Planner
> 6. Existen contratos de API y schema definidos por el Arquitecto
>
> Si alguna de estas condiciones NO se cumple → **DETENER** y completar los pasos faltantes antes de continuar.

1. **SPEC GATE:** Ninguna implementación puede iniciarse sin haber completado el flujo de diseño SDD completo para ese módulo.
2. **Memoria como Fuente de Estado:** El estado del proyecto reside en `sdd/global.json`, `sdd/schema.json`, `sdd/api.json`, `sdd/components.json` y los `tasks.json` per-cycle (índice generado en `sdd/tasks.json`). Todos validan contra `sdd/schemas/` (`pnpm sdd:validate`).
3. **Lectura Obligatoria:** Es obligatorio leer `sdd/global.json` antes de iniciar cualquier tarea.
4. **Prohibido el Cambio Manual:** Nunca edites manualmente los archivos de estado de `sdd/` (solo los agentes en su flujo SDD los actualizan al inicio o fin del ciclo).
5. **Comentarios:** sin comentarios explicativos del QUÉ ni referencias a task/spec/ciclo — ver
   "Estilo de código (INVIOLABLE)" en `sdd/agents/sdd-implementor-back.agent.md` /
   `sdd-implementor-front.agent.md`. Único comentario permitido: una línea en inglés para un POR QUÉ
   no obvio.
6. **Ejecución Nx:** Siempre prefiere utilizar `pnpm nx` (o el package manager configurado) para ejecutar tareas del monorepo.
7. **Orden de ciclos:** Los ciclos se ejecutan en el orden definido en `planned_cycles` de `sdd/global.json`. Un ciclo no puede comenzar si el ciclo anterior no está `completed`.
8. **Un ciclo a la vez:** Nunca iniciar un segundo ciclo si hay uno en `in_progress_modules`.
9. **Contextos siempre frescos, vía fragmentos aditivos:** durante un ciclo/fix NUNCA se editan directamente `constitution.md` ni `context_prompt.md` del subproyecto — el cierre escribe un fragmento append-only en `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md` (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`). El contexto vigente = archivos base + `updates/*.md` en orden de nombre. La consolidación (fusionar fragmentos en los archivos base, eliminar lo obsoleto y borrar los fragmentos) es operación de un solo actor: el Orquestador al iniciar un ciclo nuevo sobre ese subproyecto, o el Reviewer si se acumulan ≥5 fragmentos.
10. **Specs numeradas y registradas:** Toda spec DEBE tener un ID con formato `spec-[gh-user]-[NNN]-[slug]`, la carpeta y el archivo `.spec.md` DEBEN seguir esa convención, y DEBE estar registrada en `sdd/specs/index.json` antes de ser referenciada en cualquier otra parte del arnés.

### 4.2.1 Convención de naming de specs

```
Formato de carpeta:   sdd/specs/spec-[gh-user]-[NNN]-[slug]/
Formato de archivo:   spec-[gh-user]-[NNN]-[slug].spec.md
Ejemplo:              sdd/specs/spec-jdoe-001-user-onboarding/spec-jdoe-001-user-onboarding.spec.md

Encabezado obligatorio en el archivo:
  > spec-id: spec-[gh-user]-[NNN]-[slug]
  > slug: [slug]
  > módulo: [nombre del módulo en global.json]
  > estado: activo | completado | deprecado
  > fecha: YYYY-MM-DD

Registro centralizado: sdd/specs/index.json
  - specs[]: array con entrada por cada spec creada (append-only, sin last_id global)
  - Al crear una nueva spec: agregar entrada al array
```

> ⛔ No crear specs sin registrarlas primero en `sdd/specs/index.json`.
> La referencia canónica al archivo de spec en `global.json`, `tasks.json` y cualquier otro lugar
> DEBE usar la ruta completa: `sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md`.

### 4.3 Flujo Obligatorio Antes de Implementar

```
┌─────────────────────────────────────────────────┐
│              SPEC GATE (VERIFICACIÓN)           │
│  1. ¿Existe spec en sdd/specs/?  → SI / NO      │
│  2. ¿Está en global.json?        → SI / NO      │
│  3. ¿Hay {spec-id}/cycles/cycle-[XX]/brief.yaml?   → SI / NO  │
│  4. ¿Hay {spec-id}/cycles/cycle-[XX]/functional.md? → SI / NO  │
│  5. ¿Hay {spec-id}/cycles/cycle-[XX]/planner.md?   → SI / NO   │
│  6. ¿Hay {spec-id}/cycles/cycle-[XX]/architect.md? → SI / NO   │
│  7. ¿Existe contexto del subproyecto? → SI / NO  │
│                                                 │
│  TODO SI → Continuar a implementación           │
│  ALGÚN NO → Completar el paso faltante          │
└─────────────────────────────────────────────────┘
            ↓ (solo si TODO ES SI)
┌─────────────────────────────────────────────────┐
│         IMPLEMENTACIÓN (task por task)          │
│  sdd-implementor-back  →  una TASK-BE a la vez  │
│  sdd-implementor-front →  una TASK-FE a la vez  │
└─────────────────────────────────────────────────┘
            ↓ (al finalizar todas las tasks)
┌─────────────────────────────────────────────────┐
│  REVIEWER → cierra el ciclo                    │
│  Crea {spec-id}/cycles/cycle-[XX]/cycle.json    │
│  Actualiza global.json, schema.json, api.json   │
└─────────────────────────────────────────────────┘
```

### 4.4 Documentos obligatorios por ciclo

Cada ciclo de desarrollo DEBE tener los siguientes archivos en `sdd/specs/{spec-id}/cycles/cycle-[XX]/`:

| Archivo         | Generado por                                      | Momento                         |
| --------------- | ------------------------------------------------- | ------------------------------- |
| `brief.yaml`    | sdd-orchestrator                                  | Al iniciar el ciclo             |
| `functional.md` | sdd-functional                                    | Antes de planner/arquitecto     |
| `planner.md`    | sdd-planner                                       | En paralelo con arquitecto      |
| `architect.md`  | sdd-architect                                     | En paralelo con planner         |
| `tasks.json`    | sdd-planner                                       | En paralelo con arquitecto      |
| `cycle.json`    | sdd-orchestrator (inicio) / sdd-reviewer (cierre) | Al iniciar y al cerrar el ciclo |

### 4.5 Contexto de subproyectos

Cada app, lib y tool del monorepo tiene su propio contexto en `sdd/context/`.
Este contexto refleja la constitución y el context_prompt específicos para ese subproyecto,
y los agentes DEBEN leerlo antes de generar documentos o código para ese subproyecto.

```
sdd/context/
├── constitution.md          ← Contexto GLOBAL del monorepo (NO modificar directamente)
├── context_prompt.md        ← Entry point GLOBAL (NO modificar directamente)
├── apps/                    ← Un directorio por app generada en Nx
│   └── [nombre]/
│       ├── constitution.md
│       ├── context_prompt.md
│       └── updates/            (fragmentos aditivos pendientes de consolidar)
├── libs/                    ← Ídem por lib
└── tools/                   ← Ídem por tool
```

**Regla:** Todo agente que trabaje sobre un subproyecto DEBE leer primero:

1. `sdd/context/context_prompt.md` — para entender el monorepo global
2. `sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md` + `constitution.md` + `updates/*.md` (en orden de nombre) — para entender el subproyecto con su contexto vigente

**Regla de frescura — mecanismo aditivo (ver sección 🧩 de `sdd/dual-harness/CLAUDE.md`):**

- Al cerrar un ciclo/fix, el delta se escribe como fragmento en
  `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
  (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`) — nunca editando los archivos base
- Los archivos base y su encabezado `> Última actualización: cycle-[N] | Fase: [fase] | Fecha: [YYYY-MM-DD]`
  solo los toca la consolidación (operación de un solo actor: Orquestador al iniciar un
  ciclo nuevo sobre ese subproyecto, o Reviewer si se acumulan ≥5 fragmentos)
- La consolidación funde los fragmentos, elimina toda información obsoleta y borra los
  fragmentos consolidados
- El contexto incorrecto es peor que no tener contexto: menos y correcto > más e incorrecto
