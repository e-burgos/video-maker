# Architect — Cycle 1: Kinetic Captions & Safe Zones (`libs/composition-remotion`)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/brief.yaml
> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect

---

## 0. Alcance de este documento

`cycle-01` agrega a `libs/composition-remotion` la **capa de decisión tipográfica y de
posicionamiento** de los captions, entera como helpers puros. No entrega componente, no entrega
animación y no toca `CaptionTrack`: eso es `cycle-02` (D-E de la spec).

- **Cambios en `sdd/schema.json`: NO APLICA.** El ciclo no crea ni modifica tablas — no hay base de
  datos en el motor de composición. El único contrato de datos involucrado es la `Timeline` de
  `@video-maker/timeline-core`, que este ciclo **consume sin modificar** (D-A, RNF-4).
- **Cambios en `sdd/api.json`: NO APLICA.** El ciclo no expone ni consume endpoints HTTP. Su
  superficie es una API de módulo TypeScript (§3 a §10), no una API REST.

Por lo tanto `sdd/schema.json` y `sdd/api.json` quedan **sin tocar**: `existing_tables: []` y
`existing_endpoints: []` del brief son literales. La trazabilidad del ciclo vive en este documento,
en `tasks.json` y en el fragmento aditivo de contexto que escribe el reviewer.

**Contexto técnico vinculante leído:** `sdd/context/libs/composition-remotion/constitution.md` +
`context_prompt.md` + `updates/2026-09-07-spec-e-burgos-001-cycle-03.md`. De ahí salen tres
restricciones que atraviesan todo el diseño y que **tienen precedencia sobre cualquier preferencia
propia**: (1) el `eslint.config.mjs` de la lib prohíbe `node:*`/`fs`/`path`/`child_process`/`os` en
todo `src/**` salvo `render.ts` y `smoke.ts`, y `Date`/`process`/`Math.random` en el barrel;
(2) `vite.config.ts` mide cobertura **solo** sobre `src/helpers/**/*.ts` + `src/transitions/**/*.ts`;
(3) `tsconfig.lib.json` tiene `exactOptionalPropertyTypes: true` — y `vitest` **no typechequea**, así
que un error por esa opción aparece recién en `nx build`, nunca en `nx test`.

**Mapeo a tasks:** el planner corre en paralelo con este documento. Acá cada unidad se identifica por
su archivo y su CA; el `TASK-[NNN]` lo asigna `planner.md` / `tasks.json`.

---

## 1. Decisiones técnicas

### D-01 · Todo vive en `src/helpers/`; `vite.config.ts` no se toca

El brief proponía `src/captions/preset.ts`. **Se descarta.** Los seis archivos nuevos van a
`src/helpers/` con prefijo `caption-`:

```
src/helpers/caption-preset.ts
src/helpers/caption-safe-zone.ts
src/helpers/caption-box.ts
src/helpers/caption-font-size.ts
src/helpers/caption-word-style.ts
src/helpers/caption-font-face.ts
```

Razones, en orden de peso:

1. **`caption-preset.ts` no es solo datos.** Además del tipo y del registro exporta `captionPreset(id)`
   (§3.3), que es lógica con una rama de fallback. Si el registro viviera en `src/captions/` y el
   accesor en `src/helpers/`, el módulo quedaría partido en dos por un motivo de tooling, no de
   diseño. Un archivo con lógica **tiene que** estar dentro del `include` de cobertura.
2. **RNF-2 exige comparar contra un piso heredado** (94 % stmts / 87.87 % ramas, medido en
   `cycle-03` sobre `helpers/**` + `transitions/**`). Si en este ciclo se ampliara el `include`, el
   número dejaría de ser comparable con el piso y el gate del reviewer perdería sentido. Mantener el
   `include` idéntico es lo que hace verificable "no bajar el piso".
3. Un directorio nuevo por seis archivos que ya comparten prefijo no aporta nada: `helpers/` ya tiene
   `asset-src`, `audio-gain`, `caption-layout`, `punch-in-style`, `timeline-*`. La convención de la
   lib es prefijo por dominio, no subcarpeta.

> **Consecuencia explícita:** `libs/composition-remotion/vite.config.ts` **no se modifica en este
> ciclo** — ni el `include` de cobertura, ni los umbrales (siguen en 80 %), ni el `resolve.alias`.
> Cualquier PR de este ciclo que lo toque es un error de alcance.

### D-02 · Unidades: `em` para lo tipográfico, fracción del formato para lo espacial

Regla única, sin excepciones, que el implementador aplica a cada campo del preset:

- **Todo lo que escala con la letra se declara en `em`** (`letterSpacingEm`, `wordGapEm`,
  `averageCharWidthEm`, `lineHeightEm`, `stroke.widthEm`, paddings de la píldora). Consecuencia: el
  preset **no declara ningún píxel tipográfico** y `captionWordStyle` devuelve un estilo
  *font-size-agnóstico* — el `fontSize` lo pone el contenedor en `cycle-02` con el resultado de
  `fitCaptionFontSize`, una sola vez para todas las palabras del clip.
- **Todo lo que escala con el lienzo se declara como fracción de `format.height`**
  (`boxHeightRatio`, `minFontSizeRatio`, `maxFontSizeRatio`) o de `box.width` (`sidePaddingRatio`).
- **Los únicos px absolutos del ciclo son los insets de chrome** (§4), porque describen elementos de
  UI reales medidos sobre un lienzo de referencia. Se escalan al formato real (D-04).

Por qué `minFontSizeRatio`/`maxFontSizeRatio` se calculan sobre `format.height` y no sobre
`box.width`: la caja se angosta cuando la plataforma es TikTok (700 px contra 880 px), pero el
tamaño **mínimo legible** de la letra no cambia por eso — depende del lienzo, no del recorte. Atar
los límites al ancho de la caja haría que el mismo preset diera letras más chicas en TikTok solo por
tener más chrome, que es exactamente lo contrario de lo que pide HU-1-02.

### D-03 · `captionSafeZone` es aditivo y acepta el `safeZone` de la `Timeline` como tercer parámetro posicional

Firma (§5):

```ts
captionSafeZone(format: OutputFormat, platform?: CaptionPlatform, baseSafeZone?: SafeZone): SafeZone
```

- Los dos primeros parámetros son **literalmente** los de RF-2 y CA-001
  (`captionSafeZone(defaultFormat('tiktok-9x16'), 'tiktok')` compila y `captionSafeZone(format)`
  también). No se usa un objeto de opciones: rompería la llamada textual del CA.
- **Sí se acepta un `safeZone` explícito**, como tercer parámetro opcional. `Timeline.safeZone` es
  opcional en el schema y `TimelineComposition` ya resuelve `timeline.safeZone ?? safeZoneFor(format)`;
  si el helper no lo aceptara, el llamador tendría que sumar los insets a mano y se perdería la
  garantía "nunca reduce". Default: `baseSafeZone ?? safeZoneFor(format)`.
- **Nunca resta.** Todo inset del catálogo es `>= 0` y el resultado es `base[lado] + inset[lado]`, de
  modo que `resultado[lado] >= base[lado]` en los cuatro lados **por construcción**, no por un test
  (RN-4, CA-001). Sin `platform` los cuatro insets son 0 y la función es la identidad estructural
  sobre `base` (RN-5, CA-001).

### D-04 · Los insets de chrome son px sobre un lienzo de referencia **propio de la plataforma**, escalados al formato real

Cada entrada del catálogo declara su `reference: { width, height }` — 1080×1920 para las tres
verticales, 1920×1080 para `youtube-landscape` — y los cuatro insets en px medidos sobre ese lienzo.
Al aplicarlos:

```
scaleX = format.width  / insets.reference.width
scaleY = format.height / insets.reference.height
aplicado = Math.round(insetDeclarado * scale correspondiente)
```

Justificación: `OutputFormatSchema` admite cualquier `width`/`height >= 240`, no solo los cuatro
presets de `defaultFormat`. Un inset absoluto de 180 px sobre un lienzo de 720×1280 reservaría
proporcionalmente **menos** de lo que la app tapa. Anclando la referencia a la plataforma (que tiene
orientación inherente) y no al formato, el cálculo queda **sin ninguna rama de orientación**:
determinista, una multiplicación y un `Math.round`. Con los formatos de `defaultFormat` el escalado
es la **identidad** (`scale = 1`), así que los números de §4 son exactamente los que verifican los
tests de CA-001 y CA-002.

`Math.round` garantiza el entero que exige `SafeZoneSchema` (`z.number().int()`).

### D-05 · `captionBoxFor` recibe el preset, no un alto suelto — desviación consciente de la firma literal de RF-3

RF-3 escribe `captionBoxFor(safeZone, format, anchor)`, pero **no dice de dónde sale el alto de la
caja**, y CA-003 exige "con el alto que declara el preset". La firma adoptada es:

```ts
captionBoxFor(safeZone: SafeZone, format: OutputFormat, preset: CaptionPreset, anchor?: CaptionAnchor): CaptionBox
```

- `preset` entra como tercer posicional porque aporta `boxHeightRatio` **y** `anchor`; pasar un
  `boxHeight: number` suelto obligaría al llamador a recalcular `format.height * ratio` y abriría la
  puerta a que preset y caja se desincronicen.
- `anchor` queda **último y opcional**, con default `preset.anchor`. Así CA-003 se escribe sin
  fricción (`captionBoxFor(sz, fmt, preset, 'top' | 'center' | 'bottom')`) y el caso normal de
  `cycle-02` es una sola llamada sin anchor.
- **La desviación es de orden de parámetros, no de contrato.** RF-3 se cumple: hay anclaje elegible
  entre `top | center | bottom` y la caja siempre queda dentro del safe zone.

### D-06 · La contención se garantiza por clamp, no por confianza en el input

`captionBoxFor` acota el alto de la caja al alto disponible del safe zone
(`height = min(round(format.height * boxHeightRatio), availableHeight)`) y usa `Math.max(0, ...)` en
ancho y alto. Con eso, las cuatro invariantes de `CaptionClipBoxSchema` (`x, y, width, height`
enteros no negativos) y las de CA-002 (`x >= 0`, `y >= 0`, `x + width <= format.width`,
`y + height <= format.height`) se cumplen **algebraicamente** para todo safe zone de lados no
negativos, que es exactamente lo que producen `safeZoneFor` y `captionSafeZone`.

**Precondición documentada:** un `safeZone` con algún lado negativo (solo construible a mano — el
schema lo permite porque `SafeZoneSchema` es `z.number().int()` sin `nonnegative`) queda **fuera de
contrato**. No se agrega una rama defensiva: sería una rama muerta que castiga la cobertura de ramas
de RNF-2 sin cubrir un caso real. Ver R-5.

### D-07 · `fitCaptionFontSize` estima el ancho, nunca lo mide

Sin DOM, sin `canvas.measureText`, sin `document`. El ancho de una frase se estima como una función
lineal de la cantidad de caracteres y de la cantidad de espacios entre palabras, con un **ancho medio
de avance por carácter declarado por el preset** (`averageCharWidthEm`). El algoritmo completo, con
redondeo y clamp, está en §7 con cinco casos numéricos verificables a mano.

Por qué un factor por preset y no uno global: `bold-impact` es una sans pesada en mayúsculas
(≈ 0.62 em de avance medio) y `subtle-lower` una serif regular en caja mixta (≈ 0.50 em). Un factor
único haría que un preset desbordara y el otro desperdiciara la mitad de la caja. Y por qué el efecto
de `textTransform: 'uppercase'` se pliega dentro de `averageCharWidthEm` en vez de ser un
multiplicador aparte: es un valor calibrado por preset, y un multiplicador extra agregaría una rama
sin agregar información — el preset ya sabe si va en mayúsculas.

### D-08 · `captionWordStyle`: el énfasis gana en los canales discretos, la escala compone

Precedencia formal entre `isEmphasis` e `isActive` en §8. La regla es:
**`isEmphasis` tiene precedencia absoluta sobre `isActive` en peso, color y píldora; la escala es el
único canal que compone (se multiplican).**

Justificación directa de RN-14: si `isActive` pisara el color, la palabra de impacto perdería su
identidad **justo en el frame en que se pronuncia**, que es el momento en que más importa. Y como la
escala compone multiplicativamente, el estado `emphasis + active` queda estrictamente por encima de
cada uno por separado, así que los cuatro estados siguen siendo distinguibles entre sí (RN-13).

### D-09 · `captionFontFaceCss` no importa `remotion` ni resuelve rutas

El helper recibe la URL **ya resuelta** y solo formatea CSS. No llama `staticFile()`, no lee
`public/`, no toca el filesystem.

Motivo: `staticFile()` depende de un global de Remotion, lo que volvería el helper dependiente del
entorno y arrastraría `remotion` dentro de `src/helpers/**` (hoy ningún helper lo importa). Quien
resuelve la ruta es el llamador — `staticFile('fonts/Inter-Bold.woff2')` en `cycle-02` — y el README
lo documenta. El helper queda 100 % puro, testeable por igualdad de string, y RNF-1 se cumple sin
esfuerzo.

### D-10 · Cero binarios: `public/fonts/` se crea gitignoreado, igual que `public/example/`

Se agrega `libs/composition-remotion/public/fonts/.gitignore` con exactamente el mismo contenido que
ya tiene `public/example/.gitignore`:

```
*
!.gitignore
```

Así el directorio existe (Remotion resuelve `staticFile()` contra el `public/` del root de la lib,
que es el que fija el `package.json` propio de D-03 de `cycle-03`) y **ningún `.ttf`/`.woff2` puede
entrar al repo por accidente** (RNF-5, RN-16). El procedimiento para colgar una fuente propia se
documenta en el README (RN-15, CA-11 del funcional).

### D-11 · `captionLayout` y `CaptionTrack` **no se tocan** en este ciclo

`captionBoxFor` supersede a `captionLayout`, pero `CaptionTrack` sigue vivo hasta `cycle-02` (D-D de
la spec) y lo usa. Eliminar `captionLayout` ahora rompería `caption-track.tsx` sin nada que lo
reemplace. Ambos se dan de baja en `cycle-02`, junto con la eliminación de `CaptionTrack` del barrel.
En este ciclo el barrel **crece, no cambia**: ninguna exportación existente se toca.

### D-12 · Compatibilidad hacia adelante con `cycle-02`

Dos restricciones de diseño que existen solo para que `cycle-02` encaje sin refactor:

- **`captionWordStyle` devuelve un `transform` con una sola función `scale(...)`.** La animación de
  entrada/salida del clip (RF-6) se aplica al **contenedor** del bloque de palabras, nunca a la
  palabra. Si el estilo por palabra emitiera además `translate`, `captionClipAnimation` no podría
  componer sin reescribir el string.
- **`captionWordStyle` no emite `fontSize`.** El tamaño lo pone el contenedor una sola vez por clip
  (D-02), de modo que `activeWordIndex` (RF-7) pueda cambiar el estilo de una palabra frame a frame
  sin recalcular el ajuste tipográfico del clip entero.

---

## 2. Estructura de `src/**` y asignación por unidad

| Archivo                                                | Estado    | Contenido                                                                 | RF / CA            |
| ------------------------------------------------------ | --------- | ------------------------------------------------------------------------- | ------------------ |
| `src/helpers/caption-preset.ts`                        | **nuevo** | `CaptionPreset` y tipos satélite, `CAPTION_PRESETS`, `CAPTION_PRESET_IDS`, `DEFAULT_CAPTION_PRESET_ID`, `captionPreset()` | RF-1 / CA-004      |
| `src/helpers/caption-preset.spec.ts`                   | **nuevo** | CA-004 + RN-1/2/3 iterando `CAPTION_PRESET_IDS`                            | CA-004             |
| `src/helpers/caption-safe-zone.ts`                     | **nuevo** | `CaptionPlatform`, `CAPTION_PLATFORMS`, `CaptionChromeInsets`, `captionChromeInsets()`, `captionSafeZone()` | RF-2 / CA-001, CA-002 |
| `src/helpers/caption-safe-zone.spec.ts`                | **nuevo** | CA-001, CA-002 (inset derecho de `tiktok`), CE-2                           | CA-001, CA-002     |
| `src/helpers/caption-box.ts`                           | **nuevo** | `CaptionAnchor`, `captionBoxFor()`                                         | RF-3 / CA-003, CA-002 |
| `src/helpers/caption-box.spec.ts`                      | **nuevo** | CA-003 + invariante de contención 4 presets × 4 plataformas                | CA-003, CA-002     |
| `src/helpers/caption-font-size.ts`                     | **nuevo** | `fitCaptionFontSize()`                                                     | RF-4 / CA-005      |
| `src/helpers/caption-font-size.spec.ts`                | **nuevo** | CA-005, RN-10/11/12, CE-4, guarda de frase vacía, tope por alto            | CA-005             |
| `src/helpers/caption-word-style.ts`                    | **nuevo** | `CaptionWordState`, `captionWordStyle()`                                   | RF-5 / CA-004      |
| `src/helpers/caption-word-style.spec.ts`               | **nuevo** | RN-13, RN-14, tabla de precedencia de §8 por preset                        | CA-004             |
| `src/helpers/caption-font-face.ts`                     | **nuevo** | `CaptionFontFace`, `captionFontFaceCss()`                                  | RF-1-06 / RN-15    |
| `src/helpers/caption-font-face.spec.ts`                | **nuevo** | igualdad literal del bloque `@font-face`, escapado, lista vacía            | CA-11 (funcional)  |
| `src/index.ts`                                         | modificado| solo **agrega** exportaciones (§10)                                        | —                  |
| `public/fonts/.gitignore`                              | **nuevo** | `*` + `!.gitignore` (D-10)                                                 | RNF-5              |
| `README.md`                                            | modificado| sección "Fuente propia en `public/fonts/`" (RN-15)                         | CA-11 (funcional)  |
| `vite.config.ts`, `eslint.config.mjs`, `project.json`  | **intacto**| D-01                                                                       | RNF-2              |
| `src/helpers/caption-layout.ts`, `src/components/caption-track.tsx` | **intacto** | D-11                                                     | —                  |
| `libs/timeline-core/**`                                | **intacto**| D-A, RNF-4                                                                 | —                  |

Los specs importan por ruta relativa, nunca desde el barrel — mismo criterio que `cycle-03` y que
`timeline-core`.

---

## 3. `CaptionPreset` — tipo completo, campo por campo

`src/helpers/caption-preset.ts`

### 3.1 Tipos

```ts
export type CaptionPresetId = 'bold-impact' | 'clean-sans' | 'outline-pop' | 'subtle-lower';

export type CaptionTextTransform = 'none' | 'uppercase';

export interface CaptionStroke {
  widthEm: number;
  color: string;
}

export interface CaptionPill {
  color: string;
  emphasisColor: string;
  paddingXEm: number;
  paddingYEm: number;
  radiusEm: number;
}

export interface CaptionPreset {
  id: CaptionPresetId;
  fontFamily: string;
  fontWeight: number;
  emphasisFontWeight: number;
  color: string;
  emphasisColor: string;
  activeColor: string;
  emphasisScale: number;
  activeScale: number;
  textTransform: CaptionTextTransform;
  letterSpacingEm: number;
  lineHeightEm: number;
  wordGapEm: number;
  averageCharWidthEm: number;
  anchor: CaptionAnchor;
  boxHeightRatio: number;
  sidePaddingRatio: number;
  minFontSizeRatio: number;
  maxFontSizeRatio: number;
  stroke: CaptionStroke | null;
  shadow: string | null;
  pill: CaptionPill | null;
}
```

`CaptionAnchor` **no** se declara acá: vive en `caption-box.ts` (§6) y `caption-preset.ts` lo importa
por tipo. El anclaje es una noción de layout; el preset solo elige un default.

`null` explícito y nunca `?` en los tres campos opcionales (`stroke`, `shadow`, `pill`): con
`exactOptionalPropertyTypes: true` una propiedad opcional no admite `undefined` asignado, y un
registro literal donde tres presets omiten el campo y uno lo declara es más frágil de leer que cuatro
presets que declaran los 22 campos siempre. **El registro es exhaustivo: todo preset declara todos
los campos.**

### 3.2 Unidades y semántica — tabla normativa

| Campo                | Unidad                                       | Semántica                                                                                  |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                 | —                                            | Clave del registro; igual a la clave del `Record`                                            |
| `fontFamily`         | stack CSS                                    | **Debe terminar en `sans-serif` o `serif`** (CA-004, RN-2). Familias con espacio, entre comillas simples |
| `fontWeight`         | peso CSS numérico (100–900)                  | Palabra normal                                                                               |
| `emphasisFontWeight` | peso CSS numérico (100–900)                  | Palabra de impacto. Invariante: distinto de `fontWeight`                                     |
| `color`              | color CSS                                    | Palabra normal                                                                               |
| `emphasisColor`      | color CSS                                    | Palabra de impacto. Invariante: distinto de `color`                                          |
| `activeColor`        | color CSS                                    | Palabra activa que no es la de impacto                                                       |
| `emphasisScale`      | multiplicador adimensional, `> 1`            | Escala de la palabra de impacto                                                              |
| `activeScale`        | multiplicador adimensional, `> 1`            | Escala de la palabra activa. `> 1` garantiza distinción normal/activa aunque el color coincida |
| `textTransform`      | —                                            | `'uppercase'` se emite tal cual como CSS                                                     |
| `letterSpacingEm`    | **em** (relativo al `fontSize` del clip)     | Se emite como `<valor>em` y **se suma al ancho estimado de cada carácter** (§7 paso 4)       |
| `lineHeightEm`       | **em** (adimensional CSS)                    | Se emite como número. También es el divisor del tope por alto de caja (§7 paso 6)            |
| `wordGapEm`          | **em**                                       | Separación horizontal entre palabras; `cycle-02` la emite como `marginRight` y cuenta en el ancho estimado |
| `averageCharWidthEm` | **em**                                       | Avance medio por carácter de la familia del preset, con su `textTransform` ya plegado (D-07) |
| `anchor`             | —                                            | Anclaje vertical por defecto del preset                                                      |
| `boxHeightRatio`     | **fracción de `format.height`** (0–1)        | Alto de la caja de captions antes del clamp al safe zone                                     |
| `sidePaddingRatio`   | **fracción de `box.width`, por lado** (0–0.5)| Respiro horizontal descontado del ancho útil en `fitCaptionFontSize`                         |
| `minFontSizeRatio`   | **fracción de `format.height`**              | Piso del tamaño de letra; se resuelve a px con `Math.round`                                  |
| `maxFontSizeRatio`   | **fracción de `format.height`**              | Techo del tamaño de letra. Invariante: `> minFontSizeRatio`                                  |
| `stroke.widthEm`     | **em**                                       | Se emite como `WebkitTextStroke: '<w>em <color>'` + `paintOrder: 'stroke fill'`              |
| `shadow`             | valor CSS `text-shadow` con longitudes en em | `null` = sin sombra                                                                          |
| `pill.paddingXEm` / `paddingYEm` / `radiusEm` | **em**                      | Fondo tipo píldora **por palabra**; `null` = sin fondo                                       |

> **Regla de oro (D-02):** ningún campo del preset está en píxeles. Un preset es
> resolución-independiente por construcción; los px aparecen recién cuando `format` entra en juego.

### 3.3 Registro `CAPTION_PRESETS` — valores concretos

```ts
export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionPreset> = {
  'bold-impact': {
    id: 'bold-impact',
    fontFamily: "'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 800,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ffe45e',
    activeColor: '#ffffff',
    emphasisScale: 1.12,
    activeScale: 1.08,
    textTransform: 'uppercase',
    letterSpacingEm: 0.02,
    lineHeightEm: 1.1,
    wordGapEm: 0.3,
    averageCharWidthEm: 0.62,
    anchor: 'center',
    boxHeightRatio: 0.24,
    sidePaddingRatio: 0.04,
    minFontSizeRatio: 0.045,
    maxFontSizeRatio: 0.11,
    stroke: { widthEm: 0.02, color: '#000000' },
    shadow: '0 0.04em 0.12em rgba(0, 0, 0, 0.85)',
    pill: null,
  },
  'clean-sans': {
    id: 'clean-sans',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    emphasisFontWeight: 800,
    color: '#ffffff',
    emphasisColor: '#4ade80',
    activeColor: '#ffffff',
    emphasisScale: 1.08,
    activeScale: 1.06,
    textTransform: 'none',
    letterSpacingEm: 0,
    lineHeightEm: 1.15,
    wordGapEm: 0.28,
    averageCharWidthEm: 0.52,
    anchor: 'bottom',
    boxHeightRatio: 0.18,
    sidePaddingRatio: 0.05,
    minFontSizeRatio: 0.035,
    maxFontSizeRatio: 0.075,
    stroke: null,
    shadow: '0 0.03em 0.1em rgba(0, 0, 0, 0.7)',
    pill: null,
  },
  'outline-pop': {
    id: 'outline-pop',
    fontFamily: "'Poppins', 'Trebuchet MS', 'Segoe UI', sans-serif",
    fontWeight: 700,
    emphasisFontWeight: 900,
    color: '#ffffff',
    emphasisColor: '#ff4d6d',
    activeColor: '#ffd166',
    emphasisScale: 1.14,
    activeScale: 1.1,
    textTransform: 'uppercase',
    letterSpacingEm: 0.01,
    lineHeightEm: 1.1,
    wordGapEm: 0.32,
    averageCharWidthEm: 0.6,
    anchor: 'center',
    boxHeightRatio: 0.22,
    sidePaddingRatio: 0.04,
    minFontSizeRatio: 0.04,
    maxFontSizeRatio: 0.1,
    stroke: { widthEm: 0.045, color: '#101010' },
    shadow: '0 0.05em 0.14em rgba(0, 0, 0, 0.6)',
    pill: null,
  },
  'subtle-lower': {
    id: 'subtle-lower',
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    fontWeight: 500,
    emphasisFontWeight: 700,
    color: '#f5f5f5',
    emphasisColor: '#ffffff',
    activeColor: '#f5f5f5',
    emphasisScale: 1.05,
    activeScale: 1.03,
    textTransform: 'none',
    letterSpacingEm: 0.005,
    lineHeightEm: 1.2,
    wordGapEm: 0.26,
    averageCharWidthEm: 0.5,
    anchor: 'bottom',
    boxHeightRatio: 0.12,
    sidePaddingRatio: 0.06,
    minFontSizeRatio: 0.028,
    maxFontSizeRatio: 0.05,
    stroke: null,
    shadow: null,
    pill: {
      color: 'rgba(0, 0, 0, 0.55)',
      emphasisColor: 'rgba(0, 0, 0, 0.78)',
      paddingXEm: 0.35,
      paddingYEm: 0.12,
      radiusEm: 0.35,
    },
  },
};

export const CAPTION_PRESET_IDS: readonly CaptionPresetId[] = [
  'bold-impact',
  'clean-sans',
  'outline-pop',
  'subtle-lower',
];

export const DEFAULT_CAPTION_PRESET_ID: CaptionPresetId = 'bold-impact';

export function captionPreset(id: CaptionPresetId = DEFAULT_CAPTION_PRESET_ID): CaptionPreset {
  return CAPTION_PRESETS[id] ?? CAPTION_PRESETS[DEFAULT_CAPTION_PRESET_ID];
}
```

**Caso de uso de cada preset** (RN-1, uno por caso):

| Preset          | Caso de uso                                                | Rasgo distintivo                                                          |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `bold-impact`   | Hook / gancho, texto grande al centro                       | Mayúsculas, 800/900, contorno fino, ámbar en el impacto                   |
| `clean-sans`    | Explicativo, subtítulo legible sin ruido visual             | Sin contorno, caja mixta, anclado abajo, verde en el impacto              |
| `outline-pop`   | Máximo contraste sobre metraje ruidoso                      | Contorno grueso (0.045 em) + `paintOrder`, tres colores saturados         |
| `subtle-lower`  | Discreto abajo, subtítulo tipo documental                   | Serif, píldora semitransparente, el rango de tamaño más chico del registro |

**El fallback del `??` en `captionPreset` es intencional y se cubre con un test** que pasa
`'neon' as CaptionPresetId`: `CAPTION_PRESETS` es total sobre la unión, así que en TypeScript la rama
es inalcanzable, pero es la que protege un `id` que llegue por props sin validar en `cycle-02`
(CE-1 del funcional: entrada desconocida → comportamiento por defecto, sin excepción).

### 3.4 Invariantes verificables del registro (CA-004, RN-1/2/3)

Un solo test que itera `CAPTION_PRESET_IDS` verifica, para **cada** preset:

1. `CAPTION_PRESET_IDS.length >= 4`.
2. `fontFamily` termina en `sans-serif` o en `serif` (regex `/(?:^|,\s*)(sans-serif|serif)$/`).
3. `emphasisFontWeight !== fontWeight` **y** `emphasisColor !== color` — dos canales distintos, no
   uno (RN-3, CA-004).
4. `activeScale > 1` y `emphasisScale > 1` — garantiza que normal y activa se distinguen aunque
   `activeColor === color` (el caso de `bold-impact` y de `subtle-lower`).
5. `maxFontSizeRatio > minFontSizeRatio` y ambos dentro de `(0, 1)`.
6. `0 <= sidePaddingRatio < 0.5` y `0 < boxHeightRatio <= 1`.
7. `captionWordStyle(preset, { isEmphasis: false, isActive: false })` **no es estructuralmente igual**
   a `captionWordStyle(preset, { isEmphasis: true, isActive: false })` (CA-004).

---

## 4. `CaptionPlatform` e insets de chrome

`src/helpers/caption-safe-zone.ts`

```ts
export type CaptionPlatform = 'instagram-reels' | 'tiktok' | 'youtube-shorts' | 'youtube-landscape';

export const CAPTION_PLATFORMS: readonly CaptionPlatform[] = [
  'instagram-reels',
  'tiktok',
  'youtube-shorts',
  'youtube-landscape',
];

export interface CaptionChromeReference {
  width: number;
  height: number;
}

export interface CaptionChromeInsets {
  reference: CaptionChromeReference;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function captionChromeInsets(platform?: CaptionPlatform): CaptionChromeInsets;
```

`CAPTION_CHROME_INSETS` (el `Record`) queda **módulo-privado**: la única puerta es
`captionChromeInsets()`, para que la tabla tenga un solo accesor y CA-002 se escriba como
`captionChromeInsets('tiktok').right`.

### 4.1 Tabla de insets — px sobre el lienzo de referencia de la plataforma

Todos los valores son **adicionales** al safe zone base del formato
(portrait `{ top: 220, bottom: 400, left: 60, right: 140 }`, landscape `{ 60, 60, 60, 60 }`).

| Plataforma           | Referencia  | `top` | `bottom` | `left` | `right` |
| -------------------- | ----------- | ----- | -------- | ------ | ------- |
| `instagram-reels`    | 1080 × 1920 | 40    | 200      | 0      | 140     |
| `tiktok`             | 1080 × 1920 | 60    | 120      | 0      | **180** |
| `youtube-shorts`     | 1080 × 1920 | 40    | 260      | 0      | 130     |
| `youtube-landscape`  | 1920 × 1080 | 60    | 120      | 0      | 0       |
| *(sin plataforma)*   | —           | 0     | 0        | 0      | 0       |

### 4.2 Justificación numérica de cada inset

**`instagram-reels`**

- `top: 40` — la fila superior de Reels (título "Reels" + ícono de cámara) baja hasta ≈ 260 px desde
  el borde superior, contando barra de estado y notch. El safe zone base ya reserva 220 → faltan 40.
- `bottom: 200` — el bloque inferior izquierdo (usuario, caption de la publicación, ticker de audio)
  más el indicador de home suben hasta ≈ 600 px. Base 400 → faltan 200.
- `left: 0` — a media altura el borde izquierdo está libre; todo el texto de Instagram está en la
  franja inferior, ya cubierta por `bottom`.
- `right: 140` — la barra de acciones (me gusta, comentar, compartir, más, carátula de audio) mide
  ≈ 100 px de íconos + ≈ 40 px de margen derecho. Total resultante: 280 px desde el borde derecho.

**`tiktok`**

- `top: 60` — la fila "Siguiendo | Para ti" con la lupa a la derecha llega hasta ≈ 280 px. Base 220
  → faltan 60.
- `bottom: 120` — la barra de navegación de la app (Inicio / Amigos / + / Bandeja / Perfil) mide
  ≈ 130 px; el bloque de usuario + descripción + música ya cae dentro de los 400 px base. Total 520.
- `left: 0` — misma razón que Reels.
- **`right: 180`** — la columna de acciones de TikTok es la más ancha del catálogo: avatar con el
  botón "+", corazón, comentarios, guardar, compartir y el disco giratorio de la música. Los íconos
  ocupan ≈ 130 px y el margen derecho de la app ≈ 50 px. **Satisface CA-002 en sus dos lecturas
  posibles**: la reserva *adicional* es 180 >= 150, y el margen derecho *total* resultante es
  `140 + 180 = 320` px >= 150.

**`youtube-shorts`**

- `top: 40` — fila superior con el logo Shorts, la búsqueda y el menú: ≈ 260 px. Base 220 → 40.
- `bottom: 260` — es el inset más grande del catálogo y el motivo está en el diseño de Shorts: apila
  handle del canal, **título de hasta dos líneas** y fila de sonido en el borde inferior izquierdo, y
  debajo de todo eso la barra de navegación de la app. El bloque completo llega a ≈ 660 px desde
  abajo. Base 400 → faltan 260.
- `left: 0` — misma razón que Reels.
- `right: 130` — columna de acciones (me gusta, no me gusta, comentarios, compartir, remix, avatar):
  ≈ 100 px de íconos + 30 px de margen. Total 270 px.

**`youtube-landscape`**

- `top: 60` — overlay superior del reproductor: título del video, canal, botón de cast y ajustes.
  Sobre un alto de 1080 ocupa ≈ 120 px. Base 60 → faltan 60.
- `bottom: 120` — barra de progreso + fila de controles (play, volumen, tiempo, subtítulos, calidad,
  pantalla completa): ≈ 180 px. Base 60 → faltan 120.
- `left: 0` / `right: 0` — en landscape **el chrome de YouTube es horizontal**: todo lo que se
  superpone al video está en la franja superior o en la inferior, y los insets verticales ya lo
  cubren. Reservar ancho acá angostaría la caja sin ninguna ganancia.

> **Vigencia:** la tabla es una foto de la UI de cada app a **2026-09-07**, medida sobre el lienzo de
> referencia de la plataforma. Vive en una sola constante para que actualizarla sea editar cuatro
> números. Ver R-3.

### 4.3 Safe zones resultantes con `defaultFormat` (escalado = identidad)

| Llamada                                                              | Safe zone resultante                          | Ancho útil | Alto útil |
| --------------------------------------------------------------------- | --------------------------------------------- | ---------- | --------- |
| `captionSafeZone(defaultFormat('reels-9x16'))`                        | `{ top:220, bottom:400, left:60, right:140 }`  | 880        | 1300      |
| `captionSafeZone(defaultFormat('reels-9x16'), 'instagram-reels')`     | `{ top:260, bottom:600, left:60, right:280 }`  | 740        | 1060      |
| `captionSafeZone(defaultFormat('tiktok-9x16'), 'tiktok')`             | `{ top:280, bottom:520, left:60, right:320 }`  | 700        | 1120      |
| `captionSafeZone(defaultFormat('shorts-9x16'), 'youtube-shorts')`     | `{ top:260, bottom:660, left:60, right:270 }`  | 750        | 1000      |
| `captionSafeZone(defaultFormat('youtube-16x9'), 'youtube-landscape')` | `{ top:120, bottom:180, left:60, right:60 }`   | 1800       | 780       |

`ancho útil = format.width − left − right`, `alto útil = format.height − top − bottom`.

**CA-001 verificado sobre esta tabla:** en las cinco filas cada lado es mayor o igual que el del safe
zone base del formato, y la primera fila es exactamente `safeZoneFor(defaultFormat('reels-9x16'))`.

---

## 5. `captionSafeZone` — contrato

```ts
export function captionSafeZone(
  format: OutputFormat,
  platform?: CaptionPlatform,
  baseSafeZone?: SafeZone,
): SafeZone;
```

Semántica exacta:

```
base    = baseSafeZone ?? safeZoneFor(format)
insets  = captionChromeInsets(platform)
scaleX  = format.width  / insets.reference.width
scaleY  = format.height / insets.reference.height

resultado = {
  top:    base.top    + Math.round(insets.top    * scaleY),
  bottom: base.bottom + Math.round(insets.bottom * scaleY),
  left:   base.left   + Math.round(insets.left   * scaleX),
  right:  base.right  + Math.round(insets.right  * scaleX),
}
```

Y `captionChromeInsets`:

```
platform === undefined            -> NO_CHROME_INSETS   (los cuatro lados en 0)
CAPTION_CHROME_INSETS[platform]   -> la entrada del catálogo
si el lookup diera undefined      -> NO_CHROME_INSETS   (CE-2)
```

| Propiedad                                                    | Cómo se garantiza                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Nunca reduce** (RN-4, CA-001)                               | Todo inset del catálogo es `>= 0` y `Math.round` de un no-negativo es no-negativo → `resultado[lado] >= base[lado]` por construcción      |
| **Sin `platform` es la identidad** (RN-5, CA-001)             | `NO_CHROME_INSETS` tiene los cuatro lados en 0 → `resultado` es estructuralmente igual a `base`                                           |
| **Plataforma no soportada = ausencia de plataforma** (CE-2)   | El `??` a `NO_CHROME_INSETS`; el test lo ejercita con `'vimeo' as CaptionPlatform`                                                        |
| **Enteros** (`SafeZoneSchema` es `z.number().int()`)          | `Math.round` sobre el inset; `base` ya es entero                                                                                         |
| **Determinismo** (RNF-1)                                      | Aritmética pura sobre los argumentos; sin `Date`, sin `Math.random`, sin DOM                                                              |
| **`baseSafeZone` explícito respeta la aditividad**            | El resultado se suma sobre lo que venga; el helper nunca recorta el base                                                                  |

Devuelve un objeto **nuevo** en todos los casos (nunca el `baseSafeZone` recibido), para que el
llamador no pueda mutar la `Timeline` por alias.

---

## 6. `captionBoxFor` — anclaje y contención

`src/helpers/caption-box.ts`

```ts
export type CaptionAnchor = 'top' | 'center' | 'bottom';

export function captionBoxFor(
  safeZone: SafeZone,
  format: OutputFormat,
  preset: CaptionPreset,
  anchor?: CaptionAnchor,
): CaptionBox;
```

`CaptionBox` es el tipo ya derivado en `src/helpers/timeline-types.ts`
(`NonNullable<CaptionClip['box']>`), o sea `{ x, y, width, height }` de enteros no negativos.

Semántica exacta:

```
resolvedAnchor  = anchor ?? preset.anchor
availableWidth  = Math.max(0, format.width  - safeZone.left - safeZone.right)
availableHeight = Math.max(0, format.height - safeZone.top  - safeZone.bottom)
height          = Math.min(Math.round(format.height * preset.boxHeightRatio), availableHeight)
slack           = availableHeight - height

y = safeZone.top                            si resolvedAnchor === 'top'
y = safeZone.top + Math.round(slack / 2)    si resolvedAnchor === 'center'
y = safeZone.top + slack                    si resolvedAnchor === 'bottom'

resultado = { x: safeZone.left, y, width: availableWidth, height }
```

**Por qué el alto se deriva del preset y no del alto disponible:** `boxHeightRatio` es la altura que
el *look* reserva para el bloque de palabras (un `bold-impact` necesita 24 % del alto para su letra
grande; un `subtle-lower` se conforma con 12 %). El `Math.min` contra `availableHeight` es lo que
convierte esa preferencia en una garantía de contención (D-06).

### 6.1 Garantías (CA-003, CA-002, RN-7/8/9)

| Invariante                                       | Prueba                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `x >= 0`, `y >= 0`                                | `safeZone.left >= 0`, `safeZone.top >= 0` y `slack >= 0` (precondición D-06)                              |
| `x + width <= format.width`                       | `left + (width − left − right) = width − right <= width`, con `right >= 0`                                 |
| `y + height <= format.height`                     | `y + height <= top + slack + height = top + availableHeight = format.height − bottom <= format.height`     |
| **Contenida en el safe zone** (RN-8)              | `y >= safeZone.top` y `y + height <= safeZone.top + availableHeight`                                       |
| **Tres cajas distintas** (RN-7, CA-003)           | `slack > 0` implica `y(top) < y(center) < y(bottom)`; con los cuatro presets y las cuatro plataformas el `slack` mínimo es `1000 − 461 = 539` px |
| **Alto = el que declara el preset** (CA-003)      | `height === Math.round(format.height * preset.boxHeightRatio)` mientras no ligue el clamp                  |
| **Entero no negativo** (`CaptionClipBoxSchema`)   | `Math.round` / `Math.max(0, ...)` en las cuatro coordenadas                                                |

### 6.2 Valores concretos — `defaultFormat('tiktok-9x16')` + `platform: 'tiktok'`

Safe zone `{ top: 280, bottom: 520, left: 60, right: 320 }` → `availableWidth = 700`,
`availableHeight = 1120`.

| Preset          | `height` | `slack` | `y` top | `y` center | `y` bottom | `x` | `width` | `y + height` (bottom) |
| --------------- | -------- | ------- | ------- | ---------- | ---------- | --- | ------- | --------------------- |
| `bold-impact`   | 461      | 659     | 280     | 610        | 939        | 60  | 700     | 1400                  |
| `clean-sans`    | 346      | 774     | 280     | 667        | 1054       | 60  | 700     | 1400                  |
| `outline-pop`   | 422      | 698     | 280     | 629        | 978        | 60  | 700     | 1400                  |
| `subtle-lower`  | 230      | 890     | 280     | 725        | 1170       | 60  | 700     | 1400                  |

Comprobación de CA-002 en las cuatro filas: `x = 60 >= 0`, `y >= 280 >= 0`,
`x + width = 760 <= 1080`, `y + height = 1400 <= 1920`. Detalle de redondeo:
`Math.round(659 / 2) = 330` (JS redondea el `.5` hacia arriba) → el `center` de `bold-impact` es
610, no 609.

### 6.3 Alturas de caja por formato

| Preset          | `boxHeightRatio` | Alto @1920 | Alto @1080 |
| --------------- | ---------------- | ---------- | ---------- |
| `bold-impact`   | 0.24             | 461        | 259        |
| `clean-sans`    | 0.18             | 346        | 194        |
| `outline-pop`   | 0.22             | 422        | 238        |
| `subtle-lower`  | 0.12             | 230        | 130        |

El menor alto útil del catálogo es `youtube-shorts` con 1000 px (@1920) y `youtube-landscape` con
780 px (@1080): en las 16 combinaciones preset × plataforma el clamp del `Math.min` **nunca liga** y
los tres anclajes siempre dan tres cajas distintas. El test de invariante recorre
`CAPTION_PRESET_IDS × CAPTION_PLATFORMS` y lo verifica.

---

## 7. `fitCaptionFontSize` — algoritmo determinista

`src/helpers/caption-font-size.ts`

```ts
export function fitCaptionFontSize(
  words: readonly CaptionWord[],
  box: CaptionBox,
  preset: CaptionPreset,
  format: OutputFormat,
): number;
```

`CaptionWord` es el tipo ya derivado en `src/helpers/timeline-types.ts`
(`CaptionClip['words'][number]`): `{ text, fromFrame, durationFrames }`. El helper **solo lee
`text`** — los frames no entran en el ajuste tipográfico.

### 7.1 Los siete pasos

```
1. minFontSize = Math.round(format.height * preset.minFontSizeRatio)
   maxFontSize = Math.round(format.height * preset.maxFontSizeRatio)

2. characterCount = suma de [...word.text].length sobre todas las palabras

3. wordGaps = Math.max(0, words.length - 1)

4. widthEm = characterCount * (preset.averageCharWidthEm + preset.letterSpacingEm)
           + wordGaps * preset.wordGapEm

5. si widthEm <= 0  ->  return maxFontSize            (guarda; corta el 0/0)

6. availableWidth = Math.max(0, box.width * (1 - 2 * preset.sidePaddingRatio))
   heightCap      = Math.floor(box.height / preset.lineHeightEm)
   rawFontSize    = Math.min(availableWidth / widthEm, heightCap)

7. return Math.min(maxFontSize, Math.max(minFontSize, Math.floor(rawFontSize)))
```

### 7.2 Por qué cada paso es así

- **Paso 2 — `[...text].length`, no `text.length`.** Cuenta puntos de código: una vocal acentuada o
  un emoji cuentan 1, como el glifo que efectivamente se dibuja. Con `.length` una `é` compuesta o un
  emoji contarían 2 y el tamaño saldría más chico de lo debido. Limitación aceptada: un emoji ocupa
  bastante más que un carácter medio; los captions vienen de transcripción y prácticamente no los
  tienen (ver R-1).
- **Paso 3 — el espacio se cuenta como `words.length − 1` huecos, no como caracteres.** El bloque de
  palabras se compone con `marginRight` entre palabras (`wordGapEm`), no con un carácter espacio: no
  hay hueco después de la última palabra. `Math.max(0, ...)` deja el caso de la lista vacía en 0 sin
  producir un `-1`.
- **Paso 4 — `letterSpacingEm` se suma a *cada* carácter, no a `n − 1`.** Es lo que hace el motor de
  layout: `letter-spacing` agrega el espaciado también después del último glifo. Contarlo por
  carácter es la estimación conservadora, la que **sobreestima** el ancho y por lo tanto nunca
  desborda.
- **Paso 5 — la guarda.** Con `words: []` y `box.width: 0` la división sería `0 / 0 = NaN`, y un
  `NaN` atraviesa `Math.min` / `Math.max` intacto hasta el valor de retorno. La guarda lo corta en el
  único punto donde puede aparecer y devuelve el techo del preset, que es el comportamiento natural
  para "no hay nada que achicar". `CaptionClipSchema` ya exige `min(1)` palabras, así que en
  producción no se alcanza: es totalidad del helper, y se cubre con un test explícito.
- **Paso 6 — `heightCap`.** Red de seguridad: una caja muy baja no puede alojar una letra alta por
  más que sobre ancho. Con los cuatro presets del registro el tope nunca liga (`bold-impact`:
  `floor(461 / 1.1) = 419` contra un `maxFontSize` de 211), así que es inerte en producción; se cubre
  con un test de caja sintética baja. Al ser un `Math.min` y no un `if`, no agrega una rama a la
  cobertura.
- **Paso 7 — `Math.floor`, no `Math.round`.** Redondear hacia arriba puede hacer que el ancho
  estimado supere el disponible, que es justo lo que la función existe para evitar. `floor` garantiza
  `anchoEstimado <= availableWidth` siempre que el resultado no venga del piso del clamp.
- **Paso 7 — orden del clamp: primero `max` con el piso, después `min` con el techo.** Con el
  invariante `minFontSize < maxFontSize` (§3.4) el orden es indistinto, pero fijarlo hace el
  resultado inequívoco. **RN-11 tiene prioridad sobre RN-10** (CE-4): una frase que ni con el mínimo
  entraría se devuelve igual con `minFontSize` — el helper no baja del piso ni recorta texto.

### 7.3 Propiedades demostradas, no testeadas por muestreo

- **Monotonía (RN-10).** `widthEm` es no decreciente en `characterCount` y en `words.length`;
  `rawFontSize` es no creciente en `widthEm`; `floor` y el clamp son monótonos no decrecientes. Por
  composición, **agregar caracteres o palabras nunca aumenta el tamaño devuelto**.
- **Rango (RN-11).** La última expresión es literalmente un clamp a `[minFontSize, maxFontSize]`.
- **Determinismo (RN-12).** Solo aritmética de punto flotante sobre los argumentos: sin `Date`, sin
  `Math.random`, sin DOM, sin estado de módulo. Dos llamadas idénticas devuelven exactamente lo mismo.

### 7.4 Verificación numérica de CA-005 — `bold-impact` sobre la caja de TikTok

Entradas fijas: `format = defaultFormat('tiktok-9x16')` (1080 × 1920),
`box = { x: 60, y: 610, width: 700, height: 461 }` (§6.2), `preset = CAPTION_PRESETS['bold-impact']`.

Constantes derivadas:

```
minFontSize    = round(1920 * 0.045) = 86
maxFontSize    = round(1920 * 0.11)  = 211
availableWidth = 700 * (1 - 2*0.04)  = 644
heightCap      = floor(461 / 1.1)    = 419
anchoPorChar   = 0.62 + 0.02         = 0.64 em
```

| Caso                                                   | chars | gaps | `widthEm`                    | `rawFontSize`             | `floor` | **resultado**       |
| ------------------------------------------------------ | ----- | ---- | ---------------------------- | ------------------------- | ------- | ------------------- |
| `['GO']` — una palabra corta                           | 2     | 0    | `2·0.64 = 1.28`              | `min(503.125, 419) = 419` | 419     | **211** (techo)     |
| `['HOY','MISMO']` — dos palabras medianas              | 8     | 1    | `8·0.64 + 0.30 = 5.42`       | `min(118.8192, 419)`      | 118     | **118** (interior)  |
| `['EXTRAORDINARIO','RENDIMIENTO','SOSTENIDO']`         | 34    | 2    | `34·0.64 + 2·0.30 = 22.36`   | `min(28.8014, 419)`       | 28      | **86** (piso, CE-4) |
| `[]` — guarda del paso 5                               | 0     | 0    | `0`                          | —                         | —       | **211**             |
| `['GO']` con `box.height: 100` — tope por alto         | 2     | 0    | `1.28`                       | `min(503.125, 90) = 90`   | 90      | **90**              |

**CA-005 queda verificado línea por línea:** tres palabras largas (86) es estrictamente menor que una
palabra corta (211); ningún resultado sale de `[86, 211]`; y el caso intermedio (118) demuestra que
el ajuste es real y no un simple "siempre en un extremo del clamp". El caso `heightCap` (90) muestra
que el tope por alto liga cuando la caja se achica.

---

## 8. `captionWordStyle` — estilos por palabra y precedencia

`src/helpers/caption-word-style.ts`

```ts
export interface CaptionWordState {
  isEmphasis: boolean;
  isActive: boolean;
}

export function captionWordStyle(preset: CaptionPreset, state: CaptionWordState): CSSProperties;
```

`CSSProperties` viene de `import type { CSSProperties } from 'react'` — igual que en
`punch-in-style.ts` y `whip-pan-style.ts`, y sin importar nada de `remotion`.

### 8.1 Tabla de precedencia (D-08) — la respuesta a "qué pasa cuando ambos son `true`"

| Propiedad CSS      | `normal`             | `emphasis`                    | `active`             | **`emphasis + active`**                                    |
| ------------------ | -------------------- | ----------------------------- | -------------------- | ----------------------------------------------------------- |
| `fontWeight`       | `preset.fontWeight`  | `preset.emphasisFontWeight`   | `preset.fontWeight`  | **`preset.emphasisFontWeight`** (gana emphasis)              |
| `color`            | `preset.color`       | `preset.emphasisColor`        | `preset.activeColor` | **`preset.emphasisColor`** (gana emphasis)                   |
| `backgroundColor`  | `pill.color`         | `pill.emphasisColor`          | `pill.color`         | **`pill.emphasisColor`** (gana emphasis)                     |
| `transform`        | `scale(1)`           | `scale(emphasisScale)`        | `scale(activeScale)` | **`scale(round3(emphasisScale · activeScale))`** (compone)   |

**Regla en una línea:** *`isEmphasis` tiene precedencia absoluta sobre `isActive` en los canales
discretos (peso, color, píldora); la escala es el único canal que compone, multiplicando.*

Por qué: RN-14 exige que la palabra de impacto **conserve** su distinción durante todo el clip. Si
`isActive` pisara el color, la palabra de impacto perdería su identidad exactamente en el frame en
que se pronuncia — el momento de mayor atención. Y como la escala compone, `emphasis + active` es
estrictamente mayor que cada estado por separado, de modo que los **cuatro** estados siguen siendo
distinguibles entre sí (RN-13).

`round3(v) = Math.round(v * 1000) / 1000` — sin ese redondeo `1.12 * 1.08` produce
`1.2096000000000001` y el `transform` sería un string distinto en cada refactor. Valores compuestos
del registro: `bold-impact` `1.21`, `clean-sans` `1.145`, `outline-pop` `1.254`,
`subtle-lower` `1.082`.

### 8.2 Objeto devuelto

Siempre presentes:

```ts
{
  fontFamily: preset.fontFamily,
  fontWeight: <según la tabla>,
  color: <según la tabla>,
  textTransform: preset.textTransform,
  letterSpacing: `${preset.letterSpacingEm}em`,
  lineHeight: preset.lineHeightEm,
  display: 'inline-block',
  whiteSpace: 'nowrap',
  transform: `scale(${scale})`,
  transformOrigin: '50% 50%',
}
```

- `display: 'inline-block'` es **obligatorio**: `transform` no se aplica a cajas `inline`.
- `whiteSpace: 'nowrap'` impide que una palabra se parta, que es la premisa de `fitCaptionFontSize`.
- **No hay `fontSize`** (D-12): lo pone el contenedor del clip con el resultado de
  `fitCaptionFontSize`, una sola vez para todas las palabras.

Condicionales — **se agregan con spread, nunca asignando `undefined`**:

```ts
...(preset.stroke === null ? {} : {
  WebkitTextStroke: `${preset.stroke.widthEm}em ${preset.stroke.color}`,
  paintOrder: 'stroke fill',
}),
...(preset.shadow === null ? {} : { textShadow: preset.shadow }),
...(preset.pill === null ? {} : {
  backgroundColor: <según la tabla>,
  padding: `${preset.pill.paddingYEm}em ${preset.pill.paddingXEm}em`,
  borderRadius: `${preset.pill.radiusEm}em`,
}),
```

> **Trampa real de esta lib.** Con `exactOptionalPropertyTypes: true` (`tsconfig.lib.json`),
> `{ textShadow: undefined }` **no** es asignable a `CSSProperties`. Y como `vitest` no typechequea,
> el error aparece recién en `nx build composition-remotion`. El spread condicional no es estilo: es
> la única forma que compila.

`paintOrder: 'stroke fill'` acompaña siempre al `stroke`: sin él el contorno se dibuja encima del
relleno y se come el glifo con los 0.045 em de `outline-pop`.

### 8.3 Tests (RN-13, RN-14, CA-004)

Para cada preset de `CAPTION_PRESET_IDS`, sobre los cuatro estados:

1. Los cuatro objetos devueltos son **distintos de a pares** (comparación estructural).
2. `emphasis+active`.`color` es igual a `emphasis`.`color` y distinto de `active`.`color` (RN-14).
3. `emphasis+active`.`transform` codifica una escala **estrictamente mayor** que la de `emphasis` y
   que la de `active`.
4. `normal` contra `active`: difieren aunque `activeColor === color`, porque `activeScale > 1`.
5. `subtle-lower` (el único con píldora) devuelve `backgroundColor` / `padding` / `borderRadius`; los
   otros tres **no tienen esas claves** (`'backgroundColor' in style === false`, no
   `=== undefined`). Ídem `textShadow` en `subtle-lower` y `WebkitTextStroke` en `clean-sans`.

---

## 9. `captionFontFaceCss` — fuente propia sin binarios en el repo

`src/helpers/caption-font-face.ts`

```ts
export type CaptionFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype';
export type CaptionFontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

export interface CaptionFontFace {
  family: string;
  src: string;
  weight: number | string;
  style: 'normal' | 'italic';
  format: CaptionFontFormat;
  display: CaptionFontDisplay;
}

export function captionFontFaceCss(faces: readonly CaptionFontFace[]): string;
```

Contrato:

- **`src` llega ya resuelto** (D-09). El llamador lo obtiene con
  `staticFile('fonts/MiFuente-Bold.woff2')`; el helper no importa `remotion`, no lee `public/`, no
  toca el filesystem. Es una función de datos a string.
- Emite **un bloque `@font-face` por entrada**, en el orden recibido, unidos por `'\n'`. Lista vacía
  → `''`.
- Formato de salida, **una línea por bloque**, para que el test sea una igualdad literal sin
  normalizar espacios:

```
@font-face{font-family:"Inter Tight";src:url("/fonts/InterTight-Bold.woff2") format("woff2");font-weight:800;font-style:normal;font-display:block}
```

- **Escapado obligatorio** de `family` y `src`: `\` → `\\` y `"` → `\"`, con el valor emitido entre
  comillas dobles. Sin eso, un nombre de archivo con comillas cortaría el bloque y podría inyectar
  CSS arbitrario en el documento del render.
- Los seis campos de `CaptionFontFace` son **requeridos**, no opcionales: el llamador declara
  `weight`, `style`, `format` y `display` de forma explícita. Motivo doble: evita ramas de default
  dentro del helper (cobertura de ramas de RNF-2) y evita el conflicto con
  `exactOptionalPropertyTypes` (§8.2).
- El README recomienda `display: 'block'`: el archivo es local y no hay red, y un FOUT cambiaría el
  ancho del texto a mitad de render, invalidando el ajuste de `fitCaptionFontSize`.

**Procedimiento documentado en el README (RN-15, RN-16, RNF-5):**

1. Copiar el `.woff2` a `libs/composition-remotion/public/fonts/` — directorio creado por D-10 con
   `.gitignore` `*` + `!.gitignore`, así que **el binario nunca entra al repo**.
2. `captionFontFaceCss([{ family: 'Mi Fuente', src: staticFile('fonts/MiFuente-Bold.woff2'), ... }])`
   e inyectar el string en un `<style>` de la composición (lo hace `cycle-02`).
3. Anteponer `'Mi Fuente'` al `fontFamily` del preset elegido (`cycle-02` acepta el preset por props).
4. **Si no se hace nada**, los cuatro presets siguen funcionando con el stack del sistema, que termina
   en `sans-serif` o `serif` (RN-17, CA-12 del funcional).

---

## 10. Superficie pública: qué entra al barrel y qué no

`src/index.ts` **solo agrega**; ninguna exportación existente se toca (D-11).

### 10.1 Se exporta

```ts
export {
  CAPTION_PRESETS,
  CAPTION_PRESET_IDS,
  DEFAULT_CAPTION_PRESET_ID,
  captionPreset,
} from './helpers/caption-preset';
export type {
  CaptionPill,
  CaptionPreset,
  CaptionPresetId,
  CaptionStroke,
  CaptionTextTransform,
} from './helpers/caption-preset';

export { CAPTION_PLATFORMS, captionChromeInsets, captionSafeZone } from './helpers/caption-safe-zone';
export type {
  CaptionChromeInsets,
  CaptionChromeReference,
  CaptionPlatform,
} from './helpers/caption-safe-zone';

export { captionBoxFor } from './helpers/caption-box';
export type { CaptionAnchor } from './helpers/caption-box';

export { fitCaptionFontSize } from './helpers/caption-font-size';

export { captionWordStyle } from './helpers/caption-word-style';
export type { CaptionWordState } from './helpers/caption-word-style';

export { captionFontFaceCss } from './helpers/caption-font-face';
export type {
  CaptionFontDisplay,
  CaptionFontFace,
  CaptionFontFormat,
} from './helpers/caption-font-face';
```

### 10.2 **No** se exporta

| Símbolo                                            | Por qué queda adentro                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `CAPTION_CHROME_INSETS` (el `Record`)               | La única puerta a la tabla es `captionChromeInsets()` (§4)               |
| `NO_CHROME_INSETS`, referencias de lienzo internas  | Constantes internas del catálogo                                         |
| El escapador de strings CSS de `caption-font-face`  | Detalle de implementación                                                |
| Cualquier cosa de `src/captions/`                   | **Ese directorio no existe** (D-01)                                      |
| `captionLayout`                                     | Ya estaba exportado y sigue igual — no es una exportación nueva (D-11)   |

### 10.3 Cumplimiento del `eslint.config.mjs` de la lib (RNF-3)

| Regla del linter                                                       | Cómo se cumple                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `no-restricted-globals`: `Date`, `process`                              | Ningún helper del ciclo los referencia. Todo sale de los argumentos                                             |
| `no-restricted-properties`: `Math.random`                               | Se usan `Math.round`, `Math.floor`, `Math.min` y `Math.max` — ninguno restringido                               |
| `no-restricted-imports`: `node:*`, `fs`, `path`, `child_process`, `os`  | Los seis archivos importan **solo** `react` (type-only), `@video-maker/timeline-core` y módulos hermanos de `./` |
| `@typescript-eslint/no-explicit-any`                                    | Cero `any`. `CSSProperties` y los tipos derivados de `timeline-types.ts` cubren todo                             |
| Regla del repo: cero comentarios                                        | La documentación es **este** documento; el código usa nombres declarativos                                       |

Además, ningún archivo del ciclo importa `remotion` — los helpers quedan cargables en un `Player` de
browser y en Node sin arrastrar nada (D-09).

---

## 11. Reglas de implementación (no negociables)

1. **Cero comentarios** en el código. Si una línea pide explicación, el arreglo es extraer una
   función con ese nombre, no escribir el comentario.
2. **Cero `any`** y cero `as` salvo el cast deliberado dentro de los `*.spec.ts` que ejercitan las
   ramas de fallback (`'vimeo' as CaptionPlatform`, `'neon' as CaptionPresetId`).
3. **Identificadores, strings de CSS y nombres de archivo en inglés.** El documento está en
   castellano; el código no.
4. **`libs/timeline-core` no se toca** (D-A, RNF-4). Los tipos que su barrel no exporta se derivan por
   indexed access en `src/helpers/timeline-types.ts`, como ya hace `cycle-03`.
5. **`vite.config.ts`, `eslint.config.mjs` y `project.json` no se tocan** (D-01).
6. **Ningún test monta un componente, renderiza un frame, descarga Chrome ni sale a la red** (RNF-1).
   Los seis specs son de funciones puras: importan el helper y comparan valores.
7. **Ningún archivo de fuente entra al repo** (RNF-5, D-10). Lo único que se agrega bajo
   `public/fonts/` es el `.gitignore`.
8. **Cada helper tiene su `*.spec.ts` propio, en el mismo directorio**, con el nombre del archivo que
   prueba. Un helper sin spec baja la cobertura y frena el gate de RNF-2.
9. **Cierre del ciclo:** `pnpm sdd:validate` en verde,
   `pnpm exec nx run-many -t lint test build` en verde sobre los cinco proyectos, y cobertura de
   `composition-remotion` **>= 90 % statements y >= 85 % branches** sobre `src/helpers/**` +
   `src/transitions/**` (RNF-2, piso heredado 94 % / 87.87 %).

> **`NX_WORKSPACE_ROOT_PATH`**: si está definida y apunta a otro repo, `nx` y los scripts `sdd:*`
> corren contra ese otro repo **sin ningún error visible**. Verificarlo antes de correr los gates.

---

## 12. Dependencias externas

**Ninguna.** El ciclo no agrega ni una línea al `package.json` raíz ni al de la lib. Todo lo que
necesita ya está:

| Ya presente                              | Uso en este ciclo                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `react` `^19` / `@types/react` `^19`     | `import type { CSSProperties } from 'react'`                                  |
| `@video-maker/timeline-core`             | `OutputFormat`, `SafeZone`, `safeZoneFor`, `defaultFormat` (tipos y valores)  |
| `vitest` `^4` + `@vitest/coverage-v8`    | Los seis specs                                                                |
| `typescript` `~6.0`                      | `nx build` (`tsc -p tsconfig.lib.json`)                                       |

No se agrega `@remotion/google-fonts` (D-C de la spec: descarga en build → rompe el cero-red de la
suite y del CI) y no se agrega ninguna dependencia de medición de texto (`opentype.js`, `canvas`):
serían binarios o red, y `fitCaptionFontSize` existe justamente para no necesitarlas.

---

## 13. Riesgos

| Id  | Riesgo                                                                                                                                                                                                | Mitigación en este ciclo                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | **La estimación por ancho medio no es el ancho real del glifo.** Una frase en mayúsculas cargada de `M`/`W` puede desbordar la caja; una de `I`/`L` la desperdicia. Un emoji cuenta 1 y ocupa ≈ 1.5 em. | `averageCharWidthEm` se calibra **por arriba** de la media real de cada familia, `sidePaddingRatio` (4–6 % por lado) deja colchón y el paso 7 usa `Math.floor`. El error residual se verifica visualmente en `cycle-02` con la galería de presets en `remotion studio`.          |
| R-2 | **La familia preferida del stack puede no estar instalada** (macOS del creador contra Chrome Headless Shell): el fallback tiene métricas distintas y el ancho estimado deja de corresponder al dibujado.| `averageCharWidthEm` se calibra sobre el **fallback genérico**, no sobre la familia preferida — el peor caso es sobreestimar y quedarse corto de tamaño, nunca desbordar. `captionFontFaceCss` + `public/fonts/` dan el camino para fijar la fuente y eliminar la varianza.       |
| R-3 | **Los insets de chrome son una foto de la UI de cada app a 2026-09-07.** Instagram, TikTok y YouTube rediseñan su chrome; un rediseño invalida la tabla en silencio, sin romper ningún test.           | La tabla vive en **una sola constante** con su `reference` explícita: actualizarla es editar cuatro números. §4.2 deja escrito **qué elemento de UI cubre cada inset**, para que la próxima revisión no tenga que adivinar el criterio. Follow-up de `cycle-02`: contrastar contra un screenshot real. |
| R-4 | **Si un preset futuro declara un `boxHeightRatio` alto, los tres anclajes colapsan** en la misma caja y CA-003 dejaría de distinguirlos, sin que el helper falle.                                      | El test de invariante recorre `CAPTION_PRESET_IDS × CAPTION_PLATFORMS` (16 combinaciones) y exige `slack > 0` y tres `y` distintos. Con el registro actual el `slack` mínimo es 539 px. Un preset nuevo que rompa la invariante rompe el test.                                   |
| R-5 | **Un `safeZone` con lados negativos** (solo construible a mano: `SafeZoneSchema` es `z.number().int()` sin `nonnegative`) produciría una caja fuera de `CaptionClipBoxSchema`.                          | Precondición documentada (D-06): `captionBoxFor` asume lados no negativos, que es lo que producen `safeZoneFor` y `captionSafeZone`. **No se agrega rama defensiva** — sería rama muerta y castigaría la cobertura de ramas de RNF-2. Si `spec-006` expone el safe zone a la UI, ahí se valida en el borde. |
| R-6 | **RNF-2 mide contra un piso, no contra un umbral.** El `vite.config.ts` sigue en 80 %: la suite puede pasar en verde y aun así **bajar** de 94 % / 87.87 % sin que nada falle automáticamente.         | Regla 8 de §11 (un spec por helper) y el checklist del reviewer, que lee el número reportado por `nx test composition-remotion` y lo compara con el piso. El `include` de cobertura queda idéntico al de `cycle-03` (D-01) para que la comparación sea válida.                   |
| R-7 | **`exactOptionalPropertyTypes` + `CSSProperties`**: asignar `undefined` a una propiedad opcional compila bajo `vitest` (que no typechequea) y revienta recién en `nx build`.                            | Spread condicional obligatorio en `captionWordStyle` (§8.2) y campos **requeridos** en `CaptionFontFace` (§9). Los tests verifican **ausencia de clave** (`'backgroundColor' in style === false`), no `=== undefined`, que es lo que detecta la regresión.                        |
| R-8 | **Choque de `transform` con `cycle-02`**: si el estilo por palabra emitiera más de una función de transform, `captionClipAnimation` (RF-6) no podría componer sin reescribir el string.                | D-12: `captionWordStyle` devuelve **solo** `scale(...)` y la animación de entrada/salida se aplica al contenedor del bloque, nunca a la palabra. Queda escrito acá para que `cycle-02` no lo redescubra.                                                                        |
| R-9 | **La `Timeline` puede traer `CaptionClip.box` propio** y `cycle-02` tendría dos fuentes para la caja (`clip.box` contra `captionBoxFor`).                                                              | Fuera de alcance de `cycle-01`: los helpers no leen `clip.box`. La regla de precedencia (`clip.box ?? captionBoxFor(...)`, igual que hoy hace `CaptionTrack`) la fija `cycle-02` al escribir `<KineticCaptions />`.                                                             |

---

## 14. Qué queda deliberadamente para `cycle-02`

| Diferido                                                                                            | Por qué no acá                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `<KineticCaptions />` y el reemplazo de `CaptionTrack` en `TimelineComposition` (RF-8, CA-009, D-D)  | D-E: `cycle-01` concentra la lógica en helpers medidos por cobertura; el componente es cableado fino   |
| `captionClipAnimation` (RF-6, CA-006) y `activeWordIndex` (RF-7, CA-007)                            | Dependen de `frame` / `fps`; el diseño ya les deja lugar (D-12, R-8)                                   |
| Baja de `captionLayout` y de `CaptionTrack` del barrel                                              | D-11: `CaptionTrack` sigue vivo hasta que exista su reemplazo                                          |
| Galería de presets en `Root.tsx` y `remotion studio` (RF-9, CA-010)                                 | Verificación visual; `studio` y `smoke` siguen fuera de `lint test build`                              |
| Resolución de `clip.box` contra `captionBoxFor`                                                     | R-9                                                                                                    |
| Inyección real del `<style>` con `captionFontFaceCss` y `staticFile()`                              | D-09: el helper es puro; quien resuelve la ruta es el componente                                       |
| `OffthreadVideo` contra `Video` en el `<Player>` y consumo desde `apps/web`                         | `spec-006`, no esta spec                                                                               |

---

## 15. Cambios en schema y contratos de API

**NO APLICA** — ver §0.

- `sdd/schema.json`: **sin cambios**. El ciclo no crea ni modifica tablas.
- `sdd/api.json`: **sin cambios**. El ciclo no expone ni consume endpoints REST.

El contrato `Timeline` de `@video-maker/timeline-core` (`TimelineSchema`, `CaptionClipSchema`,
`OutputFormatSchema`, `SafeZoneSchema`) se consume **sin modificar** (D-A, RNF-4). Todo lo
tipográfico entra como parámetros de helper con defaults, nunca como campos nuevos de la `Timeline`.
