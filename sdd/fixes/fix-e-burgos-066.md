# FIX-e-burgos-066 — Sin menciones a los SFX de Pixabay

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-066 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
FIX-065 borró los 8 efectos de Pixabay de `assets/runtime/sfx/`, pero quedaban tres lugares que todavía los nombraban:

- el SKILL.md del productor decía que los sonidos salen de ahí;
- dos specs del review usaban esas rutas como texto de ejemplo;
- el informe de audio los llamaba Apache 2.0.

## Solución
- **SKILL.md:** los sonidos salen del banco CC0/CC BY de `assets/sfx-bank/`.
- **Specs:** `motion-sfx-cues.spec.ts` y `motion-level-plans.spec.ts` usan rutas del banco.
- **Informe** (`docs/research/2026-11-10-audio-tools-productor.md`): corrige que esos archivos eran de Pixabay y explica cómo se reemplazaron (FIX-059, FIX-062 y FIX-065).

## Verificación
Los specs afectados del review pasan (4). No hay cambios de código.
