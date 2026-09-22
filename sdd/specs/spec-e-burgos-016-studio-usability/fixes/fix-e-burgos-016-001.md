# FIX-e-burgos-016-001 — Los videos se organizan en proyectos y categorías en la pantalla principal

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-016-001 · IMPROVEMENT · medium · 2026-09-22 · implemented |
| **Spec** | spec-e-burgos-016-studio-usability |
| **Origen** | El dev: la pantalla principal muestra los medios sueltos; "Proyectos" pasa a ser carpetas con categorías, lo de hoy pasa a llamarse videos, los sin proyecto van a "Sin Proyecto", y cada tarjeta lleva un menú de tres puntos con sus acciones en modal. |

> Por tamaño esto es trabajo de ciclo, no de fix. Se registra como fix por el modo rápido vigente, con la forma acordada punto por punto con el dev antes de escribir código.

## Las tres decisiones del dev
1. **La organización vive en un registro JSON, el disco no se toca.** La alternativa era anidar carpetas reales (`media/<proyecto>/<categoria>/<video>/`), que rompe `isValidProjectSlug` (un solo segmento kebab-case), obliga a cambiar el `:slug` de las 27 rutas a multi-segmento y a tocar `resolveMediaProject`, la CLI, el prompt del productor y las skills, más migrar lo que ya existe.
2. **Archivar y eliminar son dos acciones distintas.** Archivar saca el video del listado sin borrar nada; eliminar borra la carpeta del disco y pide escribir el nombre para confirmar.
3. **La API sigue diciendo `project` para lo que la UI llama video.** Las carpetas nuevas estrenan su propio nombre, `folder`. Cero churn en lo que ya funciona; el costo aceptado es la discordancia de vocabulario entre UI y API.

## Solución
**API** — `media/.studio/organization.json` (el punto inicial hace que el escaneo de proyectos lo ignore solo). `store/organization.ts` son transformaciones puras y `store/organization-store.ts` la persistencia, que tolera archivo ausente o corrupto devolviendo una organización vacía y descarta placements colgados en vez de esconder el video. Rutas nuevas: `GET|POST /folders`, `PUT|DELETE /folders/:folderId`, `POST /folders/:folderId/categories`, `DELETE /folders/:folderId/categories/:categoryId`, `PUT /projects/:slug/placement` y `DELETE /projects/:slug`. El borrado definitivo sumó `removeDirectory` a `ObjectStorage`, que pasa por el mismo `assertInsideMediaRoot` que el resto.

**Web** — `api/video-grouping.ts` agrupa (puro y testeado aparte); la pantalla principal arma una sección por proyecto, con la categoría como subgrupo y "Sin Proyecto" al final; las carpetas vacías se muestran para que una recién creada sea visible. Cada tarjeta es `VideoCard` con menú de tres puntos → `AssignVideoModal`, `ArchiveVideoModal`, `DeleteVideoModal`, los tres sobre un `Modal` compartido con `role="dialog"`, Escape y cierre por backdrop. Los archivados salen de los grupos y viven detrás de su propio toggle. Textos de "proyecto" reescritos a "video" donde correspondía.

## Invariantes que quedaron cubiertas por tests
- Un video que la API nunca vio se lee como sin proyecto: un media root virgen no necesita registro.
- Borrar un proyecto devuelve sus videos a "Sin Proyecto"; borrar una categoría los deja en el proyecto. Nunca se pierde un video.
- El registro no acumula entradas sin significado: una que vuelve a su estado por defecto se borra.
- Cambiar de proyecto en el modal limpia la categoría anterior, así nunca se manda un par que no existe.
- Archivar y mover son independientes: ninguno pisa al otro.

## Verificación contra el servidor real
Además de los tests, se levantó una instancia de la API sobre un media root descartable (la del dev en el puerto 4399 quedó intacta) y se ejercitó el flujo completo con `curl`: crear proyecto y categoría, asignar, archivar, y el `DELETE` borrando una carpeta de verdad — la carpeta desapareció, el registro olvidó el video, el segundo intento dio 404 y el otro video quedó entero. Los dos guardas respondieron: categoría inexistente → 404, `slug` con path traversal → 422 sin tocar el disco.

## Verificación
`pnpm nx run-many -t lint test build -p web render-api` en verde (2026-09-22): web 1060 tests, render-api 1054, sin warnings de lint.
