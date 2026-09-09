# Planner — Ciclo 3: Web Studio (`timeline-editing-and-render-jobs`)

> **Input:** `functional.md` (US-3-001..US-3-012, CA-201..CA-246) · `architect.md` (contrato de
> estado local ↔ PUT, contrato de polling, D-3, D-12, lista cerrada de 52 tests) · `brief.yaml`
> (incluye `orchestrator_approvals` APR-01..APR-03, ya decididas — no se reabren acá).
> **Output:** este documento + `cycles/cycle-03/tasks.json` (generado primero).
> **No implementa nada.**

---

## 0. Cómo leer este plan

Cada task es una unidad de ≤1 día que el **único implementador front** (`sdd-implementor-front`,
`sonnet`) ejecuta en el orden del array, reanudado task a task por el orquestador. El orden es
**topológico respecto de `depends_on`**, y `depends_on` sale de los imports reales de las firmas
del architect (§7/§5/§6 de `architect.md`), no del agrupamiento por historia de usuario — es la
lección explícita que el architect dejó en sus riesgos abiertos (§11.1): dos historias distintas se
acoplan por un símbolo compartido (`timeline-edit/*`, `render-api-types.ts` +
`parse-render-job.ts`, la fixture generada).

**Tres bloques de infraestructura compartida van antes que cualquier pantalla:**

1. Tipos y parsing de jobs + estado de servidor (TASK-001..005).
2. La fixture generada + los seis módulos puros de `timeline-edit/` (TASK-006..013).
3. Los diez componentes de edición y de jobs (TASK-014..022), que consumen (1) y (2).

Recién ahí entran las tasks que tocan `project-preview-page.tsx` (TASK-024..027), la evidencia real
(TASK-028, TASK-030) y el cierre (TASK-031).

---

## 1. Tasks

### TASK-001 — Add render job types, structural parsing and the deliverable URL helper

**Qué hace:** suma a `render-api-types.ts` (existente) los literales `RENDER_JOB_STATES`,
`TERMINAL_RENDER_JOB_STATES`, `RENDER_PIPELINE_STAGES` y los tipos `RenderJob`,
`RenderJobSummary`, `RenderJobListing`, `RenderJobProgress`, `RenderPipelineReport` (§6.1 del
architect — **par declarado** con `apps/render-api/src/jobs/render-job.ts`, nunca importado). Crea
`parse-render-job.ts` (narrowing estructural + `showsFrameProgress`, el emisor de CA-226) y
`render-job-artifact.ts` (`renderJobDeliverableUrl`, único lugar que conoce `out/<jobId>.mp4`).

**Por qué va primero:** es la infraestructura de tipos que **todo** lo demás de jobs importa
(cliente, hooks de polling, componentes de jobs). Sin `depends_on`: no importa nada nuevo del
ciclo, sólo tipos ya existentes de `render-api-error.ts`.

**Tests que cierra:** T-33/T-35 (`parse-render-job.spec.ts`, CA-226/CA-227), T-44
(`render-job-artifact.spec.ts`, CA-236).

---

### TASK-002 — Amend useAsyncResource to keep the previous value while refreshing (D-3)

**Qué hace:** ejecuta la mitad "cliente" de la decisión D-3 (§3.3): `AsyncResource<T>` gana
`isRefreshing: boolean`, conserva `data`/`error` del valor anterior durante un `reload()`, y
preserva los tres `status` existentes para los cuatro consumidores ya implementados
(`project-preview-page`, `asset-library-page`, `projects-page`, `service-health-badge`), que **no
se tocan**.

**Por qué acá:** es la pieza de D-3 que el listado de jobs (US-3-009, TASK-021) necesita para no
parpadear a vacío en cada refresh; no depende de nada del ciclo.

**Tests que cierra:** T-50 (`use-async-resource.spec.ts`, extendido).

---

### TASK-003 — Add useApiAction for imperative writes that never throw

**Qué hace:** crea `use-api-action.ts` (§5.7): `run()` nunca lanza, devuelve `null` en fallo y deja
el `RenderApiError` en `error`; `reset()` lo limpia. Es el mecanismo detrás de `PUT`
(`timeline-save-bar`, TASK-019) y de `POST /jobs` (`render-trigger`, TASK-020).

**Por qué acá:** hook puro sin dependencias del ciclo, consumido después por dos componentes
distintos — se resuelve una sola vez.

**Tests que cierra:** T-25 (`use-api-action.spec.ts`, CA-218/CA-219).

---

### TASK-004 — Add the render job poll plan and the useRenderJobPoll hook

**Qué hace:** `render-job-poll-plan.ts` (`nextPollPlan`, función pura de corte: terminal /
not-found / unreachable tras 3 fallos de transporte / sigue en `canceling`) y
`use-render-job-poll.ts` (`setTimeout` re-agendado, nunca `setInterval`, 1000 ms fijos — §6.3).

**`depends_on: [TASK-001]`** — el símbolo que causa la arista: `nextPollPlan` recibe un
`PollOutcome` tipado sobre `RenderJob`/`RenderApiError` y usa `isTerminalRenderJobState` de
`parse-render-job.ts`; sin esos tipos y ese type guard no compila.

**Tests que cierra:** T-32/T-38 (`use-render-job-poll.spec.ts`, CA-225/CA-228), T-37
(`render-job-poll-plan.spec.ts`, CA-228/CA-230).

---

### TASK-005 — Extend the render API client with timeline write and job endpoints

**Qué hace:** suma a `render-api-client.ts` `putTimeline`, `createRenderJob`, `listRenderJobs`,
`getRenderJob`, `cancelRenderJob` (§5.7/§6.2), incluido el `requestJsonWithStatus` nuevo al lado del
`requestJson` existente (para el status literal 200 vs 202 de la cancelación, CA-229/CA-230).

**`depends_on: [TASK-001]`** — el cliente devuelve `RenderJob`/`RenderJobListing` parseados con
`parseRenderJob`/`parseRenderJobListing` de `parse-render-job.ts`; sin ese módulo no hay tipo de
retorno.

**Tests que cierra:** T-22 (CA-216, `putTimeline`), T-29 (CA-222, `createRenderJob`), T-39
(CA-229/230/231/232, `cancelRenderJob`), T-41 (CA-233, `listRenderJobs`) — los cuatro en
`render-api-client.spec.ts`.

---

### TASK-006 — Generate the editable timeline fixture with buildTimeline

**Qué hace:** `__fixtures__/editable-timeline.ts`, **generada con `buildTimeline`** (nunca literal a
mano — lección vigente de T-51): al menos una transición (para que T-04/T-08 tengan algo que
descontar), `voice.length === aroll.length` (para T-05), `audioMix.automation.length >= 3` con al
menos dos valles (para que T-14/T-10 tengan cola que reescalar), un clip con `trimStartMs > 0` y
otro con `from > 0` (para que ninguna fórmula pase por casualidad con ceros), y
`validateTimeline(fixture).ok === true`.

**Por qué es la segunda pieza de infraestructura:** es el dato de entrada de **todos** los módulos
de `timeline-edit/*` y de los tres primeros componentes de edición. Por eso no depende de nada del
ciclo (usa `buildTimeline` de `@video-maker/timeline-core`, ya exportado) pero **todo lo demás en
`timeline-edit/` y los componentes de trim/caption depende de ella**.

**Tests que cierra:** T-51 (`editable-timeline.spec.ts`).

---

### TASK-007 — Add canonicalTimelineJson and timelineDocumentsEqual for byte-identity

**Qué hace:** `timeline-document.ts` (§5.1): `canonicalTimelineJson` pasa por
`TimelineSchema.parse` (Zod reconstruye el orden de la *shape*, no del literal de entrada) y
`timelineDocumentsEqual` compara esas dos salidas. Es el guardarraíl del flag `dirty` y el **par
declarado** con `write-timeline.spec.ts` del lado del productor.

**`depends_on: [TASK-006]`** — el spec prueba la identidad de bytes contra el draft de la fixture
generada.

**Tests que cierra:** T-23 (CA-216/CA-217/A-6).

---

### TASK-008 — Add client-side mirror rejection rules for trim, duration and caption text

**Qué hace:** `timeline-edit-rules.ts` (§5.4, capa 1): `rejectTrimStartMs`,
`rejectDurationFrames`, `rejectCaptionWordText` (espejo exacto de `MsSchema`/`FrameSchema`/
`z.string().min(1)`) y `rejectDurationAgainstTransitions` (regla derivada de
`TransitionSeries.Transition` de Remotion: `durationFrames >= entrante + saliente + 1`).

**`depends_on: [TASK-006]`** — `rejectDurationAgainstTransitions` necesita una `Timeline` con al
menos una transición real para probar el rechazo; la fixture es la única fuente.

**Tests que cierra:** T-02 (CA-202), T-11 (CA-207) — ambos en `timeline-edit-rules.spec.ts`.

---

### TASK-009 — Add a-roll relayout, voice mirroring and track clamping

**Qué hace:** `aroll-layout.ts` (§5.2): `transitionFramesBetween`, `relayoutArollTrack` (fórmula
real que descuenta las transiciones — **diverge de CA-203 tal como está escrito**, divergencia ya
declarada por el architect en H-5, no se re-discute), `mirrorVoiceFromAroll` (A-3/H-4: si
`voice.length !== aroll.length` emite `VOICE_TRACK_NOT_MIRRORED` en vez de espejar a ciegas) y
`clampTracksToDuration` (A-4: evita que acortar el último a-roll deje `music`/`broll` fuera de
rango).

**`depends_on: [TASK-006]`** — sin una fixture con transición y con `voice`/`aroll` del mismo largo,
no hay nada que relayoutear ni que espejar.

**Tests que cierra:** T-04, T-05, T-06 (los tres en `aroll-layout.spec.ts`, CA-203/A-3/A-4).

---

### TASK-010 — Add music automation rescaling against the real ducking producer

**Qué hace:** `rescale-music-automation.ts` (§5.5): `rescaleMusicAutomation` reescala (no
re-planifica) los keyframes de `audioMix.automation` cuando cambian `baseGainDb`/`duckedGainDb`,
preservando `frame`. El test la valida contra el **productor real**: `rescaleMusicAutomation` sobre
el resultado de `planDucking(ranges, {A,B})` tiene que dar exactamente `planDucking(ranges,
{A',B'})` — con rangos de voz propios de al menos dos valles, para ejercitar los keyframes de cola
que la letra literal de CA-210 dejaría mal.

**Sin `depends_on`:** construye su propio fixture de rangos de voz vía `planDucking` (no necesita
la `Timeline` completa de TASK-006); es lógica pura desacoplada del resto de `timeline-edit/`.

**Tests que cierra:** T-14 (`rescale-music-automation.spec.ts`, CA-210).

---

### TASK-011 — Add applyOutputPreset with safe caption box omission

**Qué hace:** `apply-output-preset.ts` (§5.3): cambia `format`+`safeZone` juntos (mismo invariante
que `previewFormat` de `cycle-02`) y **omite la clave `box`** de todos los captions — hallazgo A-5:
el render ya ignora ese `box` (`captionClipPlan` con `boxSource: 'preset'` por defecto), pero
`collectCaptionSafeZoneIssues` sí lo valida, y dejarlo dispara `CAPTION_OUT_OF_SAFE_ZONE` al pasar
a `youtube-16x9`.

**`depends_on: [TASK-006]`** — el spec necesita captions con un `box` de 9:16 real (el de la
fixture) para probar que, sin la omisión, `youtube-16x9` rompería `validateTimeline`, y que con ella
pasa.

**Tests que cierra:** T-18 (`apply-output-preset.spec.ts`, CA-213/A-5).

---

### TASK-012 — Classify validateTimeline issue codes by save/render-blocking severity

**Qué hace:** `issue-severity.ts` (§5.4, capa 2): `issueSeverity` mapea los diez
`TimelineIssueCode` — `SCHEMA_INVALID` → `save-blocking`, los otros nueve → `render-blocking`. Es
la ejecución directa de **APR-01** (aprobación del orquestador ya tomada): el disparo de render se
deshabilita con cualquier issue `render-blocking`, porque `render.ts:142` corre `validateTimeline`
y el servidor no.

**Sin `depends_on`:** sólo importa el tipo `TimelineIssueCode` del barrel de `timeline-core`
(import de tipo, gratis); no necesita la fixture ni ningún otro módulo del ciclo.

**Tests que cierra:** T-08 (`issue-severity.spec.ts`, CA-205).

---

### TASK-013 — Add the timeline edit reducer wiring documents, rules and severity

**Qué hace:** `timeline-edit-state.ts` (§5.6): el reducer central — `initialTimelineEditState`,
`timelineEditReducer`, `canSaveTimeline`, `canStartRender`. Aplica las ocho acciones (`clip-trim-
start`, `clip-duration`, `aroll-move`, `caption-word-text`, `music-levels`, `output-preset`,
`saved`, `reset`), corre `relayoutArollTrack` cuando corresponde, recalcula `dirty` con
`timelineDocumentsEqual` e `issues` con `validateTimeline`. **Nunca lanza** y una acción rechazada
por la capa 1 deja el `draft` sin cambios.

**`depends_on: [TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012]`** — es el
punto de convergencia de imports de todo `timeline-edit/`: usa `timelineDocumentsEqual`
(TASK-007), los cuatro `reject*` (TASK-008), `relayoutArollTrack`/`mirrorVoiceFromAroll`/
`clampTracksToDuration` (TASK-009), `rescaleMusicAutomation` (TASK-010), `applyOutputPreset`
(TASK-011), `issueSeverity` (TASK-012) y la fixture (TASK-006) para el estado inicial del spec. Es
la task más grande del ciclo por convergencia, no por lógica propia nueva.

**Tests que cierra:** T-03 (CA-202), T-15 (CA-210), T-24 (CA-218) — los tres en
`timeline-edit-state.spec.ts`.

---

### TASK-014 — Add the clip track editor for trim and reorder controls

**Qué hace:** `clip-track-editor.tsx`: por clip, exactamente dos campos (`trimStartMs`,
`durationFrames`); los botones de reordenar sólo aparecen con `track === 'aroll'` (b-roll no tiene
orden observable, H-7 — descopado con fundamento, no se agrega ahí).

**`depends_on: [TASK-006]`** — el spec renderiza clips reales de la fixture para verificar la
ausencia de controles de `assetId`/`transform`/`fit`/`muted`.

**Tests que cierra:** T-01 (`clip-track-editor.spec.tsx`, CA-201).

---

### TASK-015 — Add the caption editor for per-word text correction

**Qué hace:** `caption-editor.tsx`: un campo de texto por palabra existente; sin controles de
`fromFrame`/`durationFrames`/`emphasisIndex`/`box`, sin agregar ni quitar palabras.

**`depends_on: [TASK-006]`** — mismo motivo que TASK-014: necesita captions reales de la fixture.

**Tests que cierra:** T-10 (`caption-editor.spec.tsx`, CA-206).

---

### TASK-016 — Add the music mix editor for base and ducked gain controls

**Qué hace:** `music-mix-editor.tsx`: exactamente dos campos (`baseGainDb`, `duckedGainDb`); cero
controles para `attackMs`/`releaseMs`/`holdMs`/`audioMix.voice.*`.

**Sin `depends_on`:** componente presentacional puro sobre dos números; no necesita la fixture
completa ni ningún módulo de `timeline-edit/`.

**Tests que cierra:** T-13 (`music-mix-editor.spec.tsx`, CA-209).

---

### TASK-017 — Add the output preset selector for the persisted format

**Qué hace:** `output-preset-selector.tsx`: los cuatro literales de `OutputPresetSchema`, sin
campos libres de `width`/`height`/`fps`. Incluye la **verificación de regresión** de T-20: que
`PREVIEW_PRESETS`/`previewFormat` de `cycle-02` siguen intactos — es el selector nuevo que convive
en la misma pantalla con el de sólo-preview, y es el punto natural para confirmar que no lo rompió.

**Sin `depends_on`:** sólo necesita la enumeración cerrada de presets (tipo), no el estado del
reducer ni la fixture.

**Tests que cierra:** T-17 (`output-preset-selector.spec.tsx`, CA-212), T-20
(`preview-format.spec.ts`, regresión de CA-215).

---

### TASK-018 — Add the timeline issue list for render-blocking and save-blocking warnings

**Qué hace:** `timeline-issue-list.tsx`: pinta un issue `render-blocking` (p. ej.
`CLIP_EXCEEDS_ASSET`) como advertencia distinguible de `ErrorNotice`, con `code`/`path`/`message`,
sin deshabilitar el guardado.

**`depends_on: [TASK-012]`** — necesita `issueSeverity` para decidir el estilo/rol de cada fila.

**Tests que cierra:** T-09 (`timeline-issue-list.spec.tsx`, CA-205).

---

### TASK-019 — Add the timeline save bar wired to PUT and dirty state

**Qué hace:** `timeline-save-bar.tsx`: expone `data-timeline-dirty` en el DOM y dispara el `PUT`
real con `useApiAction`.

**`depends_on: [TASK-003, TASK-005, TASK-013]`** — usa `useApiAction` (TASK-003) para llamar
`putTimeline` (TASK-005) y lee `canSaveTimeline`/`dirty` del reducer (TASK-013).

**Tests que cierra:** T-27 (`timeline-save-bar.spec.tsx`, CA-220).

---

### TASK-020 — Add the render trigger gated by dirty state and blocking issues

**Qué hace:** `render-trigger.tsx`: deshabilitado con `dirty === true` o con issues
`render-blocking` (nombrando sus `code`, restricción APR-01); ante el `202` de `createRenderJob`
muestra el `id` sin recargar; mapea `404`/`422` de EP-012 a su `code`.

**`depends_on: [TASK-003, TASK-005, TASK-012, TASK-013]`** — `useApiAction`+`createRenderJob` para
el disparo, `issueSeverity`/`canStartRender` para el gate.

**Tests que cierra:** T-28 (CA-221), T-30 (CA-222), T-31 (CA-223/CA-224) — los tres en
`render-trigger.spec.tsx`.

---

### TASK-021 — Add the render job list backed by the jobs listing endpoint

**Qué hace:** `render-job-list.tsx`: lista `RenderJobSummary` (siete campos, nunca `report`/
`error`), lista vacía sin `ErrorNotice`, cada fila enlaza al detalle por `id`.

**`depends_on: [TASK-002, TASK-005]`** — `useAsyncResource` amendado (para no parpadear en cada
refresh) sobre `listRenderJobs`.

**Tests que cierra:** T-42 (CA-233/CA-235), T-43 (CA-234) — ambos en `render-job-list.spec.tsx`.

---

### TASK-022 — Add the render job panel with progress, failure, cancel and download

**Qué hace:** `render-job-panel.tsx`: muestra `renderedFrames`/`totalFrames`/`percent` **sólo**
cuando `showsFrameProgress` es verdadero; pinta `failed` con el `error` embebido (nunca como fallo
de red); refleja `canceled`/`canceling`/`409` sin alterar el estado mostrado; el enlace de descarga
usa `renderJobDeliverableUrl` y sólo existe con `state === 'succeeded'`.

**`depends_on: [TASK-001, TASK-004, TASK-005]`** — `showsFrameProgress`/`renderJobDeliverableUrl`
(TASK-001), `useRenderJobPoll` (TASK-004), `cancelRenderJob` (TASK-005). Es el componente con más
tests del ciclo (cinco) porque concentra CA-226, CA-227, CA-229/230/231/232 y CA-236/237.

**Tests que cierra:** T-34 (CA-226), T-36 (CA-227), T-40 (CA-229/230/231/232), T-45 (CA-236), T-46
(CA-237) — los cinco en `render-job-panel.spec.tsx`.

---

### TASK-023 — Align the Player object-fit with the render output (D-12) and cover the music automation emitter

**Qué hace:** ejecuta **D-12** en el único archivo de la lib que se toca:
`libs/composition-remotion/src/components/timeline-video.tsx` gana una constante
`PLAYER_MEDIA_STYLE = { objectFit: 'fill' }` aplicada **por debajo** del `style` del llamador
(`{ ...PLAYER_MEDIA_STYLE, ...style }`) sólo en la rama `player`; la rama `render` queda carácter
por carácter igual. Extiende `timeline-video.spec.tsx` para asentar el literal `'fill'`, que el
`style` del llamador gana (caso b-roll `cover`/`contain`) y que la rama `render` no cambia. Suma
`audio-track.spec.tsx` (NUEVO — el archivo `audio-track.tsx` ya existe y ya hace lo correcto, sólo
le faltaba spec) que asevera que `AudioTrack` pasa `volumeAtFrame(automation, …)` a `<Audio>`, no
`gainDbToVolume(music.baseGainDb)` — es el emisor real que CA-211 mide en el navegador. Agrega
`src/components/audio-track.tsx` a `coverage.include` de `vite.config.ts` (hoy sólo lista
`helpers/**`, `transitions/**`, `render.ts`, `timeline-video.tsx`, `video-backend.tsx` — riesgo #4
del architect: sin esto el archivo queda fuera del piso de cobertura sin que nada lo señale).

**Por qué es una task aislada y temprana:** es el **único** trabajo del ciclo en
`libs/composition-remotion`, no importa nada de `apps/web` y nada de `apps/web` lo importa de vuelta
(la task de captura de frame sólo depende de que este cambio exista para que la evidencia visual
tenga sentido, no de un import compartido). Separarla del resto evita mezclar el árbol `render`
—que **no cambia**— con el trabajo de `apps/web`.

**Sin `depends_on`.**

**Tests que cierra:** T-47 (`timeline-video.spec.tsx`, CA-238/D-12), T-16 (`audio-track.spec.tsx`,
CA-211).

---

### TASK-024 — Make TimelinePlayer capture-ready with initialFrame and controls

**Qué hace:** `timeline-player.tsx` gana `initialFrame?`/`controls?` (default `true`, preserva el
comportamiento actual); `project-preview-page.tsx` lee `?frame=<n>` con `useSearchParams` y, cuando
está presente, pasa `initialFrame={n}` y `controls={false}` (si no, la barra de transporte
contamina G-A). El `<Player>` arranca **pausado**: `/projects/smoke-ingest/preview?frame=240` da un
frame reproducible sin `play()` ni cronómetros.

**`depends_on: [TASK-023]`** — no hay import directo entre `timeline-player.tsx` y
`timeline-video.tsx` (la cadena real es `TimelineComposition` → `TimelineVideo`, que no cambia de
firma), pero esta task sólo tiene sentido de producto **después** de que D-12 exista: es la
afordancia que permite *medir* D-12 en TASK-028, así que se secuencia después por orden de
evidencia, no por import.

**Tests que cierra:** T-48 (`timeline-player.spec.tsx`, extendido, CA-238).

---

### TASK-025 — Wire scene trim/reorder and caption editing into the studio page

**Qué hace:** primera mitad de "`project-preview-page.tsx` crece a pantalla de estudio" (§2, la
ruta y el nombre de archivo no cambian): monta el reducer de TASK-013, `clip-track-editor.tsx` y
`caption-editor.tsx`, y verifica que el `<Player>` recibe el `draft` (no el `saved`) apenas se
aplica un trim o una corrección de texto, **antes de cualquier `PUT`**.

**`depends_on: [TASK-013, TASK-014, TASK-015, TASK-024]`** — importa el reducer y los dos
componentes de edición; depende de TASK-024 porque continúa el mismo archivo
(`project-preview-page.tsx`) que esa task ya tocó (lectura de `?frame=`).

**Tests que cierra:** T-07 (CA-204), T-12 (CA-208) — ambos en `project-preview-page.spec.tsx`.

---

### TASK-026 — Wire music levels, output preset and the save bar into the studio page

**Qué hace:** segunda mitad de la pantalla de estudio: monta `music-mix-editor.tsx`,
`output-preset-selector.tsx`, `timeline-issue-list.tsx` y `timeline-save-bar.tsx`; verifica que el
lienzo se recompone al cambiar el preset, que los dos selectores de formato (preview-only vs
persistido) conviven con copy distinguible, y que un fallo de guardado **no** pierde la edición
local (el reducer no tiene acción de error — CA-219 es una propiedad estructural, no un caso
especial de la página).

**`depends_on: [TASK-025, TASK-016, TASK-017, TASK-018, TASK-019]`** — continúa el archivo de
TASK-025 y suma los cuatro componentes restantes de la mitad de edición.

**Tests que cierra:** T-19 (CA-214), T-21 (CA-215), T-26 (CA-219) — los tres en
`project-preview-page.spec.tsx`.

---

### TASK-027 — Wire render trigger, job list and job panel into the studio page

**Qué hace:** cierra la pantalla de estudio con el eje de jobs: `render-trigger.tsx`,
`render-job-list.tsx` y `render-job-panel.tsx` montados y coordinados (seleccionar un job del
listado alimenta el panel de seguimiento; un `202` de disparo también lo hace).

**`depends_on: [TASK-026, TASK-020, TASK-021, TASK-022]`** — continúa el archivo de TASK-026 y suma
los tres componentes de jobs, que ya traen resueltos sus propios contratos de cliente y polling.

**Tests que cierra:** ninguno nuevo de la lista cerrada (los CA de jobs ya cierran a nivel de
componente en TASK-020/021/022); esta task es integración de UI pura y la valida el propio
`project-preview-page.spec.tsx` existente más los tests de componente ya verdes.

---

### TASK-028 — Measure frame parity at 8s and reproduce the render non-regression sha256

**Qué hace:** ejecuta el criterio numérico de CA-238 (§4.4): captura el `<Player>` en el frame 240
vía `/projects/smoke-ingest/preview?frame=240` (TASK-024), la reescala a 1080×1920 y corre
`psnr`/`mse_avg` contra `render-frame-reference-8s.png` de `cycle-02`. Registra los tres números
(antes, después, sensibilidad G-C — quitando `PLAYER_MEDIA_STYLE` a propósito, que **tiene** que
fallar G-A/G-B) y evalúa G-A/G-B. En paralelo (nunca simultáneo, gate de memoria entre medio)
reproduce el render de no-regresión de CA-239 sobre `media/smoke-ingest` **sin editar** y confirma
`sha256(video-muted.mp4) == c1b9fd9f…`.

**`depends_on: [TASK-023, TASK-024]`** — necesita D-12 ya aplicado (TASK-023) y la afordancia de
captura determinista (TASK-024). Es evidencia real, no código: no aporta símbolos que otra task
importe.

**Tests que cierra:** T-49 (`frame-parity-8s.md` + `render-non-regression.md`, CA-238/CA-239/
CA-240).

---

### TASK-029 — Author and run the E2E smoke through timeline save verified on disk

**Qué hace:** primera mitad de `studio-smoke.mjs` (§7, pasos 1-6): gate de memoria, copia temporal
de `media/smoke-ingest` a un `RENDER_API_MEDIA_ROOT` temporal (nunca `media/` del dev — CA-241),
`render-api`+`vite` reales, crear/abrir proyecto → biblioteca → preview, editar **un campo de cada
una de las cuatro historias de edición** (CA-242) con las ediciones que preservan la validez
documentadas en §7 (acortar a-roll a ~90-150 frames, corregir un typo de transcripción, cambiar
niveles de música, pasar a `tiktok-9x16` para no arriesgar el render del paso 8), guardar y
**verificar leyendo `work/timeline.json`** del media root temporal (CA-217/CA-243) — nunca la
respuesta HTTP.

**`depends_on: [TASK-027]`** — necesita la pantalla de estudio completa (edición + guardado) ya
integrada para tener algo real que ejercitar.

**Tests que cierra:** contribuye a T-52, cerrado completo recién en TASK-030 (ver esa task).

---

### TASK-030 — Extend the E2E smoke through render, progress, download and ffprobe verification

**Qué hace:** continúa el mismo `studio-smoke.mjs` (§7, pasos 7-10): confirma que el disparo estaba
deshabilitado **antes** de guardar y habilitado después (CA-221 de punta a punta), dispara el
render (EP-012), observa **al menos una lectura real** de `renderedFrames`/`totalFrames` con
`progress.stage === 'render'` (CA-244) hasta `succeeded`, descarga por EP-011 y verifica con
`ffprobe` **contra el stream de video** (`nb_frames`/`r_frame_rate`, nunca `format.duration` —
CA-245). Deja capturas, guion literal y salidas de `ffprobe` completas en
`cycles/cycle-03/artifacts/studio-smoke.md` (CA-246). **El `sha256` de este render es distinto del
de no-regresión de TASK-028 y eso no es una regresión** (APR-03): el documento está editado y
acortado a propósito.

**`depends_on: [TASK-029, TASK-028]`** — continúa el script de TASK-029; la dependencia de TASK-028
es de **gate de memoria**, no de import: los dos son renders reales del ciclo y nunca corren en
paralelo, así que se secuencian una vez que la evidencia de no-regresión ya está registrada.

**Tests que cierra:** T-52 completo (`studio-smoke.mjs` + `studio-smoke.md`, CA-241..CA-246).

---

### TASK-031 — Register new components in components.json and update app READMEs

**Qué hace:** el cierre verificable del ciclo. Alta de `COMP-014`..`COMP-025` en
`sdd/components.json` → `apps/web` para los diez componentes nuevos y los dos hooks nuevos, con su
`consumes` exacto (`RenderTrigger` → EP-012, `RenderJobList` → EP-013, `RenderJobPanel` → EP-014/
EP-015/EP-011, `TimelineSaveBar` → EP-008); actualización de `COMP-012 TimelinePlayer` y `COMP-013
ProjectPreviewPage` (`updated_in_cycle: 3`, `status: "updated"`, `changelog`, `consumes` sumando
EP-008/EP-012/EP-013/EP-014/EP-015); actualización de `COMP-009 TimelineVideo` en
`libs/composition-remotion` con el changelog de D-12. Actualiza `apps/web/README.md` (edición de
timeline + jobs de render) y `libs/composition-remotion/README.md` si el changelog de D-12 lo
amerita (mismo patrón de cierre que `cycle-02/TASK-005`).

> **Nota de desviación deliberada respecto de `architect.md` §8:** el architect describe la
> actualización de `sdd/components.json` como incremental, "el implementador, al cerrar cada task".
> Esta unidad de trabajo la consolida en una sola task de cierre por instrucción explícita del
> orquestador — evita altas parciales de `COMP-014..025` mezcladas con tasks de código que
> `pnpm sdd:validate` tendría que tolerar a medio llenar.

**`depends_on: [TASK-030]`** — necesita que todo el árbol de componentes y el smoke E2E existan
para describir su `consumes` real.

**El CONTEXTO GATE (fragmentos `updates/`) y la MEMORIA GATE los ejecuta el reviewer al cerrar el
ciclo — no son parte de esta task ni de ninguna otra de este plan.**

---

## 2. Trazabilidad US → CA → TASK

| Historia | CA | Task(s) |
| --- | --- | --- |
| US-3-001 | CA-201..205 | TASK-006, TASK-008, TASK-009, TASK-012, TASK-013, TASK-014, TASK-018, TASK-025, TASK-029 |
| US-3-002 | CA-206..208 | TASK-006, TASK-008, TASK-013, TASK-015, TASK-025, TASK-029 |
| US-3-003 | CA-209..211 | TASK-006, TASK-010, TASK-013, TASK-016, TASK-023, TASK-026, TASK-029 |
| US-3-004 | CA-212..215 | TASK-006, TASK-011, TASK-013, TASK-017, TASK-026, TASK-029 |
| US-3-005 | CA-216..220 | TASK-003, TASK-005, TASK-007, TASK-013, TASK-019, TASK-026 |
| US-3-006 | CA-221..224 | TASK-003, TASK-005, TASK-012, TASK-013, TASK-020, TASK-027 |
| US-3-007 | CA-225..228 | TASK-001, TASK-004, TASK-005, TASK-022, TASK-027 |
| US-3-008 | CA-229..232 | TASK-005, TASK-022, TASK-027 |
| US-3-009 | CA-233..235 | TASK-002, TASK-005, TASK-021, TASK-027 |
| US-3-010 | CA-236..237 | TASK-001, TASK-005, TASK-022, TASK-027 |
| US-3-011 | CA-238..240 | TASK-023, TASK-024, TASK-028 |
| US-3-012 | CA-241..246 | TASK-029, TASK-030 |

---

## 3. Verificación de los 52 tests obligatorios (§9 de `architect.md`)

Los 52 (T-01..T-52) están cubiertos; ninguno quedó sin task. Detalle exacto en la sección 1 de
este documento, task por task ("Tests que cierra"). Resumen por archivo compartido (varios T- caen
en el mismo archivo de spec, cerrados por la misma task):

- `timeline-edit-rules.spec.ts` → T-02, T-11 (TASK-008)
- `timeline-edit-state.spec.ts` → T-03, T-15, T-24 (TASK-013)
- `aroll-layout.spec.ts` → T-04, T-05, T-06 (TASK-009)
- `parse-render-job.spec.ts` → T-33, T-35 (TASK-001)
- `use-render-job-poll.spec.ts` → T-32, T-38 (TASK-004)
- `render-api-client.spec.ts` → T-22, T-29, T-39, T-41 (TASK-005)
- `render-job-panel.spec.tsx` → T-34, T-36, T-40, T-45, T-46 (TASK-022)
- `render-job-list.spec.tsx` → T-42, T-43 (TASK-021)
- `render-trigger.spec.tsx` → T-28, T-30, T-31 (TASK-020)
- `project-preview-page.spec.tsx` → T-07, T-12 (TASK-025); T-19, T-21, T-26 (TASK-026)
- `studio-smoke.mjs` + `studio-smoke.md` → T-52 (TASK-029 lo arranca, TASK-030 lo cierra)

El resto (T-01, T-08 a T-10, T-13, T-14, T-16 a T-18, T-20, T-23, T-27, T-37, T-44, T-47 a T-51)
tienen un archivo propio con una sola task dueña, ya listada en la sección 1.

**No quedó ningún test de la lista cerrada sin ubicar.**

---

## 4. Riesgos (heredados de `architect.md` §11, con dueño de task)

- **`initialFrame` con el Player pausado puede no pintar el frame exacto** (TASK-028): si falla, la
  salida documentada es reproducir hasta pasar `t = 8 s`, pausar, leer `currentTime` real y
  comparar contra el frame del render correspondiente a ese instante (extraído con `ffmpeg -ss`);
  se anota en `frame-parity-8s.md`, el criterio numérico no cambia.
- **Dos renders reales, nunca simultáneos** (TASK-028 y TASK-030): el de no-regresión
  (`media/smoke-ingest` sin editar, `sha256 c1b9fd9f…`) y el del smoke E2E (documento editado y
  acortado, otro `sha256` por diseño — APR-03). Gate de memoria (`pgrep -fl
  'ffmpeg|whisper-cli|chrome-headless'` vacío, ≥35 % libre, `npx remotion browser ensure`) antes de
  cada uno; por eso TASK-030 depende de TASK-028 aunque no compartan un import.
- **`timeline-edit/**` no puede quedar alcanzable desde el chunk inicial** (§2.1): verificar con la
  salida de `vite build` en cada task que toque `apps/web/src/api/timeline-edit/` o
  `project-preview-page.tsx` (TASK-007..013, TASK-025..027) — el chunk inicial no debe superar los
  ~450 kB de `cycle-02` ni disparar el aviso de "chunks larger than 500 kB". Ningún módulo de
  `timeline-edit/` puede importarse desde `app.tsx`, `studio-layout.tsx`, `projects-page.tsx` ni
  `asset-library-page.tsx`.
- **Cobertura medida después de cada task, no al cerrar** (TASK-023 en particular agrega
  `audio-track.tsx` a `coverage.include` de `libs/composition-remotion/vite.config.ts`, que hoy no
  lo lista): un piso que no incluye los archivos del ciclo no es evidencia de nada.
- **`vi.mock('remotion')` hoisteado** (TASK-023, spec de `audio-track.tsx`): el factory tiene que
  ser `async () => { const { createElement } = await import('react'); … }`, no puede cerrar sobre
  imports del módulo — mismo patrón que `cycle-02`.
- **Fixtures con al menos un valor no-cero por eje posicional** (TASK-006): `f(0)` da 100 % de
  cobertura sin distinguir la fórmula correcta de casi ninguna incorrecta — la fixture generada
  tiene que traer `from > 0`, `trimStartMs > 0` y un `toIndex` de reordenamiento real.
- **El `<Player>` no aplica `loudnorm`** (ninguna task lo "arregla"): los niveles de música que se
  escuchan en preview no van a coincidir en volumen absoluto con el master del MP4; ya está escrito
  en pantalla y en el README de la lib desde `cycle-02`.

---

## 5. Story points y estimación del ciclo

| Task | SP | Horas |
| --- | ---: | ---: |
| TASK-001 | 3 | 3 |
| TASK-002 | 2 | 2 |
| TASK-003 | 2 | 2 |
| TASK-004 | 3 | 3 |
| TASK-005 | 5 | 4 |
| TASK-006 | 3 | 3 |
| TASK-007 | 2 | 2 |
| TASK-008 | 3 | 3 |
| TASK-009 | 5 | 4 |
| TASK-010 | 3 | 3 |
| TASK-011 | 2 | 2 |
| TASK-012 | 1 | 1 |
| TASK-013 | 5 | 4 |
| TASK-014 | 2 | 2 |
| TASK-015 | 2 | 2 |
| TASK-016 | 1 | 1 |
| TASK-017 | 2 | 2 |
| TASK-018 | 2 | 2 |
| TASK-019 | 2 | 2 |
| TASK-020 | 3 | 3 |
| TASK-021 | 2 | 2 |
| TASK-022 | 5 | 4 |
| TASK-023 | 3 | 3 |
| TASK-024 | 2 | 2 |
| TASK-025 | 3 | 3 |
| TASK-026 | 5 | 4 |
| TASK-027 | 5 | 4 |
| TASK-028 | 3 | 3 |
| TASK-029 | 5 | 4 |
| TASK-030 | 5 | 4 |
| TASK-031 | 2 | 2 |
| **Total** | **93** | **85** |

**Duración estimada:** ≈85 h con un solo implementador secuencial → **≈11 días hábiles (~2,5
semanas)**, sin contar el tiempo de espera de los dos renders reales (TASK-028, TASK-030) ni el del
gate de memoria entre ellos. Es ~5,8× los 16 SP de `cycle-02`, proporcional a que este ciclo cubre
12 historias de usuario y 52 tests contra las 6 de `cycle-02`.
