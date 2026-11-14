# apps/web — spec-e-burgos-025-liquid-glass-rebrand cycle-05 (2026-11-13)

## Estado
Todas las rutas del studio usan el Cristal Líquido. Se retiró el modo heredado: no existen `isMigratedRoute`, la superficie oscura de rutas no migradas, `LegacySurface` ni la prop `surface` (Modal, ErrorNotice, JobRetryButton, BrandPicker, MusicModeFields son solo vidrio). Publicación, ajustes y guía migrados.

## Estructura
- `components/publish/` + `api/publish-queue-view.ts`: cola con métricas, pestañas Cola/Publicados/Con error, filas con menú ⋮; pausar/reanudar en el toolbar.
- `components/settings/`: pestañas Productor, Voz, YouTube y Apariencia con `?tab=` (`useTabParam`, `SegmentedControl semantics="tabs"`); pestañas montadas y ocultas para no perder borradores; «Guardar cambios» en el toolbar guarda todos los borradores.
- Pie de la barra lateral: Apariencia es un `Link` a `/settings?tab=appearance` (`appearance-link`).
- `components/guide/`: índice pegajoso con sección activa (IntersectionObserver) y pasos en tarjetas.
- `components/ui/status-states.tsx`: `LoadingState` y `EmptyState` para estados de una línea.
- `components/ui/modal.tsx`: cabecera y pie fijos, cuerpo con scroll (`<testId>-body`).
- Borrados: `ui/badge`, `ui/card`, `ui/tabs`, `ui/button`, `PUBLICATION_STATUS_TONE`; `index.css` sin tokens `--color-*` heredados.
- `--tucu-state-red-ink` en claro pasa a `#a8231b` (AA sobre su fondo suave).

## Dependencias
Sin cambios de dependencias ni de API.

## Qué sigue
Ciclo 06: paridad con la web (Aprender, Acerca de, Conectar agentes, material libre, requisitos). Correr los e2e contra un studio libre antes de la PR.
