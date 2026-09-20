# FIX-e-burgos-009-004 — Los tiempos de palabra de un guion cronometrado salen estirados sobre los silencios

| Campo         | Valor                                                              |
| ------------- | ------------------------------------------------------------------ |
| **ID**        | FIX-e-burgos-009-004                                                |
| **Tipo**      | BUGFIX                                                              |
| **Severidad** | high                                                                |
| **Keyword**   | [BUGFIX]                                                            |
| **Fecha**     | 2026-09-20                                                          |
| **Autor**     | e-burgos                                                            |
| **Estado**    | implemented                                                         |
| **Spec**      | spec-e-burgos-009-voice-over                                        |
| **Origen**    | Caso real `media/display-ads`: tutorial 16:9 de 96,5 s con guion cronometrado de 10 frases. |

## Problema

`runVoiceScriptPipeline` arma `voice.wav` colocando cada frase en su marca y después transcribe
**el wav concatenado entero** en una sola pasada de whisper.cpp. Con `-ml 1`, whisper le atribuye
cada silencio al token anterior, así que la última palabra de cada frase "dura" hasta que empieza
la frase siguiente. Medido sobre el `work/voice/whisper/voice.json` del proyecto real:

| Palabra      | startMs | endMs  | Duración |
| ------------ | ------- | ------ | -------- |
| `Ent`        | 60      | 1580   | 1,5 s    |
| `ramos`      | 1580    | 4200   | 2,6 s    |
| `plataforma` | 5780    | 11 030 | 5,3 s    |
| `usuario.`   | 16 290  | 20 000 | 3,7 s    |

Es la misma causa que `FIX-e-burgos-003-002`, pero acá los silencios llegan a 18 s, así que el
error no es cosmético: las captions salen estiradas sobre huecos donde no suena nada. El productor
lo tapó reconstruyendo `voice.words.json` a mano (317 ms por palabra dentro de cada ventana).

Los insumos para hacerlo bien ya están en disco: cada frase tiene su wav corto
(`work/voice/sources/line-NN.wav`) y su ventana está en `script-manifest.json`
(`lines[].startMs` / `lines[].endMs`).

## Solución

1. **Una transcripción por frase.** El pipeline transcribe cada `line-NN.wav` por separado. Un wav
   de una sola frase no tiene silencios largos, así que los tiempos de whisper son fiables.
2. **Desplazamiento y clamp.** Las palabras de la línea `N` se desplazan por el `startMs` de su
   placement y se acotan a `[startMs, endMs]` de esa línea, donde `endMs = startMs + durationMs` es
   el **fin real del audio de la frase**, nunca el inicio de la frase siguiente. Una palabra que
   quedaría fuera de la ventana se recorta; si se queda sin duración, se descarta.
3. **Unión ordenada.** `voice.words.json` es la concatenación en orden de las diez transcripciones
   desplazadas; `segments` queda vacío porque los rangos de palabra ya no son globales. `voice.wav`
   se sigue armando concatenado/colocado como hasta ahora.
4. **Fallback documentado.** Si whisper falla en una frase (o no devuelve ninguna palabra dentro de
   la ventana), las palabras del **guion** de esa línea se reparten uniformemente dentro de su
   ventana. Nunca se reparten sobre el silencio que sigue.
5. **Trazabilidad.** Cada línea del manifiesto anota `wordsSource: 'whisper' | 'script'`.

### `wordsSource` en el manifiesto

Campo opcional y aditivo en `VoiceScriptLineSchema`, igual que los cuatro de `FIX-e-burgos-009-002`:
un `script-manifest.json` v1 anterior se sigue leyendo y `schemaVersion` no cambia.

## Decisión: el clamp usa el fin real del audio, no el inicio de la frase siguiente

Acotar a `[startMs, startMs + durationMs)` es lo que corta el defecto de raíz: aunque whisper se
equivoque dentro de la frase, ninguna palabra puede invadir el silencio. Acotar al inicio de la
frase siguiente habría dejado vivo exactamente el estiramiento que este fix elimina.

## Decisión: el modo encadenado (guion sin marcas) también transcribe por frase

Un guion sin marcas separa las frases con `gapMs` (900 ms por defecto), por debajo del umbral donde
whisper empieza a estirar, así que el resultado es equivalente; hacer una sola ruta evita mantener
dos. El costo es el mismo número de segundos de audio transcritos, repartido en más invocaciones.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada, con el defecto reproducido sobre un proyecto real.
No crea endpoints ni entidades: un campo opcional en un documento que ya existía y un cambio
interno del pipeline de voz. Perfil `solo`, sin ciclo abierto sobre spec-009.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
