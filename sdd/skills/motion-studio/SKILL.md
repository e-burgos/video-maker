---
name: motion-studio
description: Produce videos de motion graphics (presentación de producto, explicativo, instructivo de un equipo, reel) con `tools/motion-studio` sobre HyperFrames — plantilla HTML+GSAP con la marca, voz Piper es_AR con la mejor toma, música con cortes al golpe opcionales y ducking. Usar cuando el pedido es un video DISEÑADO (títulos cinéticos, maquetas de producto animadas, diagramas, interfaces simuladas) y no un montaje de material grabado (eso es `video-producer`). Incluye cómo crear una plantilla nueva y las reglas que el render exige.
---

# Skill: motion-studio

`tools/motion-studio` arma un video en cinco pasos; cada uno deja un archivo en el proyecto de trabajo
(`media/motion/<slug>/`, gitignoreado) y se puede rehacer solo.

```bash
pnpm nx run motion-studio:cli -- init displayads/presentacion media/motion/presentacion
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

## Plantillas

`tools/motion-studio/templates/<marca>/_brand/` (CSS de tokens, `kit.js`, fuentes, GSAP, imágenes, sfx),
`_music/` (temas con su licencia) y una carpeta por video con `script.json` + `index.html.tpl`.

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
   logos de `docs/branding/logo-final` (`_brand/img/logo.svg`, `isotipo.svg`).
6. Música CC BY: el crédito queda visible (`{{music_credit}}`).

## After Effects

No hay integración directa (los MCP de After Effects necesitan AE abierto con licencia). El puente es
Lottie: exportar la animación de AE con Bodymovin y reproducirla en la plantilla con el adaptador Lottie
de HyperFrames (skill `hyperframes-animation`, `adapters/lottie.md`).

## Skills de HyperFrames

El plugin `hyperframes@hyperframes` queda habilitado en `.claude/settings.json`; Claude Code lo instala
desde `heygen-com/hyperframes` al abrir el repo. Para composición, animación y CLI: `/hyperframes`.
