# VIDEO-CREATOR.md — Cómo generar un video explicativo de DisplayAds en este proyecto

Este proyecto es un **manejador multi-video** de explicativos para DisplayAds:
animaciones 1920×1080 por timeline, en React + TypeScript, que se editan como
código y se exportan a video. Cada video vive en su propia carpeta dentro de
`src/videos/<slug>/`, con su propio timeline, escenas y guion; el registro los
descubre solos (ver §2.1). El video "Cómo funciona DisplayAds" (12 escenas,
120 s, carpeta `como-funciona`) es la **referencia de estilo**, no un caso
especial: cualquier video nuevo se construye con las mismas piezas.

Leé este archivo completo antes de escribir código. Las reglas de la sección
"Los cuatro contratos" no son estilísticas: si las rompés, el editor de timeline
y el export de video se desincronizan.

---

## 1. Qué es este proyecto y qué NO es

Es un motor de animación declarativa por tiempo. **Cada frame se calcula
únicamente a partir de un timestamp.** No hay estado que evolucione, no hay
`requestAnimationFrame` propio, no hay CSS `animation` ni `transition`. El host
puede pedir el frame del segundo 47,3 en frío y tiene que salir idéntico
siempre.

Eso lo hace exportable a video y editable en una línea de tiempo. También
significa que patrones normales de React (animar con `useState` + `setInterval`,
transiciones CSS, librerías tipo Framer Motion) **están prohibidos acá**.

Es un app del monorepo Nx: `apps/motion-editor`, tag `type:app`. Las
dependencias viven en la raíz del workspace — **este app no tiene
`package.json` propio, no le agregues uno** (duplicar React o Vite rompe la
resolución de pnpm). Si necesitás una dependencia nueva, se instala en la raíz.

```bash
pnpm motion-editor                                   # nx dev motion-editor → :7315
nx typecheck motion-editor                           # tiene que pasar limpio
nx build motion-editor --configuration=production    # → dist/apps/motion-editor
nx test motion-editor
```

Queda incluido en los comandos agregados del workspace:
`nx run-many -t dev -p tag:type:app` (`pnpm front`), `pnpm build:all`,
`pnpm test:all`, `pnpm lint:all`.

---

### Convenciones del monorepo que hay que respetar

- **Sin Tailwind en este app.** Los demás apps lo usan; acá no, porque el
  estilado es inline (contrato 3.4). No agregues `@tailwindcss/vite` al
  `vite.config.mts`.
- **Sin `react-router`, sin `@e-burgos/tucu-ui`, sin `@display-ads/*`.** Este
  app no consume las libs del workspace: la UI del panel que aparece en el
  video es una **recreación** en `src/components/webapp.tsx`, hecha para que la
  animación sea determinista y no arrastre el runtime de la app real. Si el
  webapp cambia visualmente, se actualiza la recreación a mano (ver
  `github.md` en la raíz, sección Screen map).
- **Puertos**: dev 7315, preview 7325.

## 2. Estructura

```
project.json                    Proyecto Nx — NO renombrar el target sin actualizar los scripts de la raíz
vite.config.mts                 Vite + Vitest. Sin Tailwind a propósito (ver contrato 3.4)
tsconfig.json                   Extiende ../../tsconfig.base.json
tsconfig.app.json               allowJs: true — necesario por los .jsx vendorizados
tsconfig.spec.json
index.html                      @font-face auto-hospedados (ver §2.2). NO declara window.OM_SCENES:
                                 cada video trae su propio timeline (§2.1).
src/
  main.tsx                      Punto de entrada
  App.tsx                       Cablea registro + video activo + selector + panel de tweaks del host
  theme.ts                      Paleta, tipografías, tonos de StatCard
  motion.ts                     lerp, seg, MOTION.{enter,draw,pop}, useClock
  components/                   SÓLO piezas compartidas ENTRE videos (frontera con videos/<slug>/components/)
    Frame.tsx                   Escenario persistente + frame-match. TODA escena lo usa.
    bits.tsx                    PhotoSlot (con/sin `src`), Glyph, Cursor, StepNumber, NoteCard
  editor/                       Motion editor + export de video (ex src/motion/)
    MotionEditor.tsx            Panel: transporte, scrub, bloques, retiming, botón Guardar/Exportar
    exportVideo.ts               Exportador frame por frame + helpers de seek
    saveTimeline.ts               Cliente del endpoint dev-only de guardado (ver §12)
  host/                         Chrome de la app — NO es contenido de escena, no sale en el video exportado
    VideoSelector.tsx            Selector de video + ?v=<slug>
    VideoWorkspace.tsx           Monta <SceneStage> + <MotionEditor> del video activo
    VideoErrorPanel.tsx          Aviso: slug inexistente / video roto / registro vacío
    RegistryIssuesBanner.tsx     Franja roja fija con errores del registro completo
    useActiveVideo.ts             Estado del video activo, espejado con ?v=
    tweak-defaults.ts             Defaults de los tweaks del HOST (no de ningún video)
  engine/
    api.ts                      Fachada TIPADA. Importá SIEMPRE desde acá.
    global-react.ts             Expone React en window para las libs vendorizadas
    animations-v2.jsx           Motor de timeline — VENDORIZADO, NO EDITAR
  tweaks/
    tweaks-panel.jsx            Panel de controles — VENDORIZADO, NO EDITAR
  videos/                       Un video = una carpeta. Descubrimiento automático, sin registro manual (§2.1)
    define-video.ts              defineVideo() — contrato de video.ts
    build-registry.ts            Núcleo puro del registro por convención
    registry.ts                  Único lugar con import.meta.glob
    registry.spec.ts             Asserta los slugs vigentes contra el disco real
    glyph-coverage.spec.ts       Falla si una escena usa un glifo fuera de las fuentes cargadas
    <slug>/
      video.ts                    defineVideo({ title, audience, scenes, timeline, ... })
      timeline.json                [{ name, dur }]
      guion-locucion.md            Guion locutable con marcas de tiempo
      scenes/*.tsx                  Un componente por nombre de timeline
      components/*.tsx              Piezas propias de ESTE video (no compartidas)
vite-plugins/                  Plugin dev-only del endpoint de guardado (§12)
public/assets/                  Logos de marca + fotografía real (p. ej. core-device.webp)
public/fonts/                  Outfit y JetBrains Mono auto-hospedados (§2.2)
```

Los dos `.jsx` son librerías externas que se autoregistran en `window`.
**Nunca las importes directo ni las edites.** `src/engine/api.ts` las reexporta
con tipos: de ahí salen `Easing`, `clamp`, `interpolate`, `useScene`,
`SceneStage`, `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakToggle`,
`TweakSlider`, `TweakColor`, `TWEAK_DEFAULTS`.

### 2.1 Descubrimiento automático de videos (DEC-OWNER-33-02)

**No existe ningún registro central que editar para dar de alta un video.**
`src/videos/registry.ts` usa `import.meta.glob('./*/video.ts')` +
`import.meta.glob('./*/timeline.json')` para descubrir carpetas solo; el
`slug` sale del nombre de la carpeta (kebab-case), no se declara en ningún
lado. Ver la sección 4 de este documento para el procedimiento completo de
alta de un video nuevo.

Frontera entre contenido y chrome del host (importante para dónde va cada
pieza nueva):

- **Contenido de escena** (lo que sale en el video exportado): `src/videos/**`
  y lo compartido en `src/components/`. Sólo puede animarse con
  `useClock()`/`MOTION`, nunca `useEffect` visual.
- **Chrome del host** (`src/host/`): selector de video, panel de errores,
  franja de issues, defaults de tweaks del host. Vive fuera del
  `<SceneStage>` — nunca aparece en el frame exportado.
- **Editor** (`src/editor/`): MotionEditor + export + guardado. Es
  herramienta de autoría, tampoco sale en el video exportado.

### 2.2 Fuentes auto-hospedadas (DEC-73-006)

`index.html` declara sus propios `@font-face` (Outfit 400/500/600/700,
JetBrains Mono 400/700) apuntando a `public/fonts/*.woff2`, en vez de un
`<link>` a Google Fonts. El motor inlinea todos los `@font-face` de la página
como `data:` URL en cada frame del export (`animations-v2.jsx`, vendorizado,
no se toca): con Google Fonts variable eran 26 `@font-face` / 511 KB por
frame; auto-hospedado son 6 / 131 KB. `src/videos/glyph-coverage.spec.ts`
falla si aparece en contenido de escena un glifo fuera del subset cargado.

---

## 3. Los cuatro contratos

### 3.1 Toda animación sale del reloj de la escena

```tsx
const clock = useClock(); // { t, len, p, scene }
const { t } = clock; // t = segundos desde el primer frame de ESTA escena
```

`t` es el único origen del tiempo. Prohibido: `setInterval`, `setTimeout`,
`requestAnimationFrame`, `Date.now()`, `useState` para animar, CSS `animation`,
CSS `transition`, `Math.random()` sin semilla fija.

`p` va de 0 a 1 en la escena; `len` es el largo real (respeta el time-stretch
del editor). Si el usuario alarga una escena de 8 a 12 s, la coreografía se
estira sola — nunca se corta.

### 3.2 Sólo los tres helpers de MOTION

```tsx
MOTION.enter(t, at, dur?, dy?)   // aparición: { opacity, transform } — spread en style
MOTION.draw(t, at, dur?)         // 0→1 para barras, líneas, contadores, barridos
MOTION.pop(t, at, dur?)          // escala 0.94→1 con leve sobrepaso
```

`at` = segundo del reloj local en que arranca. Es lo que mantiene el ritmo
parejo entre escenas. No inventes easings sueltos.

Excepción única: movimientos de cámara largos y continuos (ken burns), que usan
`lerp` + `seg(t, 0, dur, Easing.easeInOutSine)`. Ver `Apertura` y `Noche`.

### 3.3 Frame-match en cada corte

El primer frame de una escena debe ser idéntico al último de la anterior, o el
corte "salta". `<Frame>` ya lo resuelve: el fondo persiste entre escenas y el
contenido propio hace fade in/out de 0,45 s **adentro** de la escena. Por eso
toda escena se envuelve en `<Frame>` y nunca dibuja su propio fondo.

El `Backdrop` usa `sin(2πp)`, que vale 0 en `p=0` y en `p=1`: la deriva del
fondo es continua a través de los cortes. Si tocás el fondo, mantené esa
propiedad.

### 3.4 Estilos inline, siempre

No hay CSS, ni Tailwind, ni styled-components, ni clases. Todo es `style={{}}`
con valores de `src/theme.ts`. Las únicas reglas globales viven en el `<style>`
de `index.html` (reset del body y las fuentes).

---

## 4. Cómo crear un video nuevo

Es el caso de uso central del proyecto: siete pasos, en este orden.

**1. Creá la carpeta** `src/videos/<slug>/`. El `slug` sale del nombre de la
carpeta (kebab-case: minúsculas, números y guiones) — no se declara en ningún
otro lado. Si no es kebab-case, el registro lo marca `invalid-slug` y no se
reproduce.

**2. Escribí `video.ts`**:

```ts
import { defineVideo } from '../define-video';
import timeline from './timeline.json';
import { MiEscena, OtraEscena } from './scenes/acto1';

export default defineVideo({
  title: 'Título humano, el que se ve en el selector',
  audience: 'prospecto', // o 'cliente'
  scenes: { MiEscena, OtraEscena }, // clave = name del timeline, EXACTO
  timeline,
  // width/height/fps/playback opcionales: default 1920×1080, 30fps, loop
});
```

`defineVideo` **nunca tira excepciones**: acumula diagnósticos en
`issues[]` (falta `title`, escena sin componente, timeline vacío, nombre de
escena duplicado, etc.) y el video queda marcado no-reproducible; el problema
aparece en la franja roja de errores del host, no en una excepción de
arranque.

**3. Escribí `timeline.json`**: `[{ "name": "MiEscena", "dur": 8 }, ...]`.
Cada `name` tiene que coincidir EXACTAMENTE (tildes incluidas, p. ej.
`'Mañana'`, `'Mediodía'`) con una clave de `scenes` en `video.ts`.

**4. Escribí el componente de cada escena** en `src/videos/<slug>/scenes/*.tsx`:

```tsx
import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';

/** 01:12 – 01:24 · Qué pasa en esta escena, en una línea. */
export function MiEscena() {
  const clock = useClock();
  const { t } = clock;

  return (
    <Frame
      clock={clock}
      time="lun 28 jul · 14:00" // opcional: chip de fecha/hora
      kicker="Volanta corta" // subtítulo en monoespaciada
      line="La idea de la escena en una frase."
    >
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 240,
          ...MOTION.enter(t, 0.3),
        }}
      >
        <span
          style={{
            fontFamily: F.sans,
            fontSize: 64,
            fontWeight: 600,
            color: C.text,
          }}
        >
          Contenido
        </span>
      </div>
    </Frame>
  );
}
```

**5. Escribí `guion-locucion.md`** con marcas de tiempo por escena.

**6. No registrés nada más.** `import.meta.glob` en `src/videos/registry.ts`
descubre la carpeta sola la próxima vez que compila el dev server — es
DEC-OWNER-33-02, la propiedad de diseño central del multi-video. No agregues
un índice manual "por las dudas".

**7. Actualizá `src/videos/registry.spec.ts`**, sumando el slug nuevo a la
lista que se asserta contra el disco real.

Para reordenar las escenas de un video existente, cambiá el orden de
`timeline.json` — nada más. Para agregar UNA escena a un video existente:
escribí el componente (paso 4), sumalo a `scenes` en `video.ts` y agregá su
entrada a `timeline.json`.

---

## 5. Piezas disponibles (usalas antes de inventar)

Antes de escribir una pieza nueva, revisá si ya existe: en `src/components/`
si aplica a cualquier video, o en `src/videos/<slug>/components/` si es
propia de un video existente que se parece al que estás por hacer (p. ej.
`como-funciona/components/webapp.tsx` para paneles, `conexion-core-pro/components/hardware.tsx`
para el gabinete del Core Pro, `conexion-mostrador/components/kiosk.tsx` para
el modo kiosco).

### Del panel — `src/videos/como-funciona/components/webapp.tsx`

- `<Panel active url w h>` — ventana de navegador + sidebar del webapp.
  `active` es el nombre del ítem de `NAV` que queda resaltado.
- `<PageHeader title subtitle>` — encabezado de página.
- `<StatCard title value subtitle tone glyph>` — KPI. `tone`:
  `emerald | sky | amber | rose | indigo | teal`.
- `<Card title>` — contenedor de contenido dentro del panel.

### De la pantalla del local — `src/videos/como-funciona/components/screen.tsx`

- `<TV w h live glow>` — pantalla montada, con chip ONLINE.
- `<Creative kind o scale>` — pieza publicitaria en pantalla. Las piezas están
  en `CREATIVES`; para una campaña nueva, sumá una entrada ahí. `scale` adapta
  la pieza (diseñada para 900×506) a otros tamaños de TV: 0,97 para 880 px,
  0,80 para 720, 0,71 para 640, 0,334 para 300.

### Genéricas, compartidas entre videos — `src/components/bits.tsx`

- `<PhotoSlot w h label src? fit?>` — **hueco de fotografía**. Sin `src`
  dibuja el placeholder rayado con etiqueta en monoespaciada diciendo qué
  material falta. Con `src` (ruta bajo `public/`, p. ej.
  `/assets/core-device.webp`) muestra la foto real en el mismo hueco: pasar de
  placeholder a material definitivo es agregar una prop, no reescribir la
  escena. Los lineamientos piden fotografía real de negocios, no ilustración
  vectorial.
- `<Glyph kind color size>` — íconos: `dash | org | camp | ai | chart | wifi |
  check | plug | alert | power`. Geometría simple, no ilustraciones.
- `<StepNumber n color size>` — numerador circular de pasos ("Paso 1", "Paso
  2"…) para instructivos de conexión de equipos.
- `<NoteCard icon tone title text w>` — tarjeta de advertencia/aclaración.
  `tone`: `amber | sky | emerald`.
- `<Cursor x y o click>` — puntero con anillo de clic, para demostrar interacción.

**No dibujes ilustraciones en SVG.** Íconos geométricos sí; escenas, personas,
objetos o dispositivos dibujados a mano, no — para eso va un `PhotoSlot`.

---

## 6. Reglas de contenido y de marca

Fuente: `docs/branding/brand/*` y `docs/commercial/commercial-pitch.md` del
monorepo.

- **Paleta**: dark-first sobre zinc-950 (`C.bg`), acentos sky-500 y teal/emerald.
  Sin violetas "AI purple", sin gradientes agresivos de fondo.
- **Tipografías**: Outfit para texto, JetBrains Mono para datos, horas, IDs y
  volantas. Sin Inter, sin Roboto.
- **Escala mínima de texto: 24 px** en un lienzo de 1920×1080. Los subtítulos
  van en 42 px, los titulares entre 56 y 132 px.
- **Español rioplatense**, voseo, tono concreto y directo. Verbos de acción
  ("Cargás una vez", "Cambia solo"). Sin jerga técnica ni sustantivos abstractos.
- **Sin emoji.**
- **Cifras orgánicas y consistentes entre escenas.** El video de referencia usa
  14 pantallas, 4 sucursales, 86 % de conectividad, 14.110 reproducciones. Si
  cambiás una, revisá todas las demás.
- **Ahorro de hardware**: el argumento fuerte es 5× menos costo por pantalla
  (USD 80–200 con Raspberry Pi o tablet Android, contra USD 300–800 de un
  reproductor propietario), y que sigue reproduciendo si se corta internet.
  Esta comparación de costos es la ÚNICA excepción donde se puede nombrar el
  hardware real: es contra la competencia, no una pantalla que ve el cliente
  final (ver regla dura de nomenclatura abajo).

### Nomenclatura de producto (regla dura — ya se rompió una vez, no de nuevo)

**Al cliente final nunca se le dice "Raspberry Pi" ni "tablet Android".**
Verificado contra `docs/product/webapp-user-manual.md` (líneas 11, 71,
207-209):

| Hardware real (sólo en comentarios de código) | Nombre de producto | Cómo figura en el panel |
| --- | --- | --- |
| Raspberry Pi 5 | **Display-Ads Core Pro** | **"Pantalla"** |
| Tablet Android (Kiosk/Device Owner) | **Display-Ads Counter 15** | **"Mostrador"** |

En comentarios de código (`// por dentro es una Raspberry Pi 5 — nunca se lo
llama así en pantalla`) está bien aclarar el hardware real. En cualquier
texto que vea el cliente —guion, kicker, línea de escena, label de
`PhotoSlot`— **jamás**: sólo "Core Pro"/"Pantalla" y "Mostrador"/"Counter 15".
Ver `src/videos/conexion-core-pro/video.ts` y
`src/videos/conexion-mostrador/video.ts` para el patrón correcto.

### Datos, no markup

Los textos y cifras van en constantes tipadas arriba de cada escena
(`KPIS`, `TOP_CAMPANAS`, `PLANES`, `SUGERENCIAS`, `BARS`, `CREATIVES`…), no
hardcodeados en el JSX. Editar el video debe ser editar un array.

---

## 7. La estructura narrativa que funciona

El video de referencia va en cuatro actos. Para un video nuevo, conservá la
lógica aunque cambien los temas:

1. **El problema, en el local del cliente.** Arrancá en la realidad física del
   comercio (la pantalla con la promo vencida), no en el producto. Escena de
   apertura con ken burns y un dato incómodo.
2. **El producto haciendo el trabajo.** Panel real, cursor real, resultado
   visible en la pantalla del local. Mostrá el efecto, no la feature.
3. **El diferencial.** IA con contexto local, publicación masiva, costo de
   hardware.
4. **Medición y cierre.** Analíticas, vuelta al mismo encuadre de la apertura
   pero resuelto, tagline y CTA.

Ritmo: 8–13 s por escena. Menos de 8 no se lee; más de 13 se cae.

El cierre visual del arco se hace con el zoom: `Apertura` va de 1 → 1,06 y
`Noche` de 1,06 → 1, mismo encuadre, día resuelto.

---

## 8. Panel de tweaks

Los controles del preview se declaran en `App.tsx` con `useTweaks`, y sus
valores por defecto en `src/host/tweak-defaults.ts`
(`HOST_TWEAK_DEFAULTS` — hoy `captions` y `motionEditor`). Son controles del
HOST (qué se ve encima del stage), no propiedades de ningún video: por eso no
pasan por `defineVideo` ni viven como global en `index.html`. Reservalos para
lo que no se puede editar haciendo clic en el texto: interruptores de
comportamiento, variantes de tratamiento, un flag que cambia varias escenas a la
vez. No pongas un tweak por cada color o cada frase.

Controles disponibles: `TweakToggle`, `TweakSlider`, `TweakColor`,
`TweakSection`.

---

## 9. Entregables que acompañan a un video nuevo

- **`src/videos/<slug>/timeline.json`** y **`video.ts`** — el video en sí.
- **`guion-locucion.md`** — guion locutable con marcas de tiempo por escena,
  más notas de producción. Actualizalo siempre que cambien las duraciones o los
  textos: es lo que usa el locutor.
- **`src/videos/registry.spec.ts` actualizado** con el slug nuevo (paso 7 de
  la sección 4). Sin esto el ciclo no cierra: es el único lugar que verifica
  contra disco real que el video quedó bien dado de alta.
- **Placeholders pendientes** — dejá anotado en el README qué `PhotoSlot`
  esperan material real (podés dejarlos sin `src` a propósito).

## 10. El editor de timeline (dev-only) y el guardado

`<MotionEditor>` (`src/editor/MotionEditor.tsx`, montado desde
`src/host/VideoWorkspace.tsx`) trae, además del export, un botón **Guardar**
que persiste el timeline editado en disco (`src/editor/saveTimeline.ts` →
`POST /__motion-editor/save-timeline` → `vite-plugins/save-timeline.ts`). Ese
endpoint **sólo existe en desarrollo**: el plugin de Vite se registra con
`apply: 'serve'` (no entra al build) y el cliente chequea
`import.meta.env.DEV` antes del `fetch` (en producción esa rama se elimina
por dead-code elimination). No hace falta nada especial para "no exponerlo en
prod" — ya está resuelto por diseño; sólo tené presente que en un build de
producción ese botón, si se llegara a mostrar, no tendría con qué hablar.

## 11. Checklist antes de entregar

- [ ] `nx typecheck motion-editor` pasa limpio.
- [ ] El app NO tiene `package.json` propio; toda dep nueva va en la raíz.
- [ ] Toda escena nueva está envuelta en `<Frame>` y usa `useClock()`.
- [ ] Cero `setInterval` / `setTimeout` / `requestAnimationFrame` / CSS
      `animation` / CSS `transition` en `src/`.
- [ ] Las claves de `scenes` en `video.ts` coinciden exactamente con los
      `name` de `timeline.json` (tildes incluidas).
- [ ] Ningún texto por debajo de 24 px.
- [ ] Los `.jsx` vendorizados están sin tocar.
- [ ] Las cifras son consistentes entre escenas.
- [ ] El guion de locución refleja los textos y tiempos actuales.
- [ ] Ningún texto visible dice "Raspberry Pi" ni "tablet Android" — sólo
      "Core Pro"/"Pantalla" y "Mostrador"/"Counter 15".
- [ ] `src/videos/registry.spec.ts` incluye el slug del video nuevo.
- [ ] Se ve bien haciendo seek a varios timestamps, no sólo reproduciendo de
      corrido (probá el primer y el último frame de cada escena).
