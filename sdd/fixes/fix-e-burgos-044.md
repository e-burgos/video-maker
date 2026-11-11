# FIX-e-burgos-044 — Efectos de audio: faltan en el montaje, no en motion

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-044 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
El SKILL.md del productor decía que el motor no hace «efectos de audio» ni «escenas sin A-roll», como si valiera para todo el studio. Eso describe solo al montador (modo footage). Los videos motion graphics no nacen de un A-roll y sí tienen efectos, así que el productor podía negar algo que el motor hace.

## Solución
- El párrafo «Lo que el montador (modo footage) NO hace todavía» queda acotado al montaje.
- Se agrega lo que sí tiene motion: whoosh en los cambios de escena, impacto en el drop de la música, los `sfx` del guion anclados a una escena o palabra, y los sonidos de `libs/motion-graphics/assets/runtime/sfx/`.

## Verificación
- Sin código.
- Contrastado con `compose-template.ts`, `impact-sfx.ts` y `motion-script.ts`.

## Pendiente
La otra mitad de la etapa 0, que el margen voz/música de 15 dB pase a crítico, espera la decisión del dev. Contradice la calibración del 2026-10-11, hecha con una mezcla que el dev aprobó a 13 dB.
