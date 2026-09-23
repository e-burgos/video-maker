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
