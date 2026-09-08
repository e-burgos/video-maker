# Architect — Cycle 2: Kinetic Captions & Safe Zones (`libs/composition-remotion`)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/brief.yaml
> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/functional.md
> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/architect.md (D-01..D-12, R-1..R-9)
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect

---

## 0. Alcance de este documento

`cycle-02` cierra la spec: le pone movimiento a la capa de decisión que dejó `cycle-01`. Entrega tres
helpers puros nuevos, un componente, la baja de `CaptionTrack` y una composición de galería para
`remotion studio`.

- **Cambios en `sdd/schema.json`: NO APLICA.** No hay base de datos en el motor de composición. El
  único contrato de datos es la `Timeline` de `@video-maker/timeline-core`, que este ciclo **consume
  sin modificar** (D-A, RNF-4). `existing_tables: []` del brief es literal.
- **Cambios en `sdd/api.json`: NO APLICA.** No hay endpoints HTTP. La superficie es una API de
  módulo TypeScript (§3 a §9). `existing_endpoints: []` es literal.
- **Cambios en `sdd/components.json`: SÍ APLICA** — §8.4. Es el único registro SDD que este ciclo
  toca, porque el ciclo crea, actualiza y da de baja componentes React.

**Contexto técnico vinculante leído:** `sdd/context/libs/composition-remotion/constitution.md` +
`context_prompt.md` + `updates/2026-09-07-spec-e-burgos-001-cycle-03.md` +
`updates/2026-09-07-spec-e-burgos-003-cycle-01.md`, **en ese orden**. De ahí, y del architect de
`cycle-01`, salen las restricciones que atraviesan todo el diseño y **tienen precedencia sobre
cualquier preferencia propia**:

1. `eslint.config.mjs` prohíbe `node:*` / `fs` / `path` / `child_process` / `os` y los paquetes Node
   de Remotion en todo `src/**` salvo `render.ts` y `smoke.ts`; y `Date` / `process` / `Math.random`
   en el barrel.
2. `vite.config.ts` mide cobertura **solo** sobre `src/helpers/**/*.ts` + `src/transitions/**/*.ts`,
   umbral 80 %, piso real heredado **96.2 % stmts / 92.38 % ramas** (cycle-01).
3. `tsconfig.lib.json`: `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`,
   `verbatimModuleSyntax: true`. `vitest` **no typechequea**: un error de estos aparece recién en
   `nx build`.
4. `libs/timeline-core` no se toca. `Fps` es la unión literal `24 | 25 | 30 | 50 | 60`, no `number`.

---

## 1. Decisiones técnicas (continúan la numeración de `cycle-01`)

### D-13 · `caption-animation.ts` es el primer helper que importa `remotion` — y es correcto

`cycle-01` §10.3 dejó como propiedad que **ningún** helper importara `remotion`. Este ciclo la rompe
deliberadamente en un solo archivo: `captionClipAnimation` usa `spring()` e `interpolate()` de
`remotion`, que es exactamente lo que manda **D-F** de la spec ("apoyadas en `spring()` e
`interpolate()` de `remotion` (funciones puras, no hooks)").

Por qué está bien y qué no cambia:

- `spring()` e `interpolate()` son **funciones puras exportadas del paquete raíz `remotion`**, no
  hooks ni componentes: no necesitan contexto de composición, no leen el DOM, no salen a la red.
- `remotion` **no** está en `no-restricted-imports` del `eslint.config.mjs` de la lib (los prohibidos
  son `@remotion/bundler` y `@remotion/renderer`, que sí son Node). No hace falta tocar el linter.
- El barrel ya arrastra `remotion` por los componentes (`ArollSeries`, `BrollTrack`, …): la propiedad
  "el barrel carga en un browser" **no se degrada**.
- Reimplementar la física del spring a mano para evitar el import sería peor por todos lados: más
  código, otra curva, y un `cycle-02` que no cumple D-F.

Consecuencia operativa: `caption-animation.spec.ts` carga el paquete `remotion` dentro de jsdom.
Sigue sin haber red, sin Chrome y sin render — RNF-1 intacto. Ver R-11.

### D-14 · La animación es un campo nuevo y **requerido** del preset: `CaptionPreset.animation`

Los parámetros de `spring` salen del preset, no de una tabla paralela ni de constantes sueltas. El
preset es la única fuente de verdad del *look*, y el movimiento es parte del look.

- Se agrega el campo 23 `animation: CaptionAnimation` a `CaptionPreset`, **requerido**, y los cuatro
  literales de `CAPTION_PRESETS` lo declaran (§4). Esto respeta la regla de `cycle-01`: *el registro
  es exhaustivo, todo preset declara todos los campos*, y nunca `?`.
- **No rompe ningún test existente.** `caption-preset.spec.ts` verifica invariantes campo por campo
  (`fontFamily` termina en genérico, `emphasisFontWeight !== fontWeight`, `emphasisColor !== color`,
  rangos de ratios) — ninguna aserción es una igualdad estructural del objeto preset completo.
  `caption-word-style.spec.ts`, `caption-box.spec.ts` y `caption-font-size.spec.ts` leen campos
  puntuales del preset y comparan el objeto **devuelto por el helper**, no el preset. Un campo nuevo
  es invisible para los tres.
- La alternativa descartada — `CAPTION_ANIMATIONS: Record<CaptionPresetId, …>` en
  `caption-animation.ts` — obligaría a `captionClipAnimation` a hacer un lookup por `preset.id` con
  su rama de fallback (rama que `cycle-01` ya pagó una vez en `captionPreset`), y partiría la
  definición de un look en dos archivos que hay que mantener sincronizados a mano.

### D-15 · `CaptionAnimation` es una unión discriminada por `mode`, y vive en `caption-animation.ts`

```ts
export type CaptionAnimationMode = 'pop' | 'rise' | 'fade';

export interface CaptionSpring {
  damping: number;
  mass: number;
  stiffness: number;
}

export type CaptionAnimation =
  | { mode: 'pop'; spring: CaptionSpring; enterDurationFrames: number; enterScale: number }
  | { mode: 'rise'; spring: CaptionSpring; enterDurationFrames: number; riseDistanceEm: number }
  | { mode: 'fade'; spring: CaptionSpring; enterDurationFrames: number };
```

- **Unión, no interfaz plana**, para que sea imposible declarar un preset `fade` con un `enterScale`
  que nadie va a leer. Los campos muertos son documentación que miente.
- **Vive en `caption-animation.ts`, no en `caption-preset.ts`**, por el mismo criterio con que
  `cycle-01` puso `CaptionAnchor` en `caption-box.ts`: la animación es una noción de movimiento, el
  preset solo elige una. `caption-preset.ts` la importa con `import type`.
- Los dos imports entre ambos módulos son **type-only** (`caption-preset` ← `CaptionAnimation`;
  `caption-animation` ← `CaptionPreset`), y con `verbatimModuleSyntax` un `import type` se borra
  entero al emitir: **no hay ciclo de imports en runtime**. Es la misma forma que ya tiene el par
  `caption-preset` / `caption-box`.

### D-16 · `captionClipAnimation` devuelve valores numéricos **y** el `transform` ya armado

No devuelve `CSSProperties`: devuelve `{ opacity, scale, translateYEm, transform }`. Motivo directo
de CA-006, que exige leer `opacity` y `scale` como números (`opacity < 1`, `scale < 1`,
`scale === 1`). Si el helper devolviera solo CSS, el test tendría que parsear un string con una
regex — y un test que parsea se rompe cuando cambia el formateo, no cuando cambia la lógica. El
`transform` armado viene de yapa para que el componente no concatene strings (§7).

### D-17 · La curva de presencia es `enter + exit - 1`, no `min(enter, exit)`

El clip tiene un tramo de entrada y uno de salida **simétrico** (RN-2). La tentación es
`progress = Math.min(enter, exit)`: **está mal**, porque el `min` recorta justamente el overshoot del
spring, que es el rebote que da sentido al modo `pop`. La forma correcta es restar los dos déficits:

```
progress = enter + exit - 1     ( ≡ 1 - (1 - enter) - (1 - exit) )
```

| Instante                       | `enter` | `exit` | `progress` |
| ------------------------------ | ------- | ------ | ---------- |
| frame 0                        | 0       | 1      | **0**      |
| durante la entrada (overshoot) | 1.17    | 1      | **1.17**   |
| meseta                         | 1       | 1      | **1**      |
| durante la salida (overshoot)  | 1       | 1.17   | **1.17**   |
| último frame                   | 1       | 0      | **0**      |

Exactamente 0 en los dos extremos, exactamente 1 en la meseta, y el rebote sobrevive en los dos
tramos. Sin ramas.

### D-18 · La duración de entrada se acota contra la duración del clip con `Math.min`, no con un `if`

```ts
function enterFramesFor(preferredFrames: number, durationInFrames: number): number {
  return Math.max(1, Math.min(preferredFrames, Math.floor(durationInFrames / 2)));
}
```

Un clip más corto que el doble de la entrada tendría los dos tramos superpuestos y nunca llegaría a
opacidad plena. Acotar con `Math.min`/`Math.max` en vez de un `if` da la misma robustez **sin sumar
ramas** al contador de cobertura (v8 no cuenta `Math.min` como branch) y sin crear una rama muerta —
la crítica que `cycle-01` le hizo a las guardas defensivas en R-5.

### D-19 · R-9 resuelto: gana el preset; `clip.box` es un override **opt-in** vía `boxSource`

Ver §6.2 para el análisis completo y la evidencia. En una línea:
`<KineticCaptions boxSource="preset" />` (**default**) ignora `clip.box` y usa siempre
`captionBoxFor(captionSafeZone(format, platform, safeZone), format, preset, anchor)`;
`boxSource="clip"` reproduce el comportamiento histórico de `CaptionTrack`
(`clip.box ?? cajaDelPreset`).

### D-20 · R-8 resuelto por **niveles del árbol**, no por composición de strings

El `transform` del bloque animado y el `scale(...)` de la palabra **nunca tocan el mismo elemento**:
viven en dos elementos distintos y el navegador los compone por anidamiento. Detalle y orden exacto
en §7.2.

### D-21 · `vite.config.ts` **no se toca**: el componente se testea pero no cuenta para cobertura

Agregar `src/components/**` al `include` arrastraría `broll-track`, `audio-track`, `aroll-series`,
`timeline-composition` y `caption-preset-gallery`, ninguno con spec propio: la cobertura se
desplomaría muy por debajo del piso de RNF-2 y el número dejaría de ser comparable con el de
`cycle-01` (R-6). El `include` queda **idéntico** a `cycle-01` y a `cycle-03` de spec-001.

La contrapartida es explícita: **toda la lógica del ciclo vive en `src/helpers/`** y el componente
queda como cableado sin decisiones. Por eso existe `caption-clip-plan.ts` (§6) — para que la
precedencia de R-9, la resolución de la caja y el tamaño de letra estén bajo cobertura en vez de
escondidos dentro del `.tsx`. `kinetic-captions.spec.tsx` corre igual y verifica CA-009 (§10.2): que
no sume cobertura no significa que no verifique.

### D-22 · Props opcionales declaradas `?: T | undefined`, con el `| undefined` explícito

Con `exactOptionalPropertyTypes: true`, `preset?: CaptionPresetId` **no** admite que le pasen una
variable de tipo `CaptionPresetId | undefined` — y eso es exactamente lo que hace
`TimelineComposition` al reenviar sus props. La forma que compila es
`preset?: CaptionPresetId | undefined`. Aplica a todas las props opcionales de `KineticCaptions`,
`CaptionPresetGallery` y a los campos opcionales de `CaptionClipPlanInput`. Es el hermano del R-7 de
`cycle-01`: `vitest` no typechequea, así que el error saldría recién en `nx build`.

### D-23 · `calculateTimelineMetadata` debe **preservar** las props que no calcula

`calculateMetadata` en Remotion **reemplaza** el objeto de props que recibe el componente. Hoy
devuelve `props: { timeline: metadata.timeline }`, lo cual está bien porque `timeline` es la única
prop. En cuanto `TimelineComposition` acepte `captionPreset` / `captionPlatform` / `captionAnchor`
(RF-9), ese literal las **borraría en silencio**: la galería y los `defaultProps` del Studio dejarían
de tener efecto sin ningún error. La línea pasa a ser:

```ts
props: { ...props, timeline: metadata.timeline }
```

### D-24 · El frame que consumen los helpers es **relativo al clip**, y lo garantiza `Sequence`

`useCurrentFrame()` **dentro de un `<Sequence from={n}>` devuelve el frame rebasado a 0 en el
comienzo de la sequence**. Eso es justo lo que necesitan los dos helpers: `word.fromFrame` viene de
`buildTimeline` calculado como `frameWithinKeep(...) - from`, o sea también relativo al clip; y
`captionClipAnimation` razona sobre `[0, durationInFrames)`. **Ningún helper recibe el frame absoluto
de la composición.**

Contrapartida obligatoria: `durationInFrames` **se pasa por props desde el plan**, nunca se lee de
`useVideoConfig()`. `useVideoConfig()` reporta la duración de la *composición*, no la de la
`Sequence`; usarlo daría una entrada/salida calculada sobre 265 frames en vez de sobre 45. De
`useVideoConfig()` se toma **solo `fps`**.

### D-25 · `fps` se tipa `number`, nunca `Fps`

`Fps` en `timeline-core` es la unión literal `24 | 25 | 30 | 50 | 60`; `useVideoConfig().fps` es
`number`. Tipar el input como `Fps` obligaría a un cast en el componente. `CaptionClipAnimationInput`
declara `fps: number` — que además es lo que `spring()` espera.

### D-26 · `captionLayout` se va con `CaptionTrack`

`cycle-01` D-11 lo dejó anunciado ("ambos se dan de baja en `cycle-02`") y este ciclo lo ejecuta: se
borran `src/helpers/caption-layout.ts` y `caption-layout.spec.ts`, y sale del barrel. Dejarlo vivo
mantendría una segunda forma —sutilmente distinta, sin anclaje ni alto de preset— de calcular la caja
de captions, disponible desde la superficie pública, que inevitablemente diverge de `captionBoxFor`.
Detalle en §8.

### D-27 · El separador entre palabras es `columnGap` del contenedor, no `marginRight` por palabra

`cycle-01` anticipó `wordGapEm` "emitido como `marginRight`". Se corrige acá: `marginRight` obliga a
un condicional por palabra para no dejar un hueco después de la última (`index < length - 1`), que es
una rama dentro del componente — justo donde D-21 dice que no puede haber decisiones. El bloque
animado es un contenedor flex y emite `columnGap: '<wordGapEm>em'`: sin hueco final, sin rama, y con
`flexWrap: 'wrap'` como red de contención si la estimación de `fitCaptionFontSize` se queda corta
(R-1 de `cycle-01`).

---

## 2. Estructura de `src/**` y asignación por unidad

| Archivo                                               | Estado         | Contenido                                                                                                                             | RF / CA                  |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `src/helpers/caption-animation.ts`                    | **nuevo**      | `CaptionAnimationMode`, `CaptionSpring`, `CaptionAnimation`, `CaptionClipAnimation`, `captionClipAnimation()`, `captionBlockStyle()`   | RF-2-01 / CA-006         |
| `src/helpers/caption-animation.spec.ts`               | **nuevo**      | CA-006, RN-1..RN-4, los tres modos, determinismo, clip corto                                                                          | CA-006                   |
| `src/helpers/caption-active-word.ts`                  | **nuevo**      | `activeWordIndex()`, `CaptionWordRender`, `captionWordRenders()`                                                                       | RF-2-02 / CA-007, CA-008 |
| `src/helpers/caption-active-word.spec.ts`             | **nuevo**      | CA-007, CA-008, RN-5..RN-8, huecos y solapamientos                                                                                     | CA-007, CA-008           |
| `src/helpers/caption-clip-plan.ts`                    | **nuevo**      | `CaptionBoxSource`, `CaptionClipPlan`, `captionClipPlan()`, `captionBoxStyle()`                                                        | RF-2-03 / CA-009         |
| `src/helpers/caption-clip-plan.spec.ts`               | **nuevo**      | R-9 (las dos precedencias), `fontSize` por clip, caja del preset contra caja de la Timeline                                            | CA-009                   |
| `src/helpers/caption-preset.ts`                       | modificado     | campo `animation` en `CaptionPreset` + los cuatro valores (§4)                                                                         | RF-2-01                  |
| `src/helpers/caption-preset.spec.ts`                  | modificado     | **agrega** invariantes de `animation` sobre `CAPTION_PRESET_IDS`                                                                       | CA-006                   |
| `src/helpers/caption-safe-zone.spec.ts`               | modificado     | el test de contención pasa de `captionLayout` a `captionBoxFor` (deuda de cycle-01)                                                    | CA-002                   |
| `src/components/kinetic-captions.tsx`                 | **nuevo**      | `KineticCaptionsProps`, `KineticCaptions`, `CaptionClipBlock` (interno)                                                                | RF-2-03 / CA-009         |
| `src/components/kinetic-captions.spec.tsx`            | **nuevo**      | CA-009 por estructura del árbol, sin montar ni renderizar (§10.2)                                                                      | CA-009                   |
| `src/components/caption-preset-gallery.tsx`           | **nuevo**      | `CAPTION_PRESET_GALLERY_ID`, `CaptionPresetGalleryProps`, `CaptionPresetGallery`                                                       | RF-2-04 / CA-010         |
| `src/components/timeline-composition.tsx`             | modificado     | monta `KineticCaptions`; props de caption; D-23                                                                                        | RF-2-03 / CA-009         |
| `src/Root.tsx`                                        | modificado     | tercera `<Composition>`: la galería (§9)                                                                                               | RF-2-04 / CA-010         |
| `src/index.ts`                                        | modificado     | **agrega** lo nuevo y **quita** `CaptionTrack`, `CaptionTrackProps`, `captionLayout`                                                    | §8.3                     |
| `README.md`                                           | modificado     | tabla de superficie pública: fuera `CaptionTrack` / `captionLayout`, adentro `KineticCaptions`                                          | —                        |
| `src/components/caption-track.tsx`                    | **ELIMINADO**  | D-D / D-26                                                                                                                             | CA-009                   |
| `src/helpers/caption-layout.ts`                       | **ELIMINADO**  | D-26                                                                                                                                   | —                        |
| `src/helpers/caption-layout.spec.ts`                  | **ELIMINADO**  | D-26                                                                                                                                   | —                        |
| `vite.config.ts`, `eslint.config.mjs`, `project.json` | **intacto**    | D-21; `studio` y `smoke` siguen fuera de `lint test build` (CA-010)                                                                     | RNF-2, CA-010            |
| `libs/timeline-core/**`                               | **intacto**    | D-A, RNF-4                                                                                                                             | —                        |

Los specs importan por ruta relativa, nunca desde el barrel — mismo criterio que `cycle-01`.

---

## 3. `captionClipAnimation` — contrato completo

`src/helpers/caption-animation.ts`

### 3.1 Firma

```ts
export interface CaptionClipAnimationInput {
  frame: number;
  durationInFrames: number;
  fps: number;
  preset: CaptionPreset;
}

export interface CaptionClipAnimation {
  opacity: number;
  scale: number;
  translateYEm: number;
  transform: string;
}

export function captionClipAnimation(input: CaptionClipAnimationInput): CaptionClipAnimation;
```

La firma con **un objeto**, y con esos cuatro nombres, es literal de RF-6. `frame` es relativo al
clip (D-24). `preset` entra entero, no `preset.animation`, para que el helper siga siendo
"preset + tiempo → estilo" como los cinco de `cycle-01`.

### 3.2 Unidades de lo devuelto — tabla normativa

| Campo          | Unidad                                 | Rango                            | Semántica                                                                     |
| -------------- | -------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `opacity`      | adimensional                           | **`[0, 1]`, garantizado**        | Opacidad CSS del bloque de palabras. Clampeada en los dos extremos             |
| `scale`        | multiplicador adimensional             | `[enterScale, 1 + overshoot]`    | `1` en la meseta. Puede pasar de 1 durante el rebote — ese es el rebote        |
| `translateYEm` | **em** (contra el `fontSize` del clip) | `[-overshoot·d, riseDistanceEm]` | Desplazamiento vertical; positivo = hacia abajo. `0` en la meseta              |
| `transform`    | string CSS                             | —                                | Siempre `` `translateY(${translateYEm}em) scale(${scale})` ``, sin excepciones |

**Por qué `em` y no px** (D-02 de `cycle-01`): el desplazamiento de `rise` es una distancia
tipográfica, una fracción de línea de texto, no una fracción del formato. En `em` el mismo preset se
ve igual en 1080×1920 que en 1920×1080 sin tocar un número. Un `em` dentro de `translateY()` resuelve
contra el `font-size` del propio elemento, que el bloque **hereda de la caja** (§7.1) — o sea, contra
el resultado de `fitCaptionFontSize`. Determinista y resolución-independiente.

**El `transform` se emite siempre con las dos funciones**, aun cuando una sea la identidad
(`translateY(0em) scale(1)`): un solo formato de salida, sin ramas de armado, y un test que compara
strings sin normalizar.

### 3.3 El algoritmo, paso a paso

```
1. animation     = preset.animation
2. enterFrames   = max(1, min(animation.enterDurationFrames, floor(durationInFrames / 2)))    ← D-18
3. framesFromEnd = durationInFrames - 1 - frame
4. enter = spring({ frame,                fps, config: animation.spring, durationInFrames: enterFrames })
5. exit  = spring({ frame: framesFromEnd, fps, config: animation.spring, durationInFrames: enterFrames })
6. progress = enter + exit - 1                                                                ← D-17
7. opacity      = round3(interpolate(progress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
8. scale        = round3(animation.mode === 'pop'  ? interpolate(progress, [0, 1], [animation.enterScale, 1])    : 1)
9. translateYEm = round3(animation.mode === 'rise' ? interpolate(progress, [0, 1], [animation.riseDistanceEm, 0]) : 0)
10. transform   = `translateY(${translateYEm}em) scale(${scale})`
```

Notas de implementación que no son negociables:

- **`config` recibe solo `{ damping, mass, stiffness }`.** `SpringConfig` de Remotion es un
  `Partial<…>` y su cuarto campo `overshootClamping` queda en `false` (default) **a propósito**: con
  `true` no habría rebote y `pop` sería indistinguible de `fade`.
- **La entrada y la salida usan el mismo `config` y el mismo `enterFrames`.** Ahí está la simetría de
  RN-2, por construcción y no por dos tablas de números que hay que mantener iguales a mano.
- **`opacity` se clampea; `scale` y `translateYEm` no.** El overshoot en la opacidad daría un valor
  mayor que 1 (inválido y sin efecto visual); en la escala y el desplazamiento **es** el efecto.
- **Las dos ternarias sobre `animation.mode` son el único branching del helper.** Con la unión
  discriminada (D-15) TypeScript estrecha `enterScale` / `riseDistanceEm` en cada rama sin cast. Las
  cuatro ramas quedan cubiertas por el registro: dos presets `pop`, uno `rise`, uno `fade`.
- **`round3(v) = Math.round(v * 1000) / 1000`**, función privada del archivo. Es la misma expresión
  que `caption-word-style.ts` ya tiene privada: se duplican dos líneas antes que crear un módulo
  compartido y una arista de import por una operación aritmética. Redondear no es cosmético — es lo
  que hace que el `transform` sea el mismo string en dos corridas y lo que absorbe el ε del
  `durationRestThreshold` de `measureSpring` (§3.4).

### 3.4 Por qué CA-006 se cumple exactamente, y no "por poco"

`spring({ … durationInFrames: N })` de Remotion tiene una salida temprana: si el frame procesado
supera `N`, devuelve **exactamente** `to` (= 1). Y para `frame === N` calcula el spring estirado, que
llega a `1 ± threshold` con `threshold = 0.005`. Consecuencias verificables:

| Momento                        | `enter` | `exit` | `progress` | `opacity` | `scale` (pop)      |
| ------------------------------ | ------- | ------ | ---------- | --------- | ------------------ |
| `frame = 0`                    | 0       | 1      | 0          | **0**     | **`enterScale`**   |
| `frame = enterFrames`          | ≈1      | 1      | ≈1         | **1**     | **1** (por round3) |
| `frame > enterFrames` (meseta) | 1       | 1      | **1**      | **1**     | **1**              |
| `frame = durationInFrames - 1` | 1       | 0      | 0          | **0**     | **`enterScale`**   |

`round3` es lo que convierte el `0.9997` del frame de borde en `1` exacto. Sin él, CA-006 pasaría
solo eligiendo con cuidado el frame del test — y un test que depende de elegir bien el frame es un
test frágil.

**Determinismo (RN-4, CA-006 in fine):** `spring()` e `interpolate()` son puras; el helper no
referencia `Date`, `process` ni `Math.random` (prohibidos por el linter); no tiene estado de módulo
propio. `measureSpring` mantiene un cache interno de Remotion memoizado por `(fps, config, threshold)`:
es memoización pura, no estado observable. Dos llamadas con el mismo input dan el mismo valor.

### 3.5 `captionBlockStyle`

```ts
export function captionBlockStyle(animation: CaptionClipAnimation, preset: CaptionPreset): CSSProperties;
```

Devuelve **siempre** las mismas claves, sin condicionales:

```ts
{
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  columnGap: `${preset.wordGapEm}em`,
  maxWidth: '100%',
  opacity: animation.opacity,
  transform: animation.transform,
  transformOrigin: '50% 50%',
}
```

- `columnGap` en vez de `marginRight` por palabra (D-27). No se emite `rowGap`: cada `<span>` ya trae
  su `lineHeight` desde `captionWordStyle`, que es lo que da alto de línea si alguna vez hay wrap.
- `transformOrigin: '50% 50%'` — el `pop` escala desde el centro del bloque, no desde una esquina.
- **No emite `fontSize`**: lo pone la caja, una sola vez por clip (D-12 de `cycle-01`, §6.4).
- `maxWidth: '100%'` para que el wrap tenga contra qué medir.

---

## 4. El campo `animation` en los cuatro presets

Valores concretos que se agregan a `CAPTION_PRESETS` (`src/helpers/caption-preset.ts`):

```ts
'bold-impact':  { animation: { mode: 'pop',  spring: { damping:  9, mass: 0.6, stiffness: 140 }, enterDurationFrames:  8, enterScale: 0.72 } }
'clean-sans':   { animation: { mode: 'rise', spring: { damping: 14, mass: 0.8, stiffness: 120 }, enterDurationFrames: 10, riseDistanceEm: 0.55 } }
'outline-pop':  { animation: { mode: 'pop',  spring: { damping: 10, mass: 0.7, stiffness: 160 }, enterDurationFrames:  9, enterScale: 0.66 } }
'subtle-lower': { animation: { mode: 'fade', spring: { damping: 30, mass: 1.0, stiffness: 100 }, enterDurationFrames: 12 } }
```

### 4.1 Justificación numérica — de dónde salen esos tres números

El *carácter* del movimiento lo fija el **coeficiente de amortiguamiento**
ζ = `damping` / (2·√(`stiffness`·`mass`)); el sobrepico teórico de un sistema de segundo orden es
`exp(−πζ/√(1−ζ²))`. La *duración* no la fija el spring: la fija `enterDurationFrames`, porque Remotion
estira la duración natural del spring hasta ese valor. Los dos ejes son independientes, y por eso se
declaran por separado.

| Preset         | modo   | ζ     | sobrepico | `enterDurationFrames` (≈ ms @30fps) | pico visible                  | por qué                                                        |
| -------------- | ------ | ----- | --------- | ----------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `bold-impact`  | `pop`  | 0.491 | ~17 %     | 8 (267 ms)                          | `scale` 0.72 → **1.048** → 1  | Hook: entra golpeando y rebota. Corto y seco                   |
| `outline-pop`  | `pop`  | 0.472 | ~19 %     | 9 (300 ms)                          | `scale` 0.66 → **1.063** → 1  | El más elástico del registro; hace juego con su contorno grueso |
| `clean-sans`   | `rise` | 0.714 | ~4 %      | 10 (333 ms)                         | `+0.55em` → **−0.023em** → 0  | Explicativo: sube y se asienta con un rebote apenas perceptible |
| `subtle-lower` | `fade` | 1.500 | 0 %       | 12 (400 ms)                         | solo opacidad, monótona       | Sobreamortiguado: documental, sin ningún rebote. El más lento   |

El sobrepico del `progress` se traduce a escala proporcionalmente al recorrido: `bold-impact` rebota
17 % de un recorrido de 0.28 → 4.8 % de escala final. **Los cuatro animan la opacidad** (RN-3), y
solo eso hace `fade`.

**Cobertura de los tres modos:** con dos `pop`, un `rise` y un `fade`, iterar `CAPTION_PRESET_IDS`
ejercita las cuatro ramas de §3.3 pasos 8–9. No hay modo huérfano.

### 4.2 Invariantes que se agregan a `caption-preset.spec.ts`

Sobre cada id de `CAPTION_PRESET_IDS` (el mismo test que ya itera el registro):

1. `animation.spring.damping > 0`, `mass > 0`, `stiffness > 0` — un spring con un cero da `NaN`.
2. `animation.enterDurationFrames >= 1` y `<= 30` — más de un segundo de entrada es un error de tipeo.
3. `animation.mode` ∈ `{'pop','rise','fade'}`.
4. Si `mode === 'pop'`: `0 < enterScale < 1` (tiene que arrancar más chico, CA-006).
5. Si `mode === 'rise'`: `riseDistanceEm > 0` (tiene que arrancar más abajo).
6. El registro completo cubre los tres modos:
   `new Set(ids.map((id) => CAPTION_PRESETS[id].animation.mode)).size === 3`.

---

## 5. `activeWordIndex` y `captionWordRenders`

`src/helpers/caption-active-word.ts`

```ts
export function activeWordIndex(frame: number, words: readonly CaptionWord[]): number;

export interface CaptionWordRender {
  text: string;
  state: CaptionWordState;
}

export function captionWordRenders(
  frame: number,
  words: readonly CaptionWord[],
  emphasisIndex: number | null,
): readonly CaptionWordRender[];
```

`CaptionWord` es el tipo derivado que ya existe en `src/helpers/timeline-types.ts`
(`CaptionClip['words'][number]` = `{ text: string; fromFrame: number; durationFrames: number }`).
`CaptionWordState` es el de `caption-word-style.ts` (`{ isEmphasis, isActive }`).

### 5.1 `activeWordIndex` — semántica exacta

Implementación completa:

```ts
return words.findIndex(
  (word) => frame >= word.fromFrame && frame < word.fromFrame + word.durationFrames,
);
```

| Situación                                                                           | Resultado                                 | Regla                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| `frame` dentro de `[fromFrame, fromFrame + durationFrames)` de la palabra `i`        | `i`                                       | CA-007                             |
| `frame === word.fromFrame`                                                          | esa palabra (extremo **incluido**)        | rango semiabierto por izquierda    |
| `frame === word.fromFrame + word.durationFrames`                                    | **no** esa palabra (extremo **excluido**) | rango semiabierto por derecha      |
| Dos palabras contiguas sin hueco (`b.fromFrame === a.fromFrame + a.durationFrames`) | en el frame de contacto gana `b`, y solo `b` | sin doble activa, sin frame muerto |
| **Solapamiento** (`b.fromFrame < a.fromFrame + a.durationFrames`)                   | **la de menor índice** (`a`)              | `findIndex` corta en el primer match |
| **Hueco** entre dos palabras                                                        | `-1`                                      | CA-5 / RN-6                        |
| Antes de la primera palabra o después de la última                                  | `-1`                                      | CA-5 / RN-6                        |
| `frame` negativo, o `words` vacío                                                   | `-1`                                      | cae del mismo predicado, sin guarda |

**Por qué el rango es semiabierto y no cerrado:** las palabras de `buildTimeline` son contiguas
(`fromFrame` de una arranca donde termina la anterior). Con un rango cerrado en los dos extremos, el
frame de contacto pertenecería a dos palabras a la vez y RN-5 ("como máximo una palabra activa")
dejaría de valer. Con semiabierto, la partición del tiempo del clip es exacta: cada frame pertenece a
lo sumo a una palabra, y `durationFrames` se lee como "cuántos frames dura", no como "hasta qué frame
llega".

**Por qué `-1` y no `null`** (CA-007 lo pide explícito, pero el motivo importa):

1. Es el contrato de `Array.prototype.findIndex`: la implementación es una sola línea sin traducción
   de valores, y quien lee el helper ya sabe qué significa.
2. En el punto de uso, `index === activeIndex` es una comparación **siempre válida** entre dos
   números. Con `null`, `index === null` sería siempre `false` — código que se lee como un bug aunque
   funcione, y que TypeScript ni siquiera marca.
3. Deja los dos "ausentes" del dominio visualmente distintos: `emphasisIndex: number | null` (la
   `Timeline` **no declaró** palabra de impacto) contra `activeWordIndex === -1` (en **este frame** no
   suena ninguna). Son cosas distintas y no conviene que se escriban igual.

**Sin ramas propias:** el helper no tiene `if`. El predicado tiene un `&&`, que es la única
bifurcación, y los tests la cubren por los dos lados.

### 5.2 `captionWordRenders` — el estado de cada palabra en un frame

```ts
const activeIndex = activeWordIndex(frame, words);

return words.map((word, index) => ({
  text: word.text,
  state: { isEmphasis: index === emphasisIndex, isActive: index === activeIndex },
}));
```

- **Emparejar texto y estado** existe para que el componente no indexe (`words[i]`), que con
  `noUncheckedIndexedAccess: true` obligaría a un `?.` o a un `??` — una rama muerta dentro del
  `.tsx`, o sea fuera de cobertura y contra D-21.
- `index === emphasisIndex` con `emphasisIndex: number | null` da `false` cuando es `null`, sin
  guarda: un `number` nunca es `===` a `null`. **Cero ramas.**
- **CA-008 sale de acá y es demostrable, no muestreada:** `isEmphasis` no depende de `frame`. El test
  recorre **todos** los frames de `[0, durationInFrames)` y afirma que
  `renders[emphasisIndex].state.isEmphasis === true` en cada uno, sea o no la palabra activa. La otra
  mitad de CA-008 —que "estilo de impacto" gane sobre "estilo activo"— ya está fijada y testeada por
  la tabla de precedencia de `captionWordStyle` (§8.1 de `cycle-01`, D-08) y no se re-testea acá.

### 5.3 Tests (CA-007, CA-008, RN-5..RN-8)

Sobre una frase de tres palabras contiguas `[0,10) [10,18) [18,30)` con `emphasisIndex: 1`:

1. `activeWordIndex` en 0, 9, 10, 17, 18, 29 → `0, 0, 1, 1, 2, 2` (los seis bordes de rango).
2. `activeWordIndex(30, words)` y `activeWordIndex(-1, words)` → `-1`.
3. Con hueco (`[0,5) [10,15)`): frames 5..9 → `-1` (CA-5).
4. Con solapamiento (`[0,10) [5,15)`): frame 7 → `0`, nunca `1`.
5. `activeWordIndex(0, [])` → `-1`.
6. **Barrido completo** de `[0, 30)`: en cada frame, exactamente 0 o 1 palabra con `isActive: true`
   (RN-5) y **siempre** `renders[1].state.isEmphasis === true` (CA-008 / RN-7).

---

## 6. `captionClipPlan` — la caja, el tamaño y la precedencia de R-9

`src/helpers/caption-clip-plan.ts`

### 6.1 Firma

```ts
export type CaptionBoxSource = 'preset' | 'clip';

export interface CaptionClipPlan {
  clipId: ClipId;
  from: Frame;
  durationInFrames: number;
  words: readonly CaptionWord[];
  emphasisIndex: number | null;
  box: CaptionBox;
  fontSize: number;
}

export interface CaptionClipPlanInput {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  preset: CaptionPreset;
  safeZone?: SafeZone | undefined;
  platform?: CaptionPlatform | undefined;
  anchor?: CaptionAnchor | undefined;
  boxSource?: CaptionBoxSource | undefined;
}

export function captionClipPlan(input: CaptionClipPlanInput): readonly CaptionClipPlan[];
export function captionBoxStyle(box: CaptionBox, fontSize: number): CSSProperties;
```

Algoritmo:

```
1. resolvedSafeZone = captionSafeZone(format, platform, safeZone)          ← D-B, aditivo
2. presetBox        = captionBoxFor(resolvedSafeZone, format, preset, anchor)
3. source           = boxSource ?? 'preset'
4. por cada clip:
     box      = source === 'clip' ? (clip.box ?? presetBox) : presetBox
     fontSize = fitCaptionFontSize(clip.words, box, preset, format)
     → { clipId, from, durationInFrames, words, emphasisIndex, box, fontSize }
```

- **`presetBox` se calcula una sola vez**, fuera del map: no depende del clip. `fontSize` sí es por
  clip, porque depende de `clip.words` (frases más largas → letra más chica, CA-005).
- El helper **recibe el preset ya resuelto**, no un `CaptionPresetId`. La resolución
  (`captionPreset(id)`) la hace el componente una vez y la comparte con el plan y con el bloque
  animado: un solo objeto preset por render, sin lookups repetidos.
- `captionSafeZone` y `captionBoxFor` toman sus opcionales por posición, así que reenviar
  `platform` / `safeZone` / `anchor` posiblemente `undefined` es legal aun con
  `exactOptionalPropertyTypes` (los **parámetros** opcionales sí admiten `undefined`; lo que no lo
  admite son las **propiedades** opcionales — de ahí D-22).

### 6.2 R-9 resuelto: por qué gana el preset

**El hallazgo que decide la cuestión.** `buildTimeline` de `timeline-core` **siempre** rellena
`CaptionClip.box`, y lo hace así (`build-timeline.ts`, `buildCaptionTrack`):

```ts
const box = safeZoneBox(format);   // { x: left, y: top, width: W-left-right, height: H-top-bottom }
```

Una sola caja, calculada **fuera del loop**, idéntica para todos los clips del timeline, y que es
**exactamente lo que devuelve `captionLayout`** — el helper que este ciclo da de baja por superado
(hay un test de `cycle-03` de spec-001 que afirma esa igualdad literal). O sea: hoy `clip.box` **no
transporta ninguna intención editorial**; es un default genérico derivado de datos que la lib ya
tiene, y ninguna `Timeline` producida por el pipeline distingue un clip de otro por su caja.

Si `clip.box` ganara por default, el resultado sería:

| Lo que quedaría muerto               | Consecuencia                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `captionSafeZone` + insets de chrome | Los subtítulos se dibujarían **debajo de la columna de acciones de TikTok** — CA-002 cumplida en el helper y violada en pantalla |
| `anchor` de `captionBoxFor`          | CA-003 verde en su test y sin efecto en el render                                                                                |
| `boxHeightRatio` del preset          | La caja pasaría de 461 px a 1300 px de alto y el anclaje del look se perdería                                                    |
| Todo `cycle-01`, en la práctica      | La spec entregaría helpers correctos e inalcanzables                                                                            |

**Regla adoptada (D-19):**

| `boxSource`              | Caja usada                                | Cuándo                                                                                                              |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `'preset'` (**default**) | siempre `presetBox`; `clip.box` se ignora | Todo consumo normal. La ubicación es **presentación**, y la presentación viaja por props (D-A)                       |
| `'clip'`                 | `clip.box ?? presetBox`                   | Una `Timeline` con cajas realmente puestas a mano, clip por clip                                                     |

Por qué una prop explícita y no un heurístico: la alternativa "honrar `clip.box` solo si difiere del
rectángulo genérico" obligaría a la lib a reimplementar `safeZoneBox` de `timeline-core` para
compararse contra él, y a cambiar de comportamiento en silencio según la aritmética del safe zone. Un
knob de dos valores, con default explícito y las dos ramas testeadas, dice la verdad en el tipo. Y
deja `CaptionSequenceProps.box` **vivo y alcanzable** en vez de convertirlo en un campo que nadie lee
nunca.

### 6.3 Cómo se testea R-9 (`caption-clip-plan.spec.ts`)

1. **Default = preset.** Sin `boxSource`, con un clip cuyo `box` es `{x:10,y:20,width:300,height:100}`,
   el plan devuelve
   `captionBoxFor(captionSafeZone(format, 'tiktok'), format, captionPreset('bold-impact'))` y **no** el
   box del clip. Aserción por igualdad estructural contra el helper llamado en el test.
2. **`boxSource: 'clip'` con box → gana el clip.** Mismo input, `boxSource: 'clip'` → el plan devuelve
   `{x:10,y:20,width:300,height:100}`.
3. **`boxSource: 'clip'` sin box (`box: null`) → cae al preset.** Cubre el lado derecho del `??`.
4. **Contra la Timeline real** (rescata el conocimiento del test que se borra con `captionLayout`):
   con `timelineToSequenceProps(buildExampleTimeline('reels-9x16')).captions` y `boxSource: 'clip'`, la
   caja del plan es idéntica a `timeline.tracks.captions[0].box`; con el default, **no** lo es y
   respeta `boxHeightRatio` del preset.
5. **`fontSize` es por clip:** un clip de una palabra corta y otro de tres palabras largas, con la
   misma caja, dan `fontSize` distinto y decreciente (encadena con CA-005).
6. **`platform` llega hasta la caja:** el mismo input con y sin `'tiktok'` da cajas distintas, y la de
   `'tiktok'` es más angosta en al menos 150 px (encadena con CA-002).

### 6.4 `captionBoxStyle`

```ts
{
  position: 'absolute',
  left: box.x,
  top: box.y,
  width: box.width,
  height: box.height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize,
  textAlign: 'center',
}
```

- **Acá y solo acá va el `fontSize`** (D-12 de `cycle-01`): una vez por clip, heredado por el bloque
  animado y por cada palabra. Es lo que permite que `captionWordRenders` cambie el estilo de una
  palabra frame a frame sin recalcular el ajuste tipográfico, y lo que hace que los `em` del
  `translateY` y del `columnGap` resuelvan contra el tamaño real del clip.
- **No emite `transform` ni `opacity`.** Es la mitad estática del par; toda la animación vive un nivel
  más adentro (§7.2). El test lo afirma como propiedad:
  `'transform' in captionBoxStyle(...) === false`.

---

## 7. `<KineticCaptions />`

`src/components/kinetic-captions.tsx`

### 7.1 Props y árbol

```tsx
export interface KineticCaptionsProps {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  safeZone?: SafeZone | undefined;
  preset?: CaptionPresetId | undefined;
  platform?: CaptionPlatform | undefined;
  anchor?: CaptionAnchor | undefined;
  boxSource?: CaptionBoxSource | undefined;
}
```

| Prop        | Requerida | Default efectivo                              | Origen                                       |
| ----------- | --------- | --------------------------------------------- | -------------------------------------------- |
| `clips`     | sí        | —                                             | `timelineToSequenceProps(timeline).captions` |
| `format`    | sí        | —                                             | `timeline.format`                            |
| `safeZone`  | no        | `safeZoneFor(format)` (vía `captionSafeZone`) | `timeline.safeZone ?? safeZoneFor(format)`   |
| `preset`    | no        | `DEFAULT_CAPTION_PRESET_ID` (`bold-impact`)   | props de `TimelineComposition` / Studio      |
| `platform`  | no        | sin plataforma → insets en cero               | props                                        |
| `anchor`    | no        | `preset.anchor`                               | props                                        |
| `boxSource` | no        | `'preset'`                                    | D-19                                         |

`preset` acepta **solo el id**, no un `CaptionPreset` completo: mantiene la superficie chica y la prop
serializable para los `defaultProps` del Studio. Un preset a medida es follow-up de `spec-006` (§15).

Árbol, con la responsabilidad de cada nivel:

```
<KineticCaptions>                                  sin hooks — resuelve preset y plan
└─ <Sequence from durationInFrames name>           ← CA-009. Remotion la envuelve en AbsoluteFill
   └─ <div style={captionBoxStyle(box, fontSize)}> ← geometría + fontSize. SIN transform
      └─ <CaptionClipBlock>                        ← único nivel con hooks
         └─ <div style={captionBlockStyle(animation, preset)}>  ← opacity + transform del clip
            └─ <span style={captionWordStyle(preset, state)}>   ← una por palabra, con scale(...)
```

**No se agrega un `<AbsoluteFill>` propio:** `<Sequence>` ya renderiza uno (su `layout` por defecto es
`'absolute-fill'`), y ese es el bloque contenedor posicionado contra el que el `<div>` de la caja
resuelve su `position: absolute`. Un `AbsoluteFill` extra sería un nivel de DOM por frame sin efecto.

Código del componente, completo (es todo el cableado que hay):

```tsx
const CaptionClipBlock: FC<{ plan: CaptionClipPlan; preset: CaptionPreset }> = ({ plan, preset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animation = captionClipAnimation({
    frame,
    durationInFrames: plan.durationInFrames,
    fps,
    preset,
  });

  return (
    <div style={captionBlockStyle(animation, preset)}>
      {captionWordRenders(frame, plan.words, plan.emphasisIndex).map((render, index) => (
        <span key={`${plan.clipId}-${index}`} style={captionWordStyle(preset, render.state)}>
          {render.text}
        </span>
      ))}
    </div>
  );
};

export const KineticCaptions: FC<KineticCaptionsProps> = ({
  clips,
  format,
  safeZone,
  preset,
  platform,
  anchor,
  boxSource,
}) => {
  const resolvedPreset = captionPreset(preset);

  return (
    <>
      {captionClipPlan({
        clips,
        format,
        preset: resolvedPreset,
        safeZone,
        platform,
        anchor,
        boxSource,
      }).map((plan) => (
        <Sequence
          key={plan.clipId}
          name={plan.clipId}
          from={plan.from}
          durationInFrames={plan.durationInFrames}
        >
          <div style={captionBoxStyle(plan.box, plan.fontSize)}>
            <CaptionClipBlock plan={plan} preset={resolvedPreset} />
          </div>
        </Sequence>
      ))}
    </>
  );
};
```

Propiedades que hay que preservar en la implementación:

- **`KineticCaptions` no llama ningún hook.** Esa es la condición que hace posible el test de CA-009
  sin montar (§10.2) y la que mantiene toda decisión dentro de los helpers (D-21).
- **`CaptionClipBlock` llama exactamente dos hooks** (`useCurrentFrame`, `useVideoConfig`) y delega
  todo lo demás — que es lo que pide D-F literalmente. No se exporta del archivo ni del barrel.
- **Cero `if`, cero ternarias, cero `??` en el `.tsx`.** Si hace falta una decisión, va a un helper.
- `name={plan.clipId}` etiqueta la sequence en el timeline de `remotion studio`, que es donde el
  creador va a mirar la galería.
- El `key` de la palabra usa el índice porque el orden de las palabras de un clip es fijo y no hay
  reordenamiento posible.

### 7.2 R-8 resuelto: dónde vive cada `transform`

**La respuesta es que nunca hay dos `transform` en el mismo elemento.** No se concatenan strings, no
se parsea nada, no se re-escribe lo que emite `captionWordStyle`:

| Nivel | Elemento                                | Emite `transform`                          | Quién lo arma       |
| ----- | --------------------------------------- | ------------------------------------------ | ------------------- |
| 1     | `<Sequence>` (AbsoluteFill de Remotion) | **no**                                     | Remotion            |
| 2     | `<div>` caja                            | **no** (invariante testeada, §6.4)         | `captionBoxStyle`   |
| 3     | `<div>` bloque animado                  | `translateY(<n>em) scale(<n>)`             | `captionBlockStyle` |
| 4     | `<span>` palabra                        | `scale(<n>)` — y **solo** eso (D-12)       | `captionWordStyle`  |

El navegador compone los niveles 3 y 4 por anidamiento: la palabra activa se agranda **dentro** de un
bloque que ya está entrando con su propio rebote, y las dos escalas se multiplican como corresponde,
sin que ninguna de las dos funciones sepa de la existencia de la otra. `captionWordStyle` queda
**exactamente como la dejó `cycle-01`** — este ciclo no le toca una línea.

**Orden dentro del transform del nivel 3: `translateY(...)` primero, `scale(...)` después.** No es
estético. Las funciones de `transform` se aplican de derecha a izquierda sobre el sistema de
coordenadas del elemento: con `translateY(0.55em) scale(0.8)` el bloque se escala y **después** se
desplaza 0.55 em en las coordenadas del padre — la distancia del `rise` es la que dice el preset. Con
el orden invertido, el desplazamiento quedaría multiplicado por la escala (0.44 em) y el `rise`
cambiaría de recorrido según el rebote. Hoy `pop` y `rise` son excluyentes por preset y la diferencia
es nula; un preset futuro que combine los dos depende de que el orden esté fijado acá.

**Invariantes que lo custodian, como tests:**

1. `'transform' in captionBoxStyle(box, fontSize) === false` (`caption-clip-plan.spec.ts`).
2. `captionBlockStyle(...).transform` matchea `/^translateY\(-?[\d.]+em\) scale\([\d.]+\)$/`
   (`caption-animation.spec.ts`).
3. `captionWordStyle(...).transform` matchea `/^scale\([\d.]+\)$/` — ya está en `cycle-01`, y se
   re-afirma en `kinetic-captions.spec.tsx` sobre el árbol real: el `<div>` bloque y el `<span>` tienen
   `transform` **distintos** y son **elementos distintos**.

---

## 8. Baja de `CaptionTrack` y de `captionLayout`

### 8.1 Qué se borra

| Archivo                              | Motivo                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `src/components/caption-track.tsx`   | D-D de la spec / RN-11 del funcional. Sin alias deprecado, sin re-export |
| `src/helpers/caption-layout.ts`      | D-26. Superado por `captionBoxFor`                                       |
| `src/helpers/caption-layout.spec.ts` | Se va con su helper                                                      |

No queda ningún otro consumidor: el barrel, `timeline-composition.tsx` y `caption-safe-zone.spec.ts`
son los únicos tres puntos del repo que los referencian, y los tres se tocan en este ciclo. `apps/` y
`tools/` no existen todavía (D-D), y `libs/auto-montage` y `libs/timeline-core` no importan nada de
`composition-remotion`.

### 8.2 Cómo queda `TimelineComposition`

```tsx
export type TimelineCompositionProps = {
  timeline: Timeline;
  captionPreset?: CaptionPresetId | undefined;
  captionPlatform?: CaptionPlatform | undefined;
  captionAnchor?: CaptionAnchor | undefined;
};
```

Cambios exactos:

1. `import { CaptionTrack } from './caption-track'` → `import { KineticCaptions } from './kinetic-captions'`.
2. En el árbol, `<CaptionTrack clips={plan.captions} safeZone={safeZone} format={timeline.format} />` →

   ```tsx
   <KineticCaptions
     clips={plan.captions}
     format={timeline.format}
     safeZone={safeZone}
     preset={captionPreset}
     platform={captionPlatform}
     anchor={captionAnchor}
   />
   ```

   `safeZone` sigue siendo `timeline.safeZone ?? safeZoneFor(timeline.format)`, la línea que ya está:
   la `Timeline` manda su safe zone y `captionSafeZone` le **suma** el chrome de la plataforma (D-B).
   `boxSource` no se expone acá: `TimelineComposition` usa el default (`'preset'`).
3. `calculateTimelineMetadata` devuelve `props: { ...props, timeline: metadata.timeline }` (**D-23**).
   Sin el spread, el preset elegido en Studio o en `defaultProps` se perdería sin error.
4. Los prefijos `caption*` en los nombres de props evitan colisión si en el futuro entran props de
   otras pistas, y hacen obvio en el Studio a qué pertenece cada campo.

### 8.3 Barrel (`src/index.ts`)

**Se quita:**

```ts
export { captionLayout } from './helpers/caption-layout';
export { CaptionTrack } from './components/caption-track';
export type { CaptionTrackProps } from './components/caption-track';
```

**Se agrega:**

```ts
export { captionBlockStyle, captionClipAnimation } from './helpers/caption-animation';
export type {
  CaptionAnimation,
  CaptionAnimationMode,
  CaptionClipAnimation,
  CaptionSpring,
} from './helpers/caption-animation';

export { activeWordIndex, captionWordRenders } from './helpers/caption-active-word';
export type { CaptionWordRender } from './helpers/caption-active-word';

export { captionBoxStyle, captionClipPlan } from './helpers/caption-clip-plan';
export type { CaptionBoxSource, CaptionClipPlan } from './helpers/caption-clip-plan';

export { KineticCaptions } from './components/kinetic-captions';
export type { KineticCaptionsProps } from './components/kinetic-captions';
```

**No se exporta:**

| Símbolo                                            | Por qué queda adentro                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `CaptionClipBlock`                                 | Detalle interno de `kinetic-captions.tsx`, igual que `CaptionWords` hoy |
| `CaptionPresetGallery`, `CAPTION_PRESET_GALLERY_ID` | Superficie de inspección de Studio, no de producción (§9.3)            |
| `RemotionRoot`                                     | Ya estaba fuera (COMP-005), no cambia                                  |
| `round3` / `enterFramesFor` de `caption-animation` | Detalles de implementación                                            |

Es la **primera vez que el barrel pierde exportaciones**. `cycle-01` D-11 lo anticipó y D-D lo
autoriza: no hay consumidores externos. `nx build` es el que verifica que nada quedó colgado.

### 8.4 `sdd/components.json` — el delta exacto

Bajo la clave `libs/composition-remotion` → `components`. Leído `sdd/schemas/components.schema.json`
antes de proponerlo: `spec` tiene que matchear `^sdd/specs/spec-[a-z0-9-]+$`, `id` `^COMP-\d{3}$`,
`name` PascalCase, y cada entrada es `additionalProperties: false`.

**COMP-003 `CaptionTrack` — se deprecia, NO se borra** (el protocolo del registro es
append/deprecate-only):

```json
{
  "id": "COMP-003",
  "status": "deprecated",
  "updated_in_cycle": 2,
  "changelog": [
    {
      "cycle": 2,
      "date": "2026-09-07",
      "change": "deprecated — reemplazado por KineticCaptions (COMP-007); el archivo src/components/caption-track.tsx y el helper captionLayout se eliminaron y salieron del barrel (D-D de spec-e-burgos-003, D-26 del architect de cycle-02)"
    }
  ]
}
```

El resto de los campos de COMP-003 queda intacto — incluido `path`, que pasa a ser un dato histórico:
`status: "deprecated"` ya dice que el archivo no está.

**COMP-004 `TimelineComposition`** → `status: "updated"`, `updated_in_cycle: 2`, changelog:
`"monta KineticCaptions en lugar de CaptionTrack y acepta captionPreset / captionPlatform / captionAnchor por props; calculateTimelineMetadata preserva las props que no calcula"`.

**COMP-005 `RemotionRoot`** → `status: "updated"`, `updated_in_cycle: 2`, changelog:
`"registra la composición CaptionPresetGallery (4 paneles 1080x1920 lado a lado) para inspección visual de los presets en remotion studio"`.

**COMP-007 — nueva:**

```json
{
  "id": "COMP-007",
  "name": "KineticCaptions",
  "type": "component",
  "module": "kinetic-captions",
  "spec": "sdd/specs/spec-e-burgos-003-kinetic-captions",
  "path": "src/components/kinetic-captions.tsx",
  "status": "defined",
  "created_in_cycle": 2,
  "updated_in_cycle": null,
  "description": "Monta una Sequence por clip de captions con el from/durationInFrames exactos del plan; anima la entrada y la salida del bloque con spring (captionClipAnimation), resalta la palabra activa por frame (captionWordRenders) y mantiene el estilo de impacto de emphasisIndex durante todo el clip. La caja sale del preset y la plataforma; clip.box solo con boxSource='clip'.",
  "consumes": [],
  "created_at": "2026-09-07",
  "changelog": []
}
```

**COMP-008 — nueva:**

```json
{
  "id": "COMP-008",
  "name": "CaptionPresetGallery",
  "type": "component",
  "module": "kinetic-captions",
  "spec": "sdd/specs/spec-e-burgos-003-kinetic-captions",
  "path": "src/components/caption-preset-gallery.tsx",
  "status": "defined",
  "created_in_cycle": 2,
  "updated_in_cycle": null,
  "description": "Galería de inspección visual para remotion studio: cuatro paneles de 1080x1920 lado a lado, uno por preset de CAPTION_PRESETS, cada uno con KineticCaptions animando los mismos clips sobre fondo plano. No entra al barrel ni a lint/test/build; no genera ningún archivo de video.",
  "consumes": [],
  "created_at": "2026-09-07",
  "changelog": []
}
```

> `created_in_cycle: 2` es el ciclo **de esta spec** (los ciclos se resetean por spec); junto con el
> campo `spec` la referencia es inequívoca, aunque COMP-001..006 lleven `created_in_cycle: 3` de
> `spec-e-burgos-001`.

El implementador que cree cada componente pasa su entrada de `"defined"` a `"implemented"`, según el
protocolo del registro. `pnpm sdd:validate` valida el archivo entero después.

### 8.5 La deuda de `caption-safe-zone.spec.ts`

El test `deja la caja de captions dentro de 1080x1920 para %s / %s (CA-002)` usa hoy
`captionLayout(safeZone, format)`, que desaparece. Reemplazo:

```ts
const box = captionBoxFor(safeZone, format, captionPreset(presetId));
```

iterando además sobre `CAPTION_PRESET_IDS`, de modo que la matriz pase de 3 casos a 3 plataformas ×
4 presets = 12. Las cuatro aserciones de contención (`x >= 0`, `y >= 0`,
`x + width <= format.width`, `y + height <= format.height`) no cambian.

El test **mejora** al migrar: `captionLayout` verificaba la contención de una caja que ya nadie va a
dibujar; `captionBoxFor` verifica la caja que efectivamente se renderiza, con el alto y el anclaje del
preset. Se agregan dos imports relativos (`./caption-box`, `./caption-preset`) y se quita
`./caption-layout`.

**Lo que se pierde con `caption-layout.spec.ts`** — la aserción de que `captionLayout` daba el mismo
box que la `Timeline` de ejemplo — se **rescata** en `caption-clip-plan.spec.ts` (§6.3, test 4), donde
además pasa a ser evidencia de la regla de precedencia de R-9 en vez de un dato suelto.

---

## 9. `Root.tsx` y la galería de presets (RF-2-04, CA-009/CA-010 del funcional)

### 9.1 El componente

`src/components/caption-preset-gallery.tsx`

```tsx
export const CAPTION_PRESET_GALLERY_ID = 'CaptionPresetGallery';

export interface CaptionPresetGalleryProps {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  platform?: CaptionPlatform | undefined;
}
```

Estructura: un `AbsoluteFill` de fondo y, por cada `CAPTION_PRESET_IDS[i]`, un panel

```tsx
<div
  style={{
    position: 'absolute',
    left: index * format.width,
    top: 0,
    width: format.width,
    height: format.height,
    overflow: 'hidden',
    backgroundColor: PANEL_BACKGROUND,
  }}
>
  <div style={PANEL_LABEL_STYLE}>{presetId}</div>
  <KineticCaptions clips={clips} format={format} preset={presetId} platform={platform} />
</div>
```

- El panel es `position: absolute`, así que **es el bloque contenedor** del `AbsoluteFill` que
  `<Sequence>` genera adentro: cada preset queda encerrado en su panel de 1080×1920 y no se pisa con
  el vecino.
- Cada panel recibe el **`format` real de producción** (1080×1920), no un cuarto de pantalla. Por eso
  el lienzo de la composición es ancho (§9.2) y no se comprime cada panel: `fitCaptionFontSize` y
  `captionBoxFor` calculan con la misma geometría con la que van a renderizar, que es exactamente la
  pregunta que el creador quiere responder mirando la galería.
- **Fondo plano, sin video ni imágenes.** La galería no depende de `public/example/` (gitignoreado,
  puede no existir en un clon nuevo) y abre instantáneo en Studio. `PANEL_BACKGROUND` es un gris muy
  oscuro (`#111318`) para juzgar contraste de contorno y de píldora.
- La etiqueta con el id del preset arriba de cada panel es lo único que la galería agrega al cuadro.

### 9.2 La composición en `Root.tsx`

```tsx
<Composition
  id={CAPTION_PRESET_GALLERY_ID}
  component={CaptionPresetGallery}
  defaultProps={{
    clips: timelineToSequenceProps(buildExampleTimeline('reels-9x16')).captions,
    format: defaultFormat('reels-9x16'),
  }}
  durationInFrames={265}
  fps={30}
  width={4320}
  height={1920}
/>
```

| Parámetro           | Valor                  | Por qué                                                                                                       |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`                | `CaptionPresetGallery` | Constante exportada por el componente, no un string suelto — mismo patrón que `TIMELINE_COMPOSITION_ID`         |
| `width`             | 4320                   | 4 × 1080: cuatro paneles verticales reales, lado a lado (HU-2-05). Studio hace zoom-to-fit solo                |
| `height`            | 1920                   | Alto de un 9:16 real                                                                                          |
| `fps`               | 30                     | El del formato de ejemplo; el spring depende de `fps` y tiene que ser el de producción                        |
| `durationInFrames`  | 265                    | El mismo de las otras dos composiciones — cubre los tres clips de captions del fixture                        |
| `defaultProps`      | del fixture            | Datos planos y serializables: Studio puede editarlos en vivo sin recompilar                                   |
| `calculateMetadata` | **no**                 | Las dimensiones son fijas por diseño; no hay `Timeline` que medir                                             |

Se reutiliza `buildExampleTimeline('reels-9x16')` + `timelineToSequenceProps` en vez de inventar un
fixture nuevo: son palabras con timings reales producidos por `buildTimeline`, que es lo que hay que
mirar. **No se agrega ningún archivo a `src/__fixtures__/`.**

Las dos composiciones existentes no cambian sus `defaultProps`.

### 9.3 Por qué la galería no entra al barrel ni a CI (CA-010, RN-13, RN-14)

| Pregunta                     | Respuesta                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Entra a `src/index.ts`?     | **No.** Es superficie de inspección, no de producción. Exportarla metería un fixture y sus datos en cualquier bundle que importe la lib. Mismo criterio que `RemotionRoot` (COMP-005)                                                  |
| ¿Corre en `test`?            | **No.** No tiene spec: es una herramienta de mirada humana. Su lógica ya está testeada en los helpers                                                                                                                                 |
| ¿Cuenta para cobertura?      | **No.** El `include` es `src/helpers/**` + `src/transitions/**` (D-21)                                                                                                                                                                |
| ¿La compila `build`?         | **Sí**, y a propósito: `tsconfig.lib.json` incluye `src/**/*.tsx`, así que `nx build` y `nx lint` la typechequean y la lintean. Es la garantía de que la galería no se pudre en silencio                                              |
| ¿Genera un archivo de video? | **Nunca.** `remotion studio` previsualiza en el browser; renderizar es otro target (`smoke`)                                                                                                                                          |
| ¿Toca `project.json`?        | **No.** `studio` y `smoke` ya existen como targets separados y siguen fuera de `lint`, `test` y `build`                                                                                                                               |

Se mira con `pnpm nx run composition-remotion:studio`, eligiendo `CaptionPresetGallery` en la lista.

---

## 10. Estrategia de test: verificar el componente sin montar Remotion

### 10.1 El reparto

La suite corre en jsdom y `@testing-library/react` está instalado, pero **la lib nunca montó un
componente de Remotion** y este ciclo no va a ser el primero: montar exigiría envolver el árbol en un
contexto de composición de Remotion, y un `<Sequence>` fuera de ese contexto tira. Eso sería
infraestructura de test nueva y frágil para verificar algo que se puede verificar mejor de otra forma.

| Qué hay que probar                                             | Cómo                                                       | ¿Cobertura? |
| -------------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| CA-006 (entrada/salida, determinismo)                          | `caption-animation.spec.ts` — función pura                 | sí          |
| CA-007 (palabra activa, huecos, solapes)                       | `caption-active-word.spec.ts` — función pura               | sí          |
| CA-008 (impacto todo el clip)                                  | `caption-active-word.spec.ts` — barrido de frames          | sí          |
| R-9 (precedencia de la caja) y `fontSize` por clip             | `caption-clip-plan.spec.ts` — función pura                 | sí          |
| R-8 (los `transform` no se pisan)                              | invariantes en los tres specs de helpers + el árbol real   | parcial     |
| **CA-009 (una `Sequence` por clip con from/duration exactos)** | **`kinetic-captions.spec.tsx`, §10.2**                     | no (D-21)   |

### 10.2 Cómo se verifica CA-009 sin render y sin red

`KineticCaptions` **no llama hooks** (§7.1). Entonces es una función corriente de props a
`ReactElement`, y un elemento de React es un objeto plano: se lo puede **construir e inspeccionar sin
ReactDOM, sin `render()`, sin `act()` y sin contexto de Remotion**. El spec:

```tsx
const tree = KineticCaptions({ clips, format });
const sequences = sequenceChildrenOf(tree);
```

donde `sequenceChildrenOf` usa `Children.toArray` + `isValidElement` de `react` y un único cast a un
tipo local `{ from: number; durationInFrames: number; children: ReactNode }` — el cast deliberado
dentro de un `*.spec` que la regla 2 de `cycle-01` autoriza. Aserciones:

1. `sequences.length === clips.length`; **una `Sequence` por clip** (CA-009).
2. `sequences[i].type === Sequence` — identidad contra el `Sequence` importado de `remotion` en el
   propio spec (mismo módulo, misma referencia).
3. `sequences[i].props.from === clips[i].from` y
   `sequences[i].props.durationInFrames === clips[i].durationInFrames` — **exactos**, no aproximados
   (CA-009).
4. `sequences[i].key` contiene el `clipId` (identidad estable entre frames).
5. `clips: []` → cero hijos, sin excepción.
6. El hijo de cada `Sequence` es el `<div>` de la caja, cuyo `style` no tiene clave `transform` (R-8,
   nivel 2) y cuyos `left` / `top` / `width` / `height` / `fontSize` coinciden con
   `captionClipPlan(...)` recalculado en el test.
7. Con `boxSource: 'clip'` y un clip con `box`, ese `<div>` usa el box del clip (R-9 en el árbol real,
   no solo en el helper).

**Nada de esto monta nada:** no se llama `ReactDOM`, no se ejecuta ningún hook, no se descarga Chrome,
no hay red. `CaptionClipBlock` no se ejecuta nunca en la suite — es un `type` dentro de un elemento, y
su lógica ya está cubierta por los tres specs de helpers. RNF-1 intacto.

### 10.3 Cobertura (RNF-2, CA-011)

- **`vite.config.ts` no se toca** (D-21): `include` sigue en `src/helpers/**/*.ts` +
  `src/transitions/**/*.ts`, umbral 80 %.
- **Piso a mantener: ≥ 90 % statements y ≥ 85 % branches.** Punto de partida real de `cycle-01`:
  **96.2 % / 92.38 %** — el ciclo **no puede bajarlo**.
- Balance esperado: entran tres helpers (`caption-animation`, `caption-active-word`,
  `caption-clip-plan`), cada uno con spec propio y con muy pocas ramas por diseño (dos ternarias de
  modo, un `&&`, dos `??`, un `===`), todas ejercitadas. Sale `caption-layout.ts`, que estaba al
  100 %: quitar código cubierto mueve el porcentaje apenas, y solo por unos pocos statements.
- El reviewer **lee el número reportado por `nx test composition-remotion` y lo compara contra
  96.2 / 92.38**, no contra el 80 % del config (R-6 de `cycle-01`). Si baja, la causa es una rama sin
  test, no un umbral.

### 10.4 El smoke manual del cierre (RF-2-05, RN-15..RN-18)

Se corre **una sola vez**, después de que `lint`, `test` y `build` estén en verde:

1. Verificar que la máquina no esté transcribiendo audio de otro proyecto y chequear
   `memory_pressure` (RN-17). Si cualquiera de las dos condiciones falla → **se pospone** (RN-18,
   CE-5). No se libera memoria ni se fuerza el render.
2. `pnpm nx run composition-remotion:smoke` — la única invocación de render del ciclo.
3. Ningún otro paso del ciclo, ni de CI, corre `smoke` ni `studio` (CA-010). Este documento y el
   architect de `cycle-01` prohíben ejecutarlos desde cualquier agente que no sea el que cierra el
   ciclo.

Qué se mira en el `.mp4` resultante: que los captions entren con rebote, que la palabra siga a la voz,
que la palabra de impacto se mantenga destacada y que el bloque quede dentro del safe zone. Es
verificación visual, no una aserción automatizada.

---

## 11. Reglas de implementación (no negociables)

1. **Cero comentarios** en el código. Si una línea pide explicación, se extrae una función con ese
   nombre. La documentación es **este** documento.
2. **Cero `any`** y cero `as` fuera de los `*.spec.*` (donde se admite el cast deliberado de §10.2).
3. **Identificadores, strings de CSS y nombres de archivo en inglés.** El documento está en
   castellano; el código no.
4. **`libs/timeline-core` no se toca** (D-A, RNF-4). Ni un campo, ni un schema, ni un test.
5. **`vite.config.ts`, `eslint.config.mjs` y `project.json` no se tocan** (D-21, CA-010).
6. **Ningún test monta un componente, renderiza un frame, descarga Chrome ni sale a la red** (RNF-1).
7. **Cada helper nuevo tiene su `*.spec.ts` hermano, en el mismo directorio y con el mismo nombre.**
8. **Toda decisión vive en `src/helpers/`.** Un `if`, un `??` o una ternaria dentro de un `.tsx` es una
   decisión fuera de cobertura: hay que moverla a un helper (D-21).
9. **`exactOptionalPropertyTypes`:** propiedades opcionales declaradas `?: T | undefined` (D-22);
   nunca asignar `undefined` a una propiedad opcional sin ese `| undefined`. `vitest` no lo detecta —
   `nx build` sí.
10. **`noUncheckedIndexedAccess`:** no indexar arrays en los componentes; los helpers devuelven lo que
    hay que recorrer ya emparejado (§5.2).
11. **Cierre del ciclo:** `pnpm sdd:validate` en verde, `pnpm exec nx run-many -t lint test build` en
    verde sobre los cinco proyectos, cobertura ≥ 90 % stmts / ≥ 85 % branches (piso real
    96.2 / 92.38), y recién ahí el smoke manual de §10.4.

> **`NX_WORKSPACE_ROOT_PATH`**: si está definida y apunta a otro repo, `nx` y los scripts `sdd:*`
> corren contra ese otro repo **sin ningún error visible**. Verificarlo antes de correr los gates.

---

## 12. Dependencias externas

**Ninguna nueva.** Ni el `package.json` de la lib ni el raíz cambian.

| Ya presente                         | Uso en este ciclo                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `remotion` 4.0.522                  | `spring`, `interpolate` (helpers); `Sequence`, `useCurrentFrame`, `useVideoConfig`, `AbsoluteFill`, `Composition` (componentes)        |
| `react` ^19 / `@types/react` ^19    | `CSSProperties`, `FC`, `Children`, `isValidElement`                                                                                   |
| `@video-maker/timeline-core`        | `OutputFormat`, `SafeZone`, `ClipId`, `Frame`, `safeZoneFor`, `defaultFormat`                                                         |
| `vitest` ^4 + `@vitest/coverage-v8` | Los cuatro specs nuevos                                                                                                              |
| `typescript` ~6.0                   | `nx build` (`tsc -p tsconfig.lib.json`)                                                                                              |

`@testing-library/react` está instalado y **no se usa** (§10.2): no hace falta montar nada.

---

## 13. Riesgos

| ID   | Riesgo                                                                                                                                                                                                                                                                                             | Mitigación                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-10 | **`buildTimeline` siempre rellena `CaptionClip.box`** con el rectángulo genérico del safe zone. Cualquier consumidor que asuma la vieja precedencia (`clip.box` primero) neutraliza sin aviso el chrome de plataforma, el anclaje y el alto del preset.                                              | D-19: el default es `boxSource: 'preset'` y `clip.box` solo entra con opt-in explícito. §6.3 tiene un test contra la `Timeline` de ejemplo que fija las dos ramas. Follow-up para `spec-006` / `timeline-core`: evaluar si `box` debería quedar realmente vacío cuando nadie lo puso a mano.                                                                       |
| R-11 | **`caption-animation.spec.ts` carga el paquete `remotion` en jsdom** (D-13), y `kinetic-captions.spec.tsx` también (importa `Sequence` para comparar identidad). Si una versión futura de Remotion hiciera algo pesado o dependiente del bundler en el import, esos dos specs se caen.                | Hoy `spring` / `interpolate` / `Sequence` son importables en Node y en jsdom sin contexto (verificado contra `remotion@4.0.522`). Si alguna vez rompe: `caption-clip-plan` y `caption-active-word` **no** importan `remotion` y siguen cubriendo la lógica; el spec del componente degradaría a afirmar cantidad y props de los hijos sin comparar `type`.          |
| R-12 | **Clips de 1 a 3 frames quedan casi transparentes.** Con `enterFrames = max(1, min(pref, ⌊d/2⌋))`, un clip de 1 frame tiene `progress = -1` en su único frame. `CaptionClipSchema` permite `durationFrames: 1`.                                                                                     | Es una degradación **deliberada**: un subtítulo de 33 ms que aparece a opacidad plena es un flash, no información. `caption-animation.spec.ts` testea `durationInFrames: 1` y `2`: no tira, `opacity ∈ [0,1]`, determinista. Los grupos reales de `buildTimeline` duran decenas de frames.                                                                         |
| R-13 | **`calculateMetadata` reemplaza las props.** Si alguien vuelve a escribir `props: { timeline: … }` sin el spread (D-23), el preset elegido en Studio o en `defaultProps` se pierde **sin ningún error**: la composición renderiza con `bold-impact` y nadie se entera.                               | D-23 lo deja escrito acá, y en el código es una sola línea. El reviewer lo chequea explícitamente; la galería (§9) es lo que lo haría visible al ojo si se rompiera.                                                                                                                                                                                              |
| R-14 | **El sobrepico del spring depende de `fps`.** Los cuatro presets se calibraron a 30 fps. A 60 fps la duración en *tiempo* de la entrada se parte a la mitad (`enterDurationFrames` está en frames, no en ms).                                                                                       | Es coherente con el resto del registro, que ya razona en frames (`transitionTiming`, `punchInStyle`). Documentado en §4.1 con el equivalente en ms. Si `spec-006` expone formatos a 60 fps, la conversión frames↔ms es un follow-up de una línea, no un rediseño.                                                                                                  |
| R-15 | **El barrel pierde exportaciones por primera vez** (`CaptionTrack`, `CaptionTrackProps`, `captionLayout`). Un consumidor futuro que las esperara rompería en compilación.                                                                                                                           | D-D de la spec: no hay consumidores (`apps/web` no existe). `nx build` sobre los cinco proyectos es el detector. Queda registrado en `components.json` (COMP-003 `deprecated`) y en el fragmento aditivo de contexto del ciclo.                                                                                                                                     |
| R-16 | **`averageCharWidthEm` y los insets de chrome siguen sin medirse** contra tipografías y capturas reales (R-1, R-2, R-3 de `cycle-01`). La galería de §9 es la primera oportunidad de verlo, pero **mirar no es medir**.                                                                              | La galería con `format` real (1080×1920 por panel) y frases reales del fixture hace visible el error de estimación. Si se ve desborde o desperdicio, sale como **fix** registrado, no como cambio silencioso. Sigue siendo follow-up declarado, fuera del alcance de este ciclo (brief, `out_of_scope`).                                                            |
| R-17 | **La galería no se ejecuta en CI** (por diseño, CA-010), así que un cambio que la rompa en runtime —no en tipos— no lo detecta nadie hasta que alguien abre Studio.                                                                                                                                 | `nx lint` y `nx build` sí la typechequean y la lintean (§9.3): lo único sin cubrir es el comportamiento visual, que es precisamente para lo que existe. El costo de testearla sería montar Remotion, que RNF-1 prohíbe.                                                                                                                                            |

---

## 14. Cambios en schema y contratos de API

**Ninguno, y es una decisión, no un olvido.**

- `sdd/schema.json`: **sin cambios.** No hay base de datos en `libs/composition-remotion`. El único
  contrato de datos es la `Timeline` de `@video-maker/timeline-core`, que este ciclo consume sin
  modificar (D-A, RNF-4). Todo lo nuevo —preset, plataforma, anclaje, fuente de la caja— viaja como
  **props de componente con defaults**, nunca como campos de la `Timeline`.
- `sdd/api.json`: **sin cambios.** El ciclo no expone ni consume endpoints HTTP. La superficie es una
  API de módulo TypeScript, documentada en §3 a §9 y materializada en el barrel (§8.3).
- `sdd/components.json`: **sí cambia** — §8.4 tiene el delta exacto, entrada por entrada.

---

## 15. Qué queda deliberadamente fuera (follow-up de `spec-006` y posteriores)

| Tema                                                                           | Por qué no entra acá                                                                                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OffthreadVideo` contra `Video` para el `<Player>` de browser                   | `out_of_scope` del brief; es una decisión del consumo desde `apps/web` (`spec-006`)                                                                            |
| Consumo desde `apps/web` y elección de preset por UI                            | `spec-006`. La superficie ya está lista: props serializables con defaults                                                                                      |
| `preset` como objeto `CaptionPreset` completo (fuente propia, colores a medida) | Hoy `KineticCaptions` acepta solo el id (§7.1). Ampliar la unión es aditivo y no rompe nada; se hace cuando exista el consumidor que lo pida                    |
| Mezcla de audio                                                                | `spec-004`                                                                                                                                                     |
| Medir `averageCharWidthEm` y los insets de chrome contra capturas reales        | R-16; explícitamente `out_of_scope` del brief                                                                                                                  |
| Que `buildTimeline` deje de rellenar `CaptionClip.box` por default              | R-10. Toca `timeline-core`, que es de una spec `completed` — RNF-4 lo prohíbe en este ciclo                                                                     |
| `enterDurationFrames` expresado en ms                                          | R-14. Hoy todo el registro razona en frames; convertir es un cambio de una línea cuando aparezca un formato a 60 fps                                            |
| Tests de regresión visual (screenshot diff) de los presets                      | Exigen render o browser: RNF-1 los prohíbe en esta lib                                                                                                        |

Con este ciclo, `spec-e-burgos-003-kinetic-captions` no deja ningún RF ni CA sin cubrir: RF-1..RF-5 /
CA-001..CA-005 en `cycle-01`, RF-6..RF-9 / CA-006..CA-011 acá.
