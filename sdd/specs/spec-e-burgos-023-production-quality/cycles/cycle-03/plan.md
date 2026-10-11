# spec-e-burgos-023-production-quality — cycle-03 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/media-local, libs/motion-graphics, libs/auto-montage,
> libs/timeline-core, libs/producer-tools, apps/render-api, apps/web | Fecha: 2026-10-11
> Objetivo: voz menos plana con dirección por frase y música que acompaña sin tapar (por tramos).
> Fuera de alcance: motores de voz nuevos (ElevenLabs/Chatterbox, decisión pendiente del dueño). Sin código de OpenMontage.

## Historias
- US-023-301 — Como dev quiero dirigir la voz por frase. CA: cada frase acepta `direction` opcional
  `{ intent?, pace: slow|normal|fast, energy: calm|neutral|lively, pauseAfterMs?, emphasis?: string[] }`; Piper la aplica
  (pace → lengthScale relativo ×1,12 / ×1 / ×0,92; energy → noise-scale/noise-w; pauseAfterMs → silencio añadido;
  emphasis queda registrada para motores que la soporten). Sin dirección el resultado es idéntico al actual
  (bytes iguales con el mismo motor). En material crudo la pausa y el ritmo respetan la ventana [m:ss] del guion
  (el control de desborde sigue mandando).
- US-023-302 — Como dev quiero que el productor la escriba. CA: el productor y el storyboard automático proponen
  dirección por frase (validada por schema); la web muestra la dirección de cada frase en la vista de voz y deja
  editarla; regenerar la voz la aplica.
- US-023-303 — Como dev quiero música por tramos. CA: `music.mode: 'bed' | 'segments'`; en `segments` la música suena
  plena en la intro, el cierre y los huecos sin voz ≥ 2 s, con fundidos de 0,6 s, y baja a un piso (-30 dB relativo,
  configurable) mientras se habla. `bed` (actual) sigue por defecto. Motion y material crudo.

## Tasks (detalle en tasks.json)
- TASK-001 — modelo de dirección y mapeo a Piper (media-local, motion-graphics, voz por líneas de render-api).
- TASK-002 — productor/storyboard automático + web.
- TASK-003 — música por tramos (motion y montaje).
- TASK-004 — verificación real con A/B y job review.

## Decisiones técnicas
- Mapeo de energía a `--vits-noise-scale` / `--vits-noise-scale-w` de sherpa-onnx (verificar flags reales del binario).
- La dirección viaja en script.json (motion) y en `work/voice/script-manifest.json` (material crudo); la timeline no cambia.

## Pendiente de documentar en contexto
- timeline-core: `VoiceDirectionSchema`/`voiceDirectionSynthesis` (voice/voice-direction.ts), `VoiceScriptDirectionsSchema`, `MusicMixSettings.mode`, `planSegmentedMusic`/`segmentedMusicMix`; `VoiceScriptLine.direction` en el manifiesto de voz por líneas.
- media-local: `synthesizeSpeech` acepta `noiseScale`/`noiseScaleW`/`trailingPauseMs` (+`ffmpegPath`) y `appendTrailingSilence`; la salida de sherpa/VITS no es determinista byte a byte, el invariante "sin dirección" se fija sobre la línea de comando.
- motion-graphics: dependencia nueva de `@video-maker/timeline-core` (alias en vite.config.ts); `buildSegmentedAutomation`; `scene.direction` en script/storyboard; `music.mode`/`music.floorDb`.
- render-api: `work/producer/voice-direction.json` (clave = nº de línea del guion), `GET|PUT /projects/:slug/voice/direction`, validación al escribirlo por `write_project_text`; params `musicMode`/`musicFloorDb` del job montage.
- web: `VoiceDirectionEditor` (ritmo/energía/pausa/énfasis, compartido por voz de material crudo y storyboard motion), `VoiceScriptSection` (dirección por línea, guardar y regenerar con `scriptPath` + `overwrite`), `useMotionStoryboardDraft` (edita `scenes[].direction` y `music.mode/floorDb`, PUT del storyboard completo y job `motion` fase `video`), `MusicModeFields` (selector bed/segments + piso en dB, también en `MontageTrigger` → `musicMode`/`musicFloorDb`); cliente: `getVoiceDirection`, `putVoiceDirection`, `putMotionStoryboard`.
