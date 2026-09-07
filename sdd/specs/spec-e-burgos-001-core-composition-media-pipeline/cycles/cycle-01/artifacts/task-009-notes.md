# TASK-009 — notas de implementación

## `edl-reference.fixture.ts` no se crea

`tasks.json` listaba `libs/timeline-core/src/__fixtures__/edl-reference.fixture.ts` entre los
archivos previstos. `ca013Edl`/`ca013Format` (y `ca013Assets` en `assets.ts`) ya existen desde
TASK-003/TASK-002 en `src/__fixtures__/edl.ts` y `src/__fixtures__/assets.ts`, tal como los define
`architect.md` §6.2/§6.3 — son exactamente los fixtures que pide CA-013. No se duplica un segundo
fixture con el mismo contenido; los EDL adicionales para los casos borde de esta task (single-keep,
transición más larga que el keep, asset inexistente, ducking+música) son literales locales al
`describe`/`it` de `build-timeline.spec.ts`, porque no son parte de la estrategia de fixtures
compartidos de la sección 6 (no reaparecen en otro archivo de test). `files[]` de `tasks.json`
quedó con los archivos reales: `build-timeline.ts`, `build-timeline.spec.ts`, `index.ts`.

## `buildTimeline` no lanza para "transición más larga que el keep" ni para "asset inexistente"

El prompt de la task mencionaba estos dos casos como "error tipado", pero `architect.md` §4.6 es
explícito: *"`buildTimeline` no lanza salvo un único caso: EDL sin ninguna decisión `keep`
(`TimelineBuildError` con `code: 'EMPTY_AROLL'`)... Todo lo demás —asset inexistente incluido— se
construye igual y lo reporta `validateTimeline`"*, y §5.11 "Casos borde" repite lo mismo para la
transición más larga que el keep entrante ("`validateTimeline` lo reporta como `AROLL_OVERLAP` (no
se silencia en build)"). Se siguió el contrato del Arquitecto (fuente de verdad) en vez de la
descripción de la task: ambos casos se testean como "no lanza, construye la Timeline con los frames
exactos que predice el algoritmo, y sigue validando contra `TimelineSchema`" — el chequeo semántico
(`AROLL_OVERLAP`/`ASSET_NOT_FOUND`) es explícitamente TASK-010 (`validateTimeline`). Sin cambios de
contrato de `architect.md`; solo se deja constancia por si el Reviewer quiere confirmar el criterio.
