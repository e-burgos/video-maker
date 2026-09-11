# spec-e-burgos-016-studio-usability cycle-01 — 2026-09-11

## Estado
El catálogo de voces deja de ser una lista de nombres de archivo. `EP-019` publica por voz
`language { code, region }` (BCP47), `quality` (`x_low|low|medium|high` o `null`), `label` legible,
`description` factual y `previewUrl`; todo derivado del `.onnx.json` del modelo, y del nombre del
archivo cuando el sidecar falta o está corrupto. **Nada se infiere que el modelo no documente**: ni
género, ni edad, ni carácter de la voz. `EP-026` `GET /voices/:voiceId/preview` es nuevo: sintetiza
con Piper una frase fija en español (~4 s, la misma para todas las voces porque lo que se compara es
el timbre), la cachea y la sirve como `audio/wav` con `Cache-Control: public, max-age=86400`.
`404 VOICE_NOT_FOUND` para un id fuera del catálogo, `503 VOICE_MODEL_UNAVAILABLE` sin Piper.
Medido contra Piper real: miss 1,3-1,7 s, hit 3-6 ms, wav de 172-193 kB y 2,9-6,0 s según la voz.
Suite: 77 archivos / 914 tests, 98,08 % stmts · 92,73 % branch (piso 80 %).

## Estructura
- `voice/voice-preview-url.ts`: `VOICE_PREVIEW_ROUTE_PATTERN` y `voicePreviewUrl(id)`. `routes.ts`
  **importa** el patrón, así que la URL publicada y la ruta registrada no pueden divergir; su spec lo
  verifica cruzando las dos.
- `voice/voice-preview.ts`: `buildVoicePreview(deps, id)` con la frase, el `VOICE_PREVIEW_REVISION`
  del nombre del archivo cacheado y la invalidación por `mtime` del `.onnx`.
- `http/handlers/voice-preview-handler.ts` sobre `runtime.voicePreviewSerializer`, un
  `createKeyedSerializer` nuevo en `RenderApiRuntime`: **la exclusión es por voz y el preview NO
  entra a la cola de jobs** (concurrencia 1; un preview detrás de un render de diez minutos no es un
  preview). Mismo fundamento por el que el turno del productor tampoco es un job.
- Puerto nuevo `voicePreviewCache: VoicePreviewCache` (`directory`, `ensureDirectory`, `stat`,
  `writeTextFile`, `openReadStream`). Es un puerto propio y no `deps.storage` porque **`storage` está
  confinado a `mediaRoot`** y el caché vive deliberadamente afuera.
- `config/voice-preview-config.ts`: `PIPER_PREVIEW_CACHE_DIR`, default
  `<tmp del SO>/video-maker-voice-previews`.
- `listVoiceModels` del adaptador Node ahora lee también el `.onnx.json` de cada modelo (JSON roto o
  ausente ⇒ `config: null`, nunca un fallo del listado) y se lo pasa a `buildVoiceCatalog`.

## Dependencias
Ninguna npm nueva. `@video-maker/media-local` cambió la firma de `buildVoiceCatalog` (recibe
`{ fileName, config }[]`) y exporta `describeVoiceModel`, `voiceModelConfigFileName`,
`VOICE_QUALITIES` y los tipos `VoiceLanguage`/`VoiceQuality`/`VoiceModelFile`. Ningún código de error
nuevo: `VOICE_NOT_FOUND`, `VOICE_MODEL_UNAVAILABLE` y `VOICE_SYNTHESIS_FAILED` ya existían.

## Qué sigue
- **El preview no se regenera al cambiar la frase**: la invalidación mira el `mtime` del modelo, no el
  código. Por eso el nombre del archivo lleva `VOICE_PREVIEW_REVISION`; **bumpearlo al tocar
  `VOICE_PREVIEW_PHRASE`** o el dev con caché caliente escucha la frase vieja.
- El caché no se poda nunca: son unos cientos de kB por voz en el tmp del SO, y el SO lo limpia.
- La frase es fija y en español. Una voz `en_US` la va a leer con fonética inglesa; cuando haya voces
  de otro idioma instaladas, la frase tendría que salir del `language.family` del modelo.
