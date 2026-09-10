# spec-e-burgos-009-voice-over cycle-02 — 2026-09-09 → 2026-09-10

## Estado
El Web Studio le pone **voz** al modo generativo y cierra la spec. `/projects/:slug/voice` es una
página propia (no un panel del storyboard: dos documentos con ciclos de vida distintos, uno se edita a
mano y el otro lo produce un job) que lista las voces de Piper instaladas (`EP-019`, con el default
marcado y el `503 VOICE_MODEL_UNAVAILABLE` distinguido de un catálogo vacío), dispara `EP-012`
`kind: 'voice'` con progreso `synthesize | transcribe | persist` **y contador por escena**, reproduce
cada pista por `EP-011` con su duración real medida por ffprobe contra la `estimatedDurationMs` del
storyboard, marca la escena cuya narración cambió (`stale` de `EP-020`) y la regenera sola
(`sceneIds` + `overwrite`, con la voz que esa pista ya usaba), y permite reemplazar cualquier escena
por una grabación propia — subiéndola con rol `voice` (`EP-006`) o eligiendo una toma ya presente en
`raw/voice/` — asociada con `EP-021`. El nav por proyecto quedó en `library · storyboard · voice ·
preview`. Suite: **63 archivos / 548 tests**, 98,98 % stmts · 95,88 % branch · 98,71 % funcs ·
99,29 % lines, piso 80 % y `coverage.include` sin recortar. Cero dependencias npm nuevas. Se saldaron
además los 4 warnings de lint que la app arrastraba de `spec-008` cycle-02.

## Estructura
- `src/api/render-api-types.ts`: `'voice'` en `ASSET_ROLES` y en `JOB_KINDS`, `voiceQueue` en
  `ServiceCapabilities`, **cuarta rama de la unión `Job`** (`VoiceJob`, `VOICE_STAGES`,
  `VoiceJobProgress` con `processedScenes`/`totalScenes`, `VoiceJobReport`) y los tipos del manifest
  (`VoiceTrack`, `VoiceManifest`, `VoiceSceneStatus`, `VoiceDocument`, `VoiceModel`,
  `VoiceListing`, `VoiceSceneWriteResult`). `parse-render-job.ts` suma `parseVoiceJob`, que
  **rechaza** los otros tres `kind`, y `showsSceneProgress`.
- `src/api/parse-voice.ts`: guards estructurales del manifest, del listado de voces y del resultado
  de `EP-021`. **Sin Zod**: el manifest no es un documento que la UI edite, así que no hace falta el
  schema y la página puede quedar liviana (los jobs ya se validaban así).
- `src/api/voice-capability.ts`: `voiceBlockers(health)` sobre `voiceQueue` **y los seis binarios**
  (`ffmpeg`, `ffprobe`, `whisperCli`, `whisperModel`, `piperCli`, `piperModel` — a diferencia del
  montaje, que sólo mira cuatro) y `voiceFailureExplanation(code)` para los 12 códigos del pipeline.
- Componentes nuevos: `VoiceTrigger` (COMP-035), `VoiceJobPanel` (036), `VoiceSceneCard` (037),
  `VoicePage` (038). `AssetUploader` (COMP-004) se extendió: `roles` para acotar los roles ofrecidos
  (con uno solo desaparece el selector), `fileInputLabel` para que varias instancias convivan en una
  página, ids derivados de `useId` y `onUploaded(entry)` devolviendo la entrada del catálogo — sin eso
  la tarjeta no puede encadenar `EP-006` con `EP-021` en un solo gesto.
- **La narración se sigue editando sólo en la página de storyboard**; la de voz la muestra en modo
  lectura y enlaza allá. Duplicar el editor obligaría a duplicar la barra de guardado y el `PUT`
  completo, con dos fuentes de verdad del mismo documento.
- `voice-page` es una ruta perezosa más (`app.tsx`). No arrastra Zod, pero el chunk inicial venía en
  470 kB contra el aviso de 500 kB de Vite. Medido tras el ciclo: inicial **474 kB**, `voice-page`
  20 kB, `storyboard-page` 33 kB, `project-preview-page` 364 kB, sin aviso de tamaño.
- `e2e/voice-smoke.mjs` sobre `smoke-helpers.mjs`, que ganó `VOICE_ENV_VARS` (las cuatro de media más
  `PIPER_PATH`/`PIPER_MODEL_PATH`), `piper` en el `pgrep` del gate de procesos y `freeMemoryRatio()`
  con un piso duro de 35 %.
- La deuda de lint se saldó **cambiando el código, nunca la config**: `omitKeys()` tipado en
  `storyboard-edit/storyboard-document.ts` en lugar del destructuring-para-omitir con variables
  `_prefijadas` que el flat config raíz (protegido por el hook `config-protection`) marca como no
  usadas.

## Dependencias
Ninguna nueva. Consume de `apps/render-api` el contrato de `cycle-01` **sin modificarlo**:
`EP-001` (`capabilities.voiceQueue` y los binarios `piperCli`/`piperModel`), `EP-006` (rol `voice`),
`EP-011`, `EP-012` (`kind: 'voice'` con `voice`, `sceneIds`, `overwrite`), `EP-014`, `EP-016`,
`EP-019`, `EP-020` y `EP-021`. `sdd/api.json` no se tocó.

## Qué sigue
- **El job de voz no se cancela desde la UI** (`EP-015` lo soporta y una corrida de cinco escenas dura
  ~22 s): misma laguna que el panel de storyboard, ningún CA la pide.
- **No hay vuelta atrás de una pista `uploaded` a una generada por escena**: el servicio no expone un
  `DELETE` de la pista, así que el único camino es regenerar todo con `overwrite: true`, que también
  pisa las otras tomas. Candidato a un endpoint nuevo en la próxima spec que toque `render-api`.
- **`durationMs` se muestra pero nadie lo consume todavía**: `buildTimelineFromStoryboard`
  (`spec-010`) tiene que leer el manifest y no la `estimatedDurationMs` del storyboard. En la corrida
  real las cinco escenas duraron **menos** de lo estimado (0,35 s a 2,02 s), así que armar la Timeline
  con la estimación desincroniza el video entero.
- **La página no ofrece elegir la voz por escena**: el selector es del proyecto. `EP-012` acepta
  `voice` + `sceneIds` juntos, así que la regeneración por escena ya podría exponer un selector propio.
- **`GET /voices` no distingue idioma ni calidad** más allá del id (limitación del backend anotada en
  `cycle-01`): con más de una voz instalada el selector va a mostrar ids crudos.
