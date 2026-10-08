# FIX-e-burgos-008 — Créditos de música de los videos de material crudo al publicar en YouTube

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-008 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-08 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
El borrador y la publicación sólo leían el `<video>.credits.txt` que deja el render motion. Los tutoriales de material
crudo llevan su música CC BY en `work/credits.json` (dos formatos: la lista del import de música y el `assets` de los
tutoriales), así que se publicaban sin la atribución que exige la licencia.

## Solución
Sin `.credits.txt`, `readCreditsText` arma las líneas de crédito desde `work/credits.json` en cualquiera de los dos
formatos (`Música: "Título" Autor (Fuente) · Licencia`).
