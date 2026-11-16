# FIX-e-burgos-091 — Logo nuevo, íconos y SEO de marca en la web

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-14 |
| **Estado** | implemented |

## Qué cambia
- Header, footer y `favicon.svg` usan el logo nuevo de spec-025 (V dentro de la lente), igual al de la app.
- `favicon.ico` (16/32/48), `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` y `site.webmanifest`.
- Imagen para compartir 1200×630 por idioma (`og-es.jpg`, `og-en.jpg`) con logo, tagline y una captura; `og:image:alt` y etiquetas `twitter:*`.
- JSON-LD schema.org: `WebSite` en todas las páginas y `SoftwareApplication` (macOS, gratis, repo, descarga) en el inicio.
- Descripciones de hasta 160 caracteres (inicio y tecnología se cortaban), con test que lo exige en todas las páginas.
- Datos estructurados `VideoObject` del tutorial y los dos demos (duración, fecha, miniatura, URL), `FAQPage` armado desde los ítems de preguntas frecuentes y `BreadcrumbList` en las páginas internas.
- `404.html` bilingüe con `noindex` y rutas absolutas: sin ella Cloudflare Pages devolvía el inicio con 200 para cualquier URL inexistente.
- Tamaño de descarga actualizado a «≈270 MB» (instalador 0.5.0; decía ≈311 MB de la 0.4.2).
