# FIX-e-burgos-005-001 — No se pueden borrar los medios subidos

| Campo         | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| **ID**        | FIX-e-burgos-005-001                                    |
| **Tipo**      | IMPROVEMENT                                             |
| **Severidad** | medium                                                  |
| **Keyword**   | [IMPROVEMENT]                                           |
| **Fecha**     | 2026-09-11                                              |
| **Autor**     | e-burgos                                                |
| **Estado**    | implemented                                             |
| **Spec**      | spec-e-burgos-005-render-service                        |
| **Origen**    | Pedido literal del dev: "No se pueden borrar los medios subidos." |

## Problema

El store de assets sólo crece: `PUT /projects/:slug/assets/:role/:filename` sube y
`GET /projects/:slug/assets` lista, pero no hay forma de sacar nada. Una toma mal grabada, un
duplicado o un archivo pesado quedan para siempre en `raw/`, ensucian `work/catalog.json` y se
meten en cada montaje. La única salida hoy es entrar por terminal al media root.

## Solución

- **EP-027** `DELETE /projects/:slug/assets/:role/:filename`, con el mismo confinamiento de rutas
  que EP-006/EP-011 (`role` de los seis del catálogo, `filename` un segmento portable: nunca se
  sale de `raw/<role>/`) y serializado por el mismo mutex por slug que el upload.
- Borra el archivo, quita su entrada de `work/catalog.json` (`assets`, `probeFailures`, `ignored`)
  y borra también la transcripción derivada del asset (`transcripts[]` + el `work/transcripts/**`
  al que apunta), que es el único derivado que el catálogo conoce por asset. Los derivados que el
  catálogo **no** modela —`work/renders/<jobId>/`, `work/edl.json`, salidas en `out/`— quedan
  huérfanos hasta el próximo ingest/montaje: no hay índice inverso que los ate a un asset.
- `404 ASSET_NOT_FOUND` si el archivo no existe. Si `work/timeline.json` lo referencia
  (`assets[]`, clips de cualquier pista, `logo.assetId`) responde `409 ASSET_IN_USE` con la lista
  de usos en `hint`; `?force=true` borra igual. La respuesta `200` siempre lleva
  `{ deleted, timelineReferences }` para que la UI pueda avisar qué quedó roto.
- Web: botón **Delete** en cada tarjeta de la biblioteca con confirmación por nombre de archivo; si
  la API contesta `ASSET_IN_USE`, la confirmación pasa a mostrar los usos y ofrece **Delete
  anyway** (reintento con `force`). Al confirmar se recarga la lista. Textos en el catálogo i18n
  (`en` + `es`).

## Justificación del bypass del SPEC GATE

Perfil `solo`, sin ciclo abierto sobre spec-005. Un endpoint nuevo sobre el store que ya existe: no
crea entidades ni cambia ningún schema persistido. El contrato queda registrado campo a campo en
`sdd/api.json` (EP-027) y en el README de `render-api`.

## Archivos

43 archivos. En `apps/render-api`: `assets-handler` (+ `handleDeleteAsset`, `resolveAssetTarget`,
`readCatalogOrThrow`), `store/timeline-asset-references.ts` y `store/catalog-merge.ts`
(`removeCatalogAsset`), `store/project-scope.ts` (`readStoredTimelineIfPersisted`),
`http/query-flag.ts`, `routes.ts`, `handle-request.ts`, `create-render-api-server.ts` (conserva el
query string), el puerto `ObjectStorage.removeFile` con sus dos implementaciones y los tres archivos
de errores. En `apps/web`: `asset-delete-control.tsx`, `asset-card.tsx`, `asset-library-page.tsx`,
`api/asset-path.ts`, `render-api-client.ts`, `render-api-types.ts`, `error-explanations.ts`, los dos
catálogos i18n y el E2E. Más `sdd/api.json`, el README de la API y los dos fragmentos de contexto.
Lista completa en `affected_files` de `sdd/fixes.json`.

## Verificación

`pnpm nx run-many -t lint test build` verde en los 8 proyectos y `pnpm sdd:validate` OK (2026-09-11).
Coberturas sin tocar los pisos (80 %): render-api 949 tests (98,14 % stmts / 92,66 % branch), web 876
tests (99,27 % / 95,68 %).

E2E real `apps/web/e2e/delete-asset-smoke.mjs` (puertos 4420/4421, media root temporal copiado de
`media/smoke-ingest`): se sube `delete-me.jpg` por el uploader, se borra desde la tarjeta y
`raw/images/delete-me.jpg` desaparece del disco y de `work/catalog.json`; el A-roll
`raw/aroll/clip01.mp4` que la timeline usa contesta `409` y **sigue en disco**, con el aviso listando
los 12 usos (`asset`, 6 clips de `tracks.aroll`, 6 de `tracks.voice`); **Delete anyway** lo borra
junto con `work/transcripts/aroll/clip01.json` y deja `transcripts: []` en el catálogo. Capturas en
`fixes/artifacts/delete-asset-0{1..5}-*.png`.

El bug más caro lo encontró ese E2E, no los unitarios: `toRequestLine` construía el `path` con
`new URL(...).pathname` y **tiraba el query string**, así que `?force=true` nunca llegaba al handler
aunque su test unitario —que le pasa la ruta con query a mano— pasara. El guard ahora vive en
`create-render-api-server.spec.ts`, comparando el caso sin flag (`409`) contra el caso con flag
(`200`), y se probó sensible rompiéndolo a propósito.
