# FIX-e-burgos-002-004 — La alineación al guion estira tokens sobre silencios enteros y las captions cruzan de frase

| Campo         | Valor                                                              |
| ------------- | ------------------------------------------------------------------ |
| **ID**        | FIX-e-burgos-002-004                                                |
| **Tipo**      | BUGFIX                                                              |
| **Severidad** | high                                                                |
| **Keyword**   | [BUGFIX]                                                            |
| **Fecha**     | 2026-09-20                                                          |
| **Autor**     | e-burgos                                                            |
| **Estado**    | implemented                                                         |
| **Spec**      | spec-e-burgos-002-auto-montage-pipeline                             |
| **Origen**    | Caso real `media/display-ads`, junto con `FIX-e-burgos-009-004`.    |

## Problema

Dos defectos que sólo se ven cuando la narración viene de un guion cronometrado con silencios largos:

1. **`spreadOver` sin tope.** `fillGap` reparte los tokens del guion que whisper omitió sobre
   **todo** el hueco vecino, y `replaceWhisperRun` extiende el fin del run hasta
   `first.startMs + scriptTokens.length`. Con un hueco de 18 s, cualquier desajuste (puntuación,
   "se pisan") estira palabras y captions por segundos.
2. **El agrupador no conoce las frases.** `groupWordsForCaptions` sólo corta por `maxWords`,
   `maxDurationMs`, `maxGapMs` y fin de oración. Un grupo puede arrancar en la frase `N` y terminar
   en la `N+1`: medido en el caso real, la caption `entre ellos. Primero el nombre y desde cuándo
   corre.` va de 31,12 s a 33,87 s, cruzando el límite entre la línea 3 (fin 31,75 s) y la línea 4
   (inicio 32,00 s).

## Solución

### 1. Los tokens insertados nunca se estiran

- `fillGap` reparte dentro de `min(hueco, 1500 ms)` **pegado al run anterior**: el texto queda
  donde corresponde y el silencio que sigue queda vacío.
- `replaceWhisperRun` usa el fin real del run que reemplaza (`last.endMs`) y no lo extiende.

### 2. Alineación línea por línea con manifiesto de voz

Cuando el proyecto tiene `work/voice/script-manifest.json` (modo `voice: script`) y el guion tiene
la misma cantidad de líneas que el manifiesto, `autoMontage` alinea **línea del guion ↔ línea del
manifiesto**: cada palabra se asigna a la ventana de su línea y se alinea sólo contra el texto de
esa línea. Cruzar frases se vuelve imposible por construcción. Si la cantidad de líneas no coincide
(el usuario pasó otro guion), se vuelve a la alineación global, ya con el tope de 1500 ms.
`stripVoiceScriptTimeMarks` se sigue aplicando antes de nada.

### 3. Captions que no cruzan de frase

- `groupWordsForCaptions` acepta `forcedBreaksMs`: un corte obligatorio entre dos palabras
  consecutivas cuando el instante del corte cae entre ellas.
- `planCaptionGroups` acepta las ventanas de línea del manifiesto: pasa los `startMs` como cortes
  obligatorios y acota el fin de cada grupo al fin de la ventana en la que empezó, de modo que
  `extendedEndMs` no pueda estirar la última caption de una frase sobre el silencio siguiente.

Vale para todos los estilos de caption: el corte es del agrupador, no del estilo.

## Decisión: 1500 ms de tope para lo insertado

Un token insertado no tiene tiempo propio; lo único honesto es ponerlo al lado del texto que sí lo
tiene. 1500 ms es el techo de una caption de subtítulo (`subtle-lower` agrupa hasta 4000 ms con
6–10 palabras) y a la vez el orden de magnitud de una frase corta hablada; por encima de eso lo que
se ve no es una caption tardía sino una palabra congelada en pantalla.

## Decisión: los cortes van al agrupador, no un agrupador por línea

Pasar `forcedBreaksMs` deja las reglas del estilo (`minWords`, `maxWords`, `minDurationMs`) actuando
sobre la secuencia completa, y no hay que re-secuenciar ids ni duplicar la lógica de
`extendedEndMs`. Agrupar por línea y concatenar habría dado el mismo corte y una segunda
implementación que mantener.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada, con el defecto reproducido sobre un proyecto real.
No crea contratos ni entidades: comportamiento interno de `alignTranscriptToScript`, una opción
opcional en `groupWordsForCaptions` y un argumento opcional en `planCaptionGroups`. Perfil `solo`,
sin ciclo abierto sobre spec-002.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
