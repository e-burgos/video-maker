# DisplayAds — Manejador multi-video (React + TypeScript)

> Mudado desde `display-ads/apps/video-manager` el 2026-10-07 (spec-e-burgos-020 del Video Maker).
> Para videos animados **automáticos** con voz y música desde un guion, ver `tools/motion-studio` y el modo
> motion del estudio; este editor queda para piezas armadas y retocadas a mano.

> Si sos un agente y vas a generar o editar un video acá, leé **`SKILLS/VIDEO-CREATOR.md`**
> primero: tiene los contratos del motor, las piezas disponibles y las reglas
> de marca.

Manejador multi-video: cada video es una carpeta en `src/videos/` con su
propio timeline, escenas y guion. El motor de animación es por timeline,
1920×1080 por defecto, y todo el código propio es TypeScript / TSX estilado
con estilos inline (no hay CSS ni Tailwind).

App del monorepo Nx (`apps/motion-editor`, tag `type:app`). Las dependencias
viven en la raíz del workspace: **no tiene `package.json` propio**.

```bash
pnpm install                  # una vez, en la raíz del monorepo
pnpm motion-editor            # o: nx dev motion-editor   → http://localhost:7315
nx typecheck motion-editor
nx build motion-editor --configuration=production   # → dist/apps/motion-editor
nx test motion-editor
```

Puertos: dev 7315, preview 7325 (webapp 7311, backoffice 7312, docs 7314).

## Estructura

```
project.json                    Proyecto Nx (name, sourceRoot, tags)
vite.config.mts                 Config Vite/Vitest (root, cacheDir, outDir, puertos, plugin dev-only)
tsconfig.json                   Extiende ../../tsconfig.base.json; referencias app/spec
tsconfig.app.json               Compilación de la app
tsconfig.spec.json              Compilación de los tests
index.html                      @font-face auto-hospedados (ver "Fuentes"). Ya no declara
                                 window.OM_SCENES ni window.OM_PLAYBACK: eso vive por video.
src/
  main.tsx                      Punto de entrada
  App.tsx                       Cablea registro + video activo + selector + panel de tweaks
  theme.ts                      Paleta, tipografías, tonos de StatCard
  motion.ts                     lerp, seg, MOTION.{enter,draw,pop}, useClock
  components/                   SÓLO lo compartido entre videos (frontera con src/videos/*/components/)
    Frame.tsx                   Escenario persistente + contrato de frame-match
    bits.tsx                    PhotoSlot, Glyph, Cursor, StepNumber, NoteCard
  editor/                       Motion editor + export de video (ex src/motion/, Ciclo 73)
    MotionEditor.tsx            Panel: transporte, scrub, bloques de escena, retiming, Guardar/Exportar
    exportVideo.ts               Exportador frame por frame (mp4/webm) + helpers de seek
    saveTimeline.ts              Cliente del endpoint dev-only de guardado del timeline
  host/                         Chrome de la app: NO es contenido de escena, no sale en el video exportado
    VideoSelector.tsx            Selector de video + ?v=<slug> sin recargar
    VideoWorkspace.tsx           Monta <SceneStage> + <MotionEditor> de UN video activo
    VideoErrorPanel.tsx          Panel de aviso: slug inexistente / video roto / registro vacío
    RegistryIssuesBanner.tsx     Franja roja fija con los errores del registro completo
    useActiveVideo.ts             Estado del video activo, espejado con ?v= (pushState/popstate)
    tweak-defaults.ts             Defaults de los tweaks del HOST (no de ningún video)
  engine/
    api.ts                      Fachada TIPADA del motor — importá siempre desde acá
    global-react.ts             Expone React en window para las libs vendorizadas
    animations-v2.jsx           Motor de timeline (vendorizado, no editar)
  tweaks/
    tweaks-panel.jsx            Panel de controles (vendorizado, no editar)
  videos/                       Un video = una carpeta. Descubrimiento automático (ver más abajo)
    define-video.ts              defineVideo() — contrato de video.ts, nunca tira excepciones
    build-registry.ts            Núcleo puro del registro por convención (testeable sin disco)
    registry.ts                  Único lugar con import.meta.glob; arma REGISTRY
    registry.spec.ts             Asserta los slugs vigentes contra el disco real
    glyph-coverage.spec.ts       Falla si una escena usa un glifo fuera de las fuentes cargadas
    <slug>/                      Una carpeta por video (ver "Cómo crear un video nuevo")
      video.ts                    defineVideo({ title, audience, scenes, timeline, ... })
      timeline.json                [{ name, dur }] — orden y duración de las escenas
      guion-locucion.md            Guion locutable con marcas de tiempo
      scenes/*.tsx                  Un componente de escena por nombre de timeline
      components/*.tsx              Piezas propias de ESTE video (no compartidas)
vite-plugins/                  Plugin dev-only del endpoint de guardado del timeline
  save-timeline.ts              Middleware de Vite: matchea ruta/método, delega en el núcleo puro
  save-timeline-core.ts         Núcleo puro (testeado sin Vite): valida y escribe timeline.json
public/assets/                  Logos de marca y fotografía real (p. ej. core-device.webp)
public/favicon-*.png            Favicons compartidos con el resto de los apps
public/fonts/                   Outfit y JetBrains Mono auto-hospedados (ver "Fuentes")
```

Los dos `.jsx` son librerías vendorizadas: se autoregistran en `window` y
`src/engine/api.ts` las reexporta con tipos. No las importes directo — importá
`Easing`, `clamp`, `useScene`, `SceneStage`, `useTweaks`, etc. desde
`src/engine/api`.

**Exención de lint (DEC-73-005, Ciclo 73):** `src/engine/animations-v2.jsx` y
`src/tweaks/tweaks-panel.jsx` llevan `/* eslint-disable */` como primera línea.
Es la única forma de destrabar `nx lint motion-editor` (74 errores `no-var` +
warnings, todos vendorizados) sin tocar `eslint.config.mjs` ni `project.json`
(archivos protegidos). La exención vive **dentro de cada archivo**: no afecta
a ningún otro. Si algún día se re-vendoriza una versión nueva de estas
librerías, **hay que reponer manualmente** las líneas de cabecera o el lint
vuelve a rojo. Ver `sdd/cycles/cycle-73/architect.md` §7 para el detalle.

## Cómo crear un video nuevo

**Es el propósito de este app.** No hay ningún registro central que editar:
el próximo agente que reciba "hacé un video de X" sigue estos pasos y listo.

1. **Creá la carpeta** `src/videos/<slug>/`. El `slug` sale literalmente del
   nombre de la carpeta (kebab-case: minúsculas, números y guiones) — **no se
   declara en ningún otro lado**. Si el nombre no es kebab-case, el registro
   lo marca con `invalid-slug` y no se reproduce.
2. **Escribí `video.ts`** con:
   ```ts
   import { defineVideo } from '../define-video';
   import timeline from './timeline.json';
   import { Escena1, Escena2 } from './scenes/acto1';

   export default defineVideo({
     title: 'Título humano, el que se ve en el selector',
     audience: 'prospecto' | 'cliente',
     scenes: { Escena1, Escena2 }, // clave = name del timeline, EXACTO (con tildes)
     timeline,
     // width/height/fps/playback son opcionales: 1920×1080, 30fps, { mode: 'loop' }
   });
   ```
   `defineVideo` nunca tira: si algo está mal (falta `title`, escena sin
   componente, timeline vacío, etc.) el video queda marcado como no
   reproducible y el problema aparece en la franja roja de errores del host —
   nunca en una excepción de arranque.
3. **Escribí `timeline.json`**: un array `[{ name, dur }]`, orden y duración en
   segundos de cada escena. Cada `name` tiene que existir como clave en
   `scenes` de `video.ts` (coincidencia exacta, tildes incluidas).
4. **Escribí las escenas** en `src/videos/<slug>/scenes/*.tsx`, envueltas en
   `<Frame>`, animando sólo con `useClock()` y `MOTION.enter/draw/pop` (ver
   "Los cuatro contratos" en `SKILLS/VIDEO-CREATOR.md`).
5. **Escribí `guion-locucion.md`** con marcas de tiempo por escena, igual que
   los videos existentes.
6. **No hay que registrar nada más.** `src/videos/registry.ts` usa
   `import.meta.glob('./*/video.ts')` y `import.meta.glob('./*/timeline.json')`:
   la carpeta nueva aparece sola en el selector la próxima vez que el dev
   server recompila. Esta ausencia de registro central es la propiedad de
   diseño central del multi-video (DEC-OWNER-33-02) — no la rompas agregando
   un índice manual "por las dudas".
7. **Actualizá `src/videos/registry.spec.ts`**: ese test asserta contra el
   disco real qué slugs tienen que existir. Sumá el slug nuevo a la lista.

Piezas compartidas entre videos van en `src/components/` (hoy: `Frame.tsx`,
`bits.tsx`). Piezas propias de un solo video van en
`src/videos/<slug>/components/` (p. ej. `como-funciona/components/webapp.tsx`
y `screen.tsx`, que recrean el panel real; `conexion-core-pro/components/hardware.tsx`;
`conexion-mostrador/components/kiosk.tsx`).

## Nomenclatura de producto (regla dura)

**Al cliente final nunca se le dice "Raspberry Pi" ni "tablet Android".** Es
un error que ya se cometió y se corrigió en el Ciclo 73 — no lo repitas.
Verificado contra `docs/product/webapp-user-manual.md` (líneas 11, 71,
207-209):

| Hardware real (sólo en comentarios de código) | Nombre de producto | Cómo figura en el panel |
| --- | --- | --- |
| Raspberry Pi 5 (equipo HDMI headless) | **Display-Ads Core Pro** | **"Pantalla"** |
| Tablet Android en modo Kiosk/Device Owner | **Display-Ads Counter 15** | **"Mostrador"** |

En comentarios de código podés aclarar cuál es el hardware real por detrás
(ver `src/videos/conexion-core-pro/video.ts`, `src/videos/conexion-mostrador/video.ts`
y `src/videos/conexion-mostrador/components/kiosk.tsx`). **En pantalla, guion
o cualquier texto que vea el cliente, jamás** — sólo "Core Pro"/"Pantalla" y
"Mostrador"/"Counter 15".

## El editor de timeline y el guardado dev-only

El botón **Guardar** de `<MotionEditor>` (`src/editor/MotionEditor.tsx`) llama
a `saveTimeline()` (`src/editor/saveTimeline.ts`), que hace `POST` a
`/__motion-editor/save-timeline`. Ese endpoint **sólo existe en desarrollo**:

- El middleware que lo atiende (`vite-plugins/save-timeline.ts`, delegando en
  el núcleo puro `save-timeline-core.ts`) se registra con `apply: 'serve'` en
  el plugin de Vite: no corre en `nx build`.
- El cliente chequea `import.meta.env.DEV` antes de hacer el `fetch`: en el
  build de producción esa rama se elimina por dead-code elimination, así que
  el `fetch` mismo desaparece del bundle final.

Doble garantía: en producción no hay servidor que atienda la ruta ni código
cliente que la llame. El botón "Copiar JSON" del editor, en cambio, funciona
siempre (sólo usa el portapapeles del navegador).

## Fuentes auto-hospedadas

`index.html` ya no enlaza Google Fonts: declara sus propios `@font-face` con
los .woff2 estáticos en `public/fonts/` (Outfit 400/500/600/700, JetBrains
Mono 400/700 — los pesos que usa `src/theme.ts` de verdad). Motivo (DEC-73-006,
Ciclo 73): el motor de export inlinea todos los `@font-face` de la página como
`data:` URL en **cada frame** del video (`useInlineFontsInto` en
`animations-v2.jsx`, que no se toca). Con Google Fonts variable eran 26
`@font-face` / 511 KB por frame; con los estáticos auto-hospedados son 6 /
131 KB — el decode del SVG de cada frame bajó de ~42 a ~29,8 ms.

El test `src/videos/glyph-coverage.spec.ts` barre todo el contenido de escena
(`src/videos/**`, `src/components/**`) y falla si aparece un glifo (codepoint
> U+00FF) que no esté en una allow-list explícita documentada uno por uno —
es la única forma de que el recorte de fuentes no se rompa en silencio si
alguien tipea un carácter fuera del subset cargado.

## Cómo editar un video existente

**Duración y orden de las escenas** → `src/videos/<slug>/timeline.json`, o
arrastrando el borde de cada bloque en la línea de tiempo del editor (botón
"Copiar JSON" para llevar el cambio al archivo). Al cambiar la duración, el
motor reescala el reloj de la escena: la misma coreografía se reproduce más
rápido o más lento, nunca cortada.

**Contenido** → cada escena es una función que recibe el reloj local con
`useClock()` y dibuja según `t` (segundos desde el primer frame de la escena).
Los textos, cifras y campañas están arriba de cada escena en constantes
tipadas: editás el dato, no el markup.

**Colores y tipografías** → `src/theme.ts` (compartido por todos los videos).

## Tres reglas del proyecto

1. **Toda animación sale del reloj de la escena** (`useClock()` → `t`, `p`).
   Nunca un `setInterval`, `requestAnimationFrame` ni un estado propio: el
   editor de timeline y el export de video hacen seek a un timestamp exacto y
   necesitan que el frame se pueda calcular sin historia.
2. **Sólo los tres helpers de `MOTION`.** `enter` para apariciones, `draw` para
   trazos y contadores, `pop` para escalas con sobrepaso. Nada de easing suelto:
   es lo que mantiene el ritmo parejo entre escenas.
3. **Contrato de frame-match.** El primer frame de una escena tiene que ser
   idéntico al último de la anterior. `<Frame>` ya lo resuelve: el fondo
   persiste y el contenido de la escena entra y sale con un fade de 0,45 s
   adentro de la escena. Si agregás una escena, usá `<Frame>`.

## Material real y placeholders

`PhotoSlot` (`src/components/bits.tsx`) acepta una prop `src` opcional: **sin**
`src` dibuja el placeholder rayado con etiqueta en monoespaciada; **con** `src`
muestra la foto real en el mismo hueco — reemplazar un placeholder por
material definitivo es agregar una prop, no reescribir la escena. La foto real
del Core Pro ya está en `public/assets/core-device.webp` y se usa en
`src/videos/como-funciona/scenes/acto3-ia.tsx` y en
`src/videos/conexion-core-pro/scenes/acto1-conexion-fisica.tsx`.

Quedan placeholders rayados pendientes de material real: interior de la
cafetería (video `como-funciona`, escenas Apertura/Noche), salida del
generador de imágenes (escena IA) y el Mostrador montado en su soporte (video
`conexion-mostrador`, escena de instalación). Reemplazalos por `<img>` con
fotografía real cuando llegue — los lineamientos visuales piden fotografía
limpia de negocios, no ilustración vectorial.

## Origen de la UI recreada

Las pantallas del panel del video `como-funciona` salen del código del
monorepo:

| Pieza del video           | Archivo fuente                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Navegación lateral        | `apps/webapp/src/router/routes-config.tsx`                                           |
| Dashboard y KPIs          | `apps/webapp/src/pages/DashboardPage.tsx`                                            |
| StatCard                  | `libs/ui-components/src/components/StatCard.tsx`                                     |
| Timeline de campañas      | `apps/webapp/src/components/campaigns/planning/components/InteractiveTimelineV2.tsx` |
| Analíticas                | `apps/webapp/src/pages/AnalyticsPage.tsx`                                            |
| Paleta, tipografía y tono | `docs/branding/brand/*`                                                              |
