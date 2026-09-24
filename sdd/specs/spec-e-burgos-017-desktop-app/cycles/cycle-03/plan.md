# spec-e-burgos-017-desktop-app — cycle-03 · plan (lite)

> Módulo: desktop-app | Subproyectos: apps/desktop (nuevo), apps/render-api, libs/media-local,
> libs/composition-remotion, libs/producer-tools | Fecha: 2026-09-23
> Flow: **lite** — decisión del dev (perfil `solo`). Un solo actor: escribe este plan, implementa
> task por task (con implementores delegados) y cierra como reviewer.
> Objetivo: un **`.dmg` sin firmar para Apple Silicon** que un amigo instala y abre sin terminal, sin
> Homebrew y sin el repo: trae adentro ffmpeg, whisper y piper, descarga los modelos la primera vez,
> guarda sus datos en `~/Library/Application Support/Video Maker`, encuentra el CLI `claude` del
> usuario y cierra limpio todos sus procesos.
> Fuera de alcance: el motor OpenRouter (`cycle-04`), la interfaz nueva (`cycle-05`), el repo público
> de distribución y la web de documentación (`cycle-06`), la firma y la auto-actualización (D-09).

## Qué se encontró al preparar el ciclo

| Pieza | Hoy en la máquina del dev | Qué hace falta para empaquetarla |
| --- | --- | --- |
| ffmpeg / ffprobe | Homebrew, enlazado dinámicamente contra librerías de Homebrew | Build **estática** arm64. Incluye `libx264` (el Ken Burns y el pipeline codifican H.264), así que es **GPL**, no LGPL como decía la spec: se distribuye con su aviso de licencia y el link a su código |
| whisper-cli | Homebrew, dinámico contra `ggml` de Homebrew | Compilar `whisper.cpp` en un tag fijo, estático, con Metal |
| piper | **Paquete de Python** (`~/Library/Python/3.11/bin/piper`), no un binario | El binario C++ standalone de piper para macOS aarch64, si acepta los mismos argumentos que usa `synthesizeSpeech` y las tres voces instaladas; si no, un Python standalone con `piper-tts` adentro de la app |
| Remotion | `bundle()` con webpack **en cada render**, desde el código fuente de `composition-remotion` | Bundle generado al buildear la app y pasado como `serveUrl`; `chrome-headless-shell` descargado en el primer arranque y pasado como `browserExecutable` |
| better-sqlite3 | Binario precompilado para Node 22 | Recompilado para el ABI del Node de Electron |
| render-api y servidor MCP | TypeScript ejecutado con `@swc-node/register` desde el repo | JavaScript compilado, ejecutado por el binario de Electron con `ELECTRON_RUN_AS_NODE=1` |
| CLI `claude` | `/opt/homebrew/bin/claude` | Una app abierta desde el Finder **no hereda el `PATH` de la terminal**: hay que leerlo de un login shell del usuario |

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C3-01 | **TASK-001 es una prueba de concepto que bloquea** el resto: cada pieza de la tabla se prueba sola antes de construir encima | Si piper o whisper no se pueden empaquetar como se espera, cambia el diseño; mejor saberlo con un script que con una app armada |
| D-C3-02 | `render-api` corre como **proceso hijo** con el Node de Electron, en su **propio grupo de procesos**; al cerrar o al caerse la app se mata el grupo entero | Es lo que evita los `chrome-headless-shell` huérfanos que encontró `cycle-02` |
| D-C3-03 | `render-api` sirve el build de la web en `/` y la API en `/api`, solo en `127.0.0.1`, en un puerto libre elegido al arrancar | La web sigue pidiendo `/api` como hoy, sin CORS ni cambios en su código |
| D-C3-04 | La API local exige un **token por arranque** y rechaza un `Host` que no sea `127.0.0.1:<puerto>` | Sin eso, cualquier página abierta en el navegador del usuario podría mandarle pedidos a la API local (CSRF, DNS rebinding). La ventana de la app recibe el token en una cookie `HttpOnly`; nada más lo conoce |
| D-C3-05 | Los **binarios** van adentro de la app; los **modelos** (whisper, las tres voces, Chrome de Remotion) se descargan en el primer arranque a la carpeta de datos, con reanudación, tamaño y sha256 fijados | Mantiene el `.dmg` en el orden de cientos de MB en vez de más de 1 GB, y un archivo truncado nunca queda marcado como listo (RF-17-008) |
| D-C3-06 | La carpeta de proyectos se **elige en el primer arranque**: la de la app por defecto, o una existente (por ejemplo tu `media/`), guardada en `settings` | Vos seguís con tus 17 proyectos sin copiarlos, y un amigo arranca con la carpeta vacía |
| D-C3-07 | Resolución de binarios: **variable de entorno > carpeta de la app > `PATH`** | `pnpm studio` sigue andando igual con el `.env` y Homebrew; la app no depende de nada instalado |
| D-C3-08 | `electron-builder` con `identity: null` y target `dmg` arm64 | Sin firma (D-09); en Apple Silicon queda firmada ad hoc, que es lo mínimo para que abra |
| D-C3-09 | **sherpa-onnx reemplaza a piper como motor de voz**, en la app y también en desarrollo (decisión del dev tras TASK-001) | El piper empaquetable no existe para arm64 (release x86 sin dylibs, wheel con ruta de datos grabada). sherpa-onnx 1.13.8 es estático, Apache-2.0, corre las mismas tres voces convertidas (`vits-piper-*`) con `--vits-data-dir` relocatable y `--vits-length-scale`, y su audio transcribe igual al de piper. Un solo motor evita que desarrollo y app diverjan |
| D-C3-10 | El bundle prebuilt de Remotion se **copia (hardlink con fallback a copy) a una carpeta escribible junto a `RENDER_API_DB_PATH`** (`<dir>/remotion-bundle/<fingerprint sha256 de bundle.js>/`) la primera vez que se usa, y esa copia — no el original de `REMOTION_SERVE_URL` — es la que recibe el symlink `public → <publicDir>` por render | `REMOTION_SERVE_URL` vive dentro de `Video Maker.app/Contents/Resources`, de solo lectura para un usuario normal en `/Applications` y escribir ahí rompe la firma ad hoc. El fingerprint deja coexistir versiones de la app sin invalidar la cache a mano |
| D-C3-11 | `render-api` se compila a JS plano con esbuild (`render-api:bundle` → `dist/apps/render-api/main.js`, CJS, `node22`) externalizando `better-sqlite3` y todo `@remotion/*`/`remotion` (partes nativas); mismo esquema para el servidor MCP (`producer-tools:bundle` → `dist/libs/producer-tools/mcp/main.js`) | `ELECTRON_RUN_AS_NODE=1 electron main.js` no tiene `@swc-node/register` ni tsconfig paths; probado en real con el binario de Electron del propio `node_modules`. `createRequire(import.meta.url)` de `libs/local-store` se resuelve con `define: {'import.meta.url': '__filename'}` porque el output es CJS |
| D-C3-12 | Servido estático (D-C3-03): `RENDER_API_WEB_ROOT` activa `/api/*` (prefijo pelado antes de rutear) más fallback SPA a `index.html` para cualquier GET/HEAD que no matchee ninguna ruta de API; **sin la variable, comportamiento idéntico a hoy** (sin prefijo, sin estático). `/health` sin prefijo sigue andando además de `/api/health`, porque el proceso principal de Electron lo pollea directo | El build de `apps/web` ya llama todo bajo `/api` (`RENDER_API_BASE_PATH`); el passthrough de `/health` evita tocar `apps/desktop` para este ciclo |
| D-C3-13 | Guardia de acceso local (D-C3-04): activa solo con `RENDER_API_ACCESS_TOKEN`. `GET /?t=<token>` válido → cookie `vm_session` (`HttpOnly; SameSite=Strict; Path=/`) + 302 a `/`; toda otra request necesita esa cookie o el header `x-studio-token`; `Host` tiene que ser exactamente `127.0.0.1:<puerto>` o `localhost:<puerto>`; comparación en tiempo constante | El MCP y el HTTP client de `producer-tools` mandan `x-studio-token` (vía `STUDIO_API_TOKEN` en el env del proceso hijo) porque no tienen la cookie del browser. **Header exacto para que `apps/desktop` lo mande al pollear `/health`: `x-studio-token`** |

## Historias

- **US-017-201 — Todo adentro.** Como amigo del dev quiero instalar la app sin tener Homebrew ni el
  repo. CA: con el `PATH` reducido a `/usr/bin:/bin:/usr/sbin:/sbin`, `/health` informa los seis
  binarios y modelos resueltos **dentro** del bundle de la app o de su carpeta de datos, y un render,
  una transcripción y una síntesis de voz funcionan.
- **US-017-202 — Una sola app.** Como usuario quiero abrir la app y usar el estudio sin levantar nada
  a mano. CA: al abrir, la app arranca `render-api` en un puerto libre y muestra el estudio en su
  ventana; si `render-api` se cae, la app lo informa y ofrece reiniciarlo.
- **US-017-203 — Primer arranque.** Como usuario nuevo quiero que la app se prepare sola. CA: la
  pantalla de primer arranque descarga el modelo de whisper, las tres voces y el Chrome de Remotion
  con progreso; una descarga cortada se retoma; un archivo con tamaño o sha256 distinto se descarta y
  se vuelve a bajar; permite elegir la carpeta de proyectos; al terminar no vuelve a aparecer.
- **US-017-204 — Claude del usuario.** Como usuario quiero que la app use mi Claude. CA: la app
  encuentra el CLI `claude` aunque se abra desde el Finder (lee el `PATH` del login shell) y, si falta
  o no inició sesión, lo dice con los pasos para instalarlo o loguearse; el productor queda
  deshabilitado con el motivo, sin romper el resto del estudio.
- **US-017-205 — API local cerrada.** Como usuario quiero que ninguna página web pueda usar mi
  estudio. CA: un pedido a la API sin el token de la sesión o con un `Host` distinto responde `403`;
  la ventana de la app funciona sin cambios en `apps/web`.
- **US-017-206 — Un comando para el `.dmg`.** Como dev quiero generar el instalador con un comando.
  CA: `pnpm desktop:dist` deja `dist/desktop/Video-Maker-<versión>-arm64.dmg` sin firmar, con los
  avisos de licencias de terceros adentro; cerrar la app no deja ningún proceso hijo vivo.

## Tasks (detalle en tasks.json)

- **TASK-001** — Prueba de concepto en un scratchpad, sin tocar el repo salvo el informe
  `artifacts/packaging-spike.md`: fuente y versión de cada pieza, sha256, tamaño, y el resultado de
  correr con ella el mismo comando que usa el pipeline. **Si una pieza falla, se frena y se decide con
  el dev.**
- **TASK-002** — Script de vendor reproducible y manifiesto de versiones y licencias.
- **TASK-003** — Binarios desde la carpeta de la app, modelos desde la carpeta de datos, render desde
  el bundle precompilado de Remotion.
- **TASK-004** — Build de producción de `render-api` y del servidor MCP, servidor estático de la web,
  token y control de `Host`.
- **TASK-005** — Proceso principal de Electron.
- **TASK-006** — Pantalla de primer arranque.
- **TASK-007** — Empaquetado del `.dmg`.
- **TASK-008** — Verificación real (ver abajo).
- **TASK-009** — Cierre.

## Verificación

- `pnpm nx run-many -t lint test build` en verde, cobertura ≥ 80%.
- **Instalación como un amigo**, en tu Mac:
  1. `pnpm desktop:dist`, marcar el `.dmg` como descargado de internet
     (`xattr -w com.apple.quarantine …`), montarlo, copiar la app a `/Applications` y abrirla desde el
     Finder siguiendo el camino de "Abrir igual". Se guardan capturas de cada paso para la web de
     `cycle-06`.
  2. Carpeta de datos nueva (se renombra la anterior si existe): el primer arranque descarga todo.
  3. `/health` muestra cada binario resuelto dentro de `Video Maker.app` y cada modelo dentro de la
     carpeta de datos: **nada** de `/opt/homebrew` ni de `~/Library/Python`.
  4. Crear un proyecto, subir un clip y producir un video con la Receta Tutorial desde el chat → MP4
     verificado por el stream de video (`nb_frames`).
  5. Cerrar la app: cero procesos `render-api`, `chrome-headless-shell`, `ffmpeg`, `whisper-cli`,
     `piper` o `claude` vivos. Reabrir: el proyecto y la conversación siguen ahí.
  6. Un `curl` a la API sin token y otro con `Host: evil.example` → `403`.

## Riesgos del ciclo

| Riesgo | Mitigación |
| --- | --- |
| El piper C++ standalone no acepta los argumentos de `synthesizeSpeech` o no carga las voces | Lo resuelve TASK-001 antes de construir nada; la alternativa es un Python standalone con `piper-tts` |
| `electron-builder` con los symlinks de pnpm | Dependencias de producción aplanadas en un directorio de staging (`pnpm deploy` o equivalente) antes de empaquetar |
| Remotion busca su compositor nativo y Chrome en rutas de `node_modules` | Compositor fuera del `asar` (`asarUnpack`) y `browserExecutable` explícito; lo prueba TASK-001 |
| Tamaño del `.dmg` | Se mide en TASK-007 y se informa; los modelos quedan fuera por diseño (D-C3-05) |
| Gatekeeper cambia el camino de "Abrir igual" entre versiones de macOS | Capturas del camino real en la versión de macOS del dev, anotada en el informe |

## Pendiente de documentar en contexto (TASK-003)

- **`VoiceModel` gana el campo `directory`** (el subdirectorio `vits-piper-<id>` bajo `TTS_VOICES_DIR`), además de `fileName`. `isDefault` ya no depende de un env var apuntando a un archivo: marca `DEFAULT_VOICE_ID` (`es_AR-daniela-high`, constante en `libs/media-local/src/tts/build-voice-catalog.ts`) cuando esa voz está instalada.
- **Convención de la carpeta de datos**: `VIDEO_MAKER_MODELS_DIR/whisper-model.bin` y `VIDEO_MAKER_MODELS_DIR/voices/` son los nombres fijos que `resolveBinary` espera cuando falta la variable específica (`WHISPER_MODEL_PATH`/`TTS_VOICES_DIR`). TASK-006 (primer arranque) tiene que descargar exactamente a esos dos caminos, no inventar otros. `VIDEO_MAKER_BIN_DIR/<commandName>` es la misma idea para los ejecutables (`ffmpeg`, `ffprobe`, `whisper-cli`, `sherpa-onnx-offline-tts`), y ya coincide con el `apps/desktop/vendor/darwin-arm64/bin/` que arma TASK-002.
- **Bundle prebuilt de Remotion + assets de proyecto (relativos)**: se verificó con un proyecto real (`optica-siochana`) que TODOS los assets de una Timeline real (incluido el logo) usan rutas relativas al `project.root` y dependen de `staticFile()` + `publicDir` — la suposición de TASK-001 de que los assets reales siempre son absolutos era incorrecta. Con `REMOTION_SERVE_URL` prebuilt, `node-render-api-dependencies.ts` ahora mantiene un symlink `<serveUrl>/public → <publicDir del render actual>` (`ensurePrebuiltBundlePublicDir`), recreado antes de cada render — funciona porque la cola de render tiene concurrencia 1. Sin este symlink el render falla con 404 en cualquier imagen/asset de proyecto (logo incluido).
- **`libs/media-local/src/piper/` se renombró a `src/tts/`**; `synthesizeSpeech` ahora recibe `tokensPath`/`dataDirPath` además de `modelPath`, y lee el texto de `textPath` con un `readTextFile` inyectable (mismo patrón que `transcribeWithWhisperCpp`) en vez de pasarlo como flag `-i`, porque `sherpa-onnx-offline-tts` recibe el texto como argumento posicional.

## Pendiente de documentar en contexto (TASK-004)

- **Bug real encontrado en la verificación**: con `RENDER_API_WEB_ROOT` activo, el `apiUrl` que `apps/render-api` arma para **su propio productor** (el que termina en `--api-url` del servidor MCP) tiene que llevar el sufijo `/api` — si no, el MCP y el cliente HTTP de `producer-tools` le pegan a rutas sin prefijo, que con web estático activo devuelven 404 `ROUTE_NOT_FOUND` (traducido como `STUDIO_UNAVAILABLE` del lado del productor: "el studio no está disponible"). Se corrigió en `apps/render-api/src/main.ts` (el fallback de `readProducerConfig` agrega `/api` cuando `config.webRoot !== null`). Verificado con un turno real de productor (`PRODUCER_MODEL=haiku`) que antes fallaba así y ahora responde con la herramienta `mcp__studio__probe_media` ejecutada correctamente.
- **`public/example` y `public/fonts` de `libs/composition-remotion/public/`**: Remotion los detecta e incluye por convención de carpeta (sibling al root), *incluso con* `publicDir: null` en `bundle()`. El symlink `public → <publicDir del proyecto>` (D-C3-10) los reemplaza en cada render — verificado que ningún componente del render real los usa (`grep` de `staticFile` solo aparece en `helpers/asset-src.ts`, siempre con rutas de proyecto), pero si algún componente futuro necesita esos assets en un render real, este diseño hay que revisarlo (mergear en vez de reemplazar).
- **`GET /health` sin el prefijo `/api` sigue siendo un caso especial** en `handle-request.ts` (`UNPREFIXED_HEALTH_PATHNAME`) para que el proceso principal de Electron lo siga pudiendo pollear directo; ningún otro path bypassea el prefijo — antes probé "cualquier ruta matchea directo" y rompía el fallback SPA de `/projects/:slug` de la web (colisiona con la ruta de API `projects.detail`).

## Pendiente de documentar en contexto (TASK-010)

- **`apps/render-api/src/process/`** es un directorio nuevo: `parent-watchdog.ts` (pollea `VIDEO_MAKER_PARENT_PID` cada 2s con `process.kill(pid, 0)`; no-op si la env var no está, así que `pnpm studio` sigue sin watchdog), `kill-orphan-chrome.ts` (usa `ps -Ao pid=,ppid=,command=` para encontrar los hijos directos cuyo command matchea `REMOTION_BROWSER_EXECUTABLE` — Remotion/Puppeteer lanza Chrome con `detached: true` propio, así que **no** comparte el grupo de proceso de render-api y hay que matarlo aparte) y `kill-process-group.ts` (copia local de la utilidad que ya existía en `apps/desktop/src/main/render-api-process.ts`, porque son paquetes distintos). `apps/render-api/src/main.ts` los conecta: al detectar que el padre murió, primero mata los chrome huérfanos y recién después el propio grupo (`SIGKILL` a `-process.pid` termina el propio proceso, así que el orden importa).
- **`apps/desktop/src/main/render-api-pid-guard.ts`**: persiste el pgid de render-api en `<userData>/render-api.pid` en cada arranque exitoso y lo borra en `shutdownCurrent`. Al bootstrapear, `killStaleRenderApiIfAny` lee ese archivo y, sólo si `ps -o command= -p <pid>` contiene la marca de identidad de este binario (`renderApiIdentityMarker`: `<resourcesDir>/render-api/main.js` empaquetado, o `apps/render-api/src/main.ts` en dev), mata su grupo — nunca lee env de otros procesos, sólo el command line.
- **`apps/desktop/src/main/render-api-env.ts`** (extraído de `main.ts`): `buildRenderApiEnv` ya NO spreadea `process.env` — usa `allowlistedParentEnv` (HOME/USER/LOGNAME/TMPDIR/SHELL/LANG/LC_*) más los `RENDER_API_*`/`VIDEO_MAKER_*`/`REMOTION_*`/`CLAUDE_CLI_*` explícitos, y ahora también `VIDEO_MAKER_PARENT_PID` (el pid de Electron, consumido por el watchdog de arriba).
- **`apps/render-api/src/config/child-process-env.ts`** (`allowlistedChildEnv`): mismo patrón para los hijos que arranca render-api — `claude -p` (`spawnProducerProcess`) y el `CommandRunner` compartido (`loadCommandRunner` en `node-render-api-dependencies.ts`, cacheado y usado por ffmpeg/whisper/sherpa/el segundo `aiAgent`). Allowlist: HOME/USER/LOGNAME/TMPDIR/PATH/SHELL/TERM/LANG/LC_*, más `CLAUDE_CODE_*`/`ANTHROPIC_*` sólo si ya estaban presentes. Verificado con un turno real de productor (`PRODUCER_MODEL=haiku`, MCP `get_project_overview`) corriendo con este env acotado. `createCommandRunner` (el puerto público, no el cacheado) sigue devolviendo una instancia nueva por llamada — lo exige un test existente — pero también recibe el env acotado.
- **`ExecaCommandRunnerOptions` de `libs/media-local`** gana `env?: NodeJS.ProcessEnv`; cuando se pasa, `ExecaCommandRunner.run` lo manda a `execa` con `extendEnv: false` — sin eso, execa mergea igual con `process.env` completo y el allowlist de arriba no serviría de nada.
- **`ProjectLayoutStats` de `apps/render-api/src/store/project-layout.ts`** cambió de forma: `raw`/`out` ya no son `StorageStat | null` (existencia del directorio) sino `rawHasFiles`/`outHasFiles: boolean` (contenido real, vía `directoryHasAnyFile`, recursivo sobre `ObjectStorage.listDirectory`). `catalog`/`timeline`/`edl` no cambiaron (siguen siendo archivo sí/no). Cualquier otro reader de `ProjectLayoutFlags` (badges de la web) no necesitó cambios porque la forma de salida (`{raw, catalog, timeline, edl, out}: boolean`) es la misma.
- **`apps/desktop/src/main/setup-state.ts`** gana `preferredPort: number | null` en `SetupState` (persistido en `setup.json`). `apps/desktop/src/main/preferred-port.ts` (`resolvePreferredPort`) intenta primero ese puerto, si está libre lo reusa; si no, prueba puertos al azar en 42000–42999 y por último cae a `getFreePort` (efímero). El puerto se resuelve una sola vez por sesión en `bootstrap()` y se reusa en `changeProjectsFolder`, para no romper el origen (y con él, `localStorage`) mientras la app sigue corriendo.
- **`apps/desktop/src/main/menu-strings.ts`**: strings del menú nativo en un módulo aparte (`DEFAULT_LOCALE = 'es'`, hoy la única opción) para que sumar un segundo idioma sea sólo agregar una clave al diccionario, no tocar `main.ts`.
- **`apps/web/src/i18n/language.ts`**: `DEFAULT_LANGUAGE` pasa a ser `'es'` y `preferredLanguage`/`detectLanguage` ya no consultan `navigator.languages` — el default es fijo (pedido del dev), no del navegador. `useT()` sin provider sigue devolviendo el catálogo inglés porque el valor default de `LanguageContext` está hardcodeado aparte y no depende de `DEFAULT_LANGUAGE`.
- **`apps/web/src/api/producer-model-i18n.ts`** (`translateProducerModel`): traduce label/description del selector de modelo del productor por id (`producer.model.<id>.label|description` en ambos catálogos) para los ids conocidos (`sonnet`/`opus`/`haiku`); cualquier id no reconocido pasa tal cual vino del servicio. Patrón a reusar si se agregan más ids.
- **Pendiente real, fuera de alcance de TASK-010** (documentado también en `qa-exploratory.md`, columna Estado): las tarjetas de voz de sherpa-onnx siguen sin i18n (manifest en inglés fijo); el `<input type=file>` nativo sigue en el idioma del SO porque nadie liga `app.commandLine.appendSwitch('lang', ...)` al toggle; `storyboard-page.tsx`/`voice-page.tsx` siguen pidiendo `script.txt`/`script-manifest.json` sin chequear primero el listado de generados (mismo 404-en-consola que se corrigió sólo en `GeneratedFilesPanel`).
- **`apps/desktop/src/main/kill-orphan-chrome.ts`** (agregado durante la verificación real de TASK-010, no en la primera pasada): cuando `render-api` muere solo (no la app), su `chrome-headless-shell` queda huérfano y **no se puede** encontrar por `ppid` — el SO ya lo reparentó a `launchd` (`ppid=1`) antes de que Electron llegue a reaccionar al evento `exit`. A diferencia del `kill-orphan-chrome.ts` de render-api (que sí puede filtrar por `ppid` porque él mismo sigue vivo cuando chequea), este filtra directo por **comando** (`chromeHeadlessShellPath`, ya es un path único por instalación/`userData`, no hace falta más scoping). Conectado en el handler `renderApi.onExit` de `main.ts`, con un detalle no obvio: la limpieza async (`await killOrphanableChromeChildren(...)`) tiene que terminar **antes** de llamar a `dialog.showMessageBoxSync` — ese diálogo es síncrono y bloqueante, así que si la limpieza queda como fire-and-forget (`void ...` sin `await`), el diálogo bloquea el event loop antes de que el callback del `ps` async pueda correr y la limpieza nunca pasa. Verificado con `kill -9` real al pid de `render-api` (no a Electron) contra el `.dmg` instalado: sin el `await`, huérfanos persistían >10s; con él, 0 procesos en el primer segundo.
