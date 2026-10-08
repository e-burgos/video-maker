# spec-e-burgos-021-brand-kit cycle-02 — 2026-10-08

## Estado
Página **Marcas** (`/brands`) en el encabezado del estudio: marcas propias e incluidas, nueva, duplicar y borrar. Editor
`/brands/:id` con secciones identidad, logo, colores (4 base + avanzado por variable), tipografías (Google Fonts o
archivo), voz, música, fotos y productos (4 esquinas de la pantalla sobre la foto), y vista previa en vivo en un iframe:
colores por `postMessage` `mg-brand-tokens` + recompuesta diferida; logo, tipografías e identidad recomponen. Una
incluida se ve de sólo lectura con "Duplicar". Cambiar un color base recalcula todos los colores y descarta los retoques.

## Estructura
`pages/brands-page.tsx`, `pages/brand-editor-page.tsx`, 17 `components/brand-*.tsx`, hooks `use-brand-editor`,
`use-section-draft`, `use-brand-upload`, `use-brand-font-faces`; `api/brand-types.ts`, `brand-files.ts`,
`brand-manifest-edit.ts`, `brand-photo-rows.ts`, `google-font-families.ts`; sección "Marcas" en la guía.

## Dependencias
Sin cambios.

## Qué sigue
cycle-03: selector de marca al crear el video y en el brief.
