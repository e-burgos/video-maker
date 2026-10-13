# spec-e-burgos-023-production-quality cycle-06 — 2026-10-12

## Qué pasó
Tres tareas del ciclo se implementaron en paralelo y cada una pasó sus tests, pero la prueba real falló en las
costuras: la tool del productor no aceptaba las cajas que la otra tarea agregó al brief, la tool de revisión rechazaba
campos reales del reporte que los fixtures no tenían, y la revisión leía la voz de una copia vieja del storyboard
(dos falsos «corregir»). Sólo un video real de punta a punta lo mostró.

## Lección
Cuando tareas paralelas comparten un contrato (brief, reporte, tool), la verificación del ciclo es un caso real de
punta a punta con datos reales, y los tests de cada tool usan el payload real del endpoint, no un fixture recortado.

## Costo evitable
Tres reinicios del studio y dos turnos del productor perdidos.
