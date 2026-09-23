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
| `web-interrupted` | Omitido (ver abajo) | — | N/A |

Ninguna de las tres corridas obligatorias encontró un defecto real en el código de
producción — las tres pasaron en su primera ejecución contra `libs/local-store` y
`apps/render-api` tal como quedaron al cerrar TASK-005/006. Los dos bugs que sí aparecieron
durante el desarrollo de este script (comparación de JSON sensible al orden de claves, y
pérdida del objeto de evidencia al lanzar una excepción) eran del propio script de e2e, no
del backend, y quedaron corregidos en `local-store-smoke.mjs` antes de esta corrida final.

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

## Caso 4 — `web-interrupted` (omitido)

Se decide omitir esta corrida. Playwright no está instalado en el repo: `pnpm-lock.yaml` solo
lo menciona de forma incidental como peer dependency de `@nx/playwright` y
`@vitest/browser-playwright`, nunca como dependencia real de ningún `package.json` del
workspace, y no hay ningún runner de Playwright configurado en `apps/web`. Agregar la
dependencia solo para esta corrida puntual excede el alcance de TASK-008. El caso 4 quedó
implementado como no soportado en el script (`--case=web-interrupted` imprime un mensaje de
uso explicando esta omisión) para que quede documentado ahí también.

La cobertura funcional equivalente del lado UI (badge de "Interrumpido" + botón "Volver a
ejecutar" en los cuatro paneles de jobs) ya fue validada en TASK-007, que se cerró y
commiteó por separado.
