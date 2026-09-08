# Sprint Plan — Ciclo 2 — Kinetic Captions & Safe Zones (`libs/composition-remotion`)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/functional.md
> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/architect.md
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner

Este es el **último ciclo** de `spec-e-burgos-003-kinetic-captions`. Al cerrarlo no queda ningún RF
ni CA de la spec sin cubrir (RF-1..RF-5 / CA-001..CA-005 en `cycle-01`, RF-6..RF-9 / CA-006..CA-011
acá).

---

**Duración estimada:** ~4-5 días (23 h)
**Story points totales:** 26 (7 tasks: 4 × 5 SP + 2 × 3 SP + 1 × 2 SP)

## Nota sobre el agente asignado

A diferencia de `cycle-01` (siete tasks de helpers puros, todas `implementor-back`), este ciclo
mezcla dos tipos de unidad, siguiendo literal la regla del brief ("`implementor-front` para las
tasks con `.tsx` / React / Remotion y `implementor-back` para las de TS puro"):

- **`implementor-front`** — `TASK-001`, `TASK-004`, `TASK-005`, `TASK-006`. `TASK-001` entra acá
  aunque `caption-animation.ts` no tiene JSX: es el primer helper del módulo que importa `remotion`
  (`spring`, `interpolate` — D-13 del architect), y el propio `brief.yaml` lo agrupa explícitamente
  bajo el goal de `implementor_front` ("helpers de animación, el componente React/Remotion, el
  cableado en `TimelineComposition` y la galería de `Root.tsx`"). `TASK-004`, `TASK-005` y
  `TASK-006` son *.tsx* o tocan un *.tsx* existente sin ambigüedad.
- **`implementor-back`** — `TASK-002`, `TASK-003`, `TASK-007`. Ninguna importa `remotion` ni React:
  `caption-active-word.ts` y `caption-clip-plan.ts` son TS puro (mismo criterio que los seis
  helpers de `cycle-01`), y `TASK-007` es registro (`components.json`), documentación (`README.md`)
  y verificación de comandos — sin escribir una línea de JSX.

Un único implementador ejecuta las siete tasks **una por vez**, en el orden de este documento; el
cambio de "front" a "back" y viceversa entre tasks consecutivas no cambia el flujo — es solo la
etiqueta de qué agente del arnés SDD la toma.

## Orden de ejecución — un único implementador, task por vez

```
TASK-001 (caption-animation + animation en preset) ─┐
TASK-002 (caption-active-word)                       ├─→ TASK-004 (kinetic-captions.tsx) ─→ TASK-005 (timeline-composition + baja CaptionTrack/captionLayout + barrel) ─┐
TASK-003 (caption-clip-plan + fix safe-zone.spec)   ─┘                                                                                                                    │
                                                          TASK-004 ───────────────────────→ TASK-006 (caption-preset-gallery + Root.tsx) ─────────────────────────────────┤
                                                                                                                                                                            ▼
                                                                                                                              TASK-007 (components.json + README + verificación + smoke manual)
```

Camino crítico: `TASK-001 → TASK-004 → TASK-005 → TASK-007` (o el equivalente por `TASK-002`/
`TASK-003`, misma longitud: 4h + 4h + 3h + 2h = 13h). `TASK-006` tiene holgura: solo bloquea a
`TASK-007`, no a `TASK-005`.

**Por qué esta secuencia y no la lectura literal del orden de archivos del architect (§2):**

- `TASK-001`, `TASK-002` y `TASK-003` son los tres helpers nuevos y **no dependen entre sí**: cada
  uno consume exclusivamente lo que ya dejó `cycle-01` (`CaptionPreset`, `captionSafeZone`,
  `captionBoxFor`, `fitCaptionFontSize`, `timeline-types.ts`). Con un solo implementador van en
  este orden porque `caption-animation.ts` es el que más decisiones no triviales fija (D-14 a D-18,
  la tabla numérica de spring de §4) y conviene resolverlo primero; `caption-active-word.ts` es el
  más chico y autocontenido (sin ramas propias, §5.1); `caption-clip-plan.ts` cierra el trío porque
  además carga la deuda de `caption-safe-zone.spec.ts` (§8.5), que conviene hacer con
  `captionBoxFor`/`captionSafeZone` frescos en la cabeza.
- `TASK-004` (`kinetic-captions.tsx`) **no puede empezar antes** de que existan los tres helpers:
  el componente de §7.1 los importa a los tres — `captionClipAnimation` (`TASK-001`),
  `captionWordRenders` (`TASK-002`) y `captionClipPlan` + `captionBoxStyle` (`TASK-003`) — y su test
  de estructura (§10.2) recalcula `captionClipPlan(...)` para comparar contra el árbol.
- `TASK-005` (cableado en `TimelineComposition`, baja de `CaptionTrack`/`captionLayout`, barrel) va
  **después** de `TASK-004` porque monta `<KineticCaptions />` y porque el barrel (§8.3) exporta
  símbolos de los tres helpers y del componente a la vez — no tiene sentido tocar el barrel dos
  veces. Es también el punto en que `caption-track.tsx`, `caption-layout.ts` y
  `caption-layout.spec.ts` se eliminan de verdad del árbol de archivos (D-26): hasta acá quedan sin
  uso pero presentes, porque `TASK-003` solo dejó de *referenciarlos* desde el spec de safe-zone.
- `TASK-006` (galería + `Root.tsx`) solo necesita que `KineticCaptions` exista (`TASK-004`): la
  galería lo importa por ruta relativa a `src/components/kinetic-captions.tsx`, no a través del
  barrel (§9.1), y registra una composición nueva e independiente en `Root.tsx` — no toca ni
  depende de la que arma `TASK-005`. Por eso puede hacerse en paralelo con `TASK-005` si hubiera dos
  implementadores; con uno solo, se deja después por orden de lectura del architect (§9 va después
  de §8), no porque haya un bloqueo real.
- `TASK-007` cierra el ciclo: el delta de `sdd/components.json` (§8.4) referencia entradas creadas o
  tocadas por `TASK-004`, `TASK-005` y `TASK-006` (`COMP-003` deprecado, `COMP-004`/`COMP-005`
  actualizados, `COMP-007`/`COMP-008` nuevos); el README documenta la superficie pública que sale de
  `TASK-005`; y la verificación completa (`lint`/`test`/`build`/cobertura) más el smoke manual solo
  tienen sentido con las seis tasks anteriores cerradas. No puede empezar antes de que las seis
  existan.

---

## Tasks Frontend / Backend (orden de ejecución)

### TASK-001: Animación de entrada/salida del clip (`captionClipAnimation`) + campo `animation` en `CaptionPreset`

**Historia:** HU-2-01
**Agente:** `implementor-front`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-animation.ts`
- `libs/composition-remotion/src/helpers/caption-animation.spec.ts`

**Archivos a modificar:**

- `libs/composition-remotion/src/helpers/caption-preset.ts` (agrega el campo 23, **requerido**,
  `animation: CaptionAnimation`, y los cuatro valores concretos de architect.md §4)
- `libs/composition-remotion/src/helpers/caption-preset.spec.ts` (agrega las seis invariantes de
  §4.2 sobre `CAPTION_PRESET_IDS`, sin tocar ninguna aserción existente — D-14 confirma que ningún
  test de `cycle-01` compara el objeto preset completo por igualdad estructural)

**Descripción:** Implementar exactamente architect.md §1 (D-13 a D-18), §3 y §4: los tipos
`CaptionAnimationMode`, `CaptionSpring`, `CaptionAnimation` (unión discriminada por `mode`, vive en
`caption-animation.ts`, `caption-preset.ts` la importa por `import type`); `captionClipAnimation({
frame, durationInFrames, fps, preset })` con el algoritmo de 10 pasos de §3.3 (`enterFramesFor` con
`Math.min`/`Math.max`, dos llamadas a `spring()` para `enter`/`exit`, `progress = enter + exit - 1`,
`round3` privado); y `captionBlockStyle(animation, preset)` con el objeto fijo de §3.5 (`columnGap`
en vez de `marginRight` — D-27 — y sin `fontSize`). Agregar los cuatro literales de `animation` a
`CAPTION_PRESETS` con los valores numéricos exactos de §4 (`bold-impact`/`outline-pop` en `pop`,
`clean-sans` en `rise`, `subtle-lower` en `fade`). Cero `any`, cero imports de `@remotion/bundler`
ni `@remotion/renderer` (sí de `remotion`, que es lo que autoriza D-13).

**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna

**Criterio de done:**

- [ ] `captionClipAnimation` devuelve `{ opacity, scale, translateYEm, transform }` con las
      unidades y rangos de la tabla normativa de §3.2 (`opacity` siempre clampeada a `[0,1]`)
- [ ] En `frame = 0` y en `frame = durationInFrames - 1`: `opacity === 0` y `scale === enterScale`
      del preset (para los presets `pop`) — tabla de §3.4 (CA-006, CA-1/CA-2 del funcional)
- [ ] En la meseta (`enterFrames < frame < durationInFrames - 1 - enterFrames`): `opacity === 1`,
      `scale === 1`, `translateYEm === 0` (CA-1, estado final)
- [ ] Los tres modos (`pop`, `rise`, `fade`) están ejercitados: dos presets `pop`, uno `rise`, uno
      `fade` sobre `CAPTION_PRESET_IDS` (§4.1, cobertura de las cuatro ramas de §3.3 pasos 8–9)
- [ ] Determinismo: dos llamadas idénticas devuelven el mismo objeto, campo a campo (CA-3, RN-4)
- [ ] Clip corto (`durationInFrames: 1` y `2`): no tira, `opacity` sigue en `[0,1]` (R-12)
- [ ] `transform` matchea siempre `/^translateY\(-?[\d.]+em\) scale\([\d.]+\)$/`, sin excepciones
      (invariante de §7.2/§13)
- [ ] `captionBlockStyle(...)` no emite `fontSize` ni `rowGap`, y emite `columnGap:
      '<wordGapEm>em'` (D-27)
- [ ] Sobre `CAPTION_PRESET_IDS`: `animation.spring.{damping,mass,stiffness} > 0`,
      `1 <= enterDurationFrames <= 30`, `mode ∈ {'pop','rise','fade'}`, `enterScale ∈ (0,1)` si
      `pop`, `riseDistanceEm > 0` si `rise`, y los tres modos cubren el registro completo (§4.2)
- [ ] `pnpm nx test composition-remotion` en verde para los dos specs (nuevo y modificado)

---

### TASK-002: Palabra activa y estado de impacto por frame (`activeWordIndex`, `captionWordRenders`)

**Historia:** HU-2-02, HU-2-03
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-active-word.ts`
- `libs/composition-remotion/src/helpers/caption-active-word.spec.ts`

**Descripción:** Implementar architect.md §5: `activeWordIndex(frame, words)` con el predicado
semiabierto de §5.1 (`frame >= word.fromFrame && frame < word.fromFrame + word.durationFrames`, vía
`Array.prototype.findIndex`, `-1` si ninguna palabra matchea); `CaptionWordRender` y
`captionWordRenders(frame, words, emphasisIndex)` que empareja texto y estado ya resuelto
(`isEmphasis: index === emphasisIndex`, `isActive: index === activeIndex`) para que el componente
nunca tenga que indexar un array bajo `noUncheckedIndexedAccess`. `CaptionWord` sale de
`src/helpers/timeline-types.ts` (ya existente); `CaptionWordState` es el de `caption-word-style.ts`
de `cycle-01` — no se toca ese archivo. Cero `if` en `activeWordIndex` (una sola expresión con `&&`).

**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna

**Criterio de done:**

- [ ] Sobre `[0,10) [10,18) [18,30)`: `activeWordIndex` en los frames 0, 9, 10, 17, 18, 29 da
      `0, 0, 1, 1, 2, 2` (los seis bordes de rango, CA-4/CA-007)
- [ ] `activeWordIndex(30, words)` y `activeWordIndex(-1, words)` dan `-1`; `activeWordIndex(0, [])`
      da `-1` (sin guarda explícita, cae del mismo predicado)
- [ ] Con hueco (`[0,5) [10,15)`): frames 5..9 dan `-1` (CA-5, RN-6)
- [ ] Con solapamiento (`[0,10) [5,15)`): frame 7 da `0`, nunca `1` (gana la de menor índice)
- [ ] Barrido completo de `[0, durationInFrames)` sobre una frase con `emphasisIndex` fijo: en cada
      frame, como máximo una palabra con `isActive: true` (RN-5), y **siempre**
      `renders[emphasisIndex].isEmphasis === true`, sea o no la palabra activa en ese frame (CA-6,
      CA-008, RN-7)
- [ ] `captionWordRenders(frame, words, null)`: ninguna palabra queda con `isEmphasis: true` (sin
      `??`, `null !== index` para todo `index: number`)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-003: Plan de caja y precedencia `boxSource` (`captionClipPlan`) + fix de la deuda de `caption-safe-zone.spec.ts`

**Historia:** HU-2-04
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/helpers/caption-clip-plan.ts`
- `libs/composition-remotion/src/helpers/caption-clip-plan.spec.ts`

**Archivos a modificar:**

- `libs/composition-remotion/src/helpers/caption-safe-zone.spec.ts` (el test de contención pasa de
  `captionLayout(safeZone, format)` a `captionBoxFor(safeZone, format, captionPreset(presetId))`,
  iterando `CAPTION_PRESET_IDS × CAPTION_PLATFORMS` — de 3 casos a 12 — arquitect.md §8.5)

**Descripción:** Implementar architect.md §6 completo: `CaptionBoxSource` (`'preset' | 'clip'`),
`CaptionClipPlan`, `CaptionClipPlanInput` (props opcionales con `| undefined` explícito — D-22) y
`captionClipPlan(input)` con el algoritmo de §6.1 (`presetBox` calculado una sola vez fuera del
`map`, `boxSource ?? 'preset'`, `fontSize` por clip vía `fitCaptionFontSize`); y `captionBoxStyle(box,
fontSize)` con el objeto de §6.4 (**sin** `transform` ni `opacity` — invariante testeada). Fijar la
precedencia de R-9/D-19: con `boxSource` sin indicar (default `'preset'`), `clip.box` se ignora
siempre; con `'clip'`, `clip.box ?? presetBox`. En el mismo `git mv` de contexto, actualizar
`caption-safe-zone.spec.ts` para que verifique contención contra la caja que **efectivamente** se va
a dibujar (`captionBoxFor`) en vez de contra `captionLayout`, que este ciclo empieza a dejar de
usarse (su archivo se borra recién en `TASK-005`, junto con `caption-track.tsx` — D-26).

**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna

**Criterio de done:**

- [ ] **Default = preset.** Sin `boxSource`, con un clip cuyo `box` es
      `{x:10,y:20,width:300,height:100}`, el plan devuelve
      `captionBoxFor(captionSafeZone(format,'tiktok'), format, captionPreset('bold-impact'))` y
      **no** el box del clip (§6.3.1, R-9)
- [ ] **`boxSource: 'clip'` con `box` → gana el clip.** Mismo input, `boxSource: 'clip'` → el plan
      devuelve `{x:10,y:20,width:300,height:100}` (§6.3.2)
- [ ] **`boxSource: 'clip'` sin `box` (`box: null`) → cae al preset** (§6.3.3, cubre el lado
      derecho del `??`)
- [ ] **Contra la `Timeline` real:** con `timelineToSequenceProps(buildExampleTimeline('reels-9x16'
      )).captions` y `boxSource: 'clip'`, la caja del plan es idéntica a
      `timeline.tracks.captions[0].box`; con el default, no lo es y respeta `boxHeightRatio` del
      preset (§6.3.4, rescata la aserción que se pierde con `caption-layout.spec.ts`)
- [ ] `fontSize` es por clip: un clip de una palabra corta y otro de tres palabras largas, con la
      misma caja, dan `fontSize` distinto y decreciente (§6.3.5, encadena CA-005 de `cycle-01`)
- [ ] `platform` llega hasta la caja: el mismo input con y sin `'tiktok'` da cajas distintas, la de
      `'tiktok'` más angosta en al menos 150 px (§6.3.6)
- [ ] `'transform' in captionBoxStyle(box, fontSize) === false` (§6.4, §13 invariante 1)
- [ ] `caption-safe-zone.spec.ts` ya no importa `captionLayout`; el test de contención itera 3
      plataformas × 4 presets (12 casos) usando `captionBoxFor` + `captionPreset`, con las mismas
      cuatro aserciones de contención de `cycle-01` (`x >= 0`, `y >= 0`, `x + width <= format.width`,
      `y + height <= format.height`) — CA-002 re-verificado contra la caja real
- [ ] `pnpm nx test composition-remotion` en verde para los dos specs (nuevo y modificado)

---

### TASK-004: Componente `<KineticCaptions />` + test de estructura sin montar

**Historia:** HU-2-04
**Agente:** `implementor-front`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/components/kinetic-captions.tsx`
- `libs/composition-remotion/src/components/kinetic-captions.spec.tsx`

**Descripción:** Implementar architect.md §7 literal: `KineticCaptionsProps` (props opcionales con
`| undefined` explícito — D-22), el componente interno `CaptionClipBlock` (único nivel con hooks:
`useCurrentFrame`, `useVideoConfig` — solo se toma `fps`, nunca `durationInFrames` — D-24/D-25) y
`KineticCaptions` (sin hooks propios, resuelve `captionPreset(preset)` y arma el árbol `<Sequence>` →
`<div>` caja (`captionBoxStyle`) → `<CaptionClipBlock>` → `<div>` bloque animado
(`captionBlockStyle`) → `<span>` por palabra (`captionWordStyle`, ya existente de `cycle-01`, no se
toca). Cero `if`, cero ternarias, cero `??` dentro del `.tsx` (D-21): cualquier decisión ya vive en
los tres helpers de `TASK-001`..`TASK-003`. El test usa `KineticCaptions({...})` como función
corriente (sin `ReactDOM`, sin `render()`, sin `act()`) e inspecciona el árbol con `Children.toArray`
+ `isValidElement`, per architect.md §10.2.

**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-002, TASK-003

**Criterio de done:**

- [ ] `sequences.length === clips.length` — una `Sequence` por clip (CA-7, CA-009)
- [ ] `sequences[i].type === Sequence` (identidad contra el `Sequence` importado de `remotion` en
      el propio spec)
- [ ] `sequences[i].props.from === clips[i].from` y
      `sequences[i].props.durationInFrames === clips[i].durationInFrames` — exactos, no
      aproximados (CA-7, "ni un frame antes ni un frame después")
- [ ] `sequences[i].key` contiene el `clipId` de ese clip
- [ ] `clips: []` → cero hijos, sin excepción
- [ ] El hijo de cada `Sequence` es el `<div>` de la caja: su `style` no tiene clave `transform`, y
      `left`/`top`/`width`/`height`/`fontSize` coinciden con `captionClipPlan(...)` recalculado en
      el propio test
- [ ] Con `boxSource: 'clip'` y un clip con `box`, ese `<div>` usa el box del clip (R-9 verificado en
      el árbol real, no solo en el helper de `TASK-003`)
- [ ] `KineticCaptions` no llama ningún hook (verificable porque el test lo invoca como función
      pura, sin wrapper de Remotion, y no tira)
- [ ] `CaptionClipBlock` no se exporta del archivo (detalle interno)
- [ ] `pnpm nx test composition-remotion` en verde para el nuevo spec

---

### TASK-005: Cableado en `TimelineComposition`, baja de `CaptionTrack`/`captionLayout` y barrel

**Historia:** HU-2-04
**Agente:** `implementor-front`
**App:** `libs/composition-remotion`
**Archivos a modificar:**

- `libs/composition-remotion/src/components/timeline-composition.tsx` (monta `<KineticCaptions />`
  en vez de `<CaptionTrack />`; agrega `captionPreset`/`captionPlatform`/`captionAnchor` opcionales a
  `TimelineCompositionProps`; `calculateTimelineMetadata` pasa a `props: { ...props, timeline:
  metadata.timeline }` — D-23/R-13)
- `libs/composition-remotion/src/index.ts` (quita `captionLayout`, `CaptionTrack`, `CaptionTrackProps`
  del barrel; agrega lo listado en architect.md §8.3: `captionBlockStyle`, `captionClipAnimation` +
  sus tipos, `activeWordIndex`, `captionWordRenders` + su tipo, `captionBoxStyle`, `captionClipPlan`
  + sus tipos, `KineticCaptions` + su tipo)

**Archivos a eliminar:**

- `libs/composition-remotion/src/components/caption-track.tsx` (D-D de la spec / RN-11 del
  funcional — sin alias deprecado, sin re-export)
- `libs/composition-remotion/src/helpers/caption-layout.ts` (D-26, superado por `captionBoxFor`)
- `libs/composition-remotion/src/helpers/caption-layout.spec.ts` (se va con su helper)

**Descripción:** Implementar architect.md §8.1 a §8.3. Confirmar antes de tocar nada que
`caption-track.tsx`, `caption-layout.ts` y el barrel son los únicos tres puntos del repo que
referencian lo que se da de baja (§8.1: `apps/` y `tools/` no existen todavía, `libs/auto-montage` y
`libs/timeline-core` no importan nada de esta lib). El nuevo `<KineticCaptions>` en
`TimelineComposition` recibe `safeZone={timeline.safeZone ?? safeZoneFor(timeline.format)}` (ya
existente, sin cambios) y reenvía las tres props opcionales nuevas; no expone `boxSource` (usa el
default `'preset'`). El barrel queda **exactamente** como lista §8.3 — ninguna otra exportación
existente se toca.

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002, TASK-003, TASK-004

**Criterio de done:**

- [ ] `TimelineComposition` importa `KineticCaptions` de `./kinetic-captions`; ya no existe ningún
      import de `./caption-track` en el árbol de `src/**`
- [ ] `calculateTimelineMetadata` devuelve `props: { ...props, timeline: metadata.timeline }` — un
      `captionPreset` puesto en `defaultProps` o en el Studio sobrevive al cálculo de metadata (D-23,
      R-13)
- [ ] `src/components/caption-track.tsx`, `src/helpers/caption-layout.ts` y
      `src/helpers/caption-layout.spec.ts` ya no existen en el árbol de archivos (CA-8, RN-11)
- [ ] `src/index.ts` exporta exactamente lo de architect.md §8.3 (diff mínimo: quita 3 símbolos,
      agrega los de `caption-animation`, `caption-active-word`, `caption-clip-plan` y
      `kinetic-captions`) y ninguna exportación previa de `cycle-01` cambia
- [ ] `CaptionClipBlock`, `CaptionPresetGallery` y `CAPTION_PRESET_GALLERY_ID` **no** se exportan del
      barrel (§8.3, tabla "No se exporta")
- [ ] `pnpm exec nx lint composition-remotion` en verde (detecta imports colgantes de lo eliminado)
- [ ] `pnpm nx test composition-remotion` sigue en verde para toda la suite existente (ningún spec
      de `cycle-01` referencia ya `captionLayout`/`CaptionTrack`)

---

### TASK-006: Galería de presets (`CaptionPresetGallery`) + composición en `Root.tsx`

**Historia:** HU-2-05
**Agente:** `implementor-front`
**App:** `libs/composition-remotion`
**Archivos a crear:**

- `libs/composition-remotion/src/components/caption-preset-gallery.tsx`

**Archivos a modificar:**

- `libs/composition-remotion/src/Root.tsx` (agrega la tercera `<Composition>`, la galería —
  architect.md §9.2; las dos composiciones existentes no cambian sus `defaultProps`)

**Descripción:** Implementar architect.md §9 completo: `CAPTION_PRESET_GALLERY_ID`,
`CaptionPresetGalleryProps` (`clips`, `format`, `platform` opcional) y `CaptionPresetGallery` — un
panel de `format.width × format.height` por cada `CAPTION_PRESET_IDS[i]`, cada uno con su
`<KineticCaptions clips={clips} format={format} preset={presetId} platform={platform} />` sobre
fondo plano (`PANEL_BACKGROUND`), sin depender de `public/example/`. Registrar en `Root.tsx` la
composición con `id={CAPTION_PRESET_GALLERY_ID}`, `defaultProps` con
`timelineToSequenceProps(buildExampleTimeline('reels-9x16')).captions` +
`defaultFormat('reels-9x16')`, `durationInFrames={265}`, `fps={30}`, `width={4320}`,
`height={1920}`, **sin** `calculateMetadata`. No se agrega ningún archivo a `src/__fixtures__/`. La
galería **no entra a `src/index.ts`** ni tiene spec propio (§9.3): su lógica ya está cubierta por
los helpers de `TASK-001`..`TASK-003` y por `kinetic-captions.spec.tsx` de `TASK-004`.

**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-004

**Criterio de done:**

- [ ] `remotion studio` (invocación manual del implementador para verificar, no un target de CI)
      lista la composición `CaptionPresetGallery` y muestra los cuatro paneles de 1080×1920 lado a
      lado, uno por preset, cada uno animando (CA-9, RN-12)
- [ ] Ningún panel usa `public/example/` ni ningún archivo de video/imagen; el fondo es plano
      (`PANEL_BACKGROUND`)
- [ ] `CaptionPresetGallery`, `CAPTION_PRESET_GALLERY_ID` y `CaptionPresetGalleryProps` **no**
      aparecen en `src/index.ts`
- [ ] Ningún test de la suite monta `CaptionPresetGallery`; no se crea `caption-preset-gallery.spec.tsx`
      (RN-14 — la galería queda fuera de lo que verifica cada cambio del proyecto)
- [ ] `pnpm exec nx lint composition-remotion` y `pnpm exec nx build composition-remotion` en verde:
      `tsconfig.lib.json` incluye `src/**/*.tsx`, así que la galería se typechequea y se lintea
      aunque no la mida la cobertura ni la corra `test` (§9.3)
- [ ] `vite.config.ts` sigue sin incluir `src/components/**` (D-21) — la cobertura de
      `composition-remotion` no se mueve por este archivo

---

### TASK-007: Delta de `sdd/components.json`, README, verificación de cierre y smoke manual

**Historia:** HU-2-06, HU-2-07
**Agente:** `implementor-back`
**App:** `libs/composition-remotion`
**Archivos a modificar:**

- `sdd/components.json` (delta exacto de architect.md §8.4, bajo `libs/composition-remotion` →
  `components`: `COMP-003` `CaptionTrack` → `status: "deprecated"` con su `changelog`; `COMP-004`
  `TimelineComposition` → `status: "updated"` con su `changelog`; `COMP-005` `RemotionRoot` →
  `status: "updated"` con su `changelog`; `COMP-007` `KineticCaptions` nueva, `status: "defined"` →
  el implementador la pasa a `"implemented"` al cerrar; `COMP-008` `CaptionPresetGallery` nueva,
  mismo protocolo)
- `libs/composition-remotion/README.md` (tabla de superficie pública: sale `CaptionTrack` /
  `captionLayout`, entra `KineticCaptions` + los tres helpers nuevos)

**Descripción:** Auditoría de cierre del ciclo y **de la spec completa** (es su último ciclo).
Aplicar el delta de `sdd/components.json` leyendo antes `sdd/schemas/components.schema.json` (`spec`
matchea `^sdd/specs/spec-[a-z0-9-]+$`, `id` `^COMP-\d{3}$`, `name` PascalCase,
`additionalProperties: false` por entrada) — protocolo append/deprecate-only, `COMP-003` **no se
borra**. Actualizar el README con la superficie pública vigente. Cerrar con la verificación completa
en el orden de architect.md §11.11: `pnpm sdd:validate` en verde, `pnpm exec nx run-many -t lint test
build` en verde sobre los cinco proyectos, `pnpm nx test composition-remotion --coverage` reportando
`src/helpers/**` + `src/transitions/**` sin bajar del piso heredado de `cycle-01`
(96.2 % stmts / 92.38 % branches; el gate mínimo del ciclo es 90 % / 85 %). **Recién con todo eso en
verde**, ejecutar el smoke manual — una única vez, y **antes de arrancarlo, correr `memory_pressure`
y, si no informa `normal`, esperar y reintentar** (la máquina es una MacBook M2 de 16 GB compartida
con otro carril que puede estar transcribiendo audio con whisper — RN-17/RN-18, CE-5): si la máquina
está ocupada o con memoria insuficiente, el render se pospone, nunca se fuerza. Con las dos
condiciones en orden, `pnpm nx run composition-remotion:smoke`.

**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006

**Criterio de done:**

- [ ] `sdd/components.json` refleja el delta exacto de architect.md §8.4 (`COMP-003` deprecado sin
      borrarse, `COMP-004`/`COMP-005` actualizados, `COMP-007`/`COMP-008` nuevas en `"implemented"`)
- [ ] README documenta `KineticCaptions` y ya no menciona `CaptionTrack` ni `captionLayout` como
      superficie pública
- [ ] `pnpm sdd:validate` en verde
- [ ] `pnpm exec nx run-many -t lint test build` en verde sobre los cinco proyectos afectados
- [ ] Cobertura de `composition-remotion` >= 90 % stmts / >= 85 % branches sobre
      `src/helpers/**` + `src/transitions/**`; si el número reportado es menor al piso heredado
      (96.2 % / 92.38 %), dejarlo anotado como hallazgo para el reviewer — no bloquea el gate mínimo
- [ ] Ningún test de la suite monta un componente, renderiza un frame ni sale a la red (RNF-1,
      CA-11, CA-13)
- [ ] `vite.config.ts`, `eslint.config.mjs` y `project.json` de la lib quedan intactos (D-21)
- [ ] `libs/timeline-core/**` queda intacto (D-A, RNF-4)
- [ ] **Antes del smoke:** se corrió `memory_pressure` y confirmó `normal` (o se esperó y se
      reintentó hasta que lo confirmara) y se verificó que la máquina no está transcribiendo audio de
      otro proyecto en ese momento (CA-12, CE-5)
- [ ] El smoke (`pnpm nx run composition-remotion:smoke`) se ejecutó **una sola vez**, después de
      `lint`/`test`/`build` en verde, y nunca como parte de `nx run-many` (CA-11, RN-15/RN-16)
- [ ] El `.mp4` resultante muestra: los captions entrando con rebote, la palabra activa siguiendo a
      la voz, la palabra de impacto destacada toda la frase, y el bloque dentro del safe zone —
      verificación visual, sin aserción automatizada (§10.4 del architect)
- [ ] Con este ciclo cerrado, `spec-e-burgos-003-kinetic-captions` no deja ningún RF ni CA pendiente

---

## Resumen de tasks

| Task     | Título                                                                      | Agente             | HU cerradas    | CA (spec / funcional)      | Dependencias                                    | h  | SP |
| -------- | ---------------------------------------------------------------------------- | ------------------- | -------------- | ---------------------------- | ------------------------------------------------ | -- | -- |
| TASK-001 | Animación de entrada/salida (`caption-animation.ts`) + `animation` en preset | `implementor-front` | HU-2-01        | CA-006 / CA-1, CA-2, CA-3    | ninguna                                          | 4  | 5  |
| TASK-002 | Palabra activa e impacto (`caption-active-word.ts`)                          | `implementor-back`  | HU-2-02, HU-2-03 | CA-007, CA-008 / CA-4, CA-5, CA-6 | ninguna                                    | 3  | 3  |
| TASK-003 | Plan de caja y `boxSource` (`caption-clip-plan.ts`) + fix safe-zone spec     | `implementor-back`  | HU-2-04        | CA-009 (parcial), CA-002 / CA-7 (parcial) | ninguna                              | 4  | 5  |
| TASK-004 | Componente `KineticCaptions`                                                | `implementor-front` | HU-2-04        | CA-009 / CA-7                | TASK-001, TASK-002, TASK-003                     | 4  | 5  |
| TASK-005 | Cableado `TimelineComposition` + baja `CaptionTrack`/`captionLayout` + barrel | `implementor-front` | HU-2-04        | CA-009 / CA-8                | TASK-001, TASK-002, TASK-003, TASK-004           | 3  | 3  |
| TASK-006 | Galería de presets (`caption-preset-gallery.tsx`) + `Root.tsx`               | `implementor-front` | HU-2-05        | CA-010 / CA-9, CA-10         | TASK-004                                         | 3  | 3  |
| TASK-007 | `components.json`, README, verificación de cierre y smoke manual            | `implementor-back`  | HU-2-06, HU-2-07 | CA-011 / CA-11, CA-12, CA-13, CA-14 | TASK-001..TASK-006                        | 2  | 2  |
| **Total**| —                                                                              | —                    | —              | —                             | —                                                 | **23** | **26** |

CA-006 a CA-011 de la spec quedan cubiertos íntegramente: CA-006 en TASK-001, CA-007/CA-008 en
TASK-002, CA-009 en TASK-003 (parcial: precedencia y `fontSize`) y TASK-004/TASK-005 (completo: la
`Sequence` real y la baja del bloque estático), CA-010 en TASK-006, CA-011 en TASK-007. CA-002 de
`cycle-01` se re-verifica en TASK-003 contra la caja que efectivamente se dibuja. CA-1 a CA-14 del
funcional quedan cubiertos en las siete tasks (CA-11/CA-12, la regla operativa de proteger la
máquina compartida, se verifica en TASK-007 antes del smoke).
