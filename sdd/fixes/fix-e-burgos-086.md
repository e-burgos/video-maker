# FIX-e-burgos-086 — patch_timeline acepta un logo cuyo asset no está en timeline.assets

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-13 |
| **Estado** | implemented |

## Qué falló
- `patch_timeline` (MCP) y `PUT /projects/:slug/timeline` persistían `logo.assetId` / `bumpers.*.logoAssetId` sin comprobar que el asset estuviera en `timeline.assets`. El render recién fallaba al final con `INVALID_TIMELINE` sin detalle, mientras `validateTimeline` devolvía `LOGO_ASSET_NOT_FOUND`.

## Solución
- `assetReferenceIssues` en `timeline-core` (logo y bumpers, mismos códigos que `validateTimeline`).
- `patch_timeline` rechaza con `INVALID_INPUT` y los códigos en el hint, sin guardar.
- El PUT del render-api responde 422 `INVALID_TIMELINE` con `issues`.
- `translateEngineError` propaga las `issues` de `RenderTimelineError` a `details.issues` y a `expected`.
