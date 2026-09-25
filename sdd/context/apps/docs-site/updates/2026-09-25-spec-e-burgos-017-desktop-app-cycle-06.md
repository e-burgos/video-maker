# spec-e-burgos-017-desktop-app cycle-06 — 2026-09-25

## Estado
Publicado en https://video.estebanburgos.com.ar (Cloudflare Pages, proyecto `video-maker`, subdominio
`video-maker-bqo.pages.dev`). Siete páginas en español con la descarga, la instalación sin firma, el primer arranque,
cómo conectar Claude u OpenRouter con precios reales, el uso del estudio, preguntas frecuentes y licencias.

## Estructura
`scripts/build.mjs` + `src/content/*.mjs` + `src/render.mjs` + `src/styles.css`; `src/site-config.mjs` (`SITE_URL`,
`DOWNLOAD_URL`); `functions/descargas/[[path]].js` sirve el `.dmg` desde el binding R2 `DOWNLOADS` con soporte de
Range; `wrangler.toml` (Pages + binding a `video-maker-downloads`); `scripts/check-links.mjs`,
`scripts/capture-screenshots.mjs`. Deploy: `.github/workflows/deploy-docs-site.yml` en cada push a `main` que toque
`apps/docs-site/**` (mismo esquema que tucu-ui: `pnpm dlx wrangler@4 pages deploy`).

## Dependencias
Sin dependencias npm propias; `wrangler@4` por `pnpm dlx` en CI.

## Qué sigue
Actualizar capturas y precios cuando cambien la interfaz o las tarifas de OpenRouter.
