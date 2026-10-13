# FIX-e-burgos-024 — La estimación de la propuesta usa el promedio general del estudio cuando hay pocos renders del modo o formato

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-024 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Con menos de 3 renders del modo/formato la estimación salía de 1–2 muestras o de valores por defecto sin avisar que era gruesa.

## Solución
- Umbral `MIN_HISTORY_SAMPLES = 3`: formato (≥3) → modo (≥3) → `history-studio` (mediana de todo el estudio, `rough: true`) → `default` (`rough: true`). La tarjeta de propuesta muestra «Estimación gruesa» con su motivo.

## Verificación
- render-api y web lint/test/build verde; la propuesta real de comprar-producto-v2 sale con history-mode (20 muestras, rough false).
