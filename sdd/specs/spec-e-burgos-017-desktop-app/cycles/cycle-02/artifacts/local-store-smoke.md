# Smoke e2e de local-store (TASK-008)

> Script: `apps/render-api/e2e/local-store-smoke.mjs`. Reproducible con
> `node apps/render-api/e2e/local-store-smoke.mjs --case=<import|interrupted-render|producer-restart>`.
> Cada corrida escribe su evidencia en JSON en este mismo directorio
> (`local-store-smoke-<caso>.json`). No requiere el servidor levantado de antemano: el
> script lo arranca y lo detiene él mismo, sobre un clon APFS temporal de `media/`.

## Resultado por caso

| Caso | Resultado | Checks | Defecto de producción encontrado |
| --- | --- | --- | --- |
| `import` | PASSED | 4/4 | No |
| `interrupted-render` | PASSED | 7/7 | No |
| `producer-restart` | PASSED | 6/6 | No |
| `web` (TASK-007) | PASSED | 2 ciclos (en + es), 8/8 asserts cada uno | No |

Ninguna de las cuatro corridas encontró un defecto real en el código de producción — las tres
de `apps/render-api` pasaron en su primera ejecución contra `libs/local-store` y
`apps/render-api` tal como quedaron al cerrar TASK-005/006. Los dos bugs que sí aparecieron
durante el desarrollo de ese script (comparación de JSON sensible al orden de claves, y
pérdida del objeto de evidencia al lanzar una excepción) eran del propio script de e2e, no
del backend, y quedaron corregidos en `local-store-smoke.mjs` antes de esa corrida final. El
caso `web` (TASK-007, detallado más abajo) también pasó contra `apps/web` tal como quedó al
cerrar TASK-007, con un único ajuste al propio script de e2e (encuadre de las capturas, no el
producto).

## Caso 1 — `import`

Clona `media/` completo (APFS copy-on-write) a un directorio temporal, arranca el server dos
veces seguidas y verifica que el import de proyectos legacy sea idempotente.

| Verificación | Resultado |
| --- | --- |
| Archivos `organization.json`/`conversation.json`/`session.json` rastreados | 9 |
| Directorios de proyecto en disco | 17 |
| `GET /projects` devuelve 17 entradas (una por directorio) | OK |
| `GET /projects/display-ads-creacion-campana-full-mobile/producer` == `conversation.json` fuente | OK |
| Conteo de filas por tabla idéntico entre la 1ª y 2ª corrida | OK |
| Los 9 archivos fuente quedan byte-idénticos después de dos corridas (el import es read-only) | OK |

Conteo de filas (igual en ambas corridas): `projects=17, folders=2, categories=1,
placements=10, producer_sessions=4, producer_messages=34, jobs=0, settings=1`.

Reporte de la 1ª corrida: `projectsImported=17, organizationImported=true,
conversationsImported=4, skipped=[]`. Reporte de la 2ª corrida: todo en `0`/`false` — el
importer detecta que ya no hay nada nuevo que importar.

## Caso 2 — `interrupted-render`

Proyecto sintético con un clip de 8s con video y audio (`ffmpeg lavfi testsrc+sine`), montaje
+ render, `kill -9` a mitad del render, reinicio, verificación del estado interrumpido y
reintento vía `POST /jobs/:id/retry`.

| Verificación | Resultado |
| --- | --- |
| El job de montaje (timeline) termina en éxito | OK |
| `progress.renderedFrames > 0` visible directo en la fila SQLite antes del kill | OK (14/239 frames, stage `render`) |
| Procesos huérfanos encontrados tras el `kill -9` del server | 8 (`chrome-headless-shell` de Remotion: 1 gpu-process + 1 network utility + 6 renderers) |
| Procesos huérfanos eliminados | 8/8 |
| El job queda `failed` tras el reinicio | OK |
| `error.code` del job es `JOB_INTERRUPTED` tras el reinicio | OK |
| `POST /jobs/:id/retry` responde `202` | OK |
| El job reintentado termina en `succeeded` | OK |
| `ffprobe nb_frames` del video final == `report.deliverable.durationInFrames` | OK (239 == 239) |

El hallazgo de los 8 procesos huérfanos de `chrome-headless-shell` confirma el comportamiento
ya documentado en `plan.md` (Remotion no propaga la señal a sus hijos cuando el proceso padre
recibe `SIGKILL`): es un comportamiento conocido del entorno de desarrollo local, no algo que
el propio proceso de render pueda evitar recibiendo `SIGKILL` — por eso no se lo trata como
defecto de producción, y el script simplemente los detecta y limpia para no ensuciar corridas
siguientes.

## Caso 3 — `producer-restart`

Clon de `media/display-ads-analiticas`, dos turnos de productor con `PRODUCER_MODEL=haiku`
(modelo económico), reinicio del server entre ambos turnos.

| Verificación | Resultado |
| --- | --- |
| Primer turno del productor ("Hola, decime en una línea qué material tiene este proyecto") termina en éxito | OK |
| Segundo turno ("¿Qué te pregunté recién?"), después del reinicio, termina en éxito | OK |
| `GET .../producer` lista los 4 mensajes (2 intercambios) en orden | OK |
| Los 4 mensajes alternan `user`/`assistant` en el orden en que se enviaron | OK |
| La segunda respuesta hace referencia a la primera pregunta (la sesión sobrevivió al reinicio) | OK |
| No se escribió `conversation.json` ni `session.json` en el directorio del proyecto (todo vive en SQLite) | OK |

## Web — `apps/web/e2e/interrupted-job-smoke.mjs` (TASK-007)

> Script: `apps/web/e2e/interrupted-job-smoke.mjs`. Reproducible con
> `node apps/web/e2e/interrupted-job-smoke.mjs`. Sigue el patrón de los demás smokes de
> `apps/web/e2e/` (`voices-smoke.mjs`, `montage-smoke.mjs`): arranca `render-api` y el `vite`
> dev server él mismo, y abre Chrome real con Playwright resuelto desde el caché de `npx`
> (`resolvePlaywright()` en `smoke-helpers.mjs`) — nunca como dependencia de `package.json`
> (D-invariante del repo). La nota que TASK-008 dejó en este mismo archivo diciendo que
> "Playwright no está instalado" describía correctamente `pnpm-lock.yaml`, pero no el patrón
> ya vigente en `apps/web/e2e/`: el caso web queda cubierto acá, por el implementador
> frontend, con el harness que ya usan los otros doce smokes de esa carpeta.

Sobre un proyecto sintético propio (`interrupted-job-smoke`, un clip de 8s con video y audio
vía `ffmpeg lavfi testsrc+sine`, igual que el caso 2), el script corre el ciclo completo dos
veces — una en inglés y otra en español — sobre la misma base temporal: monta el timeline por
API, dispara un render, espera `progress.renderedFrames > 0`, mata `render-api` con
`kill -9`, cuenta y limpia los procesos huérfanos, reinicia el servicio, abre la página de
preview en Chrome, selecciona el job desde `RenderJobList` y verifica en el DOM (nunca por
captura) el badge y el botón antes de hacer click y confirmar por API que el job reintentado
termina en `succeeded`.

| Verificación | en | es |
| --- | --- | --- |
| `progress.renderedFrames > 0` visible por API antes del kill | OK | OK |
| Procesos huérfanos encontrados tras el `kill -9` | 8 | 8 |
| Procesos huérfanos eliminados | 8/8 | 8/8 |
| Badge "Interrupted"/"Interrumpido" visible en el DOM (no por screenshot) | OK | OK |
| Botón "Run again"/"Volver a intentar" visible en el DOM | OK | OK |
| `POST /jobs/:id/retry` responde `202` desde el click de la UI | OK | OK |
| El nuevo id de job reemplaza al interrumpido en el DOM | OK | OK |
| El job reintentado termina en `succeeded` (poll por API) y `ffprobe nb_frames` ==
  `report.deliverable.durationInFrames` | OK (239==239) | OK (239==239) |

No se encontró ningún defecto de producción: los dos ciclos pasaron con el código de
`apps/web` tal como quedó al cerrar TASK-007. El único ajuste que hizo falta fue al propio
script (no al producto): la primera corrida probó que el badge y el botón existen en el DOM
correctamente, pero la captura de pantalla los dejaba fuera del viewport (el panel del job
queda más abajo de lo que entra en una pantalla de 1280×1400, y crece con cada fila nueva de
`RenderJobList`); se corrigió con `locator.scrollIntoViewIfNeeded()` antes de cada captura y
subiendo el viewport a 1280×1800, sin tocar la aserción del DOM que ya venía pasando.

Capturas (`sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-02/artifacts/`):

- `interrupted-job-smoke-01-badge-en.png` / `-es.png` — badge + botón visibles apenas
  reabierto el preview tras el reinicio.
- `interrupted-job-smoke-02-after-retry-en.png` / `-es.png` — el panel ya muestra el job
  nuevo (`estado: running`/`state: running`) justo después del click.
