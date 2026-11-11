# FIX-e-burgos-063 — La mezcla de SFX sigue el contrato de motion

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-063 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
FIX-060 se implementó antes de que llegaran dos detalles del contrato de FIX-057:

- la variante se elige con `bumpers.style.seed`;
- el `assetId` de un cue explícito es el id del banco (por ejemplo `whoosh-2`).

Además, si el banco no tenía el tipo pedido, `pickSfxVariant` fallaba y tumbaba el render.

## Solución
- **Semilla:** la variante se elige con `bumpers.style.seed`, y con `timeline.id` solo si no hay.
- **Cues explícitos:** el `assetId` se busca primero en el banco (y se acredita si es CC BY) y después entre los assets de la timeline.
- **Tipo faltante:** un cue automático cuyo tipo no está en el banco se saltea; el render sigue.

## Verificación
`nx test` y `lint` de render-api en verde (2291), con tests de id del banco, semilla del estilo y tipo faltante.
