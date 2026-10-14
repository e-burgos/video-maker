# FIX-e-burgos-030 — ElevenLabs como segundo motor de voz del estudio

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-030 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-14 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- El estudio sólo sintetiza con Piper local (Daniela). En la comparación A/B el dueño eligió la voz Malena de ElevenLabs (rioplatense, biblioteca de voces) y contrató el plan Starter (uso comercial y voces de biblioteca por API).

## Solución
- Voces `elevenlabs:<id>` junto a las de Piper (`GET /voices` con `engine`), configurables en Configuración › Voces de ElevenLabs (key en el llavero, lista de voces; Malena por defecto). Un único despacho por prefijo en `synthesizeVoice` usa `POST /v1/text-to-speech` (eleven_v4, idioma del proyecto) para storyboard, guion por línea, motion y preview; ritmo→`speed`, energía→`stability`, pausas como silencio; mp3→wav; caché por contenido para no gastar créditos; errores `VOICE_ENGINE_NOT_CONFIGURED`/`VOICE_ENGINE_QUOTA_EXCEEDED`; cambiar de voz desactualiza la pista. La marca incluida Display Ads usa Malena (vuelve a la voz por defecto si no hay key). Hallados en la verificación: `security` pedía la clave por la terminal del studio (ahora se lanza sin terminal) y el ajuste de líneas con marca de tiempo hace una segunda pasada con la duración real (ElevenLabs no acorta en proporción a la velocidad).

## Verificación
- render-api (2250), web (1641), producer-tools, timeline-core, motion-graphics, media-local lint/test/build verde. Studio real: key importada al llavero (plan starter), Malena en GET /voices y en la marca Display Ads, preview 200; tutorial «usuarios» copiado y producido con Malena: revisión pass (−14,1 LUFS, voz 17,3 dB sobre la música), ~550 créditos y un re-render sin gasto (caché). Una frase de 18 palabras en 6 s queda 0,7 s larga a 1,18×: Malena habla ~2,6 palabras/s.
- Fuera del repo: la receta `.motion-work/youtube-tutorials/tutorial.sh` mandaba `voiceId` (campo ignorado; el job de voz espera `voice`) y ahora acepta `VOICE` y `ALLOW_OVERFLOW`.
