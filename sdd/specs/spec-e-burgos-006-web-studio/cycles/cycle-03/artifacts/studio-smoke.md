# Smoke E2E — spec-e-burgos-006 cycle-03 (TASK-029 + TASK-030, US-3-012)

> Ejecutado el 2026-09-09 contra `apps/render-api` y `apps/web` reales, con un `RENDER_API_MEDIA_ROOT`
> **temporal** (copia de `media/smoke-ingest`, nunca `media/` del dev). Cubre `create/open → biblioteca
> → preview → editar → guardar`, verificado leyendo el archivo en disco. TASK-030 extiende el mismo
> guion con una segunda ronda de edición (acortar el resto del a-roll) → guardar → **render real** →
> progreso observado en vivo → `succeeded` → **descarga del MP4** → **`ffprobe`** contra sus streams
> de video y audio. Las dos primeras corridas del render (documentadas en "TASK-030 — historial de la
> corrida" más abajo) terminaron `succeeded` pero el guion crasheó *después* por dos bugs propios (no
> del producto), ya corregidos; la corrida final, con ambos corregidos, completó el guion entero de
> punta a punta (`exit code 0`) y es la que queda documentada como resultado del ciclo.

## Por qué un directorio temporal y no `media/`

El paso de guardado emite un `PUT /projects/:slug/timeline` real (EP-008), que **reescribe**
`work/timeline.json` del proyecto. Correr esto contra `media/smoke-ingest` habría editado el
proyecto de referencia del dev y, con él, la línea base de no-regresión de `render-non-regression.md`
(mismo archivo que TASK-028 acaba de reproducir). El guion copia `media/smoke-ingest` a un
directorio temporal (`fs.cp` con `recursive: true`) antes de arrancar el servicio, y apunta
`RENDER_API_MEDIA_ROOT` ahí. `media/` queda intacto: `git status --short media/` no mostró ninguna
línea después de la corrida.

## Por qué no se usó el MCP de Playwright

Igual que en `cycle-01`/`cycle-02`/TASK-028: las tools `mcp__…_playwright__*` de este arnés hablan
con un navegador real a través de la extensión **Playwright MCP Bridge**, no instalada en esta
máquina. El guion resuelve la librería Playwright en tiempo de ejecución (intenta `import('playwright')`
y, si falla, busca bajo `~/.npm/_npx/*/node_modules/playwright`) **sin agregar nada a
`package.json`**, y lanza el Chrome instalado con `chromium.launch({ channel: 'chrome' })`.

## El guion (commiteado, ejecutable tal cual)

`apps/web/e2e/studio-smoke.mjs` — corre con:

```bash
node apps/web/e2e/studio-smoke.mjs
```

Sin variables de entorno: el guion elige sus propios puertos (`4399` para `render-api`, `4207` para
`apps/web`, iguales a los de `cycle-02` porque `4310` lo puede ocupar `pnpm sdd:docs` en esta
máquina) y gestiona el ciclo de vida completo — copia el media root, levanta los dos servicios,
corre la verificación, y los apaga + borra el temporal al final, éxito o error (`try/finally`).

Estructura del guion, en el orden en que corre:

1. **Gate de memoria**: `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` (aborta si hay coincidencia)
   y `memory_pressure` informativo.
2. Copia `media/smoke-ingest` a un `mkdtemp` de `os.tmpdir()`.
3. Levanta `render-api` (`RENDER_API_MEDIA_ROOT` = el temporal) y espera `/health`.
4. Levanta `apps/web` con el proxy apuntado a ese `render-api` y espera que `EP-007` responda
   same-origin.
5. Playwright: proyectos (EP-002) → click en `smoke-ingest` → biblioteca de assets (EP-004/EP-005) →
   `open preview` → preview (EP-007).
6. Un campo de cada una de las cuatro historias (CA-242).
7. Verifica que el disparo de render está deshabilitado **antes** de guardar y habilitado
   **después** (CA-221).
8. Guarda (EP-008), espera `data-timeline-dirty="false"` en el DOM.
9. Lee `work/timeline.json` del media root temporal y compara contra los cuatro valores editados
   (CA-217/CA-243) — **no** contra la respuesta HTTP.
10. Limpieza: cierra el navegador, mata los dos procesos, borra el directorio temporal.

## Corrida real — salida completa

```
[0] memory gate
[assert] ok — no ffmpeg/whisper-cli/chrome-headless process alive (found: none)
[0] System-wide memory free percentage: 61%
[1] copying media/smoke-ingest into a temporary media root (never media/ itself)
[1] temp media root: /var/folders/lw/gy7lfk_52gq0fv1yvph2fb100000gn/T/studio-smoke-QjlOCN
[1] baseline read: aroll-0001.durationFrames=89, automation keyframes=3, format.preset=reels-9x16
[2] starting apps/render-api against the temporary media root
[render-api] {"event":"listening","host":"127.0.0.1","port":4399}
[2] render-api is healthy
[3] starting apps/web with its proxy pointed at render-api
[web]   VITE v8.2.2  ready in 608 ms
[web]   ➜  Local:   http://localhost:4207/
[3] web is up and the proxy reaches render-api (EP-007 reachable same-origin)
[4] opening the projects list (EP-002)
[4] opening the asset library (EP-004/EP-005)
[4] opening the preview / studio page (EP-007)
[5a] US-3-001: shortening the first a-roll clip
[5a] aroll-0001.durationFrames 89 -> 44
[5b] US-3-002: correcting one transcribed caption word
[5b] captions[0].words[0].text "Abrimas" -> "Ahora"
[5c] US-3-003: changing the persisted music levels
[5c] audioMix.music.baseGainDb -> -6, duckedGainDb -> -30
[5d] US-3-004: changing the persisted output preset to a same-aspect-ratio preset
[5d] format.preset -> tiktok-9x16 (same 9:16 aspect as reels-9x16, avoids caption safe-zone risk)
[6] checking the render trigger is disabled while there are unsaved changes (CA-221)
[assert] ok — Render button is disabled before saving
[6] saving the timeline (EP-008)
[assert] ok — Save button is enabled with unsaved changes and no blocking issues
[6] save confirmed in the UI: data-timeline-dirty="false"
[6] checking the render trigger is enabled again after a clean save (CA-221)
[assert] ok — Render button is enabled after saving with no blocking issues
[assert] ok — no response >= 400 from the app (saw: none)
[6] verifying the four edits landed on DISK, not just in the HTTP response (CA-217/CA-243)
[assert] ok — work/timeline.json has tracks.aroll[0].durationFrames === 44
[assert] ok — work/timeline.json has tracks.captions[0].words[0].text === "Ahora"
[assert] ok — work/timeline.json has audioMix.music.baseGainDb === -6 and duckedGainDb === -30
[assert] ok — work/timeline.json has audioMix.automation rewritten (CA-210), not left stale
[assert] ok — work/timeline.json has format.preset === "tiktok-9x16"
[done] TASK-029 scope complete: create/open -> library -> preview -> edit -> save, verified on disk
[cleanup] temp media root removed: /var/folders/lw/gy7lfk_52gq0fv1yvph2fb100000gn/T/studio-smoke-QjlOCN
```

Verificado tras la corrida: `pgrep -fl 'render-api/src/main.ts|vite.*apps/web'` sin salida (los dos
procesos hijos murieron con la limpieza) y `git status --short media/` sin ninguna línea (el
proyecto de referencia del dev no se tocó).

## Qué probó cada paso, con el dato real detrás

| Paso | Historia | Editado | Verificado **en el archivo**, no en la respuesta HTTP |
| --- | --- | --- | --- |
| 5a | US-3-001 | `Duration for aroll-0001`: 89 → 44 frames | `tracks.aroll[0].durationFrames === 44` |
| 5b | US-3-002 | `Word 1 of caption-0001`: `"Abrimas"` → `"Ahora"` | `tracks.captions[0].words[0].text === "Ahora"` |
| 5c | US-3-003 | `Base level (dB)` → `-6`, `Ducked level (dB)` → `-30` | `audioMix.music.{baseGainDb,duckedGainDb}` **y** `audioMix.automation` reescrita (distinta de la original, CA-210 — no sólo los dos niveles) |
| 5d | US-3-004 | `Output preset` → `tiktok-9x16` | `format.preset === "tiktok-9x16"` |

`tiktok-9x16` (no `youtube-16x9`) por la advertencia del architect en §7: pasar a 16:9 sólo es
válido porque `applyOutputPreset` omite el `box` de los captions; para no arriesgar nada en este
smoke se usó otro preset 9:16, que cambia el documento persistido sin tocar el `safeZone` de forma
que pueda invalidar ningún caption. El caso 16:9 real ya está cubierto por
`apply-output-preset.spec.ts` (T-18, TASK-011).

CA-221 quedó probado en las dos direcciones: el botón "Render" **deshabilitado** mientras había
cambios sin guardar (`dirty: true`), y **habilitado** de nuevo apenas el guardado confirmó
`data-timeline-dirty="false"` — sin ningún issue `render-blocking` generado por las cuatro
ediciones (todas eligieron valores válidos a propósito, como recomienda el architect en §7).

## Alcance de la verificación de bytes (decisión de este ciclo)

El architect describe para CA-217/CA-243 comparar el archivo contra
`` `${JSON.stringify(TimelineSchema.parse(draftEsperado), null, 2)}\n` ``. Ese contrato de
byte-identidad **ya está exhaustivamente probado a nivel unitario**:
`apps/web/src/api/timeline-edit/timeline-document.spec.ts` (T-23, TASK-007) prueba la fórmula
completa con claves reordenadas, y `libs/auto-montage/src/montage/write-timeline.spec.ts` la prueba
del lado del productor. Lo que el smoke E2E agrega, y que ningún test unitario puede probar, es que
la integración real (reducer → cliente HTTP → EP-008 → disco) efectivamente escribe los valores
editados en el archivo — por eso esta verificación compara **valores específicos**, no el documento
completo byte a byte. Es una decisión de alcance del ciclo, no un atajo: duplicar la prueba de
byte-identidad acá sería repetir TASK-007 sin agregar cobertura nueva.

## Capturas

- `studio-smoke-01-asset-library.png` — biblioteca de `smoke-ingest` recién abierta.
- `studio-smoke-02-preview-loaded.png` — preview cargado, sin ediciones.
- `studio-smoke-03-edited.png` — las cuatro ediciones aplicadas, antes de guardar.
- `studio-smoke-04-saved.png` — después de guardar, `data-timeline-dirty="false"`.

## Nota de portabilidad del guion

`resolvePlaywright()` no asume el hash de `~/.npm/_npx` de esta máquina en particular (sería frágil
para cualquier otro dev): intenta `import('playwright')` primero y, si no está disponible como
paquete normal, recorre **todos** los directorios de `~/.npm/_npx` buscando uno que tenga
`node_modules/playwright/index.mjs`. En esta corrida encontró
`~/.npm/_npx/705bc6b22212b352/node_modules/playwright` (el mismo que documentaron `cycle-01` y
`cycle-02`), pero el guion no depende de que sea exactamente ese hash.

---


# TASK-030 — render real, progreso, descarga y ffprobe

> Gate de memoria re-verificado por mí mismo antes de cada corrida (no delegado a lo que reportó el
> orquestador): `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'` sin coincidencias en las tres
> corridas, `memory_pressure` entre 52-61 % libre. Autorización final del orquestador: hasta un
> tercer render real (el segundo, `6fa1fab1…`, ya había terminado `succeeded` pero el guion crasheó
> *después* por dos bugs propios — ver "Historial de la corrida" abajo). Se usó exactamente ese
> tercer render — job `e782fdeb-89ee-446e-8795-96c3fba15b63` — y esta vez el guion completó todo el
> flujo de punta a punta (`exit code 0`). No hubo un cuarto render.

## Guion extendido, en el orden en que corre después del paso 10 de TASK-029

11. Acorta `aroll-0002`..`aroll-0006` (CA de costo de render del architect: apuntar a ~90-150
    frames totales). Objetivo elegido: 25/20/20/20/25 frames respectivamente, dejando margen sobre
    el mínimo que exige `rejectDurationAgainstTransitions` para los dos clips que tocan la
    transición `whip-pan` (`aroll-0004`/`aroll-0005`, mínimo 8 frames cada uno — 20 usado, con
    margen).
12. Guarda (EP-008) la segunda ronda, espera `data-timeline-dirty="false"`, lee
    `work/timeline.json` y confirma que `durationFrames` total cayó al rango objetivo.
13. Dispara el render (EP-012, click en "Render") interceptando la respuesta `POST
    /projects/:slug/jobs` para capturar el `id` del job real — no se infiere del DOM.
14. Poll directo contra `render-api` (`GET /jobs/:jobId`, EP-014) cada 150 ms hasta un estado
    terminal, guardando **el primer estado no-terminal observado** (para probar que el progreso se
    observó de verdad, no se infirió) y, cuando la etapa es `render`, `renderedFrames`/`totalFrames`.
15. Si el job termina en `failed`: cortar inmediatamente, reportar `error.code`, no reintentar más
    de una vez, no tocar el producto. (No ocurrió en ninguna de las tres corridas — las tres
    terminaron `succeeded`.)
16. Confirma `state === 'succeeded'`, intenta reflejarlo en el panel de la UI (best-effort, ver
    KNOWN-ISSUE-02 — nunca bloqueante), y saca captura.
17. Descarga el `.mp4` con `fetch` de Node directo contra `render-api` (nunca a través del
    navegador): `GET /projects/:slug/files/out/:jobId.mp4`, y lo guarda en `os.tmpdir()` — **fuera**
    del media root temporal, a propósito, para que el `finally` no pueda borrarlo antes del `ffprobe`.
18. `sha256` del archivo descargado — se espera que **difiera** del baseline de no-regresión de
    TASK-028 (`c1b9fd9f…`), porque este render es sobre el documento **editado**, no el original; no
    es una regresión (APR-03).
19. `ffprobe` contra el **stream de video** (`codec_name,width,height,r_frame_rate,nb_frames,pix_fmt`)
    y el **stream de audio** (`codec_name,sample_rate,channels,duration`) — nunca `format.duration`
    (lección ya registrada en `render-non-regression.md`, TASK-028).

## Historial de la corrida — tres intentos, dos bugs de guion encontrados y corregidos

**Intento 1** (job `6fa1fab1-9dd9-430c-8cdc-a6f8fc83079a`): el render terminó `succeeded` con
progreso real observado (`renderedFrames` `0/147 → 147/147`, luego `mix → mux → verify`), pero el
guion crasheó justo después, en el intento de reflejar `state: succeeded` en el panel de la UI
(`page.waitForFunction` — nunca llegó a la descarga). El `finally` corrió igual (por diseño, para no
dejar procesos/directorios huérfanos) y se llevó el `.mp4` renderizado antes de poder aplicar ningún
fix. Encontré ahí dos bugs propios del guion:

1. **Bug de guion — argumentos de `waitForFunction`**: las tres llamadas a
   `page.waitForFunction(fn, { timeout })` pasaban las opciones como el segundo argumento
   posicional (`arg` en la firma real de Playwright, que es `(pageFunction, arg, options)`), no
   como el tercero — el timeout pedido nunca se aplicaba (corrían con el default de 30 s). Corregido
   pasando `undefined` explícito como `arg`.
2. **KNOWN-ISSUE-02 (hallazgo de herramienta, no del producto)** — el servidor de desarrollo de Vite
   dispara un `full-reload` del `index.html` una vez que termina de optimizar dependencias (visible
   en el log como `[vite] (client) page reload index.html`), y en el intento 1 cayó **durante** el
   poll del render. Un reload real del navegador borra todo el estado de React, incluido el
   `selectedJobId` que conecta `RenderJobList` → `RenderJobPanel` — por eso el panel nunca llegó a
   mostrar `state: succeeded` en el DOM. Se mantiene documentado porque le ahorra horas a quien lo
   pise de nuevo. El guion ya no depende de que la UI lo refleje: la confirmación de éxito real
   siempre fue el poll directo contra `render-api` (EP-014), y el paso de UI ahora es *best-effort*
   (reintenta refrescando el listado y re-seleccionando el job por su id; si aun así no se refleja,
   continúa igual, sin bloquear la descarga ni el `ffprobe`).

También en el intento 1 diagnostiqué, con un `MutationObserver` + listener de respuestas HTTP (ambos
temporales, removidos del guion final), un **bug real del producto** que había estado enmascarado
hasta ahora:

3. **`useApiAction` no se recuperaba de React 18 StrictMode** (`apps/web/src/hooks/use-api-action.ts`).
   El hook sólo actualiza su `status` a `'ok'`/`'error'` si `mountedRef.current` sigue en `true`, pero
   el efecto que lo maneja sólo tenía un cleanup (`() => { mountedRef.current = false; }`) y nunca
   volvía a poner el ref en `true` en el cuerpo del efecto. Bajo el doble-invoke de efectos que
   StrictMode hace en desarrollo (activo en `apps/web/src/main.tsx`), el mount real deja
   `mountedRef.current` permanentemente en `false` — el botón "Save" quedaba trabado en
   "Saving…"/disabled para siempre después del **primer** guardado exitoso de la sesión (el
   `dispatch({type:'saved'})` sí ocurría, porque no depende de `mountedRef`, pero el botón nunca
   volvía a mostrar "Save"). **No afecta producción** (el doble-invoke de efectos es exclusivo del
   modo desarrollo de React), pero bloqueaba la segunda ronda de guardado de este mismo guion. Lo
   había esquivado en un primer momento con un `page.reload()` antes de la segunda ronda — un
   workaround que el orquestador pidió explícitamente quitar, porque enmascaraba el defecto real en
   la evidencia. Se corrigió el hook (ver "Fix de `useApiAction`" abajo) y el guion ya no hace ningún
   reload.

**Intento 2** (mismo job `6fa1fab1…`, re-verificado): confirmó que el bug 1 y KNOWN-ISSUE-02 eran
exactamente como se describieron arriba — el panel seguía sin reflejar `succeeded`, con el mismo
`[vite] page reload` en el log en el mismo punto.

**Intento 3, con los tres arreglos aplicados** (job `e782fdeb-89ee-446e-8795-96c3fba15b63`): completó
el guion entero, incluida la descarga y el `ffprobe`, con `exit code 0`. Es la corrida que queda
documentada como resultado final más abajo.

## Fix de `useApiAction` (`apps/web/src/hooks/use-api-action.ts`)

```diff
-  useEffect(
-    () => () => {
-      mountedRef.current = false;
-    },
-    [],
-  );
+  useEffect(() => {
+    mountedRef.current = true;
+    return () => {
+      mountedRef.current = false;
+    };
+  }, []);
```

Test de regresión agregado en `apps/web/src/hooks/use-api-action.spec.ts` (monta el hook envuelto en
`<StrictMode>`, corre una acción real y espera `status === 'ok'`) — confirmado que **falla** sin el
fix (`expected 'pending' to be 'ok'`, reproduciendo exactamente el síntoma observado en el intento 1)
y **pasa** con el fix. `useAsyncResource` y `useRenderJobPoll` no tienen este defecto: usan flags
locales por efecto (el patrón correcto), no un `useRef` compartido que un cleanup apaga sin que
ningún mount lo vuelva a encender.

## Corrida final — salida completa (intento 3, `exit code 0`)

```
[0] memory gate
[assert] ok — no ffmpeg/whisper-cli/chrome-headless process alive (found: none)
[0] System-wide memory free percentage: 53%
[1] copying media/smoke-ingest into a temporary media root (never media/ itself)
[1] temp media root: /var/folders/lw/gy7lfk_52gq0fv1yvph2fb100000gn/T/studio-smoke-RFZnUl
[1] baseline read: aroll-0001.durationFrames=89, automation keyframes=3, format.preset=reels-9x16
[2] starting apps/render-api against the temporary media root
[render-api] {"event":"listening","host":"127.0.0.1","port":4399}
[2] render-api is healthy
[3] starting apps/web with its proxy pointed at render-api
[web]   VITE v8.2.2  ready in 560 ms
[web]   ➜  Local:   http://localhost:4207/
[3] web is up and the proxy reaches render-api (EP-007 reachable same-origin)
[4] opening the projects list (EP-002)
[4] opening the asset library (EP-004/EP-005)
[4] opening the preview / studio page (EP-007)
[5a] US-3-001: shortening the first a-roll clip
[5a] aroll-0001.durationFrames 89 -> 44
[5b] US-3-002: correcting one transcribed caption word
[5b] captions[0].words[0].text "Abrimas" -> "Ahora"
[5c] US-3-003: changing the persisted music levels
[5c] audioMix.music.baseGainDb -> -6, duckedGainDb -> -30
[5d] US-3-004: changing the persisted output preset to a same-aspect-ratio preset
[5d] format.preset -> tiktok-9x16 (same 9:16 aspect as reels-9x16, avoids caption safe-zone risk)
[6] checking the render trigger is disabled while there are unsaved changes (CA-221)
[assert] ok — Render button is disabled before saving
[6] saving the timeline (EP-008)
[assert] ok — Save button is enabled with unsaved changes and no blocking issues
[6] save confirmed in the UI: data-timeline-dirty="false"
[6] checking the render trigger is enabled again after a clean save (CA-221)
[assert] ok — Render button is enabled after saving with no blocking issues
[assert] ok — no response >= 400 from the app (saw: none)
[6] verifying the four edits landed on DISK, not just in the HTTP response (CA-217/CA-243)
[assert] ok — work/timeline.json has tracks.aroll[0].durationFrames === 44
[assert] ok — work/timeline.json has tracks.captions[0].words[0].text === "Ahora"
[assert] ok — work/timeline.json has audioMix.music.baseGainDb === -6 and duckedGainDb === -30
[assert] ok — work/timeline.json has audioMix.automation rewritten (CA-210), not left stale
[assert] ok — work/timeline.json has format.preset === "tiktok-9x16"
[done] TASK-029 scope complete: create/open -> library -> preview -> edit -> save, verified on disk
[7a] US-3-001 (round 2): shortening the remaining a-roll clips to keep the render cheap (~90-150 frames)
[7a] aroll-0002.durationFrames 94 -> 25
[7a] aroll-0003.durationFrames 66 -> 20
[7a] aroll-0004.durationFrames 75 -> 20
[7a] aroll-0005.durationFrames 83 -> 20
[7a] aroll-0006.durationFrames 138 -> 25
[7b] saving the shortened timeline before triggering the render (EP-008)
[assert] ok — Save button is enabled after the second edit round
[7b] second save confirmed in the UI: data-timeline-dirty="false"
[7b] work/timeline.json durationFrames after shortening: 147
[assert] ok — timeline.durationFrames (147) is within the cheap-render target range (~90-150 frames, generous bounds)
[8] triggering the render (EP-012) and capturing the created job id from the network response
[assert] ok — Render button is enabled after the second clean save (CA-221)
[assert] ok — created render job has a string id (got: "e782fdeb-89ee-446e-8795-96c3fba15b63")
[8] render job created: e782fdeb-89ee-446e-8795-96c3fba15b63 (initial state=running, stage=prepare)
[9] polling the render job directly against render-api (EP-014) until a terminal state, capturing at least one intermediate snapshot
[assert] ok — GET /jobs/e782fdeb-89ee-446e-8795-96c3fba15b63 returned ok (status 200)
[9] state=running stage=render frames=—/—
[web] 5:44:19 AM [vite] (client) page reload index.html
... (poll cada 150ms, 45+ líneas omitidas por brevedad — la corrida completa quedó en el reporte
    al orquestador de este cierre de task) ...
[9] state=running stage=render frames=0/147
[9] state=running stage=render frames=3/147
[9] state=running stage=render frames=8/147
...
[9] state=running stage=render frames=144/147
[9] state=running stage=render frames=147/147
[9] state=running stage=mix frames=n/a
[9] state=running stage=mux frames=n/a
[9] state=running stage=verify frames=n/a
[9] state=succeeded stage=verify frames=n/a
[assert] ok — render job reached a terminal state before the 120s poll deadline
[assert] ok — a real intermediate (non-terminal) progress state was observed before completion (stage=prepare)
[assert] ok — render job e782fdeb-89ee-446e-8795-96c3fba15b63 ended in state "succeeded" (got: succeeded)
[9] render finished (confirmed via direct EP-014 polling). report.deliverable={"resource":"out/e782fdeb-89ee-446e-8795-96c3fba15b63.mp4","width":1080,"height":1920,"fps":30,"durationInFrames":147}
[9] the UI panel did not mirror the succeeded state within 8s (see KNOWN-ISSUE-02 above); re-selecting the job from the refreshed job list
[10] downloading the rendered MP4 directly via Node fetch (EP-011) — not the browser
[assert] ok — GET http://127.0.0.1:4399/projects/smoke-ingest/files/out/e782fdeb-89ee-446e-8795-96c3fba15b63.mp4 returned ok (status 200)
[10] downloaded 693824 bytes to /var/folders/.../T/studio-smoke-e782fdeb-89ee-446e-8795-96c3fba15b63.mp4 (outside the temp media root on purpose, so the finally cleanup below cannot delete this evidence before ffprobe runs)
[10] sha256(e782fdeb-89ee-446e-8795-96c3fba15b63.mp4) = 756005b2295666a4ba982689df563551e890f4cdf122d8169cf1764c161bf32e
[assert] ok — rendered file sha256 legitimately DIFFERS from the TASK-028 non-regression baseline — this render is on the EDITED document, not the unedited one, so a different hash is expected and is NOT a regression (APR-03)
[11] running ffprobe against the video and audio streams (never format.duration)
[11] video stream: {"codec_name":"h264","width":1080,"height":1920,"pix_fmt":"yuvj420p","r_frame_rate":"30/1","nb_frames":"147","side_data_list":[{}]}
[11] audio stream: {"codec_name":"aac","sample_rate":"48000","channels":2,"duration":"4.885333"}
[11] derived from the VIDEO stream (never format.duration): nb_frames=147, r_frame_rate=30/1 (30fps), duration=4.900s
[assert] ok — video stream has a codec_name
[assert] ok — video stream nb_frames (147) matches the edited timeline.durationFrames (147)
[assert] ok — audio stream has a codec_name
[assert] ok — audio stream has a positive sample_rate (48000)
[done] TASK-030 scope complete: shorten -> save -> render -> intermediate progress observed -> succeeded -> download -> ffprobe (video+audio streams)
[cleanup] temp media root removed: /var/folders/lw/gy7lfk_52gq0fv1yvph2fb100000gn/T/studio-smoke-RFZnUl
```

(Salida completa de las tres corridas, sin omitir líneas, incluida en el reporte al orquestador de
este cierre de task.)

## Qué probó el render real, con el dato detrás

| Comprobación | Resultado |
| --- | --- |
| Job real creado (EP-012) | `e782fdeb-89ee-446e-8795-96c3fba15b63`, capturado desde la respuesta de red del POST, no del DOM |
| Progreso observado en vivo, no inferido | Sí — 45+ snapshots de poll directo a `GET /jobs/:jobId`, incluida la etapa `render` con `renderedFrames`/`totalFrames` creciendo `0/147 → 147/147`, y luego `mix → mux → verify` |
| Estado terminal | `succeeded` |
| Costo del render | `timeline.durationFrames = 147` (dentro del rango ~90-150 recomendado por el architect por costo), vs. `538` de TASK-028 sin editar |
| `report.deliverable` | `{"resource":"out/<jobId>.mp4","width":1080,"height":1920,"fps":30,"durationInFrames":147}` — consistente con `tiktok-9x16` (elegido en TASK-029) |
| Descarga (EP-011) | 693824 bytes vía `fetch` de Node directo contra `render-api`, guardados fuera del media root temporal |
| `sha256` del entregable | `756005b2295666a4ba982689df563551e890f4cdf122d8169cf1764c161bf32e` — **distinto** del baseline `c1b9fd9f…` de TASK-028, **a propósito** (APR-03): este render es sobre el documento editado y acortado a 147 frames, no sobre `media/smoke-ingest` original. No es una regresión — es un entregable distinto por diseño. |
| `ffprobe`, stream de video (nunca `format.duration`) | `codec_name=h264`, `1080×1920`, `pix_fmt=yuvj420p`, `r_frame_rate=30/1`, `nb_frames=147` — coincide exactamente con `timeline.durationFrames` recién guardado. Duración derivada: `147/30 = 4.900 s` |
| `ffprobe`, stream de audio | `codec_name=aac`, `sample_rate=48000`, `channels=2`, `duration=4.885333` — consistente con el video (la pequeña diferencia frente a los 4.900 s del video es el padding de frame de AAC, la misma razón por la que la lección de `render-non-regression.md` prohíbe usar `format.duration`) |

## Verificación de limpieza tras la corrida final

```
$ pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|render-api|vite'
(sin coincidencias — sólo procesos de la extensión vitest-vscode del editor, no relacionados)
$ memory_pressure | tail -2
System-wide memory free percentage: 52%
$ git status --short media/
(sin salida — el proyecto de referencia del dev no se tocó)
```

El `.mp4` descargado a `os.tmpdir()` para la verificación (fuera del repo) se borró manualmente
después de correr el `ffprobe` de este documento — no es un artefacto que deba persistir; lo que
persiste es la evidencia escrita arriba (hash, streams, tamaño).

## Capturas (TASK-030)

- `studio-smoke-05-shortened.png` — segunda ronda de ediciones aplicada (a-roll acortado a ~147
  frames totales), antes del segundo guardado.
- `studio-smoke-06-render-started.png` — justo después de disparar el render (intento final,
  job `e782fdeb-89ee-446e-8795-96c3fba15b63`).
- `studio-smoke-07-render-succeeded.png` — después de la descarga, con el poll directo ya confirmado
  `succeeded` (la UI en sí no llegó a reflejarlo por KNOWN-ISSUE-02 — ver nota arriba).
