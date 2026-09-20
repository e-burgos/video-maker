# FIX-e-burgos-005-002 — Los archivos copiados directo a `raw/` no aparecen si existe un `catalog.json` viejo

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-005-002 |
| **Tipo** | BUGFIX · **Severidad** high · **Fecha** 2026-09-20 · **Estado** implemented |
| **Spec** | spec-e-burgos-005-render-service |
| **Origen** | `display-ads-creacion-campana-full-desktop`: el A-roll copiado por un agente externo a las 19:33 no aparecía en la biblioteca; el catálogo (escrito a las 20:06 por la subida del logo) solo listaba el logo. |

## Problema
`GET /projects/:slug/assets` respondía desde `work/catalog.json` siempre que existiera, y el catálogo solo
se actualiza con `ingest` o con la subida desde el studio. Todo lo copiado a mano a `raw/` quedaba
invisible para la biblioteca y para el inventario del productor.

## Solución
`resolveProjectAssets` funde catálogo y escaneo de `raw/`: los archivos sin catalogar se listan con
`media: null` hasta el próximo `ingest` (mismo contrato que la fuente `raw-scan`), y las entradas del
catálogo cuyo archivo ya no está en disco se descartan. Si `raw/` no es legible se devuelve el catálogo tal cual.

## Verificación
Test nuevo en `project-assets.spec.ts`; `render-api` 998 tests verdes; tras reiniciar, `GET …/assets` del proyecto real lista el A-roll.
