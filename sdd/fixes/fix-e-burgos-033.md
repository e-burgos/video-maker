# FIX-e-burgos-033 — La vista previa y las Entregas muestran los renders que no hizo esta instancia del estudio

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-033 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-15 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Los tutoriales rehechos con Malena desde el studio de desarrollo no aparecen en la app de escritorio: la vista previa y las Entregas sólo listan los renders de los jobs de su propia base, aunque el mp4 esté en out/.

## Solución
- `renderDeliveriesNewestFirst` (en lugar de `fullRenderJobsNewestFirst`): la vista previa y las Entregas listan todos los mp4 completos de `out/` (sin muestras) del más nuevo al más viejo por fecha del archivo; los que tienen job conocido conservan sus datos y los demás se pueden reproducir, descargar y ver su revisión automática. Los videos motion ya usaban el mp4 más nuevo de `out/`.

## Verificación
- web lint/test/build verde, con tests del archivo sin job más nuevo como vista previa, muestras excluidas, orden por fecha y datos del job conservados.
