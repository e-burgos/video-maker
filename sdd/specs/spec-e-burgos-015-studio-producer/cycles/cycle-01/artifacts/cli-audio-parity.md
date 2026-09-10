# US-15-010 — `render-cli render` entrega la misma mezcla masterizada que la API

Medición real sobre `media/demo-01` (el proyecto del primer video entregado a un cliente),
2026-09-10. Guion: `measure-audio-offset.ts` de esta misma carpeta — decodifica cada pista a
PCM mono 48 kHz con `ffmpeg`, calcula la envolvente RMS en ventanas de **10 ms**, estandariza las
dos series y busca el **mejor lag** por correlación cruzada en ±500 ms.

## Cómo se corre

```bash
set -a && source .env && set +a
export SWC_NODE_PROJECT=tsconfig.base.json
node -r ./tools/render-cli/src/cli-register.cjs \
  sdd/specs/spec-e-burgos-015-studio-producer/cycles/cycle-01/artifacts/measure-audio-offset.ts \
  media/demo-01/work/producer/voice.wav <candidato.mp4> [candidato...]
```

## El oráculo reproduce el defecto reportado (antes de tocar nada)

| Candidato | `bestLagMs` | corr. en el mejor lag | corr. en 0 ms |
| --- | --- | --- | --- |
| `raw/aroll/clip01.mp4` (el A-roll, la referencia de que el guion mide bien) | **0** | 0,9998 | 0,9998 |
| `out/demo-01.mp4` **antes del fix** (audio de Remotion) | **+40** | 0,9740 | 0,6070 |
| `out/demo-01-api-mix.mp4` (job `render` de la API, mezcla FFmpeg) | **0** | 0,9625 | 0,9625 |

El guion es sensible al defecto que tiene que detectar: para el render viejo de la CLI la
correlación **cae de 0,974 a 0,607** al forzar el lag 0. No es un número que dé 0 ms por
construcción.

## Después del fix

```
ok [render] out/demo-01.mp4
  format: 1080x1920@30
  frames: 778
  muted-video: work/renders/demo-01/video-muted.mp4
  master-audio: work/renders/demo-01/master.wav
  loudness: -14.19 LUFS / -2.52 dBTP (within tolerance)
```

| Candidato | `bestLagMs` | corr. en el mejor lag | corr. en 0 ms |
| --- | --- | --- | --- |
| `out/demo-01.mp4` **después del fix** | **0** | 0,9625 | 0,9625 |
| copia guardada del MP4 anterior | +40 | 0,9740 | 0,6070 |
| `out/demo-01-api-mix.mp4` | 0 | 0,9625 | 0,9625 |

## Oráculo fuerte: el audio no es "parecido", es el mismo

`sha256` de la pista de audio decodificada a PCM mono 48 kHz
(`ffmpeg -i <mp4> -map 0:a:0 -ac 1 -ar 48000 -f s16le -`):

| Archivo | sha256 (24 primeros caracteres) |
| --- | --- |
| `out/demo-01.mp4` (CLI, con el fix) | `e1030289ca9798d3858041bb` |
| `out/demo-01-api-mix.mp4` (API) | `e1030289ca9798d3858041bb` |
| `out/demo-01.mp4` (CLI, antes del fix) | `795a854af9a745661ece5c96` |

Los dos caminos entregan **el mismo audio**, no dos audios que suenan igual. El entregable sigue
siendo `out/<slug>.mp4` con `nb_frames=778`, `r_frame_rate=30/1`, `1080x1920`, `h264` + `aac`
48 000 Hz.

## Qué cambió

`render-cli render` hacía un solo paso: `renderTimeline` con el audio que dibuja Remotion. Ahora
hace los **mismos cuatro** que `runRenderPipeline` de `apps/render-api`:

1. `renderTimeline(..., { audio: 'muted' })` → `work/renders/<slug>/video-muted.mp4`
2. `mixTimelineAudio` → `work/renders/<slug>/master.wav`
3. `muxAudioIntoVideo` → `out/<slug>.mp4`
4. `verifyMixLoudness` sobre el entregable, reportado en la salida de la CLI

Sin lib nueva: `tools/render-cli` tiene tags `scope:engine`/`type:tool`, que caen en el fallback
`{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }` de `eslint.config.mjs`, así que puede
depender de `media-local` (`type:util`) y de `composition-remotion` (`type:ui`) a la vez —
igual que `apps/render-api`. Una lib compartida sería justo lo que los `depConstraints` prohíben.

**Trampa encontrada:** `media-local` ya entraba a la CLI por `import` estático, así que agregar un
`await import('@video-maker/media-local')` para el mix rompió `@nx/enforce-module-boundaries` en
**ocho** archivos ("Static imports of lazy-loaded libraries are forbidden"), incluidos dos que la
task no tocó. Los tres wrappers nuevos usan el `import` estático que la CLI ya tenía;
`composition-remotion/render` sigue perezoso.
