# Architect — Cycle 3: Web Studio (`timeline-editing-and-render-jobs`)

> **Input:** `brief.yaml` · `functional.md` (US-3-001..US-3-012, CA-201..CA-246, RF-3-001..RF-3-010)
> **Output:** `sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/architect.md`
> **Generado por:** sdd-architect · **Cierra:** las dos decisiones pendientes del brief (D-12, D-3)
> **No implementa nada.** El planner deriva `tasks.json` de las firmas de §7 y de la lista cerrada de §9.

---

## 0. Resumen de decisiones

| # | Decisión | Resultado |
| --- | --- | --- |
| **D-12** | Encuadre preview vs render | **El preview se alinea al render**, no al revés: la rama `player` de `TimelineVideo` aplica `objectFit: 'fill'` **como default por debajo** del `style` del llamador. El árbol `render` queda carácter por carácter igual. Criterio numérico en §4. **Hallazgo escrito y descopado a `[FIX]`:** el encuadre del render es un estirado anamórfico (`fill`), no `cover` — es un defecto del render, y la spec no cambia la salida del render. |
| **D-3** | Estado de servidor sin librería | **MANTENER.** Cero dependencias npm nuevas. `useAsyncResource` se enmienda de forma retro-compatible (`isRefreshing`) y se suman dos hooks propios (`useApiAction`, `useRenderJobPoll`), ~130 líneas totales, todas puras o con timers falsos. Fundamento medido en §3. |
| **A-1** | Riesgo (a) del funcional — recorte que excede el asset | **CONFIRMADO y más grave que lo escrito.** El servidor no lo valida en EP-008 **ni en EP-012**, pero `renderTimeline` sí (`validateTimeline` → `INVALID_TIMELINE`): el job se crea con 202 y **falla siempre**. Resolución: advertencia no bloqueante para guardar (CA-205) **y disparo de render deshabilitado** con el `code` del issue. §5.4. |
| **A-2** | Riesgo (b) del funcional — niveles de música inaudibles | **CONFIRMADO en el código de los dos consumidores.** Resolución: `rescaleMusicAutomation`, probada contra el productor real (`planDucking`). §5.5. |
| **A-3** | Hallazgo nuevo del architect — la pista `voice` es un espejo de `aroll` | `buildVoiceTrack(arollClips)` mapea 1:1 por índice. Editar un clip de a-roll sin espejar su clip de voz **desincroniza imagen y sonido** sin que ningún test ni el schema lo detecten. §5.2. |
| **A-4** | Hallazgo nuevo del architect — CA-203 contradice el validador real | La contigüidad real es `from[i] = from[i-1] + dur[i-1] − transiciónFrames(i-1, i)`, no `from[i-1] + dur[i-1]`. El documento de `smoke-ingest` lo demuestra. Divergencia declarada en §5.2. |
| **A-5** | Hallazgo nuevo del architect — cambiar el preset invalida los captions | Con `youtube-16x9`, los `box` persistidos de 9:16 disparan `CAPTION_OUT_OF_SAFE_ZONE` → `INVALID_TIMELINE` → render fallido. Resolución: `applyOutputPreset` **omite** la clave `box`. §5.3. |
| **A-6** | Byte-identidad del PUT | **La produce el servidor, no el cliente.** El cliente NO reproduce la serialización. §5.1. |

---

## 1. Hallazgos de código que cambian el contrato

Todo lo de esta sección se leyó en el código real de este repo, no se asumió.

### H-1 — La byte-identidad del PUT la garantiza el servidor

`apps/render-api/src/http/handlers/montage-handler.ts` → `handlePutTimeline`:

1. `readJsonBody(...)` → `400 REQUEST_BODY_INVALID_JSON` / `413 REQUEST_BODY_TOO_LARGE` (`MAX_JSON_BODY_BYTES = 16_777_216`).
2. `TimelineSchema.safeParse(body)` → `422 TIMELINE_INVALID` **antes de resolver el proyecto**: nada se escribe.
3. `writeTimeline(project, parsed.data, …)` de `@video-maker/auto-montage`, que vuelve a hacer
   `TimelineSchema.parse(...)` y serializa con
   `serializeMontageDocument(v) = \`${JSON.stringify(v, null, 2)}\n\``.

**Consecuencia de contrato:** los bytes en disco son función pura del *valor parseado*, producida por
el servidor con exactamente el mismo código que usa `tools/render-cli`. El orden de claves del
cliente, su indentación y su newline final **son irrelevantes**. La lección vigente sobre el orden de
claves de `JSON.stringify` tras un `.parse()` de Zod aplica, pero **al revés de como se planteó**: no
hay que reproducir el orden, hay que apoyarse en que Zod lo normaliza (reconstruye el objeto en el
orden de la *shape*, no del literal de entrada). Lo que el cliente sí debe garantizar es **fidelidad
semántica**, y ahí hay cuatro trampas reales (§5.1).

### H-2 — El encuadre: dónde está exactamente la diferencia

| Evidencia | Fuente |
| --- | --- |
| `OffthreadVideoForRendering` monta `<Img className={OBJECTFIT_CONTAIN_CLASS_NAME} …>` | `node_modules/remotion/dist/cjs/video/OffthreadVideoForRendering.js:195-209` |
| La regla CSS `.__remotion_objectfitcontain { object-fit: contain }` la inyecta **únicamente `@remotion/player`** | `node_modules/@remotion/player/dist/cjs/Player.js:235` (`injectCSS(makeDefaultPreviewCSS(…))`); ningún otro módulo de `remotion`/`@remotion/*` llama a `injectCSS` |
| En el render nadie inyecta esa hoja ⇒ el `<Img>` computa el valor inicial `object-fit: fill` | derivado de las dos filas anteriores |
| `VideoForPreview` monta `<video style={{...style}}>` sin agregar clase ni `object-fit`; Chrome le da `object-fit: contain` por hoja de agente de usuario | `node_modules/remotion/dist/cjs/video/VideoForPreview.js:277-287` + medición de `cycle-02` |
| El render **llena** los 1080×1920: las cuatro esquinas de `render-frame-reference-8s.png` son `1b448a` (contenido), el centro `0f2751` | medido acá con `ffmpeg -vf crop=1:1:x:y` |
| El `<video>` del Player mide `1080×1920` (misma caja que el `<Img>`, mismo contenedor flex) | medición de `cycle-02` |
| `ArollScene` es el único punto de la lib que pasa un `style` **sin** `width`/`height`/`objectFit` (sólo `punchInStyle`); `BrollTrack` ya declara `COVER_MEDIA_STYLE`/`CONTAIN_MEDIA_STYLE`/`PIP_MEDIA_STYLE` | `aroll-series.tsx`, `broll-track.tsx` |

**Conclusión:** la caja es la misma en los dos caminos (1080×1920); **la única propiedad computada que
difiere es `object-fit`** (`contain` en el preview, `fill` en el render). Por eso poner `objectFit:
'cover'` en `ArollScene` cambió los bytes en `cycle-02`: `cover` no es lo que el render hace hoy.

### H-3 — `validateTimeline` valida mucho más que `TimelineSchema`, y el render lo corre

`libs/timeline-core/src/timeline/validate-timeline.ts` emite diez códigos:
`SCHEMA_INVALID`, `EMPTY_AROLL`, `ASSET_NOT_FOUND`, `CLIP_EXCEEDS_ASSET`, `AROLL_OVERLAP`,
`AROLL_GAP`, `DURATION_MISMATCH`, `CLIP_OUT_OF_TIMELINE`, `TRANSITION_CLIP_NOT_FOUND`,
`CAPTION_OUT_OF_SAFE_ZONE`.

- `libs/composition-remotion/src/render.ts:142` llama `validateTimeline` y falla con `INVALID_TIMELINE`.
- `apps/render-api` **no** lo llama: ni EP-008 ni EP-012 (`readStoredTimeline` sólo hace `TimelineSchema`).
- Por lo tanto **todo issue de esos nueve, salvo `SCHEMA_INVALID`, pasa el PUT con 200 y el POST con
  202, y mata el job en la etapa `render`.** Ese es el mecanismo exacto del riesgo (a) del funcional.
- `validateTimeline` está exportado del barrel (`libs/timeline-core/src/index.ts:90-91`, junto a
  `TimelineIssue`/`TimelineIssueCode`): el cliente puede correrlo **sin ninguna dependencia nueva**.

### H-4 — `voice` es un espejo derivado de `aroll`

`libs/timeline-core/src/timeline/build-timeline.ts` → `buildVoiceTrack(arollClips)` mapea 1:1 por
índice copiando `assetId`, `from`, `durationFrames` y `trimStartMs`. Verificado en el documento real
de `media/smoke-ingest`: los seis clips de `voice` tienen exactamente el `from`/`durationFrames`/
`trimStartMs` de los seis de `aroll`, y el mismo `assetId` (`raw/aroll/clip01.mp4` — el audio *es* el
del clip). Ninguna regla de `TimelineSchema` ni de `validateTimeline` exige ese espejo: romperlo
produce un documento válido, una suite verde y un video desincronizado.

### H-5 — La contigüidad de a-roll descuenta las transiciones

`collectArollOrderIssues` espera `from[i] == from[i-1] + dur[i-1] − transitionFramesBetween(prev, cur)`
y `timeline.durationFrames == last.from + last.durationFrames`. En `media/smoke-ingest`:
`aroll-0004` (`from 249`, `dur 75`) → fin 324; `aroll-0005` arranca en **317** = 324 − 7, los 7 frames
de la transición `whip-pan`. **CA-203, tal como está escrito, produce un documento con `AROLL_OVERLAP`
o `AROLL_GAP`** en cualquier proyecto que tenga una transición. Divergencia declarada (§5.2).

### H-6 — El `box` persistido de un caption no lo usa el render, pero sí el validador

`TimelineComposition` llama `captionClipPlan` sin `boxSource`, y el default es `'preset'`
(`caption-clip-plan.ts`): el `box` del clip **se ignora** y la caja sale de `captionBoxFor(safeZone,
format, preset, anchor)`. Pero `collectCaptionSafeZoneIssues` **sí** lo valida contra el `safeZone`
del formato. Con el documento de `smoke-ingest` (`box.y + box.height = 1520`) y el preset
`youtube-16x9` (`safeZone` 60/60/60/60 sobre 1920×1080 ⇒ límite inferior 1020), cambiar el preset
dispara `CAPTION_OUT_OF_SAFE_ZONE` ⇒ `INVALID_TIMELINE` ⇒ render fallido. §5.3.

### H-7 — El b-roll no tiene orden observable

`broll-track.tsx` mapea cada clip a su propio `<Sequence from={clip.from}>`: **el orden del array no
cambia un solo pixel**, y `validateTimeline` no exige contigüidad en `broll`. Reordenar b-roll es un
no-op del producto. Descopado con fundamento (§5.2).

### H-8 — Los seis estados y sus códigos, tal como los emite el servicio

`apps/render-api/src/jobs/render-job-state.ts` + `render-job-queue.ts`:

| Origen | Estado previo | Resultado de `DELETE /jobs/:jobId` |
| --- | --- | --- |
| `queued` | → `canceled` (terminal) | `200` |
| `running` | → `canceling` | `202` |
| `canceling` | → `canceling` (mismo estado) ⇒ `kind: 'canceling'` | `202`, idempotente (CA-231) |
| `succeeded`/`failed`/`canceled` | rechazado | `409 RENDER_JOB_NOT_CANCELABLE` (CA-232) |

`mergeRenderProgress` sólo actualiza `renderedFrames/totalFrames/percent` cuando la etapa es `render`
y nunca retrocede; `startRenderJobStage` los pone en `null` al entrar a cualquier etapa. Es decir:
**`progress.stage !== 'render'` implica `renderedFrames === null`** — CA-226 es una propiedad ya
garantizada por el servicio, y el cliente sólo tiene que no inventar un conteo (§6.2).
La cancelación de un job `running` sólo se materializa en el `checkpoint()` entre etapas de
`runRenderPipeline`: `canceling` puede durar minutos. CA-230 no es un detalle de UI, es el
comportamiento real del servicio.

---

## 2. Alcance técnico y estructura de archivos

Todo lo nuevo vive en `apps/web`, salvo una línea en `libs/composition-remotion` (D-12).
**`apps/render-api` y `tools/render-cli` no se tocan. No hay endpoints nuevos.**

```
apps/web/src/
  api/
    render-api-types.ts            (+ tipos de job y de escritura — declarados acá, D-5)
    render-api-client.ts           (+ putTimeline, createRenderJob, listRenderJobs,
                                      getRenderJob, cancelRenderJob)
    parse-render-job.ts            NUEVO  narrowing estructural de RenderJob (200 con state failed incluido)
    render-job-artifact.ts         NUEVO  renderJobDeliverableUrl(slug, jobId) -> artifactUrl(slug, `out/${jobId}.mp4`)
    render-job-poll-plan.ts        NUEVO  decisión pura de seguir/parar el polling
    timeline-edit/                 NUEVO  (importa VALORES de timeline-core -> sólo en el chunk perezoso)
      timeline-document.ts           canonicalTimelineJson · timelineDocumentsEqual
      timeline-edit-rules.ts         espejo cliente de MsSchema / FrameSchema / text.min(1) + regla de transición
      aroll-layout.ts                relayout de from/durationFrames + espejo de voice + clamp
      rescale-music-automation.ts    reescritura de audioMix.automation
      apply-output-preset.ts         format + safeZone + omisión de box
      issue-severity.ts              save-blocking vs render-blocking
      timeline-edit-state.ts         reducer + acciones + estado
    __fixtures__/editable-timeline.ts  NUEVO  fixture GENERADA con buildTimeline (no literal)
  hooks/
    use-async-resource.ts          (enmienda retro-compatible: isRefreshing)
    use-api-action.ts              NUEVO
    use-render-job-poll.ts         NUEVO
  components/
    timeline-player.tsx            (+ initialFrame?, controls?)
    clip-track-editor.tsx          NUEVO
    caption-editor.tsx             NUEVO
    music-mix-editor.tsx           NUEVO
    output-preset-selector.tsx     NUEVO
    timeline-issue-list.tsx        NUEVO
    timeline-save-bar.tsx          NUEVO
    render-trigger.tsx             NUEVO
    render-job-list.tsx            NUEVO
    render-job-panel.tsx           NUEVO
  pages/
    project-preview-page.tsx       (crece a pantalla de estudio; ruta y nombre de archivo NO cambian)
apps/web/e2e/
  studio-smoke.mjs                 NUEVO  guion E2E ejecutable (US-3-012)

libs/composition-remotion/src/components/timeline-video.tsx   (una constante + un spread — D-12)
```

### 2.1 Reglas de ubicación que no se pueden violar

- **`src/api/` es el único lugar que sabe que el servicio existe** (RNF-4). `renderJobDeliverableUrl`
  existe precisamente para que ningún componente escriba `out/<jobId>.mp4` (CA-236).
- **Todo módulo que importe un *valor* de `@video-maker/timeline-core` debe ser alcanzable sólo desde
  la ruta perezosa.** Hoy el único es `parse-timeline.ts`; `timeline-edit/**` se suma. La ruta
  `/projects/:slug/preview` sigue cargándose con `React.lazy`, y **ningún** módulo de `timeline-edit/`
  puede ser importado desde `app.tsx`, `studio-layout.tsx`, `projects-page.tsx` ni
  `asset-library-page.tsx`. Motivo: Zod + `timeline-core` volverían al chunk inicial (450 kB hoy).
  Los tipos (`import type`) son gratis y no cuentan.
- **`@nx/enforce-module-boundaries`:** no se introduce ningún `await import()` de una lib del
  workspace. Todos los imports de `timeline-core` y `composition-remotion` siguen siendo estáticos.
  La regla no se activa y no hace falta ninguna excepción nueva.
- **`apps/web/eslint.config.mjs` NO se crea** (D-9). Nada de este contrato lo necesita.
- **Sin comentarios en el código**; copy, identificadores y payloads en inglés.

---

## 3. DECISIÓN D-3 — Estado de servidor: **MANTENER** (sin librería, sin deps nuevas)

### 3.1 Qué necesita el ciclo, medido contra `useAsyncResource` real

`apps/web/src/hooks/use-async-resource.ts`, leído entero:

```ts
useEffect(() => {
  requestSequence.current += 1;
  setState({ status: 'loading', data: null, error: null });   // <- blanquea SIEMPRE
  loadRef.current().then(...).catch(...);
}, [key, reloadToken]);
```

| Consumidor del ciclo | ¿Lo cubre `useAsyncResource` hoy? | Faltante exacto |
| --- | --- | --- |
| GET timeline (EP-007), una vez | **Sí**, sin cambios | — |
| Listado de jobs (EP-013), refrescado | No | cada `reload()` pone `data: null` ⇒ la lista parpadea a vacío |
| Polling de un job (EP-014) | **No** | (1) no hay disparo por intervalo; (2) `data: null` en cada tick borra el último estado conocido; (3) no hay condición de corte |
| PUT timeline (EP-008), POST/DELETE job | No | es una mutación imperativa con input, no un recurso por `key` |

El faltante real es **uno solo y chico**: *conservar el valor anterior mientras se re-consulta*. Todo
lo demás (intervalo, corte por estado terminal, corte por 404, gating de frames por etapa) es lógica
**propia de este dominio** que ninguna librería aporta.

### 3.2 Costo comparado, escrito

| Opción | Costo |
| --- | --- |
| **Mantener** | `isRefreshing` en `useAsyncResource` (≈12 líneas), `useApiAction` (≈35), `useRenderJobPoll` (≈45) + `nextPollPlan` puro (≈25). **≈120 líneas**, todas testeables con `vi.useFakeTimers()` o sin timers. Cero bytes nuevos en el bundle más allá de eso. |
| **Revertir (TanStack Query)** | Una dependencia npm nueva (~13 kB gz) en una app cuya constitución dice *"cero dependencias npm propias"*, un `QueryClientProvider` en `app.tsx` (chunk **inicial**), una convención de claves de caché, y `useMutation`/`refetchInterval` que **no eliminan** la lógica de corte por `terminal`/`404`/`stage === 'render'` — que es donde está toda la complejidad. Además obliga a reescribir los 6 consumidores ya implementados de `useAsyncResource` o a convivir con dos primitivos. |

### 3.3 Decisión

**D-3 se MANTIENE.** Sin librería de data-fetching y sin store global. La enmienda es aditiva y
retro-compatible: `AsyncResource<T>` gana `isRefreshing: boolean` y **conserva los tres `status`
existentes**, de modo que `project-preview-page.tsx`, `asset-library-page.tsx`, `projects-page.tsx` y
`service-health-badge.tsx` siguen funcionando sin tocarse (sus specs actuales son el guardarraíl).

Semántica exacta de `useAsyncResource` después de la enmienda:

| Situación | `status` | `data` | `error` | `isRefreshing` |
| --- | --- | --- | --- | --- |
| cambio de `key` | `loading` | `null` | `null` | `false` |
| `reload()` con `data === null` | `loading` | `null` | `null` | `false` |
| `reload()` con `data !== null` | `ready` | valor anterior | `null` | `true` |
| resolución OK de un refresh | `ready` | valor nuevo | `null` | `false` |
| fallo de un refresh (con `data !== null`) | `ready` | valor anterior | el `RenderApiError` | `false` |
| fallo de la carga inicial | `error` | `null` | el `RenderApiError` | `false` |

El contador de secuencia que ya existe se conserva tal cual: descarta la respuesta de un request
obsoleto.

> **Esta decisión la ejecuta el reviewer sobre `sdd/context/apps/web/constitution.md`** (fragmento
> aditivo en `updates/`), reemplazando la frase *"Se revisa en `cycle-03` con el polling de jobs como
> consumidor real"* por el resultado y su fundamento.

---

## 4. DECISIÓN D-12 — Encuadre preview vs render

### 4.1 Qué está mal, y de qué lado

Con la evidencia de H-2, la cadena es:

1. El render monta un `<Img>` cuya única propiedad de encaje es el **valor inicial `object-fit: fill`**
   (la clase `__remotion_objectfitcontain` que Remotion le pone **no tiene regla** fuera del Player).
2. El preview monta un `<video>` que Chrome computa con `object-fit: contain` por hoja de agente de
   usuario.
3. Las dos cajas miden 1080×1920 (medido en el `<video>`; y el frame del render está lleno de
   contenido en las cuatro esquinas, lo que descarta que el `<img>` esté a tamaño intrínseco).

**Es decir: la única diferencia entre preview y render es `object-fit`.** Y el render, hoy, estira
anamórficamente un 1280×720 dentro de 1080×1920.

### 4.2 Hallazgo escrito y descopado (CA-240 / CE-16)

> **El encuadre del render es un defecto del render, no del preview.** Estirar 16:9 a 9:16 con
> `object-fit: fill` deforma la imagen; lo correcto para el producto sería `cover` (recortar
> preservando la relación de aspecto), que es lo que `BrollTrack` ya hace para b-roll. Cambiarlo
> **cambia la salida binaria del render** (probado en `cycle-02`: `sha256` de `video-muted.mp4` de
> `c1b9fd9f…` a `2ed415d8…`), y `out_of_scope` del brief y CA-239/RN-18 lo prohíben explícitamente en
> esta spec.
>
> **Se descopa a un `[FIX]` posterior**, con este alcance ya escrito para que no haya que re-descubrirlo:
> dar a `ArollScene` un `COVER_MEDIA_STYLE` idéntico al de `BrollTrack`
> (`{ width: '100%', height: '100%', objectFit: 'cover' }`), en el árbol compartido (los dos backends),
> **re-basar el `sha256` de no-regresión** y regenerar `render-frame-reference-8s.png`. Es un cambio
> deliberado del entregable, no una regresión.

Hasta ese `[FIX]`, el valor de producto de US-3-011 se cumple igual y mejor: **el dev ve en el
preview exactamente el encuadre que va a salir en el MP4, defecto incluido.**

### 4.3 Mecanismo exacto

Único archivo tocado en la lib: `libs/composition-remotion/src/components/timeline-video.tsx`.

```ts
const PLAYER_MEDIA_STYLE: CSSProperties = { objectFit: 'fill' };

export const TimelineVideo: FC<TimelineVideoProps> = ({ src, trimBefore, style }) => {
  const backend = useVideoBackend();

  if (backend === 'player') {
    return <Video src={src} trimBefore={trimBefore} muted style={{ ...PLAYER_MEDIA_STYLE, ...style }} />;
  }

  return <OffthreadVideo src={src} trimBefore={trimBefore} muted style={style} />;
};
```

Cuatro propiedades del mecanismo, todas deliberadas:

1. **El orden del spread es `{ ...PLAYER_MEDIA_STYLE, ...style }` y no al revés.** `TimelineVideo`
   también lo usa `BrollMedia`, que ya pasa `objectFit: 'cover' | 'contain'` explícito: el estilo del
   llamador tiene que ganar. Sólo `ArollScene` —que pasa únicamente `transform`/`transformOrigin`—
   recibe el default de paridad. Invertir el orden rompería el b-roll `contain` y el `pip`.
2. **La rama `render` queda literalmente idéntica**, carácter por carácter. El árbol que
   `@remotion/bundler` empaqueta no cambia ⇒ el `sha256` es invariante **por construcción**, y la
   corrida real es la confirmación empírica, no la esperanza.
3. **Ningún contrato público cambia.** `TimelineVideoProps` es el mismo; el barrel no gana ni pierde
   exports. `renderTimeline`, `RenderTimelineOptions`, `RenderTimelineError`, `TimelineAudioMode` y
   `TimelineCompositionProps` no se tocan.
4. **`apps/web` no cambia por D-12**, salvo la afordancia de captura de §4.5.

### 4.4 Criterio numérico de verificación (CA-238)

**Métrica:** `mse_avg` que reporta
`ffmpeg -hide_banner -i <captura> -i <referencia> -lavfi "psnr=stats_file=-" -f null -`
entre la captura del `<Player>` en el frame **240** (t = 8 s a 30 fps), reescalada a 1080×1920, y
`sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-02/artifacts/render-frame-reference-8s.png`.

**Calibración medida por el architect** (2026-09-09, `ffmpeg` local, sin renderizar nada). Se
reconstruyó geométricamente el frame de referencia desde `media/smoke-ingest/raw/aroll/clip01.mp4`
(frame de fuente 290 = `trimBefore` 233 + 57 locales del clip `aroll-0003`, con su `scale 1.08` y
`transform-origin 50% 33%`) en las tres hipótesis de encaje:

| Hipótesis reconstruida | `mse_avg` vs la referencia | `psnr_avg` |
| --- | --- | --- |
| `fill` (estirado anamórfico) | **824,93** | 18,97 dB |
| `cover` (recorte preservando aspecto) | **824,93** — *idéntico* | 18,97 dB |
| `contain` (letterbox, el preview de hoy) | **6164,68** | 10,23 dB |

Dos lecturas, las dos importantes:

- **El letterbox es 7,5× peor.** La métrica discrimina con muchísimo margen lo que este ciclo tiene
  que arreglar.
- **`fill` y `cover` dan el número exactamente igual** sobre este material: confirma, ahora con un
  número, el follow-up de `cycle-02` — `clip01.mp4` es un degradado azul horizontalmente uniforme y
  **no puede** distinguir `cover` de `fill` por comparación de píxeles. Esa distinción se resuelve por
  código (§4.6), no por captura.

**Gates de aceptación de CA-238** (los tres se ejecutan y los tres números se registran en
`cycles/cycle-03/artifacts/frame-parity-8s.md`):

- **G-A (ausencia de bandas).** La luma media de las 96 primeras filas y de las 96 últimas de la
  captura es ≥ 16/255 cada una. *Fundamento:* las esquinas de la referencia son `1b448a`
  (luma ≈ 64); un letterbox da ≈ 0. Es el criterio categórico que el funcional pide como mínimo
  ("misma región de contenido visible sin bandas").
- **G-B (equivalencia numérica).** `mse_avg(después) ≤ 1500` **y**
  `mse_avg(después) ≤ 0,35 × mse_avg(antes)`.
  *Fundamento del techo 1500:* la reconstrucción `fill` —geométricamente exacta, **sin** los captions
  y **sin** la pérdida de H.264— ya mide 825; la captura del navegador suma la superposición de
  captions y la diferencia de color navegador↔encoder, así que el techo se fija en ≈1,8× el control
  exacto y sigue 4× por debajo del 6165 del letterbox.
  *Fundamento del cociente 0,35:* el cociente medido del control es 825/6165 = 0,134; 0,35 es 2,6×
  ese valor (tolera ruido de captura) y es inalcanzable para `contain`, cuyo cociente es 1,0 por
  definición.
- **G-C (sensibilidad del oráculo — obligatorio).** Se vuelve a correr la medición **quitando**
  `PLAYER_MEDIA_STYLE` y se registra el número: **tiene que fallar G-A y G-B**. Sin esta corrida el
  criterio no está verificado, sólo declarado (lección vigente: probar que el oráculo es sensible
  corriendo a propósito el cambio que debería romperlo).

**Gate de no-regresión (CA-239), independiente de los anteriores:** job real de EP-012 sobre
`media/smoke-ingest` **sin editar** y `sha256` de `work/renders/<job>/video-muted.mp4` igual a
`c1b9fd9f33ba6926…4c8527cb`. Mismo guion que `cycle-02/artifacts/render-non-regression.md`, con el
gate de memoria previo y **nunca en paralelo con el render del smoke E2E**.

### 4.5 Cómo se captura el frame 240 de forma determinista

`TimelinePlayer` gana dos props opcionales, ambas con default que preserva el comportamiento actual:

```ts
export type TimelinePlayerProps = {
  timeline: Timeline;
  initialFrame?: number;   // -> <Player initialFrame={...}>, prop nativa de @remotion/player 4.0.522
  controls?: boolean;      // default true; el capturador lo pone en false
};
```

`ProjectPreviewPage` lee `?frame=<n>` con `useSearchParams`; cuando está presente pasa
`initialFrame={n}` y `controls={false}` (si no, la barra de transporte del Player contamina la banda
inferior y rompe G-A). El Player arranca **pausado**, así que `/projects/smoke-ingest/preview?frame=240`
da un frame reproducible sin depender de `play()` ni de cronómetros.

Guion de captura (misma vía que `cycle-01`/`cycle-02`: el MCP de Playwright de este arnés no abre
navegador; se usa el Playwright cacheado en `~/.npm/_npx` con `chromium.launch({ channel: 'chrome' })`):
esperar `[data-testid="timeline-player"]`, esperar que el `<video>` tenga `readyState === 4` y
`videoWidth > 0` **medido en el navegador** (nunca por la captura ni por el `src`), capturar el
elemento, reescalar a 1080×1920 con `ffmpeg -vf scale=1080:1920` y correr `psnr`.

> **Riesgo abierto para el implementador:** si con `initialFrame` el `<video>` no llega a pintar el
> frame exacto estando pausado, la salida documentada es reproducir hasta pasar `t = 8 s`, pausar y
> leer `currentTime` real, y comparar contra el frame del render que corresponda a **ese**
> `currentTime` (extraído con `ffmpeg -ss`). El criterio numérico no cambia; cambia de dónde sale la
> referencia, y eso se escribe en el artefacto.

### 4.6 Cómo se decide `fill` vs `cover` sin agregar binarios al repo

La comparación de píxeles no puede (§4.4). Se resuelve en dos capas:

1. **Capa de código, obligatoria y bloqueante:** `libs/composition-remotion/src/components/timeline-video.spec.tsx`
   asevera el literal `'fill'` en la rama `player` cuando el llamador no declara `objectFit`, que el
   `objectFit` del llamador gana cuando sí lo declara (caso b-roll `cover` y `contain`), y que la rama
   `render` recibe un `style` cuyo `Object.keys(...).sort()` es exactamente el del `style` entrante.
   El fundamento del literal es H-2, citado en el propio spec por su archivo y línea.
2. **Capa visual, recomendada y no bloqueante:** para dejar evidencia de que el estirado se ve, se
   genera material no uniforme **dentro del `RENDER_API_MEDIA_ROOT` temporal**, nunca en el repo:

   ```bash
   ffmpeg -y -f lavfi -i testsrc2=size=1280x720:rate=30 -t 3 -pix_fmt yuv420p \
     "$RENDER_API_MEDIA_ROOT/<slug>/raw/aroll/testsrc.mp4"
   ```

   Se apunta un proyecto de scratch a ese asset y se capturan preview y render; la captura va a
   `artifacts/` (una imagen, no un binario de video). Si el presupuesto del ciclo no alcanza, se omite
   y se anota — la capa 1 es la que cierra CA-238.

---

## 5. Contrato de estado local ↔ PUT (eje de edición)

### 5.1 Fidelidad de bytes: qué garantiza quién

**El cliente no reproduce la serialización** (H-1). Prohibido escribir un "serializador canónico" en
`apps/web`: sería código muerto que se desincroniza de `serializeMontageDocument`.

Lo que el cliente sí garantiza, y sus cuatro trampas reales:

| Trampa | Regla del contrato |
| --- | --- |
| `TimelineSchema` y `TimelineTracksSchema` son `strictObject` | el draft **no puede ganar ninguna clave** de nivel superior ni dentro de `tracks`; una clave de UI colada ahí es un `422 TIMELINE_INVALID` |
| `VideoClipSchema`/`AudioClipSchema`/`CaptionClipSchema`/`MusicMixSettingsSchema` son `z.object` | una clave extra **se descarta en silencio** en el servidor: no da error, se pierde. El guardarraíl es `timelineDocumentsEqual` (abajo), no el 422 |
| Claves opcionales (`fit`, `muted`, `transform.anchor`, `emphasisIndex`, `box`, `safeZone`, `transitions`, `fadeInFrames`, `fadeOutFrames`) | se **omiten**, nunca se asignan `undefined` ni `null` (`exactOptionalPropertyTypes` del repo; `null` es un 422) |
| `VoiceTargetSchema`/`MusicMixSettingsSchema` tienen `.default()` | si faltaran, el servidor los materializa; el documento ya persistido los trae, así que el round-trip es estable |

**El guardarraíl es una identidad de valor, no de bytes:**

```ts
// src/api/timeline-edit/timeline-document.ts
export function canonicalTimelineJson(timeline: Timeline): string;      // JSON.stringify(TimelineSchema.parse(timeline))
export function timelineDocumentsEqual(a: Timeline, b: Timeline): boolean; // canonicalTimelineJson(a) === canonicalTimelineJson(b)
```

`canonicalTimelineJson` pasa por `TimelineSchema.parse`, que reconstruye el objeto en el orden de la
*shape* — el mismo orden que produce el servidor. Por eso comparar sus salidas es exactamente
comparar los bytes que el servidor va a escribir, salvo indentación y newline final, que son
constantes. Consumidor de producción: el flag `dirty` (CA-220). Prueba de la garantía de bytes
(CA-216/CA-217, spec de §9): un draft sin ediciones tiene que dar
`` `${JSON.stringify(TimelineSchema.parse(draft), null, 2)}\n` `` **carácter por carácter igual** a la
misma expresión sobre el documento cargado — que es literalmente lo que
`libs/auto-montage/src/montage/write-timeline.spec.ts` ya pinnea del lado del productor. Los dos
archivos son un **par declarado**, como `asset-media-kind.ts` ↔ `content-type-for.ts`; queda escrito
en el fragmento de constitución.

**Envío:** `putTimeline` manda `JSON.stringify(timeline)` (compacto) con `content-type: application/json`.
El tamaño del documento de `smoke-ingest` es ~7,9 kB contra un límite de 16 MiB: `413` es un caso de
error a mostrar, no un riesgo real.

### 5.2 Ediciones sobre `tracks` — layout, espejo de voz y clamp

**Divergencia declarada respecto de CA-203** (fundamento en H-5; lección vigente: derivar el contrato
de la función real declarando la divergencia). La fórmula del funcional
(`from[i+1] = from[i] + durationFrames[i]`) produce `AROLL_OVERLAP`/`AROLL_GAP` en cuanto hay una
transición, y `media/smoke-ingest` tiene una. La fórmula del contrato es la que `validateTimeline`
exige:

```
from[0] = 0
from[i] = from[i-1] + durationFrames[i-1] − transitionFramesBetween(transitions, aroll[i-1].id, aroll[i].id)
timeline.durationFrames = from[n-1] + durationFrames[n-1]
```

`transitions` **no se toca**: los `betweenClipIds` siguen apuntando a clips existentes (nunca se
dispara `TRANSITION_CLIP_NOT_FOUND`), y si un reordenamiento rompe la adyacencia de un par, la
transición simplemente deja de aplicarse — `findTransitionBetween` de `ArollSeries` no la encuentra y
`transitionFramesBetween` devuelve 0, que es exactamente lo que el validador espera.

```ts
// src/api/timeline-edit/aroll-layout.ts
export function transitionFramesBetween(
  transitions: readonly TimelineTransition[],
  outgoingClipId: string,
  enteringClipId: string,
): number;

export function relayoutArollTrack(timeline: Timeline): Timeline;
export function mirrorVoiceFromAroll(tracks: Timeline['tracks']): Timeline['tracks'];
export function clampTracksToDuration(tracks: Timeline['tracks'], durationFrames: number): Timeline['tracks'];
```

`relayoutArollTrack` corre, en este orden, después de **cualquier** acción que cambie `durationFrames`,
`trimStartMs` o el orden de un clip de a-roll:

1. recalcular `from` de todo `tracks.aroll` con la fórmula de arriba;
2. recalcular `timeline.durationFrames`;
3. `mirrorVoiceFromAroll` — **hallazgo A-3 / H-4**: `voice[i]` recibe el `from`, `durationFrames` y
   `trimStartMs` de `aroll[i]`, conservando su `id`, `gainDb` y fades. Si
   `voice.length !== aroll.length` el espejo se omite y se emite un issue propio
   `VOICE_TRACK_NOT_MIRRORED` (documento editado a mano fuera del producto);
4. `clampTracksToDuration` sobre `broll` y `music`: si `from + durationFrames > durationFrames` total,
   `durationFrames = max(1, total − from)`. Sin esto, acortar el último clip de a-roll dispara
   `CLIP_OUT_OF_TIMELINE` sobre `music-0001` (que en `smoke-ingest` va de 0 a 538) y el job falla.
   `voice` no se clampa: ya quedó en rango por el espejo.

**Reordenar b-roll queda descopado por fundamento medido (H-7):** el orden del array de `broll` no
cambia un pixel (`BrollTrack` posiciona cada clip por su propio `from`) y `validateTimeline` no exige
contigüidad ahí. La UI expone el reordenamiento **sólo en `aroll`**, que es la única pista donde el
orden es observable; los campos `trimStartMs`/`durationFrames` sí se exponen en las dos pistas
(CA-201 intacto).

### 5.3 Cambio de preset (US-3-004)

```ts
// src/api/timeline-edit/apply-output-preset.ts
export function applyOutputPreset(timeline: Timeline, preset: OutputPreset): Timeline;
```

- `preset === timeline.format.preset` → devuelve el mismo objeto, sin marcar `dirty`.
- si no: `format = defaultFormat(preset)`, `safeZone = safeZoneFor(format)` — **juntos**, mismo
  invariante que `previewFormat` de `cycle-02` (CA-213) — y **se omite la clave `box` de todos los
  clips de `tracks.captions`**.
- Fundamento de omitir `box` (**hallazgo A-5 / H-6**): `TimelineComposition` no pasa `boxSource`, el
  default de `captionClipPlan` es `'preset'` y el `box` persistido **ya se ignora al renderizar**;
  mantenerlo sólo sirve para que `collectCaptionSafeZoneIssues` dispare `CAPTION_OUT_OF_SAFE_ZONE` al
  pasar a `youtube-16x9` (`box.y + box.height = 1520 > 1080 − 60`) y el render muera con
  `INVALID_TIMELINE`. Omitirlo **no puede cambiar un pixel renderizado**; es un cambio de documento,
  no de salida.
- Los cuatro presets de `OutputPresetSchema` se exponen (CA-212). El selector de **sólo preview** de
  `cycle-02` (`PREVIEW_PRESETS`, `previewFormat`) **queda intacto**; conviven en la misma pantalla y
  el copy en inglés los distingue explícitamente (CA-215): el de preview dice
  `preview only — nothing is persisted` (ya existe) y el nuevo, `output preset — saved with the timeline`.

### 5.4 Validación cliente y severidad de issues

Dos capas, y hay que no confundirlas:

**Capa 1 — espejo literal de los schemas del servidor** (`timeline-edit-rules.ts`). Rechaza **antes de
emitir cualquier request** y **sin aplicar la acción al draft**:

```ts
export const TIMELINE_EDIT_REJECTION_CODES = [
  'TRIM_START_MS_INVALID',            // espejo de MsSchema: entero >= 0            (CA-202)
  'DURATION_FRAMES_INVALID',          // espejo de z.number().int().min(1)          (CA-202)
  'CAPTION_WORD_TEXT_EMPTY',          // espejo de z.string().min(1)                (CA-207)
  'DURATION_SHORTER_THAN_TRANSITION', // regla derivada de Remotion, ver abajo
] as const;
export type TimelineEditRejectionCode = (typeof TIMELINE_EDIT_REJECTION_CODES)[number];
export type TimelineEditRejection = { code: TimelineEditRejectionCode; path: string; message: string };

export function rejectTrimStartMs(value: number, path: string): TimelineEditRejection | null;
export function rejectDurationFrames(value: number, path: string): TimelineEditRejection | null;
export function rejectCaptionWordText(value: string, path: string): TimelineEditRejection | null;
export function rejectDurationAgainstTransitions(timeline: Timeline, clipId: string, durationFrames: number): TimelineEditRejection | null;
```

- `rejectCaptionWordText` rechaza **sólo `length === 0`**, que es el espejo exacto de
  `CaptionClipWordSchema.text` (`z.string().min(1)`). Un texto de sólo espacios pasa en el servidor:
  se acepta y se muestra como **advertencia** (no rechazo), para que el espejo siga siendo honesto.
- `rejectDurationAgainstTransitions`: `TransitionSeries.Transition` de Remotion 4.0.522 no puede durar
  más que las secuencias que une. La regla es
  `durationFrames >= transicionEntrante + transicionSaliente + 1`. Es **bloqueante** porque violarla
  rompe el `<Player>` en pantalla *y* el render; el spec la prueba sobre la regla propia, no sobre
  Remotion.

**Capa 2 — `validateTimeline` del propio `@video-maker/timeline-core`**, corrido sobre el draft en cada
acción (documento de ~40 clips: costo despreciable). Clasificación:

```ts
// src/api/timeline-edit/issue-severity.ts
export type TimelineIssueSeverity = 'save-blocking' | 'render-blocking';
export function issueSeverity(code: TimelineIssueCode): TimelineIssueSeverity;
```

| Códigos | Severidad | Efecto |
| --- | --- | --- |
| `SCHEMA_INVALID` | `save-blocking` | Save deshabilitado. El servidor devolvería `422 TIMELINE_INVALID` (CA-218) |
| `EMPTY_AROLL`, `ASSET_NOT_FOUND`, `CLIP_EXCEEDS_ASSET`, `AROLL_OVERLAP`, `AROLL_GAP`, `DURATION_MISMATCH`, `CLIP_OUT_OF_TIMELINE`, `TRANSITION_CLIP_NOT_FOUND`, `CAPTION_OUT_OF_SAFE_ZONE` | `render-blocking` | **Se guarda igual** (CA-205 / RN-3) mostrando el `code`, `path` y `message` del issue como advertencia distinguible de un error de guardado; **el disparo de render queda deshabilitado** nombrando esos códigos |

**Decisión sobre el riesgo (a) del funcional, por escrito:** *advertencia para guardar, bloqueo para
renderizar*. El funcional pedía elegir entre UI bloqueante o advertencia y contemplaba sólo el
guardado; la evidencia de H-3 agrega el dato que faltaba: un documento con `CLIP_EXCEEDS_ASSET` no
"puede" fallar el render, **falla siempre** (`render.ts:142`), consumiendo el único slot de render y
minutos de CPU. Bloquear el disparo es estrictamente mejor que dejar que el job muera en
`stage: 'render'`, y no contradice ningún CA: CA-205 habla del guardado, CA-221 ya bloquea el disparo
por otra causa y CA-224/CA-227 siguen cubriendo el caso en que el documento persistido se vuelva
inválido por fuera de la UI.
**Esta es una restricción nueva sobre US-3-006 y la aprueba el orquestador antes de implementar.**

### 5.5 Niveles de música → `audioMix.automation` (riesgo (b), CONFIRMADO)

Verificado en los dos consumidores reales:

- Preview: `libs/composition-remotion/src/components/audio-track.tsx` → `musicVolume(clip, automation)`
  → `volumeAtFrame(automation, …)`. Sólo cae a `clip.volume` (derivado de `AudioClip.gainDb`) cuando
  `automation.length === 0`.
- Render: `libs/media-local/src/mix/build-music-bed-chain.ts` → `buildGainFilters(plan, clip, fps)`
  usa `plan.automation`; sólo cae a `gainDbToVolume(clip.gainDb)` cuando `plan.automation.length === 0`.

**Ninguno de los dos lee `audioMix.music.baseGainDb` ni `duckedGainDb`.** Editar sólo esos dos campos
es inaudible en preview y en render — exactamente la lección "leer quién **produce** un dato".

El productor real de `automation` es `planDucking` de `@video-maker/timeline-core`, que necesita los
rangos de voz del análisis de audio: **no son recuperables desde la Timeline**. Por eso el contrato no
re-planifica, **reescala**:

```ts
// src/api/timeline-edit/rescale-music-automation.ts
export type MusicLevels = { baseGainDb: number; duckedGainDb: number };
export type AutomationRescale = { automation: GainKeyframe[]; rescaled: boolean };

export function rescaleMusicAutomation(
  automation: readonly GainKeyframe[],
  previous: MusicLevels,
  next: MusicLevels,
): AutomationRescale;
```

Regla: `span = previous.baseGainDb − previous.duckedGainDb`.
- `span === 0` → `{ automation: [...automation], rescaled: false }` y la UI advierte que la curva no
  pudo seguir al cambio porque los dos niveles eran iguales. No se inventa una asignación.
- si no, por keyframe, **preservando `frame` sin tocarlo**:
  `t = (gainDb − previous.duckedGainDb) / span` y
  `gainDb' = next.duckedGainDb + t · (next.baseGainDb − next.duckedGainDb)`.

**Divergencia declarada respecto de la letra de CA-210:** el CA dice "reescribe el `gainDb` de cada
keyframe que coincidía con el valor anterior de ese nivel". La reescala es un **superconjunto** de esa
regla (los keyframes en `base_old` tienen `t = 1` y los de `ducked_old`, `t = 0`) y además arregla los
keyframes de la **cola de release**, que `planDucking` emite como
`ducked + (base − ducked)·ratio` y que la regla literal del CA dejaría con el valor viejo, produciendo
una curva discontinua. Verificado en el documento real: `smoke-ingest` tiene 3 keyframes
(`-24`, `-24`, `-12`); un proyecto con varios valles tiene keyframes de cola.

**El test la protege contra el productor real** (lección vigente):
`planDucking(ranges, { …DEFAULT_MUSIC_MIX, baseGainDb: A, duckedGainDb: B }, 30)` y el mismo llamado con
`A'`/`B'`; entonces `rescaleMusicAutomation(planA.automation, {A,B}, {A',B'}).automation` tiene que ser
igual a `planB.automation`, keyframe a keyframe (`frame` exacto, `gainDb` con `toBeCloseTo(…, 9)`).
Los rangos de voz de la fixture usan al menos **dos valles**, para que haya keyframes de cola y el test
distinga la reescala de la regla literal.

Ambos niveles se aplican en **una sola pasada contra los valores previos**: si `base` y `ducked` se
cambian a la vez, jamás se usa el valor ya actualizado como origen.

### 5.6 Reducer

```ts
// src/api/timeline-edit/timeline-edit-state.ts
export type TimelineEditAction =
  | { type: 'clip-trim-start'; track: 'aroll' | 'broll'; clipId: string; trimStartMs: number }
  | { type: 'clip-duration';   track: 'aroll' | 'broll'; clipId: string; durationFrames: number }
  | { type: 'aroll-move';      clipId: string; toIndex: number }
  | { type: 'caption-word-text'; clipId: string; wordIndex: number; text: string }
  | { type: 'music-levels';    baseGainDb: number; duckedGainDb: number }
  | { type: 'output-preset';   preset: OutputPreset }
  | { type: 'saved';           timeline: Timeline }
  | { type: 'reset' };

export type TimelineEditState = {
  saved: Timeline;
  draft: Timeline;
  dirty: boolean;
  rejections: readonly TimelineEditRejection[];
  issues: readonly TimelineIssue[];
};

export function initialTimelineEditState(timeline: Timeline): TimelineEditState;
export function timelineEditReducer(state: TimelineEditState, action: TimelineEditAction): TimelineEditState;
export function canSaveTimeline(state: TimelineEditState): boolean;
export function canStartRender(state: TimelineEditState): boolean;
```

Invariantes del reducer, todos verificables sin renderizar nada:

1. **Nunca lanza.** Una acción rechazada por la capa 1 devuelve el estado con `draft` **sin cambios** y
   la `TimelineEditRejection` en `rejections` (CA-202, CA-207 — "sin emitir ningún request" se prueba
   por el draft intacto más la ausencia de llamadas al cliente).
2. Toda acción aceptada produce `draft` = el documento **completo** (nunca un parche), pasa por
   `relayoutArollTrack` cuando corresponde, y recalcula
   `dirty = !timelineDocumentsEqual(draft, saved)` e `issues = validateTimeline(draft)`.
3. `canSaveTimeline` = `dirty && rejections.length === 0 && !issues.some(i => issueSeverity(i.code) === 'save-blocking')`.
4. `canStartRender` = `!dirty && issues.length === 0`.
5. `{ type: 'saved' }` reemplaza `saved` **y** `draft` por el documento confirmado y limpia
   `rejections`; `{ type: 'reset' }` vuelve `draft` a `saved`.
6. **Un error de guardado no toca el estado**: el reducer no tiene acción de error. Es la condición
   estructural de CA-219 — la edición local no se puede perder porque nada la borra.

### 5.7 Guardado (EP-008)

```ts
// src/api/render-api-client.ts
putTimeline: (slug: string, timeline: Timeline) => Promise<TimelineWriteResult>;
// src/api/render-api-types.ts
export type TimelineWriteResult = { slug: string; path: string };
```

`PUT /api/projects/<slug>/timeline`, `content-type: application/json`, cuerpo
`JSON.stringify(timeline)` — **un único request con el documento completo** (CA-216). Guard de
respuesta: `isRecord(body) && typeof body['slug'] === 'string' && typeof body['path'] === 'string'`,
igual patrón que los siete endpoints ya implementados.

Mapa de errores (todos ya los produce `fromErrorResponse`, se muestran con `ErrorNotice`, que ya
imprime `code` + `message` + detalles):

| Status | `code` | UI |
| --- | --- | --- |
| 400 | `REQUEST_BODY_INVALID_JSON` | `code` tal cual; draft intacto (CA-219) |
| 404 | `PROJECT_NOT_FOUND` | idem |
| 413 | `REQUEST_BODY_TOO_LARGE` | idem |
| 422 | `TIMELINE_INVALID` / `PROJECT_SLUG_INVALID` | idem; **nada se escribió del lado del servidor** — el handler valida antes de resolver el proyecto y antes de invocar el puerto de escritura (H-1), así que reintentar es seguro y el documento en disco sigue siendo el anterior (CA-218) |

Se dispara con `useApiAction`, que **nunca lanza**: `run()` devuelve `null` en caso de fallo y deja el
`RenderApiError` en `error`. Con `200`, la página despacha `{ type: 'saved', timeline: draft }`.

**CA-217 no se cierra con la respuesta HTTP**: se cierra leyendo `work/timeline.json` del
`RENDER_API_MEDIA_ROOT` temporal en el smoke E2E (§7).

---

## 6. Contrato de jobs y polling

### 6.1 Tipos, declarados en `apps/web` (D-5)

`apps/web` no puede importar de `apps/render-api`. Se declaran acá, **como listas propias `as const` +
type guards en la frontera** (lección vigente: nunca copiar un union de otra lib sin estrechar en la
frontera). Son un **par declarado** con `apps/render-api/src/jobs/render-job.ts` y
`apps/render-api/src/errors/render-api-error.ts`, igual que `asset-media-kind.ts` ↔ `content-type-for.ts`;
queda escrito en el fragmento de constitución.

```ts
// src/api/render-api-types.ts (aditivo)
export const RENDER_JOB_STATES = ['queued','running','canceling','succeeded','failed','canceled'] as const;
export type RenderJobState = (typeof RENDER_JOB_STATES)[number];
export const TERMINAL_RENDER_JOB_STATES = ['succeeded','failed','canceled'] as const;
export const RENDER_PIPELINE_STAGES = ['prepare','render','mix','mux','verify'] as const;
export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export type RenderJobProgress = {
  stage: RenderPipelineStage;
  renderedFrames: number | null;
  totalFrames: number | null;
  percent: number | null;
};
export type RenderDeliverableReport = { resource: string; width: number; height: number; fps: number; durationInFrames: number };
export type RenderIntermediatesReport = { mutedVideoResource: string; masterAudioResource: string };
export type RenderLoudnessReport = { withinTolerance: boolean; integratedLufs: number; truePeakDbtp: number; integratedDeltaLu: number; truePeakDeltaDb: number };
export type RenderPipelineReport = {
  renderId: string; startedAt: string; finishedAt: string;
  deliverable: RenderDeliverableReport;
  intermediates: RenderIntermediatesReport;
  loudness: RenderLoudnessReport;
};
export type RenderJob = {
  id: string; slug: string; state: RenderJobState;
  createdAt: string; startedAt: string | null; finishedAt: string | null;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
  error: RenderApiErrorPayload | null;
};
export type RenderJobSummary = {
  id: string; state: RenderJobState; stage: RenderPipelineStage | null;
  errorCode: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null;
};
export type RenderJobListing = { slug: string; jobs: RenderJobSummary[] };
```

```ts
// src/api/parse-render-job.ts
export function isRenderJobState(value: unknown): value is RenderJobState;
export function isRenderPipelineStage(value: unknown): value is RenderPipelineStage;
export function isTerminalRenderJobState(state: RenderJobState): boolean;
export function showsFrameProgress(progress: RenderJobProgress | null): progress is RenderJobProgress & { stage: 'render' };
export function parseRenderJob(value: unknown): RenderJob;          // lanza responseShapeUnexpected(200, 'a render job document')
export function parseRenderJobListing(value: unknown): RenderJobListing;
```

`showsFrameProgress` es el **emisor** de la decisión de CA-226: `progress !== null && progress.stage === 'render'`.
Ningún componente vuelve a comparar `'render'` con una cadena.

### 6.2 Cliente

```ts
createRenderJob: (slug: string) => Promise<RenderJob>;                      // POST, sin cuerpo, 202
listRenderJobs:  (slug: string) => Promise<RenderJobListing>;               // GET  /projects/:slug/jobs
getRenderJob:    (jobId: string) => Promise<RenderJob>;                     // GET  /jobs/:jobId
cancelRenderJob: (jobId: string) => Promise<RenderJobCancelOutcome>;        // DELETE /jobs/:jobId
export type RenderJobCancelOutcome = { status: 200 | 202; job: RenderJob };
```

- `createRenderJob` emite `POST /api/projects/<slug>/jobs` **sin cuerpo y sin `content-type`**: EP-012
  declara que un payload, si se manda, no se lee. Mandar un `{}` sería ruido en el contrato.
- `cancelRenderJob` es el único que necesita el status literal (CA-229 vs CA-230): se agrega un
  `requestJsonWithStatus` al lado del `requestJson` existente, sin tocar los siete llamadores actuales.
  El componente decide por `outcome.job.state`; el `status` existe para que el spec del cliente pueda
  asegurar el mapeo `200 → canceled` / `202 → canceling` que el CA nombra.
- `state: 'failed'` llega en un **200** con `error` embebido: `parseRenderJob` lo devuelve como job
  normal y **nunca** lo convierte en excepción (CA-227). Un `RenderApiError` desde el polling significa
  siempre un problema de transporte o un 404, jamás un job fallido.
- `404 RENDER_JOB_NOT_FOUND`, `409 RENDER_JOB_NOT_CANCELABLE`, `422 PROJECT_SLUG_INVALID`,
  `404 PROJECT_NOT_FOUND` / `404 TIMELINE_NOT_FOUND` / `422 TIMELINE_INVALID` de EP-012 salen por el
  `fromErrorResponse` que ya existe, con su `code` intacto.

### 6.3 Polling

```ts
// src/api/render-job-poll-plan.ts
export const RENDER_JOB_POLL_INTERVAL_MS = 1000;
export const RENDER_JOB_POLL_TRANSPORT_RETRY_LIMIT = 3;

export type PollOutcome = { kind: 'job'; job: RenderJob } | { kind: 'error'; error: RenderApiError };
export type PollStopReason = 'terminal' | 'not-found' | 'unreachable';
export type PollPlan = { keepPolling: true } | { keepPolling: false; reason: PollStopReason };

export function nextPollPlan(outcome: PollOutcome, consecutiveTransportFailures: number): PollPlan;
```

```ts
// src/hooks/use-render-job-poll.ts
export type RenderJobPoll = {
  job: RenderJob | null;
  error: RenderApiError | null;
  polling: boolean;
  stopReason: PollStopReason | null;
};
export function useRenderJobPoll(
  jobId: string | null,
  load: (jobId: string) => Promise<RenderJob>,
): RenderJobPoll;
```

**Intervalo: 1000 ms fijo, mientras el job no esté en estado terminal.** Fundamento:

- EP-014 es *"an in-memory Map read, never a filesystem access"* sobre loopback: el costo por tick es
  irrelevante.
- El render de referencia son 538 frames; `cycle-02` observó `renderedFrames 446/538` a mitad de
  corrida. A ese ritmo, 1 s deja ver el contador avanzar en cada tick — más lento se ve congelado, más
  rápido no aporta información porque `mergeRenderProgress` es monótono.
- La transición `queued → running` se observa dentro del primer segundo, que es lo que CA-225 pide.

**Mecanismo: `setTimeout` que se re-agenda recién cuando la respuesta anterior se resolvió**, nunca
`setInterval`: con `setInterval`, una respuesta lenta apila requests contra el mismo id.

**Arranque:** cuando hay un `jobId` seleccionado (por el `202` de EP-012 o por un click en el listado)
y el último estado conocido no es terminal. **Corte** (`nextPollPlan`, función pura):

| Resultado del tick | Plan |
| --- | --- |
| job con `isTerminalRenderJobState(state)` (`succeeded`/`failed`/`canceled`) | parar, `reason: 'terminal'` |
| job en `queued`/`running`/**`canceling`** | seguir — `canceling` **no** es terminal (CA-230, H-8) |
| `RenderApiError` con `code === 'RENDER_JOB_NOT_FOUND'` | parar, `reason: 'not-found'`, mostrar el `code` (CA-228 — cola en memoria perdida por reinicio del servicio) |
| `RenderApiError` de transporte, `consecutiveTransportFailures + 1 < 3` | seguir, conservando el último job conocido |
| `RenderApiError` de transporte, tercera consecutiva | parar, `reason: 'unreachable'`, mostrar el `code` |
| cualquier otro `RenderApiError` (p. ej. `RESPONSE_SHAPE_UNEXPECTED`) | parar, `reason: 'unreachable'` |

El límite de 3 reintentos de transporte es una decisión del architect, no un CA: sin él, un servicio
caído deja un temporizador golpeando cada segundo para siempre. Se declara acá.

**Limpieza:** el `useEffect` cancela el temporizador pendiente al desmontar y al cambiar `jobId`, y
descarta la respuesta de un tick obsoleto con el mismo patrón de contador de secuencia de
`useAsyncResource`.

**Listado (EP-013):** `useAsyncResource(() => client.listRenderJobs(slug), \`jobs:${slug}\`)`, con
`reload()` disparado cuando el job seguido cambia de estado. Gracias a la enmienda de §3.3 la lista no
parpadea. Un proyecto sin jobs devuelve `{ slug, jobs: [] }` con 200 aunque el proyecto no exista en
disco — **no es un error** (CA-234).

### 6.4 Descarga (EP-011)

```ts
// src/api/render-job-artifact.ts
export function renderJobDeliverableUrl(slug: string, jobId: string): string; // artifactUrl(slug, `out/${jobId}.mp4`)
```

Es el **único** lugar del código que conoce el literal `out/<jobId>.mp4` (RNF-4, CA-236). El
componente sólo recibe una URL. El enlace de descarga se renderiza **únicamente** con
`job.state === 'succeeded'` (CA-237); en cualquier otro estado no existe en el DOM.
`report.deliverable.resource` del job trae exactamente ese mismo path — el spec de
`render-job-artifact.ts` asevera que la URL construida corresponde a ese `resource` para un job
`succeeded` de la fixture, que es la forma de que el par no se desincronice.

---

## 7. Smoke E2E (US-3-012) — forma del guion

`apps/web/e2e/studio-smoke.mjs`, ejecutable y **commiteado** (CA-246: un procedimiento documentado sin
ejecutar no cierra). Node puro + el Playwright cacheado en `~/.npm/_npx` con
`chromium.launch({ channel: 'chrome' })` + `node:fs` + `ffprobe`. No agrega ninguna dependencia npm ni
ningún target de Nx.

Secuencia obligatoria:

1. **Gate de memoria** (`pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` vacío, ≥ 35 % libre,
   `npx remotion browser ensure`) y **jamás dos renders a la vez**.
2. `RENDER_API_MEDIA_ROOT` **temporal** = copia de `media/smoke-ingest` en un directorio temporal
   (CA-241). Nunca `media/` del dev: el recorrido escribe `work/timeline.json`.
3. `render-api` y `vite` reales, con el proxy `/api` apuntado al servicio (guion de `cycle-02`).
4. Crear o abrir el proyecto (EP-003/EP-004) → biblioteca (EP-005) → preview (EP-007).
5. **Editar un campo de cada una de las cuatro historias** (CA-242) eligiendo ediciones que
   **preserven la validez** de `validateTimeline`:
   - US-3-001: acortar `durationFrames` de clips de a-roll. **Recomendación de costo:** acortarlos
     hasta dejar el timeline en ~90–150 frames; el render del paso 8 pasa de 538 frames a unos pocos
     segundos, sin dejar de ser un render real de punta a punta. El relayout de §5.2 recalcula `from`,
     `durationFrames`, espeja `voice` y clampa `music-0001`; sin eso el job falla con
     `INVALID_TIMELINE` por `CLIP_OUT_OF_TIMELINE`/`DURATION_MISMATCH`.
   - US-3-002: corregir el `text` de una palabra (`"Discarga"` y `"Abrimas"` de `smoke-ingest` son
     errores reales de transcripción).
   - US-3-003: cambiar `baseGainDb`/`duckedGainDb` y **verificar en el documento guardado que
     `audioMix.automation` cambió** (CA-210).
   - US-3-004: **cuidado** — pasar a `youtube-16x9` es válido sólo porque `applyOutputPreset` omite el
     `box` de los captions (§5.3). Si el ciclo prefiere no arriesgar el render del paso 8, elegir otro
     preset 9:16 (`tiktok-9x16`) y cubrir el caso 16:9 en el spec de `apply-output-preset.spec.ts`.
6. Guardar (EP-008) y **verificar leyendo `work/timeline.json` del media root temporal** (CA-217,
   CA-243), no la respuesta HTTP: comparar el texto del archivo contra
   `` `${JSON.stringify(TimelineSchema.parse(draftEsperado), null, 2)}\n` `` — que es exactamente lo que
   `write-timeline.spec.ts` pinnea del lado del productor.
7. Verificar que el disparo de render estaba deshabilitado **antes** de guardar (CA-221) y habilitado
   después.
8. Disparar (EP-012), observar **al menos una lectura real** de `renderedFrames`/`totalFrames` con
   `progress.stage === 'render'` (CA-244) y llegar a `succeeded`.
9. Descargar por EP-011 y verificar con `ffprobe` **contra el stream de video**
   (`nb_frames` / `r_frame_rate`), nunca `format.duration` (CA-245, lección vigente).
10. Capturas, guion literal y salidas de `ffprobe` en `cycles/cycle-03/artifacts/` (CA-246).

**Artefactos esperados en `cycles/cycle-03/artifacts/`:**
`studio-smoke.md` (guion + salidas), `frame-parity-8s.md` (los tres números de §4.4 + la corrida de
sensibilidad G-C), `render-non-regression.md` (sha256 de CA-239), y las capturas PNG del recorrido.

---

## 8. Registros SDD a actualizar (yo no los toco)

| Registro | Qué | Quién |
| --- | --- | --- |
| `sdd/api.json` | **Nada.** No hay endpoints nuevos y EP-007..EP-015 ya están `implemented`. No se agrega ni se modifica una sola entrada. | — |
| `sdd/schema.json` | **Nada.** No hay base de datos en este producto. | — |
| `sdd/components.json` → `apps/web` | Altas `COMP-014`..`COMP-025` para los diez componentes nuevos y los dos hooks nuevos, con su `consumes`: `RenderTrigger` → `EP-012`; `RenderJobList` → `EP-013`; `RenderJobPanel` → `EP-014`, `EP-015`, `EP-011`; `TimelineSaveBar` → `EP-008`. Actualización de `COMP-012 TimelinePlayer` y `COMP-013 ProjectPreviewPage` (`updated_in_cycle: 3`, `status: "updated"`, entrada de `changelog`); `COMP-013.consumes` suma `EP-008`, `EP-012`, `EP-013`, `EP-014`, `EP-015`. | el implementador, al cerrar cada task; lo valida el reviewer |
| `sdd/components.json` → `libs/composition-remotion` | `COMP-009 TimelineVideo`: `updated_in_cycle: 3`, `status: "updated"`, changelog `"player branch applies objectFit: fill as a default under the caller style (D-12); render branch unchanged"`. | el implementador de la task de D-12 |
| `sdd/context/apps/web/updates/2026-09-09-spec-e-burgos-006-web-studio-cycle-03.md` | Fragmento aditivo: resultado de D-3, el par declarado `render-api-types.ts` ↔ `render-job.ts`, el par `timeline-document` ↔ `serialize-montage-document`, la regla del chunk perezoso para `timeline-edit/**`. | quien cierra el ciclo (reviewer) |
| `sdd/context/libs/composition-remotion/updates/…cycle-03.md` | Fragmento aditivo: D-12, el orden del spread, y el `[FIX]` descopado de §4.2. | idem |
| `sdd/specs/…/cycles/cycle-03/cycle.json` | `metrics.usage.by_agent[]` con mi entrada; `status: "completed"` sólo por el reviewer. | orquestador / reviewer |

---

## 9. Lista cerrada de tests obligatorios por CA

Regla aplicada: **cada CA se traza al archivo que EMITE el valor que el CA nombra**, no al que nombra
la operación. Todo literal citado por un CA tiene el spec hermano de su archivo en esta lista. Esta
tabla es el checklist con el que el orquestador verifica el `files[]` de cada task: **una task no está
cerrada si su archivo de esta lista no está en su `files[]`.**

| # | CA | Archivo de test | Qué asevera |
| --- | --- | --- | --- |
| T-01 | CA-201 | `apps/web/src/components/clip-track-editor.spec.tsx` | Por clip hay exactamente dos controles editables (`trimStartMs`, `durationFrames`) y **cero** controles para `assetId`, `transform`, `fit`, `muted`; los botones de reordenar aparecen sólo con `track === 'aroll'` |
| T-02 | CA-202 | `apps/web/src/api/timeline-edit/timeline-edit-rules.spec.ts` | `rejectTrimStartMs` rechaza negativo y no entero, acepta 0 y enteros positivos; `rejectDurationFrames` rechaza 0, negativo y no entero, acepta 1 — mismos límites que `MsSchema` y `z.number().int().min(1)` |
| T-03 | CA-202 | `apps/web/src/api/timeline-edit/timeline-edit-state.spec.ts` | Una acción rechazada deja `draft` **idéntico por referencia de valor** (`timelineDocumentsEqual` con el previo) y agrega la `TimelineEditRejection`; el cliente falso no recibe ninguna llamada |
| T-04 | CA-203 | `apps/web/src/api/timeline-edit/aroll-layout.spec.ts` | `relayoutArollTrack` recalcula `from` **descontando** `transitionFramesBetween` (fixture con ≥1 transición), sin huecos ni solapes según `validateTimeline`, y recalcula `timeline.durationFrames`; `validateTimeline(resultado).ok === true` |
| T-05 | CA-203 / A-3 | `apps/web/src/api/timeline-edit/aroll-layout.spec.ts` | `mirrorVoiceFromAroll` copia `from`/`durationFrames`/`trimStartMs` de cada `aroll[i]` a `voice[i]` preservando `id` y `gainDb`; con longitudes distintas no espeja y emite `VOICE_TRACK_NOT_MIRRORED` |
| T-06 | CA-203 / A-4 | `apps/web/src/api/timeline-edit/aroll-layout.spec.ts` | `clampTracksToDuration` acorta `music`/`broll` que excedan el nuevo `durationFrames` y no toca los que entran |
| T-07 | CA-204 | `apps/web/src/pages/project-preview-page.spec.tsx` | Tras una acción de trim, el `TimelinePlayer` recibe el `draft` (no el `saved`) y el cliente falso **no** registró ningún request de escritura |
| T-08 | CA-205 | `apps/web/src/api/timeline-edit/issue-severity.spec.ts` | `issueSeverity('CLIP_EXCEEDS_ASSET') === 'render-blocking'` y `issueSeverity('SCHEMA_INVALID') === 'save-blocking'`; los diez códigos de `TimelineIssueCode` están cubiertos |
| T-09 | CA-205 | `apps/web/src/components/timeline-issue-list.spec.tsx` | Un `CLIP_EXCEEDS_ASSET` se pinta como advertencia (rol/atributo distinguible de `ErrorNotice`) con su `code`, `path` y `message`, y el botón de guardar sigue habilitado |
| T-10 | CA-206 | `apps/web/src/components/caption-editor.spec.tsx` | Un campo de texto por palabra existente; sin controles de `fromFrame`, `durationFrames`, `emphasisIndex`, `box`; sin acción de agregar ni de quitar palabras |
| T-11 | CA-207 | `apps/web/src/api/timeline-edit/timeline-edit-rules.spec.ts` | `rejectCaptionWordText('')` rechaza; `rejectCaptionWordText('a')` acepta; `rejectCaptionWordText(' ')` **acepta** (espejo exacto de `z.string().min(1)`) y queda como advertencia |
| T-12 | CA-208 | `apps/web/src/pages/project-preview-page.spec.tsx` | Editado el texto de una palabra, el `timeline` que llega al Player lo trae, sin request |
| T-13 | CA-209 | `apps/web/src/components/music-mix-editor.spec.tsx` | Exactamente dos controles (`baseGainDb`, `duckedGainDb`); cero controles para `attackMs`, `releaseMs`, `holdMs` y `audioMix.voice.*` |
| T-14 | CA-210 | `apps/web/src/api/timeline-edit/rescale-music-automation.spec.ts` | **Paridad contra el productor real:** `rescaleMusicAutomation(planDucking(ranges, {A,B}).automation, {A,B}, {A',B'})` es igual a `planDucking(ranges, {A',B'}).automation`, con ≥2 valles (para que haya keyframes de cola); `frame` exacto, `gainDb` con `toBeCloseTo(…, 9)`; `span === 0` devuelve `rescaled: false` sin tocar nada |
| T-15 | CA-210 | `apps/web/src/api/timeline-edit/timeline-edit-state.spec.ts` | `{ type: 'music-levels' }` cambia `audioMix.music.*` **y** `audioMix.automation`, aplicando los dos niveles contra los valores **previos** en una sola pasada |
| T-16 | CA-211 | `libs/composition-remotion/src/components/audio-track.spec.tsx` **(NUEVO)** | Emisor del `volume` real: `AudioTrack` pasa a `<Audio>` de música una función `volumeAtFrame(automation, frameInClip + clip.from)` y **no** `gainDbToVolume(music.baseGainDb)`; con `automation` vacía cae a `clip.volume`. Es el archivo que emite el valor que CA-211 mide en el navegador |
| T-17 | CA-212 | `apps/web/src/components/output-preset-selector.spec.tsx` | Los cuatro literales de `OutputPresetSchema` (`reels-9x16`, `tiktok-9x16`, `shorts-9x16`, `youtube-16x9`); sin campos libres de `width`/`height`/`fps` |
| T-18 | CA-213 / A-5 | `apps/web/src/api/timeline-edit/apply-output-preset.spec.ts` | `format` y `safeZone` cambian juntos (`defaultFormat` + `safeZoneFor`); **la clave `box` desaparece** de todos los captions (`'box' in clip === false`, no `box: undefined`); con `youtube-16x9` sobre la fixture, `validateTimeline(resultado).ok === true` (sin la omisión sería `CAPTION_OUT_OF_SAFE_ZONE`); mismo preset → mismo objeto |
| T-19 | CA-214 | `apps/web/src/pages/project-preview-page.spec.tsx` | Cambiado el preset persistido, `data-composition-width`/`data-composition-height` del contenedor del Player pasan a los del preset |
| T-20 | CA-215 | `apps/web/src/api/preview-format.spec.ts` (existente, regresión) | `PREVIEW_PRESETS` y `previewFormat` siguen intactos: dos presets, sin escritura |
| T-21 | CA-215 | `apps/web/src/pages/project-preview-page.spec.tsx` | Los dos selectores conviven con copy en inglés distinguible (`preview only — nothing is persisted` vs `output preset — saved with the timeline`) |
| T-22 | CA-216 | `apps/web/src/api/render-api-client.spec.ts` | `putTimeline` emite **un** `PUT` a `/api/projects/<slug>/timeline` con `content-type: application/json` y un cuerpo cuyo `JSON.parse` tiene `Object.keys(...).sort()` igual a las claves de `TimelineSchema`; nunca un PATCH ni varios requests |
| T-23 | CA-216 / CA-217 / A-6 | `apps/web/src/api/timeline-edit/timeline-document.spec.ts` | Un draft sin ediciones da `` `${JSON.stringify(TimelineSchema.parse(draft), null, 2)}\n` `` **carácter por carácter igual** al del documento cargado (par declarado con `write-timeline.spec.ts`); `timelineDocumentsEqual` es insensible al orden de claves de entrada y sensible a cualquier cambio de valor |
| T-24 | CA-218 | `apps/web/src/api/timeline-edit/timeline-edit-state.spec.ts` | `canSaveTimeline` es `false` con un issue `save-blocking` y `true` con uno `render-blocking` |
| T-25 | CA-218 / CA-219 | `apps/web/src/hooks/use-api-action.spec.ts` | `run()` **nunca lanza**: devuelve `null` y expone el `RenderApiError` con su `code` para `REQUEST_BODY_INVALID_JSON` (400), `PROJECT_NOT_FOUND` (404), `REQUEST_BODY_TOO_LARGE` (413) y `TIMELINE_INVALID` (422); `reset()` limpia el error |
| T-26 | CA-219 | `apps/web/src/pages/project-preview-page.spec.tsx` | Tras un fallo de guardado, el `draft` sigue teniendo la edición y `dirty` sigue en `true`; el `code` del servicio se muestra por `ErrorNotice` |
| T-27 | CA-220 | `apps/web/src/components/timeline-save-bar.spec.tsx` | Con cambios sin guardar el DOM expone `data-timeline-dirty="true"` y el texto de estado; sin cambios, `"false"` y el botón deshabilitado |
| T-28 | CA-221 | `apps/web/src/components/render-trigger.spec.tsx` | Deshabilitado con `dirty === true`, con la razón visible en el DOM; deshabilitado con issues `render-blocking` nombrando sus `code`; habilitado sólo con `canStartRender === true` |
| T-29 | CA-222 | `apps/web/src/api/render-api-client.spec.ts` | `createRenderJob` emite `POST /api/projects/<slug>/jobs` **sin `body` y sin `content-type`**, y devuelve el `RenderJob` del 202 |
| T-30 | CA-222 | `apps/web/src/components/render-trigger.spec.tsx` | Ante el 202, el `id` del job aparece en pantalla sin recarga |
| T-31 | CA-223 / CA-224 | `apps/web/src/components/render-trigger.spec.tsx` | `PROJECT_NOT_FOUND`, `TIMELINE_NOT_FOUND` y `TIMELINE_INVALID` de EP-012 se muestran con su `code`; en los tres casos no se agrega ninguna fila al listado |
| T-32 | CA-225 | `apps/web/src/hooks/use-render-job-poll.spec.ts` | Con `vi.useFakeTimers()`: un tick cada `RENDER_JOB_POLL_INTERVAL_MS`, re-agendado **después** de la respuesta; los seis estados de `RENDER_JOB_STATES` se reflejan; el temporizador se limpia al desmontar y al cambiar `jobId` |
| T-33 | CA-226 | `apps/web/src/api/parse-render-job.spec.ts` | `showsFrameProgress` es `true` sólo con `stage === 'render'`; `false` con `prepare`, `mix`, `mux`, `verify` y con `progress === null` |
| T-34 | CA-226 | `apps/web/src/components/render-job-panel.spec.tsx` | Con `stage === 'render'` se muestran `renderedFrames`/`totalFrames`/`percent`; con cualquier otra etapa **no aparece ningún conteo de frames** en el DOM |
| T-35 | CA-227 | `apps/web/src/api/parse-render-job.spec.ts` | Un cuerpo con `state: 'failed'` y `error` embebido **devuelve un `RenderJob`**, no lanza |
| T-36 | CA-227 | `apps/web/src/components/render-job-panel.spec.tsx` | `state: 'failed'` se pinta con `error.code`/`error.message` del job y **no** como error de red |
| T-37 | CA-228 / CA-230 | `apps/web/src/api/render-job-poll-plan.spec.ts` | `nextPollPlan` para: `succeeded`/`failed`/`canceled` → `terminal`; `RENDER_JOB_NOT_FOUND` → `not-found`; transporte < 3 → sigue; transporte = 3 → `unreachable`; **`canceling` → sigue** |
| T-38 | CA-228 | `apps/web/src/hooks/use-render-job-poll.spec.ts` | Tras un 404 no hay más ticks aunque avancen los timers, y `stopReason === 'not-found'` con el `code` expuesto |
| T-39 | CA-229 / CA-230 / CA-231 / CA-232 | `apps/web/src/api/render-api-client.spec.ts` | `cancelRenderJob` mapea `200 → { status: 200, job.state: 'canceled' }`, `202 → { status: 202, job.state: 'canceling' }`, un segundo `202` sobre `canceling` **no** es error, y `409` lanza `RenderApiError` con `code === 'RENDER_JOB_NOT_CANCELABLE'` |
| T-40 | CA-229 / CA-231 / CA-232 | `apps/web/src/components/render-job-panel.spec.tsx` | `canceled` detiene el polling y se muestra terminal; `canceling` sigue mostrándose no terminal; el `409` muestra su `code` **sin** alterar el estado mostrado del job |
| T-41 | CA-233 | `apps/web/src/api/render-api-client.spec.ts` | `listRenderJobs` devuelve entradas cuyo `Object.keys(job).sort()` es exactamente `['createdAt','errorCode','finishedAt','id','stage','startedAt','state']` — sin `report` ni `error` |
| T-42 | CA-233 / CA-235 | `apps/web/src/components/render-job-list.spec.tsx` | Cada fila muestra los siete campos y expone un enlace/acción que selecciona el job por su `id` |
| T-43 | CA-234 | `apps/web/src/components/render-job-list.spec.tsx` | `jobs: []` se pinta como lista vacía **sin** `ErrorNotice` |
| T-44 | CA-236 | `apps/web/src/api/render-job-artifact.spec.ts` | `renderJobDeliverableUrl(slug, jobId)` es `/api/projects/<slug>/files/out/<jobId>.mp4` y coincide con `report.deliverable.resource` de un job `succeeded` de la fixture; segmentos percent-encodeados por `artifactUrl` |
| T-45 | CA-236 | `apps/web/src/components/render-job-panel.spec.tsx` | El enlace de descarga usa esa URL y **ningún** componente construye la ruta a mano (`grep` de `out/` fuera de `src/api/` vacío, verificado en el spec del árbol o por el reviewer) |
| T-46 | CA-237 | `apps/web/src/components/render-job-panel.spec.tsx` | Sin `state === 'succeeded'` el enlace de descarga no está en el DOM |
| T-47 | CA-238 / D-12 | `libs/composition-remotion/src/components/timeline-video.spec.tsx` (existente, extender) | Rama `player` sin `objectFit` del llamador → el `<Video>` recibe `objectFit: 'fill'`; rama `player` con `objectFit: 'cover'`/`'contain'` (caso b-roll) → **gana el del llamador**; rama `render` → `Object.keys(style).sort()` del `<OffthreadVideo>` idéntico al `style` entrante (sin `objectFit`) |
| T-48 | CA-238 | `apps/web/src/components/timeline-player.spec.tsx` (existente, extender) | `initialFrame` llega al `<Player>` cuando se pasa y se omite cuando no; `controls={false}` apaga los controles; los cuatro `data-*` de diagnóstico siguen presentes |
| T-49 | CA-238 / CA-239 / CA-240 | `cycles/cycle-03/artifacts/frame-parity-8s.md` + `render-non-regression.md` | Los tres números de §4.4 medidos (antes, después, sensibilidad G-C), G-A y G-B evaluados, el `sha256` `c1b9fd9f…` reproducido, y el hallazgo de §4.2 escrito con su `[FIX]` |
| T-50 | — (contrato de D-3) | `apps/web/src/hooks/use-async-resource.spec.ts` (existente, extender) | La tabla de §3.3 completa: `reload()` con datos conserva `data` y pone `isRefreshing`; un fallo de refresh conserva `data` y expone `error` con `status: 'ready'`; la carga inicial fallida sigue dando `status: 'error'` |
| T-51 | — (fixture) | `apps/web/src/api/__fixtures__/editable-timeline.spec.ts` | La fixture está **generada con `buildTimeline`**, no escrita a mano, y cumple los invariantes que los demás tests asumen: `transitions.length >= 1`, `tracks.voice.length === tracks.aroll.length`, `audioMix.automation.length >= 3`, al menos un clip con `trimStartMs > 0` y otro con `from > 0`, y `validateTimeline(fixture).ok === true` |
| T-52 | CA-241..CA-246 | `apps/web/e2e/studio-smoke.mjs` + `cycles/cycle-03/artifacts/studio-smoke.md` | El recorrido de §7 ejecutado de verdad, con el `PUT` verificado contra el archivo en disco y el MP4 verificado con `ffprobe` contra el stream de video |

**52 tests obligatorios sobre 33 archivos** (29 archivos de spec — 23 nuevos y 6 extendidos —, 1 guion
E2E ejecutable y 3 artefactos de evidencia real). Ningún CA de CA-201..CA-246 queda sin fila.

---

## 10. Alcance descopado y escalado

| Qué | Por qué | Dónde sigue |
| --- | --- | --- |
| Cambiar el encuadre del **render** a `cover` | Cambia la salida binaria; prohibido por el brief y por CA-239 | `[FIX]` con el alcance ya escrito en §4.2 |
| Edición del EDL (EP-009/EP-010) | Descopado por el funcional con evidencia de código; el architect lo confirma: `buildTimeline` sólo se invoca desde `libs/auto-montage`, no desde `apps/render-api` | fuera de la spec |
| Reordenar b-roll | No cambia un pixel (H-7) | fuera del ciclo, anotado en el fragmento de contexto |
| `apps/web/eslint.config.mjs` | D-9 + hook `config-protection`. **Nada de este contrato lo necesita**: no hay import dinámico de libs del workspace ni regla de boundaries nueva | no aplica |
| `tsconfig.base.json` | Los `paths` de `timeline-core` y `composition-remotion` ya existen; no hace falta tocarlo | no aplica |
| Par `asset-media-kind.ts` / `content-type-for.ts` | Follow-up abierto de `cycle-02`, fuera del brief | sigue abierto |
| Progreso de upload, auth, undo/redo, timeline gráfica | `out_of_scope` del brief | fuera de la spec |

**Ninguna dependencia npm nueva se propone.** La única de `apps/web` sigue siendo
`@remotion/player@4.0.522`.

**Requiere aprobación del orquestador antes de implementar:** la restricción nueva de §5.4
(disparo de render deshabilitado con issues `render-blocking` de `validateTimeline`), por ser un
endurecimiento de US-3-006 que el funcional no escribió.

---

## 11. Riesgos abiertos para el planner y el implementador

1. **Orden de las tasks (lección: serializar la infraestructura compartida).** `timeline-edit/*`,
   `render-api-types.ts` + `parse-render-job.ts` y la fixture generada son infraestructura de las
   demás: van **antes** de cualquier componente. El `depends_on` sale de los imports de las firmas de
   §5 y §6, no del agrupamiento por historia: `project-preview-page.tsx` depende de **todo**;
   `render-job-panel` depende de `parse-render-job` y `render-job-artifact`; `timeline-save-bar`
   depende de `use-api-action` y `timeline-edit-state`.
2. **`initialFrame` con el Player pausado** puede no pintar el frame exacto. Salida documentada en
   §4.5; si se usa, la referencia se re-extrae del render con `ffmpeg -ss` y se anota en el artefacto.
3. **Dos renders reales en el ciclo** (no-regresión sobre `media/smoke-ingest` sin editar, y el del
   smoke E2E sobre el media root temporal editado). **Nunca simultáneos**, gate de memoria antes de
   cada uno. El `sha256` `c1b9fd9f…` aplica **sólo** al primero: el segundo renderiza un documento
   editado y tendrá otro hash, lo cual es correcto y hay que escribirlo para que nadie lo lea como
   regresión.
4. **Cobertura.** `coverage.include` es `src/**/*.{ts,tsx}` sin recortar, piso 80 % en los cuatro ejes.
   Los diez componentes nuevos entran al denominador: medir después de **cada** task, no al cerrar
   (lección: un piso que no incluye los archivos del ciclo no es evidencia de nada).
   En `libs/composition-remotion`, `audio-track.tsx` (T-16) hay que **agregarlo a `coverage.include`**
   de `libs/composition-remotion/vite.config.ts`, que hoy sólo lista `helpers/**`, `transitions/**`,
   `render.ts`, `timeline-video.tsx` y `video-backend.tsx`. Ese archivo **no** está protegido por el
   hook `config-protection`.
5. **`timeline-edit/**` no puede ser alcanzable desde el chunk inicial** (§2.1). Verificar con la
   salida de `vite build`: el chunk inicial no debe crecer más allá de los ~450 kB de `cycle-02` y no
   debe aparecer el aviso de "chunks larger than 500 kB".
6. **`vi.mock('remotion')`** en `libs/composition-remotion` necesita el factory
   `async () => { const { createElement } = await import('react'); … }` — está hoisteado y no puede
   cerrar sobre imports del módulo (patrón de `cycle-02`, aplicá lo mismo en `audio-track.spec.tsx`).
7. **Fixtures con al menos un valor distinto de cero por eje posicional** (`from`, `trimStartMs`,
   `toIndex`): T-51 lo exige explícitamente porque `f(0)` da 100 % de cobertura sin distinguir la
   fórmula correcta de casi ninguna incorrecta.
8. **El `<Player>` no aplica `loudnorm`.** Cambiar los niveles de música cambia lo que se escucha en el
   preview y la curva del render, pero el master del entregable sigue pasando por el `loudnorm` de
   `media-local`: el nivel absoluto del MP4 no va a coincidir con el del preview. Está escrito en
   pantalla desde `cycle-02`; no volver a "arreglarlo".
