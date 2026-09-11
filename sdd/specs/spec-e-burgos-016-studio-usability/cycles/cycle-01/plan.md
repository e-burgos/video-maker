# spec-e-burgos-016-studio-usability — cycle-01 · plan (lite)

> Módulo: studio-usability | Subproyectos: apps/render-api, apps/web, libs/media-local | Fecha: 2026-09-11
> Flow: **lite** — decisión del dev (prefijo `[LITE]`, perfil `solo`). Un solo actor con tres
> sombreros: escribe este plan, implementa task por task y cierra como reviewer. Sin fan-out.
> Objetivo: que el usuario **elija con criterio** en las dos pantallas donde hoy elige a ciegas —
> la voz (tres voces con etiqueta legible y demo audible, en vez de un id de archivo) y el rol de
> subida (cada opción con qué es y cómo impacta en el video final) —, con todo el copy nuevo
> centralizado en módulos que `cycle-02` pueda traducir.
> Fuera de alcance: el switch de idioma y la sección de guía (`cycle-02`), elegir voz por escena,
> administrar/descargar voces desde la app, cualquier cambio en el motor de montaje o de mezcla,
> y dependencias npm nuevas.

## Historias

- **US-016-001** — Como usuario del studio quiero ver cada voz con su nombre, idioma y calidad para
  elegirla sin leer nombres de archivo. CA: `GET /voices` devuelve las tres voces instaladas con
  `label`, `language {code, region}`, `quality`, `description` y `previewUrl`, todo derivado del
  `.onnx.json` del modelo (o de su nombre si falta), sin ningún dato que el modelo no documente.
- **US-016-002** — Como usuario quiero escuchar una demo de la voz antes de gastar una locución
  entera. CA: `GET /voices/:id/preview` devuelve un `audio/wav` reproducible de más de 2 s; la
  segunda llamada se sirve del caché; un id inexistente da `404 VOICE_NOT_FOUND` y un servicio sin
  Piper, `503 VOICE_MODEL_UNAVAILABLE`; la cola de jobs no se toca.
- **US-016-003** — Como usuario quiero elegir la voz desde tarjetas con botón de reproducción, no
  desde un `<select>`. CA: la página de voz muestra una tarjeta por voz con etiqueta, idioma/región,
  calidad y ▶ con estado de carga; la seleccionada queda marcada y es la que usa el job `voice`.
- **US-016-004** — Como usuario quiero entender cada opción de `Upload to` antes de subir material.
  CA: cada rol se ofrece con nombre legible y una línea de qué es y cómo impacta en el video final,
  ordenados por importancia (A-roll primero), con los obligatorios marcados y la ayuda contextual
  del matching de B-roll por nombre de archivo visible en pantalla.

## Tasks (detalle en tasks.json)

- **TASK-001** — `buildVoiceCatalog` de `libs/media-local` pasa a recibir, junto al nombre de cada
  `.onnx`, el contenido de su `.onnx.json`, y deriva `language`, `quality`, `label`, `description` y
  `previewUrl`; el puerto `listVoiceModels` del adaptador Node lee esos sidecars. `GET /voices`
  publica la forma nueva. Lo valida el spec de la lib (metadatos completos, sidecar ausente,
  sidecar corrupto) y el del handler, aserando `Object.keys(body).sort()` contra la interfaz.
- **TASK-002** — `GET /voices/:id/preview`: ruta nueva, config `PIPER_PREVIEW_CACHE_DIR`, síntesis
  de una frase fija con el puerto `synthesizeVoice` ya existente, caché en disco fuera de `media/`,
  `Cache-Control` y `audio/wav`, `404`/`503` tipados y exclusión por voz con `createKeyedSerializer`.
  Lo valida el spec del handler (cache miss, cache hit sin segunda síntesis, id desconocido, Piper
  ausente, dos pedidos simultáneos de la misma voz).
- **TASK-003** — `VoicePicker` nuevo en `apps/web`: una tarjeta por voz con `<audio>` propio, estado
  de carga y error, selección marcada; `VoiceTrigger` lo monta en lugar del `<select>` y sigue
  mandando el id al job. Los tipos y el guard de `parse-voice` aceptan la forma enriquecida.
- **TASK-004** — `src/api/asset-roles.ts`: etiqueta, descripción de impacto, orden y obligatoriedad
  de los seis roles en un solo módulo; `AssetUploader` lo consume y muestra la descripción del rol
  elegido más la ayuda del matching de B-roll. Se aplican de paso los textos de arranque del
  productor que dejó escritos `FIX-e-burgos-007-002`.
- **TASK-005** — `apps/web/e2e/voices-smoke.mjs`: `render-api` real en puerto propio con
  `RENDER_API_MEDIA_ROOT` temporal, `GET /voices` con las tres voces, ▶ en dos tarjetas midiendo
  `readyState` y `duration` en el navegador, segunda reproducción servida del caché por debajo del
  umbral, y las descripciones de rol visibles en la biblioteca. Capturas a `artifacts/`.

## Decisiones técnicas

- **D-1 — El enriquecimiento del catálogo es un cálculo puro y vive en `libs/media-local`**, no en
  la app: `apps/render-api` no tiene lógica de motor propia y ya delegaba ahí el escaneo. El puerto
  `listVoiceModels` sigue siendo el único que toca el filesystem. → `sdd/api.json`, `EP-019`
  `updated`.
- **D-2 — `label` y `description` se derivan enteramente de los metadatos del modelo**
  (`dataset`, `language.name_english`, `language.country_english`, `audio.quality`,
  `audio.sample_rate`): no hay mapa hardcodeado de nombres, así que una voz nueva se describe sola
  al copiarla al directorio. **No se publica género, edad ni carácter de la voz**: el `.onnx.json`
  de Piper no los documenta y el pedido prohíbe inventarlos.
- **D-3 — El preview es un recurso propio, no un campo del listado.** Embeber tres wavs de cuatro
  segundos en `GET /voices` convertiría en megabytes un payload que la página pide en cada carga;
  como recurso propio el navegador lo cachea y `<audio>` lo reproduce sin conversión. →
  `sdd/api.json`, endpoint nuevo `EP-026`.
- **D-4 — El preview corre fuera de la cola de jobs, con exclusión por voz.** La cola tiene
  concurrencia 1: un preview detrás de un render de diez minutos no es un preview. La exclusión usa
  `createKeyedSerializer` (el mismo primitivo del upload) para que dos clics simultáneos no
  sinteticen el mismo wav dos veces. Es el mismo fundamento por el que el turno del productor
  tampoco es un job.
- **D-5 — El caché vive fuera de `media/`** (`PIPER_PREVIEW_CACHE_DIR`, default en el tmp del SO):
  un wav de demo no es material de ningún proyecto, y `media/<slug>/` es lo que la CLI y el
  productor inventarían. Se invalida comparando el `mtimeMs` del `.onnx` contra el del wav cacheado.
- **D-6 — `previewUrl` se publica como path relativo al servicio** (`/voices/<id>/preview`), no como
  URL absoluta: `apps/web` la resuelve same-origin por el proxy `/api`, igual que `artifactUrl`, y
  el servicio nunca emite su propio host.
- **D-7 — El copy de los roles vive en `src/api/asset-roles.ts`**, con el precedente de
  `montage-presets.ts`: etiqueta, descripción, orden y obligatoriedad en un solo lugar, para que un
  rol nuevo rompa el tipo una sola vez y para que `cycle-02` traduzca **un** módulo en vez de seis
  componentes. → `sdd/components.json` (`AssetUploader` `updated`).
- **D-8 — Las tarjetas de voz son un componente propio (`VoicePicker`), no un cambio interno de
  `VoiceTrigger`**: elegir voz es reusable (la regeneración por escena ya la va a querer) y el
  trigger ya carga salud, catálogo y acción de creación. → `sdd/components.json` (componente nuevo).
