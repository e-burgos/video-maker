# QA exploratorio — Video Maker.app (desktop, macOS arm64)

Fecha: 2026-09-24 · App instalada en `/Applications/Video Maker.app`, `userData` real
(`~/Library/Application Support/Video Maker`), setup ya completado. Se condujo con CDP
(`--remote-debugging-port`) sobre el binario instalado, reutilizando los helpers de
`apps/desktop/e2e/packaged-app-smoke.mjs`. Proyecto de prueba `qa-exploratory` (creado,
usado y borrado durante la sesión, con limpieza final por API donde la UI no lo permitía).

No se tocó `media/` del repo. No se envió ningún mensaje al Productor ni se corrió el job de
Storyboard (evita gastar la suscripción de Claude del dev). Screenshots: `qa-*.png` en esta
misma carpeta.

## Bugs

| Severidad | Dónde | Pasos para reproducir | Esperado vs obtenido | Evidencia | Causa probable | Estado |
|---|---|---|---|---|---|---|
| **Alto** | Projects page — carpetas (folders) | Crear una carpeta nueva (o borrar el último video de una carpeta existente) sin que haya ningún video en toda la cuenta. Ir a `/`. | Esperado: la carpeta (con sus controles de renombrar/categoría/borrar) sigue visible para poder gestionarla. Obtenido: la página muestra solo el estado vacío genérico "No videos yet" y **oculta todas las carpetas**, aunque sigan existiendo en el backend (`GET /api/folders` las sigue devolviendo). La única forma de volver a verlas es crear un video cualquiera primero. | `qa-05-after-create-folder.png` (carpeta recién creada, invisible) vs `GET /api/folders` mostrando `qa-exploratory` y `DisplayAds` igual; confirmado de nuevo al borrar el último video (`qa-37`, ver texto). | `apps/web/src/pages/projects-page.tsx:98` — `ReadyProjects` corta con el empty-state genérico apenas `videos.length === 0`, sin mirar si hay carpetas. El filtro de `apps/web/src/pages/projects-page.tsx:66` también descarta buckets vacíos dentro de una carpeta ya renderizada. | Resuelto — `projects-page.tsx` ahora muestra siempre los grupos de `groupVideos()`; el estado vacío genérico sólo aparece si no hay videos NI carpetas. Test agregado en `projects-page.spec.tsx`. |
| **Alto** | Recuperación de crash durante un render | Con un render corriendo, matar el proceso principal con `SIGKILL` (crash real, no quit prolijo) y volver a abrir la app. | Esperado: los procesos hijos de ese render (headless Chromium de Remotion) mueren con el padre. Obtenido: quedan **4 procesos `chrome-headless-shell` huérfanos** corriendo indefinidamente (gpu-process, network utility, renderer, y el proceso principal), consumiendo CPU/RAM hasta que alguien los mate a mano o se reinicie la máquina. El quit prolijo (`osascript quit`, cubierto por el smoke test existente) sí limpia bien. | Verificado con `ps aux` antes/después del `pkill -9`. | `apps/desktop/src/main/render-api-process.ts:181` — el proceso de render-api se lanza con `detached: true`, lo que además de no heredar el `SIGKILL` del padre, lo saca del process group, dificultando cualquier limpieza futura por señal de grupo. No hay ningún watchdog/proceso supervisor que detecte y mate hijos húerfanos al arrancar. Nota: para un `SIGKILL` externo esto es una limitación conocida de Electron (no hay hook posible), pero el `detached: true` lo agrava y sería la palanca para mitigarlo (ligar el ciclo de vida del hijo al padre, o un chequeo de huérfanos al iniciar). | Resuelto y **verificado en real contra el `.dmg` instalado** (ver sección "Verificación real de huérfanos tras un hard kill" más abajo) — watchdog nuevo en render-api (`process/parent-watchdog.ts`) que pollea al pid padre cada 2s y mata su propio grupo + los `chrome-headless-shell` huérfanos (`process/kill-orphan-chrome.ts`, que no comparten grupo por el `detached: true` interno de Remotion/Puppeteer); del lado desktop, `render-api-pid-guard.ts` persiste el pgid en `render-api.pid` y mata cualquier proceso viejo de este mismo binario al iniciar. Se encontró y corrigió un segundo bug real durante esta verificación: cuando se mata `render-api` directamente (no la app), `chrome-headless-shell` quedaba huérfano porque su `ppid` se reparenta a `launchd` (pid 1) *antes* de que nadie pueda leerlo, así que el chequeo por `ppid` del lado desktop nunca encontraba nada que matar — se corrigió matando por **comando** (`chromeHeadlessShellPath`), no por `ppid`. También se encontró y corrigió un bug de orden: `dialog.showMessageBoxSync` (síncrono, bloqueante) se ejecutaba antes de que la limpieza asíncrona de chrome llegara a correr — se corrigió con un `await` explícito antes del diálogo. |
| **Medio** | Mezcla de idiomas — menú nativo de macOS | Con la app corriendo, mirar el menú de la barra de macOS. | Esperado: consistente en un idioma (o que seleccione es/en como el resto). Obtenido: **está mezclado incluso dentro del propio menú nativo**: "Preferencias" y "Carpeta de proyectos…" en español, pero "Help" y "Open logs folder" en inglés — y ninguno de los dos sigue el selector EN/ES de la UI web. | Reportado por agente de código (no reproducido visualmente porque el menú nativo no es parte de la página web y no es accesible por CDP). | `apps/desktop/src/main/main.ts:205,208` (ES) vs `:215,218` (EN) — strings del `Menu.buildFromTemplate` hardcodeados sin pasar por i18n, y sin relación con `detectedLocale()` (`main.ts:104-106`) que solo se usa para el wizard de setup. | Resuelto — menú nativo 100% en español vía `menu-strings.ts` (Preferencias, Carpeta de proyectos…, Ayuda, Abrir carpeta de logs, Acerca de / Licencias). |
| **Medio** | Mezcla de idiomas — página de Voz y selector de modelo del Productor | Con la UI en ES: ir a `voz` de cualquier proyecto, o abrir `productor` y mirar el selector de modelo abajo. | Esperado: todo en español si la UI está en ES. Obtenido: las tarjetas de voz muestran en **inglés fijo** "Spanish (Argentina) · High quality" y la descripción completa ("Neural voice trained on the 'daniela' dataset..."); el picker de modelo del productor muestra "Balanced · faster, cheaper" / "Most capable · slower, costlier" / "Fastest · lightest" también en inglés fijo, mientras el resto de la página ("MODELO", "Enviar", "Enter envía…") está en español. | `qa-20-voice-page.png`, `qa-23-producer-bottom.png` | Voces: manifest de sherpa-onnx con descripciones solo en inglés, consumidas tal cual por la UI (no hay clave i18n). Modelos: `apps/render-api/src/config/producer-config.ts` — el catálogo de modelos que sirve el backend trae `description: 'Balanced · faster, cheaper'` etc. hardcodeado en inglés; el frontend lo muestra literal. | Parcial — el selector de modelo del productor ya traduce label+description por id (`producer-model-i18n.ts`, claves `producer.model.<id>.*` en ambos catálogos), con fallback al texto del servicio para ids desconocidos. Las tarjetas de voz de sherpa-onnx (idioma/calidad/descripción del manifest) siguen en inglés fijo: no estaba en el alcance explícito de TASK-010 y queda pendiente para un fix aparte. |
| **Medio** | Mezcla de idiomas — input de archivo nativo | Con la UI en ES: ir a `storyboard` de un proyecto y mirar el selector "o subí un archivo de guion". | Esperado: el botón nativo del `<input type=file>` sigue el idioma de la app. Obtenido: dice **"Choose File" / "No file chosen"** en inglés aunque toda la página esté en español (mismo problema en el file input de subida de assets en la Biblioteca). | `qa-22-storyboard-page.png` | Chromium renderiza los controles nativos de formulario según el locale de arranque de Electron (`--lang`, derivado del locale del SO), no según `document.documentElement.lang` que el toggle EN/ES sí actualiza correctamente. No hay ningún `app.commandLine.appendSwitch('lang', ...)` ligado al toggle en `main.ts`. | Pendiente — no estaba en el alcance de los 9 puntos de TASK-010 (requeriría `app.commandLine.appendSwitch('lang', ...)` atado al toggle de idioma en `apps/desktop/src/main/main.ts`, reiniciando la carga de la ventana). Anotado para un fix futuro. |
| **Medio** | Preferencia de idioma no persiste entre reinicios | Cambiar el idioma a ES, cerrar la app del todo y volver a abrirla. | Esperado: la app recuerda ES. Obtenido: **siempre vuelve a EN** al reabrir (confirmado con `localStorage.getItem('video-maker.language')` → `null` tras el relanzamiento). | `qa-30-after-crash-relaunch.png` (UI en inglés tras relanzar, a pesar de haberla dejado en ES antes) | `apps/desktop/src/main/free-port.ts:8` — el puerto de render-api se elige al azar (`server.listen(0, ...)`) en cada arranque, así que la ventana carga desde un origen `http://127.0.0.1:<puerto-distinto>` cada vez. Como el `localStorage` está scopeado por origen, cualquier preferencia guardada ahí (`apps/web/src/i18n/language.ts:7`, clave `video-maker.language`) se pierde en cada reinicio. Probablemente afecta a cualquier otro estado que el front guarde en `localStorage`. | Resuelto — la causa raíz era el puerto aleatorio en cada arranque. `apps/desktop/src/main/preferred-port.ts` persiste un puerto preferido en `setup.json` (`preferredPort`), lo reintenta primero en cada arranque y sólo cae a uno nuevo si está ocupado, así que el origen `http://127.0.0.1:<puerto>` — y por lo tanto `localStorage` — se mantiene estable entre reinicios. |
| **Bajo** | Falta la UI para renombrar una carpeta/proyecto | Ir a `/`, mirar los controles de una carpeta ("Nueva categoría" / "Eliminar proyecto"). | Esperado (pedido explícito de la ronda de pruebas): poder crear/renombrar/borrar carpetas y categorías. Obtenido: crear y borrar están, pero **no hay ningún botón para renombrar** una carpeta, aunque el cliente HTTP ya lo soporta. | — | `apps/web/src/api/render-api-client.ts:88,271` define `renameFolder(folderId, name)` contra `PUT /api/folders/:folderId` (ruta real en `apps/render-api/src/http/routes.ts:14`), pero no hay ningún componente `.tsx` (fuera de specs) que lo invoque. | Resuelto — `folder-heading.tsx` gana un formulario de rename inline (abre con el nombre actual, valida vacío/sin cambios, muestra error tipado) que llama a `client.renameFolder`, ya soportado por el cliente HTTP. Tests en `folder-heading.spec.tsx`. |
| **Bajo** | Flags `raw`/`out` engañosos en proyecto recién creado | Crear un video/proyecto nuevo sin subir nada. Mirar su tarjeta en `/` o `GET /api/projects/:slug`. | Esperado: las banderas reflejan contenido real (0 assets, 0 salidas). Obtenido: `layout.raw` y `layout.out` aparecen en **`true`** desde el primer segundo (verificado también con `assetCounts` todo en 0 y el directorio `out/` vacío en disco). | `qa-06-video-created.png` (card con "raw" y "out" ya resaltados) | `apps/render-api/src/store/project-layout.ts:19-27` (`layoutFlagsFrom`) chequea **existencia de directorio**, no contenido; `apps/render-api/src/http/handlers/projects-handler.ts:148-157` crea `out/` (y las subcarpetas de `raw/`) de entrada al crear el proyecto, así que el flag da `true` aunque estén vacíos. Hay un test (`projects-handler.spec.ts:144`) que ya asume este comportamiento, o sea que es "by design", pero el usuario ve una señal falsa de "ya hay salida" en un proyecto que no renderizó nada todavía. | Resuelto — `layoutFlagsFrom` ahora recibe `rawHasFiles`/`outHasFiles` (contenido real, vía `directoryHasAnyFile` recursivo sobre `listDirectory`) en vez de sólo existencia de directorio. Test viejo que asumía el comportamiento anterior actualizado en `projects-handler.spec.ts` y `project-layout.spec.ts`. |
| **Cosmético** | Incoherencia de nombre de carpeta `raw/image/` vs `raw/images/` | Leer la tarjeta de rol "Imágenes" en Biblioteca/Guía (dice `raw/image/`) y después subir una imagen y mirar la ruta real del asset guardado. | Esperado: coincide. Obtenido: la copy dice `raw/image/` (singular) en todos lados (tarjeta de rol y página de guía), pero el archivo se guarda realmente en `raw/images/` (plural). Confundiría a alguien que intenta colocar archivos a mano siguiendo la guía. | Verificado con `find .../raw` tras subir `qa-photo.jpg` → apareció en `raw/images/qa-photo.jpg`. | No revisado a nivel de código (no bloqueante); a chequear el string de copy vs. la constante de carpeta real del backend. | Resuelto — copy corregida a `raw/images/` (plural) en las dos guías (ES/EN); test de contenido de la guía corregido para verificar el directorio real por rol, no el nombre del rol. |
| **Cosmético** | Código de error crudo en la tabla de jobs | Interrumpir un render (crash) y mirar la tabla de jobs en Vista previa (no el panel de detalle). | Esperado: mensaje amigable también en la tabla, igual que en el detalle ("Interrupted"). Obtenido: la columna "Error" de la tabla muestra el código interno **`JOB_INTERRUPTED`** tal cual; el panel de detalle del job sí traduce a "Interrupted" con botón "Run again" (que funciona bien). | `qa-32-interrupted-detail.png` (detalle, correcto) — tabla sin capturar, ver texto en pasos. | No revisado a nivel de código; la tabla parece imprimir el código de error sin pasar por la misma capa de traducción que el panel de detalle. | Resuelto — la tabla de jobs (`render-job-list.tsx`) ahora muestra el mismo texto amigable "Interrupted"/"Interrumpido" que el panel de detalle cuando el código es `JOB_INTERRUPTED`; cualquier otro código se sigue mostrando tal cual. |
| **Cosmético** | Ruido de 404 en consola | Abrir Biblioteca, Storyboard o Voz de un proyecto sin narración/storyboard generado todavía. | Esperado: sin errores en consola para un estado esperado (proyecto nuevo). Obtenido: la consola registra repetidos `404` de `GET /api/projects/:slug/voice`, `.../files/work/voice/script-manifest.json` y `.../storyboard` — se disparan (duplicados) en cada carga de esas páginas. No afecta la UI visible, pero ensucia devtools/logs y son round-trips desperdiciados. | Capturado vía `Runtime`/`Log`/`Network` CDP en casi todas las páginas del proyecto. | `apps/web/src/components/generated-files-panel.tsx` (`loadVoice`, línea ~45) — consulta el manifest de voz/storyboard sin antes chequear si existe, así que un proyecto nuevo siempre pega un 404 esperado por diseño, pero se podría evitar el ruido con un chequeo previo o silenciando el log de red para estas rutas "opcionales". | Parcial — `GeneratedFilesPanel` (el caso señalado explícitamente) ya no dispara el fetch del `script-manifest.json` hasta que el listado de generados confirma que existe, eliminando ese 404 esperado en un proyecto nuevo. `storyboard-page.tsx` y `voice-page.tsx` siguen pidiendo `script.txt`/`script-manifest.json` sin ese chequeo previo — mismo patrón, no cubierto en este ciclo por alcance/tiempo. |

## Lo que funcionó bien (sin bugs)

- **Guard de seguridad**: `curl` sin token → `403`; con `Host` falsificado → `403`; con
  `x-studio-token` correcto → `200` con body completo. Confirmado en dos lanzamientos con
  puertos distintos.
- **Health panel**: los 6 binarios (`ffmpeg`, `ffprobe`, `whisperCli`, `whisperModel`,
  `ttsCli`, `ttsVoicesDir`) resueltos, las 7 capabilities en `on`, engine `media-local` y
  `composition-remotion/render` cargados — sin mención a rutas del repo, `/opt/homebrew` ni
  `pnpm` en ningún texto visible.
- **Guía**: sin menciones a Piper, `.env`, `pnpm`, Homebrew ni `render-cli`; traducción ES
  completa y con voseo rioplatense correcto ("pedí", "editalo", "renderizalo").
- **Flujo completo end-to-end**: subida de A-roll/imagen/logo con roles correctos → montaje
  (`software-demo`) → preview con reproducción real (readyState 4, avance de `currentTime`) y
  logo con transparencia superpuesto correctamente → render → MP4 final verificado con
  `ffprobe` (1080×1920, h264, aac 48kHz estéreo, ~10s) → descarga funcional.
- **Borrado de asset con aviso de uso**: al intentar borrar un asset referenciado por la
  timeline, la UI muestra exactamente qué lo usa (`tracks.aroll clip aroll-0001, tracks.voice
  clip voice-0001`) y ofrece "Borrar igual" vs "Dejarlo" — el backend responde `409` primero
  y el frontend maneja bien el flujo de dos pasos.
- **Interrupción de job real**: al matar la app a mitad de un render y reabrir, el job
  aparece como `failed` / `JOB_INTERRUPTED`, el panel de detalle lo muestra como
  "Interrupted" con botón "Run again", y reintentar efectivamente vuelve a renderizar y
  termina en `succeeded`.
- **Borrado de proyecto**: modal de confirmación por texto ("Type ... to confirm") con lista
  clara de lo que se pierde (`raw/`, `work/`, `out/`) y sin trash — sensato para una acción
  irreversible.
- **Voz**: sherpa-onnx genera y cachea la demo de cada voz en la máquina, `readyState 4` y
  reproducción confirmada sin llamadas externas.
- **render-api.log**: limpio durante toda la sesión (sin `error`/`warn`) a pesar de las
  pruebas de estrés (kill duro a mitad de render). Sí es muy escueto — solo eventos de
  arranque/puerto/import legacy, nada de ciclo de vida de jobs — así que no sirve para
  diagnosticar por qué falló un render real desde "Open logs folder"; la única fuente es la
  tabla de jobs en la UI.

## Observaciones UX para el rediseño chat-céntrico (ciclo 5)

- El flujo actual reparte la creación de un video en dos pasos desconectados ("Proyecto
  nuevo" para la carpeta, "Video nuevo" para el video en sí, sin selector de carpeta al
  crear) — un chat-first podría resolver "creame un video para la campaña X" en un solo
  turno, incluyendo la carpeta.
- El indicador de progreso del render mostró `—/— frames (—%)` la mayor parte de la vida
  del job en clips cortos (terminaba antes de reportar frames reales) — en un rediseño
  conversacional convendría que el agente narre el progreso en vez de depender de ese widget.
- Los "flags" de proyecto (`raw/catalog/timeline/edl/out`) son útiles para power users pero
  jergosos para alguien nuevo; en un chat-first probablemente conviene reemplazarlos por una
  frase de estado generada ("tenés material subido, todavía no hay montaje").
- El selector de modelo del productor (Sonnet/Opus/Haiku con descripciones en inglés) es un
  detalle muy "developer-facing" para un producto conversacional; un rediseño chat-céntrico
  podría ocultarlo por defecto y sólo exponerlo como preferencia avanzada, ya traducido.
- La confirmación de borrado con "in-use warning" (qué partes de la timeline usan el asset)
  es un patrón muy bueno — vale la pena preservarlo o incluso extenderlo a otras acciones
  destructivas del rediseño (cancelar un turno del productor con jobs corriendo, etc.).

## Verificación real de huérfanos tras un hard kill (cierre de TASK-010, 2026-09-24)

Repetido contra el `.dmg` reconstruido e **instalado en `/Applications/Video Maker.app`** (no una
copia efímera), sin tocar el `userData` real del dev: `VIDEO_MAKER_USER_DATA` apuntado a un
directorio temporal sembrado con `cp -Rc` del `models/` real y un `setup.json` marcado
`completed`. Lanzado con env limpio (`HOME`/`PATH`/`USER`/`LOGNAME`/`TMPDIR` explícitos, sin
`ELECTRON_RUN_AS_NODE` ni ninguna otra variable heredada) y `--remote-debugging-port`; el token de
sesión se leyó de la cookie `vm_session` vía CDP (`Network.getCookies`), nunca del entorno de otro
proceso. Proyecto de prueba con un A-roll sintético de 90s con audio (tono, generado con el ffmpeg
embebido de la app), montaje y render disparados por la API.

**Variante A — `kill -9` al proceso principal de Electron, a mitad de un render real:**

| t | render-api | chrome-headless-shell | ffmpeg |
|---|---|---|---|
| 0s (al matar, chrome ya confirmado vivo) | vivo | vivo | — |
| +3s | 0 | 0 | 0 |
| +6s | 0 | 0 | 0 |

Repetido dos veces contra el binario final (antes y después del fix de la variante B) con el mismo
resultado: limpio en ≤3s, bien dentro del margen de ~6s pedido. Al relanzar con el **mismo**
`userData`: arranca limpio (sin diálogo, sin colgarse) y el job de render queda
`state: "failed"`, `errorCode: "JOB_INTERRUPTED"` — confirmado por `GET /projects/:slug/jobs`.

**Variante B — `kill -9` a `render-api` directamente (no a la app):** encontró un bug real que
**no** estaba cubierto por los unit tests (ambos son procesos vivos en producción, no simulables
con mocks de `ps`/timers):

1. Primer intento: `chrome-headless-shell` quedaba huérfano indefinidamente (4 procesos, aún vivos
   después de varios segundos). Causa: en el momento en que Electron reacciona a la muerte de
   `render-api`, el SO ya reparentó `chrome-headless-shell` a `launchd` (`ppid=1`) — el filtro por
   `ppid === render-api.pid` que se iba a usar del lado desktop nunca podía matchear nada. Fix:
   matar por **comando** (`chromeHeadlessShellPath`, único por instalación), no por `ppid`.
2. Segundo intento (con el fix de arriba): seguía sin limpiar. Causa: `dialog.showMessageBoxSync`
   es síncrono y bloqueante; se llamaba justo después de disparar la limpieza asíncrona de chrome
   (`void killOrphanableChromeChildren(...)`, sin `await`), así que el diálogo bloqueaba el event
   loop antes de que el callback de `ps` (asíncrono) pudiera correr. Fix: `await` explícito antes
   del diálogo.
3. Tercer intento, con ambos fixes: **chrome-headless-shell: 0 procesos ya en el primer segundo**
   después del kill. El diálogo nativo "render-api stopped unexpectedly" confirmado presente vía
   `System Events` (`exists sheet 1 of window 1` → `true`, texto exacto leído y verificado).

Cada fallo encontrado se corrigió en `apps/desktop/src/main/kill-orphan-chrome.ts` (nuevo) y
`apps/desktop/src/main/main.ts`, se agregaron/actualizaron units tests, se corrió
`pnpm nx run-many -t lint test build` completo (verde) y se reconstruyó + reinstaló el `.dmg` antes
de repetir la verificación — tres reconstrucciones en total hasta que ambas variantes pasaron
limpio contra el binario real.

Limpieza: los `userData` temporales y los procesos de prueba se eliminaron; la app se dejó
relanzada normalmente sobre el `userData` real del dev (intacto, no se tocó su carpeta de
proyectos ni su conversación).
