---
name: video-maker-material-contract
description: Contrato de entrada del Video Maker para proyectos EXTERNOS, en sus dos modos — A) material en crudo (grabaciones de pantalla, clips, fotos, logo, música, guion) para un montaje, y B) motion graphics (un brief con guion e imágenes descriptas; el Video Maker diseña, anima, pone voz y música solo) — qué archivos generar, cómo nombrarlos, con qué specs y cómo entregarlos para un video horizontal (YouTube 16:9) o vertical (Reels/TikTok/Shorts 9:16) sin retoques. Usar cuando otro repo (ej. display-ads) necesita "preparar el material para el Video Maker", exportar una grabación para el tutorial, o automatizar la entrega vía API/CLI. No cubre cómo producir el video en sí: eso es `video-producer`.
---

# Skill: video-maker-material-contract

Sos el **proveedor de material** de un video. Vivís en otro repositorio (`display-ads` u otro
producto) y tu entregable no es un MP4: es una carpeta `media/<slug>/raw/` con los archivos
exactos que el Video Maker necesita para producir el video solo. Todo lo que dice este documento
está verificado contra el código del motor: si un nombre, una extensión o un límite no aparecen
acá, el motor no lo acepta o lo ignora.

Este documento es **autocontenido**: podés copiar la carpeta `sdd/skills/video-maker-material-contract/`
a tu repo (`.claude/skills/`, `.github/skills/`, o donde tu agente lea skills) y usarlo sin nada
más del Video Maker. Prosa en español; nombres de archivo, claves y comandos en inglés/ASCII.

## 0. Primero: ¿material crudo o motion graphics?

| Si el video… | Modo | Entregás |
| --- | --- | --- |
| enseña un flujo real de la UI paso a paso (clics, formularios, estados que hay que ver tal cual) | **A — material crudo** (§1–§11) | una grabación (A-roll) + guion cronometrado + apoyo |
| presenta un producto, una función o un equipo, explica un concepto, instala hardware o es un reel promocional, y no necesita la pantalla real | **B — motion graphics** (§12) | un `brief.json` (guion + imágenes con descripción) |

Ante la duda: si alguien tiene que poder repetir lo que ve haciendo clic, es A; si alcanza con
entender la idea, es B. Un mismo tema puede tener los dos (una promo en B y el tutorial en A): son dos
proyectos.

## 0.1 Modo A — el modelo mental en 6 líneas

1. Un **proyecto** es una carpeta `media/<slug>/` (slug `^[a-z0-9]+(-[a-z0-9]+)*$`). Vos escribís
   solo en `raw/`; el motor escribe `work/` (intermedios) y `out/` (MP4 final).
2. Todo video nace de **un A-roll**: el video base que manda la duración, los cortes y los
   tiempos. Sin A-roll no hay video.
3. El **habla** sale del A-roll (si trae voz) o de un **guion** sintetizado con Piper (voz en off
   generada). De las palabras del habla salen los cortes, las captions y qué B-roll entra cuándo.
4. El **B-roll** (clips y fotos de apoyo) entra **solo por nombre de archivo**: `lentes.mp4` aparece
   cuando el habla dice "lentes". No hay semántica, no hay IA eligiendo.
5. El **formato** de salida (16:9 o 9:16) lo elige quien dispara el montaje; no se deduce del
   material. Cada formato es un render completo y un entregable distinto.
6. Música y logo son opcionales; si están en `raw/`, entran solos con defaults razonables.

## 1. Layout exacto de `media/<slug>/raw/`

| Rol (API) | Carpeta               | Cantidad   | Qué es                                                                                          |
| --------- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `aroll`   | `raw/aroll/`          | **1**      | El video base. Si hay varios, el motor toma el primero por orden alfabético de ruta (`raw/aroll/…`). Poné uno solo. |
| `broll`   | `raw/broll/`          | 0..n       | Clips de apoyo **sin voz**, nombrados por concepto (§3).                                        |
| `image`   | `raw/images/`         | 0..n       | Fotos de apoyo, nombradas por concepto (§3). Ojo: la carpeta es `images` (plural), el rol es `image`. |
| `audio`   | `raw/audio/`          | 0..1 usada | Cama musical. Con varias, entra la primera por orden alfabético.                                |
| `logo`    | `raw/logo/`           | 0..1 usada | Logo con **canal alfa** (§5). Con varias, entra la primera alfabética salvo que el productor elija. |
| `voice`   | `raw/voice/`          | 0..n       | Locución humana propia (wav/mp3). El motor **no la mezcla solo**: el productor la muxea sobre el A-roll o la usa en vez de Piper. Si tu video lleva voz humana, lo más simple es entregar el A-roll ya con esa voz. |

Reglas de nombre de archivo (las valida el upload por API y el ingest por CLI):

- Solo el nombre, sin subcarpetas (`raw/broll/dashboard.mp4` sí; `raw/broll/ui/dashboard.mp4` no).
- ASCII, minúsculas, sin espacios: `crear-campana.mp4`, no `Crear Campaña.mp4`. El motor
  normaliza tildes y ñ para el matching de conceptos (§3), pero el nombre viaja en URLs y rutas.
- Extensiones aceptadas por el ingest (todo lo demás queda en `catalog.ignored` y no existe para el
  motor):

| Tipo   | Extensiones                                    |
| ------ | ---------------------------------------------- |
| video  | `.mp4` `.mov` `.mkv` `.avi` `.webm`            |
| imagen | `.jpg` `.jpeg` `.png` `.webp` (**no** `.svg`)  |
| audio  | `.wav` `.mp3` `.m4a` `.aac` `.flac`            |

Todo lo que producís se mide con `ffprobe` en el ingest (`work/catalog.json`: `durationMs`, `fps`,
`width`, `height`, `rotation`, `hasAudio`, `videoCodec`). Un archivo que `ffprobe` no puede leer va a
`catalog.probeFailures` y el montaje sigue sin él: verificá cada archivo con `ffprobe` antes de
entregar.

## 2. Specs de cada archivo

### 2.1 Salida (para que sepas hacia dónde va tu material)

| Formato (`format`)                          | Plataforma                      | Resolución | fps | Safe zone (px que las captions y el logo evitan) |
| ------------------------------------------- | ------------------------------- | ---------- | --- | ------------------------------------------------- |
| `youtube-16x9`                              | YouTube, web, centro de ayuda   | 1920×1080  | 30  | 60 arriba/abajo/izq/der                           |
| `reels-9x16` · `tiktok-9x16` · `shorts-9x16` | Instagram, TikTok, YouTube Shorts | 1080×1920  | 30  | 220 arriba, 400 abajo, 60 izq, 140 der            |

Los tres `9x16` son idénticos hoy; elegí el de la red para dejar la intención registrada. **El
default del motor es `reels-9x16`**: una grabación de escritorio sin `format` explícito sale
vertical y recortada. Siempre pasá el formato (§6).

El video se renderiza a 30 fps y H.264 + AAC; tu A-roll puede venir a 25 o 60 fps, el motor
resamplea. La imagen del A-roll se ajusta con `cover` (llena el cuadro y **recorta** lo que sobra),
así que la orientación de tu A-roll tiene que coincidir con el formato que vas a pedir.

### 2.2 A-roll (`raw/aroll/<nombre>.mp4`) — obligatorio

| Atributo      | Para `youtube-16x9`                                   | Para `*-9x16`                                          |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Resolución    | 1920×1080 (o 16:9 ≥ 1280×720)                         | 1080×1920 (o 9:16 ≥ 720×1280)                          |
| Orientación   | apaisada, `rotation: 0`                               | vertical **por píxeles**, no por metadata de rotación  |
| Codec         | H.264 `yuv420p`, 25–60 fps constantes                 | igual                                                  |
| Audio         | Si el video lleva voz humana: pista AAC o PCM, mono o estéreo, con el habla clara. Si la voz la va a generar el motor: **sin pista de audio** (`-an`) o muda. | igual |
| Duración      | Tutorial: 60–180 s. El video final dura lo que dure el A-roll (modo guion cronometrado) o `min(voz, A-roll)`. | Reel: 20–60 s; la red corta a 60–90 s. |
| Contenido     | Lo que se explica. Si es pantalla grabada, cursor visible, zoom del SO al 100 %, sin notificaciones. | Encuadrá para vertical desde el origen (grabación de celular o pantalla vertical). **No** entregues una grabación 16:9 para un 9:16: `cover` recorta los lados y la UI queda ilegible. |

Comando de referencia para normalizar una grabación (16:9, muda, para narración generada):

```bash
ffmpeg -y -i captura-original.mov -an -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart raw/aroll/crear-campana.mp4
```

Para 9:16 cambiá `1920:1080` por `1080:1920`. Si la grabación trae voz que querés conservar, sacá
`-an` y agregá `-c:a aac -b:a 160k -ar 48000`.

**Caso especial — mismo tutorial en los dos formatos:** son **dos A-rolls distintos** en **dos
proyectos distintos** (`media/display-ads-tutorial-16x9/` y `media/display-ads-tutorial-9x16/`), o el
mismo proyecto replanificado con otro `format` sólo si el A-roll ya es vertical. No hay
"reencuadre inteligente".

### 2.3 B-roll (`raw/broll/<concepto>.mp4`) y fotos (`raw/images/<concepto>.jpg|png|webp`)

- Clips **sin pista de audio** (`-an`): si traen audio se ignora, pero pesan más.
- Duración de clip: 5–30 s. El motor usa ventanas de 0,9–6 s según el preset (§4); un clip más
  corto que el mínimo del preset no entra.
- Misma orientación que el A-roll. Se ajustan con `cover` (`software-demo`, `hardware`, `recipe`) o
  como picture-in-picture (`educational`).
- Fotos: cualquier resolución ≥ 1280 px en el lado largo; duración la decide el preset.
- Máximo recomendado ~150 MB por asset.

Comando de referencia:

```bash
ffmpeg -y -ss 00:00:12 -t 15 -i captura-original.mov -an -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p raw/broll/playlist.mp4
```

### 2.4 Música (`raw/audio/<nombre>.mp3|wav|m4a`)

- **Más larga que el video final**. Si el edit dura 96 s y la música 60 s, el montaje falla con
  `TIMELINE_INVALID` / `CLIP_EXCEEDS_ASSET`. Loopeala antes de entregar si hace falta:
  `ffmpeg -stream_loop 3 -i corta.mp3 -c copy raw/audio/music01.mp3`.
- Cualquier nivel: el motor la normaliza a −16 LUFS y le aplica el nivel del preset (§4).
- Sin voz ni letra en el idioma de la narración (compite con las captions).
- Licencia: si no es tuya, dejá los créditos en `work/credits.json` (§7) — el motor no lo genera.

### 2.5 Logo (`raw/logo/<nombre>.png`)

- **PNG con canal alfa** (`pix_fmt` `rgba`/`bgra`/`pal8`). Un PNG con fondo blanco (`rgb24`) se
  dibuja como un recuadro blanco sobre el video; no hay forma de quitarle el fondo en el render.
- Horizontal (ancho ≥ alto) funciona mejor que cuadrado: se dibuja al 18 % del ancho en 16:9 y al
  28 % en 9:16, con margen 3,5 %, en la esquina inferior derecha por default (`bottom-right`,
  `bottom-left`, `top-right`, `top-left` desde la web o la timeline).
- Mínimo 800 px de ancho. `svg` no se acepta.
- Un solo archivo en la carpeta; el productor prefiere el que tiene alfa y pregunta si hay dos.

Verificación: `ffprobe -v quiet -print_format json -show_streams raw/logo/logo.png | grep pix_fmt`.

### 2.6 Locución propia (`raw/voice/<nombre>.wav|mp3`) — opcional

WAV 48 kHz mono o MP3 ≥ 128 kbps, una sola pista continua, sin música. Si podés, en vez de
entregarla suelta **muxeala sobre el A-roll** (§2.2, audio del A-roll): así el pipeline estándar
(`voice: aroll`) la transcribe y corta solo, sin intervención del productor.

## 3. El guion (`work/producer/script.txt`) — cuando la voz la genera el motor

Es el archivo más importante después del A-roll: de él salen la voz (Piper), las captions, los
cortes y qué B-roll entra. Reglas:

- **Una frase por línea**, UTF-8, sin numeración, sin líneas vacías intermedias. Cada línea se
  sintetiza por separado; entre líneas hay 900 ms de silencio (`gapMs`), que son los puntos de corte.
- 8–12 frases cortas para 30–60 s; hasta ~20 para un tutorial de 2–3 min. Una idea por frase.
- Idioma de la voz: español (voces Piper instaladas: `es_AR-daniela-high` default,
  `es_ES-davefx-medium`, `es_MX-claude-high`; `GET /voices` lista las disponibles). Escribí en el
  registro de la voz (rioplatense para `es_AR`).
- Evitá nombres propios raros, siglas deletreadas y URLs: Whisper los transcribe mal y las captions
  salen dañadas. Si la marca es clave, escribila como se pronuncia ("Display Ads", no
  "DisplayAds.com.ar").
- Cerrá con un llamado a la acción corto.

### 3.1 Conceptos → B-roll (la única forma de que un clip de apoyo entre)

El motor cuenta las palabras del habla (normalizadas: minúsculas, sin tildes, ñ→n, sin signos) y
las que se repiten ≥ `minFrequency` veces con ≥ 4–5 letras y no son stopwords son **conceptos**.
El nombre de cada asset de `broll/` e `images/` se parte en **tokens** por guiones, guiones bajos,
espacios o puntos, cada token se normaliza igual, y los tokens puramente numéricos o más cortos que
el largo mínimo se descartan. Un asset es candidato para un concepto cuando **alguno de sus tokens
es exactamente** ese concepto; entre varios candidatos gana el de **menos tokens** (el nombre más
específico) y después el orden alfabético.

| Preset          | Frecuencia mínima | Largo mínimo de palabra |
| --------------- | ----------------- | ----------------------- |
| `software-demo` | 3                 | 4                       |
| `hardware`      | 3                 | 4                       |
| `educational`   | 4                 | 5                       |
| `recipe`        | 2                 | 4                       |

Por eso el flujo es: **elegís 2–4 conceptos de una sola palabra → los repetís en el guion las veces
que pide el preset → nombrás los archivos con esa palabra.**

```text
raw/broll/campana.mp4          ← el guion dice "campaña" 4 veces  (ñ → n, tilde fuera)
raw/broll/campana-2.mp4        ← segundo clip del mismo concepto (el "2" es numérico: se ignora)
raw/broll/campana-playlist.mp4 ← sirve para "campaña" Y para "playlist", pero pierde contra los de un token
raw/images/playlist.png        ← "playlist" 3 veces
```

Nombrá por **lo que se dice**, no por lo que se ve: `pantalla-01.mp4` o `captura-final.png` no
tienen ningún token del guion y nunca entran. La forma más segura es un token por archivo. El
A-roll, la música, el logo y la locución pueden llamarse como quieras: sus nombres no se tokenizan.

### 3.2 Narración sincronizada con la acción (tutoriales, demos, pantalla grabada)

Si la frase describe lo que se ve, tiene que sonar cuando pasa. Una línea puede empezar con una
marca de tiempo referida al **A-roll**:

```text
[0:00] Entramos a la plataforma con nuestro usuario.
[0:20] Las campañas viven acá. Esta línea de tiempo muestra qué corre en cada pantalla.
[0:47-0:55] Acá armamos la playlist. La plataforma separa horizontal y vertical.
[1:30] La campaña nace en borrador, así la revisás antes de ponerla al aire.
```

Formato exacto: `[m:ss]` o `[mm:ss]` al inicio de la línea, opcional `-m:ss` de fin (separador `-`,
`–` o `—`), un espacio y la frase. Podés mezclar líneas con y sin marca (las sin marca se encadenan
900 ms después de la anterior). Con al menos una marca, **el video dura el A-roll completo** y la
narración se coloca en esos tiempos; sin marcas dura `min(voz, A-roll)` y una voz más larga se corta.

**Cómo producís esta tabla desde tu proyecto:** al grabar la pantalla, anotá el timestamp de cada
paso (o extraé un frame cada 5–10 s: `ffmpeg -ss 20 -i raw/aroll/x.mp4 -frames:v 1 t020.jpg`). La
ventana de cada frase tiene que dar para leerla: ~2,5 palabras por segundo. Si el motor reporta
`overflowMs > 0` en `work/voice/script-manifest.json`, esa frase no entró en su ventana: acortala.

Guardá el guion en `media/<slug>/work/producer/script.txt` (el productor lo lee de ahí) o mandalo
inline con `scriptText` (§6).

## 4. Presets de montaje (para que elijas y nombres el material acorde)

| Preset          | Úsalo para                                          | Cortes por silencio | B-roll                                                    | Captions default | Música (base / bajo voz) |
| --------------- | --------------------------------------------------- | ------------------- | --------------------------------------------------------- | ---------------- | ------------------------ |
| `software-demo` | tutoriales de software, pantallas, reels dinámicos  | ≥ 400 ms            | pantalla completa, 1,2–4 s, hasta 35 % del video          | `bold-impact`    | −8 / −18 dB              |
| `educational`   | explicaciones, clases, publicidad sobria, **tutorial largo** | ≥ 600 ms     | picture-in-picture, 1,5–6 s, hasta 20 %, prefiere fotos   | `subtle-lower`   | −8 / −18 dB              |
| `recipe`        | paso a paso con muchas tomas                        | ≥ 300 ms            | pantalla completa, 0,9–3,5 s, hasta 55 %                  | `bold-impact`    | −8 / −18 dB              |
| `hardware`      | producto físico, unboxing, **publicidad**           | ≥ 450 ms            | pantalla completa, 1,5–5 s, hasta 45 %                    | `bold-impact`    | −4 / −12 dB              |

Estilos de captions (`captionStyle`): `subtle-lower` (subtítulo clásico abajo, 6–10 palabras; **el
único que no tapa una interfaz**), `bold-impact` (1–3 palabras centradas en mayúsculas, para redes),
`clean-sans`, `outline-pop` (fondos claros), `off`. Un tutorial de pantalla grabada va **siempre**
con `subtle-lower`.

## 5. Checklist de entrega (corré esto antes de avisar que el material está listo)

```bash
cd media/<slug>
ls raw/aroll | wc -l                                  # == 1
for f in raw/aroll/* raw/broll/* raw/images/* raw/audio/* raw/logo/*; do
  [ -e "$f" ] && ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration -of compact "$f"
done
```

- [ ] A-roll: orientación == formato pedido; `yuv420p`; audio presente **solo** si lleva voz humana.
- [ ] Guion (si la voz es generada): una frase por línea; conceptos repetidos ≥ frecuencia del preset;
      marcas `[m:ss]` dentro de la duración del A-roll y en orden creciente.
- [ ] B-roll/fotos: nombre = concepto de **una palabra** que aparece en el guion; sin audio; misma
      orientación que el A-roll.
- [ ] Música: `duration` ≥ duración del A-roll.
- [ ] Logo: `pix_fmt` con alfa; un solo archivo.
- [ ] Nombres ASCII minúsculas con extensión de la tabla §1.
- [ ] `work/credits.json` si hay material de terceros.

## 6. Cómo entregar el material al motor

Dos caminos equivalentes (mismo audio, mismos bytes de video). El HTTP es el recomendado cuando el
studio está corriendo (`pnpm studio` en el repo del Video Maker: API en `http://127.0.0.1:4399`, web
en `WEB_PORT`).

### 6.1 Por filesystem (mismo equipo, o volumen compartido)

Copiá tu carpeta a `<repo del Video Maker>/media/<slug>/raw/…` con el layout de §1 y el guion en
`work/producer/script.txt`. Nada más: el ingest se dispara con el montaje. Después, o bien el
usuario abre el productor en la web (`/projects/<slug>/producer`) y pide el video en lenguaje
común, o corrés la CLI:

```bash
# desde la raíz del repo del Video Maker
pnpm nx run render-cli:cli -- run media/<slug> --preset educational --format youtube-16x9 \
  --voice script --caption-style subtle-lower --script media/<slug>/work/producer/script.txt
```

`--voice script` requiere haber generado la voz antes (job `voice`, §6.2) — la CLI no sintetiza. Si
el A-roll trae la voz humana, omití `--voice` y `--script` se vuelve opcional (alinea las captions
al guion si lo tenés). `run` = `ingest` + `plan` + `render`; el MP4 queda en `out/<slug>.mp4`.

### 6.2 Por HTTP (automatizable desde tu repo)

```bash
API=http://127.0.0.1:4399
SLUG=display-ads-tutorial

curl -sS -X POST $API/projects -H 'content-type: application/json' -d "{\"slug\":\"$SLUG\"}"

# un PUT por archivo: rol en la URL, cuerpo binario, content-length y content-type obligatorios
curl -sS -X PUT "$API/projects/$SLUG/assets/aroll/crear-campana.mp4" -H 'content-type: video/mp4' --data-binary @raw/aroll/crear-campana.mp4
curl -sS -X PUT "$API/projects/$SLUG/assets/broll/playlist.mp4"      -H 'content-type: video/mp4' --data-binary @raw/broll/playlist.mp4
curl -sS -X PUT "$API/projects/$SLUG/assets/image/dashboard.png"     -H 'content-type: image/png' --data-binary @raw/images/dashboard.png
curl -sS -X PUT "$API/projects/$SLUG/assets/audio/music01.mp3"       -H 'content-type: audio/mpeg' --data-binary @raw/audio/music01.mp3
curl -sS -X PUT "$API/projects/$SLUG/assets/logo/logo.png"           -H 'content-type: image/png' --data-binary @raw/logo/logo.png

# voz generada desde el guion (una frase por línea, marcas [m:ss] opcionales)
curl -sS -X POST $API/projects/$SLUG/jobs -H 'content-type: application/json' \
  -d '{"kind":"voice","scriptText":"[0:00] Entramos a la plataforma.\n[0:20] Las campañas viven acá.","voice":"es_AR-daniela-high","gapMs":900,"overwrite":true}'

# montaje: acá se decide el formato
curl -sS -X POST $API/projects/$SLUG/jobs -H 'content-type: application/json' \
  -d '{"kind":"montage","preset":"educational","format":"youtube-16x9","voice":"script","captionStyle":"subtle-lower","scriptText":"<el mismo guion>","seed":0,"overwrite":true}'

# render
curl -sS -X POST $API/projects/$SLUG/jobs -H 'content-type: application/json' -d '{"kind":"render"}'
```

Cada `POST /jobs` devuelve `202` con el job (`id`, `kind`, `status`, `progress`) y `location:
/jobs/<id>`. Hacé polling de `GET /jobs/<id>` hasta `status` ∈ `succeeded | failed | canceled`
(`DELETE /jobs/<id>` cancela). Los jobs corren de a uno: esperá que termine `voice` antes de
`montage`, y `montage` antes de `render`. El MP4 queda en `out/<jobId>.mp4` y se lista en
`GET /projects/<slug>/generated`; se descarga por `GET /projects/<slug>/files/out/<jobId>.mp4`.

| Job        | Campos                                                                                                                                   | Errores que vas a ver si el material está mal                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `voice`    | `scriptText` **o** `scriptPath` (relativo al proyecto) · `voice` (id de `GET /voices`, default el del `.env`) · `gapMs` (default 900) · `overwrite` | `VOICE_SCRIPT_INVALID` (guion vacío o los dos campos a la vez) · `VOICE_ID_INVALID` · `409` si ya hay voz y no mandás `overwrite: true` |
| `montage`  | `preset` · `format` · `voice` (`aroll` default \| `script`) · `captionStyle` · `scriptText`/`scriptPath` · `seed` · `overwrite`         | `409 MONTAGE_VOICE_TRACK_NOT_FOUND` (pediste `script` sin job `voice`) · `MONTAGE_INPUT_INVALID` con `reason: no-aroll-asset` · `TIMELINE_INVALID`/`CLIP_EXCEEDS_ASSET` (música corta) · `409 TIMELINE_ALREADY_EXISTS` si ya hay timeline y no mandás `overwrite: true` |
| `render`   | ninguno (renderiza `work/timeline.json`)                                                                                                 | `TIMELINE_NOT_FOUND` si no corriste `montage`                                                                                               |
| upload     | `PUT /projects/:slug/assets/:role/:filename` — roles `aroll` `broll` `image` `audio` `voice` `logo`                                      | `ASSET_ROLE_INVALID` · `ASSET_PATH_INVALID` (subcarpeta, `..`, no portable) · `ASSET_CONTENT_LENGTH_REQUIRED` · `ASSET_CONTENT_TYPE_REQUIRED` · `ASSET_TOO_LARGE` (> 2 GiB por default, `RENDER_API_MAX_UPLOAD_BYTES`) · `409 ASSET_ALREADY_EXISTS` (borrá antes con `DELETE …/assets/:role/:filename`; `409 ASSET_IN_USE` si la timeline lo usa) |

Parámetros que **no existen** y no tenés que inventar: resolución, bitrate, fps de salida, posición
del logo por API de jobs, "ambos formatos". Un cambio de guion o de voz obliga a repetir desde
`voice`; un cambio de preset, seed, formato o estilo de captions solo `montage` + `render`.

## 7. Créditos y trazabilidad (`work/credits.json`)

Si usás música o clips de terceros, dejalos declarados; el productor los lee al entregar:

```json
{
  "assets": [
    {
      "role": "music",
      "file": "raw/audio/music01.mp3",
      "title": "Inspired",
      "artist": "Kevin MacLeod",
      "source": "https://incompetech.com/…",
      "license": "CC BY 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
      "attribution": "Inspired Kevin MacLeod (incompetech.com) — Licensed under CC BY 3.0"
    }
  ]
}
```

## 8. Recetas completas

### 8.1 Tutorial de producto para YouTube (16:9), narración generada

Material: `raw/aroll/crear-campana.mp4` (1920×1080, 96 s, **muda**), `raw/images/playlist.png`,
`raw/images/programacion.png`, `raw/audio/music01.mp3` (≥ 100 s), `raw/logo/logo.png` (alfa),
`work/producer/script.txt` con marcas `[m:ss]` y las palabras "playlist" y "programación" ≥ 4 veces.
Jobs: `voice` → `montage {preset: educational, format: youtube-16x9, voice: script, captionStyle:
subtle-lower}` → `render`. Resultado: 1920×1080@30, dura los 96 s del A-roll, subtítulos abajo, logo
abajo a la derecha, música −8 dB bajo la voz. Es exactamente el caso `media/display-ads`.

### 8.2 Reel / TikTok / Short (9:16), voz humana en la grabación

Material: `raw/aroll/demo.mp4` (1080×1920 **por píxeles**, 30–45 s, con la voz de quien graba),
`raw/broll/<concepto>.mp4` × 2–3 (verticales, `-an`), `raw/audio/music01.mp3`, logo con alfa.
Jobs: `montage {preset: software-demo, format: tiktok-9x16}` (sin `voice`: el habla sale del A-roll)
→ `render`. Sin guion, las captions salen de Whisper tal cual; si tenés el texto que se dijo,
mandalo en `scriptText` para corregir nombres propios (conserva los tiempos de Whisper).

### 8.3 Publicidad con fotos y clips del cliente, sin video base hablado

Material: un clip del cliente como A-roll (16:9 o 9:16 según la red, muda), 3 conceptos → 3–6
clips/fotos nombrados, música, logo, guion de 8–10 frases con cada concepto ≥ 3 veces. Jobs:
`voice` → `montage {preset: hardware, voice: script, format: <red>}` → `render`. Música más presente
(−4 dB) y captions `bold-impact`.

## 9. Errores frecuentes del material (y su síntoma en el motor)

| Lo que entregaste                                    | Síntoma                                                           | Arreglo                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Grabación 16:9 y pediste (o dejaste el default) 9:16 | video vertical con la UI recortada a los lados                    | `format: youtube-16x9`, o grabar vertical                     |
| No pasaste `format`                                  | salió 1080×1920 aunque el A-roll era apaisado                     | siempre explícito                                             |
| B-roll nombrado por lo que muestra (`pantalla-01.mp4`) | `broll-overlays: 0`, el clip nunca aparece                      | un token del guion: `campana.mp4`                             |
| Concepto dicho 2 veces con `educational`             | el concepto no aparece en `concepts`                              | repetirlo ≥ 4 veces o preset `software-demo` (≥ 3)            |
| Música de 60 s para un tutorial de 96 s              | `CLIP_EXCEEDS_ASSET`                                              | loopear la pista                                              |
| Logo PNG con fondo blanco                            | recuadro blanco sobre el video                                    | exportar con alfa                                             |
| Guion sin marcas sobre pantalla grabada              | narración adelantada, video cortado en `min(voz, A-roll)`         | marcas `[m:ss]`                                               |
| Frase larga en ventana corta                         | `overflowMs > 0`, voz acelerada hasta 15 %                        | acortar la frase o abrir la ventana                           |
| A-roll con audio ambiente y `voice: script`          | nada: el audio del A-roll se ignora                               | ok; podés dejarlo pero pesa                                   |
| A-roll mudo y `voice: aroll` (default)               | `captions 0`, sin cortes, video mudo                              | `voice: script` con job `voice` previo                        |
| Archivo `.svg`, `.gif` o `.heic`                     | en `catalog.ignored`, como si no existiera                        | convertir a la tabla §1                                       |
| Dos archivos en `raw/aroll/`                         | usa el primero alfabético en silencio                             | dejar uno                                                     |

## 10. Qué NO hace el motor (no lo prometas en tu proyecto)

Reencuadre 16:9 → 9:16 automático · elegir B-roll por semántica · escenas sin A-roll · efectos de
sonido · captions en varios idiomas · más de una pista de música · voz por escena distinta ·
renderizar dos formatos en un job · logo animado (los bumpers de intro/outro están en desarrollo:
FIX-e-burgos-001-003).

## 11. Cómo consumir este skill desde otro repo

1. Copiá `sdd/skills/video-maker-material-contract/SKILL.md` a `.claude/skills/video-maker-material-contract/SKILL.md`
   de tu repo (o `~/.claude/skills/` para tenerla en todos), o pegá la URL raw del archivo en tu
   `CLAUDE.md`/`AGENTS.md` como lectura obligatoria antes de exportar material.
2. En tu proyecto, invocala con `/video-maker-material-contract` y pedile a tu agente "prepará el
   material del tutorial X para el Video Maker en 16:9": tiene que devolverte la carpeta `raw/`, el
   `script.txt` con marcas y la checklist de §5 tildada.
3. La producción del video (guion final, voz, montaje, entrega) la hace el productor del Video
   Maker con la skill `video-producer` sobre `media/<slug>/`; vos terminás en la checklist.

Fuente de verdad de cada regla: `libs/auto-montage/src/ingest/supported-extensions.ts`
(extensiones), `apps/render-api/src/store/asset-path.ts` (roles), `libs/timeline-core/src/format/format.ts`
(formatos y safe zones), `libs/auto-montage/src/presets/*.preset.ts` (presets),
`libs/timeline-core/src/voice/parse-voice-script-lines.ts` (marcas de tiempo),
`libs/auto-montage/src/concepts/normalize-term.ts` (matching de conceptos),
`apps/render-api/src/http/handlers/{assets,jobs}-handler.ts` (API), `tools/render-cli/README.md` (CLI).

## 12. Modo B — motion graphics (guion + imágenes; el Video Maker hace el resto)

En este modo no hay A-roll ni montaje: el Video Maker arma el storyboard con IA a partir de un catálogo
de escenas animadas de la marca (títulos cinéticos, equipos con su pantalla, celulares, grillas,
tableros, galerías de fotos, cierre con logo), sintetiza la voz con la mejor toma, elige o respeta la
música, corta al golpe y renderiza. Vos entregás **el qué**, no el cómo.

### 12.1 Layout

```text
media/<slug>/                 proyecto con mode "motion" (se crea así, ver §12.5)
  motion/brief.json           el pedido (§12.2) — lo escribís vos (o por PUT)
  raw/images/<archivo>        fotos que el video puede usar (0–12)
  motion/storyboard.json      lo escribe el Video Maker (revisable y editable)
  out/video.mp4               el entregable
```

### 12.2 `brief.json`

```json
{
  "version": 1,
  "brand": "displayads",
  "title": "La IA de Display Ads",
  "format": "16:9",
  "beatSync": true,
  "music": "auto",
  "goal": "Qué tiene que lograr el video (una o dos frases).",
  "audience": "A quién le habla.",
  "script": "El guion en texto plano, como se va a decir.",
  "images": [{ "file": "restaurante-menu.jpg", "caption": "Qué se ve en la foto, en una frase." }]
}
```

| Campo | Reglas |
| --- | --- |
| `brand` | id de una marca instalada en el Video Maker (`GET /motion/brands`; hoy `displayads`). La marca trae colores, fuentes, logo, equipos con su pantalla, fotos propias, temas musicales y voz. |
| `format` | `16:9` (YouTube, web) o `9:16` (reels). Default `16:9`. Un formato por proyecto. |
| `music` | `"auto"` (la IA elige por el tono del guion), el id de un tema de la marca, o `null` (sin música). |
| `beatSync` | `true` corta las escenas al golpe de la música; `false` sigue a la voz. |
| `script` | Texto plano, en el idioma y registro de la voz (rioplatense para DisplayAds). La IA lo parte en escenas y puede pulir la redacción para la voz, pero no inventa funciones: escribí sólo lo que el producto hace. |
| `images[]` | `file` es un nombre dentro de `raw/images/` (jpg, png o webp; ≥ 1280 px del lado largo). `caption` dice **qué muestra** la foto: la IA no ve las imágenes, elige por la descripción. |

### 12.3 Cómo escribir el guion para este modo

- **Duración:** ~2,5 palabras por segundo. Promo o explicativo de 45–75 s ≈ 120–180 palabras; reel 9:16
  de 25–40 s ≈ 60–100 palabras; instructivo de un equipo hasta ~2 min.
- **La marca con contexto y nunca en un extremo de la frase:** "Esto es Display Ads: cartelería digital
  con…". "Display Ads." suelto, o al principio o al final de una línea, la voz sintética lo pronuncia mal.
- Frases cortas, una idea por frase; números como se dicen ("dos por uno", "quinientos metros").
- Abrí con una pregunta o un dolor concreto y cerrá con un llamado a la acción ("Pedí tu cotización").
- Para un instructivo de equipo: un paso por frase, en el orden real ("Conectá el cable…", "Enchufá la
  fuente…"); los equipos que la marca vende hoy (Counter 15, Easy Pro) se animan solos; Core Pro está retirado.

### 12.4 Checklist de entrega (modo B)

1. ¿El video es realmente modo B (§0)? Si hay que ver la UI real, es modo A.
2. `brief.json` valida: `version: 1`, `brand` instalada, `script` no vacío, `format` decidido.
3. Cada imagen existe en `raw/images/`, es jpg/png/webp, tiene `caption` y **no** muestra datos de un
   cliente real, mails, credenciales ni marcas ajenas.
4. El guion nombra la marca con contexto (§12.3) y dura lo que pide la red.
5. Nada de lo que dice el guion contradice el manual del producto.

### 12.5 Entrega

**Por HTTP (studio corriendo):**

```bash
API=http://127.0.0.1:4399
SLUG=display-ads-ia-promo

curl -sS -X POST $API/projects -H 'content-type: application/json' -d "{\"slug\":\"$SLUG\",\"mode\":\"motion\"}"
curl -sS -X PUT "$API/projects/$SLUG/assets/image/restaurante-menu.jpg" -H 'content-type: image/jpeg' --data-binary @images/restaurante-menu.jpg
curl -sS -X PUT "$API/projects/$SLUG/motion/brief" -H 'content-type: application/json' --data-binary @brief.json

# 1) storyboard (IA, ~3–6 min, ~$0,5 con la suscripción de Claude): revisalo antes de seguir
curl -sS -X POST $API/projects/$SLUG/jobs -H 'content-type: application/json' -d '{"kind":"motion","phase":"storyboard"}'
curl -sS $API/projects/$SLUG/motion/storyboard

# 2) video (voz, plan, compose y render; ~30 s por línea de voz + ~2,5 min por minuto de video)
curl -sS -X POST $API/projects/$SLUG/jobs -H 'content-type: application/json' -d '{"kind":"motion","phase":"video","output":"video.mp4"}'
```

La música de la marca es CC BY: el crédito no se dibuja en el video; queda en `out/<output sin extensión>.credits.txt`
y **tiene que ir en la descripción de la publicación** (lo exige la licencia).

Polling igual que §6.2 (`GET /jobs/<id>`; `progress.stage` ∈ `storyboard | voice | plan | compose |
render`, con `linesVoiced/totalLines`). `phase: "all"` hace las dos cosas sin parar a revisar. El MP4
queda en `out/<output>`. Desde la web, el mismo flujo está en `/projects/<slug>/motion`.

| Error | Qué significa |
| --- | --- |
| `400 BRIEF_INVALID` | el brief no cumple §12.2; el mensaje nombra el campo |
| `400 BRAND_NOT_FOUND` | la marca no está instalada en el Video Maker |
| `400` con el nombre de una imagen | `images[].file` no existe en `raw/images/` |
| `409 MOTION_PROJECT_REQUIRED` | el proyecto se creó sin `mode: "motion"` |
| `409 BRIEF_MISSING` / `STORYBOARD_MISSING` | falta el brief, o pediste `phase: video` sin storyboard |
| `409 STORYBOARD_ALREADY_EXISTS` / `ASSET_EXISTS` | ya existe; mandá `"overwrite": true` para rehacerlo |
| `STORYBOARD_INVALID` | la IA no logró un storyboard válido ni con una reparación; el mensaje nombra escena y campo |
| `AI_AGENT_*` | el motor de IA del Video Maker falló (sin sesión de Claude, límite de uso): reintentá más tarde |

**Por CLI (repo del Video Maker):** con `brief.json` y una carpeta `images/` al lado,

```bash
pnpm nx run motion-studio:cli -- auto <carpeta>/brief.json .motion-work/<slug>
pnpm nx run motion-studio:cli -- voice   .motion-work/<slug> --takes 5
pnpm nx run motion-studio:cli -- plan    .motion-work/<slug>
pnpm nx run motion-studio:cli -- compose .motion-work/<slug>
pnpm nx run motion-studio:cli -- render  .motion-work/<slug> --out .motion-work/out/<slug>.mp4
```

### 12.6 Qué NO hace el modo B

Mostrar la UI real del producto (para eso es el modo A) · ver tus imágenes (sólo lee su descripción) ·
inventar funciones que no estén en el guion · mezclar grabaciones de pantalla · marcas que no estén
instaladas (una marca nueva es una carpeta `libs/motion-graphics/assets/brands/<id>/` en el Video Maker).
