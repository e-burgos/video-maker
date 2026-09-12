# FIX-e-burgos-003-004 — `subtle-lower` no es un subtítulo de película

| Campo         | Valor                                |
| ------------- | ------------------------------------ |
| **ID**        | FIX-e-burgos-003-004                 |
| **Tipo**      | IMPROVEMENT                          |
| **Severidad** | medium                               |
| **Keyword**   | [IMPROVEMENT]                        |
| **Fecha**     | 2026-09-11                           |
| **Autor**     | e-burgos                             |
| **Estado**    | implemented                          |
| **Spec**      | spec-e-burgos-003-kinetic-captions   |
| **Origen**    | Feedback del dev sobre el tutorial de `media/display-ads`: "quiero subtítulos normales, como en las películas". |

## Problema

`subtle-lower` es el estilo que FIX-003-003 asignó al preset `educational`, pero no es un subtítulo
clásico: serif (`Source Serif 4`), píldora oscura detrás de cada palabra, palabra de impacto en otro
color y otro peso, y escalado por palabra activa. Sobre un tutorial se lee como un karaoke sobrio,
no como un subtítulo de cine.

## Solución

- `subtle-lower` pasa a sans-serif (`Inter`/`system-ui`), blanco puro, `stroke` fino oscuro
  (0.045em `rgba(0, 0, 0, 0.9)`) + sombra suave, **sin píldora**, `textTransform: none`.
- Sin realce ni animación por palabra: `emphasisColor` y `activeColor` iguales a `color`,
  `emphasisScale` y `activeScale` en `1`, `emphasisFontWeight` igual a `fontWeight` (600).
  Con eso `captionWordStyle` devuelve `scale(1)` y el mismo color para las tres combinaciones de
  estado, y `fitCaptionFontSize` deja de reservar ancho por la palabra enfatizada.
- Animación `fade` corta (4 frames de entrada) en vez de los 12 anteriores; nunca `pop` ni `rise`.
- Caja inferior de **dos líneas**: `boxHeightRatio` 0.15, `lineHeightEm` 1.28,
  `minFontSizeRatio` 0.03 y `maxFontSizeRatio` 0.042 (tamaños de subtítulo, no de caption cinético),
  con `sidePaddingRatio` 0.2 — el subtítulo ocupa el 60 % central de la zona segura, que es lo que
  lo mantiene lejos del logo inferior derecho.

### Cambio de contrato: `CaptionPreset.maxLines`

`fitCaptionFontSize` medía siempre **una** línea, así que un preset de dos líneas se achicaba hasta
entrar en una sola. `CaptionPreset` gana `maxLines` y el ajuste reparte el ancho entre esas líneas y
limita la altura a `maxLines * lineHeightEm`. Los tres presets cinéticos declaran `maxLines: 1`: con
ese valor la fórmula es la anterior término a término, así que no mueven un byte.

`captionBoxStyle` además **aplica el `sidePaddingRatio` del preset como padding de la caja**. Ese es
el invariante que hace que el envolvimiento coincida con el ajuste: el tamaño se calculaba contra el
ancho con margen y el texto envolvía contra el ancho completo, así que la primera corrida dejó la
frase de diez palabras en **una sola línea que cruzaba todo el cuadro y pisaba el logo** (frame de
22 s de esa corrida). Con el padding aplicado, esa misma frase envuelve en dos líneas. El default es
`0`, así que los presets cinéticos siguen idénticos.

### Tests que cambian de contrato

- `caption-word-style.spec.ts` → `subtle-lower (único con píldora) devuelve backgroundColor/padding/borderRadius y no tiene stroke ni shadow`: **ya no vale**. Pasa a aserar que `subtle-lower` no
  devuelve `backgroundColor`/`padding`/`borderRadius`, que sí devuelve `WebkitTextStroke` y
  `textShadow`, y que el estilo de la palabra enfatizada o activa es idéntico al de una palabra
  normal. Ningún preset tiene píldora: el campo `pill` sigue en el tipo y su rama sigue cubierta por
  un preset de prueba.
- La tabla `emphasis+active compone a scale(...)` pierde la fila `['subtle-lower', 1.082]`, que se
  vuelve `scale(1)` y se asera en el test de "sin realce".
- Los invariantes por preset que exigían `emphasisFontWeight !== fontWeight`,
  `emphasisColor !== color`, `activeScale > 1` y `emphasisScale > 1` se acotan a los presets
  **cinéticos** (`EMPHASIS_PRESET_IDS`): son la definición de caption cinético, no de subtítulo.
  El invariante de que existe al menos un `pop`, un `rise` y un `fade` se mantiene.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada. No crea endpoints, módulos ni entidades: retoca un
preset existente y agrega un campo numérico a un tipo interno de `libs/composition-remotion`. Perfil
`solo`, sin ciclo abierto sobre spec-003.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
