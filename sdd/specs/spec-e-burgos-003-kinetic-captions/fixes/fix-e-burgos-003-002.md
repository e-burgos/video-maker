# FIX-e-burgos-003-002 — Los grupos de captions cruzan el fin de oración porque Whisper le asigna la pausa a la palabra anterior

| Campo         | Valor                              |
| ------------- | ---------------------------------- |
| **ID**        | FIX-e-burgos-003-002               |
| **Tipo**      | BUGFIX                             |
| **Severidad** | medium                             |
| **Keyword**   | [BUGFIX]                           |
| **Fecha**     | 2026-09-10                         |
| **Autor**     | e-burgos                           |
| **Estado**    | implemented                        |
| **Spec**      | spec-e-burgos-003-kinetic-captions |
| **Origen**    | Producción real de `media/demo-01` con la skill `video-producer` |

## Problema

La caption "VOS. EN" mezclaba el final de una frase con el inicio de la siguiente. `whisper-cli -ml 1`
le da al token anterior a una pausa toda la duración de la pausa ("vos" 1600..2740 ms para una palabra
de ~350 ms) y arranca el siguiente token justo en su fin: el hueco entre frases es 0 ms y
`groupWordsForCaptions`, que agrupa por hueco, no puede separarlas.

## Solución

La puntuación es una señal independiente del tiempo: una palabra que termina en `.`, `!`, `?` o `…`
cierra el grupo (`shouldStartNewGroup`). Compatible con transcripciones sin puntuación.

## Justificación del bypass del SPEC GATE

Defecto confirmado con material real y el modelo por defecto; una función pura y su test, sin
contrato nuevo. Perfil `solo`, sin ciclo abierto.

## Verificación

`pnpm nx run-many -t lint test build -p timeline-core auto-montage composition-remotion` en verde con
el caso nuevo (`que vos.` | `En nuestra` con hueco 0 ms). Re-plan real de `media/demo-01`: los primeros
grupos ya no cruzan el punto.
