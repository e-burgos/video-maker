# apps/web — spec-e-burgos-025-liquid-glass-rebrand cycle-06 (2026-11-13)

## Estado
Paridad con la web pública: `/learn` (Guía, Cómo funciona, Tutorial desde R2, Preguntas frecuentes, Galería; `/guide` redirige), `/about` (Versión con «Buscar actualizaciones», Requisitos, Licencias e inventario, Código abierto, Privacidad), pestaña `agents` en ajustes y búsqueda de material libre en la biblioteca. Barra lateral SISTEMA: Configuración, Aprender, Acerca de.

## Estructura
- `content/{learn,about,agents}/`: contenido propio es/en como datos tipados (D-09). `content/about/tech-inventory.ts` se genera desde `apps/docs-site/src/tech-inventory.mjs`; `tech-inventory-alignment.spec.ts` lo compara con `import()` dinámico (`@vitest-environment node`).
- `components/learn/` (visor propio de galería `image-lightbox`), `components/about/` (`requirements-model`, `update-check-model`), `components/agents/` (bloques copiables), `components/library/free-media/` (búsqueda e importación de imágenes, video y música; rol fijado por tipo).
- `public/gallery/` y `public/learn/tutorial-poster.jpg`.
- `components/shell/capability-rows.ts`: el modal de estado muestra los motores del productor por motor; enlaza a `/about?tab=requirements`.
- Cliente: `getAppUpdate`, `searchFreeMedia`, `importFreeMedia`, `searchFreeMusic`, `importFreeMusic`.
- `--tucu-state-green-ink` en claro pasa a `#085a1e` (AA en badges largos).

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Correr los e2e contra un studio aislado antes de la PR; revisar en Electron.
