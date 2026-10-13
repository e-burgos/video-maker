# Context Prompt — libs/media-local

> Entry point para agentes que trabajen sobre `libs/media-local`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

- **Tipo:** lib Node TypeScript (wrappers de binarios locales + mezcla/mastering de audio + voz)
- **Estado:** completa para su alcance, sin ciclo abierto, y en crecimiento activo vía ciclos de
  otras specs y fixes. Cubre wrappers de ffprobe/ffmpeg/whisper/sherpa-onnx (voz), la capa pura de mezcla
  (`src/mix/`) y su ejecución (`mixTimelineAudio`, `verifyMixLoudness`, `muxAudioIntoVideo`), síntesis
  de voz (`synthesizeSpeech`, dos rutas de armado de pista: concatenada y cronometrada) y el catálogo
  de voces con metadata derivada del `.onnx.json` de cada modelo.
- **Desde entonces:** sherpa-onnx en lugar de Piper, wrappers de ffmpeg del productor, normalización de loudness y
  mediciones para la revisión de renders (detalle en `constitution.md` §3–4).
- **Ciclos y fixes:** `cycle-02` de `spec-e-burgos-001` y `cycle-02` de `spec-e-burgos-004` cerraron
  el núcleo (wrappers + mezcla/mastering). Desde entonces: `spec-e-burgos-009-voice-over` `cycle-01`
  (binarios de voz, `synthesizeSpeech`, `buildVoiceCatalog`), `spec-e-burgos-014-production-quality`
  `cycle-01` (normalización de la cama musical antes de las ganancias del preset), `FIX-006-001`
  (canal alfa declarado en el probe de imágenes, usado por la regla de logo del productor en
  `apps/render-api`), `FIX-009-002` (`placeSpeechSegments` para guion cronometrado, `--length-scale`) y `spec-e-burgos-016-studio-usability` `cycle-01` (metadata de voces por `.onnx.json`).
- **Specs que la gobiernan:**
  - `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (sección "Wrappers locales (libs/media-local)")
  - `sdd/specs/spec-e-burgos-004-audio-mix-mastering/spec-e-burgos-004-audio-mix-mastering.spec.md`
    (capa de mezcla/mastering; contrato de API pública en `cycles/cycle-02/architect.md` §15)
  - `sdd/specs/spec-e-burgos-009-voice-over` (binarios y wrapper de voz)
  - `sdd/specs/spec-e-burgos-014-production-quality` (normalización de música, canal alfa de logo)
  - `sdd/specs/spec-e-burgos-016-studio-usability` (`cycle-01`: catálogo de voces enriquecido,
    consumido por `EP-019` de `apps/render-api`)
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test media-local`, `pnpm nx lint media-local`,
  `pnpm nx build media-local`; smoke manual (fuera de CI, requiere ffmpeg real):
  `pnpm nx smoke-audio media-local`
- **Consumidores:** `libs/auto-montage` (ingest: probe, loudness, transcripción), `apps/render-api`
  (activo: jobs `render`/`montage`/`voice`, catálogo de voces y preview), `tools/render-cli`.

## Qué sigue

- Regrabar las fixtures de `ffmpeg/` y `whisper/` en una máquina con los binarios instalados
  (`ffmpeg`, `ffprobe`, `whisper-cli`), manteniendo los mismos valores numéricos que arrastran los
  `toEqual` exactos de CA-018/CA-019/CA-020. El README (sección "Fixtures: procedencia y cómo
  regrabarlas") trae el comando exacto de cada una. Dos diferencias conocidas a verificar al
  regrabar: `loudnorm.stderr.txt` incluye el resumen legible que `print_format=json` no emite, y
  `ffprobe/image.json` declara `format_name: "jpeg_pipe"` cuando una corrida real sobre un `.jpg`
  suele reportar `image2` (el parser acepta ambos).
- **Deuda de test en `src/mix/`:** todos los fixtures usan clips con `from: 0` y `trimStartMs: 0`,
  así que `adelay` solo está verificado en el valor degenerado `0`. La implementación
  (`framesToMs(clip.from, fps)`) es correcta por inspección, pero falta un fixture con `from > 0`
  que pruebe numéricamente ese valor y los `st` absolutos de los `afade`.
  **Mantenimiento de paridad:** cualquier cambio en `gainDbToVolume` (`src/mix/gain-db-to-volume.ts`)
  tiene que replicarse en `libs/composition-remotion/src/helpers/audio-gain.ts` (y viceversa) o el
  master deja de sonar como el preview de Remotion — contrato en `cycle-01/architect.md` §7.2.
- `ExecaCommandRunner.run()` sigue siendo la única ruta de código sin test por diseño.
- `synthesizeSpeech` no expone `--noise-scale` ni `--speaker`: si hace falta control adicional o
  voces multi-speaker, son opciones nuevas del mismo wrapper.
- `concatSpeechSegments` sigue existiendo a propósito junto a `placeSpeechSegments`: no se unificó
  para que el camino sin marcas de tiempo no cambie ni un argumento de FFmpeg.
- El canal alfa del probe de imágenes (`hasAlpha`) mide lo **declarado**, no la transparencia
  efectiva: un PNG `rgba` con fondo blanco opaco pintado informa `hasAlpha: true` igual. Cualquier
  regla que dependa de esto (como la del logo en el productor de `apps/render-api`) necesita
  confirmación humana en el preview.
