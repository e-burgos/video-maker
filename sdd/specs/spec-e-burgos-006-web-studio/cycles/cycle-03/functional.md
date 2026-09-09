# Functional — Cycle 3: Web Studio (`timeline-editing-and-render-jobs`)

> **Input:** sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/functional.md
> **Generado por:** sdd-functional
> **Cierra:** la spec `spec-e-burgos-006-web-studio` y el backlog del producto.

---

## Contexto de negocio

El dev ya puede abrir un proyecto, ver su biblioteca de assets y reproducir el montaje automático
en un `<Player>` de Remotion que muestra la `Timeline` real (`cycle-01`, `cycle-02`). Lo que
todavía no puede hacer desde el navegador es **corregir** ese montaje ni **producir** el
entregable: hoy, para ajustar un recorte, un texto de caption o el nivel de la música, tiene que
editar `work/timeline.json` a mano y disparar `tools/render-cli` por línea de comandos.

Este ciclo cierra ese hueco: expone en la UI el subconjunto de la `Timeline` persistida que aporta
valor real de edición (recortes y orden de escenas, texto de captions, volumen/ducking de música,
formato de salida), deja ver el efecto de cada cambio en el `<Player>` antes de guardarlo, permite
disparar un render, seguir su progreso y cancelarlo, y descargar el MP4 resultante. Cierra además
con un smoke de punta a punta que ejercita el producto completo — biblioteca, preview, edición,
render y descarga — sobre un servicio real, no sobre una suite mockeada.

**Lo que este ciclo explícitamente no hace:** no cambia un solo byte de lo que produce el render
(el pipeline de `apps/render-api`/`tools/render-cli`/`libs/composition-remotion` en su árbol
`render` queda intacto), no agrega undo/redo, no agrega autenticación ni multiusuario, y no
resuelve el progreso de upload de assets (ya señalado como pendiente en `cycle-02`).

## Alcance exacto de la edición

Todo campo no listado en esta tabla **no es editable** desde ninguna pantalla de este ciclo. La UI
edita una copia local del documento completo de la `Timeline` y lo reemplaza entero por
`PUT /projects/:slug/timeline` (EP-008) — nunca un campo aislado por separado.

| Área del documento | Campo(s) editable(s) | Campos del mismo bloque que **no** se editan | Fundamento |
| --- | --- | --- | --- |
| Escenas de video (`tracks.aroll[]`, `tracks.broll[]`) | `trimStartMs`, `durationFrames`; orden del clip dentro de su pista | `assetId`, `transform` (`scale`/`translateX`/`translateY`/`anchor`), `fit`, `muted` | El brief pide "recortes/orden de escenas": ajustar el punto de entrada, la duración y la secuencia. Cambiar el asset de un clip o su transform/`fit` es edición cinemática (posición, zoom, PiP) que no está en el mínimo del brief y necesitaría un selector de assets — riesgo y esfuerzo que este ciclo no justifica. |
| Captions (`tracks.captions[].words[]`) | `text` de cada palabra existente | `fromFrame`, `durationFrames`, `emphasisIndex`, `box`; agregar o quitar palabras de un caption | El brief pide "textos de captions": corregir lo que el reconocimiento de voz transcribió mal. Retocar el timing o el resaltado de impacto es una decisión de auto-montage (`spec-003`), no un defecto de transcripción. |
| Música (`audioMix.music`) | `baseGainDb`, `duckedGainDb` | `attackMs`, `releaseMs`, `holdMs`, todo `audioMix.voice.*` | El brief pide "volumen/ducking de música": los dos niveles que definen cuánto se escucha la música con y sin voz. La envolvente de ataque/liberación es afinación de mezcla, no un ajuste de nivel; el target de voz es un parámetro de medición, no de edición manual. |
| Formato (`format`, `safeZone`) | El preset (`OutputPresetSchema`: `reels-9x16`, `tiktok-9x16`, `shorts-9x16`, `youtube-16x9`) | `width`/`height`/`fps` como campos libres — salen del preset, nunca se escriben a mano | El brief pide "formato". `width`/`height`/`fps` sueltos podrían producir una combinación que ningún preset define; el preset ya trae los tres valores correctos y su `safeZone` correspondiente. |
| EDL (`work/edl.json`, EP-009/EP-010) | — ninguno — | todo el documento | Ver "Fuera de alcance" abajo. |

### Fuera de alcance (con fundamento)

- **Edición del EDL (EP-009/EP-010).** El brief autoriza cubrirla "en la medida en que aporte por
  encima de editar la Timeline". Medido en el código: `buildTimeline(edl, assets)` —la única
  función que convierte un `EditDecisionList` en una `Timeline`— se invoca exclusivamente desde
  `libs/auto-montage/src/auto-montage.ts` (el pipeline offline de `tools/render-cli`); `grep -rln
  "buildTimeline(" --include="*.ts"` sobre todo el repo no encuentra ninguna otra invocación, y en
  particular `apps/render-api` no la llama. Guardar un EDL editado por `EP-010` escribe
  `work/edl.json` pero **no** regenera `work/timeline.json`: ni el `<Player>` ni un render
  posterior verían el cambio hasta que alguien vuelva a correr `tools/render-cli` a mano fuera de
  esta app (que no toca el filesystem, RNF-4). Editar el EDL desde `apps/web` sería, hoy, una
  pantalla que escribe un archivo sin ningún efecto observable — cero valor y un costo de UI
  (necesitaría su propio editor de decisiones de corte, distinto en forma al de la Timeline) que
  no se justifica. **Se descopa por completo.**
- **Transform/`fit`/`assetId` de un clip de video.** Ver tabla arriba — cambia radicalmente el
  encuadre y el asset de una escena, que es composición, no corrección de timing.
  Fuera del mínimo de valor que declara el brief.
- **Timing y resaltado de captions, agregar/quitar palabras.** Ver tabla arriba.
- **Envolvente de ducking (`attackMs`/`releaseMs`/`holdMs`) y target de voz (`audioMix.voice.*`).**
  Ver tabla arriba.
- **`width`/`height`/`fps` sueltos del formato.** Ver tabla arriba.
- **Progreso de upload, autenticación, despliegue, multiusuario, undo/redo, edición por
  drag & drop sobre una línea de tiempo gráfica.** Excluidos explícitamente por el brief
  (`out_of_scope`), sin relación con los endpoints de este ciclo.
- **Cambiar la salida binaria del render** para alinear el encuadre preview/render (D-12): la
  salida del render es criterio de aceptación de no-regresión (ver US-3-011). Si la evidencia
  mostrara que el mal encuadrado está en el render, se documenta y se descopa a un `[FIX]`
  posterior — nunca se resuelve tocando el árbol `render` en este ciclo.

---

## Historias de usuario

### Eje 1 — Ajuste del timeline

#### US-3-001: Recortar y reordenar escenas de video

**Como** dev
**Quiero** ajustar el punto de entrada y la duración de cada escena de a-roll o b-roll, y cambiar
su orden dentro de la pista
**Para** corregir el timing del montaje automático sin editar `work/timeline.json` a mano

**Criterios de aceptación:**

- [ ] CA-201: Por cada clip de `tracks.aroll` y `tracks.broll`, la UI expone exactamente dos campos
  editables: `trimStartMs` y `durationFrames`. Ningún otro campo del clip (`assetId`, `transform`,
  `fit`, `muted`) tiene control de edición en esta historia.
- [ ] CA-202: El cliente rechaza, sin emitir ningún request, un `trimStartMs` negativo o no entero
  y un `durationFrames` menor a 1 o no entero — el mismo rango que `MsSchema`/`FrameSchema` de
  `@video-maker/timeline-core` exigen en el servidor.
- [ ] CA-203: Reordenar dos clips dentro de la misma pista recalcula el `from` de **todos** los
  clips de esa pista para que queden contiguos (`from[i+1] = from[i] + durationFrames[i]`, sin
  huecos ni solapes) — verificado leyendo los `from` resultantes tras el reordenamiento.
- [ ] CA-204: El `<Player>` refleja el recorte o el reordenamiento apenas se aplica en la UI, antes
  de cualquier `PUT` — verificado observando el frame/posición del Player cambiar sin que haya
  ocurrido un request de escritura.
- [ ] CA-205: Un `trimStartMs` + `durationFrames` (convertido a milisegundos según el `fps` del
  `format` vigente) que exceda el `durationMs` del asset referenciado (`assets[].durationMs`) no
  bloquea el guardado —el servidor no valida esa condición, sólo la forma del documento— pero la
  UI muestra una advertencia distinguible (no un error de guardado) explicando que esa combinación
  puede hacer fallar el render más adelante en vez de rechazarse ahora.

#### US-3-002: Editar el texto de los captions

**Como** dev
**Quiero** corregir el texto de una o más palabras de un caption cuando la transcripción se
equivocó
**Para** no tener que volver a grabar ni re-analizar el audio

**Criterios de aceptación:**

- [ ] CA-206: Por cada palabra (`CaptionClipWord`) de cada caption, la UI expone un campo de texto
  editable sobre `text`. `fromFrame`, `durationFrames`, `emphasisIndex` y `box` del caption no son
  editables desde esta historia, y no hay forma de agregar ni quitar palabras de un caption
  existente.
- [ ] CA-207: El cliente rechaza, sin emitir ningún request, un texto vacío para cualquier palabra
  — el mínimo de 1 carácter que exige `CaptionClipWordSchema.text` en el servidor.
- [ ] CA-208: El `<Player>` muestra el texto editado en el caption correspondiente apenas se aplica
  el cambio, antes de cualquier `PUT`.

#### US-3-003: Ajustar volumen y ducking de música

**Como** dev
**Quiero** subir o bajar el nivel general de la música y cuánto baja cuando hay voz encima
**Para** balancear la mezcla sin volver a correr el análisis de audio

**Criterios de aceptación:**

- [ ] CA-209: La UI expone exactamente dos campos editables: `audioMix.music.baseGainDb` (nivel sin
  voz) y `audioMix.music.duckedGainDb` (nivel durante voz). `attackMs`, `releaseMs`, `holdMs` y
  cualquier campo de `audioMix.voice` no tienen control de edición.
- [ ] CA-210: Cambiar `baseGainDb` o `duckedGainDb` reescribe el `gainDb` de cada keyframe de
  `audioMix.automation` que coincidía con el valor anterior de ese nivel, preservando el `frame` de
  cada keyframe sin tocarlo. **Fundamento medido:** ni el `<Player>` (`AudioTrack` lee
  `timeline.audioMix.automation`, no `music.baseGainDb`/`duckedGainDb`) ni el render
  (`buildAudioMixGraph`/`gain-automation-curve` de `libs/media-local`, misma fuente) consumen los
  campos de nivel para la curva real de ganancia: un cambio que sólo tocara `baseGainDb`/
  `duckedGainDb` sin reescribir `automation` sería inaudible tanto en preview como en el render.
  Verificado comparando `audioMix.automation` antes y después del cambio.
- [ ] CA-211: El `volume` del `<audio>` de música en el `<Player>` cambia al nuevo nivel apenas se
  aplica el cambio, antes de cualquier `PUT` — medido en el navegador (`volume === 10^(gainDb/20)`,
  mismo método que `preview-player-9x16.png` de `cycle-02`).

#### US-3-004: Cambiar el formato de salida persistido

**Como** dev
**Quiero** fijar el preset final del proyecto (vertical o horizontal, y su variante)
**Para** que el render salga en el formato correcto, sin depender del selector de sólo-preview de
`cycle-02`

**Criterios de aceptación:**

- [ ] CA-212: La UI expone un selector con los cuatro valores de `OutputPresetSchema`
  (`reels-9x16`, `tiktok-9x16`, `shorts-9x16`, `youtube-16x9`). `width`, `height` y `fps` no se
  editan como campos libres: salen del preset elegido.
- [ ] CA-213: Cambiar el preset actualiza `format` **y** `safeZone` juntos en el documento local —
  el mismo invariante que `previewFormat` de `cycle-02` (el `safeZone` de un preset 9:16 sobre un
  lienzo 16:9 deja los captions fuera de cuadro).
- [ ] CA-214: El `<Player>` recompone el lienzo al nuevo preset apenas se aplica el cambio, antes
  de cualquier `PUT` — mismo `data-composition-width`/`data-composition-height` que midió
  `cycle-02`.
- [ ] CA-215: Esta historia es la única forma de cambiar el formato que **persiste**. El selector
  de sólo-preview de `ProjectPreviewPage` (`cycle-02`, que nunca escribe) sigue existiendo sin
  cambios; si ambos controles conviven en la misma pantalla, su copy en inglés distingue
  explícitamente cuál es preview y cuál es guardado (D-7).

#### US-3-005: Guardar los cambios de la timeline

**Como** dev
**Quiero** aplicar de una vez todos los cambios que hice (recorte, captions, música, formato) al
documento persistido
**Para** que el próximo render los use

**Criterios de aceptación:**

- [ ] CA-216: Guardar emite exactamente un `PUT /projects/:slug/timeline` (EP-008) con el documento
  completo — todos los campos de `TimelineSchema`, incluidos los que esta sesión de edición no
  tocó — nunca un PATCH ni varios requests parciales por campo.
- [ ] CA-217: Un `200` de EP-008 se verifica leyendo `work/timeline.json` en disco después del
  guardado, no el cuerpo de la respuesta HTTP.
- [ ] CA-218: Para cualquiera de los campos editables de US-3-001..US-3-004, el cliente rechaza
  antes de emitir el PUT un documento que no pasaría `TimelineSchema` (`422 TIMELINE_INVALID`); si
  aun así el servidor lo rechaza, la UI muestra el `code` del servicio, no una excepción cruda ni
  el texto de `fetch` — precedente CA-007 de `cycle-01` con `PROJECT_SLUG_INVALID`.
- [ ] CA-219: Un `400 REQUEST_BODY_INVALID_JSON`, un `404 PROJECT_NOT_FOUND` y un
  `413 REQUEST_BODY_TOO_LARGE` de EP-008 se muestran con su `code` tal cual; en ninguno de los tres
  casos se pierde la edición local sin guardar — el dev puede reintentar sin haber perdido el
  cambio (precedente CA-009 de `cycle-01`: un error no descarta el estado local).
- [ ] CA-220: Mientras hay cambios locales sin guardar, la UI lo señala de forma verificable en el
  DOM (atributo o texto de estado distinguible), porque US-3-006 depende de poder detectarlo para
  bloquear el disparo de un render con cambios sin guardar.

### Eje 2 — Renders

#### US-3-006: Disparar un render

**Como** dev
**Quiero** lanzar un render del proyecto desde la UI
**Para** no depender de `tools/render-cli` por línea de comandos

**Criterios de aceptación:**

- [ ] CA-221: El disparo de render está deshabilitado (o bloqueado con aviso explícito) mientras
  haya cambios locales sin guardar (CA-220) — porque `POST /projects/:slug/jobs` (EP-012)
  snapshotea `work/timeline.json` del servidor al crear el job, nunca el estado en memoria del
  cliente; un render disparado con cambios sin guardar renderizaría una versión distinta de la que
  el dev ve editada en pantalla.
- [ ] CA-222: Disparar el render emite `POST /projects/:slug/jobs` (EP-012) sin cuerpo; ante el
  `202` la UI muestra el `id` del `RenderJob` devuelto sin recargar la página.
- [ ] CA-223: Un `404 PROJECT_NOT_FOUND` o un `404 TIMELINE_NOT_FOUND` de EP-012 se muestra con su
  `code`; en ninguno de los dos casos aparece un job nuevo en el listado de US-3-009.
- [ ] CA-224: Un `422 TIMELINE_INVALID` de EP-012 (el documento persistido no valida — por ejemplo
  si otra sesión lo dejó inválido después del guardado) se muestra con su `code`, distinguible del
  rechazo que la UI ya previene al guardar (US-3-005): éste ocurre sobre el documento ya
  persistido, no antes de guardar.

#### US-3-007: Seguir el progreso de un render

**Como** dev
**Quiero** ver en qué estado y con qué avance está mi render sin recargar la página
**Para** saber cuándo va a estar listo o si falló

**Criterios de aceptación:**

- [ ] CA-225: Mientras el job existe, la UI consulta `GET /jobs/:jobId` (EP-014) a intervalos
  (mecanismo de polling: decisión del architect) y refleja, sin recargar la página, cada uno de
  los seis estados posibles (`queued`, `running`, `canceling`, `succeeded`, `failed`, `canceled`).
- [ ] CA-226: Durante el estado `running`, la UI muestra la etapa actual (`progress.stage`: uno de
  `prepare`, `render`, `mix`, `mux`, `verify`) y, **sólo** cuando `progress.stage === 'render'`,
  el `renderedFrames`/`totalFrames`/`percent` que el job reporta. En cualquier otra etapa no
  inventa un conteo de frames.
- [ ] CA-227: El estado `failed` —que llega en un `200`, no como error HTTP— se muestra como fallo
  del job usando el `error.code`/`error.message` embebido en el body del `RenderJob`, nunca como un
  error de red o de la request de polling misma.
- [ ] CA-228: Un `404 RENDER_JOB_NOT_FOUND` de un poll (por ejemplo tras un reinicio del servicio
  que perdió la cola en memoria) se muestra con su `code` y detiene el polling de ese job — no
  reintenta indefinidamente contra un id que el servidor ya no conoce.

#### US-3-008: Cancelar un render

**Como** dev
**Quiero** cancelar un render que ya no necesito
**Para** liberar el único slot de render (concurrencia 1) para otro job

**Criterios de aceptación:**

- [ ] CA-229: Cancelar un job en `queued` emite `DELETE /jobs/:jobId` (EP-015); ante el
  `200 canceled` la UI lo muestra como terminal y detiene el polling de ese job.
- [ ] CA-230: Cancelar un job en `running` emite el mismo `DELETE`; ante el `202 canceling` la UI
  sigue mostrando `canceling` (no lo trata como terminal) hasta que un poll posterior de EP-014 lo
  confirme en `canceled`.
- [ ] CA-231: Repetir la cancelación sobre un job ya en `canceling` se acepta con `202` de nuevo
  (idempotente); la UI no lo muestra como error.
- [ ] CA-232: Cancelar un job ya terminal (`succeeded`, `failed` o `canceled`) devuelve
  `409 RENDER_JOB_NOT_CANCELABLE`; la UI lo muestra con su `code` y no altera el estado mostrado
  del job.

#### US-3-009: Ver el listado de renders del proyecto

**Como** dev
**Quiero** ver todos los renders que disparé para un proyecto
**Para** encontrar el que necesito sin recordar su id

**Criterios de aceptación:**

- [ ] CA-233: La pantalla de renders de un proyecto lista los jobs por `GET /projects/:slug/jobs`
  (EP-013) mostrando `id`, `state`, `stage`, `errorCode`, `createdAt`, `startedAt`, `finishedAt` —
  nunca el `report` ni el `error` completo, que sólo trae EP-014.
- [ ] CA-234: Un proyecto sin jobs muestra una lista vacía sin error, incluso si el proyecto no
  existe en disco (EP-013 no valida su existencia).
- [ ] CA-235: Cada fila del listado enlaza al detalle de seguimiento (US-3-007) del job por su
  `id`.

#### US-3-010: Descargar el MP4 de un render exitoso

**Como** dev
**Quiero** descargar el video que un render produjo
**Para** usarlo fuera del producto

**Criterios de aceptación:**

- [ ] CA-236: Cuando el job llega a `succeeded`, la UI ofrece la descarga del artefacto
  `out/<jobId>.mp4` resuelto por `GET /projects/:slug/files/*path` (EP-011), sin que ningún
  componente fuera de `src/api/` conozca esa ruta de disco (RNF-4).
- [ ] CA-237: El enlace/acción de descarga no aparece, o está deshabilitado, mientras el job no
  está en `succeeded`.

### Eje 3 — Encuadre preview vs render (D-12)

#### US-3-011: Confiar en que el preview muestra el encuadre real del render

**Como** dev
**Quiero** que lo que veo en el `<Player>` sea el mismo encuadre que va a salir en el MP4
**Para** no descubrir un mal encuadre recién al descargar el video

**Criterios de aceptación:**

- [ ] CA-238: Una captura del `<Player>` en el instante `t = 8 s` de la reproducción de
  `smoke-ingest` se compara contra `cycles/cycle-02/artifacts/render-frame-reference-8s.png` (el
  frame real del render en el mismo instante) con una medida numérica de diferencia; la métrica
  exacta y el umbral bajo el cual se considera equivalente los declara y registra `architect.md`
  con la evidencia — este documento fija el criterio observable de producto ("lo que el dev ve en
  el preview es lo que va a salir en el MP4"), no el mecanismo. El resultado medido (no asumido)
  queda en `cycles/cycle-03/artifacts/`.
- [ ] CA-239: La salida del render no cambia para lograr esto: el `sha256` de `video-muted.mp4`
  sobre `media/smoke-ingest` sigue siendo `c1b9fd9f…` (no-regresión, ver también CE de RF-3-009).
- [ ] CA-240: Si la medición muestra que el mal encuadrado está en el árbol `render` (y no en el
  preview), el hallazgo se documenta con evidencia y se descopa a un `[FIX]` posterior; el árbol
  `render` no se toca en este ciclo bajo ninguna circunstancia.

### Eje 4 — Cierre de la spec

#### US-3-012: Smoke E2E de punta a punta

**Como** dev
**Quiero** una prueba real de punta a punta que ejercite crear/abrir un proyecto, ver sus assets,
previsualizar, editar y guardar la timeline, lanzar un render, verlo progresar y descargar el MP4
**Para** confirmar que el producto completo funciona antes de cerrar la spec y el backlog

**Criterios de aceptación:**

- [ ] CA-241: El smoke corre con `apps/render-api` y `apps/web` reales (no mocks), contra un
  `RENDER_API_MEDIA_ROOT` temporal copiado de `media/smoke-ingest` — nunca contra `media/` del dev,
  porque el recorrido escribe `work/timeline.json` por EP-008.
- [ ] CA-242: El recorrido cubre, en orden y con evidencia (capturas + guion literal + salidas),
  crear o abrir un proyecto, listar sus assets, abrir el preview, editar al menos un campo de cada
  una de las cuatro historias de edición (US-3-001..US-3-004) y guardar los cambios.
- [ ] CA-243: El `PUT` de la edición (EP-008) se verifica leyendo `work/timeline.json` del
  `RENDER_API_MEDIA_ROOT` temporal después del guardado — nunca la respuesta HTTP (mismo criterio
  que CA-217, ejecutado de punta a punta).
- [ ] CA-244: Se dispara un render (EP-012) sobre el documento recién guardado, se observa progreso
  real (al menos una lectura de `renderedFrames`/`totalFrames` durante `progress.stage === 'render'`)
  y el job llega a `succeeded`.
- [ ] CA-245: El MP4 resultante se descarga por EP-011 y se verifica con `ffprobe` contra el
  stream de video (`nb_frames`/`r_frame_rate`), nunca contra `format.duration`.
- [ ] CA-246: Todas las capturas, el guion literal y las salidas de `ffprobe` quedan en
  `cycles/cycle-03/artifacts/`. Un criterio de este smoke que se documente como procedimiento pero
  no se haya ejecutado realmente no cierra el ciclo.

---

## Requisitos funcionales

### RF-3-001: Ajuste de escenas de video (trim y orden)

**Descripción:** la UI permite editar `trimStartMs` y `durationFrames` de cada clip de `aroll`/
`broll`, y reordenar clips dentro de su propia pista, sobre una copia local del documento que el
`<Player>` refleja antes de guardar.

**Reglas de negocio:**

- RN-1: sólo `trimStartMs` y `durationFrames` son editables por clip; `assetId`, `transform`,
  `fit` y `muted` quedan fuera (US-3-001).
- RN-2: reordenar recalcula el `from` de todos los clips de la pista afectada para que queden
  contiguos, sin huecos ni solapes (CA-203).
- RN-3: un recorte que excede la duración real del asset se advierte, no se bloquea — el servidor
  no lo valida y sólo se manifestaría como un job `failed` más adelante (CA-205).

**Casos de error:**

- CE-1: `trimStartMs` o `durationFrames` fuera de rango → el cliente rechaza antes de emitir
  ningún request (CA-202).

### RF-3-002: Edición de texto de captions

**Descripción:** la UI permite editar el `text` de cada palabra existente de un caption, reflejado
en el `<Player>` antes de guardar.

**Reglas de negocio:**

- RN-4: sólo `text` es editable por palabra; timing, `emphasisIndex` y `box` del caption, y
  agregar/quitar palabras, quedan fuera (US-3-002).

**Casos de error:**

- CE-2: un texto vacío para una palabra → el cliente rechaza antes de emitir ningún request
  (CA-207).

### RF-3-003: Ajuste de volumen y ducking de música

**Descripción:** la UI permite editar `audioMix.music.baseGainDb` y `audioMix.music.duckedGainDb`,
reescribiendo en consecuencia los keyframes de `audioMix.automation` para que el cambio sea
audible tanto en el `<Player>` como en un render posterior.

**Reglas de negocio:**

- RN-5: sólo `baseGainDb` y `duckedGainDb` son editables; la envolvente (`attackMs`/`releaseMs`/
  `holdMs`) y `audioMix.voice.*` quedan fuera (US-3-003).
- RN-6: cambiar un nivel reescribe **todos** los keyframes de `audioMix.automation` que tenían el
  valor anterior de ese nivel, preservando el `frame` de cada uno — tanto el `<Player>`
  (`AudioTrack`) como el render (`buildAudioMixGraph`/`gain-automation-curve`) leen `automation`,
  no los campos de nivel, para la curva real de ganancia (CA-210).

**Casos de error:**

- CE-3: ninguno propio de esta edición a nivel de cliente — el rango de `DbSchema` es cualquier
  número; el único rechazo posible es el genérico de guardado (RF-3-005).

### RF-3-004: Cambio de formato de salida persistido

**Descripción:** la UI permite fijar el preset de salida del proyecto (`format` completo +
`safeZone`), reflejado en el `<Player>` antes de guardar, distinto del selector de sólo-preview de
`cycle-02`.

**Reglas de negocio:**

- RN-7: el preset es la única unidad editable de `format`; `width`/`height`/`fps` no se editan
  sueltos (US-3-004).
- RN-8: cambiar el preset actualiza `format` y `safeZone` juntos (CA-213).
- RN-9: la copy distingue explícitamente el selector que persiste (esta historia) del selector de
  sólo-preview de `cycle-02` si ambos conviven en la misma pantalla (CA-215).

**Casos de error:**

- CE-4: ninguno propio — un preset de la enumeración cerrada siempre es válido; el rechazo posible
  es el genérico de guardado (RF-3-005).

### RF-3-005: Guardado del documento completo de la timeline

**Descripción:** un único `PUT /projects/:slug/timeline` (EP-008) con el documento completo
persiste de una vez todos los cambios de RF-3-001..RF-3-004, verificado contra el archivo en disco.

**Reglas de negocio:**

- RN-10: el guardado es siempre reemplazo completo del documento, byte-consistente con lo no
  editado en la sesión (CA-216).
- RN-11: mientras haya cambios sin guardar, la UI lo señala de forma verificable en el DOM
  (CA-220), precondición de RF-3-006.

**Casos de error:**

- CE-5: `400 REQUEST_BODY_INVALID_JSON` → se muestra el `code`; la edición local no se pierde
  (CA-219).
- CE-6: `404 PROJECT_NOT_FOUND` → se muestra el `code`; la edición local no se pierde (CA-219).
- CE-7: `413 REQUEST_BODY_TOO_LARGE` → se muestra el `code`; la edición local no se pierde
  (CA-219).
- CE-8: `422 TIMELINE_INVALID` (o `PROJECT_SLUG_INVALID`) → el cliente lo previene antes de
  emitir el request para los campos editables de este ciclo; si igual ocurre, se muestra el
  `code` del servicio (CA-218).

### RF-3-006: Disparo de render

**Descripción:** `POST /projects/:slug/jobs` (EP-012) crea un job sobre el documento ya persistido
en el servidor, nunca sobre el estado local sin guardar.

**Reglas de negocio:**

- RN-12: el disparo está bloqueado mientras haya cambios sin guardar (CA-221), porque EP-012
  snapshotea `work/timeline.json` al crear el job.

**Casos de error:**

- CE-9: `404 PROJECT_NOT_FOUND` / `404 TIMELINE_NOT_FOUND` → se muestra el `code`; no se registra
  ningún job (CA-223).
- CE-10: `422 TIMELINE_INVALID` sobre el documento ya persistido → se muestra el `code`,
  distinguible del rechazo de guardado (CA-224).

### RF-3-007: Seguimiento de progreso y cancelación de un render

**Descripción:** `GET /jobs/:jobId` (EP-014) alimenta el estado y el progreso mostrados; `DELETE
/jobs/:jobId` (EP-015) pide la cancelación.

**Reglas de negocio:**

- RN-13: los seis estados (`queued`, `running`, `canceling`, `succeeded`, `failed`, `canceled`) se
  reflejan sin recargar la página (CA-225).
- RN-14: `renderedFrames`/`totalFrames`/`percent` sólo se muestran cuando `progress.stage ===
  'render'` (CA-226).
- RN-15: `canceling` no se trata como terminal hasta que un poll posterior confirme `canceled`
  (CA-230).

**Casos de error:**

- CE-11: `failed` en un `200` → se muestra el `error` embebido del `RenderJob`, no un error de
  transporte (CA-227).
- CE-12: `404 RENDER_JOB_NOT_FOUND` en un poll → se muestra el `code` y se detiene el polling de
  ese job (CA-228).
- CE-13: `409 RENDER_JOB_NOT_CANCELABLE` al cancelar un job terminal → se muestra el `code`, el
  estado mostrado no cambia (CA-232).
- CE-14: repetir la cancelación de un job `canceling` → `202` de nuevo, nunca error (CA-231).

### RF-3-008: Listado y descarga de renders

**Descripción:** `GET /projects/:slug/jobs` (EP-013) lista los jobs del proyecto; el MP4 de un job
`succeeded` se descarga por `GET /projects/:slug/files/*path` (EP-011).

**Reglas de negocio:**

- RN-16: el listado usa sólo los campos de `RenderJobSummary` (CA-233).
- RN-17: la descarga sólo se ofrece para jobs en `succeeded` (CA-237).

**Casos de error:**

- CE-15: un proyecto sin jobs no es un error (CA-234).

### RF-3-009: Paridad de encuadre entre preview y render

**Descripción:** el criterio observable de producto es que el `<Player>` reproduzca el mismo
encuadre que el render produce, medido numéricamente contra un frame de referencia real del render,
sin cambiar la salida del render para lograrlo.

**Reglas de negocio:**

- RN-18: la salida del render (`sha256` de `video-muted.mp4` sobre `media/smoke-ingest`) no cambia
  en este ciclo (CA-239).
- RN-19: el mecanismo de alineación de encuadre es decisión del architect; este documento sólo fija
  el criterio observable y su medida numérica (CA-238).

**Casos de error:**

- CE-16: si el mal encuadrado resulta ser del render, se documenta y se descopa a un `[FIX]`
  posterior (CA-240).

### RF-3-010: Smoke E2E de cierre de la spec

**Descripción:** un recorrido real de punta a punta con `apps/render-api` y `apps/web` vivos que
ejercita biblioteca, preview, edición/guardado, render y descarga, cierra la spec.

**Reglas de negocio:**

- RN-20: corre sobre un `RENDER_API_MEDIA_ROOT` temporal copiado de `media/smoke-ingest`, nunca
  sobre `media/` del dev (CA-241).
- RN-21: el `PUT` se verifica contra el archivo en disco, la duración del MP4 se verifica con
  `ffprobe` contra el stream de video, nunca `format.duration` (CA-243, CA-245).
- RN-22: evidencia real y no procedimiento documentado sin ejecutar (CA-246).

**Casos de error:** no aplica — esta historia es el recorrido feliz completo; los casos de error de
cada paso ya están cubiertos por RF-3-001..RF-3-008.

---

## Trazabilidad

| Historia | Requisito funcional | Criterios de aceptación | Endpoints |
| --- | --- | --- | --- |
| US-3-001 | RF-3-001 | CA-201..CA-205 | EP-007, EP-008 |
| US-3-002 | RF-3-002 | CA-206..CA-208 | EP-007, EP-008 |
| US-3-003 | RF-3-003 | CA-209..CA-211 | EP-007, EP-008 |
| US-3-004 | RF-3-004 | CA-212..CA-215 | EP-007, EP-008 |
| US-3-005 | RF-3-005 | CA-216..CA-220 | EP-008 |
| US-3-006 | RF-3-006 | CA-221..CA-224 | EP-012 |
| US-3-007 | RF-3-007 | CA-225..CA-228 | EP-014 |
| US-3-008 | RF-3-007 | CA-229..CA-232 | EP-015 |
| US-3-009 | RF-3-008 | CA-233..CA-235 | EP-013 |
| US-3-010 | RF-3-008 | CA-236..CA-237 | EP-011 |
| US-3-011 | RF-3-009 | CA-238..CA-240 | — (medición visual) |
| US-3-012 | RF-3-010 | CA-241..CA-246 | EP-003/004/005, EP-007/008, EP-011..EP-015 |

Cada RF traza además a `sdd/specs/spec-e-burgos-006-web-studio/spec-e-burgos-006-web-studio.spec.md`
§ Resumen Ejecutivo, § Contexto de Negocio y la fila `cycle-03` del Plan de ciclos; el descope del
EDL traza a D-8/D-1 (contrato público que no cambia) y a la evidencia de código citada arriba.

## Requisitos no funcionales relevantes a este ciclo

Ya definidos en la spec (`RNF-1`..`RNF-6`); este ciclo no agrega ninguno nuevo, y en particular
depende de:

- **RNF-4** (`apps/web` no toca el filesystem ni conoce host/puerto): todas las historias de este
  documento son 100 % `fetch` contra `/api`, incluida la descarga del MP4 (EP-011).
- **RNF-5** (captura real de Playwright por ciclo, D-10): la evidencia de US-3-011 y el smoke de
  US-3-012 la satisfacen y la superan.
- **RNF-6** (sin comentarios, copy/identificadores en inglés): aplica a toda la UI nueva de este
  ciclo.

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Timeline | Documento persistido (`work/timeline.json`) que describe el montaje completo: pistas de video, audio, captions, transiciones, mezcla de audio y formato de salida. Fuente de verdad de lo que el render produce. |
| EDL (Edit Decision List) | Documento intermedio (`work/edl.json`) que el pipeline offline de `tools/render-cli` compila a una Timeline vía `buildTimeline`. No editable desde este ciclo (ver "Fuera de alcance"). |
| Trim | Recorte de un clip: su punto de entrada (`trimStartMs`) y su duración (`durationFrames`). |
| Ducking | Reducción automática del volumen de la música cuando hay voz encima, gobernada por `audioMix.automation` (curva de ganancia por frame) y descrita por `audioMix.music.baseGainDb`/`duckedGainDb`. |
| Job de render | Instancia en cola (`RenderJob`) que snapshotea la Timeline persistida al crearse y la procesa por etapas (`prepare`, `render`, `mix`, `mux`, `verify`) hasta un estado terminal. |
| Snapshot de la Timeline | El job de render usa la Timeline tal como estaba guardada al momento de `POST /jobs`; un `PUT` posterior no afecta a un job ya creado. |
| Encuadre | Cómo se recorta/ajusta el contenido de un clip dentro del lienzo del formato de salida (llenarlo vs. dejar bandas). Objeto del hallazgo D-12. |
