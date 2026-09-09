# spec-e-burgos-006-web-studio cycle-03 — 2026-09-09

## Estado

- `resuelve: constitution.md § el hallazgo de encuadre abierto en cycle-02`. **D-12 resuelta:** el
  `<Player>` y el render muestran el mismo encuadre. Único archivo tocado de la lib:
  `src/components/timeline-video.tsx` (+3/−1 líneas).
- **El encuadre defectuoso es el del RENDER, no el del preview**, y queda descopado a un `[FIX]`.
  El render monta un `<Img>`/`<OffthreadVideo>` cuyo único encaje efectivo es el valor inicial
  `object-fit: fill` (la clase `__remotion_objectfitcontain` que Remotion inyecta **no tiene regla**
  fuera del `<Player>`), así que **estira anamórficamente un 1280×720 dentro de 1080×1920**. El
  navegador, en cambio, computa `object-fit: contain` por hoja de agente de usuario. La única
  diferencia entre los dos lados era `object-fit`.
- **Se alineó el preview al render, no al revés**, porque corregir el render cambia la salida
  binaria del entregable (probado en `cycle-02`: `sha256` de `video-muted.mp4` pasa de
  `c1b9fd9f…` a `2ed415d8…`) y eso está prohibido por el `out_of_scope` del brief y por el CA de
  no-regresión. Hasta el `[FIX]`, el valor de producto se cumple igual y mejor: **el dev ve en el
  preview exactamente el encuadre que va a salir en el MP4, defecto incluido.**
- **No-regresión verificada con un render real**: `sha256` de `video-muted.mp4` sobre
  `media/smoke-ingest` =
  `c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb`, idéntico al baseline de
  `cycle-02`. El árbol `render` es invariante **por construcción** (la rama no cambió un carácter);
  la corrida es la confirmación empírica, no la esperanza.
- **Paridad medida numéricamente** (`ffmpeg … psnr`, captura del frame 240 = t 8 s a 30 fps
  reescalada a 1080×1920, contra `cycle-02/artifacts/render-frame-reference-8s.png`): `mse_avg`
  **174,24** con el estilo (umbrales: ≤ 1500 y ≤ 0,35 × 5424,57 = 1898,6) y luma **70,85/255** sin
  bandas. **Oráculo probado sensible:** quitando el estilo, `mse_avg` 5424,57 y luma ~1,2 — falla
  los dos gates, así que la medición distingue de verdad.
- Cobertura: **25 archivos / 264 tests**, **93,85 % stmts · 92,41 % branch · 91,54 % funcs ·
  93,69 % lines**, piso 80 %.

## Estructura

- `TimelineVideo` aplica `PLAYER_MEDIA_STYLE = { objectFit: 'fill' }` **sólo en la rama `player`**,
  y con el spread en el orden `{ ...PLAYER_MEDIA_STYLE, ...style }` — **el estilo del llamador
  gana**. No es cosmética: `BrollMedia` ya pasa `objectFit: 'cover' | 'contain'` explícito, y
  `ArollScene` pasa sólo `transform`/`transformOrigin`. **Invertir el orden del spread rompe el
  b-roll `contain` y el `pip`**, y el test lo fija con los tres casos.
- **La rama `render` queda literalmente idéntica**: el `<OffthreadVideo>` recibe el `style` entrante
  sin agregarle ni quitarle una clave. El test lo asevera comparando
  `Object.keys(style).sort()` del elemento contra el `style` entrante — es el guardián del
  `sha256`, y el que hay que mirar primero si la no-regresión se rompe.
- **Ningún contrato público cambió:** `TimelineVideoProps` es el mismo, el barrel no gana ni pierde
  exports, y `renderTimeline`, `RenderTimelineOptions`, `RenderTimelineError`, `TimelineAudioMode` y
  `TimelineCompositionProps` no se tocaron.
- **`src/components/audio-track.tsx` entró a `coverage.include`** de `vite.config.ts` (que antes
  listaba sólo `helpers/**`, `transitions/**`, `render.ts`, `timeline-video.tsx` y
  `video-backend.tsx`). Es el archivo que **emite** el `volume` real de la música: `AudioTrack` pasa
  al `<Audio>` de música una función `volumeAtFrame(automation, frameInClip + clip.from)` y **no**
  `gainDbToVolume(music.baseGainDb)`; con `automation` vacía cae a `clip.volume`. Ese es el motivo
  de fondo por el que editar un nivel de música obliga a reescribir `audioMix.automation`.
- `vi.mock('remotion')` sigue necesitando el factory
  `async () => { const { createElement } = await import('react'); … }`: está hoisteado y no puede
  cerrar sobre imports del módulo.

## Dependencias

- Ninguna nueva. Remotion 4.0.522 y React 19 sin cambios.

## Qué sigue

- **`[FIX]` pendiente — el encuadre del render**, con el alcance ya redactado para que no haya que
  re-descubrirlo: dar a `ArollScene` un `COVER_MEDIA_STYLE` idéntico al de `BrollTrack`
  (`{ width: '100%', height: '100%', objectFit: 'cover' }`) en el árbol compartido (los dos
  backends), **re-basar el `sha256` de no-regresión** (`c1b9fd9f…` → `2ed415d8…`) y regenerar
  `render-frame-reference-8s.png`. Es un cambio deliberado del entregable, **no una regresión**:
  quien lo haga tiene que escribirlo así en su artefacto.
- **Para distinguir `cover` de `fill` hace falta contenido no uniforme**:
  `media/smoke-ingest/raw/aroll/clip01.mp4` es azul casi plano. El oráculo de paridad de este ciclo
  usó el frame 240 (t 8 s) justamente porque ahí el contenido no es plano.
- `planDucking` de `libs/timeline-core` pierde la cola de release cuando dos valles están cerca
  (`FIND-01` de este ciclo): afecta la curva que esta lib consume por `automation`, en el render y
  en el preview por igual.
