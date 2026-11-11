# FIX-e-burgos-037 — Daniela pronuncia «Display Ads»

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-037 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-10 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
espeak-ng (el fonemizador de Piper) lee «Display» en español como `displˈaɪ`: acento al final y «ay» como «ai». En todos los videos con Daniela la marca suena «dis-PLAI» y Whisper la transcribe como «Displiance» o «Blayas».

## Solución
`synthesizeSpeech` reescribe «Display» como «Díspley» (`dˈisplˌeɪ`) solo cuando el modelo Piper es español (`es_*`). La tabla vive en `piper-spanish-pronunciation.ts`. El texto del guion, los subtítulos y la voz de ElevenLabs no cambian.

## Verificación
- Prueba a ciegas de siete escrituras con el dev: eligió «Díspley Ads».
- `nx test media-local` (445) y lint en verde; build de `media-local` y `render-api`.
- Síntesis real con `synthesizeSpeech` y Daniela: Whisper oye «Display As».
