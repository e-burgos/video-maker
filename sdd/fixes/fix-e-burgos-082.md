# FIX-e-burgos-082 — Ajustes del plugin tras las pruebas en repos vacíos

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Plan** | docs/plans/2026-11-12-plugin-video-maker.md |

## Qué mostraron las pruebas
- Librería sin UI → motion: storyboard de 7 escenas, pero heredó la música de otra marca.
- Web chica → tutorial grabado 9:16: grabación, montaje y propuesta, pero dejó archivos en el repo y nombró un campo inexistente.

## Solución
- `POST /brands/:id/music/import` y la tool `import_brand_music`.
- Siete aclaraciones en las skills (propuesta en ambos modos, nombre hablado, 9:16, Playwright, `tone`, logo solo, higiene del repo).
