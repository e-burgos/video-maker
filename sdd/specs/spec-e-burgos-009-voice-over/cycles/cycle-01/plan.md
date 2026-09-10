# spec-e-burgos-009-voice-over — cycle-01 · plan (lite)

> Módulo: voice-over | Subproyectos: apps/render-api, libs/media-local, libs/timeline-core, libs/auto-montage | Fecha: 2026-09-09
> Objetivo: darle voz al storyboard desde el backend — rol `voice` para subir locución propia, Piper TTS
> como binario configurable, y un job `kind: 'voice'` que sintetiza una pista por escena, la transcribe
> con Whisper y deja `work/voice/` con manifest y palabras con timing.
> Fuera de alcance: toda UI (es `cycle-02`), reescribir la `Timeline` o el storyboard con la duración real
> (RF-5 se cumple publicando `durationMs` en el manifest; quien la consuma es `spec-010`), selección de
> música, catálogo de estilos de captions, y darle código propio a los nueve errores de lib que hoy caen
> al catch-all de montaje.

> Flow `lite` por decisión explícita del dev (todo el backlog en lite, `profile: solo`). El ciclo **sí**
> crea contratos que `apps/web` consumirá en `cycle-02`, así que `pnpm sdd:validate` va a emitir su aviso
> de "un ciclo que crea endpoints merece flow full". Es informativo y está aceptado por escrito acá: el
> único actor escribe el contrato en `sdd/api.json` con el mismo detalle campo a campo que un `architect.md`.

## Historias

- **US-09-001** — Como dev quiero subir mi propia locución al proyecto con el rol `voice` para que el
  motor la reconozca igual que el A-roll o la música. CA: `PUT /projects/:slug/assets/voice/<archivo>.wav`
  persiste en `raw/voice/`, el catálogo lo lista con `role: 'voice'`, y un `.mp4` con ese rol se ignora
  por `extension-role-mismatch` en vez de entrar como audio.
- **US-09-002** — Como dev quiero que Piper se configure por `.env` igual que Whisper para no tener que
  tocar código al cambiar de voz. CA: `PIPER_PATH` y `PIPER_MODEL_PATH` se resuelven con el contrato de
  `whisper-cli`/`ggml-model` (el modelo **sin** fallback por `PATH`), `GET /health` los reporta en
  `binaries` por nombre lógico y env var —nunca la ruta resuelta— y degrada el servicio si faltan.
- **US-09-003** — Como dev quiero ver qué voces tengo instaladas para elegir una antes de sintetizar.
  CA: `GET /voices` lista los `.onnx` del directorio del modelo configurado, marca cuál es el default, y
  devuelve `503 VOICE_MODEL_UNAVAILABLE` —no una lista vacía— cuando Piper no está configurado.
- **US-09-004** — Como dev quiero un job que convierta la narración del storyboard en una pista por escena
  para tener la voz del video sin grabar nada. CA: `POST /projects/:slug/jobs` con `kind: 'voice'` produce
  `work/voice/scene-NN.wav` con el texto de esa escena y de ninguna otra, progreso monótono por
  `synthesize | transcribe | persist` con contador de escenas, y cancelación cooperativa entre escenas.
- **US-09-005** — Como dev quiero regenerar una sola escena para no rehacer el video entero por un retoque.
  CA: `sceneIds: ['scene-02']` reescribe únicamente `scene-02` y deja intactos el resto de los `.wav`, sus
  `.words.json` y sus entradas del manifest; un id que no está en el storyboard es `404 VOICE_SCENE_NOT_FOUND`.
- **US-09-006** — Como dev quiero que la locución que grabé gane sobre la sintetizada, de forma explícita.
  CA: `PUT /projects/:slug/voice/scenes/:sceneId` asocia un archivo de `raw/voice/` a la escena, lo
  normaliza y lo transcribe igual que a una pista sintetizada, y su entrada queda con `source: 'uploaded'`;
  un job `voice` posterior **no** la pisa salvo `overwrite: true`.
- **US-09-007** — Como consumidor del pipeline quiero las palabras con timing de cada pista para alinear
  las captions con lo que se escucha. CA: cada escena deja un `work/voice/scene-NN.words.json` que valida
  contra `TranscriptionSchema` (el mismo formato que las transcripciones de ingesta), y el manifest
  publica por escena archivo, duración real medida con ffprobe, voz usada, hash de la narración y origen.

## Tasks (detalle en tasks.json)

- **TASK-001** — Piper en `libs/media-local`: `piperCli`/`piperModel` en `BinaryName` con sus env vars y el
  contrato de resolución de Whisper (modelo sin fallback por `PATH`), wrapper `synthesizeSpeech` sobre el
  `CommandRunner`, y `buildVoiceCatalog` puro que deriva la lista de voces de los nombres `.onnx`.
  Lo valida `resolve-binaries.spec.ts`, `synthesize-speech.spec.ts` y `build-voice-catalog.spec.ts`.
- **TASK-002** — Rol `voice` de punta a punta: `ASSET_ROLES` de `apps/render-api`, `AssetRole` +
  `ROLE_BY_DIRECTORY_NAME` + `EXPECTED_KIND_BY_ROLE` de `libs/auto-montage`, y `AssetRoleSchema` del
  catálogo. Lo valida `classify-entry.spec.ts` (directorio `voice` → rol, `.mp4` en `voice` → mismatch),
  `asset-path.spec.ts` y `catalog.schema.spec.ts`.
- **TASK-003** — Contrato `VoiceManifest` en `libs/timeline-core`: schema Zod estricto, `hashNarration`
  (FNV-1a hex, puro y determinista: detecta cambios de texto, no es un hash criptográfico) y los helpers
  de merge por escena. Lo valida `voice-manifest.schema.spec.ts` y `hash-narration.spec.ts`.
- **TASK-004** — Cuatro puertos nuevos en `RenderApiDependencies` (`synthesizeSpeech`, `extractVoiceAudio`,
  `transcribeVoice`, `listVoiceModelFiles`) más `resolveVoiceBinaries`, su adaptador de producción, los dos
  binarios en `MEDIA_BINARY_NAMES`, `capabilities.voiceQueue` en `/health` y `GET /voices` (EP-019).
  Lo valida `node-render-api-dependencies.spec.ts`, `health-handler.spec.ts` y `voices-handler.spec.ts`.
- **TASK-005** — Cuarto miembro de la unión discriminada de jobs: `kind: 'voice'` en `render-job.ts`,
  `voice-job-params.ts` (`voice`, `sceneIds`, `overwrite`), progreso por escena, observer de cancelación y
  despacho en la cola. Lo valida `render-job.spec.ts`, `voice-job-params.spec.ts`,
  `voice-job-progress.spec.ts` y `render-job-queue.spec.ts`.
- **TASK-006** — `runVoicePipeline`: resuelve el storyboard y las escenas a rehacer, sintetiza, normaliza,
  transcribe, mide con ffprobe y persiste el manifest; traduce los fallos a los códigos tipados nuevos y
  respeta la locución subida. Lo valida `run-voice-pipeline.spec.ts` y `translate-voice-error.spec.ts`.
- **TASK-007** — Store y endpoints del documento: `voice-store.ts`, `GET /projects/:slug/voice` (EP-020),
  `PUT /projects/:slug/voice/scenes/:sceneId` (EP-021) y el registro campo a campo en `sdd/api.json`.
  Lo valida `voice-store.spec.ts`, `voice-handler.spec.ts` y `handle-request.spec.ts`.
- **TASK-008** — Guion copiable en `apps/render-api/README.md` y smoke real con Piper y Whisper contra una
  copia temporal de `media/smoke-ingest`, con las salidas literales en `artifacts/`.

## Decisiones técnicas

- **D-1 · Piper entra a `binaries` de `/health` y Claude no.** `claude` quedó fuera en spec-008 porque
  volvía `degraded` toda máquina sin Claude Code, CI incluido. Piper sí entra porque `whisperModel` ya
  fija ese precedente: sin `WHISPER_MODEL_PATH` el servicio ya reporta `degraded` hoy, y el modo
  generativo no puede prometer voz sin el binario. Registro afectado: `api.json` EP-001.
- **D-2 · `GET /voices` es un recurso propio, no un campo de `/health`.** `/health` se pollea y no puede
  pagar un `readdir` por llamada; además la lista cambia cuando el dev deja un `.onnx` nuevo en la carpeta.
  Registro afectado: `api.json` EP-019 (nuevo).
- **D-3 · El directorio de voces vive FUERA de `mediaRoot`,** así que no puede leerse con
  `deps.storage.listDirectory` (confina todo a la raíz de medios y tiraría `ASSET_PATH_INVALID`). Se
  resuelve con un puerto propio `listVoiceModelFiles` implementado en el adaptador de producción; la parte
  pura (filtrar `.onnx`, derivar el id, ordenar, marcar el default) vive en `media-local`.
- **D-4 · `VoiceManifest` vive en `libs/timeline-core`, no en la app** — misma regla que hizo vivir ahí a
  `StoryboardDocument`: `spec-010` produce la `Timeline` desde storyboard + voz dentro de las libs, y
  `spec-012` lee las palabras para las captions. La app sólo transporta y traduce errores.
- **D-5 · Tres wav por escena, no uno.** Piper entrega 22 050 Hz mono; el mix espera
  `AUDIO_MIX_SAMPLE_RATE` (48 000) y whisper.cpp exige 16 000. El entregable es
  `work/voice/scene-NN.wav` a 48 000 Hz mono `pcm_s16le`; la salida cruda de Piper queda en
  `work/voice/sources/` y el input de whisper en `work/voice/whisper/`. Conservar los intermedios es D-8
  del servicio, no una decisión nueva.
- **D-6 · La narración se le pasa a Piper por archivo, no por stdin.** `CommandOptions` del `CommandRunner`
  no tiene canal de entrada, y ensancharlo tocaría los cinco binarios que ya lo usan. Piper acepta
  `-i <archivo>`; medido antes de diseñar: tres oraciones en una línea salen como un único wav de 3,56 s.
  La narración se escribe en `work/voice/sources/scene-NN.txt` con los saltos de línea colapsados, porque
  Piper trata cada línea del archivo como una emisión separada.
- **D-7 · `hashNarration` no es criptográfico.** Su único trabajo es responder "¿cambió el texto desde que
  se sintetizó esta pista?". Un FNV-1a puro en `timeline-core` evita meter `node:crypto` en una lib pura y
  en la app (donde la constitución lo confina a `main.ts` y al adaptador de producción).
- **D-8 · Nueve códigos tipados nuevos** (`VOICE_MODEL_UNAVAILABLE` 503, `VOICE_SYNTHESIS_FAILED` 500,
  `VOICE_TRANSCRIPTION_FAILED` 500, `VOICE_MANIFEST_INVALID` 422, `VOICE_NOT_FOUND` 404,
  `VOICE_SCENE_NOT_FOUND` 404, `VOICE_SCENE_IDS_INVALID` 422, `VOICE_OVERWRITE_INVALID` 422,
  `VOICE_ASSET_NOT_FOUND` 404) más `VOICE_ALREADY_EXISTS` 409 y la reutilización de `STORYBOARD_NOT_FOUND`.
  Cada uno tiene que poder dispararse: un guard sobre una condición imposible es código muerto.
  Registro afectado: `api.json` EP-001, EP-006, EP-012, EP-019, EP-020, EP-021.
