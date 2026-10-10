# FIX-e-burgos-015 — La música de los videos motion ya no tapa la voz

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-015 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-10 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- En los videos motion la voz sintetizada queda en ~-26 LUFS y la música se recortaba sin nivelar (~-12 LUFS). Con la
  envolvente de ducking (cama 0,5 / bajo voz 0,15, por el volumen 0,8 de la pista) la música quedaba sólo ~4–5 dB
  debajo de la voz mientras se habla y ~6 dB por encima entre frases: tapaba la voz. FIX-e-burgos-014 sube el máster
  a -14 LUFS pero no cambia ese balance.

## Solución
- El paso `plan` recorta la música con un objetivo de loudness (`MUSIC_REFERENCE_LUFS = -24`) y los dos adaptadores
  (CLI `motion-studio` y job `motion` de render-api) la nivelan con `normalizeAudioLoudness` (media-local): medición
  EBU R128 y una ganancia lineal. Queda ~16 dB debajo de la voz al hablar y ~6 dB debajo entre frases.
