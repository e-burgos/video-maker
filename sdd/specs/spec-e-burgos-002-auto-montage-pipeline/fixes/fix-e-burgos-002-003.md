# FIX-e-burgos-002-003 — `plan` falla con `EDL_INVALID` por palabras de duración cero de whisper.cpp

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-002-003                    |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | high                                    |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-10                              |
| **Autor**     | e-burgos                                |
| **Estado**    | implemented                             |
| **Spec**      | spec-e-burgos-002-auto-montage-pipeline |
| **Origen**    | Demo real `media/demo-espacio` (voz Piper de 43 s sobre material NASA) |

## Problema

`render-cli run media/demo-espacio --preset software-demo --seed 0` falla en `plan` con
`EDL_INVALID: cap-0024 / cap-0029 tiene endMs menor o igual que startMs`. La transcripción real de
whisper.cpp (`ggml-large-v3-turbo-q5_0`) trae palabras con `from == to` al inicio de cada segmento
("Hoy" y "te" en 3980..3980, "Primero," en 7960..7960, etc.). `groupWordsForCaptions` extiende ese
grupo hasta `minDurationMs`, `planCaptionGroups` recorta el fin al `keep` que lo contiene y, cuando el
`keep` termina justo donde empieza la palabra, el recorte deja `endMs == startMs`.

## Solución

1. **En el origen** (`libs/media-local`, parser de whisper.cpp): `repairZeroDurationWords` empaqueta
   cada corrida de palabras sin duración **al final** del hueco que va hasta la siguiente palabra con
   tiempo real (200 ms por palabra como máximo), dejando la pausa previa sin palabras: whisper.cpp
   arranca cada segmento donde terminó el anterior, y estirar la primera palabra sobre el silencio
   hacía que el agrupador de captions la pegara a la frase anterior ("VOS. EN", visto en `demo-01`).
   Sin palabra siguiente, 200 ms por palabra desde su inicio.
2. **Red de seguridad** (`libs/auto-montage`, `planCaptionGroups`): un grupo cuyo fin recortado no
   supera su inicio se descarta en vez de emitirse.

## Justificación del bypass del SPEC GATE

Defecto confirmado que bloquea cualquier proyecto real con este modelo; dos funciones puras y sus
tests, sin contratos ni entidades nuevas. Perfil `solo`, sin ciclo abierto.

## Archivos afectados

- `libs/media-local/src/whisper/parse-whisper-cpp-json.ts` (+ spec)
- `libs/auto-montage/src/montage/plan-caption-groups.ts` (+ spec)

## Verificación

`pnpm nx run-many -t lint test build` en verde con dos tests nuevos: (a) una corrida de palabras
`from == to` sale con tiempos monótonos y estrictamente crecientes hasta la siguiente palabra; (b) un
grupo cuyo `keep` termina en su `startMs` no produce decisión. Y el pipeline real sobre
`media/demo-espacio` llega a MP4.
