# FIX-e-burgos-088 — La actividad del productor se lee en el idioma de la interfaz

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-14 |
| **Estado** | implemented |

## Qué se veía
- `mcp__studio__get_project_overview · Checking the project`: nombre crudo de la herramienta y resumen en inglés del servidor.
- `turno succeeded`: el estado del turno sin traducir.

## Solución
- `translateProducerEvent`: las 32 herramientas del studio tienen etiqueta propia (es/en); las demás conservan nombre y resumen.
- `translateProducerTurnStatus`: «turno terminado», «turno con error», «turno cancelado».
