# 0.2.0 — publicación (cycle-04 TASK-005)

> 2026-09-26, con la confirmación explícita del dev. `pnpm desktop:release --publish` con `CLOUDFLARE_API_TOKEN` y
> `CLOUDFLARE_ACCOUNT_ID` leídos línea por línea del `.env` raíz por un wrapper que tapa su valor en la salida (nunca
> impresos).

- Subidos a R2 (`video-maker-downloads`): `Video-Maker-0.2.0-arm64.dmg` y `Video-Maker-arm64.dmg`, 268 894 004 bytes.
- El script verificó `content-length` en `https://video.estebanburgos.com.ar/descargas/Video-Maker-0.2.0-arm64.dmg` y
  en `/descargas/Video-Maker-arm64.dmg`.
- Descarga completa desde el dominio: sha256 `e49ea00ca9a8db57cddeb21004a1b5f6f7aac8bd878fddfab082b1bb6e85668b`, igual
  al del build; `HEAD` → 200, `application/x-apple-diskimage`.
- La web se despliega con el merge a `main` (`.github/workflows/deploy-docs-site.yml`).
