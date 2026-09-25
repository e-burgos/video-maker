# Publicación de Video Maker 0.1.0 — 2026-09-25

Confirmada por el dev ("si procede"), con los tokens de su `.env` (nunca impresos: un wrapper los cargaba en el
entorno del comando y redactaba la salida).

| Paso | Resultado |
| --- | --- |
| Proyecto de Cloudflare Pages `video-maker` | Creado por API; subdominio asignado `video-maker-bqo.pages.dev` (`video-maker.pages.dev` estaba tomado) |
| Dominio `video.estebanburgos.com.ar` en Pages | Agregado por API |
| DNS en Hostinger | CNAME `video` → `video-maker-bqo.pages.dev.` (primero se cargó `video-maker.pages.dev.` y se corrigió con `overwrite: true`; la zona conserva sus 17 registros) |
| Bucket R2 `video-maker-downloads` | Creado por el dev; el token recibió permiso de R2 |
| Secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en `e-burgos/video-maker` | Cargados con `gh secret set` por stdin |
| `.dmg` en R2 | `pnpm desktop:release --publish`: `Video-Maker-0.1.0-arm64.dmg` y `Video-Maker-arm64.dmg`, 268 897 215 bytes cada uno |
| `main` | Fast-forward a `1a13dbe` (incluía 4 commits de fixes que no se habían subido) y push |
| Workflow "Deploy Docs Site (Cloudflare Pages)" | Éxito en todos los pasos; CI y SDD validate también en verde |

## Verificación

- `https://video.estebanburgos.com.ar/` → 200; `/instalacion.html` → 200.
- `/descargas/Video-Maker-arm64.dmg` y `/descargas/Video-Maker-0.1.0-arm64.dmg` → 200, `application/x-apple-diskimage`,
  `content-length` 268 897 215 (igual al archivo local), `accept-ranges: bytes`; con `Range` → 206; otra ruta → 404.
- Descarga completa desde el dominio: sha256 `668219936da3050169fcaa13c9708a2c960d6d99f76a7844c6816869346da85f`, idéntico al build local.
