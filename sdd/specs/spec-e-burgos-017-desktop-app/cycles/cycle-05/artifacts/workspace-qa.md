# cycle-05 · TASK-006 — Verificación real (navegador y app empaquetada)

> Fecha: 2026-09-24 · Rama: `spec-e-burgos-017-desktop-app`

## A. E2E en el navegador — `apps/web/e2e/workspace-smoke.mjs`

Script nuevo, committeable y re-ejecutable. Levanta `render-api` (puerto 4470) y `vite` (puerto
4471) sobre una carpeta de medios temporal, genera los 5 fixtures con `ffmpeg` (grabación de
pantalla de 12 s con audio, un clip mudo, un PNG con canal alfa, un JPG y una pista de 60 s), los
suelta en el estudio y confirma el flujo completo. Corrida real, sin mocks; el turno de productor
usa la key real de OpenRouter guardada en el keychain (nunca leída ni impresa por el test).

### Resultado

| Paso | Resultado |
| --- | --- |
| Soltar la grabación en el inicio (`DataTransfer` + `dispatchEvent`, sobre `create-project-drop-zone`) → crea el proyecto y aterriza en su workspace | ✅ |
| Tarjeta pendiente con rol propuesto `aroll`, razón "tiene voz" | ✅ |
| Adjuntar la foto con el input oculto (`setInputFiles`, botón "Adjuntar archivos") | ✅ (segundo método de subida, cubre el otro camino pedido) |
| Soltar el clip mudo + el logo + la música sobre el panel de conversación (`DataTransfer` + `dispatchEvent`) | ✅ |
| Propuestas correctas para los 5 archivos: `aroll`/"tiene voz", `broll`/"no tiene audio", `logo`/"tiene transparencia", `image`/"es una foto", `audio`/"su nombre de archivo menciona música" | ✅ |
| Confirmar los 5, cambiando el clip mudo de `broll` a `aroll` (ningún descarte) | ✅ |
| En disco: `raw/aroll/` (2 archivos), `raw/logo/`, `raw/images/`, `raw/audio/`; `raw/inbox/` vacío | ✅ |
| Pestaña Material con etiquetas traducidas (`A-roll`, `Logo`, `Imágenes`, `Música` — sin `B-roll` porque el override movió el único candidato a `aroll`) | ✅ |
| Recargar la página: no sobreviven tarjetas pendientes (los 5 ya estaban confirmados) | ✅ |
| `PUT /api/settings/producer` con `engine: "openrouter"`, `models.openrouter: "deepseek/deepseek-v4.1-flash"` | ✅ (200, `keyPresent: true`) |
| Turno real: "¿Qué material tiene este proyecto? Respondé en una línea." | ✅ succeeded |
| Herramientas usadas: solo `mcp__studio__get_project_overview` | ✅ |
| Respuesta menciona el material confirmado ("Tenés dos grabaciones de pantalla … una pista de música de 60 s, una foto y un logo") | ✅ |
| Costo del turno | **≈ US$ 0,003** (< US$ 0,02 pedido) |
| Rutas de edición avanzada (`library`, `storyboard`, `voice`, `preview`) cargan | ✅ (ninguna rompe la UI) |

Capturas (1440×900): `e2e-00-projects-home.png` … `e2e-06-advanced-{library,storyboard,voice,preview}.png`.

### Consola y red durante el E2E

No quedó en cero — se documenta cada resto, con causa:

| Hallazgo | Causa | Acción |
| --- | --- | --- |
| `GET /` → 404 al abrir el inicio | Chrome pide `/favicon.ico` por default; `apps/web/index.html` no declara `<link rel="icon">` ni hay `apps/web/public/`. Cosmético, no afecta al usuario. | No corregido — fuera del alcance de este ciclo (no está en `plan.md`). |
| `GET /api/voices` → 503 (2 veces, en `/voice`) | Este test **no** carga `PIPER_PATH`/`PIPER_VOICES_DIR` (solo pide `MEDIA_ENV_VARS`, sin voz) porque no sintetiza audio; es una limitación deliberada del entorno del test, no un defecto del producto. | No aplica — así lo dejamos a propósito. |
| `GET /api/projects/:slug/storyboard`, `/voice`, `/timeline`, `/files/work/producer/script.txt`, `/files/work/voice/script-manifest.json` → 404 (varias veces, en `storyboard`/`voice`) | El backend usa `404` como respuesta legítima para "documento todavía no creado" (proyecto recién creado, sin storyboard/voz/timeline); el frontend lo atrapa y muestra el estado vacío correctamente (ver capturas `e2e-06-advanced-storyboard.png` / `-voice.png`, ambas limpias). El **plan.md** de este ciclo (US-017-404) dice "no generan 404 en la consola" — ese objetivo se cumplió para el flujo nuevo (workspace/chat), pero estas páginas de "edición avanzada" (D-C5-02: no rediseñadas este ciclo) siguen señalizando "no existe" con el código HTTP, y el panel de Red de Chrome loggea cualquier respuesta ≥400 aunque la app la maneje bien. | **No corregido.** Cambiar esto requiere que esos 4 endpoints devuelvan `200` + cuerpo vacío en vez de `404` — es un cambio de contrato de API (`sdd/api.json`) que toca varios consumidores fuera de este ciclo; se anota como hallazgo para un fix o ciclo futuro, no se improvisa un cambio de contrato sin el Arquitecto. |
| `GET /api/projects/:slug/files/raw/{aroll,audio}/*` → `net::ERR_ABORTED` (1-2 veces) | El test navega o recarga mientras un `<video>`/`<audio>` todavía estaba pidiendo su fuente; el browser cancela el fetch en curso. Artefacto normal de SPA, no un error de la app. | No aplica. |

Ningún error de consola vino de una excepción de React o de un `throw` no atrapado — todos son
respuestas HTTP no-2xx logueadas por el propio panel de Red de Chrome.

## B. Higiene de build — fugas de `NODE_ENV`

La raíz tiene `NODE_ENV=development` en `.env` (para `serve`); Nx inyecta `.env` en **todas** las
tasks, incluidas las de build. `apps/web` ya lo corregía desde TASK-005. Se auditaron los otros
tres artefactos de producción:

| Artefacto | ¿Fuga? | Detalle |
| --- | --- | --- |
| `apps/render-api` (esbuild → `dist/apps/render-api/main.js`) | **Sí, encontrada y corregida.** | El bundle traía **ambas** ramas (`react.development.js` y `react.production.min.js`, react@19.2.8) de una dependencia transitiva del AI SDK, porque `scripts/esbuild-node-bundle.mjs` no fijaba `process.env.NODE_ENV` en `define` y `react` no estaba en la lista `--external`. esbuild no puede eliminar la rama muerta sin ese `define`. **Fix:** agregar `'process.env.NODE_ENV': '"production"'` al `define` de `scripts/esbuild-node-bundle.mjs` (script usado *solo* para bundles empaquetados — `render-api:bundle` y `producer-tools:bundle` — nunca para `serve`, que corre con `tsx`/`swc-node` directo). |
| `libs/producer-tools` (esbuild → `dist/libs/producer-tools/mcp/main.js`) | No. | Mismo script, pero este bundle no importa el camino del AI SDK que arrastra `react`; medido antes y después del fix del punto anterior, el tamaño no cambió (1.398.477 → sigue en 1.399.332 bytes con o sin el `define`) y nunca contuvo `react.development.js`. El fix es inocuo acá. |
| `libs/composition-remotion` (`@remotion/bundler` → webpack, target de Remotion) | No — **por diseño, verificado en la fuente.** | `node_modules/@remotion/bundler/dist/bundle.js` llama a `webpackConfig` con `environment: 'production'` **hardcodeado** (no lee `process.env.NODE_ENV`); el `mode` de webpack sale siempre en `'production'` sin importar el `.env` de la raíz. No hace falta correr el bundle para confirmarlo — está fijo en el código del paquete. |
| `apps/desktop` (target `build`: `tsc -p tsconfig.lib.json && copy-static-assets.mjs`) | No aplica. | Es compilación de TypeScript del proceso principal de Electron (sin bundling/minificación) más una copia literal de `src/setup/setup.html` (HTML+JS plano, sin React). `NODE_ENV` no influye porque no hay ninguna herramienta ahí que haga dead-code-elimination condicionada a esa variable. |

### Medición antes/después (`apps/render-api`)

| | Antes | Después |
| --- | --- | --- |
| `dist/apps/render-api/main.js` | 3.087.612 bytes | 3.059.214 bytes (**-28.398 bytes, -0,9 %**) |
| Contiene `react.development.js` | Sí (con su rama completa: warnings, deprecaciones, chequeos de props) | No (0 coincidencias) |

El ahorro de tamaño es modesto porque el bundle del backend es chico comparado con el de una app
React real (no hay `react-dom`, solo `react` vía el AI SDK); lo importante es que el bundle
empaquetado ya no ejecuta código de desarrollo de una librería en producción — cualquier
`console.warn`/chequeo de props que ese código dispare en runtime queda eliminado por completo.

`dev`/`serve`/`test` no se tocan: el fix vive en un script que solo corren los targets `bundle`
(usados exclusivamente por `apps/desktop/scripts/build-desktop.mjs`).

## C. QA visual de la app empaquetada

`env -u ELECTRON_RUN_AS_NODE pnpm desktop:dist` (77–93 s, `.app` 775 MB, `.dmg` 254 MB) → se cerró
la app del dev (`osascript … quit`), se reinstaló con `ditto` en `/Applications/Video Maker.app`,
y se lanzó esa copia instalada con `VIDEO_MAKER_USER_DATA` apuntando a una carpeta temporal
sembrada con los modelos del dev (`cp -Rc`, clon APFS), un `setup.json` con `completed: true` y
una carpeta `projects` con un clon APFS de `media/display-ads-analiticas`. Captura por CDP
(`--remote-debugging-port`), interfaz en español por default (sin necesidad de cambiar idioma).

Capturas: `qa-00-projects-home.png`, `qa-01-workspace-chat.png`, `qa-02-workspace-material.png`,
`qa-03-advanced-menu-open.png`, `qa-04-library.png`, `qa-05-settings.png`,
`qa-06-proposal-card.png` (tarjeta de propuesta tras adjuntar un archivo vía
`DOM.setFileInputFiles` sobre el input oculto de `chat-drop-zone`).

### Encontrado y corregido

- **Encabezado de bienvenida cortado a la mitad** (`qa-01-workspace-chat.png` / `qa-02` /
  `qa-03`, versión "antes"): al abrir el workspace de un proyecto con historial (recetas ya
  usadas), el panel de chat arranca con scroll pegado abajo (`useStickToBottom`) aunque todavía
  no hay ningún mensaje — el contenido de bienvenida (encabezado, recetas, sugerencias) mide más
  que el panel visible, así que el scroll-to-bottom corta la primera línea del título a la mitad
  en vez de mostrarlo completo. Se ve en cualquier proyecto con recetas/sugerencias suficientes
  para superar la altura del panel.
  - **Fix:** `apps/web/src/hooks/use-stick-to-bottom.ts` ahora acepta un flag `enabled` (default
    `true`); `apps/web/src/components/producer-conversation-panel.tsx` lo pasa en
    `messages.length > 0` — el auto-scroll-al-fondo solo se activa cuando ya existe una
    conversación real, nunca sobre la pantalla de bienvenida. Test nuevo en
    `use-stick-to-bottom.spec.tsx` que fija que, deshabilitado, el hook no instala el
    `ResizeObserver`. Se reconstruyó el `.dmg`, se reinstaló y se volvió a capturar
    `qa-01`/`qa-02`/`qa-03`: el título aparece completo en las tres.

### Revisado, sin problemas

- **Inicio** (`qa-00`): tarjeta del proyecto, badge de estado "Listo" en verde, formularios de
  creación en español, buen uso del espacio.
- **Pestaña Material** (`qa-02`, tras el fix): agrupación por rol con miniatura y duración, sin
  solapamientos.
- **Menú de edición avanzada** (`qa-03`): despliega "Biblioteca / Storyboard / Voz / Vista previa
  y edición" con `z-index` correcto sobre las pestañas del panel (tapa el rótulo "Material" a
  propósito, es un menú flotante).
- **Biblioteca** (`qa-04`): las seis tarjetas de rol (A-roll, B-roll, Imágenes, Música, Locución,
  Logo) con su descripción en español, sin cortes de texto.
- **Configuración** (`qa-05`): motor "Automático", modelos recomendados de OpenRouter con precio y
  benchmark, key de OpenRouter mostrada solo como `••••56f7` (nunca completa).
- **Tarjeta de propuesta tras adjuntar un archivo** (`qa-06`): miniatura del PNG con su color
  real, razón "tiene transparencia", rol `Logo` preseleccionado.

### Conscientemente dejado sin tocar

- **"Choose File" / "No file chosen"** en el input nativo de subir guion en la página de
  Storyboard (`qa-04`/biblioteca "Subir a", `library-page`) sigue en inglés — es el control nativo
  del navegador para `<input type="file">` sin envoltorio (a diferencia de `chat-drop-zone` o
  `create-project-by-drop`, que sí lo esconden detrás de un botón traducido). D-C5-02 del plan de
  este ciclo dice explícitamente que las pantallas de "edición avanzada" no se rediseñan; envolver
  ese input es trabajo de un ciclo/fix aparte, no de esta verificación.
- Los 404 de `storyboard`/`voice`/`timeline` para documentos inexistentes (mismo hallazgo que en
  la sección A) también aparecen en la app empaquetada; misma decisión de no tocarlos acá.

Al cerrar: se citó el proceso de la app QA (`osascript … quit`), no quedaron huérfanos
(`pgrep -fl video-maker-qa` → vacío, un solo `render-api/main.js` vivo, el de la instancia real),
y se relanzó la app del dev con `open -a "Video Maker"` en un entorno limpio
(`env -i HOME=… PATH=…`).

## Verificación final

```
pnpm nx run-many -t lint test build
```

Corrida contra los 11 proyectos del workspace (`composition-remotion`, `producer-tools`,
`timeline-core`, `auto-montage`, `shared-utils`, `local-store`, `media-local`, `render-cli`,
`render-api`, `desktop`, `web`): **verde** — primera corrida encontró 1 error de lint nuevo
(`@typescript-eslint/no-inferrable-types` en el `enabled: boolean = true` del fix de
`use-stick-to-bottom.ts`, tipo trivialmente inferido), corregido quitando la anotación redundante
(`enabled = true`); segunda corrida: `lint`, `test` y `build` en verde para los 11 proyectos, sin
aviso de chunk de 500 kB en `web`.

## Archivos tocados por esta task

- `apps/web/e2e/workspace-smoke.mjs` (nuevo)
- `scripts/esbuild-node-bundle.mjs` (fix de `NODE_ENV`)
- `apps/web/src/hooks/use-stick-to-bottom.ts` / `.spec.tsx` (fix del clipping)
- `apps/web/src/components/producer-conversation-panel.tsx` (usa el flag `enabled`)
- 17 capturas nuevas en `sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-05/artifacts/`
  (`e2e-*.png`, `qa-*.png`)
