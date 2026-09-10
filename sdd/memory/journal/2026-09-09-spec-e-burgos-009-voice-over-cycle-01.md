# spec-e-burgos-009-voice-over cycle-01 — 2026-09-09

## Qué pasó

El primer smoke real falló con `VOICE_TRANSCRIPTION_FAILED` en `scene-01`, con las **cinco pistas ya
sintetizadas**: 25 s de Piper tirados. Los 15 tests del pipeline estaban en verde.

La causa no fue la que la lección vigente del repo describe. `lessons.md` dice "pasar la raíz junto
al documento en todo puerto cuyo input lleve paths relativos (`projectRoot` + `runOptions.cwd`)", y
yo **hice exactamente eso**: los tres puertos de media reciben paths relativos y `projectRoot` como
`cwd`. El binario los resolvió bien —`whisper-cli` escribió su JSON dentro del proyecto, verificado a
mano—, pero `transcribeWithWhisperCpp` no termina cuando termina el binario: después lee el JSON con
`readTextFile`, que es I/O **del proceso de la API** y resuelve contra el cwd del proceso, o sea el
repo. El wrapper buscaba en `<repo>/work/voice/whisper/scene-01.json` un archivo que estaba en
`<proyecto>/work/voice/whisper/scene-01.json`.

`libs/auto-montage` ya lo había resuelto y yo no lo miré: `transcribe-assets.ts` pasa
`toAbsolutePath(project, whisperOutBase(mirror))`, absoluto, por esta razón exacta. El doble del
puerto en la suite no resuelve ningún path contra nada, así que el test que escribí **afirmaba los
paths relativos como correctos**: codificó mi suposición y la protegió.

Segundo hallazgo, barato: el puerto 4399 del guion de `spec-007` sigue ocupado por un `render-api`
vivo de otro ciclo. La sonda de `capabilities.voiceQueue` que la lección de `spec-008` dejó escrita
funcionó a la primera y me ahorró una corrida contra el binario equivocado.

## Lección

`cwd` alcanza para el binario, no para el wrapper: si la función que lo invoca también hace I/O
propio (leer su salida, escribir su entrada), todo path que cruza el puerto va **absoluto**. Y un
test cuyo oráculo es "el doble recibió este path" no prueba nada sobre la resolución: hay que
aserar la **forma** del path (absoluto, bajo la raíz del proyecto), que es lo único que el doble no
puede falsear.

## Costo evitable

Una corrida completa del smoke (~25 s de Piper sobre 5 escenas más el arranque del servidor) y una
bisección de diez minutos. Se evitaba con treinta segundos de lectura: antes de escribir un puerto
que envuelve un binario ya envuelto en otra lib, abrir el call site existente de esa lib y copiar la
forma de los argumentos. La regla general —"leer al productor real antes de fijar el contrato"— ya
está en `lessons.md` para campos de datos; vale igual para las firmas de los puertos.
