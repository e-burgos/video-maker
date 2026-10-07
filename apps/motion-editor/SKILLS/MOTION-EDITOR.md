# Motion editor + descarga de video (standalone)

En el entorno original, el timeline y el botón de exportar venían del **host
embebedor** (el iframe padre de la plataforma de origen — no confundir con
`src/host/` de este repo, que es el chrome de la app: selector de video,
panel de errores, etc., ver `SKILLS/VIDEO-CREATOR.md` §2.1). En la app Vite no
hay iframe padre, así que esas dos piezas (timeline + export) están
implementadas acá, en `src/editor/`. Son autocontenidas: no dependen de nada
del host embebedor original.

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/editor/exportVideo.ts` | Exportador frame por frame + helpers de seek. Sin dependencias obligatorias. |
| `src/editor/MotionEditor.tsx` | Panel: transporte, scrub, bloques de escena, retiming por arrastre, botón de descarga y botón Guardar. |
| `src/editor/saveTimeline.ts` | Cliente del guardado dev-only del timeline (ver "Guardar" más abajo). |
| `src/host/VideoWorkspace.tsx` | Cableado: monta `<MotionEditor>` para el video activo; el JSON de escenas vive en estado ahí y el editor lo edita. |

## Cómo se conecta al motor

Todo pasa por la **raíz exportable** que crea `SceneStage`: el
`<svg data-om-exportable-video-with-duration-secs="N">`.

- **Duración**: se lee de ese atributo.
- **Mover el playhead**: evento `data-om-seek-to-time-frame` con
  `detail: { time, sync, playing }`.
  - `playing: true` → el motor lo interpreta como reproducción continua
    (permite transiciones de overlap). Lo usa el reloj del editor.
  - `sync: true` → el commit de React se aplica con `flushSync`, así el DOM ya
    refleja el frame al volver del `dispatchEvent`. Lo usa el exportador.
    El motor sólo lo ofrece (y sólo entonces marca `data-om-sync-seek="true"`)
    si encuentra **`window.ReactDOM.flushSync`** — por eso `src/engine/global-react.ts`
    expone `window.ReactDOM` además de `window.React`. Si se saca, cada frame
    del export vuelve a costar dos refrescos de pantalla y se serializa un DOM
    que puede ir un commit atrasado respecto del timestamp.
- **Fuentes**: el motor inlinea los `@font-face` dentro del svg y marca
  `data-om-fonts-inlined="true"`. El exportador espera ese flag.

Regla del motor que hay que respetar para que el export salga exacto: **todo lo
visible se renderiza desde el reloj de la escena** (`useScene()`), nunca desde
`useEffect` ni un `requestAnimationFrame` propio. Si algo se pinta fuera del
commit del seek, ese frame se exporta viejo.

## Cómo exporta

1. Pre-cachea todas las `<img>` como `data:` URL (una imagen con `src="/x.png"`
   dentro de un `foreignObject` **no** carga cuando el svg se serializa aparte).
2. Por cada frame: seek con `sync` → clona y serializa el svg → lo rasteriza en
   un `<canvas>` vía `Image` + **`data:` URL**.
3. Encodea:
   - **mp4** si existe `VideoEncoder` (WebCodecs) **y** está instalado
     `mp4-muxer` (`pnpm add mp4-muxer`). H.264, 12 Mbps. El perfil se negocia
     con `VideoEncoder.isConfigSupported` (High → Main → Baseline); si ninguno
     entra, cae al webm en vez de reventar a mitad del render.
   - **webm** como fallback sin dependencias: `canvas.captureStream(0)` +
     `MediaRecorder`, pidiendo cada frame con `track.requestFrame()` — así el
     fps final es exacto aunque cada frame tarde en renderizar.
4. Dispara la descarga.

`exportVideo(root, { fps, filename, onProgress, signal })` es cancelable con un
`AbortController`.

### `data:` y no `blob:` — la trampa que rompe todo el export

El frame se rasteriza desde una `data:` URL **a propósito**. El stage es un
`<svg>` con `<foreignObject>` adentro, y Chrome ensucia el canvas
(*origin-unclean*) al dibujar un svg con `foreignObject` que viene de una
`blob:` URL. A partir de ahí `getImageData`, `toDataURL` y sobre todo
`new VideoFrame(canvas)` tiran `SecurityError` y el export muere. Medido en
Chrome 148 con un svg mínimo:

| Origen de la imagen del frame | Resultado |
| --- | --- |
| `blob:` + `foreignObject` | canvas **tainted** → `SecurityError` |
| `data:` + `foreignObject` | canvas limpio ✓ |

No cambiar `data:` por `URL.createObjectURL` "para ahorrar la codificación":
el percent-encoding cuesta ~6 ms por frame en 1920×1080 y es lo único que hace
exportable un stage basado en `foreignObject`. `assertOriginClean()` corta en el
frame 0 con un mensaje claro si alguien lo revierte. (Base64 en vez de
percent-encoding se probó y sale peor: payload más grande y encoding más lento.)

Costo real del pipeline a 30 fps / 1920×1080, medido sobre el explainer:
~45 ms por frame (seek 7 · serialize 6 · encode 6 · **decode del svg ~30** ·
draw 1 · `VideoFrame` + encode 3) → unos 3,3 min para los 120 s.

El grueso es el decode del svg, y una parte son los `@font-face` inlineados: el
motor los copia dentro del svg en CADA frame y Chrome los vuelve a parsear. Por
eso el app **auto-hospeda** sólo los pesos y el subset que usa (`public/fonts/`)
en vez de pedirle a Google Fonts la familia entera. El efecto, medido antes y
después en el mismo frame (t=45 s):

| | `@font-face` | `<style>` inlineado | payload del frame | decode |
| --- | --- | --- | --- | --- |
| Google Fonts, familia completa | 26 | 511 KB | 1415 KB | 42 ms |
| Auto-hospedado, sólo lo usado | 6 | 131 KB | 1009 KB | **29,8 ms** |

Si alguien vuelve a poner un `<link>` a Google Fonts en `index.html`, el costo
por frame sube ~40 % y el export de un video de 2 minutos se alarga un minuto.

### Los dos botones de exportar

La barra de reproducción del motor trae su propio ícono **"Export video"**, pero
sólo emite `postMessage({ type: 'omelette:request-video-export' })` al host que
lo embebía en el entorno original. Parados solos ese mensaje nos vuelve a
nosotros (`window.parent === window`), así que `MotionEditor` lo escucha y
dispara el mismo `doExport`. Sin ese puente el usuario ve dos botones de export
y uno no hace nada.

## Retiming

Arrastrar el borde de un bloque (o editar el número de segundos) actualiza el
JSON en estado y el stage se retimea en vivo. Dos formas de llevar el cambio a
disco:

- **"Copiar JSON"** — siempre disponible (sólo usa el portapapeles): lo pegás
  a mano en `src/videos/<slug>/timeline.json`.
- **"Guardar"** (DEC-73-003, Ciclo 73) — sólo en desarrollo. Escribe
  `timeline.json` directo: `MotionEditor` llama a `saveTimeline()`
  (`src/editor/saveTimeline.ts`), que valida localmente con
  `validateTimelineShape` y hace `POST /__motion-editor/save-timeline`. Ese
  endpoint lo atiende un plugin de Vite dev-only
  (`vite-plugins/save-timeline.ts`, delegando en el núcleo puro
  `save-timeline-core.ts`, que revalida y escribe el archivo). El botón NO
  existe en producción: el plugin se registra con `apply: 'serve'` (no entra
  al build) y el `fetch` del cliente cae por dead-code elimination detrás de
  `import.meta.env.DEV`.

## Atajos

`Espacio` play/pausa · `←/→` un frame (con `Shift`, un segundo) · `Home`/`0` al inicio.

## Pendientes conocidos

- Sin audio: la locución se mezcla aparte, o hay que sumar una pista de audio al
  muxer (`mp4-muxer` acepta `audio`).
- El webm de fallback tiene VP9/VP8; si hace falta mp4 sí o sí, instalar
  `mp4-muxer` en un browser con WebCodecs (Chrome/Edge).
- `VideoSprite` (video anidado) no está cubierto por este exportador: se
  rasteriza el frame actual del `<video>`, pero su audio no se mezcla.
