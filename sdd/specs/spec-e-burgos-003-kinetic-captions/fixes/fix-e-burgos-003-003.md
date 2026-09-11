# FIX-e-burgos-003-003 — Un solo estilo de captions para todo: el cinético arruina un tutorial

| Campo         | Valor                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-003-003                                                                         |
| **Tipo**      | IMPROVEMENT                                                                                  |
| **Severidad** | medium                                                                                       |
| **Keyword**   | [IMPROVEMENT]                                                                                |
| **Fecha**     | 2026-09-11                                                                                   |
| **Autor**     | e-burgos                                                                                     |
| **Estado**    | implemented                                                                                  |
| **Spec**      | spec-e-burgos-003-kinetic-captions                                                            |
| **Origen**    | Caso real `media/display-ads`: tutorial de una webapp, 16:9, narración generada.              |

## Problema

`libs/composition-remotion` tiene cuatro presets tipográficos (`bold-impact`, `clean-sans`,
`outline-pop`, `subtle-lower`) pero **ninguno es elegible desde el producto**: `captionPreset` es
sólo una prop de `TimelineComposition` que nadie setea, así que todo render usa el default
`bold-impact` — 3 palabras centradas, mayúsculas, palabra enfatizada gigante con pop.

Sobre un tutorial de pantalla grabada eso tapa la interfaz que el video está explicando y compite
con la narración. Un tutorial quiere un subtítulo: caja inferior, frases completas, sin animación.
El agrupado tampoco acompañaba: `groupWordsForCaptions` está calibrado para 1–3 palabras.

## Solución

### 1. `timeline.captionStyle` (contrato de `timeline-core`)

```ts
captionStyle?: 'bold-impact' | 'clean-sans' | 'outline-pop' | 'subtle-lower' | 'off'
```

Opcional; **ausente = comportamiento actual** (`bold-impact`). Vive en la raíz del documento, se
regeneró el JSON Schema y `PUT /projects/:slug/timeline` lo acepta porque recibe el documento
completo. `TimelineComposition` resuelve `timeline.captionStyle ?? captionPreset` (la prop queda
como override del preview) y con `off` no renderiza la capa de captions.

Dos límites del schema se ensancharon para que quepa un subtítulo:

| Campo                                     | Antes | Ahora |
| ----------------------------------------- | ----- | ----- |
| `tracks.captions[].words`                 | 1–3   | 1–10  |
| `decisions[caption-group].words` (EDL)    | 1–3   | 1–10  |
| `decisions[caption-group].emphasisIndex`  | 0–2   | 0–9   |

### 2. Agrupado por estilo

`groupWordsForCaptions` gana `minWords` (default `1`). Con `minWords: 1` la condición de corte es
**el mismo OR de siempre** (`maxWords` · `maxDurationMs` · `maxGapMs` · fin de oración), sólo
reordenado: por eso el default no mueve un byte. Con `minWords > 1` el fin de oración deja de
cortar hasta alcanzar el mínimo; el corte por hueco, por cantidad y por duración sigue siendo duro,
así que una frase corta nunca se pega con la siguiente a través de un silencio.

`subtle-lower` usa el agrupado de subtítulo:

| Parámetro       | Valor  |
| --------------- | ------ |
| `minWords`      | 6      |
| `maxWords`      | 10     |
| `minDurationMs` | 2000   |
| `maxDurationMs` | 4000   |
| `maxGapMs`      | 900    |

Los otros cuatro estilos (`bold-impact`, `clean-sans`, `outline-pop`, `off`) no tienen override: se
agrupan con los parámetros del preset de montaje, como hoy.

El estilo tipográfico `subtle-lower` ya existía y ya cumple el resto de lo pedido: ancla inferior
(`anchor: 'bottom'`, `boxHeightRatio: 0.12`), animación `fade`, sin trazo ni sombra, pill de fondo,
y énfasis mínimo (`emphasisScale 1.05`, `activeScale 1.03`, `emphasisColor` a un paso del color
base). No se tocó ningún preset.

### 3. Default por preset de montaje

| Preset de montaje | `captionStyle` |
| ----------------- | -------------- |
| `educational`     | `subtle-lower` |
| `software-demo`   | `bold-impact`  |
| `hardware`        | `bold-impact`  |
| `recipe`          | `bold-impact`  |

`autoMontage` acepta `captionStyle` explícito y lo escribe en el timeline; sin él resuelve el
default de la tabla. El job `montage` lo acepta como `captionStyle` (422
`MONTAGE_CAPTION_STYLE_INVALID` para cualquier otro valor) y la CLI como `--caption-style`.

## Decisión: el estilo viaja en el documento, no en el render

`captionStyle` es una propiedad del timeline y no un flag del job `render` porque es una decisión
editorial: se decide al planificar, se persiste, se puede editar con `PUT /projects/:slug/timeline`
y se vuelve a renderizar sin replanificar. El render no gana ningún parámetro nuevo:
`inputProps` sigue siendo `{ timeline, audio? }` y la composición lee el estilo del documento.

## Decisión: el agrupado cambia en `timeline-core`, no en la composición

El agrupado define **qué palabras entran en cada clip del timeline**, y eso ya estaba decidido en
`groupWordsForCaptions` / `planCaptionGroups` antes del render. Moverlo a la composición habría
dejado dos fuentes de verdad (el timeline diciendo 3 palabras y la pantalla mostrando 8) y habría
roto la edición del documento desde la web. La composición sólo elige la tipografía.

## No-regresión

El oráculo es `media/smoke-ingest` con su default (`--preset software-demo --seed 0`): el
`video-muted.mp4` resultante tiene que ser **byte-idéntico** al del commit base `2034f21`. Se mide
renderizando contra un worktree del commit base. `timeline.json` sí cambia (gana
`captionStyle: "bold-impact"`), y por eso el oráculo es el MP4 y no el documento.

## Texto propuesto para la opción de estilo en la UI de preview (`apps/web`)

La UI llega en la próxima tanda; este fix no toca `apps/web`. Texto exacto para aplicar tal cual,
en el selector de la pantalla de preview del timeline:

```ts
// apps/web/src/i18n/messages-es.ts
captionStyleLabel: 'Estilo de subtítulos',
captionStyleHint: 'Cómo se ven las palabras sobre el video. Lo podés cambiar y volver a renderizar.',
captionStyleBoldImpact: 'Grandes y animados — reels y publicidad',
captionStyleCleanSans: 'Grandes y sobrios — sin mayúsculas',
captionStyleOutlinePop: 'Con contorno — fondos claros o con mucho detalle',
captionStyleSubtleLower: 'Subtítulo abajo — tutoriales y explicaciones',
captionStyleOff: 'Sin subtítulos',

// apps/web/src/i18n/messages-en.ts
captionStyleLabel: 'Caption style',
captionStyleHint: 'How the words look over the video. You can change it and render again.',
captionStyleBoldImpact: 'Big and animated — reels and ads',
captionStyleCleanSans: 'Big and plain — no uppercase',
captionStyleOutlinePop: 'Outlined — bright or busy backgrounds',
captionStyleSubtleLower: 'Subtitle at the bottom — tutorials and explainers',
captionStyleOff: 'No captions',
```

## Skill y system prompt del productor

Tutorial, explicación, manual o YouTube largo → `subtle-lower`. Reel, TikTok, Shorts o publicidad →
el cinético que corresponda al preset. El usuario lo puede pedir en lenguaje común
("subtítulos normales", "subtítulos comunes", "como Netflix" → `subtle-lower`; "captions grandes",
"letras que saltan" → `bold-impact`; "sin subtítulos" → `off`) y el productor traduce, sin
exponerle nunca el id del estilo.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada. No crea endpoints, módulos ni entidades: un campo
opcional en un documento existente, un flag opcional de CLI y un campo opcional en el body de
EP-012, todo sobre presets que ya estaban escritos. Perfil `solo`, sin ciclo abierto sobre spec-003.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
