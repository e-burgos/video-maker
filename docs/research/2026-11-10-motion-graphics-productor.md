# Motion graphics para el productor: más variedad en marca, animaciones y transiciones

> Fecha: 2026-11-10 · Tipo: análisis, sin implementación · Si se implementa, va como FIX GATE.

Objetivo del dev: que los videos de las marcas `displayads` y `displayads-webs-para-negocios` dejen de
verse todos iguales. Hoy se repiten tres cosas: la **presentación de marca** (los bumpers de intro y
outro), las **animaciones** dentro de las escenas y las **transiciones** entre cortes.

## 1. Cómo estamos hoy (lo que encontré en el repo)

Hay dos motores, y cada uno repite cosas distintas.

### Modo A: Remotion (montaje de material grabado, presets como `software-demo`)

- **Bumpers** (`libs/composition-remotion/src/components/logo-bumper-scene.tsx` +
  `helpers/logo-bumper-style.ts`): una placa de **color liso**, el logo centrado y una de tres
  entradas (`fade`, `zoom` desde 0,8, `slide-up` desde 12 %). Las tres duran lo mismo: 600 ms de
  entrada y 300 ms de salida, con la misma curva (ease-out cúbica). No hay fondo, ni tagline, ni
  revelado del logo por partes, ni sonido. El default del schema es `zoom`
  (`libs/timeline-core/src/schemas/timeline.schema.ts:142`), así que casi todos los videos salen con el
  mismo zoom.
- **Transiciones** (`libs/composition-remotion/src/transitions/presentation-for.ts`): el enum tiene
  cuatro (`fade`, `slide`, `whip-pan`, `light-leak`), pero solo hay **tres implementadas**:
  - `light-leak` **cae a `fade`**: el preset `recipe` lo pide y sale un fundido común.
  - `whip-pan` es propio (`transitions/whip-pan.tsx`).
  - Cada preset fija dos tipos (`software-demo`: `whip-pan` + `fade`; `educational`: solo `fade`;
    `hardware`: `slide` + `fade`). Un tutorial de software alterna siempre los mismos dos.
- **Ya está instalado** `@remotion/transitions@4.0.522`, pero solo se usan `fade` y `slide`. Las
  demás presentaciones oficiales (`wipe`, `flip`, `clockWipe`, `iris`) vienen en el mismo paquete y no
  se usan.
- **Tipografía:** `kinetic-captions.tsx` anima los subtítulos palabra por palabra. Es lo único
  "cinético" del modo A. No hay títulos, lower thirds ni carteles de capítulo animados.

### Modo B: HyperFrames + GSAP (motion graphics diseñados, `libs/motion-graphics`)

- **Catálogo de 17 escenas** (`motion-storyboard.schema.ts`) con un solo layout cada una. La de marca,
  `brand-reveal`, acepta solo `tagline`, `accent` y hasta 3 `chips`: es siempre el mismo revelado.
- **6 ilustraciones animadas** a mano en SVG (`scenes/animations.ts`: `delivery`, `payment`,
  `orders`, `secure-cloud`, `domain`, `publish`). Están atadas a Display Ads; para otra marca o tema no
  hay nada.
- **~30 primitivas de entrada** en el runtime (`assets/runtime/motion-runtime.js`: `rise`, `left`,
  `pop`, `blur`, `wipe`, `draw`, `type`, `count`, `kenburns`…). Es un buen vocabulario, pero
  `rise` y `pop` dominan.
- **Transición entre escenas: una sola.** Todas las escenas salen con la misma combinación de
  opacidad, `y: -24` y `blur(8px)` en 0,35 s, y la última con un fundido de 1,1 s
  (`motion-runtime.js:293-296`). Además hay un flash blanco opcional. **Esto es lo que más se nota**:
  todos los cortes del modo B son idénticos.
- Usamos HyperFrames como motor (`hyperframes@0.8.139`) y ya traemos sus 8 SFX, pero **no usamos su
  catálogo** de bloques ni sus transiciones con shaders.

### Skills

- `motion-studio` documenta el catálogo y el pipeline; no le da al productor una regla de variedad
  (no hay "no repitas la misma entrada dos escenas seguidas").
- `motion-video-brief` arma el brief; tampoco pide un estilo de marca distinto por video.

**Resumen del diagnóstico:** el problema es la falta de **rotación**, más que de librerías. Hay recursos
instalados que no se usan (presentaciones de `@remotion/transitions`, catálogo de HyperFrames, GSAP
SplitText), un tipo prometido que no existe (`light-leak`) y defaults únicos (bumper `zoom`, salida
de escena única). La mitad de la mejora sale sin agregar dependencias.

## 2. Candidatos evaluados

| Candidato | Motor | Licencia (uso comercial y en el instalador) | Qué aporta | Costo | Mantenimiento | Veredicto |
|---|---|---|---|---|---|---|
| **Presentaciones oficiales de `@remotion/transitions`** (`wipe`, `flip`, `clockWipe`, `iris`, `zoomBlur`, `zoomInOut`) | A | Remotion License (la misma que ya usamos) | 6+ transiciones nuevas | Muy bajo: ya instalado | Oficial | **Adoptar** |
| `cube()` (`@remotion-dev/cube-presentation`) | A | **Pago** aparte | 1 transición | — | Oficial | **Descartar** |
| **`lightLeak()` de `@remotion/effects`** (o `@remotion/light-leaks`, deprecado en 5.0) | A | Remotion License | Implementa el `light-leak` que hoy es un `fade`; destellos para bumpers | Bajo | Oficial | **Adoptar** |
| **`@remotion/noise`, `@remotion/shapes`, `@remotion/paths`, `@remotion/motion-blur`** | A | Remotion License | Fondos vivos para bumpers (ruido, formas), logo que se dibuja trazo por trazo, motion blur | Bajo | Oficial | **Adoptar** (para bumpers) |
| **Catálogo de HyperFrames** (bloques, lower thirds `lt-mask-reveal` / `lt-clean-bar`, logo outro) + **`@hyperframes/shader-transitions`** (14 transiciones WebGL: whip pan, glitch, light leak, vortex, iris, burn…) | B | Apache 2.0 (el motor; confirmar los bloques uno por uno) | Lower thirds, logo outro y 14 transiciones entre escenas | Medio: hay que adaptar cada bloque a nuestro runtime y a la marca | Activo (HeyGen, el mismo motor que usamos) | **Adoptar** (empezar por transiciones) |
| **GSAP SplitText / MorphSVG / DrawSVG** | B (y A si se quisiera) | Gratis también para uso comercial desde GSAP 3.13 (licencia "Standard No Charge" de Webflow). Excluye "productos competidores" (constructores visuales de animación tipo Webflow) | Tipografía cinética por letra/palabra/línea, morph de logo | Bajo: GSAP ya está empaquetado | Activo | **Adoptar**, con nota legal (ver §3) |
| **Onda** (`degueba/onda`) | A | MIT (código); el nombre y el logo de Onda no | 70 componentes en 8 categorías + 18 transiciones; se copian como código propio | Bajo por pieza | Proyecto chico, reciente | **Probar** (copiar piezas, no depender) |
| **Remocn** (`remocn.dev`) | A | MIT | ~230 primitivas copy-paste estilo shadcn (fades, wipes, títulos cinéticos) | Bajo por pieza | Comunidad, reciente | **Probar** (misma estrategia que Onda) |
| Remotion Bits (`av/remotion-bits`) | A | **No confirmada** (el README remite a un LICENSE que no pude leer) | Bloques + MCP para agentes | Bajo | Un autor | **Probar solo si la licencia es permisiva** |
| Curvable/motion, SwiftClip, 21st.dev Kinetic Title | A | MIT | Títulos cinéticos sueltos | Bajo | Variable | **Referencia** (ideas, no dependencia) |
| **`@remotion/lottie` + bancos Lottie** | A (y B con `lottie-web`) | Paquete: Remotion License. Contenido: **useAnimations** MIT; **LottieFiles** "Lottie Simple License" (comercial sin atribución, pero prohíbe armar una colección competidora y algunos ítems tienen términos propios); **Lordicon** gratis solo con atribución; IconScout gratis con link | Íconos animados, ilustraciones, celebraciones; sirven para salir de las 6 animaciones propias | Medio: curar a mano, recolorear con la marca | Paquete oficial; bancos estables | **Probar** con un set curado chico |
| `@remotion/rive` + Rive | A | Paquete: Remotion License; runtime de Rive MIT; los assets de la comunidad tienen licencias por archivo | State machines interactivas; en video no aprovechamos lo interactivo | Alto: cada animación se diseña en el editor de Rive | Activo | **Descartar** |
| Paper Shaders (`@paper-design/shaders-react`) | A y B | **Contradictoria**: npm dice MIT, las docs dicen PolyForm Shield 1.0 (comercial salvo productos que compitan con Paper). Verificar el LICENSE de la versión que se fije | Fondos de gradiente en malla, grano, ondas para bumpers | Bajo | Activo | **Probar** solo después de verificar la licencia; `@remotion/noise` cubre lo mismo sin dudas |
| Motion Canvas / Revideo | Motor nuevo | MIT (no confirmado en la fuente oficial) | Lo mismo que ya hacemos | Muy alto: sería un tercer motor | Revideo activo, Motion Canvas sin señales claras | **Descartar** |

## 3. Qué nos resuelve cada uno

### Presentaciones oficiales + `lightLeak` → **transiciones del modo A** · **ADOPTAR**

- **Problema real:** cada preset alterna dos transiciones y una de las cuatro del enum no existe.
- **Integración:**
  - Sumar `wipe`, `flip`, `clock-wipe`, `iris` y `zoom-blur` a `TimelineTransitionKindSchema` y
    `EditDecisionList`. Agregar los `case` en `presentation-for.ts` y ampliar los `kinds` de cada preset.
  - Implementar `light-leak` de verdad: el `<LightLeak>` de `@remotion/light-leaks` va como overlay
    en el corte. Funciona en 4.0.522 y queda deprecado en 5.0. `lightLeak()` de `@remotion/effects`
    es el reemplazo, pero solo se aplica a componentes con canvas (`Video`, `CanvasImage`, `Solid`):
    hay que confirmar que el A-roll lo soporte.
  - Agregar una **regla de rotación con semilla por video**: el preset trae un pool y el armado elige
    sin repetir la misma transición dos cortes seguidos. Así dos videos del mismo preset tampoco salen
    con la misma secuencia.
- **Esfuerzo:** 1–1,5 días (schema + presentaciones + rotación + tests).
- **Riesgos:**
  - `zoomBlur` y `zoomInOut` son presentaciones "HTML-in-canvas": hay que probarlas con nuestro
    render local antes de prometerlas.
  - Agregar paquetes `@remotion/*` nuevos exige fijar la **misma versión** que el resto (4.0.522).

### Paquetes oficiales de Remotion para bumpers → **presentación de marca del modo A** · **ADOPTAR**

- **Problema real:** placa lisa + logo + un zoom. Es lo que más "se ve igual".
- **Integración:** pasar de `animation: fade|zoom|slide-up` a un **estilo de bumper** con varias
  piezas independientes que se combinan:
  - **fondo:** liso, gradiente de la marca, ruido animado (`@remotion/noise`), formas que entran
    (`@remotion/shapes`) o light leak;
  - **revelado del logo:** el zoom actual, máscara/wipe, trazo que se dibuja (`@remotion/paths`
    sobre el SVG del logo, si la marca lo tiene en SVG) o entrada con motion blur;
  - **remate:** nada, tagline tipeada, URL o handle;
  - **SFX:** whoosh o impacto de los 8 que ya traemos.

  La marca (`brand.json`) declara qué combinaciones permite y el productor rota entre ellas. El
  outro puede ser distinto del intro, con CTA o URL.
- **Esfuerzo:** 2–3 días para 4–5 fondos × 4 revelados (≈ 20 combinaciones) con tests de estilo como
  los de `logo-bumper-style.spec.ts`.
- **Riesgos:** el revelado por trazo necesita el logo en SVG de trazos; con PNG queda en máscara.

### Catálogo y shader transitions de HyperFrames → **transiciones y lower thirds del modo B** · **ADOPTAR**

- **Problema real:** las escenas del modo B tienen **una sola salida**, y eso pesa más que el
  catálogo de escenas.
- **Integración, en dos pasos:**
  1. **Sin dependencias:** hacer configurable la salida en `motion-runtime.js` (`data-exit` por escena:
     `blur-up` el actual, `wipe`, `scale-down`, `slide-left`, `iris`, `flash`). El compositor rota con
     semilla y respeta capítulos: corte fuerte al cambiar de capítulo, corte suave dentro del mismo.
     Son primitivas GSAP de pocas líneas, como las que ya hay.
  2. **Con HyperFrames:** probar `@hyperframes/shader-transitions` (whip pan, glitch, light leak,
     vortex, burn) entre escenas, y portar los dos lower thirds (`lt-mask-reveal`, `lt-clean-bar`) y
     el logo outro como escenas nuevas del catálogo (`lower-third` y una variante de `brand-reveal`).
- **Esfuerzo:** paso 1, 1 día. Paso 2, 2–3 días (cada bloque es una composición completa con
  duración y tamaño fijos: hay que adaptarlo a nuestros cues y tokens de marca, no se pega tal cual).
- **Riesgos:**
  - Las transiciones WebGL dependen de que el Chrome headless del render tenga GPU o SwiftShader. Hay
    que medir el tiempo de render en la Mac y en el instalador.
  - Fijar la versión del paquete a la de `hyperframes@0.8.139` y confirmar la licencia de cada bloque
    del registry (el motor es Apache 2.0).

### GSAP SplitText → **tipografía cinética del modo B** · **ADOPTAR (con nota legal)**

- **Problema real:** los títulos entran enteros con `rise`/`pop`. No hay entradas por letra, por
  palabra ni por línea, ni máscaras de texto.
- **Integración:** registrar SplitText (ya viene dentro de `gsap` desde 3.13; hay que verificar que el
  `gsap.min.js` empaquetado lo incluya o sumar el plugin). Nuevas primitivas `split-chars`,
  `split-words`, `split-lines`, `mask-up` y `scramble` en el runtime, y que el schema permita elegir
  `titleStyle` por escena con rotación.
- **Esfuerzo:** 1 día.
- **Nota legal:** la licencia excluye los "productos competidores", definidos como herramientas para
  crear o editar animaciones con una interfaz visual tipo Webflow. Video Maker produce videos y no es
  un constructor de animaciones web, así que el riesgo es bajo. Igual conviene que el dev lo lea antes
  de empaquetarlo en el instalador. MorphSVG y DrawSVG (morph y trazo del logo en el modo B) entran
  con la misma licencia.

### Onda y Remocn → **lower thirds y títulos del modo A** · **PROBAR**

- **Problema real:** el modo A no tiene títulos, capítulos ni lower thirds animados. Escribirlos de
  cero es lento.
- **Por qué probar y no adoptar:** los dos son proyectos chicos y recientes. Su modelo (copiar el
  `.tsx` al repo) es justamente el que conviene: el código queda nuestro, MIT, sin depender de que
  sigan mantenidos.
- **Integración:** elegir 3–4 piezas (un lower third, un título de capítulo, un texto cinético y una
  transición), copiarlas a `libs/composition-remotion/src/components/`, pasarlas a los tokens de marca
  y sacarles los comentarios (regla del repo). Hay que conservar el aviso MIT y no usar el nombre ni
  el logo de Onda.
- **Esfuerzo:** 0,5 día de prueba; 1–2 días para integrar 3–4 piezas con su lugar en la timeline
  (pista de overlays de texto).
- **Riesgos:** calidad despareja entre piezas; el estilo de la comunidad tiende a "plantilla de
  YouTube". Hay que pasarlo por la marca.

### Lottie → **ilustraciones e íconos animados** · **PROBAR con un set curado**

- **Problema real:** las 6 animaciones del modo B están dibujadas a mano para Display Ads. Para
  Webs para negocios, o un tema nuevo, no hay nada.
- **Integración:** `@remotion/lottie` en el modo A y `lottie-web` en el modo B (HyperFrames soporta
  Lottie). Armar un banco **curado y chico** (20–40 archivos) en `libs/motion-graphics/assets/lottie/`
  con un `CREDITS.md` por archivo, como la música. Recolorear con la paleta de la marca (los JSON de
  Lottie permiten reemplazar colores).
- **Licencias, en orden de preferencia:**
  1. **useAnimations** (MIT): solo íconos de UI.
  2. **LottieFiles** gratis (Lottie Simple License): comercial sin atribución, pero hay que revisar
     cada ítem (algunos tienen términos del autor). La licencia prohíbe armar una colección que
     compita con LottieFiles: un banco interno de 40 archivos dentro del instalador no lo es, pero no
     debería exponerse como galería navegable en la app.
  3. **Lordicon** gratis y **IconScout** gratis: exigen atribución. Se puede (los créditos ya van a la
     descripción de YouTube), pero suma trabajo en cada video.
- **Esfuerzo:** 0,5 día para probar el render en ambos modos; 1–2 días para curar, recolorear y sumar
  `visual: { kind: 'lottie', name }` al schema.
- **Riesgos:** muchos Lottie gratis usan expresiones o efectos de After Effects que `lottie-web` no
  soporta. Se ven bien en la web de LottieFiles y mal en el render: hay que validar cada uno en un render
  real.

### Paper Shaders → **fondos** · **PROBAR, después de verificar la licencia**

Dan gradientes en malla y texturas muy buenas para bumpers y fondos de escena, pero la licencia es
contradictoria (MIT en npm, PolyForm Shield en sus docs). `@remotion/noise` y CSS cubren el 80 % sin
esa duda. Queda para cuando lo demás esté hecho.

### Descartados

- **Rive:** pensado para animación interactiva con state machines. En video no lo aprovechamos y cada
  pieza hay que diseñarla en su editor.
- **`cube()`:** es paga, y `flip` da un efecto parecido gratis.
- **Motion Canvas / Revideo:** serían un tercer motor para hacer lo que ya hacemos con dos.
- **Remotion Bits:** hasta que se confirme la licencia.

## 4. Plan por etapas (si el dev lo aprueba, cada etapa es un FIX)

| Etapa | Qué | Resultado visible | Esfuerzo |
|---|---|---|---|
| 0 | **Sin dependencias nuevas:** salidas de escena rotativas en el modo B (`data-exit`), rotación con semilla de transiciones en los presets del modo A, y `light-leak` deja de ser un `fade` | Dos cortes seguidos nunca son iguales; dos videos del mismo preset tampoco | 1,5–2 días |
| 1 | **Transiciones oficiales** de `@remotion/transitions` (`wipe`, `flip`, `clockWipe`, `iris`, `zoomBlur`) en schema, presets y `presentation-for.ts` | Pool de ~9 transiciones en el modo A | 1 día |
| 2 | **Bumpers por piezas** (fondo × revelado × remate × SFX) con `@remotion/noise`, `shapes`, `paths` y `motion-blur`; combinaciones permitidas en `brand.json`; intro y outro distintos | La presentación de marca deja de ser placa + zoom: ~20 combinaciones por marca | 2–3 días |
| 3 | **Tipografía cinética en el modo B** con GSAP SplitText (`split-chars/words/lines`, `mask-up`) + `titleStyle` por escena | Títulos que entran por letra, palabra o línea, rotando | 1 día |
| 4 | **HyperFrames:** shader transitions entre escenas y escenas nuevas `lower-third` y logo outro portadas del catálogo | Cortes con glitch, light leak o burn, y lower thirds en el modo B | 2–3 días |
| 5 | **Onda / Remocn:** 3–4 piezas copiadas (lower third, capítulo, texto cinético) en una pista de overlays de texto del modo A | Tutoriales con títulos y lower thirds animados | 1,5–2 días |
| 6 | **Lottie curado** (20–40 archivos recoloreables con créditos) en ambos modos | Ilustraciones para temas fuera de Display Ads | 1,5–2 días |
| 7 | Skills `motion-studio` y `video-producer`: regla de variedad para el productor (no repetir entrada, salida ni transición seguidas; un estilo de bumper distinto al video anterior de la misma lista) | El productor elige variado aunque el modelo tienda a repetir | 0,5 día |

Orden sugerido: **0 → 2 → 1 → 3 → 7**, y después 4, 5 y 6 según lo que más se note.

- La etapa 0 sola ya ataca el "todo se ve igual" sin sumar nada.
- La 2 ataca lo más visible: la marca abre y cierra cada video.
- Total de las etapas 0–3 y 7: **6–7,5 días**. Con todas: **11–14,5 días**.

Antes de publicar cualquier video con recursos nuevos rige la regla de siempre: validación completa y
orden del dev.

## 5. Resumen para el dev

- **El problema es la falta de rotación, más que de librerías.** Hay recursos instalados que no
  usamos. `@remotion/transitions` trae `wipe`, `flip`, `clockWipe` e `iris`. HyperFrames tiene un
  catálogo con lower thirds y 14 transiciones con shaders. GSAP ya incluye SplitText gratis.
- **Dos cosas concretas que se ven mal hoy:**
  - el `light-leak` que pide el preset `recipe` sale como un fundido común;
  - en el modo B **todas** las escenas salen con la misma animación.
- **Adoptar:**
  - las presentaciones oficiales de Remotion y `lightLeak`;
  - los paquetes `noise`/`shapes`/`paths`/`motion-blur` para bumpers por piezas;
  - SplitText para tipografía cinética;
  - las shader transitions y los lower thirds de HyperFrames.

  Todo con licencias que ya aceptamos (Remotion License, Apache 2.0, GSAP gratis).
- **Probar:**
  - Onda y Remocn (MIT, copiar piezas);
  - un banco Lottie curado (useAnimations MIT y LottieFiles revisando cada ítem);
  - Paper Shaders, solo si se aclara su licencia.
- **Descartar:** Rive, `cube()` (pago), Motion Canvas/Revideo (un tercer motor) y Remotion Bits
  (licencia sin confirmar).
- **A confirmar antes de empaquetar en el instalador:**
  - la cláusula de "productos competidores" de GSAP (riesgo bajo);
  - la licencia de cada bloque del registry de HyperFrames;
  - que la Remotion License siga cubriendo al equipo (gratis hasta 3 personas; desde 4, licencia de
    empresa). No cambia con este plan, pero cada paquete `@remotion/*` nuevo entra bajo esa misma
    licencia.

No se instaló ni se tocó nada. Cada etapa va como FIX GATE con el OK del dev.

## Fuentes

- Remotion: [presentaciones de transiciones](https://www.remotion.dev/docs/transitions/presentations),
  [iris](https://remotion.dev/docs/transitions/presentations/iris),
  [clock wipe](https://www.remotion.dev/docs/transitions/presentations/clock-wipe),
  [cube (pago)](https://www.remotion.dev/docs/transitions/presentations/cube),
  [light leaks (deprecado)](https://remotion.dev/docs/light-leaks),
  [`@remotion/effects` light leak](https://remotion.dev/docs/effects/light-leak),
  [effects](https://www.remotion.dev/docs/effects), [API / paquetes](https://www.remotion.dev/docs/api),
  [noise](https://www.remotion.dev/docs/noise), [Rive](https://www.remotion.dev/docs/rive/),
  [recursos de la comunidad](https://www.remotion.dev/docs/resources),
  [licencia](https://remotion.dev/license), [FAQ de licencia](https://www.remotion.dev/docs/license/faq)
- HyperFrames: [repo](https://github.com/heygen-com/hyperframes),
  [overview](https://developers.heygen.com/hyperframes-overview),
  [video components](https://hyperframes.heygen.com/guides/video-components),
  [catálogo (contribuir)](https://hyperframes.heygen.com/contributing/catalog),
  [skill registry](https://skills.cat/skills/heygen-com/hyperframes/hyperframes-registry)
- GSAP: [GSAP 100 % gratis](https://webflow.com/blog/gsap-becomes-free),
  [licencia estándar](https://gsap.com/community/standard-license/), [GSAP 3.13](https://gsap.com/blog/3-13/)
- Comunidad Remotion: [Onda](https://github.com/degueba/onda),
  [Remocn](https://awesome.ecosyste.ms/projects/github.com%2FRemocn%2Fremocn),
  [Remotion Bits](https://github.com/av/remotion-bits), [Curvable/motion](https://github.com/Curvable/motion),
  [remotion-templates](https://github.com/reactvideoeditor/remotion-templates)
- Lottie: [LottieFiles uso comercial](https://help.lottiefiles.com/hc/en-us/articles/900002438343-Can-I-use-a-free-animation-on-Lottiefiles-for-commercial-business-use),
  [licencias LottieFiles](https://help.lottiefiles.com/animation-licensing-basics-),
  [useAnimations](https://useanimations.com/licencing-and-terms),
  [Lordicon gratis](https://lordicon.com/docs/license/free)
- Rive: [runtimes MIT](https://rive.app/docs/runtimes)
- Paper Shaders: [npm](https://www.npmjs.com/package/@paper-design/shaders-react),
  [docs](https://www.mintlify.com/paper-design/shaders/introduction)
- Revideo / Motion Canvas: [comparativa 2026](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026),
  [Revideo](https://bestofjs.org/projects/revideo)
