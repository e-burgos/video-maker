# FIX-e-burgos-031 — Mezcla de los videos motion: música audible y golpe de la marca sin tapar la voz

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-031 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-14 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En la presentación de Display Ads la música queda ~30 dB bajo la voz (0,15 sin voz ≈ −42 LUFS, 0,045 bajo la voz) y el golpe de bajo de la revelación de marca suena 13–17 dB por encima de «Esto es Display Ads».

## Solución
- `libs/motion-graphics/src/timeline/music-levels.ts`: música sin voz a −27 LUFS (`MUSIC_FREE_TARGET_LUFS`, bed 0,885) y bajo la voz 18 dB por debajo del LUFS medio medido de las voces del proyecto (`MUSIC_UNDER_VOICE_MARGIN_DB`; puerto `measureLoudness`), igual en modos bed y segments; el `volume` del script queda como legado. `buildDuckAutomation` ya no sube el bed dentro de una ventana de voz (la primera frase sonaba a pleno). Revelación de marca (`compose/impact-sfx.ts`): la voz arranca 0,8 s después del golpe y el `sfx-impact` baja a 0,03 desde 0,35 s; la revisión lee la automatización de los sfx.

## Verificación
- motion-graphics, render-api y motion-studio lint/test/build verde. Render real de la presentación de Display Ads en copias: Malena margen mínimo 15,2 dB y Daniela 12,9 dB (sugerencia en la escena de la marca), sin críticos de audio; máster −14,2/−14,4 LUFS; música sin voz audible. El dueño las escuchó: «quedaron muy bien».
