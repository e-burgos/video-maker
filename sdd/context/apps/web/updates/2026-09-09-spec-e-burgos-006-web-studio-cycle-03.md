# spec-e-burgos-006-web-studio cycle-03 — 2026-09-09

## Estado

- `resuelve: context_prompt.md § Estado ("Alcance todavía no cubierto: edición del timeline y jobs
  de render")` y el `## Qué sigue` del fragmento de `cycle-02`. **La app cierra el producto
  completo**: `/projects/:slug/preview` edita la `Timeline` persistida sobre un draft local
  (trim/orden de escenas, texto de captions, niveles de música, preset de salida), la reproduce en
  el `<Player>` **antes** de guardar, la persiste con un único `PUT` de `EP-008` con el documento
  completo, dispara renders (`EP-012`), sigue su progreso y los cancela (`EP-013`..`EP-015`) y
  descarga el MP4 por `EP-011`. Con esto la spec `spec-e-burgos-006-web-studio` y el backlog del
  producto quedan cerrados.
- **Alcance de la edición, cerrado a propósito:** sólo `trimStartMs`/`durationFrames` y el orden de
  clips dentro de la pista, `text` de cada palabra de caption, `audioMix.music.baseGainDb`/
  `duckedGainDb`, y el preset de `format` (+`safeZone`). `assetId`, `transform`, `fit`, `muted`,
  el timing/`emphasisIndex`/`box` de captions, la envolvente de ducking y `audioMix.voice.*` **no
  tienen control de edición**. La **edición del EDL (`EP-009`/`EP-010`) está descopada por
  completo**: `buildTimeline` sólo se invoca desde `libs/auto-montage`, así que guardar un EDL
  editado escribiría `work/edl.json` sin efecto observable ni en el Player ni en un render.
- Suite: **42 archivos / 306 tests**, cobertura **99,09 % stmts · 96,07 % branch · 98,72 % funcs ·
  99,37 % lines**, piso 80 %, `coverage.include` `src/**/*.{ts,tsx}` sin recortar (no se tocó para
  sostener el piso).
- **D-3 se MANTIENE con el polling de jobs como consumidor real**: sin librería de queries ni store
  global, y **cero dependencias npm nuevas en todo el ciclo** — la única de la app sigue siendo
  `@remotion/player@4.0.522`. El polling se resolvió con `useRenderJobPoll` propio (`setTimeout`
  re-armado después de cada respuesta, nunca `setInterval`).
- **Hallazgo abierto (`FIND-01`, medido, no razonado):** `planDucking` de `libs/timeline-core`
  pierde silenciosamente el keyframe fraccionario de cola de release cuando dos valles están
  cerca — el frame de la cola truncada coincide con el attack-start del valle siguiente y
  `dedupeKeyframesByFrame` conserva el último `.set()`. Afecta al render y al preview por igual
  (los dos leen `automation`). Candidato a `[FIX]` contra `timeline-core`.

## Estructura

```
src/
  api/          + render-api-types (RenderJob, RenderJobSummary, los seis estados, las cinco etapas),
                + parse-render-job (showsFrameProgress: sólo stage === 'render'),
                + render-job-poll-plan (nextPollPlan: terminal / not-found / unreachable / seguir),
                + render-job-artifact (renderJobDeliverableUrl → EP-011),
                + __fixtures__/editable-timeline (generada con buildTimeline, no escrita a mano)
                + timeline-edit/  ← toda la máquina de edición (ver abajo)
  components/   + clip-track-editor, caption-editor, music-mix-editor, output-preset-selector,
                + timeline-issue-list, timeline-save-bar, render-trigger, render-job-list,
                + render-job-panel
  hooks/        + use-api-action, use-render-job-poll
  pages/        ~ project-preview-page (edición + jobs; sigue siendo la única ruta code-split)
```

- **`src/api/timeline-edit/**` es la infraestructura de todo lo demás** y va antes que cualquier
  componente: `timeline-edit-rules` (espejos exactos de `MsSchema`/`FrameSchema`/
  `z.string().min(1)`), `aroll-layout` (`relayoutArollTrack`, `mirrorVoiceFromAroll`,
  `clampTracksToDuration`), `rescale-music-automation`, `apply-output-preset`, `issue-severity`,
  `timeline-document` y `timeline-edit-state` (el reducer).
- **`timeline-edit/**` y Zod entran SÓLO por el chunk perezoso.** Es la misma restricción que
  `cycle-02` impuso a `parse-timeline`: `@nx/enforce-module-boundaries` prohíbe mezclar import
  estático y `await import()` de la misma lib, así que la salida no es un import dinámico sino
  mantener a los consumidores dentro de la ruta `React.lazy`. **Se verifica con la salida de `vite
  build`**, que hoy da chunk inicial **249 kB** y chunk de `project-preview-page` **452 kB**, sin el
  aviso de "chunks larger than 500 kB". Si `timeline-edit/**` o Zod se importan desde el shell, el
  chunk inicial salta y el aviso reaparece: es el detector, no una métrica decorativa.
- **`useSearchParams` de `react-router` arrastra al chunk inicial**; la salida es `URLSearchParams`
  nativo (`new URLSearchParams(window.location.search).get('frame')`). No cambiarlo por el hook
  del router "por consistencia".
- **Editar un nivel de música reescribe `audioMix.automation`, no sólo los dos campos de nivel.**
  Ni el `<Player>` (`AudioTrack`) ni el render (`buildAudioMixGraph`) leen
  `music.baseGainDb`/`duckedGainDb` para la curva real de ganancia: un cambio que sólo tocara esos
  campos sería **inaudible en los dos lados**. `rescaleMusicAutomation` está fijada por paridad
  contra el productor real (`planDucking` de `timeline-core`), no contra una expectativa escrita a
  mano.
- **Cambiar el preset borra la clave `box` de todos los captions** (`'box' in clip === false`, no
  `box: undefined`): sin esa omisión, un `safeZone` de 9:16 persistido sobre un lienzo 16:9 deja
  `CAPTION_OUT_OF_SAFE_ZONE` en `validateTimeline`.
- **La validación de cliente es espejo del servicio y clasifica por severidad** (`issueSeverity`):
  `SCHEMA_INVALID` bloquea el guardado; los otros nueve códigos de `validateTimeline` dejan guardar
  con advertencia pero **deshabilitan el disparo de render** (APR-01). Fundamento medido:
  `apps/render-api` no corre `validateTimeline` ni en `EP-008` ni en `EP-012`, pero
  `composition-remotion/src/render.ts` sí — un documento con `CLIP_EXCEEDS_ASSET` se acepta con
  200, el job se crea con 202 y **falla siempre**.
- **`VOICE_TRACK_NOT_MIRRORED` no viaja en `TimelineIssue`** (APR-04): `TimelineIssue.code` de
  `timeline-core` es un union **cerrado** de los diez códigos de `validateTimeline`. Vive como
  `VoiceMirrorIssue`, tipo propio de `aroll-layout.ts`, y la UI declara un union más ancho. No
  ensanchar el tipo de la lib ni castear.
- **`TimelineEditState.rejections` se REEMPLAZA en cada dispatch**, nunca acumula (APR-05): con
  acumulación, un solo valor mal tipeado dejaba `canSaveTimeline` en `false` para siempre.
- **`data-*` como contrato de los guiones de Playwright.** Los cuatro de diagnóstico de
  `timeline-player.tsx` (`data-duration-in-frames`, `data-fps`, `data-composition-width/height`)
  más el `?frame=` de la ruta de preview son el contrato de la captura de paridad de encuadre; los
  `data-testid` (`timeline-player`, `timeline-save-bar`, `render-job-panel`, `asset-source`) y
  `data-timeline-dirty` son el contrato del smoke E2E (`apps/web/e2e/studio-smoke.mjs`).
  Si se renombran, hay que actualizar los guiones. **Los dos guiones viven en `apps/web/e2e/`**
  (`studio-smoke.mjs` y `capture-frame-240.mjs`) y ninguno de los dos entra al `package.json`:
  resuelven Playwright por `import('playwright')` y, si falla, recorriendo `~/.npm/_npx` sin hash
  hardcodeado. `capture-frame-240.mjs` reproduce la medición de paridad de encuadre **con un
  comando y sin renderizar nada**, que es exactamente lo que hará falta al tomar el `[FIX]` del
  encuadre del render.
- **`mountedRef` a nivel de hook se rompe con el doble-invoke de StrictMode.** `useRef(true)` +
  cleanup que lo pone en `false` **sin volver a ponerlo en `true` en el cuerpo del efecto** queda
  en `false` para siempre: el inicializador del ref corre una vez y el cleanup corre dos. El botón
  Save se trababa en "Saving..." tras el primer guardado. El patrón inmune, que ya usaban
  `useAsyncResource` y `useRenderJobPoll`, es un **contador de secuencia monótono** bumpeado en el
  cuerpo del efecto y otra vez en el cleanup — nunca un booleano latcheable.
- **`useAsyncResource` gana `isRefreshing`** y ya no descarta `data` en un refresh: un refresh
  fallido conserva los datos y expone `error` con `status: 'ready'`; sólo un cambio de `key` o una
  carga inicial vuelven a `loading`.

## Dependencias

- **Ninguna nueva.** Cero dependencias npm agregadas en todo el ciclo; la única propia de la app
  sigue siendo `@remotion/player@4.0.522` (versión exacta de `remotion`). `validateTimeline`,
  `planDucking`, `defaultFormat`, `safeZoneFor` y los schemas de Zod ya venían por las dos libs de
  workspace que `cycle-02` cableó.
- **`playwright` nunca entra al `package.json`.** El guion E2E lo resuelve por `import('playwright')`
  y, si falla, buscando en la caché de `npx` (`~/.npm/_npx/*/node_modules/playwright`). Requiere un
  `npx playwright install` una vez por máquina.

## Qué sigue

- **`asset-media-kind.ts` / `content-type-for.ts` siguen siendo un par sin test** — la misma tabla
  en dos lugares, sin nada que las ate. Sigue abierto desde `cycle-02`.
- **El listado de jobs no se refresca solo** cuando el job seguido cambia de estado: sólo un botón
  manual. Ningún CA lo exige; es prosa de `architect.md` §6.3.
- **`TimelineEditState` no expone si la reescala de la automation tuvo efecto** (`rescaled`), así
  que la UI no puede avisar el caso `span === 0` (los dos niveles iguales): el cambio se acepta y
  no se oye nada.
- **El upload sigue sin reportar progreso.**
- **Los dos `404` de `/favicon.ico`** siguen en consola: `index.html` no declara icono. No es un
  defecto de la aplicación.
- **El `<Player>` no aplica `loudnorm`**: lo que se escucha es la curva de ducking de la Timeline,
  no el master a -14 LUFS. Está escrito en pantalla desde `cycle-02`; no volver a "arreglarlo".
- **Reordenar b-roll no cambia un pixel** (el b-roll no tiene orden observable), por eso los
  botones de reordenar aparecen sólo con `track === 'aroll'`.
