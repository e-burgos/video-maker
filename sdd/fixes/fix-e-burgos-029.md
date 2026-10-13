# FIX-e-burgos-029 — La revisión de material no puede quedar vacía

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-029 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el turno real con el video de referencia, el productor llamó `review_material` con `items: []` y `gaps: []` y propuso un recorrido del cotizador que necesita capturas que el proyecto no tiene; el faltante sólo quedó en el texto del chat, no en la tarjeta Propuesta.

## Solución
- `review_material` rechaza (`INVALID_INPUT`) una revisión sin imágenes y sin faltantes, y le pide al productor listar las imágenes que miró (incluidas las fotos de la marca que piensa usar) y lo que la idea necesita.

## Verificación
- producer-tools lint/test/build verde (447): revisión vacía rechazada; proyecto sin imágenes con faltantes aceptado.
