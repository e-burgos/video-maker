---
name: motion-studio
description: Produce videos de motion graphics (presentación de producto, explicativo, instructivo de un equipo, reel) con `tools/motion-studio` sobre HyperFrames — plantilla HTML+GSAP con la marca, voz Piper es_AR con la mejor toma, música con cortes al golpe opcionales y ducking. Usar cuando el pedido es un video DISEÑADO (títulos cinéticos, maquetas de producto animadas, diagramas, interfaces simuladas) y no un montaje de material grabado (eso es `video-producer`). Incluye cómo crear una plantilla nueva y las reglas que el render exige.
---

# Skill: motion-studio

Hay dos caminos para el primer paso; desde ahí el pipeline es el mismo:

- **Storyboard (recomendado):** un `storyboard.json` elige escenas de un catálogo de 16 tipos y las
  llena con textos, imágenes y equipos de la marca. No se escribe HTML: la biblioteca
  la lib `libs/motion-graphics` lo compone con el kit de la marca y un runtime de animación declarativo.
  Es lo que un agente puede generar solo desde un guion e imágenes.
- **Plantilla a mano:** `index.html.tpl` escrito a medida (las tres de DisplayAds de la spec-019) para
  cuando el catálogo no alcanza.

`tools/motion-studio` arma un video en cinco pasos; cada uno deja un archivo en el proyecto de trabajo
(`media/motion/<slug>/`, gitignoreado) y se puede rehacer solo.

```bash
pnpm nx run motion-studio:cli -- storyboard libs/motion-graphics/assets/storyboards/displayads/presentacion.json media/motion/presentacion
# o, con plantilla a mano:  init displayads/presentacion media/motion/presentacion
pnpm nx run motion-studio:cli -- voice   media/motion/presentacion --takes 5   # vo-*.wav + words.json
pnpm nx run motion-studio:cli -- plan    media/motion/presentacion             # timeline.json + music.wav
pnpm nx run motion-studio:cli -- compose media/motion/presentacion             # index.html
pnpm nx run motion-studio:cli -- render  media/motion/presentacion --out media/motion/out/presentacion.mp4
```

- `plan --no-beat-sync` apaga los cortes al golpe: las escenas siguen a la voz.
- `voice` usa el stack de voz del repo (`TTS_*` y `WHISPER_*` como `render-api`). Escuchá el reporte:
  `take 3/5 · 0.957 · <lo que entendió Whisper>`. Debajo de ~0.9, reescribí la frase en el `script.json`
  (palabras simples, la marca con contexto: "Esto es Display Ads", "El Core Pro", "Counter quince").
- Para previsualizar: `npx --yes hyperframes@0.8.139 preview` dentro del proyecto de trabajo.

## Storyboard y catálogo de escenas

`storyboard.json`: `{version: 1, title, brand, format: "16:9"|"9:16", beatSync, music: {track}|null,
voice?, scenes[]}`. Cada escena: `{id, kind, vo, chapter?, minBars?, anchor?: "drop"|segundos, props}`.
El contrato completo (con descripciones para la IA) sale de `motionStoryboardJsonSchema()`; los ejemplos
reales están en `libs/motion-graphics/assets/storyboards/displayads/`.

| Escena | Para qué |
| --- | --- |
| `hook` | Pregunta de apertura, con una pantalla que se apaga o se sella "vencida" |
| `problem` | 2–4 tarjetas del dolor actual, tachadas |
| `brand-reveal` | Logo + tagline de la marca (ideal con `anchor: "drop"`) |
| `feature` | Título + viñetas + un visual (imagen, equipo, celular, tablet, tele, ícono, cuenta regresiva, temporizador) |
| `remote-update` | Celular que publica y pantallas que se actualizan |
| `schedule` | Grilla horaria con bloques, días y sucursales |
| `dashboard` | Tabla de pantallas, contador en vivo y alerta |
| `ai-generate` | Prompt que se escribe y resultado que aparece |
| `context` | Chips de contexto + radar de competidores |
| `suggestion` | Tarjeta de sugerencia con botón que se activa |
| `product` | Equipo de la marca con sus pantallas animadas dentro |
| `gallery` | 2–4 fotos con Ken Burns |
| `step` | Paso numerado de un instructivo |
| `connections` | Cables del equipo a la tele, router, fuente o celular |
| `do-dont` | Lo que no y lo que sí |
| `cta` | Cierre con logo, botón y web |

`cue` en cualquier elemento = la palabra de la voz en que aparece (prefijo; sin tilde importa poco).
Imágenes: `images/foto.jpg` (se copian desde la carpeta del storyboard) o `brand:<clave>` del manifiesto.
Sin música (`music: null`) las escenas se acomodan a una grilla de 120 BPM sin audio.

## Marcas

`libs/motion-graphics/assets/brands/<marca>/`: `brand.json` (nombre, nombre hablado, tagline, logos,
fuentes, equipos con el polígono de su pantalla, imágenes, temas con BPM y `drop`, voz) y `brand.css`
con los tokens `--mg-*` que usa el runtime. `assets/runtime/` (GSAP, `motion-runtime.js`, `scenes.css`,
sfx) es común a todas las marcas. Una marca nueva = carpeta nueva con esos dos archivos y sus assets.

## Plantillas a mano

`tools/motion-studio/templates/<marca>/_brand/brand/` (CSS de tokens `--da-*`, `kit.js`) y una carpeta por
video con `script.json` + `index.html.tpl`. Fuentes e imágenes salen de `assets/brand/`, GSAP y sfx de
`assets/runtime/` (los copia `init`).

`script.json`: `voice`, `lengthScale`, `music {file, credit}`, `scenes[] {id, vo, minBars, anchor?}`,
`sfx[] {id, scene, word?, offset?}`, `noWhooshOn[]`. `anchor` (segundos) fija una escena al compás más
cercano: usalo para que el momento fuerte (logo, IA) caiga en la entrada fuerte del tema.

`index.html.tpl` usa `{{start:<id>}}`, `{{dur:<id>}}`, `{{sfx:<id>}}`, `{{duration}}`, `{{voice_tracks}}`,
`{{whoosh_tracks}}`, `{{music_automation}}`, `{{music_credit}}`, `{{timeline_json}}`, `{{words_json}}`.
En el script, `createDisplayAdsKit(T, W, chapters)` devuelve `tl`, `S(id)`, `E(id)`, `wordAt(id, prefijo)`
(segundo en que la voz dice esa palabra), `beatAfter(t)`, `enter()` y `leave()`.

## Reglas que el render exige (si no, el video sale mal sin error)

1. Una sola timeline pausada en `window.__timelines["<composition-id>"]`.
2. Nada de `tl.call` para cambiar textos o estados: capas superpuestas con fundido (el render busca cuadros en paralelo).
3. Animar `x`/`y`/`scale`/`opacity`, nunca `left`/`top`; nunca animar el `.clip` de una escena, sí su hijo.
4. Un error de JS deja la composición sin registrar y el video sale con escenas vacías: abrí `index.html`
   en el navegador o mirá `hyperframes snapshot` antes del render largo.
5. Marca DisplayAds: fondo zinc oscuro, acentos sky/teal, Outfit + Geist + Geist Mono; sin violeta ni Inter;
   logos de `docs/branding/logo-final` (`assets/brand/img/logo.svg`, `isotipo.svg`).
6. Música CC BY: el crédito queda visible (`{{music_credit}}`).

## After Effects

No hay integración directa (los MCP de After Effects necesitan AE abierto con licencia). El puente es
Lottie: exportar la animación de AE con Bodymovin y reproducirla en la plantilla con el adaptador Lottie
de HyperFrames (skill `hyperframes-animation`, `adapters/lottie.md`).

## Skills de HyperFrames

El plugin `hyperframes@hyperframes` queda habilitado en `.claude/settings.json`; Claude Code lo instala
desde `heygen-com/hyperframes` al abrir el repo. Para composición, animación y CLI: `/hyperframes`.
