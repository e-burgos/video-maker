# spec-e-burgos-025-liquid-glass-rebrand cycle-01 — 2026-11-13

## Qué pasó
Con lint, 1716 tests, capturas headless de 12 pantallas y contraste AA medido en verde, la revisión del dev en una ventana real de Electron encontró cuatro defectos más: botones de ventana pegados a la esquina de la sidebar, un `SegmentedControl` que se salía del pie, un panel flotante que pisaba la sidebar y alturas desparejas en el pie.

## Lección
Antes de cerrar un ciclo de UI, abrir la app de desarrollo real con datos temporales y pedirle al dev una mirada: los defectos de composición fina no los ven los tests ni las capturas headless.

## Costo evitable
Unas cinco vueltas de corrección tardías; medir anchos y altos de los contenedores angostos con `getBoundingClientRect` en la verificación del ciclo los habría atrapado antes.
