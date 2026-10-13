# FIX-e-burgos-020 — El turno del productor dura hasta 60 minutos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-020 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Con la revisión visual por escena, un turno que corrige, renderiza (~7 min), extrae cuadros y registra la revisión
  supera los 30 minutos: en el video de prueba se cortaron tres turnos seguidos (`PRODUCER_TURN_FAILED`) sin llegar a
  registrar la revisión.

## Solución
- `DEFAULT_PRODUCER_TURN_TIMEOUT_MS` pasa de 30 a 60 minutos (`PRODUCER_TURN_TIMEOUT_MS` lo sigue cambiando).

## Verificación
- render-api lint/test/build verde.
