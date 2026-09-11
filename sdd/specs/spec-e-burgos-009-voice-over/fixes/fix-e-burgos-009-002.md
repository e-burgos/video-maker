# FIX-e-burgos-009-002 — La narración generada ignora los tiempos del guion y va adelantada respecto de la pantalla

| Campo         | Valor                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-009-002                                                                            |
| **Tipo**      | IMPROVEMENT                                                                                     |
| **Severidad** | medium                                                                                          |
| **Keyword**   | [IMPROVEMENT]                                                                                   |
| **Fecha**     | 2026-09-11                                                                                      |
| **Autor**     | e-burgos                                                                                        |
| **Estado**    | implemented                                                                                     |
| **Spec**      | spec-e-burgos-009-voice-over                                                                    |
| **Origen**    | Caso real `media/display-ads`: tutorial de una webapp, pantalla grabada 16:9 de 96,5 s sin audio. |

## Problema

El usuario entregó el guion como **tabla de escenas con tiempos** (`| 1 | 0:00–0:20 | Login… |`,
10 escenas hasta 1:37). El job `voice` de `FIX-e-burgos-009-001` sólo sabe encadenar: sintetiza las
10 frases seguidas y las separa con `gapMs` (900 ms) desde el segundo 0. Resultado: la frase de la
escena 2 ("Las campañas viven acá") suena a los ~7 s cuando en pantalla el módulo Campañas aparece
a los 20 s. **Toda la narración va adelantada** y el video termina cuando termina la voz (regla
`min(voz, A-roll)`), descartando la cola de la grabación.

No había forma de expresar "esta frase empieza en tal segundo": ni en el guion, ni en el body del
job, ni en el manifiesto.

## Solución

### 1. Guion con marcas de tiempo (job `voice`, `scriptText` / `scriptPath`)

Una línea del guion puede empezar con una marca:

- `[m:ss] frase` o `[mm:ss] frase` — instante de inicio.
- `[m:ss-m:ss] frase` — rango; el segundo valor es el fin de la ventana de esa frase. El separador
  acepta guion (`-`), en dash (`–`) y em dash (`—`), con o sin espacios.

Las marcas pueden mezclarse con líneas sin marca. **Sin ninguna marca, el comportamiento es el
actual, byte por byte** (concatenación con `gapMs`).

Con marcas, cada frase se sintetiza por separado y se **coloca en `voice.wav` empezando en su
tiempo**: el track se arma con `adelay` por segmento + `amix` sin normalización, así que el hueco
entre frases es silencio real. Las líneas **sin** marca se encadenan con `gapMs` a continuación de
la anterior.

### 2. Qué pasa cuando una frase no entra en su ventana

La ventana de una frase es `[startMs, límite)`, donde el límite es el mínimo entre el inicio de la
frase siguiente (si tiene marca) y el fin de su propio rango (si lo declaró). El motor aplica
**tres remedios en orden**, y registra el resultado por línea:

1. **Acortar la pausa.** La ventana reserva un colchón de `gapMs` antes de la frase siguiente. Si la
   frase no entra con el colchón pero sí sin él, se descarta el colchón y no se toca la síntesis.
2. **Acelerar la síntesis.** Si aún no entra, la línea se vuelve a sintetizar con
   `--length-scale` de Piper (`lengthScale = max(0.85, ventana / duración natural)`). El **límite es
   0,85 — un 15 % más rápido**: por debajo de eso la voz de Piper se vuelve metálica y se prefiere
   desplazar. El valor usado queda en `lines[].lengthScale`.
3. **Desplazar la siguiente.** Si ni así entra, la frase se emite completa, `lines[].overflowMs`
   guarda los milisegundos que sobraron y la línea siguiente arranca al final de ésta en vez de en
   su marca — visible porque `startMs !== requestedStartMs`.

`overflowMs` es el **remanente después de los tres remedios**: `0` significa que la frase entró.

### 3. `script-manifest.json`

`lines[]` gana cuatro campos, todos opcionales en el schema (un manifiesto v1 anterior se sigue
leyendo) y siempre escritos por el pipeline:

| Campo              | Significado                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `endMs`            | Fin de la frase dentro del track (`startMs + duración real`).        |
| `requestedStartMs` | El inicio que pedía la marca; `null` en una línea sin marca.         |
| `overflowMs`       | Milisegundos que no entraron en la ventana tras los tres remedios.   |
| `lengthScale`      | Escala de Piper usada (ausente o `1` = velocidad natural).           |

`voice.words.json` sigue saliendo de Whisper **sobre el wav final**, así que las palabras quedan
alineadas a los tiempos reales, silencios incluidos.

### 3 bis. El track cubre la ventana que el guion declaró

Si la última línea declara un rango (`[1:30-1:37]`) y la narración termina antes, `voice.wav` se
rellena con silencio hasta ese fin (`apad=whole_dur=`). Sin rango declarado, el track termina con la
última frase. Es lo que hace que un guion cronometrado produzca una pista que dura lo que el guion
dice que dura, y no lo que la síntesis tardó.

### 3 ter. Las marcas no llegan a las captions

`autoMontage` alinea las captions contra el guion (`scriptPath`/`scriptText`, spec-014). Con un
guion cronometrado ese texto trae los corchetes, y sin quitarlos la primera caption salía
literalmente `[0:00] Entramos a la plataforma…`. El guion se limpia con
`stripVoiceScriptTimeMarks` antes de alinear; para un guion sin marcas la función devuelve el mismo
texto.

### 4. Duración del montaje con guion cronometrado

En `montage` con `voice: script`, `autoMontage` decide la fuente de duración según el manifiesto:

- **Guion con marcas** → la duración es la del **A-roll completo**. La narración termina antes y el
  video sigue mudo hasta el final (con música, si hay). El clip de la pista `voice` se recorta a la
  duración del wav (`buildVoiceTrack` con `VoiceInput.durationMs`), porque un clip más largo que su
  asset es exactamente lo que `validateTimeline` rechaza con `CLIP_EXCEEDS_ASSET`.
- `truncatedMs` mide la **narración** que quedó afuera, no el relleno: con un manifiesto
  cronometrado se calcula contra el fin de la última línea (`narrationEndMs`), no contra la duración
  del wav. Un track de 97 s cuyo habla termina a los 93,4 s sobre un A-roll de 96,5 s reporta 0.
- **Guion sin marcas** → regla actual `min(voz, A-roll)` con `truncatedMs`.

## Decisión: el límite de aceleración es 15 % (`--length-scale` ≥ 0.85)

Medido sobre `es_AR-daniela-high`: hasta `0.85` la locución sigue sonando natural; a `0.8` ya
aparece el timbre comprimido y las consonantes se pegan. Como el remedio existe para salvar
desajustes de uno o dos segundos, un tope conservador es preferible a una frase acelerada que el
usuario va a rechazar. Por debajo del tope se desplaza la línea siguiente y se reporta, que es un
error visible y corregible desde el guion.

## Decisión: el hueco entre frases es silencio, no A-roll audible

El A-roll de este caso es mudo y en modo `script` su audio ya se ignora (FIX-e-burgos-007-002). Un
guion cronometrado deja huecos largos (hasta 12 s) que quedan en silencio salvo que el proyecto
tenga música. Se descartó rellenar con el audio del A-roll: sería un tercer bus con su propio
ducking, exactamente lo que aquel fix ya había descartado.

## Decisión: el manifiesto no cambia de `schemaVersion`

Los cuatro campos nuevos son opcionales y aditivos. Subir a `schemaVersion: 2` habría roto la
lectura de todo `script-manifest.json` ya escrito en disco (`z.literal(1)`) sin ganar nada: el
lector distingue guion cronometrado de guion encadenado preguntando si **alguna** línea trae
`requestedStartMs` no nulo (`voiceScriptManifestIsTimed`).

## Skill y system prompt del productor

Regla nueva, en `sdd/skills/video-producer/SKILL.md` §3/§6 y en la sección de reglas del prompt:
para pantallas grabadas y cualquier video donde la narración describe lo que se ve, **la narración
va sincronizada con la acción**.

- Si el usuario dio una tabla de escenas con tiempos, se respeta tal cual: el guion se escribe con
  marcas `[m:ss]`.
- Si no la dio, el productor **mira el video antes de escribir**: extrae frames cada 5–10 s con
  `ffmpeg -ss`, los lee con `Read`, arma una tabla escena → tiempo → frase y se la muestra al
  usuario antes de producir.
- **Nunca** reparte frases con pausas fijas sobre un video con acciones.

## Verificación sobre el caso real

`apps/web/e2e/timed-narration-captions-smoke.mjs` (committeado junto al fix) corre punta a punta
sobre una **copia temporal** de `media/display-ads` con una API propia en el puerto 4420, y es el
guion que produjo los frames de `fixes/artifacts/`. Cubre los criterios de este fix y los de
FIX-e-burgos-003-003.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada. No crea endpoints ni entidades: campos opcionales
en un documento que ya existía, un puerto nuevo dentro de la app y una regla de prompt. Perfil
`solo`, sin ciclo abierto sobre spec-009.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
