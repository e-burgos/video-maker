# spec-e-burgos-020-motion-mode cycle-04 — 2026-10-07

## Qué pasó
Con 3.500 tests en verde en los siete proyectos, la primera corrida desde la web real encontró cuatro
defectos que ningún test veía: el `.env` de desarrollo tenía una `ANTHROPIC_API_KEY` inválida que
render-api le pasaba al CLI de Claude (401 tras 3 min de reintentos; el dev sólo usa suscripción), el
error del agente se perdía al envolverse y el job decía sólo "did not complete", la web no aceptaba el
reporte de la fase storyboard (`path: null`) y quedaba cargando para siempre, y `media/motion/` (los
proyectos de trabajo de la CLI) se importó como un proyecto del estudio. El smoke del implementador
había pasado porque levantó render-api sin el `.env`.

## Lección
Correr la prueba de punta a punta con el arranque REAL del dev (`pnpm studio` con su `.env`), nunca con
un servidor levantado a mano: el entorno es parte del sistema; y no pasar credenciales de API a un CLI
que debe autenticarse con la suscripción del usuario.

## Costo evitable
Dos jobs de storyboard fallidos (~6 min) y un diagnóstico a ciegas por un mensaje de error genérico.
