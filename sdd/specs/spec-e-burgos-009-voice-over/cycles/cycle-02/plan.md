# spec-e-burgos-009-voice-over — cycle-02 · plan (lite)

> Módulo: voice-over | Subproyecto: apps/web | Fase: `voice-studio` | Fecha: 2026-09-09
> Objetivo: darle interfaz a la voz. El dev elige la voz, genera la locución de todas las escenas,
> escucha cada pista con su duración real, ve cuál quedó desactualizada tras editar la narración,
> regenera sólo esa, y sustituye cualquier escena por una grabación propia. Con esto la spec cierra:
> el modo generativo tiene voz de punta a punta desde el navegador.
> Fuera de alcance: consumir `durationMs` para armar la `Timeline` (es `spec-010`,
> `buildTimelineFromStoryboard`), cancelar el job de voz (`EP-015` lo soporta pero ningún CA lo pide,
> igual que el panel de storyboard), volver de una pista `uploaded` a una generada sin `overwrite`
> (falta un `DELETE` en el backend), control de velocidad o multi-speaker de Piper, y editar la
> narración desde la página de voz (esa edición ya vive en la página de storyboard y se reusa).

> **Flow `lite` por decisión explícita del dev** (todo el backlog en `lite`, `profile: solo`). Un solo
> actor con los tres sombreros: este `plan.md` reemplaza a `brief.yaml`, `functional.md`, `planner.md` y
> `architect.md`. El ciclo **no crea ningún contrato nuevo**: consume `EP-001`, `EP-006`, `EP-011`,
> `EP-012` (`kind: 'voice'`), `EP-014`, `EP-016`, `EP-019`, `EP-020` y `EP-021` tal como `cycle-01` los
> dejó registrados en `sdd/api.json`, sin modificarlos. Los gates de cierre no se recortan.

## Estado que hereda

`cycle-01` (`03441b6`) cerró el backend completo: rol `voice` en la subida, Piper como binario
configurable, job `kind: 'voice'` con etapas `synthesize | transcribe | persist` y contador por escena,
manifest en `work/voice/manifest.json` con la duración real medida por `ffprobe` y el hash de la
narración, y los tres endpoints nuevos. Smoke real: 5 escenas en 22 s.
`apps/web` viene de `spec-008` `cycle-02`: 57 archivos / 468 tests, 99,19 % stmts, y **4 warnings de
lint preexistentes** en `src/api/storyboard-edit/storyboard-document.ts`. Son de la app que este ciclo
toca, así que se saldan acá (TASK-001).

## Historias

- **US-09-008** — Como dev quiero elegir una voz y generar la locución de todo el storyboard desde el
  navegador, para no tener que armar un `POST` a mano. CA: la página de voz lista las voces de `EP-019`
  con el default marcado, el botón "Generate voice-over" crea el job `kind: 'voice'` con la voz elegida,
  el panel muestra las tres etapas con el contador de escenas mientras corre, y un `409
  VOICE_ALREADY_EXISTS` se resuelve con una confirmación explícita que reintenta con `overwrite: true`.
- **US-09-009** — Como dev quiero escuchar cada pista y ver cuánto dura de verdad, para saber si el
  video va a durar lo que planeé. CA: cada escena del manifest muestra un `<audio controls>` servido por
  `EP-011`, su `durationMs` real, la `estimatedDurationMs` que había propuesto el modelo y la diferencia
  entre las dos, más el origen de la pista (`generated` con su voz, o `uploaded`).
- **US-09-010** — Como dev quiero ver qué escena quedó desactualizada al retocar el guion y regenerar
  sólo esa, para no rehacer las otras cuatro. CA: la escena cuyo `stale` es `true` se marca en pantalla
  con el motivo escrito, y su botón "Regenerate this scene" crea un job con `sceneIds: [ese id]` y
  `overwrite: true`; al terminar, el manifest de las otras escenas queda intacto.
- **US-09-011** — Como dev quiero usar una grabación mía en una escena puntual, eligiéndola de las que
  ya subí o subiéndola en el momento. CA: cada escena ofrece subir un archivo con rol `voice`
  (`EP-006`) o elegir uno ya presente en `raw/voice/`, y asociarlo con `EP-021`; la escena pasa a
  mostrar `source: uploaded` sin voz de Piper y con la duración real de la toma.
- **US-09-012** — Como dev quiero que la app me diga por qué no puede generar voz en vez de fallar al
  apretar el botón. CA: `voiceBlockers(health)` deshabilita "Generate voice-over" con el motivo escrito
  cuando falta `capabilities.voiceQueue` o alguno de los seis binarios que el pipeline usa, el panel de
  salud lista `piperCli`/`piperModel` y `voiceQueue` junto a los demás, y cada código de error del
  servicio se traduce a una frase de usuario **junto** a su código, nunca en lugar de él.

## Decisiones

- **D-1 · Página propia `/projects/:slug/voice`, no un panel dentro del storyboard.** La página de
  storyboard ya monta el trigger, el panel del job, el editor de cabecera, la hoja de personajes, cinco
  editores de escena, la barra de guardado y la hoja de prompts. Meterle la voz la vuelve ilegible y
  acopla dos ciclos de vida distintos (el documento se edita; el manifest se produce). La ruta entra en
  el nav por proyecto del layout, que ya es el patrón: `library · storyboard · voice · preview`.
- **D-2 · La página de voz se monta perezosamente**, igual que `storyboard-page` y `project-preview-page`.
  No porque arrastre Zod —no lo usa: el manifest se valida con guards estructurales, como los jobs— sino
  porque el chunk inicial venía en 470 kB con el aviso de Vite a 500 kB. La medición de `vite build` se
  reporta en el cierre.
- **D-3 · La narración se sigue editando en la página de storyboard.** La página de voz muestra el texto
  de cada escena en modo lectura y enlaza a `../storyboard`. Duplicar el editor obligaría a duplicar
  también la barra de guardado y el `PUT` completo, con dos fuentes de verdad del mismo documento.
- **D-4 · El `Job` gana su cuarta rama, no un opcional.** `VoiceJob` con `VoiceJobProgress`
  (`processedScenes`/`totalScenes`) y `VoiceJobReport` propios, espejo de
  `apps/render-api/src/jobs/render-job.ts`; `parseVoiceJob` rechaza los otros tres `kind`. Los tres
  lugares que la constitución exige (union, parser, panel) se tocan juntos.
- **D-5 · `AssetUploader` acepta acotar los roles y devuelve la entrada subida.** La página de voz lo
  reusa fijado a `voice` y necesita el nombre del archivo para el `PUT` de `EP-021`; hoy el callback no
  devuelve nada. Se extiende con `roles?` y `onUploaded(entry)`, compatible con el uso existente de la
  biblioteca (una función de cero parámetros es asignable).
- **D-6 · El E2E se siembra con un `storyboard.json` real de una corrida anterior** y no llama a
  `claude -p`: se copia `raw/` de `media/smoke-ingest` y el documento de
  `spec-008/cycles/cycle-02/artifacts/smoke-storyboard-from-web.json` (mismo `storyboardId` que el
  manifest de `cycle-01`, así que es exactamente el documento sobre el que el backend ya sintetizó).
  Ahorra ~70 s y cuota de modelo, y aísla lo que este ciclo prueba. `media/` del dev nunca se escribe.
- **D-7 · Los 4 warnings de lint se saldan cambiando el código, nunca la config.** `eslint.config.mjs`
  está bajo el hook `config-protection` y además es la raíz del workspace: agregarle un
  `varsIgnorePattern` sería un cambio transversal para tapar un problema local. Se reemplaza el
  destructuring-para-omitir por un helper `omitKey`/`omitKeys` tipado.

## Tasks (detalle en tasks.json)

- **TASK-001** — La frontera: `'voice'` en `ASSET_ROLES` y en `JOB_KINDS`, `voiceQueue` en
  `ServiceCapabilities`, los tipos del manifest y del listado de voces, `parseVoiceJob` y los guards del
  documento de voz, los cuatro métodos del cliente (`listVoices`, `getVoice`, `createVoiceJob`,
  `attachVoiceTake`) y `voice-capability.ts`. Salda además los 4 warnings de `storyboard-document.ts`.
- **TASK-002** — `VoiceTrigger` y `VoiceJobPanel`: selector de voz con el default marcado, estado
  explícito cuando `EP-019` devuelve `503 VOICE_MODEL_UNAVAILABLE`, bloqueos escritos, confirmación de
  sobreescritura ante `409`, y el panel con las tres etapas y el contador `N/M` de escenas.
- **TASK-003** — `VoiceSceneCard`: reproductor de la pista por `EP-011`, duración real contra la
  estimada, marca de `stale` con su motivo, "Regenerate this scene" y las dos vías de "Use my recording"
  (subir con rol `voice` o elegir una toma ya subida). Incluye la extensión de `AssetUploader`.
- **TASK-004** — `VoicePage`, la ruta perezosa, la sección `voice` del nav del layout y la cobertura del
  panel de salud sobre `piperCli`/`piperModel`/`voiceQueue`.
- **TASK-005** — E2E `apps/web/e2e/voice-smoke.mjs` contra API real con Piper y Whisper, sembrado según
  D-6, más los helpers compartidos (`piper` en el gate de procesos y el gate de memoria libre ≥ 35 %).
  Capturas y guion literal en `cycles/cycle-02/artifacts/`.
- **TASK-006** — Cierre de la spec: `sdd/components.json`, README de `apps/web`, fragmento de contexto,
  fila de `sdd/context/constitution.md`, `sdd/global.json`, `sdd/specs/index.json` y `cycle.json`.

## Verificación

Por task: `pnpm nx run-many -t lint test build` en verde (los 8 proyectos, sin warnings desde TASK-001),
`pnpm sdd:validate` en verde y el `usage` de la task registrado. Cobertura de `apps/web` ≥ 80 % con
`coverage.include` sin recortar. El chunk inicial de `vite build` se lee en cada corrida de `build`: si
reaparece el aviso de 500 kB, es un defecto de este ciclo. El cierre exige además la corrida real del
E2E con su evidencia literal en `artifacts/`.
