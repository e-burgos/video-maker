# Architect — Cycle 2: Conceptos clave, planificador de B-roll y composición del auto-montaje

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect

---

## 0. Registros SDD que este ciclo NO toca

Igual que en `cycle-01`, y por el mismo motivo: `libs/auto-montage` es una lib Node que se consume
por source y cuyo único almacenamiento son archivos JSON bajo `media/<project-slug>/work/`.

- **`sdd/schema.json` — NO APLICA.** No hay motor de base de datos en el repo. El contrato de
  persistencia de este ciclo son los schemas Zod `EditDecisionListSchema` y `TimelineSchema` de
  `timeline-core` (ya existentes, versionados por `schemaVersion: 1` dentro de cada documento).
  No se define ni una tabla.
- **`sdd/api.json` — NO APLICA.** No hay superficie HTTP. La API pública del ciclo es el
  `src/index.ts` de la lib (§9). El primer `api.json` real llega con `apps/render-api`
  (`spec-e-burgos-005`).
- **`sdd/components.json` — NO APLICA.** No hay UI. Este ciclo no crea ni un componente React;
  el único consumidor visual es `composition-remotion`, que ya existe y que este ciclo **no toca**
  (ver D-4, §1.1, "Handoff a `cycle-03`").

Queda constancia acá porque el protocolo del `sdd-architect` exige escribir `api.json` y
`schema.json`: en este ciclo hacerlo sería agregar entradas vacías o falsas.

---

## 1. Decisiones técnicas

Continúan la numeración de `cycle-01` (última: D-9). D-4 conserva su número original de la spec.
**No se re-litigan D-1, D-2, D-3, D-5, D-6, D-7, D-8 ni D-9** — se aplican tal cual.

### 1.1 D-4 — Anchor del punch-in: **opción (a)**, extensión aditiva de `timeline-core`

**Decisión:** `ClipTransformSchema` de `libs/timeline-core/src/schemas/timeline.schema.ts` gana un
campo **opcional** `anchor`, tipado con el `PunchInAnchorSchema` que ya existe, y `buildTimeline`
lo propaga desde `punch.anchor` hacia el sub-rango con zoom. `translateX`/`translateY` **no se
tocan**: siguen en 0.

```diff
--- libs/timeline-core/src/schemas/timeline.schema.ts
+import { PunchInAnchorSchema } from './edit-decision-list.schema';

 export const ClipTransformSchema = z.object({
   scale: z.number(),
   translateX: z.number(),
   translateY: z.number(),
+  anchor: PunchInAnchorSchema.optional(),
 });
```

```diff
--- libs/timeline-core/src/timeline/build-timeline.ts
 interface KeepSubRange {
   startMs: Ms;
   endMs: Ms;
   scale: Scale;
+  anchor?: PunchInAnchor;
 }

   for (const punch of sortedPunches) {
     if (punch.startMs > cursorMs) {
       subRanges.push({ startMs: cursorMs, endMs: punch.startMs, scale: 1 });
     }
-    subRanges.push({ startMs: punch.startMs, endMs: punch.endMs, scale: punch.scale });
+    subRanges.push({
+      startMs: punch.startMs,
+      endMs: punch.endMs,
+      scale: punch.scale,
+      ...optionalField('anchor', punch.anchor),
+    });
     cursorMs = punch.endMs;
   }

-        transform: { scale: subRange.scale, translateX: 0, translateY: 0 },
+        transform: {
+          scale: subRange.scale,
+          translateX: 0,
+          translateY: 0,
+          ...optionalField('anchor', subRange.anchor),
+        },
```

Eso es **todo** el diff de producción en `timeline-core`: dos archivos, un import, cuatro líneas
efectivas. `optionalField` ya existe en `build-timeline.ts` y se reusa.

#### Por qué el anchor va adentro de `transform` y no en `VideoClip`

Porque el anchor **es** parte del transform: el renderer no lo consume como un dato del clip sino
como el `transform-origin` de ese mismo transform. `libs/composition-remotion/src/helpers/punch-in-style.ts`
ya está escrito así, y ya tiene su tabla y sus tests:

```ts
const TRANSFORM_ORIGIN_BY_ANCHOR: Record<PunchInAnchor, string> = {
  center: '50% 50%', top: '50% 0%', 'face-hint': '50% 33%',
};
export function punchInStyle(transform: ClipTransform, anchor?: PunchInAnchor): CSSProperties
```

Y `ClipTransform` en `composition-remotion` está definido como `VideoClip['transform']`, así que el
campo nuevo llega solo, sin tocar tipos intermedios. Ponerlo en `VideoClipSchema` obligaría además a
decidir qué significa un `anchor` en un clip de B-roll, que no tiene zoom.

#### Por qué NO se deriva `translateX`/`translateY` del anchor

Es la sub-opción que el brief dejaba abierta dentro de (a), y se **descarta con razón geométrica**,
no por gusto:

1. **El renderer no lo consume así.** Con `transform-origin: 50% 50%` (el default del helper), un
   `scale(s)` sube el borde superior en `h·(s−1)/2`; emular el anchor `top` exigiría
   `translateY = h·(s−1)/(2s)` — y `h` es la altura del **formato de salida**, no del clip. Sería
   meter geometría de render adentro de `buildTimeline`, que hoy no sabe nada de píxeles más allá de
   la safe zone.
2. **Se duplicaría, y quedarían dos implementaciones peleando.** `punchInStyle` seguiría aplicando
   su `transformOrigin` (default `center`) *encima* del translate derivado: el zoom terminaría
   corrido al doble. Habría que borrar el helper que ya existe y está testeado.
3. **`face-hint` no tiene coordenadas.** No hay detección de rostro en ningún lado del repo, ni la
   habrá en esta spec. `punchInStyle` lo resuelve como la heurística `50% 33%` — una constante
   editorial, no una medición. Convertirla en píxeles dentro de `timeline-core` la congelaría en el
   documento persistido y haría que cambiar la heurística obligue a regenerar todos los
   `timeline.json` viejos. Como `anchor`, es un símbolo que el renderer interpreta; eso es
   exactamente lo que queremos que viaje.

#### Por qué NO la opción (b)

(b) —el preset fija el anchor, viaja en el EDL y muere ahí— deja el sistema en el estado que la
spec pide arreglar: `PunchInDecision.anchor` **ya existe hoy** y **ya se persiste** en el EDL. Elegir
(b) sería declarar "no hacemos nada" con otras palabras. Lo que se perdería es concreto y
verificable: los cuatro presets diferirían en un parámetro (`punchIn.anchor`) cuyo efecto en el
video renderizado sería **cero**, y `punchInStyle` quedaría como código muerto con tests que nadie
puede alcanzar desde una Timeline real. Ese es el peor resultado posible: un parámetro que parece
editorial y no lo es.

#### Por qué es seguro tocar una lib de una spec cerrada

Verificado archivo por archivo, no inferido:

| Riesgo | Verificación |
| --- | --- |
| Ciclo de imports | `edit-decision-list.schema.ts` importa `primitives` y `output-format.schema`; **no** importa `timeline.schema`. La flecha nueva `timeline → edl` es la misma dirección que ya tiene `build-timeline.ts` (EDL ⇒ Timeline). Sin ciclo. |
| Superficie pública de `timeline-core` | **No cambia**: `PunchInAnchorSchema` ya vive en `edit-decision-list.schema.ts` y **no** se exporta desde `index.ts`; `ClipTransformSchema` tampoco. Por lo tanto la lista `PUBLIC_VALUE_EXPORTS` de `schemas.spec.ts` **no se toca** (trampa real: ese spec compara los exports del barrel contra una lista literal). |
| Retrocompatibilidad de parseo | `anchor` es `.optional()`: todo `timeline.json` ya escrito sigue parseando. |
| Retrocompatibilidad de salida | `optionalField` omite la clave cuando el valor es `undefined`. Un EDL cuyos punch-ins no traen `anchor` produce **exactamente los mismos bytes que hoy**. |
| Tests existentes de `build-timeline` | `build-timeline.spec.ts:39,48` usa `toMatchObject` (parcial recursivo) sobre `transform` → tolera la clave nueva. La única aserción `toEqual` estricta sobre `tracks.aroll` (línea ~258) es el caso `singleKeepEdl`, **sin punch-in** → sin `anchor`. Cero ediciones. |
| Fixtures | `libs/timeline-core/src/__fixtures__/edl.ts:26` y `libs/composition-remotion/src/__fixtures__/example-edl.ts:54` traen `anchor: 'center'` → su Timeline gana `transform.anchor: 'center'`. `example-timeline.spec.ts` sólo asserta `validateTimeline`, `durationFrames` y `format`; `sequence-props.spec.ts` sólo `transform.scale`. Cero ediciones. |
| JSON Schema commiteado | `libs/timeline-core/schemas/timeline.schema.json` cambia: `properties.transform.properties` gana `anchor` (enum de 3 valores) en `tracks.aroll[]` y `tracks.broll[]`; `required` **no** cambia. `edit-decision-list.schema.json` **no** cambia. |

**Obligación operativa (no negociable):** después del cambio hay que correr
`pnpm nx run timeline-core:schemas` y **commitear** `libs/timeline-core/schemas/timeline.schema.json`.
`schemas.spec.ts` compara los archivos byte a byte contra `serializeJsonSchemaFile(...)`; sin la
regeneración, `nx test timeline-core` queda en rojo.

**Tests nuevos que este ciclo agrega a `timeline-core`** (los únicos; nada más entra en ese diff):

1. `buildTimeline` propaga `punch.anchor` al `transform` del sub-rango con zoom, y **no** al
   sub-rango sin zoom que lo precede.
2. Un punch-in **sin** `anchor` produce un `transform` sin la clave `anchor` (retrocompatibilidad
   byte a byte).

#### Handoff a `cycle-03` (una línea) y a `spec-e-burgos-003`

Con este ciclo el anchor **llega íntegro hasta `work/timeline.json`**. Lo que falta para que llegue
al píxel es una línea en `libs/composition-remotion/src/components/aroll-series.tsx`, y es trabajo
de `cycle-03` (el ciclo que cablea el render), no de éste:

```diff
-  const style = punchInStyle(scene.transform);
+  const style = punchInStyle(scene.transform, scene.transform.anchor);
```

`VideoSequenceProps.transform` ya copia el objeto entero (`transform: clip.transform` en
`timeline-to-sequence-props.ts:101`), así que no hay más plomería que hacer. `cycle-03` debe
escribir su fragmento en `sdd/context/libs/composition-remotion/updates/`.

**Impacto en `spec-e-burgos-003-kinetic-captions`:** ninguno directo — los captions no usan
`transform`. El impacto es de **precedente**: queda establecido que un símbolo editorial viaja
como enum hasta la Timeline y el renderer lo interpreta, en vez de resolverse a píxeles río
arriba. `spec-003` va a necesitar exactamente eso para el estilo de los captions (`CaptionClip` no
tiene campo de estilo hoy); el patrón a copiar es éste, no el de precalcular geometría.

**Fragmento de contexto obligatorio de este ciclo:**
`sdd/context/libs/timeline-core/updates/2026-09-07-spec-e-burgos-002-cycle-02.md`.

---

### 1.2 D-10 — Un montaje = **un** A-roll

`EditDecisionList.sourceAssetId` es un único id y la partición `keep`/`cut` que valida
`EditDecisionListSchema` tiene que teselar un solo eje temporal desde 0. No hay forma de expresar
dos A-roll en un EDL sin cambiar ese contrato, y cambiarlo está fuera del alcance de D-4.

**Regla:** `autoMontage` monta **un** asset de `role: 'aroll'`. Se elige con
`options.arollAssetId` si viene; si no, **el primer `aroll` del catálogo por `asset.id` ascendente**
(el catálogo ya está ordenado por `asset.id` — invariante de `cycle-01` §4 —, así que la elección no
depende del filesystem). Sin ningún `aroll` → `MontageInputError` con `reason: 'no-aroll-asset'`.
La concatenación de varios A-roll queda documentada como pendiente de `cycle-03`/`spec-005`.

### 1.3 D-11 — El eje temporal del EDL es el eje **CRUDO**, no el podado

Esta es la trampa del ciclo y hay que dejarla escrita, porque la intuición dice lo contrario y el
código dice esto:

- `EditDecisionListSchema.validateKeepCutPartition` exige que `keep` + `cut` teselen desde
  `startMs = 0` sin huecos. Los `cut` sólo existen si el eje **incluye** lo cortado ⇒ el eje del EDL
  es el material **crudo**.
- `validateOverlaysWithinKeep` exige que `punch-in`, `broll-overlay`, `caption-group` y `duck` caigan
  **completos dentro de un único `keep`** ⇒ también en ms crudos.
- `buildTimeline` es quien pasa al eje editado: `trimStartMs: subRange.startMs` (crudo) y
  `from: cursorFrame` (editado), con `frameWithinKeep(placement, ms, fps)` para los overlays.

**Consecuencia:** el keyword spotting trabaja sobre los timestamps crudos de la `Transcription` y
sus resultados entran **tal cual** al EDL. **`remapMsAfterCuts` NO se usa para construir el EDL.**
Usarlo sería el bug: los overlays remapeados caerían fuera de todo `keep` y
`EditDecisionListSchema.parse` los rechazaría con
`La decisión "..." debe caer completa dentro de un único keep`.

Único uso legítimo de `remapMsAfterCuts` en este ciclo: calcular
`AutoMontageResult.editedDurationMs = remapMsAfterCuts(pruneDurationMs, keeps)`, que es un dato de
reporte para el dev y para `cycle-03`. Nunca entra en un documento persistido.

**Lo que sí hay que resolver es otra cosa: la elegibilidad.** Un rango del eje crudo puede no caer
dentro de ningún `keep`, aunque venga de palabras reales:

- `pruneSilences` **absorbe** los `keep` más cortos que `minKeepMs` convirtiéndolos en `cut`
  (`absorbShortKeepsIntoCuts`), y esos tramos **sí contienen palabras**.
- Un `CaptionGroupPlan` agrupa hasta 3 palabras y puede cruzar un `cut`.
- `extendedEndMs` de `groupWordsForCaptions` puede estirar el `endMs` de un grupo más allá de su
  última palabra, y por lo tanto más allá del final del `keep`.

**Regla única, aplicada a TODO overlay antes de emitirlo** (`src/montage/keep-window.ts`):

```ts
export function findEnclosingKeep(keeps: readonly KeepRange[], startMs: Ms, endMs: Ms): KeepRange | undefined;
export function clampToKeep(keep: KeepRange, startMs: Ms, endMs: Ms): { startMs: Ms; endMs: Ms } | undefined;
```

- Un overlay cuyo `[startMs, endMs]` no cabe entero en un `keep` **se descarta**, salvo el caso de
  clamp explícito de abajo. Nunca se parte en dos.
- **Captions:** si `firstWord.startMs` y `lastWord.endMs` caen en el mismo `keep` pero el `endMs`
  extendido lo excede, se **clampea** `endMs = keep.endMs`. Es seguro porque
  `validateCaptionGroupWords` sólo exige `word.endMs <= decision.endMs`, y
  `lastWord.endMs <= keep.endMs` por hipótesis. Si es la **palabra** la que cae afuera, se descarta
  el grupo entero.
- **B-roll:** si el rango excede el `keep`, se clampea el `endMs`; si la duración resultante queda
  por debajo de `preset.broll.minDurationMs`, se descarta (rechazo `outside-keep`).

### 1.4 D-12 — Margen de **un frame** contra `CLIP_EXCEEDS_ASSET`

`validateTimeline` marca `CLIP_EXCEEDS_ASSET` cuando
`trimStartMs + framesToMs(durationFrames, fps, 'ceil') > asset.durationMs`, mientras que
`buildTimeline` calcula `durationFrames = max(1, msToFrames(ms, fps))` con redondeo **`round`**. Las
dos operaciones no son inversas: un rango que termina exactamente en `asset.durationMs` puede
redondear hacia arriba medio frame y hacer fallar CA-011 por un milisegundo. A 30 fps un frame son
33,33 ms y `durationMs` casi nunca es múltiplo de eso.

**Regla, aplicada en dos lugares y en ningún otro:**

```ts
const frameMs = framesToMs(1, fps, 'ceil');          // 34 a 30 fps
const pruneDurationMs = Math.max(1, arollAsset.durationMs - frameMs);
const assetCapMs = brollAsset.kind === 'image' ? Infinity : brollAsset.durationMs - frameMs;
```

1. `pruneSilences` recibe `pruneDurationMs`, no `asset.durationMs` — el último `keep` termina un
   frame antes del final del A-roll.
2. Un asset de B-roll de video sólo es candidato si `assetCapMs >= preset.broll.minDurationMs`, y la
   duración del overlay se capa a `assetCapMs`. Las imágenes no se capan: `clipExceedsAssetUsage`
   devuelve `false` para `kind === 'image'`.

Test obligatorio: un A-roll con `durationMs` **no múltiplo** del frame (p. ej. 10 007 ms a 30 fps)
produce una Timeline que `validateTimeline` acepta sin issues.

### 1.5 D-13 — Fuente de aleatoriedad: **una sola**, y no se deriva

**Decisión:** la única aleatoriedad del pipeline es el `mulberry32` que `planPunchIns` siembra con
`seed`. El keyword spotting, el matching de B-roll, la selección de transiciones y el ducking son
**funciones totales deterministas, sin azar**.

Por qué no un generador derivado (`seed + 1`, `hash(seed, 'broll')`, un `next()` compartido):

- Un generador **compartido** acopla la salida del B-roll a **cuántas veces** consumió
  `planPunchIns`, que depende de la cantidad de `keep`. Cambiar `minKeepMs` de un preset movería
  todas las decisiones de B-roll. Es no-determinismo de segundo orden disfrazado de determinismo.
- Un generador **derivado** no agrega valor editorial: no hay ninguna decisión de B-roll que sea
  legítimamente "a gusto". Cada regla de desempate (§5.3) tiene una razón editorial y produce un
  **orden total**, así que no queda ningún empate que romper con azar. Agregar azar sería agregar
  ramas no determinables sin ganar nada, y encima empujaría la cobertura para abajo.
- CA-012 pide que cambiar el `seed` **pueda** cambiar el resultado, no que cambie todo: con las
  escalas de punch-in variando por `seed`, `timeline.json` cambia. Suficiente y verificado por test.

**Cómo se vuelve imposible que el orden de iteración del catálogo cambie la salida:** todas las
colecciones se ordenan por una clave **total y única** antes de decidir, nunca se itera un `Map` ni
el array del catálogo tal como viene. La clave final de desempate es siempre `assetId`, que es único
por construcción (D-5: `assetId === path`). Test: correr `autoMontage` con
`catalog.assets` invertido y comparar los bytes de `timeline.json` — idénticos.

### 1.6 D-14 — El **nombre de archivo** es el contrato de tagueo del B-roll (resuelve A-1)

**Verificado:** ni `MediaAssetSchema` ni `CatalogAssetSchema` tienen un solo campo semántico —
`id`, `kind`, `path`, datos de probe y `fingerprint`. La única señal léxica disponible es la ruta.

**Decisión: alcanza, y se declara como contrato de nombrado.** No se agrega ninguna fuente de tags.

Motivos para no agregar un archivo de tags:

- Viviría en `raw/` (lo escribe el dev), que es **de solo lectura por contrato** para la lib
  (CA-006). Ponerlo en `work/` lo haría regenerable-desde-`raw/`… a partir de nada.
- Sería un contrato persistido nuevo: schema, versión, política de invalidación en el fingerprint
  del catálogo (D-6), modo de degradación si no parsea (D-8), y su propio juego de tests. Costo alto
  para el ciclo, y RF-6 pide explícitamente matching "por nombre de archivo".
- La ruta ya es un tagueo perfectamente ergonómico si se explota la anidación, que la ingesta de
  `cycle-01` **ya preserva** (el descubrimiento es recursivo dentro de cada carpeta de rol).

**Contrato de nombrado (`src/broll/asset-tokens.ts`, puro):**

```ts
export function assetTokens(assetPath: ProjectRelativePath, minTermLength: number): ReadonlySet<string>;
```

1. Se descartan los dos primeros segmentos (`raw/` y la carpeta de rol) y la extensión.
2. Los segmentos restantes —**subcarpetas incluidas**— se parten por `[^\p{L}\p{N}]+`.
3. Cada token se normaliza con `normalizeTerm` (§4.1, la misma función que los conceptos).
4. Se descartan los tokens vacíos, los puramente numéricos y los de largo `< minTermLength`.

```
raw/broll/compilador-terminal.mp4        → { compilador, terminal }
raw/broll/cocina/sarten-hierro-02.mov    → { cocina, sarten, hierro }
raw/images/hardware/bateria_18650.jpg    → { hardware, bateria }
raw/broll/clip-01.mp4                    → { clip }   (no matchea nada; inofensivo)
```

Esto va documentado en el README de la lib como **contrato del dev**: el B-roll se nombra con los
términos que ilustra, separados por `-`, `_` o `/`.

### 1.7 D-15 — La prioridad `broll/` vs `images/` **la fija el preset** (resuelve A-2)

RF-6 no la fija y no hay una respuesta universal: en una receta un plano en movimiento del sartén es
mejor que una foto; en un review de hardware la foto de producto suele ser más nítida y más
informativa que un paneo; en una explicación educativa el diagrama fijo es el recurso natural.

**Decisión:** `preset.broll.rolePriority: readonly ['broll','image'] | readonly ['image','broll']`.
Es el primer criterio de desempate (§5.3) y, de paso, un sexto eje en el que los presets difieren de
forma observable. Asignación y motivo:

| Preset | `rolePriority` | Motivo editorial |
| --- | --- | --- |
| `software-demo` | `['broll','image']` | Lo que ilustra un concepto de software es una captura de pantalla **en movimiento** (el comando corriendo), no un screenshot. |
| `hardware` | `['image','broll']` | La foto de producto es más nítida y estable que un paneo a mano alzada. |
| `recipe` | `['broll','image']` | El gesto (revolver, cortar, hervir) es el contenido; una foto del plato no lo cuenta. |
| `educational` | `['image','broll']` | Diagramas y esquemas fijos; el video de apoyo es la excepción. |

### 1.8 D-16 — Stopwords de un idioma sin lista: **degradar**, nunca fallar (resuelve A-5)

`TranscriptionSchema.language` es `^[a-z]{2}(-[A-Z]{2})?$`: cualquier idioma es representable, y
whisper puede devolver `pt`, `it`, `fr`… La lib shippea listas para **`es` y `en`** y nada más
(`src/concepts/stopwords.ts`, dos constantes literales; sin dependencias npm — D-9).

**Decisión — degradación explícita y visible, en tres partes:**

1. Se resuelve la lista por el **subtag base**: `es-AR` → `es`.
2. Si no hay lista para ese subtag, se usa la **lista vacía**. No se cae a `es` por defecto (filtrar
   con las stopwords del idioma equivocado descarta palabras válidas y deja pasar las vacías: el
   peor de los dos errores) y **no se lanza** (RN-17: `autoMontage` no revienta por material
   legítimo; grabar en portugués no es un error del dev).
3. La degradación **no se traga**: sin stopwords, el filtro queda sostenido por los otros dos
   parámetros del preset —`concepts.minTermLength` (≥ 4) y `concepts.minFrequency` (≥ 2)—, que ya
   descartan casi todas las palabras funcionales por cortas o por no repetirse lo suficiente. Y el
   resultado lo dice: `AutoMontageResult.stopwordLanguage: string | null`, `null` = se degradó.

El diccionario del preset sigue funcionando igual (es matching léxico exacto, no depende del
idioma). Tres tests de rama: `es-AR` → `es`; `pt` → `null` + conceptos igual detectados;
transcripción en `pt` con una palabra funcional corta que **no** llega a concepto por
`minTermLength`.

### 1.9 D-17 — `MontagePreset` **sin campos opcionales**

Todos los parámetros de un preset son requeridos. Un preset al que le falta un parámetro es un error
de compilación, no un default silencioso. Motivo: si el tipo tuviera opcionales, el `??` que los
resuelve viviría en el orquestador y los cuatro presets podrían coincidir de hecho en un eje sin que
el tipo lo delate — justo lo que CA-010 quiere impedir. Los defaults de la industria siguen viviendo
donde ya viven (`timeline-core`), y los presets los **sobreescriben siempre, explícitamente**.

### 1.10 D-18 — Serialización: `parse` y después `stringify`; el orden de claves **se verifica**

`JSON.stringify` sigue el orden de inserción del objeto en memoria; el objeto que devuelve un
`.parse()` de Zod se reconstruye en el orden del **schema**, no del literal de entrada. Son órdenes
distintos, y la lección de `cycle-01` es que eso se verifica, no se asume.

**Decisión (idéntica a `writeCatalog`, por consistencia):**

```ts
// src/montage/serialize-montage-document.ts
export function serializeMontageDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
```

y **lo que se serializa es siempre la salida de `Schema.parse(...)`**, nunca el literal construido:
`writeEditDecisionList` hace `EditDecisionListSchema.parse(edl)` y `writeTimeline` hace
`TimelineSchema.parse(timeline)` antes de serializar. Así el orden de claves es función del schema
—estable entre corridas, entre máquinas y frente a cualquier refactor del orden de construcción— y
las claves opcionales ausentes simplemente no aparecen.

**Cómo se verifica (CA-012), cuatro tests, ninguno asume nada:**

1. **Bytes idénticos entre corridas.** Dos `autoMontage` con el mismo proyecto, preset y `seed`:
   `expect(serializeMontageDocument(TimelineSchema.parse(t1))).toBe(serializeMontageDocument(TimelineSchema.parse(t2)))`,
   ídem para el EDL.
2. **Orden de claves, aserción explícita sobre el texto.** `JSON.parse` conserva el orden textual de
   las claves en el objeto resultante, así que se assertea sobre el string ya serializado:
   ```ts
   const doc = JSON.parse(serializeMontageDocument(EditDecisionListSchema.parse(edl)));
   expect(Object.keys(doc)).toEqual(['schemaVersion','sourceAssetId','format','generatedBy','decisions']);
   expect(Object.keys(doc.decisions[0])).toEqual(['id','type','startMs','endMs']);
   ```
   y para la Timeline, top-level más `tracks.aroll[0]` (que es donde vive la clave nueva `anchor` de
   D-4). Si `timeline-core` reordena un schema, este test lo detecta.
3. **Invariancia al orden del filesystem.** Mismo proyecto con `catalog.assets` invertido → mismos
   bytes (D-13).
4. **Invariancia al entorno.** Es mecánica, no un test: `no-restricted-globals` prohíbe `Date` y
   `process` y `no-restricted-properties` prohíbe `Math.random` en todo `src/**` salvo `smoke.ts`.
   El test que sí se escribe es el negativo: `serializeMontageDocument(...)` **no contiene** la
   substring `generatedAt` ni ninguna ruta absoluta (D-6/D-7).

### 1.11 D-19 — Los rechazos del planificador son **observables**

`planBrollOverlays` devuelve `{ overlays, rejections }`, con
`rejections: readonly { conceptTerm, startMs, assetId: string | null, reason: BrollRejectionReason }[]`.
Cada regla de descarte de §5.4 tiene su propio `reason`. Motivo doble: (1) es la diagnosis que el dev
necesita para entender por qué su clip no apareció, y (2) convierte cada rama del planificador en una
aserción de una línea. La cobertura de branches cerró `cycle-01` en 85,25 % contra umbral 85; el
planificador es el módulo con más ramas del ciclo y sin esto sería el que lo rompa. Los `rejections`
**no se persisten** en ningún documento — viajan en el `AutoMontageResult` y nada más.

### 1.12 D-20 — Errores tipados nuevos

Se suman tres `code` a `AutoMontageErrorCode`, misma jerarquía y mismo estilo que `cycle-01`:

| Clase | `code` | Datos | Se lanza / se acumula |
| --- | --- | --- | --- |
| `MontageInputError` | `MONTAGE_INPUT_INVALID` | `projectRoot`, `reason` | **Lanza.** Falta un prerrequisito del montaje: no es material defectuoso, es que no se puede montar. |
| `EditDecisionListInvalidError` | `EDL_INVALID` | `sourceAssetId`, `issues: readonly string[]` | **Lanza.** Un EDL que no valida es un bug de esta lib; nunca se persiste. |
| `TimelineInvalidError` | `TIMELINE_INVALID` | `timelineId`, `issues: readonly TimelineIssue[]` | **Lanza.** CA-011 exige una Timeline válida; devolverla inválida dejaría a `cycle-03` renderizando basura. |

`MontageInputError.reason ∈ 'catalog-missing' | 'no-aroll-asset' | 'aroll-asset-not-found' |
'music-asset-not-found' | 'unknown-preset' | 'empty-aroll'`. `'empty-aroll'` cubre el caso en que
`pruneSilences` devuelve cero `keep` (A-roll de `durationMs` 0 o menor a un frame): sin ese guard,
`buildTimeline` tira `TimelineBuildError('EMPTY_AROLL')`, un error de otra lib sin el contexto del
proyecto. **Regla heredada de `cycle-01`: un error de otra lib nunca sale crudo de `auto-montage`.**

Un catálogo ilegible sigue lanzando `CatalogUnreadableError` desde `readCatalog` — acá **no** se
captura (a diferencia de la ingesta): montar sobre un catálogo corrupto no tiene degradación
sensata, y regenerarlo es `ingestProject`, que ya sabe hacerlo (D-8).

Los tres errores son alcanzables desde tests unitarios directos (`assertValidEditDecisionList`,
`assertValidTimeline` y `resolveMontageInputs` son funciones exportadas del módulo, testeadas sin
pasar por `autoMontage`), así que ninguna de estas ramas queda sin cubrir.

### 1.13 D-9 se reafirma — cero dependencias npm nuevas

Nada de lo que este ciclo necesita justifica una dependencia. En particular **no** entran:

| Tentación | Por qué no |
| --- | --- |
| Una librería de stopwords (`stopword`, `natural`) | Dos arrays de ~150 strings literales, sin lógica. Una dependencia para eso agrega superficie de supply-chain y un formato ajeno a nuestro `normalizeTerm`. |
| Un stemmer / lematizador (`snowball`) | RN-10 prohíbe el matching no exacto. Un stemmer haría que "cocinar" matchee "cocina": es exactamente la ambigüedad semántica que la spec excluye. |
| `seedrandom` | `planPunchIns` ya trae `mulberry32` y D-13 dice que no hace falta un segundo generador. |
| `deep-equal` / `fast-json-stable-stringify` | D-18 resuelve el orden de claves con `Schema.parse`, que es determinista y ya está en el repo. Ordenar claves alfabéticamente además rompería la legibilidad del diff. |

La normalización usa `String.prototype.normalize('NFD')` + `\p{M}` de las RegExp Unicode del runtime
(Node ≥ 22), igual que `group-words-for-captions.ts` de `timeline-core`.

---

## 2. Estructura de `src/` (definitiva para `cycle-02`)

Los nombres de archivo son normativos: el implementor los usa tal cual.

```
libs/auto-montage/src/
├── index.ts                          ← superficie pública ampliada (§9)
├── auto-montage.ts                   ← autoMontage(project, options, deps) — composición end-to-end (§6)
├── concepts/
│   ├── normalize-term.ts             normalizeTerm(text) — puro (§4.1)
│   ├── stopwords.ts                  ES_STOPWORDS, EN_STOPWORDS, resolveStopwords(language) (§4.2)
│   ├── concept.ts                    tipos Concept / ConceptOccurrence / ConceptSource
│   └── spot-concepts.ts              spotConcepts(transcription, options) — puro (§4.3)
├── broll/
│   ├── asset-tokens.ts               assetTokens(path, minTermLength) — puro (D-14)
│   ├── build-broll-index.ts          buildBrollIndex(catalog, preset) → BrollCandidate[] ordenado (§5.2)
│   ├── select-broll-asset.ts         selectBrollAsset(term, index) — el orden total de §5.3
│   └── plan-broll-overlays.ts        planBrollOverlays(...) → { overlays, rejections } (§5.4)
├── presets/
│   ├── montage-preset.ts             tipo MontagePreset + MontagePresetName (§3)
│   ├── software-demo.preset.ts
│   ├── hardware.preset.ts
│   ├── recipe.preset.ts
│   ├── educational.preset.ts
│   └── preset-registry.ts            MONTAGE_PRESETS + resolveMontagePreset(nameOrPreset)
├── montage/
│   ├── keep-window.ts                findEnclosingKeep / clampToKeep (D-11)
│   ├── plan-transitions.ts           planTransitions(keeps, preset) (§6.4)
│   ├── plan-caption-groups.ts        planCaptionGroups(words, keeps, concepts, preset) (§6.5)
│   ├── plan-duck-ranges.ts           planDuckRanges(words, keeps, preset) (§6.6)
│   ├── build-edit-decision-list.ts   ensambla y ordena las decisiones (§7)
│   ├── assert-valid-edl.ts           assertValidEditDecisionList → EditDecisionListInvalidError
│   ├── assert-valid-timeline.ts      assertValidTimeline → TimelineInvalidError
│   ├── serialize-montage-document.ts (D-18)
│   ├── write-edit-decision-list.ts   work/edl.json
│   └── write-timeline.ts             work/timeline.json
├── errors/
│   ├── montage-input-error.ts
│   ├── edit-decision-list-invalid-error.ts
│   └── timeline-invalid-error.ts
└── __fixtures__/
    ├── montage-project-fixture.ts    catálogo + transcripción en memoria, con broll/ e images/
    └── degenerate-project-fixtures.ts los tres casos de RN-17
```

**Por qué `src/montage/` además de las tres carpetas del brief.** El brief nombra `concepts/`,
`broll/`, `presets/` y `auto-montage.ts`. Poner el armado del EDL, los planificadores auxiliares
(transiciones, captions, ducking) y las dos escrituras a disco **dentro** de `auto-montage.ts`
dejaría un archivo de ~400 líneas que concentra toda la lógica de ramificación del ciclo — el
opuesto exacto del criterio "funciones cortas de una sola responsabilidad" de la constitución, y un
módulo imposible de testear por rama. `montage/` es a `auto-montage.ts` lo que `ingest/` es a
`ingest-project.ts` en `cycle-01`: el mismo patrón, ya validado en esta lib.

**Archivos de `cycle-01` que este ciclo modifica:** `src/index.ts` (agrega exports),
`src/errors/auto-montage-error.ts` (tres `code` nuevos en la unión). Nada más. En particular
`src/ingest/**`, `src/catalog/**`, `src/fs/**` y `src/project/**` quedan **intactos** — el ciclo es
estrictamente aditivo sobre la ingesta.

**Configuración raíz:** este ciclo **no** toca `eslint.config.mjs` ni `tsconfig.base.json`. El tag
`type:feature` y el alias ya existen desde `cycle-01`. `vite.config.ts` de la lib tampoco: los dos
alias que la lib importa ya están declarados.

---

## 3. Forma del `Preset` (CA-010)

### 3.1 El tipo

```ts
// src/presets/montage-preset.ts
import type { ClipFit, PunchInAnchor, Scale } from '@video-maker/timeline-core';

export type MontagePresetName = 'software-demo' | 'hardware' | 'recipe' | 'educational';
export type BrollRolePriority = readonly ['broll', 'image'] | readonly ['image', 'broll'];
export type TransitionKind = 'fade' | 'slide' | 'whip-pan' | 'light-leak';

export interface MontagePreset {
  readonly name: MontagePresetName;
  readonly silence: {
    readonly minSilenceMs: number;
    readonly paddingMs: number;
    readonly minKeepMs: number;
  };
  readonly punchIn: {
    readonly every: number;                          // >= 2 — ver §3.3
    readonly scales: readonly [Scale, ...Scale[]];
    readonly anchor: PunchInAnchor;
  };
  readonly concepts: {
    readonly minFrequency: number;
    readonly minTermLength: number;
    readonly dictionary: readonly string[];
  };
  readonly broll: {
    readonly targetDurationMs: number;
    readonly minDurationMs: number;
    readonly maxDurationMs: number;
    readonly noRepeatWindowMs: number;
    readonly minGapMs: number;
    readonly maxCoverageRatio: number;               // 0 < r <= 1
    readonly rolePriority: BrollRolePriority;
    readonly fit: ClipFit;
  };
  readonly captions: {
    readonly maxWords: 1 | 2 | 3;                    // tope duro del schema
    readonly maxDurationMs: number;
    readonly minDurationMs: number;
    readonly maxGapMs: number;
  };
  readonly transitions: {
    readonly every: number;
    readonly durationMs: number;
    readonly kinds: readonly [TransitionKind, ...TransitionKind[]];
    readonly timing: 'spring' | 'linear';
  };
  readonly audio: {
    readonly baseGainDb: number;
    readonly duckedGainDb: number;                   // <= 0 y < baseGainDb
    readonly attackMs: number;
    readonly releaseMs: number;
    readonly holdMs: number;
  };
}
```

Sin Zod: los presets son constantes del código, nunca se leen de disco en este ciclo. Un
`MontagePresetSchema` agregaría ramas de validación que ningún camino real ejecuta y que empujarían
la cobertura hacia abajo. `captions.maxWords` está tipado como unión literal porque
`CaptionGroupDecisionSchema.words` es `.min(1).max(3)`: el tope es del contrato, no una convención.

### 3.2 Los cuatro presets (valores normativos)

| Eje | `software-demo` | `hardware` | `recipe` | `educational` |
| --- | --- | --- | --- | --- |
| `silence.minSilenceMs` | 400 | 450 | 300 | 600 |
| `silence.paddingMs` | 70 | 80 | 40 | 120 |
| `silence.minKeepMs` | 250 | 300 | 200 | 450 |
| `punchIn.every` | 3 | 2 | 2 | 4 |
| `punchIn.scales` | `[1.08, 1.12]` | `[1.12, 1.18]` | `[1.15, 1.25]` | `[1.05, 1.10]` |
| `punchIn.anchor` | `face-hint` | `center` | `center` | `face-hint` |
| `concepts.minFrequency` | 3 | 3 | 2 | 4 |
| `concepts.minTermLength` | 4 | 4 | 4 | 5 |
| `broll.targetDurationMs` | 2500 | 3000 | 2000 | 3500 |
| `broll.minDurationMs` | 1200 | 1500 | 900 | 1500 |
| `broll.maxDurationMs` | 4000 | 5000 | 3500 | 6000 |
| `broll.noRepeatWindowMs` | 15000 | 20000 | 10000 | 30000 |
| `broll.minGapMs` | 800 | 1000 | 500 | 1500 |
| `broll.maxCoverageRatio` | 0.35 | 0.45 | 0.55 | 0.20 |
| `broll.rolePriority` | `['broll','image']` | `['image','broll']` | `['broll','image']` | `['image','broll']` |
| `broll.fit` | `cover` | `cover` | `cover` | `pip` |
| `captions.maxWords` | 3 | 3 | 2 | 3 |
| `captions.maxDurationMs` | 1200 | 1300 | 900 | 1600 |
| `captions.minDurationMs` | 300 | 320 | 260 | 380 |
| `captions.maxGapMs` | 500 | 520 | 380 | 640 |
| `transitions.every` | 4 | 3 | 2 | 6 |
| `transitions.durationMs` | 220 | 260 | 160 | 340 |
| `transitions.kinds` (dominante primero) | `['whip-pan','fade']` | `['slide','fade']` | `['light-leak','whip-pan']` | `['fade']` |
| `transitions.timing` | `spring` | `spring` | `spring` | `linear` |
| `audio.duckedGainDb` | −22 | −22 | −20 | −26 |

`audio.baseGainDb` = −12 en los cuatro (es el nivel de la música, no un eje editorial de RN-16);
`attackMs`/`releaseMs`/`holdMs` = 150/400/250 salvo `recipe` (100/300/180) y `educational`
(200/500/320).

**Racional de los ejes que el functional pide diferenciar:**

- `recipe` es el más agresivo en todo: corta silencios de 300 ms, tolera keeps de 200 ms, tapa hasta
  el 55 % del tiempo, transiciones cada 2 cortes de 160 ms. Es "la receta corta mucho y tapa mucho".
- `educational` es el opuesto: sólo corta silencios de 600 ms o más, exige keeps de 450 ms, tapa
  como mucho el 20 % y **en `pip`** — la cara del que habla nunca desaparece del cuadro. Es "deja
  respirar la cara", y `pip` está implementado y renderizable hoy (`broll-track.tsx`).
- `hardware` privilegia la foto de producto (`rolePriority` con `image` primero) y usa el zoom más
  marcado después de `recipe`.
- `software-demo` es el término medio, con `whip-pan` como transición dominante (el gesto de "y
  ahora mirá esto otro" de una demo).

### 3.3 Invariante duro: `punchIn.every >= 2`

`planPunchIns` emite un punch-in que **cubre el `keep` entero** (`startMs: keep.startMs`,
`endMs: keep.endMs`) y selecciona el keep cuando `(index + 1) % every === 0`. Con `every: 1`, **todos**
los keeps quedan cubiertos por un punch-in y RN-13 (no-solape B-roll↔punch-in) haría que el
planificador de B-roll rechace absolutamente todo: la densidad de B-roll colapsaría a cero sin que
nada avise.

Se impone en dos lugares: el tipo lo documenta y **un test lo assertea sobre los cuatro presets**
(`expect(preset.punchIn.every).toBeGreaterThanOrEqual(2)`). Es la clase de invariante que se rompe
en seis meses cuando alguien "hace un preset más dinámico".

### 3.4 Cómo se verifica CA-010 sin copiar los literales

`presets/preset-registry.spec.ts`, cuatro familias de aserciones, **ninguna compara contra un valor
absoluto copiado del código**:

1. **Distinción por eje (los 5 de RN-16 + el de D-15).** Para cada eje, una proyección y un
   `Set`:
   ```ts
   const AXES: readonly (readonly [string, (p: MontagePreset) => string])[] = [
     ['poda',        (p) => `${p.silence.minSilenceMs}/${p.silence.paddingMs}/${p.silence.minKeepMs}`],
     ['punch-in',    (p) => `${p.punchIn.every}/${p.punchIn.scales.join(',')}`],
     ['densidad',    (p) => String(p.broll.maxCoverageRatio)],
     ['transicion',  (p) => p.transitions.kinds[0]],
     ['rolePriority',(p) => p.broll.rolePriority.join('>')],
   ];
   // por cada eje: expect(new Set(ALL_PRESETS.map(project)).size).toBe(4)
   ```
   Excepto `rolePriority`, que tiene sólo dos valores posibles: ahí se assertea que hay exactamente
   dos presets de cada lado.
2. **Vocabulario (RN-16, quinto eje).** Cada preset tiene al menos un término de diccionario que
   **ningún otro** tiene, y ningún diccionario está vacío ni tiene duplicados tras `normalizeTerm`.
3. **Órdenes relativos** — la traducción literal de lo que dice el functional, sin números mágicos:
   ```
   recipe.silence.minSilenceMs      <  educational.silence.minSilenceMs
   recipe.broll.maxCoverageRatio    >  educational.broll.maxCoverageRatio
   recipe.punchIn.every             <  educational.punchIn.every
   recipe.transitions.every         <  educational.transitions.every
   ```
4. **Diferencia observable en el resultado, no sólo en los parámetros** (`auto-montage.spec.ts`): el
   **mismo** proyecto de fixture con el **mismo** `seed` bajo los cuatro presets produce cuatro
   `timeline.json` **pairwise distintos** en bytes, y la cobertura de B-roll medida sobre el
   resultado (`sum(overlay.endMs − overlay.startMs) / sum(keep duration)`) respeta
   `recipe > software-demo > educational`. Ésta es la aserción que le da sentido a CA-010: los
   presets no difieren en un literal, difieren en el video.

---

## 4. Keyword spotting (CA-008)

### 4.1 Normalización — `normalizeTerm`

```ts
export function normalizeTerm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
}
```

Idéntica a `normalizeWordText` de `group-words-for-captions.ts`. **Se reimplementa a propósito**:
`timeline-core` no la exporta desde su barrel, y exportarla sería tocar `PUBLIC_VALUE_EXPORTS` de
`schemas.spec.ts` para ganar cuatro líneas — un diff más caro que la duplicación (y D-4 ya fijó que
el diff en `timeline-core` se limita al anchor). Son cuatro líneas sin ramas; la duplicación se
documenta acá y en el fragmento de contexto.

### 4.2 Stopwords — `resolveStopwords`

```ts
export function resolveStopwords(language: string): { readonly language: string | null; readonly terms: ReadonlySet<string> };
```

Toma el subtag base (`language.split('-')[0]`), busca en `{ es: ES_STOPWORDS, en: EN_STOPWORDS }` y
devuelve `{ language: null, terms: new Set() }` si no hay lista (D-16). Las listas se guardan **ya
normalizadas** con `normalizeTerm` en tiempo de módulo, para que la comparación sea un `has` directo.

### 4.3 El algoritmo — `spotConcepts`

```ts
export interface ConceptOccurrence { readonly startMs: Ms; readonly endMs: Ms; readonly wordIndex: number; readonly wordCount: number; }
export interface Concept { readonly term: string; readonly source: 'dictionary' | 'frequency'; readonly occurrences: readonly ConceptOccurrence[]; }
export interface SpotConceptsResult { readonly concepts: readonly Concept[]; readonly stopwordLanguage: string | null; }

export function spotConcepts(transcription: Transcription, preset: MontagePreset): SpotConceptsResult;
```

Puro, sin I/O, sin modelos, sin red (CA-008). Pasos, en orden:

1. **Diccionario normalizado.** Cada entrada del `preset.concepts.dictionary` se normaliza a un
   array de tokens (`"machine learning"` → `['machine','learning']`). Las entradas se ordenan por
   **cantidad de tokens descendente, y a igual cantidad por texto normalizado ascendente** — así el
   barrido es greedy-longest-first y determinista.
2. **Barrido de frases (A-3).** Se recorre `transcription.words` de izquierda a derecha; en cada
   posición se prueba la primera entrada del diccionario que matchee tokens consecutivos. Un match
   **consume** sus palabras: esas posiciones no se vuelven a considerar ni para otra frase ni para el
   conteo de frecuencia. Rango de la ocurrencia: `[firstWord.startMs, lastWord.endMs]`,
   `wordCount = tokens.length`. Consumir garantiza que **las ocurrencias no se solapan entre sí**,
   que es lo que le permite al planificador de §5 barrer cronológicamente sin desempatar solapes.
   No hay inferencia de n-gramas: una frase es concepto **sólo** si está literal en el diccionario.
3. **Términos de una palabra.** Sobre las posiciones no consumidas: `term = normalizeTerm(word.text)`;
   se descarta si está vacío, si `term.length < preset.concepts.minTermLength` o si es stopword.
   Se acumulan las ocurrencias por término, en orden de aparición.
4. **Filtro de concepto (RN-08).** Un término sobrevive si está en el diccionario (`source:
   'dictionary'`, **una sola mención alcanza**) **o** si
   `occurrences.length >= preset.concepts.minFrequency` (`source: 'frequency'`).
5. **Orden de salida.** `concepts` ordenado por `term` **ascendente** (comparación de strings, sin
   locale); las `occurrences` de cada concepto por `startMs` ascendente. Nunca se devuelve el orden
   de iteración de un `Map`. Esto es lo que hace que dos corridas den el mismo conjunto **en el mismo
   orden** (segundo CA de HU-07).

**Casos degenerados:** `words: []` → `concepts: []`, sin ninguna rama especial. Palabras que
normalizan a `''` (puntuación suelta) se descartan en el paso 3.

---

## 5. Planificador de B-roll (CA-009)

### 5.1 Qué sabe de cada asset

Sólo lo que el catálogo tiene: `role` (`broll` | `image`), `asset.id` (= `path`, D-5), `asset.kind`,
`asset.durationMs`. La señal léxica es `assetTokens(asset.path, preset.concepts.minTermLength)`
(D-14). `role: 'aroll'` y `role: 'audio'` **nunca** son candidatos.

**Nota sobre `role` vs `kind`:** `cycle-01` (§4) decidió que un `MediaKind` sondeado que no coincide
con el rol de la carpeta **no** descarta el asset. Este ciclo decide qué hacer con eso: el
planificador usa `role` para la prioridad (D-15) y `asset.kind` para el cálculo de duración
(D-12 no capa las imágenes). Un `raw/broll/foto.mp4` que resultó ser `kind: 'image'` funciona: se
prioriza como B-roll y no se le aplica el cap de duración. Coherente en las dos dimensiones.

### 5.2 El índice — `buildBrollIndex`

```ts
export interface BrollCandidate {
  readonly assetId: string;
  readonly role: 'broll' | 'image';
  readonly kind: MediaKind;
  readonly durationMs: number;
  readonly tokens: ReadonlySet<string>;
}
export function buildBrollIndex(catalog: Catalog, preset: MontagePreset): readonly BrollCandidate[];
```

Recorre `catalog.assets`, filtra por rol, calcula tokens, **descarta los assets sin ningún token** y
devuelve el array ordenado por `assetId` ascendente. Este orden es el único que el resto del
planificador ve, así que el orden de `catalog.assets` (que ya viene ordenado, pero podría no venirlo
si el llamador arma el catálogo a mano) es irrelevante (D-13).

### 5.3 Elección de asset por concepto — el orden total (RN-15)

`selectBrollAsset(term, index, preset)` devuelve el primer candidato tal que `tokens.has(term)`,
según este orden **total** (nunca queda un empate):

1. **Prioridad de rol del preset** (D-15): índice en `preset.broll.rolePriority`.
2. **Especificidad**: menor `tokens.size` primero. `compilador.mp4` (1 token) le gana a
   `compilador-terminal-demo.mp4` (3): el archivo cuyo nombre es *sobre todo* ese término ilustra
   mejor el concepto.
3. **`assetId` ascendente**: único por construcción (D-5) ⇒ desempate final garantizado.

La misma función resuelve la competencia de RN-15 —"dos conceptos matchean el mismo asset"— de forma
implícita y sin estado: el conflicto no se resuelve eligiendo un concepto ganador sino en el barrido
cronológico de §5.4, donde el asset queda bloqueado por la **ventana de no-repetición** para el
segundo concepto. Es más simple que un ranking de conceptos, y es más fiel a RN-12: la regla que
gobierna la re-utilización de un asset es una sola, sin importar si el que lo pide es el mismo
concepto u otro (que es exactamente lo que pide CA-009, primer bullet). El concepto que pierde queda
sin asset, con el tratamiento de RN-14.

### 5.4 El barrido — `planBrollOverlays`

```ts
export type BrollRejectionReason =
  | 'no-candidate' | 'outside-keep' | 'punch-in-overlap'
  | 'repeat-window' | 'overlay-gap' | 'coverage-cap' | 'too-short';

export function planBrollOverlays(input: {
  readonly concepts: readonly Concept[];
  readonly index: readonly BrollCandidate[];
  readonly keeps: readonly KeepRange[];
  readonly punchIns: readonly PunchInPlan[];
  readonly preset: MontagePreset;
  readonly fps: Fps;
}): { readonly overlays: readonly BrollOverlayPlan[]; readonly rejections: readonly BrollRejection[] };
```

**Paso 1 — candidatos.** Por cada ocurrencia de cada concepto se resuelve el asset con §5.3. Sin
candidato → `rejections.push({ reason: 'no-candidate' })` y sigue (RN-14: no interrumpe nada).

**Paso 2 — orden del barrido.** Los candidatos se ordenan por `startMs` asc, y ante empate por
`source` (`dictionary` antes que `frequency`) y después por `term` asc. Las ocurrencias no se solapan
(§4.3 paso 2), así que el empate es teórico; el desempate está igual para que el orden sea total.

**Paso 3 — barrido cronológico.** Estado: `lastEndMsByAssetId: Map<string, Ms>`,
`lastOverlayEndMs: Ms`, `coveredMs: number`. Por cada candidato, en este orden de chequeos (el orden
importa: define qué `reason` reporta un candidato que viola varias reglas a la vez, y por lo tanto
qué assertea cada test):

| # | Regla | `reason` |
| --- | --- | --- |
| 1 | Duración objetivo: `d = clamp(preset.broll.targetDurationMs, minDurationMs, maxDurationMs)`, capada además por `assetCapMs` (D-12) para candidatos de video. Si `d < preset.broll.minDurationMs` → descarte. | `too-short` |
| 2 | `keep = findEnclosingKeep(keeps, startMs, startMs + d)`. Si no hay, se reintenta con el `keep` que contiene `startMs` clampeando `endMs = keep.endMs`; si la duración clampeada `< minDurationMs` o `startMs` no cae en ningún keep → descarte. | `outside-keep` |
| 3 | Solape con cualquier `punchIn` (`start < punch.endMs && punch.startMs < end`) → descarte (RN-13). | `punch-in-overlap` |
| 4 | `startMs − (lastEndMsByAssetId.get(assetId) ?? −∞) < preset.broll.noRepeatWindowMs` → descarte (RN-12). | `repeat-window` |
| 5 | `startMs − lastOverlayEndMs < preset.broll.minGapMs` → descarte. Dos overlays nunca se solapan ni se pegan. | `overlay-gap` |
| 6 | `(coveredMs + d) / totalKeepMs > preset.broll.maxCoverageRatio` → descarte (densidad del preset, RN-16). | `coverage-cap` |

Aceptado: se actualizan los tres acumuladores y se guarda el overlay. **Los `id` se asignan al final**
con `sequentialId('broll', i)` sobre la lista aceptada ya ordenada cronológicamente — así los ids son
`broll-0001`, `broll-0002`… contiguos, sin huecos por los rechazos.

**Salida:** `BrollOverlayPlan = { id, startMs, endMs, assetId, fit: preset.broll.fit, keepVoice: true }`.
`keepVoice: true` es deliberado: `buildTimeline` lo traduce a `muted: true` en el clip de B-roll, de
modo que la voz del A-roll (que vive en la pista `voice`) sigue sonando debajo. Un B-roll con audio
propio pisando la locución sería un bug editorial, no una opción.

**Tests de rama (uno por `reason`, más los positivos):** son siete aserciones de una línea cada una
gracias a D-19, sobre fixtures mínimos armados para disparar exactamente esa regla.

---

## 6. Orden de composición

```
catálogo + transcripción (cycle-01)
   │
   ├─ 0. resolveMontageInputs   → A-roll (D-10), transcripción, música opcional, formato
   ├─ 1. pruneSilences(pruneDurationMs, detectSilencesFromWords(t, {minSilenceMs}), {paddingMs, minKeepMs})
   │        → keeps[], cuts[]        ← EJE CRUDO (D-11); pruneDurationMs con margen de un frame (D-12)
   ├─ 2. planPunchIns(keeps, { seed, every, scales, anchor })
   │        → punchIns[]             ← única fuente de azar (D-13)
   ├─ 3. spotConcepts(transcription, preset)
   │        → concepts[]             ← timestamps CRUDOS, sin remapear
   ├─ 4. planBrollOverlays({ concepts, index, keeps, punchIns, preset, fps })
   │        → overlays[], rejections[]
   ├─ 5. groupWordsForCaptions(words, {...preset.captions, emphasisKeywords: términos de concepto})
   │        → captionGroups[]  → filtrado/clampeado contra keeps (D-11)
   ├─ 6. planDucking(voiceRanges, musicMix, fps).decisions → clampeado contra keeps
   │        → duckDecisions[]
   ├─ 7. planTransitions(keeps, preset)
   │        → transitions[]
   ├─ 8. buildEditDecisionList(...) → assertValidEditDecisionList → EditDecisionList
   ├─ 9. buildTimeline(edl, assets, music?) → assertValidTimeline → Timeline
   └─ 10. writeEditDecisionList + writeTimeline (si options.persist !== false)
```

Notas obligatorias de cada paso donde hay una trampa:

**Paso 1 — silencios.** `detectSilencesFromWords` deriva los silencios de los **huecos entre
palabras**, así que una transcripción vacía o de una sola palabra produce cero silencios y el
resultado es un único `keep` de todo el A-roll (RN-17, dos de los tres casos degenerados salen por
el mismo camino). Si `pruneSilences` devuelve **cero keeps** (A-roll de duración menor a un frame)
→ `MontageInputError('empty-aroll')` **antes** de llamar a `buildTimeline` (D-20).

**Paso 2 — punch-ins.** `planPunchIns` cubre el keep entero, así que un keep con punch-in queda
vedado para el B-roll (RN-13). Es por diseño y por eso `every >= 2` (§3.3).

**Paso 3 — el remapeo que NO se hace.** Ver D-11. Los conceptos entran al EDL con sus ms crudos.

**Paso 5 — captions.** Dos trampas concretas:
1. `CaptionGroupWordSchema` es un `strictObject` de `{ text, startMs, endMs }`, mientras que
   `Word`/`TranscriptWord` traen `confidence?`. Pasar la palabra tal cual hace **fallar el parseo del
   EDL** por clave desconocida. Hay que mapear explícitamente:
   `words: group.words.map(({ text, startMs, endMs }) => ({ text, startMs, endMs }))`.
2. `extendedEndMs` puede estirar el grupo más allá del `keep`: se clampea o se descarta según D-11.
   `emphasisIndex` se recalcula con `pickEmphasisIndex(words, conceptTerms)` — los términos de
   concepto (diccionario primero) son los `emphasisKeywords`. Ése es el gancho que `spec-003` va a
   usar para el kinetic typography, y sale gratis acá.

**Paso 6 — ducking.** `voiceRanges` = los rangos de palabra, y `planDucking` ya los fusiona con
`holdMs`. Se reusa `planDucking(voiceRanges, musicMixDelPreset, fps).decisions` en vez de
reimplementar la fusión; después cada decisión se filtra/clampea contra los keeps y se re-numera con
`sequentialId('duck', i)`. Las decisiones `duck` se emiten **haya o no música**: si no hay asset de
`role: 'audio'`, `buildTimeline` recibe `music: undefined` y no genera automatización, pero el EDL
sigue registrando la intención (y es una rama menos que ramificar acá).

**Paso 7 — transiciones.** `TransitionDecisionSchema` exige que `atMs` coincida con el `startMs` de
un `keep` **posterior al primero** (lo valida el superRefine del EDL). Para `i >= 1` con
`i % preset.transitions.every === 0`:
`{ id: sequentialId('trans', n), atMs: keeps[i].startMs, durationMs, kind: kinds[n % kinds.length], timing }`.
`direction` se emite **sólo** para `slide` y `whip-pan` (para `fade` y `light-leak` no significa
nada), con el mismo ciclado determinista sobre `['from-left','from-right']`.
**Guard obligatorio:** `buildArollTrack` hace `cursorFrame -= msToFrames(durationMs, fps)`, así que
una transición más larga que el keep que la precede produce un `from` inválido y
`validateTimeline` devuelve `AROLL_OVERLAP` (hay un test en `timeline-core` que documenta que
`buildTimeline` **no** lanza en ese caso: lo deja pasar). Se descarta la transición si
`durationMs >= min(duración de keeps[i-1], duración de keeps[i])` o si
`msToFrames(durationMs, fps) < 1`.

---

## 7. El `EditDecisionList` que produce el ciclo

```ts
{
  schemaVersion: 1,
  sourceAssetId: arollAsset.id,              // = ruta relativa POSIX (D-5)
  format: defaultFormat(options.outputPreset ?? 'reels-9x16'),
  generatedBy: { tool: 'auto-montage', params: { preset: preset.name, seed } },
  decisions: [ ... ]
}
```

`generatedBy.params` lleva **exactamente dos claves**: `preset` y `seed`. Nada de versión de la lib
(cambiaría el archivo en cada release sin que cambie el montaje), nada de rutas absolutas, nada de
timestamps — D-6/D-7 se aplican a `edl.json` y `timeline.json` igual que al catálogo.

**Orden de `decisions[]` (normativo, por bytes):** agrupado por tipo en este orden fijo y, dentro de
cada grupo, por `startMs` ascendente (`atMs` para las transiciones):

```
keep → cut → punch-in → broll-overlay → transition → caption-group → duck
```

El validador ordena por su cuenta lo que necesita ordenar, así que el orden del array no afecta la
validez — pero sí los bytes, y por eso se fija acá y no se deja al orden de construcción. Los `id`
de cada grupo son los `sequentialId` que ya generan las funciones de `timeline-core`
(`keep-0001`, `cut-0001`, `punch-0001`, …) o los que asigna este ciclo con la misma helper, y son
únicos entre grupos por el prefijo.

**Persistencia (`work/edl.json` y `work/timeline.json`):**

```ts
export async function writeEditDecisionList(project, edl, deps): Promise<ProjectRelativePath>;
export async function writeTimeline(project, timeline, deps): Promise<ProjectRelativePath>;
```

Copian literalmente el patrón de `writeCatalog` de `cycle-01`: `Schema.parse` → `serializeMontageDocument`
→ `guardEnsureDirectory` + `guardWriteTextFile` → `toAbsolutePath(project, workPath('edl.json'))`.
Las rutas se construyen con `workPath(...)`, el constructor que **sólo puede producir rutas bajo
`work/`**, y los puertos van decorados con el guard de `raw/` — CA-006 se sostiene sin escribir una
sola línea nueva de defensa. Se agregan a `project-paths.ts` dos constructores al lado de
`catalogPath()`:

```ts
export function editDecisionListPath(): ProjectRelativePath { return workPath('edl.json'); }
export function timelinePath(): ProjectRelativePath { return workPath('timeline.json'); }
```

---

## 8. Puertos de I/O de este ciclo

| Puerto | Default | Quién lo usa |
| --- | --- | --- |
| `ReadTextFile` (de `media-local`) | `nodeReadTextFile` | `readCatalog`, lectura de `work/transcripts/<mirror>.json` |
| `WriteTextFile` | `nodeWriteTextFile` (decorado con `guardWriteTextFile`) | `writeEditDecisionList`, `writeTimeline` |
| `EnsureDirectory` | `nodeEnsureDirectory` (decorado con `guardEnsureDirectory`) | creación de `work/` |

```ts
export interface MontageDependencies {
  readonly readTextFile?: ReadTextFile;
  readonly writeTextFile?: WriteTextFile;
  readonly ensureDirectory?: EnsureDirectory;
}
```

**Los tres son opcionales y `deps` entero es opcional**: a diferencia de `IngestDependencies`, acá
**no hay `CommandRunner`** — esta etapa no invoca ni un binario. `autoMontage` resuelve los defaults
una sola vez al entrar y pasa los puertos ya resueltos hacia adentro, igual que `ingestProject`.
Tampoco hay `Clock`: no se lee la hora en ningún punto de este ciclo (D-7).

**Lectura de la transcripción y su degradación.** `resolveMontageInputs` busca en
`catalog.transcripts` el `TranscriptRef` del A-roll elegido, lee `ref.transcriptPath` y lo parsea
contra `TranscriptionSchema`. Tres resultados, reportados en
`AutoMontageResult.transcriptionSource`:

| Situación | `transcriptionSource` | Comportamiento |
| --- | --- | --- |
| Ref presente y archivo válido | `'catalog'` | Normal. |
| Sin `TranscriptRef` para ese asset | `'missing'` | Transcripción vacía (`words: []`, `segments: []`); el montaje sigue (RN-17). |
| Archivo ausente, ilegible o que no parsea | `'unreadable'` | Idem `missing`, y el dev lo ve en el resultado. |

No se lanza en ninguno de los tres: el A-roll sin transcripción es material legítimo (un plano sin
locución), y `work/transcripts/` es regenerable con `ingestProject`. Son tres ramas, tres tests.

---

## 9. Superficie pública (`src/index.ts`) — lo que se **agrega**

Mismo criterio de `cycle-01`: el barrel exporta lo que el consumidor (`tools/render-cli` de
`cycle-03`) necesita, ni un símbolo más; los specs importan por ruta relativa.

```ts
export { autoMontage } from './auto-montage';
export type { AutoMontageOptions, AutoMontageResult, MontageDependencies } from './auto-montage';

export { MONTAGE_PRESETS, resolveMontagePreset } from './presets/preset-registry';
export type { BrollRolePriority, MontagePreset, MontagePresetName } from './presets/montage-preset';

export type { Concept, ConceptOccurrence } from './concepts/concept';
export type { BrollOverlayPlan, BrollRejection, BrollRejectionReason } from './broll/plan-broll-overlays';

export { serializeMontageDocument } from './montage/serialize-montage-document';
export { writeEditDecisionList } from './montage/write-edit-decision-list';
export { writeTimeline } from './montage/write-timeline';

export { EditDecisionListInvalidError } from './errors/edit-decision-list-invalid-error';
export { MontageInputError } from './errors/montage-input-error';
export { TimelineInvalidError } from './errors/timeline-invalid-error';
export type { MontageInputReason } from './errors/montage-input-error';
```

**NO se exportan** (detalle de implementación): `spotConcepts`, `normalizeTerm`, `resolveStopwords`,
`assetTokens`, `buildBrollIndex`, `selectBrollAsset`, `planBrollOverlays`, `planTransitions`,
`planCaptionGroups`, `planDuckRanges`, `buildEditDecisionList`, `findEnclosingKeep`, los dos
`assertValid*` y todo `src/__fixtures__/`.

### Firma de la etapa

```ts
export interface AutoMontageOptions {
  readonly preset: MontagePresetName | MontagePreset;
  readonly seed: number;
  readonly outputPreset?: OutputPreset;      // default 'reels-9x16'
  readonly arollAssetId?: string;            // default: primer aroll por id asc (D-10)
  readonly musicAssetId?: string;            // default: primer role 'audio' por id asc, o ninguno
  readonly persist?: boolean;                // default true
}

export interface AutoMontageResult {
  readonly edl: EditDecisionList;
  readonly timeline: Timeline;
  readonly concepts: readonly Concept[];
  readonly brollOverlays: readonly BrollOverlayPlan[];
  readonly brollRejections: readonly BrollRejection[];
  readonly transcriptionSource: 'catalog' | 'missing' | 'unreadable';
  readonly stopwordLanguage: string | null;
  readonly editedDurationMs: number;
  readonly edlPath: ProjectRelativePath;
  readonly timelinePath: ProjectRelativePath;
}

export function autoMontage(
  project: MediaProject,
  options: AutoMontageOptions,
  deps?: MontageDependencies,
): Promise<AutoMontageResult>;
```

`preset` acepta el nombre **o** un `MontagePreset` completo: el nombre es lo que va a usar la CLI de
`cycle-03`, y el objeto es lo que hace que los tests de rama del planificador puedan construir un
preset extremo sin agregar un quinto preset al registro. `resolveMontagePreset` lanza
`MontageInputError('unknown-preset')` si el nombre no está en el registro.

---

## 10. Casos degenerados (RN-17 / CA-011)

| Caso | Camino | Resultado |
| --- | --- | --- |
| Sin assets en `broll/` ni `images/` | `buildBrollIndex` → `[]`; todo candidato cae en `no-candidate` | Timeline válida, `tracks.broll: []` |
| `Transcription` sin palabras | `detectSilencesFromWords` → `[]`; `spotConcepts` → `[]`; `groupWordsForCaptions([])` → `[]`; `planDucking([])` → `{automation:[], decisions:[]}` | Un solo `keep`, un solo clip de A-roll, sin captions ni duck |
| A-roll sin silencios detectables | Idem: `pruneSilences(d, [])` → un `keep` `[0, d]`, `cuts: []` | A-roll completo, sin cortes de poda |
| A-roll de duración menor a un frame | `pruneSilences` → `keeps: []` | `MontageInputError('empty-aroll')` **antes** de `buildTimeline` (D-20) |
| Sin asset de `role: 'audio'` | `music: undefined` en `buildTimeline` | `tracks.music: []`, `audioMix.automation: []`, decisiones `duck` igual presentes en el EDL |
| Todos los keeps con punch-in (preset mal configurado) | Todo candidato cae en `punch-in-overlap` | Timeline válida sin B-roll; el test de `every >= 2` (§3.3) impide que llegue a un preset shippeado |
| Conceptos sin asset que los matchee | `no-candidate`, uno por ocurrencia | El resto de los conceptos se planifica igual (RN-14) |

Ninguno lanza excepción no controlada, y los seis primeros tienen su fixture en
`src/__fixtures__/degenerate-project-fixtures.ts`.

---

## 11. Cobertura y diseño para testeabilidad

La lib cerró `cycle-01` en 85,25 % de branches contra un umbral de 85: hay 0,25 puntos de margen, así
que cada rama nueva sin test pone el `test` en rojo. Cómo está diseñado el ciclo para que eso no pase:

- **Toda la lógica de decisión es pura y exportada por módulo.** `spotConcepts`, `selectBrollAsset`,
  `planBrollOverlays`, `planTransitions`, `planCaptionGroups`, `findEnclosingKeep` y los dos
  `assertValid*` se testean **directo**, sin pasar por `autoMontage` ni por dobles de filesystem. Las
  ramas caras (los siete `reason` del planificador, los tres `transcriptionSource`, los tres modos de
  `resolveStopwords`, los seis `MontageInputReason`) son aserciones de una línea sobre un fixture
  mínimo.
- **Los rechazos son datos, no logs** (D-19): una rama = una entrada en `rejections` = una aserción.
- **Nada de opcionales silenciosos** (D-17): un preset sin un parámetro no compila, así que no hay
  ramas `?? default` que cubrir en el orquestador.
- **La regla del ciclo:** los tests de rama entran **en la misma task** que agrega la rama, no en una
  task de cobertura al final. La task de CA-012 (determinismo byte a byte) sí es propia, porque es
  una verificación de sistema, no de rama.

`vite.config.ts` no cambia: los `exclude` de cobertura (`src/index.ts`, `src/__fixtures__/**`,
`src/fs/node-*`, `src/smoke.ts`) siguen siendo los correctos; los módulos nuevos son todos puros o
I/O inyectado y **entran en la medición**.

---

## 12. Contratos de API (`sdd/api.json`)

**NO APLICA** en este ciclo — ver §0. `libs/auto-montage` no expone superficie HTTP; su contrato
público es el `src/index.ts` de §9.

## 13. Cambios en schema (`sdd/schema.json`)

**NO APLICA** en este ciclo — ver §0. No hay motor de base de datos. Los contratos persistidos son
`EditDecisionListSchema` y `TimelineSchema` de `timeline-core`, versionados por `schemaVersion: 1`
dentro de cada documento; el único cambio de contrato del ciclo es el campo opcional `anchor` de
`ClipTransformSchema` (D-4), que **no** sube `schemaVersion` porque es aditivo y opcional (misma
regla que fijó `cycle-01` §4 para el catálogo).

## 14. Componentes (`sdd/components.json`)

**NO APLICA** — ver §0. Este ciclo no crea UI. La única lib con componentes React del repo,
`composition-remotion`, no se toca acá; su cambio de una línea es handoff de `cycle-03` (§1.1).

---

## 15. Dependencias externas

- **npm nuevas: ninguna** (D-9, reafirmada en §1.13 con las cuatro tentaciones concretas y su
  descarte).
- **Binarios externos: ninguno.** Este ciclo no invoca `ffmpeg`, `ffprobe` ni `whisper-cli`: opera
  sobre lo que `ingestProject` dejó en `work/`. Es la primera etapa de la lib que corre entera sin
  binarios, y por eso `MontageDependencies` no tiene `CommandRunner` (§8).
- **Ninguna red, ninguna API paga, ningún modelo de lenguaje** (CA-008 / RN-10).
- **Archivos fuera de `libs/auto-montage` que este ciclo modifica** — la lista completa, y no hay más:
  1. `libs/timeline-core/src/schemas/timeline.schema.ts` (D-4, +2 líneas)
  2. `libs/timeline-core/src/timeline/build-timeline.ts` (D-4, +2 líneas efectivas)
  3. `libs/timeline-core/schemas/timeline.schema.json` (**regenerado**, no editado a mano)
  4. `libs/timeline-core/src/timeline/build-timeline.spec.ts` (dos tests nuevos)
  5. `sdd/context/libs/timeline-core/updates/2026-09-07-spec-e-burgos-002-cycle-02.md`
  6. `sdd/context/libs/auto-montage/updates/2026-09-07-spec-e-burgos-002-cycle-02.md`

  **No se toca ninguna config raíz** (`eslint.config.mjs`, `tsconfig.base.json`, `nx.json`) ni el
  `vite.config.ts` de ninguna lib.

---

## 16. Registro de consumo

La entrada `{"agent": "architect"}` de `cycle.json → metrics.usage.by_agent[]` la escribe el
orquestador con el `subagent_tokens` **exacto** de la notificación de este subagente
(`source: agent-usage-notification`, `approx: false`), no una estimación declarada desde acá.
`provider_model: claude/opus`, `effort: high`, declarados antes de diseñar. Motivo: el número exacto
sólo lo ve el padre, y este documento se escribió **en paralelo** con el `sdd-planner` — dos
escrituras concurrentes sobre `cycle.json` se pisan.
