# Constitución — apps/docs-site

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** sitio estático (Cloudflare Pages)
- **Rol en el sistema:** web de documentación y descarga de la app de escritorio para los amigos del dev:
  requisitos, instalación (incluida la apertura sin firma), primer arranque, cómo conectar Claude u OpenRouter,
  uso del estudio, preguntas frecuentes y licencias.

## 2. Stack tecnológico

- HTML y CSS estáticos generados en el build, sin frameworks de cliente ni CDNs externos.

## 3. Estructura y patrones

- `src/` contenido en español (`src/content/*.mjs`, `src/render.mjs`, `src/styles.css`, `src/site-config.mjs` con
  `SITE_URL` y `DOWNLOAD_URL`); `public/` capturas reales de la app; `scripts/` (`build.mjs`, `check-links.mjs`,
  `capture-screenshots.mjs`, publicación manual).
- `functions/descargas/[[path]].js` sirve el `.dmg` desde el binding R2 `DOWNLOADS` con soporte de Range;
  `wrangler.toml` (Pages + binding al bucket `video-maker-downloads`).
- Publicado en https://video.estebanburgos.com.ar (Cloudflare Pages, proyecto `video-maker`, subdominio
  `video-maker-bqo.pages.dev`), siete páginas. Deploy: `.github/workflows/deploy-docs-site.yml` en cada push a
  `main` que toque `apps/docs-site/**` (`pnpm dlx wrangler@4 pages deploy`; sin dependencias npm propias).

## 4. Convenciones propias

- El botón de descarga apunta siempre al nombre estable del `.dmg` bajo `/descargas/`.
- "Conectar la IA" lleva precios reales (DeepSeek V4.1 Flash US$0.14/0.42, Receta Tutorial ≈ US$0.13) y el aviso de
  que no se recomiendan los modelos gratis; actualizar capturas y precios cuando cambien la interfaz o las tarifas.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
