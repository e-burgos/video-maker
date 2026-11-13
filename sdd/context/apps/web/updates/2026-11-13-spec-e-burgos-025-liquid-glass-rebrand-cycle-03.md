# apps/web — spec-e-burgos-025-liquid-glass-rebrand cycle-03 (2026-11-13)

## Estado
Biblioteca de material, storyboard y voz migrados al Cristal Líquido; `/library`, `/storyboard` y `/voice` entran en `isMigratedRoute`. Visor ampliado propio, opaco, con navegación por teclado y comparación lado a lado.

## Estructura
- `components/library/`: grilla de tiles opacos, filtro y resumen por rol, barra de selección, diálogo de borrado múltiple (reemplaza `asset-card`, `asset-preview` y `asset-delete-control`).
- `components/media-viewer/`: visor (`role="dialog"` en portal, z-70), modelo, escenario, tira de miniaturas, detalle y foco atrapado.
- `components/storyboard/`: lista de escenas y modelo; `storyboard-save-bar.tsx` pegajosa.
- `components/shell/legacy-surface.tsx`: envuelve vistas motion aún no migradas en superficie oscura; se retira al migrar motion.
- `TEXTAREA_CLASS` en `components/ui/cl-controls.ts`.

## Dependencias
Sin cambios de dependencias ni de API.

## Qué sigue
Ciclo 04: vista previa y render, motion (retirar `LegacySurface`) y marcas. `studio-layout.spec` usa `/preview` como ruta no migrada: cambiarla cuando se migre.
