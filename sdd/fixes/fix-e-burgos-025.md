# FIX-e-burgos-025 — Dirección de voz por frase en los storyboards de escenas narradas

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-025 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Los storyboards de material crudo y generativo (work/storyboard.json) no aceptaban dirección de voz por frase, como sí motion y el guion por línea.

## Solución
- Cada escena de `work/storyboard.json` acepta `direction` (`VoiceDirectionSchema`, `emphasis` presente en la narración); la síntesis la aplica igual que el guion por línea y la registra en el manifiesto. El hash de narración incluye la dirección sólo si existe (cambiarla deja la pista `stale`). Tool nueva del productor `set_voice_direction` (líneas del guion y escenas del storyboard) sobre `PUT /projects/:slug/voice/direction`, que suma `sceneDirections`.

## Verificación
- timeline-core, producer-tools y render-api lint/test/build verde (dirección por escena en schema, síntesis, hash y endpoint).
