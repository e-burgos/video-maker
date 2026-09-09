# Verificación visual real — spec-e-burgos-006 cycle-02 (D-10, RNF-5, US-2-006)

> Ejecutada el 2026-09-09 contra `apps/render-api` corriendo de verdad sobre `media/`. No es un
> procedimiento documentado: las dos capturas de este directorio salieron de esta corrida, y todos
> los números de abajo se midieron **dentro del navegador**, no se leyeron de una captura.

## Por qué no se usó el MCP de Playwright

Igual que en `cycle-01`: las tools `mcp__…_playwright__*` de este arnés hablan con un browser real
a través de la extensión **Playwright MCP Bridge**, que no está instalada en esta máquina. La
verificación usa la librería Playwright ya cacheada
(`/Users/macbookprom2/.npm/_npx/705bc6b22212b352/node_modules/playwright`) desde un script de Node
en el scratchpad, **sin agregar nada a `package.json`**, y lanza el Google Chrome instalado con
`chromium.launch({ channel: 'chrome' })` porque el `chromium_headless_shell` que ese build espera
no está descargado. Es el flag que hay que conservar en cualquier corrida futura.

## Guion (copiable)

```bash
# 0. gate de memoria
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'        # sin salida
memory_pressure | tail -1                             # free 55-59 %

# 1. el servicio contra media/ real (4310 lo ocupa `pnpm sdd:docs` en esta máquina)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. la app, con el proxy apuntado al servicio
WEB_PORT=4207 RENDER_API_URL=http://127.0.0.1:4399 \
  pnpm exec vite --config apps/web/vite.config.ts &

# 3. EP-007 llega same-origin por el proxy
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
  http://localhost:4207/api/projects/smoke-ingest/timeline      # 200 application/json 7943

# 4. capturas + medición en el navegador
node <scratchpad>/capture-player.mjs sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-02/artifacts
```

El script navega a `/projects/smoke-ingest/preview`, espera `[data-testid="timeline-player"]`,
hace click en el botón de transporte del Player, mide el `<video>` y los `<audio>` del DOM, espera
1,5 s y vuelve a leer `currentTime`, captura 9:16, cambia el formato a 16:9, espera a que el
`<video>` vuelva a `readyState === 4 && paused === false`, y captura 16:9.

## Qué probó, medido

### `preview-player-9x16.png` — el Player reproduce de verdad

| Comprobación | Valor observado |
| --- | --- |
| Metadata que el Player recibió (`data-*` del contenedor) | `durationInFrames 538` · `fps 30` · `1080×1920` |
| Resumen en pantalla | `1080×1920 @ 30 fps` · `538 frames · 17.93 s` · `6 a-roll · 0 b-roll · 6 voice · 1 music · 20 captions` |
| `<video>` montado por el backend `player` | `readyState: 4` · `videoWidth×videoHeight` 1280×720 · `paused: false` · `muted: true` |
| `src` del `<video>` | `http://localhost:4207/api/projects/smoke-ingest/files/raw/aroll/clip01.mp4#t=0,2.97` — **EP-011 same-origin**, con el fragmento de recorte que pone Remotion |
| **`currentTime` avanzando** | `2.499 s` → `4.661 s` en una espera de 1,5 s (tres corridas: 2.512→4.675, 2.501→4.668, 2.499→4.661) |
| Captions de spec-003 en el DOM | `["Discarga", "Los"]` — visibles en la captura con el resaltado de impacto |
| `<audio>` montados | 5 · voz `raw/aroll/clip01.mp4` a `volume 1` · música `raw/audio/music01.mp3` a **`volume 0.0631`** |
| Controles de transporte | visibles en la captura: play/pausa, volumen, `0:04 / 0:17`, fullscreen y barra de scrub |
| Respuestas ≥ 400 de la aplicación (listener `response`) | **ninguna** |

`volume 0.0631` **es** la automatización de ducking del documento persistido:
10^(-24/20) = 0,0631, es decir el `gainDb: -24` del primer keyframe de `audioMix.automation`. El
Player reproduce la curva de ganancia de la Timeline; **no** aplica el `loudnorm` a -14 LUFS, que
vive en `media-local` y sólo corre en el pipeline del entregable.

`readyState: 4` (`HAVE_ENOUGH_DATA`) con `paused: false` y `currentTime` avanzando es la evidencia
de que hay frames de video decodificándose, no sólo un `<video>` con un `src` bien escrito.

### `preview-player-16x9.png` — el selector de formato (US-2-005)

| Comprobación | Valor observado |
| --- | --- |
| Lienzo tras el cambio | `1920×1080 @ 30 fps` (`data-composition-width/height` del contenedor: 1920 / 1080) |
| `<video>` tras el cambio | `readyState: 4` · `paused: false` · `currentTime 10.87 s` · `videoWidth 1280` |
| Requests al servicio | ninguna nueva: la timeline **no** se vuelve a pedir (el override es de cliente) |
| Escrituras | ninguna — no se emite `EP-008` ni ningún otro método distinto de GET |

En 16:9 el frame del clip llena todo el lienzo (fuente 1280×720 sobre 1920×1080): la captura
muestra el degradado azul real del material, no un placeholder.

## Hallazgo medido: el encuadre del preview NO es el del render

`render-frame-reference-8s.png` es el frame en `t = 8 s` del `video-muted.mp4` del job de
no-regresión: **el render llena los 1080×1920** (píxel de esquina `1b448a`, azul, no negro). El
Player, en cambio, deja el clip 16:9 en una banda con negro arriba y abajo. Medido en el
navegador: el `<video>` computa `width: 1080px · height: 1920px · object-fit: contain`.

**No lo causa el componente conmutable.** Se verificó forzando el backend `render`
(`<OffthreadVideo>`) dentro del mismo Player: el encuadre es **idéntico** al del backend `player`
(`width 1080px · height 1920px · object-fit: contain`, misma banda). Es una diferencia
preview/render propia de Remotion 4.0.522: el camino de render monta un `<Img>` con el frame
extraído y el de preview monta un `<video>` con `object-fit: contain`.

**Se intentó cerrarla en este ciclo y se descartó con evidencia:** dar a `ArollScene` un estilo
explícito `{ width: '100%', height: '100%', objectFit: 'cover' }` —espejo del `COVER_MEDIA_STYLE`
que `BrollTrack` ya usa— **cambia la salida del render**: el job `0ec6d97a` produjo
`video-muted.mp4` con `sha256 2ed415d8…` contra el `c1b9fd9f…` de la línea base. Eso viola el
invariante del ciclo (la salida del render no cambia), así que el experimento se revirtió y el
render volvió a ser byte-idéntico (job `d58734fa`, `sha256 c1b9fd9f…`). **Queda como hallazgo
abierto para `cycle-03`, que debe abrirse `[FULL]`**: alinear el encuadre es cambiar el
entregable, necesita decisión de spec y un clip de prueba con contenido no uniforme (el
`smoke-ingest` es azul casi plano y no discrimina `cover` de `fill`).

## Nota sobre los dos 404 de consola

`page.on('console')` registró dos `Failed to load resource: … 404` sin URL, mientras que
`page.on('response')` no vio **ninguna** respuesta ≥ 400 de la aplicación. La hipótesis que
`cycle-01` dejó anotada queda **confirmada**: `curl -o /dev/null -w "%{http_code}"
http://localhost:4207/favicon.ico` devuelve `404`, y `apps/web/index.html` no declara ningún
icono. No es un defecto de la aplicación; queda anotado por honestidad.
