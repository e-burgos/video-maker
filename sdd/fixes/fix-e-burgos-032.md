# FIX-e-burgos-032 — Malena es la voz por defecto del estudio cuando hay key de ElevenLabs

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-032 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-14 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- El dueño pidió aplicar Malena a todos los videos; sin voz elegida ni voz de marca el estudio seguía usando Daniela.

## Solución
- `defaultElevenLabsVoiceId`: con key, la primera voz de ElevenLabs configurada (Malena) es la voz por defecto en `GET /voices` y en `resolveVoiceModel` cuando no hay voz elegida ni voz de marca Piper instalada; sin key sigue Daniela.

## Verificación
- render-api (2255) y producer-tools lint/test verde: con key, GET /voices marca a Malena como única voz por defecto y resolveVoiceModel(null) la elige; sin key, Daniela.
