# render-cli

CLI headless del motor de auto-montaje. Encadena `@video-maker/auto-montage` y
`@video-maker/composition-remotion/render` para ir de una carpeta de assets
(`media/<project-slug>/`) a un MP4 en `out/`. No contiene lógica de montaje propia.

## Invocación

```bash
pnpm nx run render-cli:cli -- ingest media/smoke-ingest
pnpm nx run render-cli:cli -- plan media/smoke-ingest --preset software-demo --seed 0
pnpm nx run render-cli:cli -- render media/smoke-ingest
pnpm nx run render-cli:cli -- run media/smoke-ingest --preset software-demo --seed 0
pnpm nx run render-cli:cli -- run media/demo-01 --preset hardware --script media/demo-01/work/producer/script.txt
pnpm nx run render-cli:cli -- plan media/demo-01 --preset hardware --no-logo

pnpm nx run render-cli:smoke        # invocación fija sobre media/smoke-ingest
```

`<project-root>` relativo se resuelve contra la raíz del workspace (los targets `cli` y `smoke`
corren sin `cwd`), no contra el directorio donde se invoca `pnpm`.

Presets disponibles: `software-demo`, `hardware`, `recipe`, `educational`. `--seed` es un entero
no negativo, default `0`.

`plan` y `run` aceptan además (spec-014):

- `--script <ruta>`: el guion que la voz lee. Alinea las captions contra él —reemplaza las palabras
  que Whisper oyó mal conservando sus tiempos, borra las que inventó y reparte las que omitió— y el
  reporte agrega `script-corrections: N` con el desglose `replaced/removed/inserted/dropped`. La
  ruta se resuelve igual que `<project-root>`, contra la raíz del workspace; si no se puede leer,
  el error es `STAGE_INPUT_MISSING` en la etapa `plan`.
- `--no-logo`: ignora `raw/logo/`. Por defecto, si el proyecto tiene un logo, entra en la Timeline
  en el margen inferior derecho. El reporte de `plan` siempre nombra el logo usado (`logo: none`
  cuando no hay).

`ingest` y `render` rechazan las cuatro opciones (`--preset`, `--seed`, `--script`, `--no-logo`).

## `render` entrega la mezcla masterizada (spec-015 cycle-01)

`render` no es un solo paso de Remotion: hace **los mismos cuatro** que el job `render` de
`apps/render-api`, y por eso los dos caminos entregan exactamente el mismo audio.

1. `renderTimeline(..., { audio: 'muted' })` → `work/renders/<slug>/video-muted.mp4`
2. `mixTimelineAudio` (grafo FFmpeg) → `work/renders/<slug>/master.wav`
3. `muxAudioIntoVideo` → `out/<slug>.mp4` (el nombre del entregable no cambió)
4. `verifyMixLoudness` sobre el entregable, con el resultado en el reporte

```
ok [render] out/demo-01.mp4
  format: 1080x1920@30
  frames: 778
  muted-video: work/renders/demo-01/video-muted.mp4
  master-audio: work/renders/demo-01/master.wav
  loudness: -14.19 LUFS / -2.52 dBTP (within tolerance)
```

Antes de este cambio el MP4 llevaba el audio que renderiza Remotion, **corrido +40 ms constantes**
respecto de la locución (medido sobre `media/demo-01`). Hoy el audio decodificado del entregable
de la CLI tiene el mismo `sha256` que el del job de la API. Evidencia y guion de medición:
`sdd/specs/spec-e-burgos-015-studio-producer/cycles/cycle-01/artifacts/`.

> `media-local` entra a la CLI por `import` **estático**. No lo cargues con `await import()` en
> ningún archivo nuevo: `@nx/enforce-module-boundaries` marca entonces la lib entera como
> lazy-loaded y rompe el lint de todos los archivos que la importan estáticamente. El único
> perezoso acá es `@video-maker/composition-remotion/render`.

## Regenerar el material de `media/smoke-ingest`

`media/smoke-ingest/` es material regenerable (no versionado — `media/` está gitignoreado).
`media/video-01` y `media/video-02` son del dev y nunca se tocan.

El A-roll (`raw/aroll/clip01.mp4`) tiene que producir al menos un `punch-in` real para que el
render ejercite el cableado de `anchor` (D-4). Un A-roll sin huecos de silencio ≥ 400 ms produce
0 punch-ins y el render no prueba nada. Se regenera con 6 frases separadas por 900 ms de silencio,
elegidas para que al menos dos términos del diccionario de `software-demo` aparezcan 3 veces o más:

```bash
# desde la raíz del repo. Requiere macOS (`say`) — con material propio del dev funciona igual.
mkdir -p /tmp/smoke-aroll && cd /tmp/smoke-aroll
i=1
for phrase in \
  "Abrimos la terminal y escribimos el primer comando." \
  "El comando de instalacion descarga las dependencias." \
  "Ahora corremos el script de deploy." \
  "El deploy publica la version en el servidor." \
  "Volvemos a la terminal y repetimos el comando." \
  "El deploy termina sin errores en la consola."
do
  say -o "phrase-$i.aiff" "$phrase"
  ffmpeg -y -loglevel error -i "phrase-$i.aiff" -ar 16000 -ac 1 "phrase-$i.wav"
  i=$((i + 1))
done
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=16000:cl=mono" -t 0.9 gap.wav
: > concat.txt
for n in 1 2 3 4 5 6; do
  echo "file 'phrase-$n.wav'" >> concat.txt
  [ "$n" != "6" ] && echo "file 'gap.wav'" >> concat.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -c copy voice.wav
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x224488:size=1280x720:rate=30" -i voice.wav \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -ac 1 -ar 16000 \
  <RUTA-DEL-REPO>/media/smoke-ingest/raw/aroll/clip01.mp4
```

**Si el A-roll se alarga, `raw/audio/music01.mp3` puede quedar corto.** `autoMontage` rechaza la
Timeline con `TIMELINE_INVALID` / `CLIP_EXCEEDS_ASSET` si la música no cubre la duración editada.
Con las 6 frases de arriba el editado ronda los 18 s; `music01.mp3` original medía 8 s. Se extiende
haciendo loop del propio clip, sin sintetizar nada nuevo:

```bash
ffmpeg -y -loglevel error -stream_loop 4 -i media/smoke-ingest/raw/audio/music01.mp3 -c copy /tmp/music01-loop.mp3
mv /tmp/music01-loop.mp3 media/smoke-ingest/raw/audio/music01.mp3
```

Ajustar `-stream_loop` si un A-roll futuro queda más largo que esto.

**Sin `cwd` en los targets `cli`/`smoke`, no hace falta `$(pwd)`** — a diferencia del README de
`auto-montage` (que sí lo necesita, porque su target `smoke` corre con `cwd` fijo): acá
`media/smoke-ingest` ya es relativo a la raíz del repo.

### Gate barato antes de renderizar

`ingest` y `plan` corren en segundos; el render tarda minutos. Verificar el `EditDecisionList`
**antes** de gastar un render evita descubrir ahí que el material no sirve:

```bash
pnpm nx run render-cli:cli -- ingest media/smoke-ingest
pnpm nx run render-cli:cli -- plan media/smoke-ingest --preset software-demo --seed 0

node -e "
const e = require('./media/smoke-ingest/work/edl.json');
const byType = {};
e.decisions.forEach((d) => { byType[d.type] = (byType[d.type] ?? 0) + 1; });
console.log(byType);
"
node -e "
const t = require('./media/smoke-ingest/work/timeline.json');
console.log('anchors', t.tracks.aroll.filter((c) => c.transform.anchor !== undefined).length);
"
```

`EditDecisionList.decisions` es un array plano discriminado por `type` (`keep` | `cut` |
`punch-in` | `transition` | `caption-group` | `duck`), no arrays separados `keeps`/`punchIns` —
contar por `type` es la forma correcta de leerlo. Bloqueante: `keep` ≥ 6, `punch-in` ≥ 1,
`anchors` ≥ 1. Si alguno da 0, regenerar el material y repetir — no avanzar al render.
