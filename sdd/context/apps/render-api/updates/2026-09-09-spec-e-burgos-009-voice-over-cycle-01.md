# spec-e-burgos-009-voice-over cycle-01 — 2026-09-09

## Estado

Cuarto tipo de job en la misma cola: `kind: 'voice'` sintetiza una pista por escena desde
`work/storyboard.json` con Piper TTS local, la normaliza a 48 000 Hz mono `pcm_s16le` (lo que
espera `mixTimelineAudio`) y la transcribe con el mismo `whisper-cli` de la ingesta para dejar
palabras con timing. Parámetros: `voice` (id de `GET /voices`), `sceneIds` (regenerar sólo esas) y
`overwrite`. Etapas propias `synthesize | transcribe | persist`, monótonas, con contador por escena
y checkpoints de cancelación **entre** escenas: `manifest.json` se escribe una sola vez al final, así
que un job cancelado o fallado nunca deja el manifest a medias.

**La voz es el reloj del video**: `durationMs` de cada pista se mide con `ffprobe` y reemplaza a
`estimatedDurationMs`. En el smoke real la diferencia llegó a 1 958 ms en una escena.

Tres endpoints nuevos —`EP-019` `GET /voices`, `EP-020` `GET /projects/:slug/voice`, `EP-021`
`PUT /projects/:slug/voice/scenes/:sceneId`— y `EP-001`/`EP-003`/`EP-004`/`EP-006`/`EP-012` en
`updated`. `apps/web` no se tocó (`git diff --stat apps/web` vacío). `GET /health` reporta ahora
**seis** binarios (los dos de Piper entraron a `MEDIA_BINARY_NAMES`) y `capabilities.voiceQueue`;
`cycle` sigue en `3`. Cobertura 97,83 % stmts · 91,62 % branch (piso 80 %), 671 tests.

**Piper entra a `binaries` de `/health` y `claude` no** (D-1 del ciclo): el precedente lo fija
`whisperModel`, que ya vuelve `degraded` toda máquina sin el modelo. Consecuencia asumida: una
máquina sin Piper reporta `degraded`.

## Estructura

- `src/voice/`: `voice-paths.ts` (el entregable y las palabras en `work/voice/`, los intermedios en
  `sources/` y `whisper/`), `voice-format.ts` (48 000/1 para la mezcla, 16 000/1 para whisper),
  `voice-language.ts` (`es-AR` → `es` para el `-l` de whisper), `select-voice-scenes.ts` (selección,
  `409 VOICE_ALREADY_EXISTS` y el guard de ids de escena usables como nombre de archivo) y
  `voice-store.ts` (lectura estricta y escritura con `serializeMontageDocument`).
- `src/jobs/`: `run-voice-pipeline.ts`, `voice-job-params.ts`, `voice-job-progress.ts`,
  `voice-pipeline-observer.ts`. `render-job.ts` pasa de tres a **cuatro** miembros en la unión
  discriminada por `kind`.
- `src/errors/translate-voice-error.ts`: once códigos nuevos
  (`VOICE_MODEL_UNAVAILABLE` 503 · `VOICE_SYNTHESIS_FAILED` 500 · `VOICE_TRANSCRIPTION_FAILED` 500 ·
  `VOICE_NOT_FOUND` 404 · `VOICE_INVALID` 422 · `VOICE_ALREADY_EXISTS` 409 · `VOICE_SCENE_NOT_FOUND`
  404 · `VOICE_ID_INVALID` 422 · `VOICE_SCENE_IDS_INVALID` 422 · `VOICE_OVERWRITE_INVALID` 422 ·
  `VOICE_ASSET_NOT_FOUND` 404).
- Cinco puertos nuevos en `RenderApiDependencies`: `resolveVoiceBinaries`, `listVoiceModels`,
  `synthesizeVoice`, `extractVoiceAudio`, `transcribeVoice`. **Todos reciben paths ABSOLUTOS**
  (ver Qué sigue).
- `ASSET_ROLES` gana `voice` (`raw/voice/`): `countAssetsByRole` y la creación de proyecto (siete
  directorios, no seis) se actualizaron con el compilador exigiendo la exhaustividad.
- El directorio de voces vive **fuera de `mediaRoot`**, así que no se lee con
  `deps.storage.listDirectory` (tiraría `ASSET_PATH_INVALID`): tiene puerto propio.

## Dependencias

Ninguna dependencia npm nueva. Lo nuevo es el binario externo `piper`
(`python3 -m pip install --user piper-tts`, instalado **fuera del repo**) más su voz `.onnx`, los
dos por el mismo `CommandRunner` de `media-local` que ya usaban ffmpeg, whisper y claude.
Variables nuevas: `PIPER_PATH` y `PIPER_MODEL_PATH` (el modelo, como el de whisper, **sin** fallback
por `PATH`).

## Qué sigue

- `cycle-02` de esta spec: la UI en `apps/web` sobre este contrato (backend cerrado).
- **Todo path que cruza a un puerto de media va absoluto.** Pasar `projectRoot` como `cwd` alcanza
  para el binario pero **no** para el wrapper: `transcribeWithWhisperCpp` lee su JSON con
  `readTextFile`, que resuelve contra el cwd del proceso de la API. Costó una corrida completa del
  smoke con las cinco pistas ya sintetizadas.
- `PUT /projects/:slug/voice/scenes/:sceneId` es **síncrono** y corre ffmpeg y whisper inline: una
  toma larga retiene la conexión. Convertirlo en un quinto `kind` de job es decisión de otro ciclo.
- Una pista `uploaded` no se re-sintetiza nunca, ni con `overwrite: true`; para volver a la
  sintetizada hay que borrar esa entrada del manifest a mano. No hay endpoint de borrado.
- La cola sigue in-memory, concurrencia 1 y sin persistencia entre reinicios, ahora para cuatro
  tipos de job.
