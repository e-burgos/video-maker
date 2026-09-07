# Sprint Plan — Ciclo 1 — Kinetic Captions & Safe Zones (`libs/composition-remotion`)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/functional.md
> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/architect.md
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

**Duración estimada:** ~3-4 días (19 h)
**Story points totales:** 19 (7 tasks: 5 × 3 SP + 2 × 2 SP)

## Nota sobre el agente asignado

Las seis unidades de este ciclo (`caption-preset.ts`, `caption-safe-zone.ts`, `caption-box.ts`,
`caption-font-size.ts`, `caption-word-style.ts`, `caption-font-face.ts`) son **helpers TypeScript
puros sin JSX**: ninguna monta un componente de Remotion ni React, `caption-word-style.ts` devuelve
un objeto tipado como `CSSProperties` pero no renderiza nada. Por la regla del brief ("apuntá a
`implementor-front` salvo que sea puramente de tipos/helpers Node sin JSX, en cuyo caso podés usar
`implementor-back`"), **las siete tasks de este ciclo — incluida la de cierre — se asignan a
`implementor-back`**, de forma consistente. `implementor-front` no interviene en este ciclo: el
componente visual que sí requeriría JSX (`<KineticCaptions />`) es de `cycle-02`.

## Orden de ejecución — un único implementador, task por vez

```
TASK-001 (caption-preset) ─┬─→ TASK-003 (caption-box) ─┐
TASK-002 (caption-safe-zone) ┘                          │
TASK-001 ───────────────────→ TASK-004 (caption-font-size)
TASK-001 ───────────────────→ TASK-005 (caption-word-style)
TASK-006 (caption-font-face) ── independiente ──────────┤
                                                          ▼
                              TASK-007 (barrel + README + verificación)
```

Camino crítico: `TASK-001 → TASK-003 → TASK-007` (o el equivalente por TASK-002, misma longitud:
3h + 3h + 2h = 8h). `TASK-004`, `TASK-005` y `TASK-006` tienen holgura: no bloquean a nadie más que
a `TASK-007`.

**Por qué esta secuencia y no la lectura literal del orden de archivos del architect (§2):**

- `caption-preset.ts` va **primero** porque es el vocabulario que consumen `caption-box.spec.ts`
  (necesita `CAPTION_PRESET_IDS`/`CAPTION_PRESETS` reales para su invariante 4 presets × 4
  plataformas), `caption-font-size.spec.ts` (usa `CAPTION_PRESETS['bold-impact']`) y
  `caption-word-style.spec.ts` (itera `CAPTION_PRESET_IDS`). Ningún otro helper puede probarse de
  verdad sin que el registro ya exista con sus valores concretos.
- `caption-safe-zone.ts` no depende de nada nuevo de este ciclo (solo de `timeline-core`, ya
  existente) — es la otra unidad que puede arrancar en paralelo con `caption-preset.ts` si hubiera
  dos implementadores; con uno solo, va segunda porque `caption-box.spec.ts` también necesita
  `CAPTION_PLATFORMS`/`captionSafeZone` para generar los safe zones de su invariante.
- **Nota de compilación (`CaptionAnchor`):** el architect fija que `CaptionAnchor` vive en
  `caption-box.ts` y que `caption-preset.ts` lo importa **por tipo** (`import type`). Es una
  referencia cruzada real entre ambos archivos, pero **no rompe nada intermedio**: al ser
  `import type`, Vite/Vitest la elide del bundle sin intentar resolver el módulo (los tests de
  `TASK-001` corren en verde aunque `caption-box.ts` todavía no exista), y `tsc` (`nx build`) solo
  necesita que **ambos archivos existan simultáneamente** para resolver el ciclo de tipos — lo cual
  ya es cierto cuando se cierra `TASK-003`. Por eso el build completo se verifica recién en
  `TASK-007`, nunca task por task.
- `caption-font-size.ts` y `caption-word-style.ts` solo necesitan `caption-preset.ts` (tipo
  `CaptionPreset` y registro): `CaptionBox` ya está derivado en `timeline-types.ts` desde
  `cycle-03`, así que ninguna de las dos depende de `caption-box.ts`. Van después de `TASK-003` en
  la lista solo por agrupar "capa de posicionamiento" antes de "capa de tamaño/estilo", no porque
  haya un bloqueo real.
- `caption-font-face.ts` (+ `public/fonts/.gitignore`) es completamente independiente de los otros
  cinco helpers (D-09: no importa nada de `remotion` ni de los demás archivos del ciclo) — podría
  ejecutarse en cualquier momento; se deja penúltima solo para mantener el orden de lectura del
  architect §2.
- `TASK-007` cierra el ciclo: agrega al barrel **solo lo que agregan** las seis tasks anteriores,
  documenta el procedimiento de fuente local en el README y corre la verificación completa. No
  puede empezar antes de que las seis existan.

---

## Tasks Backend

### TASK-001: Registro de presets de captions (`CaptionPreset`, `CAPTION_PRESETS`)

**Historia:** HU-1-01, HU-1-05, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-preset.ts`
- `libs/composition-remotion/src/helpers/caption-preset.spec.ts`

**Descripción:** Implementar exactamente lo fijado en architect.md §3: los tipos
`CaptionPresetId`, `CaptionTextTransform`, `CaptionStroke`, `CaptionPill`, `CaptionPreset`
(importando `CaptionAnchor` **por tipo** desde `./caption-box`, aunque ese archivo lo escribe
`TASK-003` — ver nota de compilación arriba); el registro `CAPTION_PRESETS` con los cuatro presets
completos y sus 22 campos cada uno (`bold-impact`, `clean-sans`, `outline-pop`, `subtle-lower`,
valores exactos de §3.3); `CAPTION_PRESET_IDS`, `DEFAULT_CAPTION_PRESET_ID` y `captionPreset(id)`
con el fallback `??` al default. Ningún campo del preset en píxeles (D-02): todo en `em` o en
fracción de `format.height`/`box.width`. Cero `any`, cero imports de `remotion`.

**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna

**Criterio de done:**

- [ ] `CAPTION_PRESET_IDS.length >= 4` y coincide exactamente con las claves de `CAPTION_PRESETS`
- [ ] Cada preset: `fontFamily` termina en `sans-serif` o `serif` (RN-2, CA-004)
- [ ] Cada preset: `emphasisFontWeight !== fontWeight` y `emphasisColor !== color` (RN-3, CA-004)
- [ ] Cada preset: `activeScale > 1` y `emphasisScale > 1` (distinción normal/activa aunque
      `activeColor === color`)
- [ ] Cada preset: `maxFontSizeRatio > minFontSizeRatio`, ambos en `(0, 1)`; `0 <= sidePaddingRatio
      < 0.5`; `0 < boxHeightRatio <= 1`
- [ ] `captionPreset('neon' as CaptionPresetId)` devuelve el preset `DEFAULT_CAPTION_PRESET_ID` (CE-1
      del funcional, rama de fallback cubierta explícitamente)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-002: Safe zone aditiva por plataforma (`captionSafeZone`, insets de chrome)

**Historia:** HU-1-02, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-safe-zone.ts`
- `libs/composition-remotion/src/helpers/caption-safe-zone.spec.ts`

**Descripción:** Implementar architect.md §4-5: tipo `CaptionPlatform`, constante
`CAPTION_PLATFORMS`, tipos `CaptionChromeReference`/`CaptionChromeInsets`, la tabla privada
`CAPTION_CHROME_INSETS` (los cinco valores de §4.1, con su `reference` por plataforma) accesible
solo vía `captionChromeInsets(platform?)`, y `captionSafeZone(format, platform?, baseSafeZone?)` con
el escalado `scaleX`/`scaleY` sobre el lienzo de referencia y `Math.round` por lado (§5). Sin
`platform` debe devolver la identidad estructural sobre `baseSafeZone ?? safeZoneFor(format)`; con
plataforma no reconocida (`'vimeo' as CaptionPlatform`) debe comportarse como ausencia de plataforma
(CE-2). Nunca resta: todo inset del catálogo es `>= 0`.

**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna

**Criterio de done:**

- [ ] `captionSafeZone(defaultFormat('reels-9x16'))` (sin plataforma) es estructuralmente igual a
      `safeZoneFor(defaultFormat('reels-9x16'))` (RN-5, CA-4 del funcional)
- [ ] Para `tiktok`, el lado derecho resultante reserva al menos 150 px adicionales sobre el safe
      zone base (RN-6, CA-3 del funcional, verificado con los valores de §4.3:
      `captionSafeZone(defaultFormat('tiktok-9x16'), 'tiktok').right === 320` contra
      `safeZoneFor(...).right === 140`)
- [ ] Para las cuatro plataformas soportadas, los cuatro lados del resultado son `>=` los del safe
      zone base (RN-4, CA-001 de la spec)
- [ ] `captionChromeInsets('vimeo' as CaptionPlatform)` devuelve los cuatro insets en 0, igual que
      sin plataforma (CE-2)
- [ ] Los cuatro lados del resultado son siempre enteros (`Math.round` sobre el inset escalado)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-003: Caja de captions con anclaje (`captionBoxFor`)

**Historia:** HU-1-03, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-box.ts`
- `libs/composition-remotion/src/helpers/caption-box.spec.ts`

**Descripción:** Implementar architect.md §6: tipo `CaptionAnchor` (`'top' | 'center' | 'bottom'`,
única fuente de este tipo en el ciclo — `caption-preset.ts` lo importa por tipo) y
`captionBoxFor(safeZone, format, preset, anchor?)` con el clamp de D-06 (`height = min(round(format
.height * preset.boxHeightRatio), availableHeight)`, `Math.max(0, ...)` en ancho/alto, `y` según
`resolvedAnchor`). El test de invariante recorre `CAPTION_PRESET_IDS × CAPTION_PLATFORMS` (16
combinaciones, usando `captionPreset()` de `TASK-001` y `captionSafeZone()`/`CAPTION_PLATFORMS` de
`TASK-002`) y exige `slack > 0` con los tres `y` distintos, más las cuatro invariantes de contención
de §6.1.

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002

**Criterio de done:**

- [ ] Para los cuatro presets sobre la caja de TikTok (§6.2), `height`, `y` (top/center/bottom) y
      `x + width`/`y + height` coinciden con la tabla del architect
- [ ] Las tres opciones de anclaje devuelven tres cajas con `y` distinto en las 16 combinaciones
      preset × plataforma, con `slack` mínimo de 539 px (RN-7, CA-5 del funcional)
- [ ] En las 16 combinaciones: `x >= 0`, `y >= 0`, `x + width <= format.width`,
      `y + height <= format.height` (RN-9, CA-6 del funcional; CA-002 y CA-003 de la spec)
- [ ] La caja queda contenida dentro del safe zone recibido en las 16 combinaciones (RN-8)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-004: Ajuste determinista de tamaño de fuente (`fitCaptionFontSize`)

**Historia:** HU-1-04, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-font-size.ts`
- `libs/composition-remotion/src/helpers/caption-font-size.spec.ts`

**Descripción:** Implementar los siete pasos de architect.md §7 exactamente (conteo de puntos de
código con `[...text].length`, huecos como `words.length - 1`, `letterSpacingEm` sumado por
carácter, guarda de `widthEm <= 0` devolviendo `maxFontSize`, `heightCap` con `Math.floor`,
`Math.floor` final y clamp `max` antes de `min`). `CaptionWord`/`CaptionBox` se derivan de
`src/helpers/timeline-types.ts` (ya existente desde `cycle-03`), no de `caption-box.ts`. Usar la
tabla numérica de §7.4 como casos de test literales (`box`/`preset` fijos, sin pasar por
`captionBoxFor`).

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001

**Criterio de done:**

- [ ] Los cinco casos de §7.4 devuelven exactamente 211, 118, 86, 211 (guarda) y 90 (tope por alto)
      respectivamente, con `format = defaultFormat('tiktok-9x16')`, `box = { x: 60, y: 610, width:
      700, height: 461 }` y `preset = CAPTION_PRESETS['bold-impact']`
- [ ] Una frase de tres palabras largas da un tamaño estrictamente menor que una de una palabra
      corta (RN-10, CA-7 del funcional; CA-005 de la spec)
- [ ] El resultado nunca sale de `[minFontSize, maxFontSize]` derivados del preset (RN-11, CA-8 del
      funcional)
- [ ] Dos llamadas idénticas devuelven el mismo valor (RN-12) — sin `Date`, sin `Math.random`, sin
      estado de módulo
- [ ] `words: []` no produce `NaN` (guarda del paso 5, CE-4)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-005: Estilo por palabra normal/impacto/activa (`captionWordStyle`)

**Historia:** HU-1-05, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-word-style.ts`
- `libs/composition-remotion/src/helpers/caption-word-style.spec.ts`

**Descripción:** Implementar architect.md §8: `CaptionWordState` y
`captionWordStyle(preset, state): CSSProperties` (`import type { CSSProperties } from 'react'`, cero
imports de `remotion`) con la tabla de precedencia de §8.1 (`isEmphasis` gana en `fontWeight`,
`color` y `backgroundColor`; `transform` compone multiplicando con `round3`) y el objeto devuelto de
§8.2. **Los campos condicionales (`WebkitTextStroke`, `textShadow`, `pill.*`) se agregan con spread,
nunca asignando `undefined`** — es la única forma que compila bajo `exactOptionalPropertyTypes:
true` (R-7, trampa real de la lib: `vitest` no la detecta, solo `nx build`).

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001

**Criterio de done:**

- [ ] Para cada uno de los cuatro presets, los cuatro estados (`normal`, `emphasis`, `active`,
      `emphasis+active`) son distintos de a pares (RN-13, CA-9 del funcional; CA-004 de la spec)
- [ ] `emphasis+active`.`color` === `emphasis`.`color` (nunca lo pisa `active`) — RN-14
- [ ] La escala de `emphasis+active` es estrictamente mayor que la de `emphasis` sola y que la de
      `active` sola (composición multiplicativa con `round3`)
- [ ] `subtle-lower` expone `backgroundColor`/`padding`/`borderRadius`; los otros tres **no tienen
      esas claves** (`'backgroundColor' in style === false`, nunca `=== undefined`) — verifica que
      el spread condicional evita la trampa de `exactOptionalPropertyTypes` (R-7)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-006: CSS de fuente local (`captionFontFaceCss`) + `public/fonts/.gitignore`

**Historia:** HU-1-07, HU-1-06
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-font-face.ts`
- `libs/composition-remotion/src/helpers/caption-font-face.spec.ts`
- `libs/composition-remotion/public/fonts/.gitignore` (contenido exacto: `*` + `!.gitignore`, D-10,
  igual que `public/example/.gitignore`)

**Descripción:** Implementar architect.md §9: tipos `CaptionFontFormat`, `CaptionFontDisplay`,
`CaptionFontFace` (los seis campos requeridos, sin opcionales) y
`captionFontFaceCss(faces): string` — un bloque `@font-face` por entrada en una sola línea, unidos
por `'\n'`, lista vacía → `''`. El helper recibe `src` **ya resuelto** (D-09): no importa `remotion`,
no llama `staticFile()`, no toca el filesystem. Escapado obligatorio de `family`/`src`
(`\` → `\\`, `"` → `\"`).

**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna

**Criterio de done:**

- [ ] `captionFontFaceCss([...])` con una entrada produce exactamente el bloque literal de §9 (test
      de igualdad de string, sin normalizar espacios)
- [ ] `captionFontFaceCss([])` devuelve `''`
- [ ] Un `family`/`src` con comillas dobles se escapa correctamente (RN-15/RN-16, sin inyectar CSS)
- [ ] `public/fonts/.gitignore` existe con `*` + `!.gitignore` y ningún binario de fuente se agrega
      al repo (RNF-5)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-007: Barrel público, README de fuentes locales y verificación de cierre

**Historia:** HU-1-06, HU-1-07
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a modificar:**

- `libs/composition-remotion/src/index.ts` (**solo agrega** las exportaciones de §10.1; ninguna
  exportación existente se toca — D-11)
- `libs/composition-remotion/README.md` (sección "Fuente propia en `public/fonts/`": los cuatro
  pasos de §9 — copiar el `.woff2`, llamar `captionFontFaceCss`, anteponer la familia al preset,
  comportamiento si no se declara ninguna fuente)

**Descripción:** Auditoría de cierre del ciclo. Verificar que `src/index.ts` exporte exactamente lo
listado en architect.md §10.1 (tipos y valores de los seis helpers) y **nada** de lo listado en
§10.2 (`CAPTION_CHROME_INSETS`, `NO_CHROME_INSETS`, el escapador interno de `caption-font-face.ts`,
cualquier cosa de `src/captions/` que no existe por D-01). Documentar en el README el procedimiento
de fuente local (RN-15, CA-11 del funcional). Cerrar con la verificación completa: `pnpm sdd:validate`
en verde, `pnpm exec nx run-many -t lint test build` en verde sobre los cinco proyectos afectados, y
`pnpm nx test composition-remotion --coverage` reportando **>= 90 % statements y >= 85 % branches**
sobre `src/helpers/**` + `src/transitions/**` (RNF-2, piso heredado de `cycle-03`: 94 % / 87.87 % —
no bajar de ahí). **Este es el único punto del ciclo donde se corre `nx build`**: es donde aparecería
el error de R-7 (`exactOptionalPropertyTypes` + `CSSProperties`) si `TASK-005` hubiera asignado algún
campo opcional como `undefined` en vez de con spread condicional.

**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006

**Criterio de done:**

- [ ] `src/index.ts` exporta exactamente §10.1 (diff mínimo, aditivo) y ninguna exportación previa
      (`CaptionTrack`, `captionLayout`, etc.) cambia (D-11)
- [ ] README documenta el procedimiento de fuente local en 4 pasos (RN-15, CA-11 del funcional) y
      que sin fuente declarada los cuatro presets siguen funcionando con el stack del sistema
      (RN-17, CA-12 del funcional)
- [ ] `pnpm sdd:validate` en verde
- [ ] `pnpm exec nx run-many -t lint test build` en verde (`libs/composition-remotion` y sus
      dependientes de Nx)
- [ ] `nx build composition-remotion` en verde específicamente — confirma que no hay ningún
      `{ campo: undefined }` colado bajo `exactOptionalPropertyTypes` (R-7)
- [ ] Cobertura de `composition-remotion` >= 90 % stmts / >= 85 % branches sobre `src/helpers/**` +
      `src/transitions/**` (RNF-2); si el número reportado es menor al piso heredado (94 % / 87.87 %),
      dejarlo anotado como hallazgo para el reviewer, no bloquea el gate mínimo de 90/85
- [ ] Ningún test de la suite monta un componente, renderiza un frame ni sale a la red (RNF-1,
      CA-10 del funcional)
- [ ] `vite.config.ts`, `eslint.config.mjs` y `project.json` de la lib quedan intactos (D-01)
- [ ] `libs/timeline-core/**` queda intacto (D-A, RNF-4)

---

## Resumen de tasks

| Task     | Título                                                | HU cerradas          | CA (spec / funcional)              | Dependencias                                    | h  | SP |
| -------- | ------------------------------------------------------ | --------------------- | ------------------------------------ | ------------------------------------------------ | -- | -- |
| TASK-001 | Registro de presets (`caption-preset.ts`)              | HU-1-01, HU-1-05, HU-1-06 | CA-004 / CA-1, CA-2, CA-9, CA-12 (parcial) | ninguna                                          | 3  | 3  |
| TASK-002 | Safe zone por plataforma (`caption-safe-zone.ts`)      | HU-1-02, HU-1-06      | CA-001, CA-002 / CA-3, CA-4          | ninguna                                          | 3  | 3  |
| TASK-003 | Caja con anclaje (`caption-box.ts`)                    | HU-1-03, HU-1-06      | CA-002, CA-003 / CA-5, CA-6          | TASK-001, TASK-002                               | 3  | 3  |
| TASK-004 | Tamaño de fuente (`caption-font-size.ts`)               | HU-1-04, HU-1-06      | CA-005 / CA-7, CA-8                  | TASK-001                                         | 3  | 3  |
| TASK-005 | Estilo por palabra (`caption-word-style.ts`)           | HU-1-05, HU-1-06      | CA-004 / CA-9                        | TASK-001                                         | 3  | 3  |
| TASK-006 | Fuente local (`caption-font-face.ts` + `.gitignore`)   | HU-1-07, HU-1-06      | — / CA-11, CA-12                     | ninguna                                          | 2  | 2  |
| TASK-007 | Barrel, README y verificación de cierre                | HU-1-06, HU-1-07      | — / CA-10, CA-11                     | TASK-001..TASK-006                               | 2  | 2  |
| **Total**| —                                                       | —                      | —                                     | —                                                 | **19** | **19** |

CA-001 a CA-005 de la spec quedan cubiertos íntegramente: CA-001/CA-002 en TASK-002, CA-002/CA-003
en TASK-003, CA-004 en TASK-001 y TASK-005, CA-005 en TASK-004. CA-1 a CA-12 del funcional quedan
cubiertos en las siete tasks (CA-10, el requisito transversal de cero-render/cero-red, se verifica
holísticamente en TASK-007).
