# Smoke real — spec-e-burgos-009 cycle-02 (voice studio en `apps/web`)

> Corrida: 2026-09-10 · guion: `apps/web/e2e/voice-smoke.mjs` (commiteado junto a esta evidencia)
> Comando: `node apps/web/e2e/voice-smoke.mjs`
> Servicios reales: `apps/render-api` en 4398 contra un media root temporal, `apps/web` (Vite) en 4210
> con su proxy `/api`, Chrome vía Playwright de `~/.npm/_npx`, Piper y whisper-cli reales.
> `media/` del dev **no se escribió**: sólo se copió `media/smoke-ingest/raw/` a
> `/var/folders/.../voice-smoke-EplAgX`, borrado al terminar.

## Siembra (D-6 del plan): sin `claude -p`

El storyboard de entrada es el que produjo la corrida E2E de `spec-008` cycle-02
(`sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts/smoke-storyboard-from-web.json`,
5 escenas, `es-AR`, `9:16`). Se copia a `work/storyboard.json` del proyecto temporal. Ahorra ~70 s y
cuota de modelo, y aísla lo que este ciclo prueba.

## Gates de arranque (literal)

```
[0] memory gate
[assert] ok — no ffmpeg/whisper-cli/piper/chrome-headless process alive (found: none)
[0] free memory ratio: 48.0%
[assert] ok — at least 35% of the memory is free (measured 48.0%)
[env] filled from the root .env (names only, never values): FFMPEG_PATH, FFPROBE_PATH, WHISPER_CPP_PATH, PIPER_PATH, PIPER_MODEL_PATH
[assert] ok — the 6 media env vars are present in the environment (missing: none)
[assert] ok — the seeded storyboard has five scenes (got 5)
[2] render-api health: status=ok
[assert] ok — the service under test exposes capabilities.voiceQueue, so this is the build of cycle-01 and not a stale server
[2] piper binaries: [{"name":"piperCli","envVar":"PIPER_PATH","resolved":true},{"name":"piperModel","envVar":"PIPER_MODEL_PATH","resolved":true}]
[assert] ok — piperCli and piperModel resolve, so the studio can actually synthesize
```

El gate de memoria usa el porcentaje que informa `memory_pressure` ("System-wide memory free
percentage"), **no** su nivel de presión (lección de `lessons.md`) y **no** una cuenta propia sobre
`vm_stat`: esa cuenta ignora la memoria comprimida y daba 23,1 % con el sistema informando 47 %.

## 1 · Llegar a la voz y elegirla (US-09-008, US-09-012)

```
[assert] ok — the nav opened the voice route (http://localhost:4210/projects/smoke-ingest/voice)
[4] voice selector: selected=es_AR-daniela-high options=["es_AR-daniela-high (default)"]
[assert] ok — the selector marks which voice PIPER_MODEL_PATH points at
[assert] ok — Generate voice-over is enabled with Piper resolved
```

Captura: `voice-smoke-01-empty-state.png` (estado vacío accionable con el trigger en la misma pantalla).

## 2 · Generar la voz de todo el storyboard (US-09-008)

```
[assert] ok — the voice job was accepted with 202 (got 202)
[5] API stage: synthesize (1/5) → transcribe → persist
[assert] ok — the voice job succeeded (got succeeded: )
[5] voice-over finished in 22.2s; API stages: synthesize → transcribe → persist
[assert] ok — the UI showed at least one stage while the job was running
[assert] ok — the UI counted the scenes while synthesizing (scene 1 of 5 · 20% | scene 2 of 5 · 40% | scene 3 of 5 · 60% | scene 4 of 5 · 80%)
[assert] ok — the report carries one track per scene (got 5)
```

El contador por escena que la UI mostró en vivo es el de la pantalla, leído del DOM mientras el job
corría: no se reconstruye del reporte final.

## 3 · Escuchar cada pista y contrastar su duración (US-09-009)

Medido **en el navegador sobre el elemento `<audio>`**, nunca sobre el `src` ni la captura (un `src`
bien armado y un 404 se ven igual):

```
[6] player Voice track of scene-01: readyState=4 duration=2.984s
[6] player Voice track of scene-02: readyState=4 duration=5.654s
[6] player Voice track of scene-03: readyState=4 duration=5.48s
[6] player Voice track of scene-04: readyState=4 duration=5.828s
[6] player Voice track of scene-05: readyState=4 duration=3.529s
[assert] ok — there are five players on screen (got 5)
[6] duration row: real 2.98 s · estimated 5.00 s · −2.02 s vs the estimate
[6] duration row: real 5.65 s · estimated 6.00 s · −0.35 s vs the estimate
[6] duration row: real 5.48 s · estimated 6.50 s · −1.02 s vs the estimate
[6] duration row: real 5.83 s · estimated 7.00 s · −1.17 s vs the estimate
[6] duration row: real 3.53 s · estimated 4.50 s · −0.97 s vs the estimate
```

`readyState=4` en las cinco: el navegador bajó y decodificó el wav real por `EP-011`. **Las cinco
escenas duran menos de lo estimado** (entre 0,35 s y 2,02 s), que es exactamente por qué RF-5 pone al
audio como reloj del video. Captura: `voice-smoke-02-tracks.png`.

## 4 · Editar la narración y ver el `stale` (US-09-010)

```
[assert] ok — the narration edit was persisted with 200 (got 200)
[7] staleness on screen: [{"scene":"voice-scene-scene-01","stale":"false"},{"scene":"voice-scene-scene-02","stale":"true"},{"scene":"voice-scene-scene-03","stale":"false"},{"scene":"voice-scene-scene-04","stale":"false"},{"scene":"voice-scene-scene-05","stale":"false"}]
[assert] ok — exactly the edited scene is flagged, the other four are untouched
```

La edición se hizo en la página de storyboard (D-3: la narración no se duplica en la de voz) y el
`stale` apareció al volver a la de voz. Captura: `voice-smoke-03-stale.png`.

## 5 · Regenerar sólo esa escena (US-09-010)

```
[assert] ok — the partial job was accepted with 202 (got 202)
[8] regeneration body: {"kind":"voice","overwrite":true,"voice":"es_AR-daniela-high","sceneIds":["scene-02"]}
[assert] ok — the request asks for that scene and no other
[assert] ok — the partial job succeeded (got succeeded)
[8] wav hashes after regenerating scene-02: {"scene-01":"b689e08a","scene-02":"dcccf5f8","scene-03":"d97e0bd2","scene-04":"f9ead102","scene-05":"51e9491a"}
[assert] ok — scene-02 was rewritten (14fea4a9 → dcccf5f8)
[assert] ok — the other four wav files are byte-identical (scene-01, scene-03, scene-04, scene-05)
[8] scene-02 is no longer stale on screen
```

El oráculo es sensible por construcción: Piper mete ruido distinto por corrida, así que un sha256
**igual** prueba que el archivo no se reescribió. La UI pide la voz con la que esa pista ya estaba
sintetizada (`voice: es_AR-daniela-high`), no el default global. Captura: `voice-smoke-04-regenerated.png`.

## 6 · Usar una grabación propia (US-09-011)

```
[9] the take is a copy of scene-05.wav renamed my-take.wav (sha256 51e9491a)
[assert] ok — EP-021 accepted the take with 200 (got 200)
[9] attached track: {"sceneId":"scene-03","index":3,"source":"uploaded","path":"work/voice/scene-03.wav","wordsPath":"work/voice/scene-03.words.json","durationMs":3529,"sampleRate":48000,"voiceId":null,"narrationHash":"c6e3bc535915d5bc","updatedAt":"2026-09-10T03:17:24.436Z"}
[assert] ok — the stored track is source: uploaded (got uploaded)
[assert] ok — an uploaded track declares no Piper voice
[9] on screen: uploaded · my own recording
[assert] ok — work/voice/manifest.json records the take as uploaded
[assert] ok — the manifest entry of an uploaded take has no voiceId
[assert] ok — the other four tracks are still the synthesized ones
[9] wav hashes after attaching the take: {"scene-01":"b689e08a","scene-02":"dcccf5f8","scene-03":"51e9491a","scene-04":"f9ead102","scene-05":"51e9491a"}
[assert] ok — attaching a take left the other four wav files byte-identical (scene-01, scene-02, scene-04, scene-05)
```

Un solo gesto en la UI encadena `EP-006` (subida con rol `voice`) y `EP-021` (asociación). El sha256
de `scene-03.wav` pasó a ser el de la toma subida (`51e9491a`, igual al de `scene-05.wav` porque la
toma es su copia y ya venía en el formato de la mezcla), y `durationMs` bajó a la duración real de la
toma. Captura: `voice-smoke-05-uploaded.png`.

## Cierre

```
[done] spec-009 cycle-02 E2E complete: empty state → generate (22.2s, 5 tracks) → 5 players measured
       → narration edited → stale flagged → scene-02 regenerated alone → own take attached to scene-03
[cleanup] temp media root removed: /var/folders/.../voice-smoke-EplAgX
```

Artefactos de esta corrida: `smoke-voice-manifest-from-web.json` (manifest final en disco),
`smoke-storyboard-edited-from-web.json` (storyboard con la narración editada),
`smoke-voice-players.json` (medición de los cinco `<audio>` y los tres juegos de hashes) y las cinco
capturas.

## Observado y no defectuoso

- Tres `404` en la consola del navegador: dos de `/favicon.ico` (`index.html` no declara icono,
  conocido desde `spec-006`) y uno de `GET /projects/smoke-ingest/voice` antes de generar nada, que
  es el `VOICE_NOT_FOUND` con el que la página dibuja su estado vacío.
- El warning de deprecación de Vite (`ESM syntax in a file loaded as CommonJS`) lo emiten todos los
  proyectos del workspace; es transversal, no de esta app.
